import type { Routes } from '@angular/router';

import { authGuard } from '../core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Connexion — Dépôt Numérique',
    loadComponent: () => import('../features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'deposit' },
      {
        path: 'deposit',
        title: 'Dépôt de documents — Dépôt Numérique',
        loadComponent: () =>
          import('../features/deposit/deposit.component').then((m) => m.DepositComponent),
      },
      {
        path: 'history',
        title: 'Historique — Dépôt Numérique',
        loadComponent: () =>
          import('../features/history/history.component').then((m) => m.HistoryComponent),
      },
      {
        path: 'documents/:id',
        title: 'Détail du document — Dépôt Numérique',
        loadComponent: () =>
          import('../features/document-detail/document-detail.component').then(
            (m) => m.DocumentDetailComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
