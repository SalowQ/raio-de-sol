-- A família envia o arquivo direto para a quarentena, autorizada pelo token.
-- A função familia não está publicada no projeto hospedado, então o navegador
-- não consegue pedir uma URL assinada. A reserva é o que libera o caminho.

create table if not exists public.reservas_upload (
  caminho text primary key,
  finalidade text not null,
  solicitacao_id uuid not null,
  tipo_id uuid not null,
  mime text not null,
  expira_em timestamptz not null,
  constraint reservas_upload_finalidade check (finalidade in ('cadastro', 'documentos')),
  constraint reservas_upload_mime check (mime in ('application/pdf', 'image/jpeg', 'image/png'))
);

comment on table public.reservas_upload is
  'Caminho reservado para um envio da família. Só esse caminho pode entrar na quarentena.';

alter table public.reservas_upload enable row level security;
alter table public.reservas_upload force row level security;

revoke all on table public.reservas_upload from public, anon, authenticated;

create or replace function public.reserva_de_upload_aceita(p_caminho text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reservas_upload
    where caminho = p_caminho
      and expira_em > now()
  );
$$;

revoke all on function public.reserva_de_upload_aceita(text) from public;
grant execute on function public.reserva_de_upload_aceita(text) to anon, authenticated;

drop policy if exists "familia envia arquivo reservado" on storage.objects;
create policy "familia envia arquivo reservado"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'documentos'
    and name ~ '^quarentena/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$'
    and public.reserva_de_upload_aceita(name)
  );

drop policy if exists "funcionario apaga arquivo em quarentena" on storage.objects;
create policy "funcionario apaga arquivo em quarentena"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'documentos'
    and public.eh_funcionario_ativo()
    and name ~ '^quarentena/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$'
  );

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
  delete from public.reservas_upload where expira_em <= now();

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

  insert into public.reservas_upload (caminho, finalidade, solicitacao_id, tipo_id, mime, expira_em)
  values (v_caminho, p_finalidade, v_id, p_tipo, p_mime, now() + interval '15 minutes');

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
  v_meta jsonb;
  v_tamanho integer;
  v_mime_objeto text;
begin
  if p_finalidade not in ('cadastro', 'documentos')
     or p_token is null
     or p_token !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Este link não está mais válido.' using errcode = '42501';
  end if;

  if p_mime not in ('application/pdf', 'image/jpeg', 'image/png') then
    raise exception 'Envie um PDF, JPEG ou PNG.';
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

  if not exists (
    select 1
    from public.reservas_upload
    where caminho = p_caminho
      and finalidade = p_finalidade
      and solicitacao_id = v_id
      and tipo_id = p_tipo
      and mime = p_mime
      and expira_em > now()
  ) then
    raise exception 'Este link não está mais válido.' using errcode = '42501';
  end if;

  select metadata into v_meta
  from storage.objects
  where bucket_id = 'documentos'
    and name = p_caminho;

  if not found then
    raise exception 'Não foi possível concluir a operação. Tente novamente.';
  end if;

  v_tamanho := p_tamanho;
  if coalesce(v_meta->>'size', v_meta->>'contentLength', '') ~ '^[0-9]+$' then
    v_tamanho := coalesce(v_meta->>'size', v_meta->>'contentLength')::integer;
  end if;

  if v_tamanho is null or v_tamanho <= 0 or v_tamanho > 10485760 then
    raise exception 'O arquivo deve ter até 10 MB.';
  end if;

  v_mime_objeto := nullif(v_meta->>'mimetype', '');
  if v_mime_objeto is not null and v_mime_objeto <> p_mime then
    raise exception 'Envie um PDF, JPEG ou PNG.';
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
      v_crianca, p_tipo, p_caminho, p_nome, p_mime, v_tamanho
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
      v_tamanho
    );
  end if;

  delete from public.reservas_upload where caminho = p_caminho;

  return jsonb_build_object('recebido', true);
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
  if not public.eh_funcionario_ativo() then
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

  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'documentos'
      and name = v_esperado
  ) then
    raise exception 'Não foi possível concluir a operação. Tente novamente.';
  end if;

  update public.versoes_documento
    set caminho = v_esperado,
        status = 'aprovado'
  where id = p_versao;

  return v_caminho;
end;
$$;

revoke all on function public.reservar_arquivo_familia(text, text, uuid, text) from public;
revoke all on function public.confirmar_arquivo_familia(text, text, uuid, text, text, text, integer) from public;
revoke all on function public.concluir_promocao_quarentena(uuid, text) from public, anon;

grant execute on function public.reservar_arquivo_familia(text, text, uuid, text) to anon, authenticated, service_role;
grant execute on function public.confirmar_arquivo_familia(text, text, uuid, text, text, text, integer) to anon, authenticated, service_role;
grant execute on function public.concluir_promocao_quarentena(uuid, text) to authenticated, service_role;
