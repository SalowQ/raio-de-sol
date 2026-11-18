-- Um link de cadastro pode receber várias famílias.
-- Cada envio cria um cadastro novo. Reabrir o endereço não devolve dados já enviados.
-- Aprovar um cadastro não fecha o link. Revogar o link impede só os envios seguintes.
-- O limite de 30 envios a cada 10 minutos é proteção técnica contra abuso, não regra do instituto.

create table public.links_cadastro (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  token text,
  expira_em timestamptz not null,
  revogado_em timestamptz,
  criado_por uuid not null references public.perfis_usuarios (id),
  criado_em timestamptz not null default now(),
  envios_total integer not null default 0,
  janela_inicio timestamptz,
  envios_na_janela integer not null default 0,
  constraint links_cadastro_envios check (
    envios_total >= 0 and envios_na_janela >= 0
  )
);

comment on table public.links_cadastro is
  'Endereço compartilhado de cadastro. O token valida o link; cada família gera uma solicitação própria.';

comment on column public.links_cadastro.token is
  'Token do link, visível só para funcionário ativo, para reexibir o endereço. A validação continua pelo hash.';

alter table public.links_cadastro enable row level security;
alter table public.links_cadastro force row level security;

revoke all on table public.links_cadastro from public, anon, authenticated;

create policy "funcionario le links de cadastro"
  on public.links_cadastro
  for select
  to authenticated
  using (public.eh_funcionario_ativo());

grant select (id, token, expira_em, revogado_em, criado_por, criado_em)
  on public.links_cadastro to authenticated;

alter table public.solicitacoes_cadastro
  add column link_id uuid references public.links_cadastro (id);

insert into public.links_cadastro (token_hash, token, expira_em, revogado_em, criado_por, criado_em)
select token_hash, token, expira_em, revogado_em, criado_por, criado_em
from public.solicitacoes_cadastro;

update public.solicitacoes_cadastro as solicitacao
set link_id = link.id
from public.links_cadastro as link
where link.token_hash = solicitacao.token_hash;

update public.solicitacoes_cadastro
set token = null,
    token_hash = encode(extensions.digest(extensions.gen_random_bytes(32), 'sha256'), 'hex')
where link_id is not null;

alter table public.solicitacoes_cadastro
  alter column link_id set not null;

create index solicitacoes_cadastro_link
  on public.solicitacoes_cadastro (link_id);

grant select (link_id) on public.solicitacoes_cadastro to authenticated;

comment on table public.solicitacoes_cadastro is
  'Um envio feito por um link geral. O token público fica em links_cadastro.';

create or replace function public.criar_link_cadastro(p_dias integer)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
  v_id uuid;
  v_expira timestamptz;
begin
  if not public.eh_funcionario_ativo() then
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;

  if p_dias is null or p_dias < 1 or p_dias > 30 then
    raise exception 'Informe uma validade entre 1 e 30 dias.';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_expira := now() + make_interval(days => p_dias);

  insert into public.links_cadastro (token_hash, token, expira_em, criado_por)
  values (encode(digest(v_token, 'sha256'), 'hex'), v_token, v_expira, auth.uid())
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'token', v_token, 'expira_em', v_expira);
end;
$$;

