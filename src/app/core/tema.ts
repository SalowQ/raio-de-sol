import { Injectable, signal } from '@angular/core';

const CHAVE_TEMA = 'raio-de-sol-tema';

@Injectable({ providedIn: 'root' })
export class Tema {
  readonly escuro = signal(lerTemaEscuro());

  constructor() {
    aplicarTema(this.escuro());
  }

  alternar(): void {
    this.definir(!this.escuro());
  }

  definir(escuro: boolean): void {
    this.escuro.set(escuro);
    aplicarTema(escuro);
    try {
      localStorage.setItem(CHAVE_TEMA, escuro ? 'escuro' : 'claro');
    } catch {
      // A preferência continua só nesta visita se o navegador bloquear o armazenamento.
    }
  }
}

export function lerTemaEscuro(): boolean {
  try {
    return localStorage.getItem(CHAVE_TEMA) === 'escuro';
  } catch {
    return false;
  }
}

export function aplicarTema(escuro: boolean): void {
  document.documentElement.classList.toggle('escuro', escuro);
}
