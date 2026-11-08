// Substituído no build de produção quando as variáveis de ambiente existem.
// A chave anon é pública; a autorização efetiva é o RLS.
// Nunca coloque a service_role ou uma chave sb_secret aqui.
export const environment = {
  production: true,
  supabaseUrl: '',
  supabaseAnonKey: '',
};
