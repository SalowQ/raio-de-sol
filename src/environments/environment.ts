// Valores vazios de propósito. O script scripts/gerar-ambiente.mjs preenche
// este arquivo a partir de SUPABASE_URL e SUPABASE_ANON_KEY.
// A chave anon é pública; a autorização efetiva é o RLS.
// Nunca coloque a service_role ou uma chave sb_secret aqui.
export const environment = {
  production: false,
  supabaseUrl: '',
  supabaseAnonKey: '',
};
