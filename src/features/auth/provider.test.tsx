import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createQueryClient } from '../../app/providers/query-client';
import type { Cart } from '../../types';
import { AppProviders } from '../../app/providers/AppProviders';
import { useAuth } from './useAuth';
import { useCart, useShoppingServices } from '../cart/useCart';
import { DEMO_PASSPHRASE } from '../../services/json/auth';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
function Probe() {
  const session = useAuth();
  const cart = useCart();
  const services = useShoppingServices();
  return (
    <>
      <p data-testid="identity">
        {session.isPending ? 'restoring' : (session.data?.userId ?? 'guest')}
      </p>
      <p data-testid="count">
        {cart.data?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 'loading'}
      </p>
      <button onClick={() => void services.cart.add('product-panels-1-v1', 1)}>
        Add guest item
      </button>
      <button
        onClick={() =>
          void services.auth.login({
            email: 'demo@example.com',
            password: DEMO_PASSPHRASE,
            remember: false,
          })
        }
      >
        Sign in demo
      </button>
      <button onClick={() => void services.auth.logout()}>Sign out demo</button>
    </>
  );
}
describe('auth restoration and shopping ownership', () => {
  it('switches private query ownership without leaking the prior cart', async () => {
    const client = createQueryClient();
    render(
      <AppProviders client={client}>
        <Probe />
      </AppProviders>,
    );
    await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('guest'));
    await userEvent.click(screen.getByRole('button', { name: 'Add guest item' }));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
    await userEvent.click(screen.getByRole('button', { name: 'Sign in demo' }));
    await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('user-demo'));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
    await userEvent.click(screen.getByRole('button', { name: 'Sign out demo' }));
    await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('guest'));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
    for (const [key, data] of client.getQueriesData<Cart>({ queryKey: ['shopping', 'cart'] })) {
      if (data) expect(data.ownerKey).toBe(key[2]);
    }
  });
});
