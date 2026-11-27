-- A criação não substitui um dia que já tem registro.
-- A alteração e a exclusão são operações separadas.

create or replace function public.registrar_atendimento(
  p_crianca uuid,
  p_dia date,
  p_situacao text,
  p_anotacao text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_anotacao text;
begin
  if not public.eh_funcionario_ativo() then
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;

  if p_dia is null then
    raise exception 'Informe o dia do atendimento.';
  end if;

  if p_situacao not in ('presente', 'falta') then
    raise exception 'Marque presença ou falta.';
  end if;

  v_anotacao := public.texto_ou_nulo(p_anotacao);
  if v_anotacao is not null and char_length(v_anotacao) > 1000 then
    raise exception 'A anotação pode ter até 1000 caracteres.';
  end if;

  if not exists (
    select 1
    from public.criancas
    where id = p_crianca
      and excluido_em is null
      and status = 'ativo'
  ) then
    raise exception 'Cadastro não encontrado.';
  end if;

  if exists (
    select 1
    from public.atendimentos
    where crianca_id = p_crianca
      and dia = p_dia
      and sessao = 'dia'
  ) then
    raise exception 'Este dia já tem registro.';
  end if;

  begin
    insert into public.atendimentos (crianca_id, dia, sessao, situacao, anotacao, registrado_por)
    values (p_crianca, p_dia, 'dia', p_situacao, v_anotacao, auth.uid())
    returning id into v_id;
  exception
    when unique_violation then
      raise exception 'Este dia já tem registro.';
  end;

  return v_id;
end;
$$;

create or replace function public.atualizar_atendimento(
  p_id uuid,
  p_dia date,
  p_situacao text,
  p_anotacao text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crianca uuid;
  v_anotacao text;
begin
  if not public.eh_funcionario_ativo() then
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;

  if p_dia is null then
    raise exception 'Informe o dia do atendimento.';
  end if;

  if p_situacao not in ('presente', 'falta') then
    raise exception 'Marque presença ou falta.';
  end if;

  v_anotacao := public.texto_ou_nulo(p_anotacao);
  if v_anotacao is not null and char_length(v_anotacao) > 1000 then
    raise exception 'A anotação pode ter até 1000 caracteres.';
  end if;

  select atendimento.crianca_id
    into v_crianca
  from public.atendimentos atendimento
  join public.criancas crianca on crianca.id = atendimento.crianca_id
  where atendimento.id = p_id
    and crianca.excluido_em is null
  for update of atendimento;

  if v_crianca is null then
    raise exception 'Cadastro não encontrado.';
  end if;

  if exists (
    select 1
    from public.atendimentos
    where crianca_id = v_crianca
      and dia = p_dia
      and sessao = 'dia'
      and id <> p_id
  ) then
    raise exception 'Este dia já tem registro.';
  end if;

  begin
    update public.atendimentos
      set dia = p_dia,
          situacao = p_situacao,
          anotacao = v_anotacao,
          registrado_por = auth.uid()
    where id = p_id;
  exception
    when unique_violation then
      raise exception 'Este dia já tem registro.';
  end;
end;
$$;

create or replace function public.excluir_atendimento(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.eh_funcionario_ativo() then
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;

  delete from public.atendimentos atendimento
  using public.criancas crianca
  where atendimento.id = p_id
    and crianca.id = atendimento.crianca_id
    and crianca.excluido_em is null;

  if not found then
    raise exception 'Cadastro não encontrado.';
  end if;
end;
$$;

revoke all on function public.registrar_atendimento(uuid, date, text, text) from public, anon;
revoke all on function public.atualizar_atendimento(uuid, date, text, text) from public, anon;
revoke all on function public.excluir_atendimento(uuid) from public, anon;

grant execute on function public.registrar_atendimento(uuid, date, text, text) to authenticated;
grant execute on function public.atualizar_atendimento(uuid, date, text, text) to authenticated;
grant execute on function public.excluir_atendimento(uuid) to authenticated;
