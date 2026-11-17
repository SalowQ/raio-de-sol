-- Catálogo, checklist e versões dos documentos.
-- O arquivo fica no bucket privado documentos. A ficha da criança não guarda URL.
-- A conferência do conteúdo do arquivo entra na Etapa 4. Aqui o limite de 10 MB
-- e os tipos PDF, JPEG e PNG são a sugestão já registrada, não uma regra da ONG.

create table public.tipos_documento (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  obrigatorio boolean not null default false,
  ordem integer not null,
  ativo boolean not null default true
);

comment on column public.tipos_documento.obrigatorio is
  'Proposta. A ONG ainda não confirmou quais documentos são obrigatórios. O catálogo nasce com false.';

insert into public.tipos_documento (codigo, nome, ordem)
values
  ('rg_crianca', 'RG da criança', 1),
  ('cpf_crianca', 'CPF da criança', 2),
  ('laudo', 'Laudo', 3),
  ('parecer_pedagogico', 'Parecer pedagógico', 4),
  ('anamnese', 'Anamnese', 5),
  ('relatorio_pedagogico', 'Relatório pedagógico', 6),
  ('devolutiva', 'Devolutiva do Instituto', 7),
  ('rg_responsavel', 'RG do responsável', 8),
  ('cpf_responsavel', 'CPF do responsável', 9),
  ('comprovante_residencia', 'Comprovante de residência', 10),
  ('declaracao_beneficio', 'Declaração de benefício', 11),
  ('termo_imagem', 'Termo de direito de imagem', 12),
  ('outros', 'Outros', 13),
  ('ficha_contribuicao', 'Ficha de contribuição', 14);

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  crianca_id uuid not null references public.criancas (id),
  tipo_id uuid not null references public.tipos_documento (id),
  criado_em timestamptz not null default now(),
  constraint documentos_crianca_tipo_unico unique (crianca_id, tipo_id)
);

create index documentos_crianca_idx on public.documentos (crianca_id);

create table public.versoes_documento (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos (id),
  numero integer not null,
  status text not null default 'pendente',
  caminho text not null,
  nome_arquivo text not null,
  tipo_mime text not null,
  tamanho_bytes integer not null,
  observacao text,
  enviado_por uuid references public.perfis_usuarios (id),
  criado_em timestamptz not null default now(),
  atual boolean not null default true,
  constraint versoes_documento_numero_unico unique (documento_id, numero),
  constraint versoes_documento_status_conhecido check (
    status in ('pendente', 'em_analise', 'aprovado', 'rejeitado')
  ),
  constraint versoes_documento_mime_conhecido check (
    tipo_mime in ('application/pdf', 'image/jpeg', 'image/png')
  ),
  constraint versoes_documento_tamanho check (
    tamanho_bytes > 0 and tamanho_bytes <= 10485760
  ),
  constraint versoes_documento_observacao_tamanho check (
    observacao is null or char_length(observacao) <= 500
  )
);

comment on column public.versoes_documento.caminho is
  'Caminho interno no bucket privado. Não é uma URL pública.';

create unique index versoes_documento_atual_idx
  on public.versoes_documento (documento_id)
  where atual;

create index versoes_documento_documento_idx
  on public.versoes_documento (documento_id, numero desc);

alter table public.tipos_documento enable row level security;
alter table public.tipos_documento force row level security;
alter table public.documentos enable row level security;
alter table public.documentos force row level security;
alter table public.versoes_documento enable row level security;
alter table public.versoes_documento force row level security;

revoke all on table public.tipos_documento from anon, authenticated;
revoke all on table public.documentos from anon, authenticated;
revoke all on table public.versoes_documento from anon, authenticated;
grant select on table public.tipos_documento to authenticated;
grant select on table public.documentos to authenticated;
grant select on table public.versoes_documento to authenticated;

create policy "funcionario le tipos de documento"
  on public.tipos_documento
  for select
  to authenticated
  using (public.eh_funcionario_ativo());

create policy "funcionario le documentos"
  on public.documentos
  for select
  to authenticated
  using (public.eh_funcionario_ativo());

