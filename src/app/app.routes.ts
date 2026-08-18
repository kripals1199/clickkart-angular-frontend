import { Routes } from '@angular/router';

import { authGuard } from '@core/guards/auth.guard';
import { roleGuard } from '@core/guards/role.guard';

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
            // ---- seller console: ROLE_SELLER only --------------------------
            // 'new' sits before ':publicId' so it is matched as a literal rather than swallowed as
            // an id - Angular takes the first match, not the most specific.
            {
                path: 'seller/products',
                canActivate: [roleGuard('SELLER')],
                loadComponent: () =>
                    import('@features/seller/pages/seller-products/seller-products')
                        .then(m => m.SellerProducts)
            },
            {
                path: 'seller/products/new',
                canActivate: [roleGuard('SELLER')],
                loadComponent: () =>
                    import('@features/seller/pages/seller-product-form/seller-product-form')
                        .then(m => m.SellerProductForm)
            },
            {
                path: 'seller/products/:publicId',
                canActivate: [roleGuard('SELLER')],
                loadComponent: () =>
                    import('@features/seller/pages/seller-product-form/seller-product-form')
                        .then(m => m.SellerProductForm)
            },
            {
                path: 'seller/stock',
                canActivate: [roleGuard('SELLER')],
                loadComponent: () =>
                    import('@features/seller/pages/seller-stock/seller-stock')
                        .then(m => m.SellerStock)
            },
            {
                path: 'seller/orders',
                canActivate: [roleGuard('SELLER')],
                loadComponent: () =>
                    import('@features/seller/pages/seller-orders/seller-orders')
                        .then(m => m.SellerOrders)
            },

            // ---- admin console: ROLE_ADMIN only ---------------------------
            // /admin is the dashboard rather than a redirect into one of the work surfaces:
            // moderation was an arbitrary landing place, and the worklist is what an operator
            // actually wants to see first.
            {
                path: 'admin',
                canActivate: [roleGuard('ADMIN')],
                loadComponent: () =>
                    import('@features/admin/pages/dashboard/dashboard')
                        .then(m => m.AdminDashboard)
            },
            {
                path: 'admin/moderation',
                canActivate: [roleGuard('ADMIN')],
                loadComponent: () =>
                    import('@features/admin/pages/moderation/moderation')
                        .then(m => m.Moderation)
            },
            {
                path: 'admin/operations',
                canActivate: [roleGuard('ADMIN')],
                loadComponent: () =>
                    import('@features/admin/pages/operations/operations')
                        .then(m => m.Operations)
            },
            {
                path: 'admin/accounts',
                canActivate: [roleGuard('ADMIN')],
                loadComponent: () =>
                    import('@features/admin/pages/accounts/accounts')
                        .then(m => m.Accounts)
            },
            {
                path: 'admin/profiles',
                canActivate: [roleGuard('ADMIN')],
                loadComponent: () =>
                    import('@features/admin/pages/profiles/profiles')
                        .then(m => m.Profiles)
            },
            {
                path: 'admin/audit',
                canActivate: [roleGuard('ADMIN')],
                loadComponent: () =>
                    import('@features/admin/pages/audit/audit')
                        .then(m => m.Audit)
            },
            {
                path: 'admin/categories',
                canActivate: [roleGuard('ADMIN')],
                loadComponent: () =>
                    import('@features/admin/pages/categories/categories')
                        .then(m => m.Categories)
            },

            {
                path: 'account',
                canActivate: [authGuard],
                loadComponent: () =>
                    import('@features/account/pages/profile/profile')
                        .then(m => m.Profile)
            },
            {
                path: 'account/security',
                canActivate: [authGuard],
                loadComponent: () =>
                    import('@features/account/pages/security/security')
                        .then(m => m.Security)
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
