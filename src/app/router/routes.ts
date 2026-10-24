import type { RouteObject } from 'react-router';
import { AppLayout } from '../layouts/AppLayout';
import { NotFoundPage } from './NotFoundPage';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { ProtectedRoute, GuestOnlyRoute } from '../../features/auth/RouteGuards';
import { RoutePending } from './RoutePending';

export function createAppRoutes(): RouteObject[] {
  const routes: RouteObject[] = [
    {
      id: 'root',
      Component: AppLayout,
      ErrorBoundary: RouteErrorBoundary,
      HydrateFallback: RoutePending,
      children: [
        {
          id: 'public',
          children: [
            {
              index: true,
              lazy: async () => ({
                Component: (await import('../../features/home/HomePage')).HomePage,
              }),
            },
            ...[
              'products',
              'search',
              'category/:categorySlug',
              'category/:categorySlug/:subcategorySlug',
              'featured',
              'best-sellers',
              'new-arrivals',
              'offers',
            ].map((path) => ({
              path,
              lazy: async () => ({
                Component: (await import('../../features/products/CataloguePage')).CataloguePage,
              }),
            })),
            {
              path: 'product/:slug',
              lazy: async () => ({
                Component: (await import('../../features/products/ProductDetailPage'))
                  .ProductDetailPage,
              }),
            },
            {
              path: 'cart',
              lazy: async () => ({
                Component: (await import('../../features/cart/CartPage')).CartPage,
              }),
            },
            {
              path: 'wishlist',
              lazy: async () => ({
                Component: (await import('../../features/wishlist/WishlistPage')).WishlistPage,
              }),
            },
            {
              path: 'login',
              lazy: async () => ({
                Component: (await import('../../features/auth/LoginPage')).LoginPage,
              }),
            },
            {
              path: 'register',
              lazy: async () => ({
                Component: (await import('../../features/auth/RegistrationPage')).RegistrationPage,
              }),
            },
            ...(
              [
                ['forgot-password', 'ForgotPasswordPage'],
                ['reset-password', 'ResetPasswordPage'],
                ['verify-email', 'VerificationPage'],
              ] as const
            ).map(([path, page]) => ({
              path,
              lazy: async () => {
                if (page === 'ForgotPasswordPage')
                  return {
                    Component: (await import('../../features/auth/ForgotPasswordPage'))
                      .ForgotPasswordPage,
                  };
                if (page === 'ResetPasswordPage')
                  return {
                    Component: (await import('../../features/auth/ResetPasswordPage'))
                      .ResetPasswordPage,
                  };
                return {
                  Component: (await import('../../features/auth/VerificationPage'))
                    .VerificationPage,
                };
              },
            })),
            ...[
              'about',
              'faq',
              'shipping-delivery',
              'returns-refunds',
              'warranty',
              'privacy',
              'terms',
            ].map((path) => ({
              path,
              lazy: async () => ({
                Component: (await import('../../features/content/ContentPage')).ContentPage,
              }),
            })),
            {
              path: 'contact',
              lazy: async () => ({
                Component: (await import('../../features/content/ContactPage')).ContactPage,
              }),
            },
            { path: '*', Component: NotFoundPage },
          ],
        },
        {
          id: 'account',
          path: 'account',
          children: [
            {
              path: 'password',
              lazy: async () => ({
                Component: (await import('../../features/auth/ChangePasswordPage'))
                  .ChangePasswordPage,
              }),
            },
            {
              path: 'wishlist',
              lazy: async () => ({
                Component: (await import('../../features/wishlist/WishlistPage')).WishlistPage,
              }),
            },
          ],
        },
      ],
    },
  ];
  const root = routes[0];
  const publicGroup = root.children!.find((route) => route.id === 'public')!;
  const guestPaths = new Set(['login', 'register', 'forgot-password', 'reset-password']);
  const guestRoutes = publicGroup.children!.filter((route) => guestPaths.has(route.path ?? ''));
  publicGroup.children = publicGroup.children!.filter((route) => !guestPaths.has(route.path ?? ''));
  publicGroup.children.push({ id: 'guest-only', Component: GuestOnlyRoute, children: guestRoutes });
  publicGroup.children.push({
    path: 'unauthorized',
    lazy: async () => ({
      Component: (await import('../../features/auth/UnauthorizedPage')).UnauthorizedPage,
    }),
  });
  publicGroup.children.push({
    Component: ProtectedRoute,
    children: [
      {
        path: 'checkout',
        lazy: async () => ({
          Component: (await import('../../features/checkout/CheckoutPage')).CheckoutPage,
        }),
      },
      {
        path: 'order-confirmation/:orderId',
        lazy: async () => ({
          Component: (await import('../../features/orders/ConfirmationPage')).ConfirmationPage,
        }),
      },
      {
        path: 'logout',
        lazy: async () => ({
          Component: (await import('../../features/auth/LogoutPage')).LogoutPage,
        }),
      },
    ],
  });
  const accountGroup = root.children!.find((route) => route.id === 'account')!;
  accountGroup.Component = ProtectedRoute;
  accountGroup.children = [
    {
      lazy: async () => ({
        Component: (await import('../../features/account/AccountLayout')).AccountLayout,
      }),
      children: [
        {
          index: true,
          lazy: async () => ({
            Component: (await import('../../features/account/DashboardPage')).DashboardPage,
          }),
        },
        {
          path: 'profile',
          lazy: async () => ({
            Component: (await import('../../features/account/ProfilePage')).ProfilePage,
          }),
        },
        {
          path: 'profile/edit',
          lazy: async () => ({
            Component: (await import('../../features/account/ProfileEditPage')).ProfileEditPage,
          }),
        },
        {
          path: 'addresses',
          lazy: async () => ({
            Component: (await import('../../features/account/AddressBookPage')).AddressBookPage,
          }),
        },
        ...['addresses/new', 'addresses/:addressId/edit'].map((path) => ({
          path,
          lazy: async () => ({
            Component: (await import('../../features/account/AddressEditorPage')).AddressEditorPage,
          }),
        })),
        {
          path: 'settings',
          lazy: async () => ({
            Component: (await import('../../features/account/SettingsPage')).SettingsPage,
          }),
        },
        {
          path: 'orders',
          lazy: async () => ({
            Component: (await import('../../features/orders/HistoryPage')).HistoryPage,
          }),
        },
        {
          path: 'orders/:orderId',
          lazy: async () => ({
            Component: (await import('../../features/orders/OrderDetailPage')).OrderDetailPage,
          }),
        },
        {
          path: 'orders/:orderId/tracking',
          lazy: async () => ({
            Component: (await import('../../features/orders/TrackingPage')).TrackingPage,
          }),
        },
        ...accountGroup.children!.filter((route) => route.path !== '*'),
        { path: '*', Component: NotFoundPage },
      ],
    },
  ];
  return routes;
}