create policy "funcionario le versoes de documento"
  on public.versoes_documento
  for select
  to authenticated
  using (public.eh_funcionario_ativo());

create or replace function public.registrar_versao_documento(
  p_crianca uuid,
  p_tipo uuid,
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
  v_documento uuid;
  v_versao uuid;
  v_numero integer;
  v_extensao text;
  v_caminho text;
  v_nome text;
begin
  if not public.eh_funcionario_ativo() then
    raise exception 'Sem permissão para enviar documentos.';
  end if;

  if not exists (
    select 1 from public.criancas
    where id = p_crianca and excluido_em is null
  ) then
    raise exception 'Cadastro não encontrado.';
  end if;

  if not exists (
    select 1 from public.tipos_documento
    where id = p_tipo and ativo
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

  v_extensao := case p_mime
    when 'application/pdf' then 'pdf'
    when 'image/jpeg' then 'jpg'
    else 'png'
  end;

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
  v_caminho := p_crianca::text || '/' || v_documento::text || '/' || v_versao::text || '.' || v_extensao;

  update public.versoes_documento
  set atual = false
  where documento_id = v_documento
    and atual;

  insert into public.versoes_documento (
    id, documento_id, numero, status, caminho, nome_arquivo, tipo_mime, tamanho_bytes, enviado_por, atual
  )
  values (
    v_versao, v_documento, v_numero, 'pendente', v_caminho, v_nome, p_mime, p_tamanho, auth.uid(), true
  );

  return jsonb_build_object(
    'versao_id', v_versao,
    'documento_id', v_documento,
    'caminho', v_caminho
  );
end;
$$;

create or replace function public.desfazer_envio_documento(p_versao uuid)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_documento uuid;
  v_caminho text;
begin
  if not public.eh_funcionario_ativo() then
    raise exception 'Sem permissão para enviar documentos.';
  end if;

  select documento_id, caminho
    into v_documento, v_caminho
  from public.versoes_documento
  where id = p_versao
    and atual
    and status = 'pendente';

  if v_documento is null then
    raise exception 'Cadastro não encontrado.';
  end if;

  if exists (
    select 1 from storage.objects
    where bucket_id = 'documentos'
      and name = v_caminho
  ) then
    raise exception 'O arquivo já foi guardado.';
  end if;

  delete from public.versoes_documento where id = p_versao;

  update public.versoes_documento
  set atual = true
  where id = (
    select id
    from public.versoes_documento
    where documento_id = v_documento
    order by numero desc
    limit 1
  );
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

revoke all on function public.registrar_versao_documento(uuid, uuid, text, text, integer) from public;
revoke all on function public.desfazer_envio_documento(uuid) from public;
revoke all on function public.definir_status_documento(uuid, text, text) from public;
grant execute on function public.registrar_versao_documento(uuid, uuid, text, text, integer) to authenticated;
grant execute on function public.desfazer_envio_documento(uuid) to authenticated;
grant execute on function public.definir_status_documento(uuid, text, text) to authenticated;

create view public.resumo_documentos
with (security_invoker = true) as
select
  crianca.id as crianca_id,
  crianca.nome,
  (
    select count(*)::integer
    from public.documentos as documento
    where documento.crianca_id = crianca.id
      and exists (
        select 1
        from public.versoes_documento as versao
        where versao.documento_id = documento.id
      )
  ) as enviados,
  (
    select count(*)::integer
    from public.tipos_documento as tipo
    where tipo.ativo
      and tipo.obrigatorio
      and not exists (
        select 1
        from public.documentos as documento
        join public.versoes_documento as versao on versao.documento_id = documento.id
        where documento.crianca_id = crianca.id
          and documento.tipo_id = tipo.id
          and versao.status = 'aprovado'
      )
  ) as pendencias
from public.criancas as crianca
where crianca.excluido_em is null;

revoke all on table public.resumo_documentos from anon, authenticated;
grant select on table public.resumo_documentos to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos',
  'documentos',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "funcionario le arquivo de documento"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'documentos'
    and public.eh_funcionario_ativo()
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$'
  );

create policy "funcionario envia arquivo de documento"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'documentos'
    and public.eh_funcionario_ativo()
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$'
  );
