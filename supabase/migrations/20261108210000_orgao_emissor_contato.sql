-- Órgão emissor do RG, e-mail e telefone do responsável.
-- Rode este arquivo no SQL Editor se 20261108160000_cadastros.sql já foi executado.

alter table public.criancas
  add column if not exists orgao_emissor_rg text;

alter table public.responsaveis
  add column if not exists orgao_emissor_rg text,
  add column if not exists email text,
  add column if not exists telefone text;

comment on column public.criancas.orgao_emissor_rg is
  'Órgão emissor do RG. Opcional.';
comment on column public.responsaveis.orgao_emissor_rg is
  'Órgão emissor do RG do responsável. Opcional.';
comment on column public.responsaveis.email is
  'E-mail do responsável, sem espaços e em minúsculas. Opcional.';
comment on column public.responsaveis.telefone is
  'Telefone do responsável só com dígitos, incluindo DDD. Opcional.';

alter table public.responsaveis
  drop constraint if exists responsaveis_telefone_digitos;

alter table public.responsaveis
  drop constraint if exists responsaveis_email_formato;

alter table public.responsaveis
  add constraint responsaveis_telefone_digitos
    check (telefone is null or telefone ~ '^[0-9]{10,11}$');

alter table public.responsaveis
  add constraint responsaveis_email_formato
    check (
      email is null
      or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    );

create or replace function public.telefone_ou_nulo(valor text)
returns text
language plpgsql
as $$
declare
  digitos text := nullif(regexp_replace(coalesce(valor, ''), '\D', '', 'g'), '');
begin
  if digitos is null then
    return null;
  end if;

  if digitos !~ '^[0-9]{10,11}$' then
    raise exception 'O telefone deve ter DDD e número.' using errcode = '22023';
  end if;

  return digitos;
end;
$$;

create or replace function public.email_ou_nulo(valor text)
returns text
language plpgsql
as $$
declare
  email text := lower(public.texto_ou_nulo(valor));
begin
  if email is null then
    return null;
  end if;

  if email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Informe um e-mail válido.' using errcode = '22023';
  end if;

  return email;
end;
$$;

create or replace function public.normalizar_cadastro(dados jsonb)
returns jsonb
language plpgsql
as $$
declare
  nome_crianca text;
  situacao text;
  beneficio_situacao text;
  parentesco text;
  ids_beneficio uuid[];
