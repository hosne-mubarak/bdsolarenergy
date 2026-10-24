import { Link, useNavigate, useParams } from 'react-router';
import { AddressForm } from '../../components/forms/AddressForm';
import { LoadingState, ErrorState } from '../../components/common/Feedback';
import { useAddress, useAddressSave } from './useAccount';
import { useToast } from '../../components/common/useToast';
export function AddressEditorPage() {
  const { addressId } = useParams();
  const query = useAddress(addressId);
  const mutation = useAddressSave();
  const navigate = useNavigate();
  const { notify } = useToast();
  if (addressId && query.isPending) return <LoadingState message="Loading saved address…" />;
  if (addressId && query.isError)
    return (
      <ErrorState resource="Address" error={query.error} onRetry={() => void query.refetch()} />
    );
  const address = query.data;
  return (
    <section>
      <div className="page-heading">
        <p className="eyebrow">DELIVERY DETAILS</p>
        <h1>{addressId ? 'Edit address' : 'Add address'}</h1>
      </div>
      <AddressForm
        key={addressId ?? 'new'}
        defaultValues={
          address
            ? {
                recipient: address.recipient,
                phone: address.phone,
                division: address.division,
                district: address.district,
                area: address.area,
                street: address.street,
                postcode: address.postcode,
                isDefault: address.isDefault,
              }
            : undefined
        }
        pending={mutation.isPending}
        error={mutation.error}
        onSubmit={async (input) => {
          await mutation.mutateAsync({ input, id: addressId });
          notify('Address saved');
          await navigate('/account/addresses');
        }}
        cancel={
          <Link className="button button-secondary" to="/account/addresses">
            Cancel
          </Link>
        }
      />
    </section>
  );
}
