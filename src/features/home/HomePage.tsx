import { ArrowRight, ArrowUpRight, Truck, CreditCard, BookOpen, Star, Sun } from 'lucide-react';
import { Link } from 'react-router';
import { ErrorState, LoadingState, EmptyState } from '../../components/common/Feedback';
import { ProductCard } from '../../components/products/ProductCard';
import { useHomeData } from './useHomeData';

export function HomePage() {
  const query = useHomeData();
  if (query.isPending) return <LoadingState message="Preparing your energy essentials…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const { settings, banners, categories, images, products, reviews, configuration } = query.data;
  const banner = banners[0];
  const heroImage = images.find((image) => image.id === banner?.imageId);
  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <Sun size={16} aria-hidden="true" />{' '}
            {categories
              .filter((category) => !category.parentId)
              .map((category) => category.name)
              .join(' · ')}
          </p>
          <h1>{banner?.title ?? 'Discover your next energy solution.'}</h1>
          <p>
            {banner?.copy ?? 'Browse the catalogue to find the right essentials for your project.'}
          </p>
          <div className="hero-actions">
            <Link to={banner?.ctaPath ?? '/products'} className="button button-primary">
              {banner?.ctaLabel ?? 'Browse products'}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link to="/about" className="hero-secondary">
              Meet the store <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <p className="hero-demo">Demo catalogue · No real orders or payments</p>
        </div>
        <div className="hero-visual">
          {heroImage && (
            <img
              src={heroImage.src}
              alt={heroImage.alt}
              width={heroImage.width}
              height={heroImage.height}
              fetchPriority="high"
            />
          )}
          <span className="hero-orbit" aria-hidden="true" />
          <div className="hero-note">
            <Sun aria-hidden="true" size={24} />
            <div>
              <strong>{settings.name}</strong>
              <span>Sample catalogue</span>
            </div>
          </div>
        </div>
      </section>
      <div className="home-benefits">
        <div>
          <Truck aria-hidden="true" />
          <p>
            <strong>Delivery options</strong>
            <span>{configuration.shipping.map((method) => method.label).join(' · ')}</span>
          </p>
        </div>
        <div>
          <CreditCard aria-hidden="true" />
          <p>
            <strong>Payment demonstrations</strong>
            <span>
              {configuration.payments
                .filter((method) => method.enabled)
                .map((method) => method.label)
                .join(' · ')}
            </span>
          </p>
        </div>
        <div>
          <BookOpen aria-hidden="true" />
          <p>
            <strong>Choose with confidence</strong>
            <span>Compare product options and specifications</span>
          </p>
        </div>
      </div>
      <section className="home-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FIND YOUR ESSENTIALS</p>
            <h2>Shop by category</h2>
          </div>
          <Link to="/products">
            Explore all <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="category-grid">
          {categories
            .filter((category) => category.parentId)
            .map((category) => {
              const image = images.find((record) => record.id === category.imageId);
              return (
                <Link className="category-card" key={category.id} to={`/category/${category.slug}`}>
                  {image && (
                    <img
                      src={image.src}
                      alt=""
                      width={image.width}
                      height={image.height}
                      loading="lazy"
                    />
                  )}
                  <span>{category.name}</span>
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              );
            })}
        </div>
      </section>
      <section className="home-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SELECTED FOR YOUR NEXT PROJECT</p>
            <h2>Featured essentials</h2>
          </div>
          <Link to="/featured">
            View all products <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        {products.length ? (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                image={images.find((image) => image.id === product.imageIds[0])}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="New selections are on their way"
            action={
              <Link to="/products" className="button button-primary">
                Browse the catalogue
              </Link>
            }
          />
        )}
      </section>
      {banners[1] && (
        <section className="solar-promo">
          <div>
            <p className="eyebrow">EXPLORE YOUR OPTIONS</p>
            <h2>{banners[1].title}</h2>
            <p>{banners[1].copy}</p>
          </div>
          <Link className="button button-secondary" to={banners[1].ctaPath}>
            {banners[1].ctaLabel} <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
      )}
      {reviews.length > 0 && (
        <section className="home-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">CUSTOMER PERSPECTIVES</p>
              <h2>Feedback from the demo community</h2>
            </div>
            <span className="sample-label">Illustrative reviews</span>
          </div>
          <div className="review-grid">
            {reviews.map((review) => (
              <figure className="review-card" key={review.id}>
                <div
                  className="review-stars"
                  role="img"
                  aria-label={`${review.rating} out of 5 stars`}
                >
                  {Array.from({ length: review.rating }, (_, i) => (
                    <Star key={i} size={15} fill="currentColor" aria-hidden="true" />
                  ))}
                </div>
                <blockquote>{review.body}</blockquote>
                <figcaption>
                  <span className="avatar" aria-hidden="true">
                    {review.displayName[0]}
                  </span>
                  <div>
                    <strong>{review.displayName}</strong>
                    <span>{review.title}</span>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
      <p className="demo-notice">{settings.demoNotice}</p>
    </div>
  );
}