create or replace function public.revogar_link_familia(p_id uuid, p_finalidade text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.eh_funcionario_ativo() then
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;

  if p_finalidade = 'cadastro' then
    update public.links_cadastro
      set revogado_em = now()
    where id = p_id
      and revogado_em is null;
  elsif p_finalidade = 'documentos' then
    update public.solicitacoes_documentos
      set revogado_em = now(),
          status = 'encerrado'
    where id = p_id
      and revogado_em is null;
  else
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;

  if not found then
    raise exception 'Cadastro não encontrado.';
  end if;
end;
$$;

create or replace function public.descrever_link_familia(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_link public.links_cadastro;
  v_documento public.solicitacoes_documentos;
  v_tipos jsonb;
  v_beneficios jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-fA-F]{64}$' then
    return jsonb_build_object('valido', false, 'mensagem', 'Este link não está mais válido.');
  end if;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select * into v_link
  from public.links_cadastro
  where token_hash = v_hash;

  if v_link.id is not null then
    if v_link.revogado_em is not null or v_link.expira_em <= now() then
      return jsonb_build_object('valido', false, 'mensagem', 'Este link não está mais válido.');
    end if;

    select coalesce(
      jsonb_agg(
        jsonb_build_object('id', beneficio.id, 'codigo', beneficio.codigo, 'nome', beneficio.nome)
        order by beneficio.ordem
      ),
      '[]'::jsonb
    )
      into v_beneficios
    from public.beneficios beneficio
    where beneficio.ativo;

    select coalesce(
      jsonb_agg(
        jsonb_build_object('id', tipo.id, 'nome', tipo.nome, 'ordem', tipo.ordem)
        order by tipo.ordem
      ),
      '[]'::jsonb
    )
      into v_tipos
    from public.tipos_documento tipo
    where tipo.ativo;

    return jsonb_build_object(
      'valido', true,
      'finalidade', 'cadastro',
      'status', 'aberto',
      'observacao', null,
      'dados', null,
      'tipos', v_tipos,
      'beneficios', v_beneficios
    );
  end if;

  select * into v_documento
  from public.solicitacoes_documentos
  where token_hash = v_hash;

  if v_documento.id is null
     or v_documento.revogado_em is not null
     or v_documento.expira_em <= now()
     or v_documento.status = 'encerrado'
     or not exists (
       select 1 from public.criancas crianca
       where crianca.id = v_documento.crianca_id
         and crianca.excluido_em is null
     ) then
    return jsonb_build_object('valido', false, 'mensagem', 'Este link não está mais válido.');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', tipo.id, 'nome', tipo.nome, 'ordem', tipo.ordem)
      order by tipo.ordem
    ),
    '[]'::jsonb
  )
    into v_tipos
  from public.solicitacoes_documentos_tipos permitido
  join public.tipos_documento tipo on tipo.id = permitido.tipo_id
  where permitido.solicitacao_id = v_documento.id
    and tipo.ativo;

  return jsonb_build_object(
    'valido', true,
    'finalidade', 'documentos',
    'status', v_documento.status,
    'tipos', v_tipos
  );
end;
$$;

