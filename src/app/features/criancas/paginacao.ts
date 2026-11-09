export const TAMANHO_PAGINA = 10;

/** Página atual, total de páginas e total filtrado devolvido pelo Supabase. */
export function rotuloPaginacao(pagina: number, tamanho: number, total: number): string {
  const tamanhoValido = tamanho > 0 ? tamanho : 1;
  const paginas = total === 0 ? 1 : Math.ceil(total / tamanhoValido);
  const atual = Math.min(Math.max(pagina, 0) + 1, paginas);
  const resultados = total === 1 ? '1 resultado' : `${total} resultados`;
  return `Página ${atual} de ${paginas} · ${resultados}`;
}
