import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Button } from '../../components/common/primitives';
import { useShoppingServices } from '../store/useShoppingServices';
import { refreshSessionQueries } from './refresh-session';
export function LogoutPage() {
  const transition = useAuth();
  const services = useShoppingServices();
  const client = useQueryClient();
  const navigate = useNavigate();
  const active = useRef(false);
  const endTransition = transition.endTransition;
  useEffect(
    () => () => {
      if (active.current) {
        active.current = false;
        endTransition();
      }
    },
    [endTransition],
  );
  const mutation = useMutation({
    mutationKey: ['auth', 'transition'],
    onMutate: () => {
      active.current = true;
      transition.beginTransition();
    },
    onError: () => {
      active.current = false;
      transition.endTransition();
    },
    mutationFn: () => services.auth.logout(),
    onSuccess: async () => {
      await refreshSessionQueries(client);
      client.removeQueries({ queryKey: ['auth', 'verification'] });
      await navigate('/', { replace: true });
    },
  });
  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1>Sign out of this demo</h1>
        <p>
          Your account data stays in this browser. Your separate guest cart will be shown after
          sign-out.
        </p>
        {mutation.isError && (
          <p role="alert" className="field-error">
            {mutation.error.message}
          </p>
        )}
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          Sign out
        </Button>
      </div>
    </section>
  );
}
