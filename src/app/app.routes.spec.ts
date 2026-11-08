import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Autenticacao } from './core/auth/autenticacao';
import { routes } from './app.routes';

class AutenticacaoFalsa {
  readonly carregando = signal(false);
  readonly sessao = signal(null);
  readonly perfil = signal(null);
  readonly nome = signal('');

  aguardarInicio(): Promise<void> {
    return Promise.resolve();
  }

  perfilAtivo(): boolean {
    return false;
  }

  entrar(): Promise<string | null> {
    return Promise.resolve(null);
  }

  solicitarRedefinicao(): Promise<string | null> {
    return Promise.resolve(null);
  }

  sair(): Promise<void> {
    return Promise.resolve();
  }
}

describe('rotas', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideRouter(routes),
        { provide: Autenticacao, useValue: new AutenticacaoFalsa() },
      ],
    });
  });

  it('leva visitante da raiz para a entrada', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    expect(harness.routeNativeElement?.textContent).toContain('Acesso da equipe');
  });

  it('mantém a página da família sem o menu administrativo', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/familia');
    const texto = harness.routeNativeElement?.textContent ?? '';
    expect(texto).toContain('Use o link enviado pela instituição.');
    expect(texto.includes('Cadastros pendentes')).toBe(false);
    expect(texto.includes('Sair')).toBe(false);
  });
});
