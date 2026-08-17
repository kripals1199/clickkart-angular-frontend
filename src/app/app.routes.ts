import { Routes } from '@angular/router';

import { authGuard } from '@core/guards/auth.guard';

/**
 * Two groups. The auth screens are full-bleed and route on their own; everything else routes inside
 * the shell, which supplies the navbar and footer once instead of each page remembering to.
 *
 * <p>`authGuard` marks the pages that are meaningless without a session. It is a routing
 * convenience only - the Gateway authorises the data behind each of them independently.
 */
export const routes: Routes = [
    // ---- auth: deliberately outside the shell ------------------------------
    {
        path: 'login',
        loadComponent: () =>
            import('@features/auth/pages/login/login')
                .then(m => m.Login)
    },
    {
        path: 'register',
        loadComponent: () =>
            import('@features/auth/pages/register/register')
                .then(m => m.Register)
    },
    // The two halves of a password reset. Separate routes rather than one wizard, because the user
    // leaves for their email in between and comes back to a fresh page load.
    {
        path: 'forgot-password',
        loadComponent: () =>
            import('@features/auth/pages/forgot-password/forgot-password')
                .then(m => m.ForgotPassword)
    },
    {
        path: 'reset-password',
        loadComponent: () =>
            import('@features/auth/pages/reset-password/reset-password')
                .then(m => m.ResetPassword)
    },

    // ---- storefront: inside the shell --------------------------------------
    {
        path: '',
        loadComponent: () =>
            import('@layout/shell/shell')
                .then(m => m.Shell),
        children: [
            {
                path: '',
                loadComponent: () =>
                    import('@features/home/home')
                        .then(m => m.Home)
            },
            {
                path: 'products',
                loadComponent: () =>
                    import('@features/catalog/pages/product-list/product-list')
                        .then(m => m.ProductList)
            },
            {
                path: 'products/:slug',
                loadComponent: () =>
                    import('@features/catalog/pages/product-detail/product-detail')
                        .then(m => m.ProductDetail)
            },
            {
                path: 'cart',
                canActivate: [authGuard],
                loadComponent: () =>
                    import('@features/cart/pages/cart-page/cart-page')
                        .then(m => m.CartPage)
            },
            {
                path: 'checkout',
                canActivate: [authGuard],
                loadComponent: () =>
                    import('@features/checkout/pages/checkout/checkout')
                        .then(m => m.Checkout)
            },
            {
                path: 'orders',
                canActivate: [authGuard],
                loadComponent: () =>
                    import('@features/orders/pages/order-list/order-list')
                        .then(m => m.OrderList)
            },
            {
                path: 'orders/:reference',
                canActivate: [authGuard],
                loadComponent: () =>
                    import('@features/orders/pages/order-detail/order-detail')
                        .then(m => m.OrderDetail)
            },
            {
                path: 'account',
                canActivate: [authGuard],
                loadComponent: () =>
                    import('@features/account/pages/profile/profile')
                        .then(m => m.Profile)
            },
            {
                path: 'account/addresses',
                canActivate: [authGuard],
                loadComponent: () =>
                    import('@features/account/pages/addresses/addresses')
                        .then(m => m.Addresses)
            }
        ]
    },

    // Anything unrecognised goes home. Note this swallows typos silently rather than showing a
    // 404, which is why a link to a route that does not exist yet looks like it "works".
    {
        path: '**',
        redirectTo: ''
    }

];
