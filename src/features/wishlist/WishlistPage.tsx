import { Link } from 'react-router';
import { useWishlist, useWishlistData } from './useWishlist';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/Feedback';
import { ProductCard } from '../../components/products/ProductCard';
export function WishlistPage() {
  const list = useWishlist();
  const data = useWishlistData(list.data?.productIds);
  if (list.isPending) return <LoadingState message="Restoring your wishlist…" />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  if (!list.data.productIds.length)
    return (
      <EmptyState
        title="Your wishlist is empty"
        description="Save products to come back to them later."
        action={
          <Link to="/products" className="button button-primary">
            Explore products
          </Link>
        }
      />
    );
  if (data.isPending) return <LoadingState message="Loading saved products…" />;
  if (data.isError) return <ErrorState error={data.error} onRetry={() => void data.refetch()} />;
  return (
    <section className="catalogue-page">
      <div className="page-heading">
        <p className="eyebrow">SAVED FOR LATER</p>
        <h1>Your wishlist</h1>
        <p>{data.data.products.length} saved products</p>
      </div>
      <div className="product-grid">
        {data.data.products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            image={data.data.images.find((item) => item.id === product.imageIds[0])}
          />
        ))}
      </div>
    </section>
  );
}
