-- Crianças, responsáveis e benefícios.
-- A família ainda não grava por estas funções. O envio externo entra na Etapa 4.

create table public.criancas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  rg text,
  cpf text,
  data_nascimento date,
  data_ingresso date,
  status text not null default 'ativo',
  recebe_beneficio text not null default 'nao_informado',
  observacoes text,
  criado_por uuid references public.perfis_usuarios (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  constraint criancas_nome_preenchido check (char_length(btrim(nome)) > 0),
  constraint criancas_cpf_digitos check (cpf is null or cpf ~ '^[0-9]{11}$'),
  constraint criancas_status_conhecido check (
    status in ('pendente_validacao', 'ativo', 'inativo')
  ),
  constraint criancas_beneficio_conhecido check (
    recebe_beneficio in ('nao_recebe', 'recebe', 'nao_informado')
  )
);

comment on column public.criancas.data_nascimento is
  'Campo proposto. A ONG ainda não confirmou se a data de nascimento entra na ficha.';
comment on column public.criancas.data_ingresso is
  'Campo proposto. A ONG ainda não confirmou se a data de ingresso entra na ficha.';
comment on column public.criancas.observacoes is
  'Anotação administrativa opcional. A ONG ainda não confirmou o uso.';

create unique index criancas_cpf_ativo_idx
  on public.criancas (cpf)
  where cpf is not null and excluido_em is null;

create index criancas_nome_idx
  on public.criancas (nome)
  where excluido_em is null;

create table public.responsaveis (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  rg text,
  cpf text,
  contato text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  constraint responsaveis_nome_preenchido check (char_length(btrim(nome)) > 0),
  constraint responsaveis_cpf_digitos check (cpf is null or cpf ~ '^[0-9]{11}$')
);

create unique index responsaveis_cpf_ativo_idx
  on public.responsaveis (cpf)
  where cpf is not null and excluido_em is null;

create table public.crianca_responsaveis (
  id uuid primary key default gen_random_uuid(),
  crianca_id uuid not null references public.criancas (id),
  responsavel_id uuid not null references public.responsaveis (id),
  parentesco text,
  principal boolean not null default false,
  constraint crianca_responsaveis_unica unique (crianca_id, responsavel_id),
  constraint crianca_responsaveis_parentesco_tamanho check (
    parentesco is null or char_length(parentesco) <= 80
  )
);

comment on column public.crianca_responsaveis.parentesco is
  'Parentesco desta ligação. Opcional. A mesma pessoa pode ter parentesco diferente em outra criança.';

create unique index crianca_responsaveis_principal_idx
  on public.crianca_responsaveis (crianca_id)
  where principal;

create table public.beneficios (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  ativo boolean not null default true,
  ordem integer not null
);

insert into public.beneficios (codigo, nome, ordem)
values
  ('bpc', 'BPC', 1),
  ('loas', 'LOAS', 2),
  ('bolsa_familia', 'Bolsa Família', 3);

create table public.crianca_beneficios (
  crianca_id uuid not null references public.criancas (id),
  beneficio_id uuid not null references public.beneficios (id),
  primary key (crianca_id, beneficio_id)
);

create trigger criancas_atualizado_em
  before update on public.criancas
  for each row
  execute function public.definir_atualizado_em();

create trigger responsaveis_atualizado_em
  before update on public.responsaveis
  for each row
  execute function public.definir_atualizado_em();

alter table public.criancas enable row level security;
alter table public.criancas force row level security;
alter table public.responsaveis enable row level security;
alter table public.responsaveis force row level security;
alter table public.crianca_responsaveis enable row level security;
alter table public.crianca_responsaveis force row level security;
alter table public.beneficios enable row level security;
alter table public.beneficios force row level security;
alter table public.crianca_beneficios enable row level security;
alter table public.crianca_beneficios force row level security;

revoke all on table public.criancas from anon, authenticated;
revoke all on table public.responsaveis from anon, authenticated;
revoke all on table public.crianca_responsaveis from anon, authenticated;
revoke all on table public.beneficios from anon, authenticated;
revoke all on table public.crianca_beneficios from anon, authenticated;

