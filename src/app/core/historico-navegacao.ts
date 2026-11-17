import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

const LIMITE = 30;

/** Home e listagens não mostram o voltar. */
const SEM_VOLTAR = new Set([
  '/painel',
  '/criancas',
  '/cadastros-pendentes',
  '/documentos',
  '/presenca',
  '/historico',
]);

export function caminhoDaUrl(url: string): string {
  return url.split(/[?#]/)[0];
}

export function paginaSemVoltar(url: string): boolean {
  return SEM_VOLTAR.has(caminhoDaUrl(url));
}

const LISTAGENS = [...SEM_VOLTAR].filter((caminho) => caminho !== '/painel');

/** Listagem da página atual. A própria listagem e a home não têm destino. */
export function listagemDaPagina(url: string): string | null {
  const caminho = caminhoDaUrl(url);
  if (SEM_VOLTAR.has(caminho)) {
    return null;
  }

  return (
    LISTAGENS.find((item) => caminho === item || caminho.startsWith(`${item}/`)) ?? null
  );
}

/** Página anterior, ou a listagem quando a tela foi aberta sem histórico. */
export function destinoVoltar(anterior: string | null, atual: string): string | null {
  if (paginaSemVoltar(atual)) {
    return null;
  }

  const caminhoAnterior = anterior ? caminhoDaUrl(anterior) : '';
  if (anterior && caminhoAnterior !== '' && caminhoAnterior !== '/') {
    return anterior;
  }

  return listagemDaPagina(atual);
}

/** Guarda a visita ou desfaz o passo quando a navegação retorna à página anterior. */
export function registrarUrl(pilha: readonly string[], url: string): string[] {
  if (pilha.at(-1) === url) {
    return [...pilha];
  }

  if (pilha.length >= 2 && pilha.at(-2) === url) {
    return pilha.slice(0, -1);
  }

  return [...pilha, url].slice(-LIMITE);
}

@Injectable({ providedIn: 'root' })
export class HistoricoNavegacao {
  private readonly rotas = inject(Router);
  private readonly pilha = signal<string[]>([]);

  readonly anterior = computed(() => {
    const urls = this.pilha();
    return urls.length >= 2 ? urls[urls.length - 2] : null;
  });

  constructor() {
    this.rotas.events
      .pipe(
        filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((evento) => {
        this.pilha.update((atual) => registrarUrl(atual, evento.urlAfterRedirects));
      });
  }
}