create or replace function public.receber_cadastro_familia(p_token text, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_link public.links_cadastro;
  v_sol public.solicitacoes_cadastro;
  v_dados jsonb;
  v_normalizado jsonb;
  v_cpf text;
  v_crianca uuid;
  v_responsavel uuid;
  v_cpf_responsavel text;
  v_beneficio uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Este link não está mais válido.' using errcode = '42501';
  end if;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select * into v_link
  from public.links_cadastro
  where token_hash = v_hash
  for update;

  if v_link.id is null or v_link.revogado_em is not null or v_link.expira_em <= now() then
    raise exception 'Este link não está mais válido.' using errcode = '42501';
  end if;

  if v_link.janela_inicio is not null
     and v_link.janela_inicio > now() - interval '10 minutes'
     and v_link.envios_na_janela >= 30 then
    raise exception 'Muitos envios em pouco tempo. Aguarde alguns minutos.';
  end if;

  update public.links_cadastro
    set envios_total = envios_total + 1,
        janela_inicio = case
          when janela_inicio is null or janela_inicio <= now() - interval '10 minutes' then now()
          else janela_inicio
        end,
        envios_na_janela = case
          when janela_inicio is null or janela_inicio <= now() - interval '10 minutes' then 1
          else envios_na_janela + 1
        end
  where id = v_link.id;

  insert into public.solicitacoes_cadastro (token_hash, link_id, expira_em, criado_por, status)
  values (
    encode(digest(gen_random_bytes(32), 'sha256'), 'hex'),
    v_link.id,
    v_link.expira_em,
    v_link.criado_por,
    'aberto'
  )
  returning * into v_sol;

  v_dados := coalesce(p_dados, '{}'::jsonb);
  v_dados := jsonb_set(v_dados, '{crianca,status}', '"pendente_validacao"'::jsonb, true);
  v_dados := jsonb_set(v_dados, '{crianca,observacoes}', 'null'::jsonb, true);
  v_dados := jsonb_set(v_dados, '{crianca,data_ingresso}', 'null'::jsonb, true);
  v_normalizado := public.normalizar_cadastro(v_dados);
  v_normalizado := jsonb_set(v_normalizado, '{crianca,status}', '"pendente_validacao"'::jsonb, true);
  v_cpf := v_normalizado #>> '{crianca,cpf}';
  v_cpf_responsavel := v_normalizado #>> '{responsavel,cpf}';

  if v_cpf is not null and exists (
    select 1 from public.criancas crianca
    where crianca.cpf = v_cpf and crianca.excluido_em is null
  ) then
    update public.solicitacoes_cadastro
      set status = 'enviado',
          conferir_manualmente = true,
          crianca_id = null,
          dados = v_normalizado
    where id = v_sol.id;
    return jsonb_build_object('recebido', true, 'solicitacao_id', v_sol.id);
  end if;

  begin
    insert into public.criancas (
      nome, rg, orgao_emissor_rg, cpf, data_nascimento, status, recebe_beneficio, criado_por
    )
    values (
      v_normalizado #>> '{crianca,nome}',
      v_normalizado #>> '{crianca,rg}',
      v_normalizado #>> '{crianca,orgao_emissor_rg}',
      v_cpf,
      (v_normalizado #>> '{crianca,data_nascimento}')::date,
      'pendente_validacao',
      v_normalizado #>> '{crianca,recebe_beneficio}',
      null
    )
    returning id into v_crianca;

    v_responsavel := null;
    if v_cpf_responsavel is not null then
      select responsavel.id into v_responsavel
      from public.responsaveis responsavel
      where responsavel.cpf = v_cpf_responsavel
        and responsavel.excluido_em is null
      limit 1;
    end if;

    if v_responsavel is null then
      insert into public.responsaveis (nome, rg, orgao_emissor_rg, cpf, email, telefone)
      values (
        v_normalizado #>> '{responsavel,nome}',
        v_normalizado #>> '{responsavel,rg}',
        v_normalizado #>> '{responsavel,orgao_emissor_rg}',
        v_cpf_responsavel,
        v_normalizado #>> '{responsavel,email}',
        v_normalizado #>> '{responsavel,telefone}'
      )
      returning id into v_responsavel;
    end if;

    insert into public.crianca_responsaveis (crianca_id, responsavel_id, parentesco, principal)
    values (v_crianca, v_responsavel, v_normalizado #>> '{responsavel,parentesco}', true);

    for v_beneficio in
      select valor::uuid
      from jsonb_array_elements_text(v_normalizado -> 'beneficios') as valor
    loop
      insert into public.crianca_beneficios (crianca_id, beneficio_id)
      values (v_crianca, v_beneficio);
    end loop;
  exception
    when unique_violation then
      update public.solicitacoes_cadastro
        set status = 'enviado',
            conferir_manualmente = true,
            crianca_id = null,
            dados = v_normalizado
      where id = v_sol.id;
      return jsonb_build_object('recebido', true, 'solicitacao_id', v_sol.id);
  end;

  update public.solicitacoes_cadastro
    set status = 'enviado',
        conferir_manualmente = false,
        crianca_id = v_crianca,
        dados = v_normalizado
  where id = v_sol.id;

  return jsonb_build_object('recebido', true, 'solicitacao_id', v_sol.id);
end;
$$;

create or replace function public.aprovar_solicitacao_cadastro(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sol public.solicitacoes_cadastro;
  v_arquivos jsonb;
begin
  if not public.eh_funcionario_ativo() then
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;

  select * into v_sol
  from public.solicitacoes_cadastro
  where id = p_id
  for update;

  if v_sol.id is null then
    raise exception 'Cadastro não encontrado.';
  end if;

  if v_sol.conferir_manualmente or v_sol.crianca_id is null then
    raise exception 'Este envio precisa de conferência manual e não será ligado a outro cadastro.';
  end if;

  update public.criancas
    set status = 'ativo'
  where id = v_sol.crianca_id
    and status = 'pendente_validacao'
    and excluido_em is null;

  if not found then
    raise exception 'Cadastro não encontrado.';
  end if;

  update public.solicitacoes_cadastro
    set status = 'aprovado'
  where id = p_id;

  select coalesce(
    jsonb_agg(jsonb_build_object('versao_id', versao.id, 'caminho', versao.caminho)),
    '[]'::jsonb
  )
    into v_arquivos
  from public.versoes_documento versao
  join public.documentos documento on documento.id = versao.documento_id
  where documento.crianca_id = v_sol.crianca_id
    and versao.caminho like 'quarentena/' || p_id::text || '/%'
    and versao.status = 'pendente';

  return jsonb_build_object('crianca_id', v_sol.crianca_id, 'arquivos', v_arquivos);
end;
$$;
