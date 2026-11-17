import { describe, expect, it } from 'vitest';
import { destinoVoltar, listagemDaPagina, paginaSemVoltar, registrarUrl } from './historico-navegacao';

describe('histórico de navegação', () => {
  it('guarda a página anterior e desfaz o passo ao voltar', () => {
    let pilha = registrarUrl([], '/painel');
    pilha = registrarUrl(pilha, '/criancas');
    pilha = registrarUrl(pilha, '/criancas/1');

    expect(pilha.at(-2)).toBe('/criancas');

    pilha = registrarUrl(pilha, '/criancas');
    expect(pilha).toEqual(['/painel', '/criancas']);
  });

  it('ignora a mesma página repetida', () => {
    const pilha = registrarUrl(['/painel'], '/painel');
    expect(pilha).toEqual(['/painel']);
  });

  it('esconde o voltar na home e nas listagens', () => {
    expect(paginaSemVoltar('/painel')).toBe(true);
    expect(paginaSemVoltar('/criancas?nome=ana')).toBe(true);
    expect(paginaSemVoltar('/cadastros-pendentes')).toBe(true);
    expect(paginaSemVoltar('/presenca')).toBe(true);
    expect(paginaSemVoltar('/historico')).toBe(true);
    expect(paginaSemVoltar('/criancas/nova')).toBe(false);
    expect(paginaSemVoltar('/criancas/1')).toBe(false);
    expect(paginaSemVoltar('/criancas/1/editar')).toBe(false);
    expect(paginaSemVoltar('/configuracoes')).toBe(false);
  });

  it('sem histórico aponta a listagem da página', () => {
    expect(listagemDaPagina('/criancas/1')).toBe('/criancas');
    expect(listagemDaPagina('/criancas/1/editar')).toBe('/criancas');
    expect(listagemDaPagina('/criancas/nova')).toBe('/criancas');
    expect(listagemDaPagina('/criancas')).toBeNull();
    expect(listagemDaPagina('/configuracoes')).toBeNull();
    expect(destinoVoltar(null, '/criancas/1/editar')).toBe('/criancas');
    expect(destinoVoltar('/painel', '/criancas/nova')).toBe('/painel');
    expect(destinoVoltar('/', '/criancas/1')).toBe('/criancas');
  });
});
