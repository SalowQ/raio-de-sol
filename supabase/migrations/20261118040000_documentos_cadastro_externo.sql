-- O cadastro externo volta a aceitar PDF, JPEG e PNG.
-- O arquivo entra na quarentena do envio que acabou de ser criado, não de outra família.
-- Pedir correção e pedir documentos continuam desligados na tela da equipe.

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

drop function if exists public.reservar_arquivo_familia(text, text, uuid, text);
drop function if exists public.confirmar_arquivo_familia(text, text, uuid, text, text, text, integer);

create function public.reservar_arquivo_familia(
  p_token text,
  p_finalidade text,
  p_tipo uuid,
  p_mime text,
  p_solicitacao uuid
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
    if p_solicitacao is null then
      raise exception 'Este link não está mais válido.' using errcode = '42501';
    end if;

    select solicitacao.id, solicitacao.crianca_id
      into v_id, v_crianca
    from public.solicitacoes_cadastro solicitacao
    join public.links_cadastro link on link.id = solicitacao.link_id
    where link.token_hash = v_hash
      and solicitacao.id = p_solicitacao
      and link.revogado_em is null
      and link.expira_em > now()
      and solicitacao.status <> 'aprovado'
      and solicitacao.criado_em > now() - interval '2 hours'
    for update of solicitacao;

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

create function public.confirmar_arquivo_familia(
  p_token text,
  p_finalidade text,
  p_tipo uuid,
  p_caminho text,
  p_nome text,
  p_mime text,
  p_tamanho integer,
  p_solicitacao uuid
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
    if p_solicitacao is null then
      raise exception 'Este link não está mais válido.' using errcode = '42501';
    end if;

    select solicitacao.id, solicitacao.crianca_id
      into v_id, v_crianca
    from public.solicitacoes_cadastro solicitacao
    join public.links_cadastro link on link.id = solicitacao.link_id
    where link.token_hash = v_hash
      and solicitacao.id = p_solicitacao
      and link.revogado_em is null
      and link.expira_em > now()
      and solicitacao.status <> 'aprovado'
      and solicitacao.criado_em > now() - interval '2 hours'
    for update of solicitacao;
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

revoke all on function public.reservar_arquivo_familia(text, text, uuid, text, uuid) from public;
revoke all on function public.confirmar_arquivo_familia(text, text, uuid, text, text, text, integer, uuid) from public;

grant execute on function public.reservar_arquivo_familia(text, text, uuid, text, uuid) to anon, authenticated, service_role;
grant execute on function public.confirmar_arquivo_familia(text, text, uuid, text, text, text, integer, uuid) to anon, authenticated, service_role;
