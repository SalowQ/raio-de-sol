import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { Autenticacao } from '../auth/autenticacao';

export const funcionarioGuard: CanActivateFn = async () => {
  const autenticacao = inject(Autenticacao);
  const router = inject(Router);

  await autenticacao.aguardarInicio();

  if (!autenticacao.sessao()) {
    return router.createUrlTree(['/entrar']);
  }

  if (!autenticacao.perfilAtivo()) {
    return router.createUrlTree(['/acesso-negado']);
  }

  return true;
};
