import { Heart } from 'lucide-react';
import { useWishlist, useWishlistToggle } from '../../features/wishlist/useWishlist';
import { useToast } from '../common/useToast';
export function WishlistButton({ productId, name }: { productId: string; name: string }) {
  const list = useWishlist();
  const toggle = useWishlistToggle();
  const { notify } = useToast();
  const saved = list.data?.productIds.includes(productId) ?? false;
  return (
    <div className="wishlist-control">
      <button
        type="button"
        className="wishlist-button"
        aria-label={
          list.isError
            ? `Wishlist unavailable for ${name}`
            : saved
              ? `Remove ${name} from wishlist`
              : `Save ${name}`
        }
        aria-pressed={list.isError ? undefined : saved}
        disabled={toggle.isPending || list.isPending || list.isError}
        onClick={async () => {
          try {
            await toggle.mutateAsync(productId);
            notify(saved ? 'Removed from wishlist' : 'Saved to wishlist');
          } catch {
            /* Rendered mutation error. */
          }
        }}
      >
        <Heart size={19} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
      {list.isError && (
        <div>
          <p className="field-error">Wishlist unavailable.</p>
          <button type="button" className="text-action" onClick={() => void list.refetch()}>
            Retry wishlist
          </button>
        </div>
      )}
      {toggle.isError && (
        <p role="alert" className="field-error">
          {toggle.error.message}
        </p>
      )}
    </div>
  );
}
