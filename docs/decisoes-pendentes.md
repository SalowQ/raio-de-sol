# Decisões

Nada além do que está marcado como confirmado deve ser tratado como regra do Instituto.

## Confirmado nesta etapa

Parentesco com a criança:

- É opcional. Pode ficar em branco.
- Vale para a ligação entre uma criança e um responsável, porque a mesma pessoa pode responder por mais de uma criança.
- A tela oferece uma lista para agilizar: Mãe, Pai, Avó, Avô, Irmã, Irmão, Tia, Tio, Madrasta, Padrasto, Responsável legal, Tutor e, por último, Outros.
- Outros abre um texto livre, até 80 caracteres. Se ficar em branco, grava a palavra Outros. A coluna continua `text null`; a lista não é uma regra fechada do Instituto.
- A coluna é `crianca_responsaveis.parentesco text null`, com a restrição `char_length(parentesco) <= 80` quando houver texto.

O cadastro de crianças usa o campo `CampoParentesco`. Texto só com espaços é gravado como nulo.

## Ainda em aberto com o Instituto

- Data de nascimento, data de ingresso e observações administrativas da criança continuam propostas e opcionais.
- Obrigatoriedade de cada documento. O catálogo futuro nasce com todos os tipos opcionais.
- BPC, LOAS e Bolsa Família permanecem nomes distintos da ficha. Isso já está definido para a Etapa 2 e não deve ser unificado.
- Base legal, aviso de privacidade, prazos de retenção e procedimento de exclusão.
- Turnos de atendimento. A presença futura usa uma sessão chamada `dia` até a ONG confirmar outro calendário.
- Dias em que a criança era esperada. Sem esse calendário, a frequência mostra totais e não calcula percentual.
- Validade inicial sugerida para links da família: 7 dias, configurável pelo funcionário.
- Tamanho máximo sugerido por arquivo: 10 MB, nos tipos PDF, JPEG e PNG.
- Cores e logotipo oficiais. A paleta atual é só uma escolha de interface.
