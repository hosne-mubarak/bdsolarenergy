import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppProviders } from './app/providers/AppProviders';
import { createAppRoutes } from './app/router/routes';

export function App() {
  const [router] = useState(() => createBrowserRouter(createAppRoutes()));
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
