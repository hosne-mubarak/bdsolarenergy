import { ArrowUpRight, Star } from 'lucide-react';
import { Link } from 'react-router';
import type { ProductImage, ProductSummary } from '../../types';
import { minimumProductPrice } from '../../domain/catalogue/query';
import { WishlistButton } from './WishlistButton';
import { AddToCartButton } from '../cart/AddToCartButton';
import { formatMoney } from '../../utils/currency';

export function ProductCard({ product, image }: { product: ProductSummary; image?: ProductImage }) {
  const variant = product.variants.find((item) => item.price === minimumProductPrice(product))!;
  const available = product.variants.some((item) => item.stock > 0);
  return (
    <article className="product-card">
      <WishlistButton productId={product.id} name={product.name} />
      <Link
        className="product-card-image"
        to={`/product/${product.slug}`}
        aria-label={`${variant.compareAtPrice ? 'Special offer. ' : ''}View ${product.name}`}
      >
        {image && (
          <img
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            loading="lazy"
          />
        )}
        {variant.compareAtPrice && <span className="product-label">Special offer</span>}
      </Link>
      <div className="product-card-body">
        <div className="product-card-meta">
          <span className={available ? 'stock-in' : 'stock-out'}>
            {available ? 'In stock' : 'Out of stock'}
          </span>
          <span className="rating">
            <Star size={12} aria-hidden="true" fill="currentColor" />
            {product.rating.toFixed(1)} <span>({product.reviewCount})</span>
          </span>
        </div>
        <h3>
          <Link to={`/product/${product.slug}`}>{product.name}</Link>
        </h3>
        <p className="product-summary">{product.summary}</p>
        <div className="product-card-bottom">
          <div>
            <strong>{formatMoney(variant.price)}</strong>
            {variant.compareAtPrice && <del>{formatMoney(variant.compareAtPrice)}</del>}
          </div>
          <Link
            className="product-open"
            to={`/product/${product.slug}`}
            aria-label={`See details for ${product.name}`}
          >
            <ArrowUpRight size={20} aria-hidden="true" />
          </Link>
        </div>
        {product.variants.length > 1 ? (
          <Link className="button button-primary" to={`/product/${product.slug}`}>
            Choose options
          </Link>
        ) : (
          <AddToCartButton variantId={variant.id} disabled={variant.stock === 0} />
        )}
      </div>
    </article>
  );
}
