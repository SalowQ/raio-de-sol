# Configuração local

## Variáveis

O frontend só conhece duas variáveis:

- `SUPABASE_URL`: URL do projeto, no formato `https://seu-projeto.supabase.co`. Use a raiz do projeto. O endereço que termina em `/rest/v1/` é só da API de dados; o login precisa da raiz.
- `SUPABASE_ANON_KEY`: chave anon, ou a chave publishable (`sb_publishable_...`).

A chave anon é pública por desenho do Supabase. Quem protege os dados é o Row Level Security, não o sigilo dessa chave. A chave `service_role` e a chave `sb_secret` ficam fora do frontend, do repositório e dos exemplos.

Copie `.env.example` para `.env`. O comando `npm start` lê esse arquivo e gera `src/environments/environment.ts`. O build de produção gera `src/environments/environment.production.ts` quando as variáveis existem no ambiente, como na Cloudflare Pages.

Se o Git mostrar uma chave dentro de `src/environments`, não faça commit dessa alteração. Os arquivos versionados devem permanecer com texto vazio.

O script recusa chave de serviço e não grava o arquivo nesse caso.

## Projeto Supabase hospedado

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. Em Authentication, desligue o cadastro de novos usuários. A família não terá conta, e funcionário não se cadastra sozinho.
3. Em Authentication, confirme que o provedor de e-mail está ligado.
4. Em URL Configuration, coloque a URL do site. Em desenvolvimento, `http://localhost:4200`. Inclua `http://localhost:4200/entrar` nas URLs de redirecionamento, para a recuperação de senha.
5. No SQL Editor, execute o arquivo [supabase/migrations/20261107170000_perfis_usuarios.sql](../supabase/migrations/20261107170000_perfis_usuarios.sql).
6. Em Authentication, crie o usuário do funcionário e confirme o e-mail por lá.
7. No SQL Editor, vincule o perfil. Troque o identificador e o nome pelos da conta criada:

```sql
insert into public.perfis_usuarios (id, nome)
values ('uuid-do-usuario-em-auth-users', 'Nome do funcionário');
```

Uma conta autenticada sem essa linha vê a tela de acesso negado. O aplicativo não oferece auto-cadastro.

## Supabase local

O arquivo [supabase/config.toml](../supabase/config.toml) já desliga o cadastro público, exige senha de 8 caracteres e aponta o site local para `http://localhost:4200`.

Com Docker em execução:

```bash
npx supabase start
npx supabase db reset
```

`db reset` aplica as migrations. Use a URL e a chave anon impressas pelo CLI no `.env`. Não copie a `service_role` para o frontend.

## O que esta etapa já protege

- Visitante sem sessão é enviado para a entrada.
- Usuário sem perfil de funcionário ativo recebe acesso negado.
- O perfil só pode ser lido pelo próprio usuário autenticado.
- O navegador não insere, altera nem apaga perfis.
- A página pública `/familia` não mostra o menu administrativo.

## Plano gratuito

O projeto gratuito do Supabase pode ser pausado depois de cerca de uma semana com pouca atividade e não inclui backup automático. O banco fica em 500 MB e os arquivos em 1 GB. A exportação e o roteiro de restauração ficam para a Etapa 6. Retomar um projeto pausado é feito no painel do Supabase, em Resume project, dentro de um ano.

## Publicação

A publicação na Cloudflare Pages fica para a etapa de implantação. O build gera `dist/raio-de-sol/browser`. As variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY` entram no ambiente de build. Os arquivos `public/_headers` e `public/_redirects` acompanham o site estático.
