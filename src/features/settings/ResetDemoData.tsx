import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import { Button, Dialog } from '../../components/common/primitives';
import { useShoppingServices } from '../store/useShoppingServices';
import { useAuth } from '../auth/useAuth';
import { normalizeRepositoryError } from '../../services/errors';
import { useToast } from '../../components/common/useToast';

export function ResetDemoData() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [homeRequest, setHomeRequest] = useState(0);
  const active = useRef(false);
  const services = useShoppingServices();
  const auth = useAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const endTransition = auth.endTransition;
  // Keep the session fence until React has committed the destination. Awaiting
  // navigate alone can settle before the old protected screen is replaced.
  useEffect(() => {
    if (homeRequest > 0 && location.pathname === '/' && active.current) {
      active.current = false;
      endTransition();
    }
  }, [homeRequest, location.pathname, endTransition]);
  useEffect(
    () => () => {
      if (active.current) {
        active.current = false;
        endTransition();
      }
    },
    [endTransition],
  );
  const { notify } = useToast();
  async function reset() {
    if (active.current) return;
    setPending(true);
    setError('');
    active.current = true;
    auth.beginTransition();
    try {
      await client.cancelQueries();
      services.resetDemoData();
      client.removeQueries({ queryKey: ['shopping'] });
      // Preserve the observed session query while refreshing it; removing it
      // would trigger the initial restore gate and unmount this action early.
      client.removeQueries({
        predicate: (query) => query.queryKey[0] === 'auth' && query.queryKey[1] !== 'session',
      });
      await client.invalidateQueries({ queryKey: ['auth', 'session'] });
      setOpen(false);
      setHomeRequest((request) => request + 1);
      await navigate('/', { replace: true });
      notify('Demo data reset');
    } catch (cause) {
      setError(normalizeRepositoryError(cause).message);
      await client.invalidateQueries({ queryKey: ['auth', 'session'] });
      active.current = false;
      auth.endTransition();
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setError('');
          setOpen(true);
        }}
      >
        Reset demo data
      </Button>
      <Dialog
        open={open}
        title="Reset all demo data?"
        onClose={() => {
          if (!pending) setOpen(false);
        }}
      >
        <p>
          This removes this application’s demo accounts, sessions, addresses, preferences, cart,
          wishlist and orders from this browser. You will be signed out. Unrelated browser data is
          preserved. This cannot be undone.
        </p>
        {error && (
          <p role="alert" className="field-error">
            {error} Some demo data may have been removed. You can retry.
          </p>
        )}
        <div className="action-row">
          <Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={pending} onClick={() => void reset()}>
            Reset demo data
          </Button>
        </div>
      </Dialog>
    </>
  );
}
