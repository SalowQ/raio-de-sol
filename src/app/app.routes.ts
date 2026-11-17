import { Routes } from '@angular/router';
import { funcionarioGuard } from './core/guards/funcionario';

export const routes: Routes = [
  {
    path: 'entrar',
    title: 'Entrar',
    loadComponent: () => import('./features/entrar/entrar').then((m) => m.Entrar),
  },
  {
    path: 'acesso-negado',
    title: 'Acesso negado',
    loadComponent: () =>
      import('./features/acesso-negado/acesso-negado').then((m) => m.AcessoNegado),
  },
  {
    path: 'familia',
    title: 'Família',
    loadComponent: () => import('./layouts/publico/layout-publico').then((m) => m.LayoutPublico),
    children: [
      {
        path: '',
        title: 'Família',
        loadComponent: () =>
          import('./features/portal-familia/portal-familia').then((m) => m.PortalFamilia),
      },
    ],
  },
  {
    path: '',
    canActivate: [funcionarioGuard],
    loadComponent: () =>
      import('./layouts/administrativo/layout-administrativo').then((m) => m.LayoutAdministrativo),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'painel' },
      {
        path: 'painel',
        title: 'Painel',
        loadComponent: () => import('./features/dashboard/painel').then((m) => m.Painel),
      },
      {
        path: 'criancas',
        children: [
          {
            path: '',
            title: 'Crianças',
            loadComponent: () => import('./features/criancas/criancas').then((m) => m.Criancas),
          },
          {
            path: 'nova',
            title: 'Nova criança',
            loadComponent: () =>
              import('./features/criancas/formulario-crianca').then((m) => m.FormularioCrianca),
          },
          {
            path: ':id',
            title: 'Perfil da criança',
            loadComponent: () =>
              import('./features/criancas/perfil-crianca').then((m) => m.PerfilCrianca),
          },
          {
            path: ':id/editar',
            title: 'Editar criança',
            loadComponent: () =>
              import('./features/criancas/formulario-crianca').then((m) => m.FormularioCrianca),
          },
        ],
      },
      {
        path: 'cadastros-pendentes',
        title: 'Cadastros pendentes',
        loadComponent: () =>
          import('./features/cadastros-pendentes/cadastros-pendentes').then(
            (m) => m.CadastrosPendentes,
          ),
      },
      {
        path: 'presenca',
        title: 'Presença',
        loadComponent: () => import('./features/presencas/presencas').then((m) => m.Presencas),
      },
      {
        path: 'historico',
        title: 'Histórico',
        loadComponent: () => import('./features/historico/historico').then((m) => m.Historico),
      },
      {
        path: 'configuracoes',
        title: 'Configurações',
        loadComponent: () =>
          import('./features/configuracoes/configuracoes').then((m) => m.Configuracoes),
      },
    ],
  },
  { path: '**', redirectTo: 'painel' },
];
