import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./features/home/pages/home/home')
                .then(m => m.Home)
    },
    {
        path: 'register',
        loadComponent: () =>
            import('./features/auth/pages/register/register')
                .then(m => m.Register)
    },
    {
        path: '**',
        redirectTo: ''
    }

];
