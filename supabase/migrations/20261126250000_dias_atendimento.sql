-- Dias que já têm registro, para a lista paginada.
-- security_invoker faz a consulta respeitar a permissão de quem está lendo.

create view public.dias_atendimento
with (security_invoker = true) as
select
  atendimento.dia,
  count(*)::integer as quantidade
from public.atendimentos atendimento
join public.criancas crianca on crianca.id = atendimento.crianca_id
where atendimento.sessao = 'dia'
  and crianca.excluido_em is null
group by atendimento.dia;

comment on view public.dias_atendimento is
  'Um dia e a quantidade de registros. A tela pagina esta lista e só busca os registros ao abrir o dia.';

revoke all on public.dias_atendimento from public, anon;
grant select on public.dias_atendimento to authenticated;