grant select on table public.criancas to authenticated;
grant select on table public.responsaveis to authenticated;
grant select on table public.crianca_responsaveis to authenticated;
grant select on table public.beneficios to authenticated;
grant select on table public.crianca_beneficios to authenticated;

create policy "funcionario le criancas"
  on public.criancas
  for select
  to authenticated
  using (public.eh_funcionario_ativo() and excluido_em is null);

create policy "funcionario le responsaveis"
  on public.responsaveis
  for select
  to authenticated
  using (public.eh_funcionario_ativo() and excluido_em is null);

create policy "funcionario le vinculos"
  on public.crianca_responsaveis
  for select
  to authenticated
  using (public.eh_funcionario_ativo());

create policy "funcionario le beneficios"
  on public.beneficios
  for select
  to authenticated
  using (public.eh_funcionario_ativo());

create policy "funcionario le beneficios da crianca"
  on public.crianca_beneficios
  for select
  to authenticated
  using (public.eh_funcionario_ativo());

create or replace function public.texto_ou_nulo(valor text)
returns text
language sql
immutable
as $$
  select nullif(btrim(coalesce(valor, '')), '');
$$;

create or replace function public.cpf_ou_nulo(valor text)
returns text
language plpgsql
as $$
declare
  digitos text := nullif(regexp_replace(coalesce(valor, ''), '\D', '', 'g'), '');
begin
  if digitos is null then
    return null;
  end if;

  if digitos !~ '^[0-9]{11}$' then
    raise exception 'O CPF deve ter 11 dígitos.' using errcode = '22023';
  end if;

  return digitos;
end;
$$;

create or replace function public.data_ou_nulo(valor text)
returns date
language plpgsql
as $$
begin
  if public.texto_ou_nulo(valor) is null then
    return null;
  end if;

  return btrim(valor)::date;
exception
  when others then
    raise exception 'Informe uma data válida.' using errcode = '22023';
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
      'cpf', public.cpf_ou_nulo(dados #>> '{responsavel,cpf}'),
      'contato', public.texto_ou_nulo(dados #>> '{responsavel,contato}'),
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
    insert into public.responsaveis (nome, rg, cpf, contato)
    values (
      normalizado #>> '{responsavel,nome}',
      normalizado #>> '{responsavel,rg}',
      cpf_responsavel,
      normalizado #>> '{responsavel,contato}'
    )
    returning id into id_responsavel;
  else
    update public.responsaveis responsavel
      set nome = normalizado #>> '{responsavel,nome}',
          rg = coalesce(normalizado #>> '{responsavel,rg}', responsavel.rg),
          contato = coalesce(normalizado #>> '{responsavel,contato}', responsavel.contato)
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
    insert into public.responsaveis (nome, rg, cpf, contato)
    values (
      normalizado #>> '{responsavel,nome}',
      normalizado #>> '{responsavel,rg}',
      normalizado #>> '{responsavel,cpf}',
      normalizado #>> '{responsavel,contato}'
    )
    returning id into id_responsavel;

    insert into public.crianca_responsaveis (crianca_id, responsavel_id, parentesco, principal)
    values (alvo, id_responsavel, normalizado #>> '{responsavel,parentesco}', true);
  else
    update public.responsaveis
      set nome = normalizado #>> '{responsavel,nome}',
          rg = normalizado #>> '{responsavel,rg}',
          cpf = normalizado #>> '{responsavel,cpf}',
          contato = normalizado #>> '{responsavel,contato}'
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

revoke all on function public.texto_ou_nulo(text) from public, anon, authenticated;
revoke all on function public.cpf_ou_nulo(text) from public, anon, authenticated;
revoke all on function public.data_ou_nulo(text) from public, anon, authenticated;
revoke all on function public.normalizar_cadastro(jsonb) from public, anon, authenticated;

revoke all on function public.cadastrar_crianca(jsonb) from public, anon;
revoke all on function public.atualizar_cadastro(uuid, jsonb) from public, anon;
grant execute on function public.cadastrar_crianca(jsonb) to authenticated;
grant execute on function public.atualizar_cadastro(uuid, jsonb) to authenticated;
