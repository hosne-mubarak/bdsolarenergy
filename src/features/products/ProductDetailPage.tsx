import { useState } from 'react';
import { useParams } from 'react-router';
import { Star, Truck } from 'lucide-react';
import { ErrorState, LoadingState, EmptyState } from '../../components/common/Feedback';
import { Button } from '../../components/common/primitives';
import { SelectField } from '../../components/forms/Fields';
import { WishlistButton } from '../../components/products/WishlistButton';
import { AddToCartButton } from '../../components/cart/AddToCartButton';
import { QuantitySelector } from '../../components/products/QuantitySelector';
import { formatMoney } from '../../utils/currency';
import { useProductDetail } from './useProductDetail';

type DetailData = NonNullable<ReturnType<typeof useProductDetail>['data']>;
function ProductDetails({ data }: { data: DetailData }) {
  const { product, images, reviews, configuration, warranty } = data;
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const [quantity, setQuantity] = useState(1);
  const [imageId, setImageId] = useState(product.imageIds[0]);
  const variant = product.variants.find((item) => item.id === variantId)!;
  const image = images.find((item) => item.id === imageId) ?? images[0];
  const max = Math.min(variant.stock, variant.maxPerOrder);
  return (
    <article className="product-detail">
      <div className="detail-grid">
        <div className="product-gallery">
          {image && (
            <img
              className="main-product-image"
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              fetchPriority="high"
            />
          )}
          {images.length > 1 && (
            <div className="gallery-thumbnails">
              {images.map((record) => (
                <Button
                  key={record.id}
                  variant="secondary"
                  onClick={() => setImageId(record.id)}
                  aria-label={`View ${record.alt}`}
                  aria-pressed={record.id === imageId}
                >
                  <img src={record.src} alt="" width="80" height="52" />
                </Button>
              ))}
            </div>
          )}
        </div>
        <div className="detail-summary">
          <div className="detail-title-row">
            <p className="eyebrow">PRODUCT DETAILS</p>
            <WishlistButton productId={product.id} name={product.name} />
          </div>
          <h1>{product.name}</h1>
          <p className="detail-rating">
            <Star size={16} fill="currentColor" aria-hidden="true" />
            {product.rating.toFixed(1)} <span>({product.reviewCount} reviews)</span>
          </p>
          <p className="detail-description">{product.summary}</p>
          <p className="detail-price" aria-live="polite">
            <strong>{formatMoney(variant.price)}</strong>
            {variant.compareAtPrice && <del>{formatMoney(variant.compareAtPrice)}</del>}
          </p>
          <p className={variant.stock > 0 ? 'stock-in' : 'stock-out'}>
            {variant.stock > 0
              ? `${variant.stock} available · Max ${variant.maxPerOrder} per order`
              : 'Out of stock'}
          </p>
          <p className="sku">SKU: {variant.sku}</p>
          <SelectField
            id="product-option"
            label="Product option"
            value={variantId}
            onChange={(event) => {
              setVariantId(event.target.value);
              setQuantity(1);
            }}
          >
            {product.variants.map((item) => (
              <option key={item.id} value={item.id}>
                {Object.values(item.attributes).join(' · ')}
                {item.stock === 0 ? ' — Out of stock' : ''}
              </option>
            ))}
          </SelectField>
          <QuantitySelector
            value={quantity}
            onChange={setQuantity}
            max={max}
            disabled={max === 0}
          />
          <AddToCartButton variantId={variant.id} quantity={quantity} disabled={max === 0} />
          <div className="delivery-summary">
            <Truck size={20} aria-hidden="true" />
            <div>
              <strong>Demo delivery options</strong>
              {configuration.shipping.map((method) => (
                <p key={method.id}>
                  {method.label}: {formatMoney(method.fee)} · {method.estimatedDays.min}–
                  {method.estimatedDays.max} days (sample)
                </p>
              ))}
            </div>
          </div>
          <p className="sample-label">
            Illustrative product, pricing and stock. No real order or payment is processed.
          </p>
        </div>
      </div>
      <div className="detail-sections">
        <section>
          <h2>Description</h2>
          <p>{product.description}</p>
        </section>
        <section>
          <h2>Technical specifications</h2>
          <dl className="specifications">
            {product.specifications.map((spec) => (
              <div key={spec.label}>
                <dt>{spec.label}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h2>Warranty information</h2>
          <p>{warranty.sections[0].body}</p>
        </section>
        <section>
          <h2>Customer reviews</h2>
          {reviews.length ? (
            reviews.map((review) => (
              <div key={review.id} className="detail-review">
                <strong>{review.title}</strong>
                <p role="img" aria-label={`${review.rating} out of 5 stars`}>
                  {'★'.repeat(review.rating)}
                </p>
                <p>{review.body}</p>
                <span>{review.displayName}</span>
              </div>
            ))
          ) : (
            <EmptyState
              title="No reviews yet"
              description="Customer reviews will appear here when available."
            />
          )}
        </section>
      </div>
    </article>
  );
}
export function ProductDetailPage() {
  const { slug = '' } = useParams();
  const query = useProductDetail(slug);
  if (query.isPending) return <LoadingState message="Loading product details…" />;
  if (query.isError)
    return (
      <ErrorState resource="Product" error={query.error} onRetry={() => void query.refetch()} />
    );
  return <ProductDetails key={slug} data={query.data} />;
}
