-- Acrescenta o tipo opcional Receita de medicações ao catálogo já aplicado.

insert into public.tipos_documento (codigo, nome, ordem)
values ('receita_medicacoes', 'Receita de medicações', 15)
on conflict (codigo) do update
set nome = excluded.nome,
    ordem = excluded.ordem,
    ativo = true;