begin
  if dados is null or jsonb_typeof(dados) <> 'object' then
    raise exception 'Não foi possível concluir a operação. Tente novamente.' using errcode = '22023';
  end if;

  nome_crianca := public.texto_ou_nulo(dados #>> '{crianca,nome}');
  if nome_crianca is null then
    raise exception 'Informe o nome da criança.' using errcode = '22023';
  end if;

  if public.texto_ou_nulo(dados #>> '{responsavel,nome}') is null then
    raise exception 'Informe o nome do responsável.' using errcode = '22023';
  end if;

  situacao := coalesce(public.texto_ou_nulo(dados #>> '{crianca,status}'), 'ativo');
  beneficio_situacao := coalesce(
    public.texto_ou_nulo(dados #>> '{crianca,recebe_beneficio}'),
    'nao_informado'
  );

  if situacao not in ('pendente_validacao', 'ativo', 'inativo') then
    raise exception 'Situação da criança não reconhecida.' using errcode = '22023';
  end if;

  if beneficio_situacao not in ('nao_recebe', 'recebe', 'nao_informado') then
    raise exception 'Situação de benefício não reconhecida.' using errcode = '22023';
  end if;

  parentesco := public.texto_ou_nulo(dados #>> '{responsavel,parentesco}');
  if parentesco is not null and char_length(parentesco) > 80 then
    raise exception 'O parentesco pode ter no máximo 80 caracteres.' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(dados -> 'beneficios', '[]'::jsonb)) <> 'array' then
    raise exception 'Benefício não reconhecido.' using errcode = '22023';
  end if;

  begin
    select coalesce(array_agg(valor::uuid), '{}')
      into ids_beneficio
    from jsonb_array_elements_text(coalesce(dados -> 'beneficios', '[]'::jsonb)) as valor;
  exception
    when invalid_text_representation then
      raise exception 'Benefício não reconhecido.' using errcode = '22023';
  end;

  if beneficio_situacao = 'recebe' then
    if coalesce(array_length(ids_beneficio, 1), 0) = 0 then
      raise exception 'Selecione ao menos um benefício.' using errcode = '22023';
    end if;

    if exists (
      select 1
      from unnest(ids_beneficio) as pedido (id)
      where not exists (
        select 1
        from public.beneficios beneficio
        where beneficio.id = pedido.id
          and beneficio.ativo
      )
    ) then
      raise exception 'Benefício não reconhecido.' using errcode = '22023';
    end if;
  else
    ids_beneficio := '{}';
  end if;

  return jsonb_build_object(
    'crianca', jsonb_build_object(
      'nome', nome_crianca,
      'rg', public.texto_ou_nulo(dados #>> '{crianca,rg}'),
      'orgao_emissor_rg', public.texto_ou_nulo(dados #>> '{crianca,orgao_emissor_rg}'),
      'cpf', public.cpf_ou_nulo(dados #>> '{crianca,cpf}'),
      'data_nascimento', public.data_ou_nulo(dados #>> '{crianca,data_nascimento}'),
      'data_ingresso', public.data_ou_nulo(dados #>> '{crianca,data_ingresso}'),
      'status', situacao,
      'recebe_beneficio', beneficio_situacao,
      'observacoes', public.texto_ou_nulo(dados #>> '{crianca,observacoes}')
    ),
    'responsavel', jsonb_build_object(
      'nome', public.texto_ou_nulo(dados #>> '{responsavel,nome}'),
      'rg', public.texto_ou_nulo(dados #>> '{responsavel,rg}'),
      'orgao_emissor_rg', public.texto_ou_nulo(dados #>> '{responsavel,orgao_emissor_rg}'),
      'cpf', public.cpf_ou_nulo(dados #>> '{responsavel,cpf}'),
      'email', public.email_ou_nulo(dados #>> '{responsavel,email}'),
      'telefone', public.telefone_ou_nulo(dados #>> '{responsavel,telefone}'),
      'parentesco', parentesco
    ),
    'beneficios', to_jsonb(ids_beneficio)
  );
end;
$$;

create or replace function public.cadastrar_crianca(dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  normalizado jsonb;
  nova_crianca uuid;
  id_responsavel uuid;
  cpf_responsavel text;
  id_beneficio uuid;
begin
  if not public.eh_funcionario_ativo() then
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;

  normalizado := public.normalizar_cadastro(dados);
  cpf_responsavel := normalizado #>> '{responsavel,cpf}';

  insert into public.criancas (
    nome,
    rg,
    orgao_emissor_rg,
    cpf,
    data_nascimento,
    data_ingresso,
    status,
    recebe_beneficio,
    observacoes,
    criado_por
  )
  values (
    normalizado #>> '{crianca,nome}',
    normalizado #>> '{crianca,rg}',
    normalizado #>> '{crianca,orgao_emissor_rg}',
    normalizado #>> '{crianca,cpf}',
    (normalizado #>> '{crianca,data_nascimento}')::date,
    (normalizado #>> '{crianca,data_ingresso}')::date,
    normalizado #>> '{crianca,status}',
    normalizado #>> '{crianca,recebe_beneficio}',
    normalizado #>> '{crianca,observacoes}',
    auth.uid()
  )
  returning id into nova_crianca;

  if cpf_responsavel is not null then
    select responsavel.id
      into id_responsavel
    from public.responsaveis responsavel
    where responsavel.cpf = cpf_responsavel
      and responsavel.excluido_em is null
    limit 1;
  end if;

  if id_responsavel is null then
    insert into public.responsaveis (nome, rg, orgao_emissor_rg, cpf, email, telefone)
    values (
      normalizado #>> '{responsavel,nome}',
      normalizado #>> '{responsavel,rg}',
      normalizado #>> '{responsavel,orgao_emissor_rg}',
      cpf_responsavel,
      normalizado #>> '{responsavel,email}',
      normalizado #>> '{responsavel,telefone}'
    )
    returning id into id_responsavel;
  else
    update public.responsaveis responsavel
      set nome = normalizado #>> '{responsavel,nome}',
          rg = coalesce(normalizado #>> '{responsavel,rg}', responsavel.rg),
          orgao_emissor_rg = coalesce(
            normalizado #>> '{responsavel,orgao_emissor_rg}',
            responsavel.orgao_emissor_rg
          ),
          email = coalesce(normalizado #>> '{responsavel,email}', responsavel.email),
          telefone = coalesce(normalizado #>> '{responsavel,telefone}', responsavel.telefone)
    where responsavel.id = id_responsavel;
  end if;

  insert into public.crianca_responsaveis (crianca_id, responsavel_id, parentesco, principal)
  values (
    nova_crianca,
    id_responsavel,
    normalizado #>> '{responsavel,parentesco}',
    true
  );

  for id_beneficio in
    select valor::uuid
    from jsonb_array_elements_text(normalizado -> 'beneficios') as valor
  loop
    insert into public.crianca_beneficios (crianca_id, beneficio_id)
    values (nova_crianca, id_beneficio);
  end loop;

  return nova_crianca;
exception
  when unique_violation then
    raise exception 'Este CPF já está cadastrado.' using errcode = '23505';
end;
$$;

create or replace function public.atualizar_cadastro(alvo uuid, dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  normalizado jsonb;
  id_responsavel uuid;
  id_beneficio uuid;
begin
  if not public.eh_funcionario_ativo() then
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.criancas crianca
    where crianca.id = alvo
      and crianca.excluido_em is null
  ) then
    raise exception 'Cadastro não encontrado.' using errcode = '22023';
  end if;

  normalizado := public.normalizar_cadastro(dados);

  update public.criancas
    set nome = normalizado #>> '{crianca,nome}',
        rg = normalizado #>> '{crianca,rg}',
        orgao_emissor_rg = normalizado #>> '{crianca,orgao_emissor_rg}',
        cpf = normalizado #>> '{crianca,cpf}',
        data_nascimento = (normalizado #>> '{crianca,data_nascimento}')::date,
        data_ingresso = (normalizado #>> '{crianca,data_ingresso}')::date,
        status = normalizado #>> '{crianca,status}',
        recebe_beneficio = normalizado #>> '{crianca,recebe_beneficio}',
        observacoes = normalizado #>> '{crianca,observacoes}'
  where id = alvo;

  select vinculo.responsavel_id
    into id_responsavel
  from public.crianca_responsaveis vinculo
  where vinculo.crianca_id = alvo
    and vinculo.principal
  limit 1;

  if id_responsavel is null then
    insert into public.responsaveis (nome, rg, orgao_emissor_rg, cpf, email, telefone)
    values (
      normalizado #>> '{responsavel,nome}',
      normalizado #>> '{responsavel,rg}',
      normalizado #>> '{responsavel,orgao_emissor_rg}',
      normalizado #>> '{responsavel,cpf}',
      normalizado #>> '{responsavel,email}',
      normalizado #>> '{responsavel,telefone}'
    )
    returning id into id_responsavel;

    insert into public.crianca_responsaveis (crianca_id, responsavel_id, parentesco, principal)
    values (alvo, id_responsavel, normalizado #>> '{responsavel,parentesco}', true);
  else
    update public.responsaveis
      set nome = normalizado #>> '{responsavel,nome}',
          rg = normalizado #>> '{responsavel,rg}',
          orgao_emissor_rg = normalizado #>> '{responsavel,orgao_emissor_rg}',
          cpf = normalizado #>> '{responsavel,cpf}',
          email = normalizado #>> '{responsavel,email}',
          telefone = normalizado #>> '{responsavel,telefone}'
    where id = id_responsavel;

    update public.crianca_responsaveis
      set parentesco = normalizado #>> '{responsavel,parentesco}'
    where crianca_id = alvo
      and principal;
  end if;

  delete from public.crianca_beneficios
  where crianca_id = alvo;

  for id_beneficio in
    select valor::uuid
    from jsonb_array_elements_text(normalizado -> 'beneficios') as valor
  loop
    insert into public.crianca_beneficios (crianca_id, beneficio_id)
    values (alvo, id_beneficio);
  end loop;

  return alvo;
exception
  when unique_violation then
    raise exception 'Este CPF já está cadastrado.' using errcode = '23505';
end;
$$;

revoke all on function public.telefone_ou_nulo(text) from public, anon, authenticated;
revoke all on function public.email_ou_nulo(text) from public, anon, authenticated;
revoke all on function public.normalizar_cadastro(jsonb) from public, anon, authenticated;

revoke all on function public.cadastrar_crianca(jsonb) from public, anon;
revoke all on function public.atualizar_cadastro(uuid, jsonb) from public, anon;
grant execute on function public.cadastrar_crianca(jsonb) to authenticated;
grant execute on function public.atualizar_cadastro(uuid, jsonb) to authenticated;
