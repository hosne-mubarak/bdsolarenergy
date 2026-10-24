import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Preferences } from '../../types';
import { useOwnerKey } from '../auth/useAuth';
import { useShoppingServices } from '../store/useShoppingServices';
import { LoadingState, ErrorState } from '../../components/common/Feedback';
import { Button } from '../../components/common/primitives';
import { ResetDemoData } from '../settings/ResetDemoData';
import { useToast } from '../../components/common/useToast';
function PreferencesForm({ initial }: { initial: Preferences }) {
  const [value, setValue] = useState(initial);
  const { customers } = useShoppingServices();
  const client = useQueryClient();
  const { notify } = useToast();
  const save = useMutation({
    mutationFn: () => customers.updatePreferences(value),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['shopping', 'preferences'] });
      notify('Preferences saved');
    },
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
      className="profile-form"
    >
      <label>
        <input
          type="checkbox"
          checked={value.orderUpdates}
          onChange={(event) => setValue({ ...value, orderUpdates: event.target.checked })}
        />{' '}
        Order update preference
      </label>
      <p>Saved locally for the future account integration. This demo sends no notifications.</p>
      <label>
        <input
          type="checkbox"
          checked={value.compactCards}
          onChange={(event) => setValue({ ...value, compactCards: event.target.checked })}
        />{' '}
        Compact product cards
      </label>
      {save.isError && <p role="alert">{save.error.message}</p>}
      <Button type="submit" disabled={save.isPending}>
        Save preferences
      </Button>
    </form>
  );
}
export function SettingsPage() {
  const { customers } = useShoppingServices();
  const owner = useOwnerKey();
  const query = useQuery({
    queryKey: ['shopping', 'preferences', owner],
    queryFn: ({ signal }) => customers.getPreferences({ signal }),
  });
  return (
    <section>
      <div className="page-heading">
        <h1>Account settings</h1>
        <p>Your preferences stay in this browser.</p>
      </div>
      {query.isPending ? (
        <LoadingState message="Loading preferences…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <PreferencesForm initial={query.data} />
      )}
      <h2>Start again</h2>
      <ResetDemoData />
    </section>
  );
}
