import { useState } from 'react';
import { Link } from 'react-router';
import { useAddresses, useAddressDelete } from './useAccount';
import { Button, Dialog } from '../../components/common/primitives';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/Feedback';
export function AddressBookPage() {
  const query = useAddresses();
  const mutation = useAddressDelete();
  const [deleting, setDeleting] = useState<string | null>(null);
  if (query.isPending) return <LoadingState message="Loading your addresses…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <section>
      <div className="page-heading">
        <p className="eyebrow">DELIVERY DETAILS</p>
        <h1>Address book</h1>
        <p>Store sample delivery addresses for your demo checkout.</p>
      </div>
      <Link className="button button-primary" to="/account/addresses/new">
        Add address
      </Link>
      {query.data.length ? (
        <div className="address-grid">
          {query.data.map((address) => (
            <article className="address-card" key={address.id}>
              {address.isDefault && <span className="default-badge">Default address</span>}
              <h2>{address.recipient}</h2>
              <p>{address.phone}</p>
              <p>
                {address.street}
                <br />
                {address.area}, {address.district}
                <br />
                {address.division} {address.postcode}
              </p>
              <div className="action-row">
                <Link
                  className="button button-secondary"
                  to={`/account/addresses/${address.id}/edit`}
                >
                  Edit address
                </Link>
                <Button variant="secondary" onClick={() => setDeleting(address.id)}>
                  Delete address
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No saved addresses"
          description="Add a sample address to make demo checkout easier."
        />
      )}
      {mutation.isError && !deleting && (
        <p role="alert" className="field-error">
          {mutation.error.message}
        </p>
      )}
      <Dialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this address?"
      >
        <p>Existing order snapshots keep their original delivery details.</p>
        <div className="action-row">
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={mutation.isPending}
            onClick={async () => {
              try {
                await mutation.mutateAsync(deleting!);
                setDeleting(null);
              } catch {
                /* Safe error below. */
              }
            }}
          >
            Delete address
          </Button>
        </div>
        {mutation.isError && (
          <p role="alert" className="field-error">
            {mutation.error.message}
          </p>
        )}
      </Dialog>
    </section>
  );
}
