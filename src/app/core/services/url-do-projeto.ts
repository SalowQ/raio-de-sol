/** O cliente do Supabase recebe a raiz do projeto e monta /auth e /rest sozinho. */
export function urlDoProjeto(url: string): string {
  return url.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '');
}
