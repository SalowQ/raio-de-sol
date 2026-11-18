-- Guarda o token para a equipe reexibir o link.
-- Abrir e enviar o cadastro passam a usar estas funções com a chave pública.
-- Quem autoriza é o token do link, não um usuário da família.
-- Links já gerados não têm o token salvo; é preciso gerar outro.

alter table public.solicitacoes_cadastro add column if not exists token text;
alter table public.solicitacoes_documentos add column if not exists token text;

comment on column public.solicitacoes_cadastro.token is
  'Token do link, visível só para funcionário ativo, para reexibir o endereço. A validação continua pelo hash.';

comment on column public.solicitacoes_documentos.token is
  'Token do link, visível só para funcionário ativo, para reexibir o endereço. A validação continua pelo hash.';

grant select (token) on public.solicitacoes_cadastro to authenticated;
grant select (token) on public.solicitacoes_documentos to authenticated;

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

  insert into public.solicitacoes_cadastro (token_hash, token, expira_em, criado_por)
  values (encode(digest(v_token, 'sha256'), 'hex'), v_token, v_expira, auth.uid())
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

  insert into public.solicitacoes_documentos (token_hash, token, crianca_id, expira_em, criado_por)
  values (encode(digest(v_token, 'sha256'), 'hex'), v_token, p_crianca, v_expira, auth.uid())
  returning id into v_id;

  foreach v_tipo in array p_tipos loop
    insert into public.solicitacoes_documentos_tipos (solicitacao_id, tipo_id)
    values (v_id, v_tipo)
    on conflict do nothing;
  end loop;

  return jsonb_build_object('id', v_id, 'token', v_token, 'expira_em', v_expira);
end;
$$;

-- A checagem de service_role impedia a família de abrir o link com a chave pública.
do $mig$
declare
  rec record;
  def text;
  limpo text;
begin
  for rec in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'descrever_link_familia',
        'receber_cadastro_familia',
        'reservar_arquivo_familia',
        'confirmar_arquivo_familia',
        'concluir_promocao_quarentena'
      )
  loop
    def := pg_get_functiondef(rec.oid);
    limpo := regexp_replace(
      def,
      $re$if coalesce\(auth\.role\(\), ''\) <> 'service_role' then\s+raise exception 'Operação não autorizada\.' using errcode = '42501';\s+end if;\s*$re$,
      '',
      'n'
    );

    if limpo = def then
      continue;
    end if;

    if position('auth.role()' in limpo) > 0 then
      raise exception 'Não foi possível liberar o acesso da família.';
    end if;

    execute limpo;
  end loop;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'descrever_link_familia'
  ) then
    raise exception 'Aplique antes o SQL 20261117120000_links_familia.sql.';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'descrever_link_familia'
      and pg_get_functiondef(p.oid) like '%auth.role()%'
  ) then
    raise exception 'Não foi possível liberar o acesso da família.';
  end if;
end
$mig$;

grant execute on function public.descrever_link_familia(text) to anon, authenticated;
grant execute on function public.receber_cadastro_familia(text, jsonb) to anon, authenticated;
