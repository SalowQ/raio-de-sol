import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import type { Session } from '@supabase/supabase-js';
import type { PerfilUsuario } from '../../models/perfil-usuario';
import { Autenticacao } from '../auth/autenticacao';
import { funcionarioGuard } from './funcionario';

class AutenticacaoFalsa {
  readonly sessao = signal<Session | null>(null);
  readonly perfil = signal<PerfilUsuario | null>(null);

  aguardarInicio(): Promise<void> {
    return Promise.resolve();
  }

  perfilAtivo(): boolean {
    const perfil = this.perfil();
    return perfil?.papel === 'funcionario' && perfil.ativo === true;
  }
}

describe('funcionarioGuard', () => {
  let falsa: AutenticacaoFalsa;

  beforeEach(() => {
    falsa = new AutenticacaoFalsa();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Autenticacao, useValue: falsa }],
    });
  });

  it('envia visitante sem sessão para a entrada', async () => {
    const resultado = await acionar();
    expect(caminho(resultado)).toBe('/entrar');
  });

  it('bloqueia autenticado sem perfil ativo', async () => {
    falsa.sessao.set({ user: { id: 'usuario-1' } } as Session);
    falsa.perfil.set({
      id: 'usuario-1',
      nome: 'Equipe Teste',
      papel: 'funcionario',
      ativo: false,
    });

    const resultado = await acionar();
    expect(caminho(resultado)).toBe('/acesso-negado');
  });

  it('permite funcionário ativo', async () => {
    falsa.sessao.set({ user: { id: 'usuario-1' } } as Session);
    falsa.perfil.set({
      id: 'usuario-1',
      nome: 'Equipe Teste',
      papel: 'funcionario',
      ativo: true,
    });

    await expect(acionar()).resolves.toBe(true);
  });
});

function acionar(): Promise<boolean | UrlTree> {
  return TestBed.runInInjectionContext(() =>
    funcionarioGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  ) as Promise<boolean | UrlTree>;
}

function caminho(resultado: boolean | UrlTree): string {
  if (!(resultado instanceof UrlTree)) {
    return '';
  }
  return TestBed.inject(Router).serializeUrl(resultado);
}
