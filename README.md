# Instituto Raio de Sol

Painel web para a equipe do Instituto cadastrar crianças, organizar documentos e receber envios da família. Esta versão entrega as Etapas 1 a 4: aplicação Angular, autenticação, cadastro, documentos com versões e links temporários.

A presença e a exportação entram nas etapas seguintes.

## Requisitos

- Node.js 20.19 ou superior, 22.12 ou superior, ou 24
- npm
- Projeto no Supabase, ou Docker se for usar o Supabase local

## Começar

1. Copie `.env.example` para `.env`.
2. Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` com a chave anon ou publishable do projeto. Não use a chave `service_role` nem `sb_secret`.
3. Rode `npm start` e abra `http://localhost:4200`.

Sem essas variáveis, a tela de entrada explica que o servidor ainda não está conectado. Os testes e o build funcionam mesmo assim.

A configuração detalhada, o primeiro funcionário e os limites do plano gratuito estão em [docs/configuracao.md](docs/configuracao.md). As decisões que ainda dependem do Instituto estão em [docs/decisoes-pendentes.md](docs/decisoes-pendentes.md).

## Verificação

```bash
npm test
npm run build
```
