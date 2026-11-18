-- Links temporários da família.
-- O banco guarda só o hash do token. O token puro aparece uma vez para o funcionário.
-- A validade de 7 dias é a sugestão já registrada; a tela deixa escolher de 1 a 30.
-- Arquivo externo entra em quarentena/ e só sai de lá na aprovação.

create table public.solicitacoes_cadastro (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  expira_em timestamptz not null,
  revogado_em timestamptz,
  criado_por uuid not null references public.perfis_usuarios (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  status text not null default 'aberto',
  crianca_id uuid references public.criancas (id),
  conferir_manualmente boolean not null default false,
  observacao text,
  dados jsonb,
  envios_total integer not null default 0,
  janela_inicio timestamptz,
  envios_na_janela integer not null default 0,
  constraint solicitacoes_cadastro_status check (
    status in ('aberto', 'enviado', 'correcao', 'aprovado')
  ),
  constraint solicitacoes_cadastro_observacao check (
    observacao is null or char_length(observacao) <= 500
  ),
  constraint solicitacoes_cadastro_envios check (
    envios_total >= 0 and envios_na_janela >= 0
  )
);

comment on table public.solicitacoes_cadastro is
  'Link de cadastro da família. token_hash é SHA-256; o token puro não fica gravado.';

comment on column public.solicitacoes_cadastro.conferir_manualmente is
  'O CPF informado já existia ou conflitou. Não cria outra criança e não devolve o cadastro existente.';

create table public.solicitacoes_documentos (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  crianca_id uuid not null references public.criancas (id),
  expira_em timestamptz not null,
  revogado_em timestamptz,
  criado_por uuid not null references public.perfis_usuarios (id),
  criado_em timestamptz not null default now(),
  status text not null default 'aberto',
  envios_total integer not null default 0,
  janela_inicio timestamptz,
  envios_na_janela integer not null default 0,
  constraint solicitacoes_documentos_status check (
    status in ('aberto', 'enviado', 'encerrado')
  ),
  constraint solicitacoes_documentos_envios check (
    envios_total >= 0 and envios_na_janela >= 0
  )
);

create index solicitacoes_documentos_crianca
  on public.solicitacoes_documentos (crianca_id);

create table public.solicitacoes_documentos_tipos (
  solicitacao_id uuid not null references public.solicitacoes_documentos (id) on delete cascade,
  tipo_id uuid not null references public.tipos_documento (id),
  primary key (solicitacao_id, tipo_id)
);

create table public.arquivos_quarentena (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.solicitacoes_cadastro (id),
  tipo_id uuid not null references public.tipos_documento (id),
  caminho text not null unique,
  nome_arquivo text not null,
  tipo_mime text not null,
  tamanho_bytes integer not null,
  criado_em timestamptz not null default now(),
  constraint arquivos_quarentena_tamanho check (
    tamanho_bytes > 0 and tamanho_bytes <= 10485760
  ),
  constraint arquivos_quarentena_mime check (
    tipo_mime in ('application/pdf', 'image/jpeg', 'image/png')
  )
);

comment on table public.arquivos_quarentena is
  'Arquivo de um cadastro que não gerou criança. Não é ligado a outro cadastro.';

create trigger solicitacoes_cadastro_atualizado
  before update on public.solicitacoes_cadastro
  for each row
  execute function public.definir_atualizado_em();

alter table public.solicitacoes_cadastro enable row level security;
alter table public.solicitacoes_cadastro force row level security;
alter table public.solicitacoes_documentos enable row level security;
alter table public.solicitacoes_documentos force row level security;
alter table public.solicitacoes_documentos_tipos enable row level security;
alter table public.solicitacoes_documentos_tipos force row level security;
alter table public.arquivos_quarentena enable row level security;
alter table public.arquivos_quarentena force row level security;

create policy "funcionario le solicitacoes de cadastro"
  on public.solicitacoes_cadastro
  for select
  to authenticated
  using (public.eh_funcionario_ativo());

create policy "funcionario le solicitacoes de documentos"
  on public.solicitacoes_documentos
  for select
  to authenticated
  using (public.eh_funcionario_ativo());

create policy "funcionario le tipos do link"
  on public.solicitacoes_documentos_tipos
  for select
  to authenticated
  using (public.eh_funcionario_ativo());

create policy "funcionario le quarentena de cadastro"
  on public.arquivos_quarentena
  for select
  to authenticated
  using (public.eh_funcionario_ativo());

revoke all on table public.solicitacoes_cadastro from public, anon, authenticated;
revoke all on table public.solicitacoes_documentos from public, anon, authenticated;
revoke all on table public.solicitacoes_documentos_tipos from public, anon, authenticated;
revoke all on table public.arquivos_quarentena from public, anon, authenticated;

grant select (
  id, expira_em, revogado_em, criado_por, criado_em, atualizado_em, status,
  crianca_id, conferir_manualmente, observacao, dados, envios_total
) on public.solicitacoes_cadastro to authenticated;

grant select (
  id, crianca_id, expira_em, revogado_em, criado_por, criado_em, status, envios_total
) on public.solicitacoes_documentos to authenticated;

grant select (solicitacao_id, tipo_id) on public.solicitacoes_documentos_tipos to authenticated;

grant select (
  id, solicitacao_id, tipo_id, caminho, nome_arquivo, tipo_mime, tamanho_bytes, criado_em
) on public.arquivos_quarentena to authenticated;

create policy "funcionario le arquivo em quarentena"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'documentos'
    and public.eh_funcionario_ativo()
    and name ~ '^quarentena/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$'
  );

