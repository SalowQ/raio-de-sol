-- Perfis dos funcionários do painel. Famílias não possuem conta.

create table public.perfis_usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) > 0),
  papel text not null default 'funcionario' check (papel = 'funcionario'),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.perfis_usuarios is
  'Funcionários autorizados no painel. Visitantes e famílias não possuem perfil.';

create index perfis_usuarios_papel_ativo_idx
  on public.perfis_usuarios (papel, ativo);

alter table public.perfis_usuarios enable row level security;
alter table public.perfis_usuarios force row level security;

create or replace function public.definir_atualizado_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger perfis_usuarios_atualizado_em
  before update on public.perfis_usuarios
  for each row
  execute function public.definir_atualizado_em();

create or replace function public.eh_funcionario_ativo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.perfis_usuarios
    where id = auth.uid()
      and papel = 'funcionario'
      and ativo = true
  );
$$;

revoke all on function public.definir_atualizado_em() from public;
grant execute on function public.definir_atualizado_em() to authenticated, service_role;

revoke all on function public.eh_funcionario_ativo() from public;
grant execute on function public.eh_funcionario_ativo() to authenticated;

revoke all on table public.perfis_usuarios from anon, authenticated;
grant select on table public.perfis_usuarios to authenticated;

create policy "funcionario le o proprio perfil"
  on public.perfis_usuarios
  for select
  to authenticated
  using (id = auth.uid());

-- Não há política de insert, update ou delete para o cliente.
-- O perfil é criado no SQL Editor, que usa um papel administrativo:
-- insert into public.perfis_usuarios (id, nome)
-- values ('uuid-do-usuario-em-auth-users', 'Nome do funcionário');
