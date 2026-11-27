-- Registro diário de atendimento.
-- A sessão fica fixa em "dia" até o Instituto confirmar turnos.
-- A anotação é opcional. A tela não calcula percentual de frequência.

create table public.atendimentos (
  id uuid primary key default gen_random_uuid(),
  crianca_id uuid not null references public.criancas (id),
  dia date not null,
  sessao text not null default 'dia',
  situacao text not null,
  anotacao text,
  registrado_por uuid not null references public.perfis_usuarios (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint atendimentos_sessao_dia check (sessao = 'dia'),
  constraint atendimentos_situacao check (situacao in ('presente', 'falta')),
  constraint atendimentos_anotacao check (
    anotacao is null or char_length(anotacao) <= 1000
  ),
  constraint atendimentos_unico unique (crianca_id, dia, sessao)
);

comment on table public.atendimentos is
  'Presença ou falta de uma criança em um dia. A sessão dia aguarda o calendário do Instituto.';

comment on column public.atendimentos.anotacao is
  'Anotação opcional da sessão. O Instituto ainda não definiu um modelo de texto.';

create index atendimentos_crianca_dia_idx
  on public.atendimentos (crianca_id, dia desc);

create trigger atendimentos_atualizado_em
  before update on public.atendimentos
  for each row
  execute function public.definir_atualizado_em();

alter table public.atendimentos enable row level security;
alter table public.atendimentos force row level security;

revoke all on table public.atendimentos from anon, authenticated;
grant select on table public.atendimentos to authenticated;

create policy "funcionario le atendimentos"
  on public.atendimentos
  for select
  to authenticated
  using (
    public.eh_funcionario_ativo()
    and exists (
      select 1
      from public.criancas crianca
      where crianca.id = atendimentos.crianca_id
        and crianca.excluido_em is null
    )
  );

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

  insert into public.atendimentos (crianca_id, dia, sessao, situacao, anotacao, registrado_por)
  values (p_crianca, p_dia, 'dia', p_situacao, v_anotacao, auth.uid())
  on conflict (crianca_id, dia, sessao) do update
    set situacao = excluded.situacao,
        anotacao = excluded.anotacao,
        registrado_por = excluded.registrado_por
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.registrar_atendimento(uuid, date, text, text) from public, anon;
grant execute on function public.registrar_atendimento(uuid, date, text, text) to authenticated;