create or replace function public.consumir_cota_familia(p_finalidade text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_janela timestamptz;
  v_na_janela integer;
begin
  if p_finalidade = 'cadastro' then
    select envios_total, janela_inicio, envios_na_janela
      into v_total, v_janela, v_na_janela
    from public.solicitacoes_cadastro
    where id = p_id
    for update;
  else
    select envios_total, janela_inicio, envios_na_janela
      into v_total, v_janela, v_na_janela
    from public.solicitacoes_documentos
    where id = p_id
    for update;
  end if;

  if v_total is null or v_total >= 30 then
    raise exception 'Este link atingiu o limite de envios.';
  end if;

  if v_janela is not null
     and v_janela > now() - interval '10 minutes'
     and v_na_janela >= 8 then
    raise exception 'Muitos envios em pouco tempo. Aguarde alguns minutos.';
  end if;

  if p_finalidade = 'cadastro' then
    update public.solicitacoes_cadastro
      set envios_total = envios_total + 1,
          janela_inicio = case
            when v_janela is null or v_janela <= now() - interval '10 minutes' then now()
            else janela_inicio
          end,
          envios_na_janela = case
            when v_janela is null or v_janela <= now() - interval '10 minutes' then 1
            else envios_na_janela + 1
          end
    where id = p_id;
  else
    update public.solicitacoes_documentos
      set envios_total = envios_total + 1,
          janela_inicio = case
            when v_janela is null or v_janela <= now() - interval '10 minutes' then now()
            else janela_inicio
          end,
          envios_na_janela = case
            when v_janela is null or v_janela <= now() - interval '10 minutes' then 1
            else envios_na_janela + 1
          end
    where id = p_id;
  end if;
end;
$$;

create or replace function public.inserir_versao_quarentena(
  p_crianca uuid,
  p_tipo uuid,
  p_caminho text,
  p_nome text,
  p_mime text,
  p_tamanho integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_documento uuid;
  v_numero integer;
  v_versao uuid;
  v_nome text;
begin
  if p_caminho is null or p_caminho !~ '^quarentena/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$' then
    raise exception 'Não foi possível concluir a operação. Tente novamente.';
  end if;

  if exists (
    select 1 from public.versoes_documento where caminho = p_caminho
  ) then
    select id into v_versao from public.versoes_documento where caminho = p_caminho;
    return v_versao;
  end if;

  if not exists (
    select 1 from public.criancas
    where id = p_crianca and excluido_em is null
  ) then
    raise exception 'Cadastro não encontrado.';
  end if;

  if not exists (
    select 1 from public.tipos_documento where id = p_tipo and ativo
  ) then
    raise exception 'Tipo de documento não encontrado.';
  end if;

  v_nome := regexp_replace(btrim(coalesce(p_nome, '')), '[\\/]+', '', 'g');
  if char_length(v_nome) = 0 or char_length(v_nome) > 180 then
    raise exception 'Informe o nome do arquivo.';
  end if;

  if p_mime not in ('application/pdf', 'image/jpeg', 'image/png') then
    raise exception 'Envie um PDF, JPEG ou PNG.';
  end if;

  if p_tamanho is null or p_tamanho <= 0 or p_tamanho > 10485760 then
    raise exception 'O arquivo deve ter até 10 MB.';
  end if;

  insert into public.documentos (crianca_id, tipo_id)
  values (p_crianca, p_tipo)
  on conflict (crianca_id, tipo_id) do update
    set crianca_id = excluded.crianca_id
  returning id into v_documento;

  select coalesce(max(numero), 0) + 1
    into v_numero
  from public.versoes_documento
  where documento_id = v_documento;

  v_versao := gen_random_uuid();

  update public.versoes_documento
  set atual = false
  where documento_id = v_documento
    and atual;

  insert into public.versoes_documento (
    id, documento_id, numero, status, caminho, nome_arquivo, tipo_mime, tamanho_bytes, enviado_por, atual
  )
  values (
    v_versao, v_documento, v_numero, 'pendente', p_caminho, v_nome, p_mime, p_tamanho, null, true
  );

  return v_versao;
end;
$$;

create or replace function public.anexar_arquivos_quarentena(p_solicitacao uuid, p_crianca uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_arquivo public.arquivos_quarentena;
begin
  for v_arquivo in
    select *
    from public.arquivos_quarentena
    where solicitacao_id = p_solicitacao
  loop
    perform public.inserir_versao_quarentena(
      p_crianca,
      v_arquivo.tipo_id,
      v_arquivo.caminho,
      v_arquivo.nome_arquivo,
      v_arquivo.tipo_mime,
      v_arquivo.tamanho_bytes
    );
    delete from public.arquivos_quarentena where id = v_arquivo.id;
  end loop;
end;
$$;

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

  insert into public.solicitacoes_cadastro (token_hash, expira_em, criado_por)
  values (encode(digest(v_token, 'sha256'), 'hex'), v_expira, auth.uid())
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'token', v_token, 'expira_em', v_expira);
end;
$$;

create or replace function public.criar_link_documentos(
  p_crianca uuid,
  p_dias integer,
  p_tipos uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
  v_id uuid;
  v_expira timestamptz;
  v_tipo uuid;
begin
  if not public.eh_funcionario_ativo() then
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;

  if p_dias is null or p_dias < 1 or p_dias > 30 then
    raise exception 'Informe uma validade entre 1 e 30 dias.';
  end if;

  if not exists (
    select 1 from public.criancas
    where id = p_crianca and excluido_em is null
  ) then
    raise exception 'Cadastro não encontrado.';
  end if;

  if p_tipos is null or cardinality(p_tipos) = 0 then
    raise exception 'Selecione ao menos um tipo de documento.';
  end if;

  if exists (
    select 1
    from unnest(p_tipos) as pedido (id)
    where not exists (
      select 1 from public.tipos_documento tipo
      where tipo.id = pedido.id and tipo.ativo
    )
  ) then
    raise exception 'Tipo de documento não encontrado.';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_expira := now() + make_interval(days => p_dias);

  insert into public.solicitacoes_documentos (token_hash, crianca_id, expira_em, criado_por)
  values (encode(digest(v_token, 'sha256'), 'hex'), p_crianca, v_expira, auth.uid())
  returning id into v_id;

  foreach v_tipo in array p_tipos loop
    insert into public.solicitacoes_documentos_tipos (solicitacao_id, tipo_id)
    values (v_id, v_tipo)
    on conflict do nothing;
  end loop;

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
    update public.solicitacoes_cadastro
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
  v_cadastro public.solicitacoes_cadastro;
  v_documento public.solicitacoes_documentos;
  v_tipos jsonb;
  v_beneficios jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;

  if p_token is null or p_token !~ '^[0-9a-fA-F]{64}$' then
    return jsonb_build_object('valido', false, 'mensagem', 'Este link não está mais válido.');
  end if;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select * into v_cadastro
  from public.solicitacoes_cadastro
  where token_hash = v_hash;

  if v_cadastro.id is not null then
    if v_cadastro.revogado_em is not null
       or v_cadastro.expira_em <= now()
       or v_cadastro.status = 'aprovado' then
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
    from public.tipos_documento tipo
    where tipo.ativo;

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

    return jsonb_build_object(
      'valido', true,
      'finalidade', 'cadastro',
      'status', v_cadastro.status,
      'observacao', v_cadastro.observacao,
      'dados', v_cadastro.dados,
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
  v_sol public.solicitacoes_cadastro;
  v_dados jsonb;
  v_normalizado jsonb;
  v_cpf text;
  v_crianca uuid;
  v_responsavel uuid;
  v_cpf_responsavel text;
  v_outros integer;
  v_beneficio uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;

  if p_token is null or p_token !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Este link não está mais válido.' using errcode = '42501';
  end if;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select * into v_sol
  from public.solicitacoes_cadastro
  where token_hash = v_hash
  for update;

  if v_sol.id is null
     or v_sol.revogado_em is not null
     or v_sol.expira_em <= now()
     or v_sol.status = 'aprovado' then
    raise exception 'Este link não está mais válido.' using errcode = '42501';
  end if;

  perform public.consumir_cota_familia('cadastro', v_sol.id);

  v_dados := coalesce(p_dados, '{}'::jsonb);
  v_dados := jsonb_set(v_dados, '{crianca,status}', '"pendente_validacao"'::jsonb, true);
  v_dados := jsonb_set(v_dados, '{crianca,observacoes}', 'null'::jsonb, true);
  v_dados := jsonb_set(v_dados, '{crianca,data_ingresso}', 'null'::jsonb, true);
  v_normalizado := public.normalizar_cadastro(v_dados);
  v_normalizado := jsonb_set(v_normalizado, '{crianca,status}', '"pendente_validacao"'::jsonb, true);
  v_cpf := v_normalizado #>> '{crianca,cpf}';
  v_cpf_responsavel := v_normalizado #>> '{responsavel,cpf}';

  if v_sol.crianca_id is null then
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
      return jsonb_build_object('recebido', true);
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
        return jsonb_build_object('recebido', true);
    end;

    perform public.anexar_arquivos_quarentena(v_sol.id, v_crianca);

    update public.solicitacoes_cadastro
      set status = 'enviado',
          conferir_manualmente = false,
          crianca_id = v_crianca,
          dados = v_normalizado
    where id = v_sol.id;

    return jsonb_build_object('recebido', true);
  end if;

  if v_cpf is not null and exists (
    select 1 from public.criancas crianca
    where crianca.cpf = v_cpf
      and crianca.excluido_em is null
      and crianca.id <> v_sol.crianca_id
  ) then
    update public.solicitacoes_cadastro
      set status = 'enviado',
          conferir_manualmente = true,
          dados = v_normalizado
    where id = v_sol.id;
    return jsonb_build_object('recebido', true);
  end if;

  begin
    update public.criancas
      set nome = v_normalizado #>> '{crianca,nome}',
          rg = v_normalizado #>> '{crianca,rg}',
          orgao_emissor_rg = v_normalizado #>> '{crianca,orgao_emissor_rg}',
          cpf = v_cpf,
          data_nascimento = (v_normalizado #>> '{crianca,data_nascimento}')::date,
          recebe_beneficio = v_normalizado #>> '{crianca,recebe_beneficio}'
    where id = v_sol.crianca_id
      and status = 'pendente_validacao'
      and excluido_em is null;

    if not found then
      raise exception 'Este link não aceita mais alterações.' using errcode = '42501';
    end if;

    select vinculo.responsavel_id
      into v_responsavel
    from public.crianca_responsaveis vinculo
    where vinculo.crianca_id = v_sol.crianca_id
      and vinculo.principal
    limit 1;

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

      insert into public.crianca_responsaveis (crianca_id, responsavel_id, parentesco, principal)
      values (v_sol.crianca_id, v_responsavel, v_normalizado #>> '{responsavel,parentesco}', true);
    else
      select count(*)
        into v_outros
      from public.crianca_responsaveis vinculo
      where vinculo.responsavel_id = v_responsavel
        and vinculo.crianca_id <> v_sol.crianca_id;

      if v_outros = 0 then
        update public.responsaveis
          set nome = v_normalizado #>> '{responsavel,nome}',
              rg = v_normalizado #>> '{responsavel,rg}',
              orgao_emissor_rg = v_normalizado #>> '{responsavel,orgao_emissor_rg}',
              cpf = v_cpf_responsavel,
              email = v_normalizado #>> '{responsavel,email}',
              telefone = v_normalizado #>> '{responsavel,telefone}'
        where id = v_responsavel;
      end if;

      update public.crianca_responsaveis
        set parentesco = v_normalizado #>> '{responsavel,parentesco}'
      where crianca_id = v_sol.crianca_id
        and principal;
    end if;

    delete from public.crianca_beneficios where crianca_id = v_sol.crianca_id;

    for v_beneficio in
      select valor::uuid
      from jsonb_array_elements_text(v_normalizado -> 'beneficios') as valor
    loop
      insert into public.crianca_beneficios (crianca_id, beneficio_id)
      values (v_sol.crianca_id, v_beneficio);
    end loop;
  exception
    when unique_violation then
      update public.solicitacoes_cadastro
        set status = 'enviado',
            conferir_manualmente = true,
            dados = v_normalizado
      where id = v_sol.id;
      return jsonb_build_object('recebido', true);
  end;

  update public.solicitacoes_cadastro
    set status = 'enviado',
        conferir_manualmente = false,
        dados = v_normalizado
  where id = v_sol.id;

  return jsonb_build_object('recebido', true);
end;
$$;

create or replace function public.reservar_arquivo_familia(
  p_token text,
  p_finalidade text,
  p_tipo uuid,
  p_mime text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_id uuid;
  v_crianca uuid;
  v_extensao text;
  v_caminho text;
  v_objetos integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;

  if p_finalidade not in ('cadastro', 'documentos') then
    raise exception 'Este link não está mais válido.' using errcode = '42501';
  end if;

  if p_token is null or p_token !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Este link não está mais válido.' using errcode = '42501';
  end if;

  if p_mime not in ('application/pdf', 'image/jpeg', 'image/png') then
    raise exception 'Envie um PDF, JPEG ou PNG.';
  end if;

  v_extensao := case p_mime
    when 'application/pdf' then 'pdf'
    when 'image/jpeg' then 'jpg'
    else 'png'
  end;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  if p_finalidade = 'cadastro' then
    select id into v_id
    from public.solicitacoes_cadastro
    where token_hash = v_hash
      and revogado_em is null
      and expira_em > now()
      and status <> 'aprovado'
    for update;

    if v_id is null then
      raise exception 'Este link não está mais válido.' using errcode = '42501';
    end if;

    if not exists (
      select 1 from public.tipos_documento where id = p_tipo and ativo
    ) then
      raise exception 'Tipo de documento não encontrado.';
    end if;
  else
    select id, crianca_id into v_id, v_crianca
    from public.solicitacoes_documentos
    where token_hash = v_hash
      and revogado_em is null
      and expira_em > now()
      and status <> 'encerrado'
    for update;

    if v_id is null or not exists (
      select 1 from public.criancas
      where id = v_crianca and excluido_em is null
    ) then
      raise exception 'Este link não está mais válido.' using errcode = '42501';
    end if;

    if not exists (
      select 1
      from public.solicitacoes_documentos_tipos permitido
      join public.tipos_documento tipo on tipo.id = permitido.tipo_id
      where permitido.solicitacao_id = v_id
        and permitido.tipo_id = p_tipo
        and tipo.ativo
    ) then
      raise exception 'Tipo de documento não encontrado.';
    end if;
  end if;

  select count(*) into v_objetos
  from storage.objects
  where bucket_id = 'documentos'
    and name like 'quarentena/' || v_id::text || '/%';

  if v_objetos >= 30 then
    raise exception 'Este link atingiu o limite de envios.';
  end if;

  v_caminho := 'quarentena/' || v_id::text || '/' || gen_random_uuid()::text || '.' || v_extensao;
  return jsonb_build_object('caminho', v_caminho);
end;
$$;

create or replace function public.confirmar_arquivo_familia(
  p_token text,
  p_finalidade text,
  p_tipo uuid,
  p_caminho text,
  p_nome text,
  p_mime text,
  p_tamanho integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_id uuid;
  v_crianca uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;

  if p_finalidade not in ('cadastro', 'documentos')
     or p_token is null
     or p_token !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Este link não está mais válido.' using errcode = '42501';
  end if;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  if p_finalidade = 'cadastro' then
    select id, crianca_id into v_id, v_crianca
    from public.solicitacoes_cadastro
    where token_hash = v_hash
      and revogado_em is null
      and expira_em > now()
      and status <> 'aprovado'
    for update;
  else
    select id, crianca_id into v_id, v_crianca
    from public.solicitacoes_documentos
    where token_hash = v_hash
      and revogado_em is null
      and expira_em > now()
      and status <> 'encerrado'
    for update;
  end if;

  if v_id is null or p_caminho !~ ('^quarentena/' || v_id::text || '/[0-9a-f-]{36}\.(pdf|jpg|png)$') then
    raise exception 'Este link não está mais válido.' using errcode = '42501';
  end if;

  perform public.consumir_cota_familia(p_finalidade, v_id);

  if char_length(regexp_replace(btrim(coalesce(p_nome, '')), '[\\/]+', '', 'g')) = 0 then
    raise exception 'Informe o nome do arquivo.';
  end if;

  if p_finalidade = 'documentos' or v_crianca is not null then
    if p_finalidade = 'documentos' and not exists (
      select 1 from public.solicitacoes_documentos_tipos
      where solicitacao_id = v_id and tipo_id = p_tipo
    ) then
      raise exception 'Tipo de documento não encontrado.';
    end if;

    perform public.inserir_versao_quarentena(
      v_crianca, p_tipo, p_caminho, p_nome, p_mime, p_tamanho
    );

    if p_finalidade = 'documentos' then
      update public.solicitacoes_documentos
        set status = 'enviado'
      where id = v_id
        and status = 'aberto';
    end if;
  else
    if not exists (
      select 1 from public.tipos_documento where id = p_tipo and ativo
    ) then
      raise exception 'Tipo de documento não encontrado.';
    end if;

    insert into public.arquivos_quarentena (
      solicitacao_id, tipo_id, caminho, nome_arquivo, tipo_mime, tamanho_bytes
    )
    values (
      v_id,
      p_tipo,
      p_caminho,
      regexp_replace(btrim(coalesce(p_nome, '')), '[\\/]+', '', 'g'),
      p_mime,
      p_tamanho
    );
  end if;

  return jsonb_build_object('recebido', true);
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
    set status = 'aprovado',
        revogado_em = coalesce(revogado_em, now())
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

create or replace function public.pedir_correcao_cadastro(p_id uuid, p_observacao text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_observacao text;
begin
  if not public.eh_funcionario_ativo() then
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;

  v_observacao := nullif(btrim(coalesce(p_observacao, '')), '');
  if v_observacao is null or char_length(v_observacao) > 500 then
    raise exception 'A observação deve ter até 500 caracteres.';
  end if;

  update public.solicitacoes_cadastro
    set status = 'correcao',
        observacao = v_observacao
  where id = p_id
    and status in ('enviado', 'correcao')
    and revogado_em is null
    and expira_em > now();

  if not found then
    raise exception 'Cadastro não encontrado.';
  end if;
end;
$$;

create or replace function public.concluir_promocao_quarentena(p_versao uuid, p_caminho text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caminho text;
  v_documento uuid;
  v_crianca uuid;
  v_mime text;
  v_extensao text;
  v_esperado text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;

  select versao.caminho, versao.documento_id, versao.tipo_mime, documento.crianca_id
    into v_caminho, v_documento, v_mime, v_crianca
  from public.versoes_documento versao
  join public.documentos documento on documento.id = versao.documento_id
  where versao.id = p_versao
  for update of versao;

  if v_caminho is null or v_caminho not like 'quarentena/%' then
    raise exception 'O arquivo já foi promovido.';
  end if;

  v_extensao := case v_mime
    when 'application/pdf' then 'pdf'
    when 'image/jpeg' then 'jpg'
    else 'png'
  end;

  v_esperado := v_crianca::text || '/' || v_documento::text || '/' || p_versao::text || '.' || v_extensao;
  if p_caminho is distinct from v_esperado then
    raise exception 'Não foi possível concluir a operação. Tente novamente.';
  end if;

  update public.versoes_documento
    set caminho = v_esperado,
        status = 'aprovado'
  where id = p_versao;

  return v_caminho;
end;
$$;

create or replace function public.definir_status_documento(
  p_versao uuid,
  p_status text,
  p_observacao text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_observacao text;
begin
  if not public.eh_funcionario_ativo() then
    raise exception 'Sem permissão para enviar documentos.';
  end if;

  if p_status not in ('em_analise', 'aprovado', 'rejeitado') then
    raise exception 'Informe uma situação válida.';
  end if;

  if p_status = 'aprovado' and exists (
    select 1 from public.versoes_documento
    where id = p_versao and caminho like 'quarentena/%'
  ) then
    raise exception 'O arquivo ainda está na quarentena.';
  end if;

  v_observacao := nullif(btrim(coalesce(p_observacao, '')), '');
  if v_observacao is not null and char_length(v_observacao) > 500 then
    raise exception 'A observação deve ter até 500 caracteres.';
  end if;

  update public.versoes_documento as versao
  set status = p_status,
      observacao = v_observacao
  from public.documentos as documento
  join public.criancas as crianca on crianca.id = documento.crianca_id
  where versao.id = p_versao
    and documento.id = versao.documento_id
    and crianca.excluido_em is null;

  if not found then
    raise exception 'Cadastro não encontrado.';
  end if;
end;
$$;

revoke all on function public.consumir_cota_familia(text, uuid) from public, anon, authenticated;
revoke all on function public.inserir_versao_quarentena(uuid, uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.anexar_arquivos_quarentena(uuid, uuid) from public, anon, authenticated;
revoke all on function public.descrever_link_familia(text) from public, anon, authenticated;
revoke all on function public.receber_cadastro_familia(text, jsonb) from public, anon, authenticated;
revoke all on function public.reservar_arquivo_familia(text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.confirmar_arquivo_familia(text, text, uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.concluir_promocao_quarentena(uuid, text) from public, anon, authenticated;

grant execute on function public.descrever_link_familia(text) to service_role;
grant execute on function public.receber_cadastro_familia(text, jsonb) to service_role;
grant execute on function public.reservar_arquivo_familia(text, text, uuid, text) to service_role;
grant execute on function public.confirmar_arquivo_familia(text, text, uuid, text, text, text, integer) to service_role;
grant execute on function public.concluir_promocao_quarentena(uuid, text) to service_role;

revoke all on function public.criar_link_cadastro(integer) from public, anon;
revoke all on function public.criar_link_documentos(uuid, integer, uuid[]) from public, anon;
revoke all on function public.revogar_link_familia(uuid, text) from public, anon;
revoke all on function public.aprovar_solicitacao_cadastro(uuid) from public, anon;
revoke all on function public.pedir_correcao_cadastro(uuid, text) from public, anon;
revoke all on function public.definir_status_documento(uuid, text, text) from public, anon;

grant execute on function public.criar_link_cadastro(integer) to authenticated;
grant execute on function public.criar_link_documentos(uuid, integer, uuid[]) to authenticated;
grant execute on function public.revogar_link_familia(uuid, text) to authenticated;
grant execute on function public.aprovar_solicitacao_cadastro(uuid) to authenticated;
grant execute on function public.pedir_correcao_cadastro(uuid, text) to authenticated;
grant execute on function public.definir_status_documento(uuid, text, text) to authenticated;
