import { ShoppingCart } from 'lucide-react';
import { Button } from '../common/primitives';
import { useCartActions } from '../../features/cart/useCart';
import { useToast } from '../common/useToast';
export function AddToCartButton({
  variantId,
  quantity = 1,
  disabled = false,
}: {
  variantId: string;
  quantity?: number;
  disabled?: boolean;
}) {
  const mutation = useCartActions();
  const { notify } = useToast();
  return (
    <div>
      <Button
        disabled={disabled || mutation.isPending}
        onClick={async () => {
          try {
            await mutation.mutateAsync({ type: 'add', variantId, quantity });
            notify('Added to cart');
          } catch {
            /* Mutation state displays the normalized error. */
          }
        }}
      >
        <ShoppingCart size={17} aria-hidden="true" />
        {mutation.isPending ? 'Adding…' : 'Add to cart'}
      </Button>
      {mutation.isError && (
        <p role="alert" className="field-error">
          {mutation.error.message}
        </p>
      )}
    </div>
  );
}
