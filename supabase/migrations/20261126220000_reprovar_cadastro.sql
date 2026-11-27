alter table public.solicitacoes_cadastro
  drop constraint solicitacoes_cadastro_status;

alter table public.solicitacoes_cadastro
  add constraint solicitacoes_cadastro_status check (
    status in ('aberto', 'enviado', 'correcao', 'aprovado', 'reprovado')
  );

create or replace function public.reprovar_solicitacao_cadastro(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sol public.solicitacoes_cadastro;
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

  if v_sol.status in ('aprovado', 'reprovado') then
    raise exception 'Este envio já foi decidido.';
  end if;

  if v_sol.conferir_manualmente or v_sol.crianca_id is null then
    raise exception 'Este envio precisa de conferência manual e não será ligado a outro cadastro.';
  end if;

  update public.criancas
    set status = 'inativo'
  where id = v_sol.crianca_id
    and status = 'pendente_validacao'
    and excluido_em is null;

  if not found then
    raise exception 'Cadastro não encontrado.';
  end if;

  update public.solicitacoes_cadastro
    set status = 'reprovado'
  where id = p_id;
end;
$$;

revoke all on function public.reprovar_solicitacao_cadastro(uuid) from public, anon;
grant execute on function public.reprovar_solicitacao_cadastro(uuid) to authenticated;
