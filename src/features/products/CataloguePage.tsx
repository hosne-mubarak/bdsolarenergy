import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { ErrorState, LoadingState, EmptyState } from '../../components/common/Feedback';
import { ProductFilters } from '../../components/products/ProductFilters';
import { Pagination } from '../../components/products/Pagination';
import { SelectField } from '../../components/forms/Fields';
import { parseCatalogueQuery } from './query-params';
import { ProductCard } from '../../components/products/ProductCard';
import type { ProductQuery } from '../../types';
import { useCatalogueData } from './useCatalogueData';

const collectionNames: Record<string, string> = {
  featured: 'Featured products',
  'best-sellers': 'Best sellers',
  'new-arrivals': 'New arrivals',
  offers: 'Special offers',
  all: 'All products',
};
export function CataloguePage() {
  const params = useParams();
  const { pathname } = useLocation();
  const key = pathname.split('/')[1];
  const collection = (
    ['featured', 'best-sellers', 'new-arrivals', 'offers'].includes(key) ? key : 'all'
  ) as ProductQuery['collection'];
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseCatalogueQuery(searchParams, collection);
  function change(values: Record<string, string | string[]>, resetPage = true) {
    const next = new URLSearchParams(searchParams);
    if (resetPage) next.delete('page');
    for (const [key, value] of Object.entries(values)) {
      next.delete(key);
      for (const item of Array.isArray(value) ? value : [value]) if (item) next.append(key, item);
    }
    setSearchParams(next);
  }
  const query = useCatalogueData({
    categorySlug: params.categorySlug,
    subcategorySlug: params.subcategorySlug,
    query: filters,
  });
  if (query.isPending) return <LoadingState message="Finding your energy essentials…" />;
  if (query.isError)
    return (
      <ErrorState resource="Catalogue" error={query.error} onRetry={() => void query.refetch()} />
    );
  const { page, categories, images, category, brands } = query.data;
  return (
    <section className="catalogue-page">
      <div className="page-heading">
        <p className="eyebrow">THE PRODUCT COLLECTION</p>
        <h1>
          {key === 'search'
            ? `Search results${filters.text ? ` for “${filters.text}”` : ''}`
            : (category?.name ?? collectionNames[collection])}
        </h1>
        <p>Explore options and compare specifications for your next project.</p>
      </div>
      <nav className="category-switcher" aria-label="Product categories">
        <Link to="/products">All products</Link>
        {categories
          .filter((item) => !item.parentId)
          .map((item) => (
            <Link key={item.id} to={`/category/${item.slug}`}>
              {item.name}
            </Link>
          ))}
        <Link to="/offers">Special offers</Link>
      </nav>
      <div className="catalogue-layout">
        <ProductFilters
          query={filters}
          brands={brands}
          onChange={change}
          onClear={() => setSearchParams(filters.text ? { q: filters.text } : {})}
        />
        <div className="catalogue-results" aria-busy={query.isFetching}>
          {query.isFetching && <p role="status">Updating products…</p>}
          <div className="catalogue-result-heading">
            <p>{page.total} products</p>
            <SelectField
              id="sort-products"
              label="Sort products"
              value={filters.sort}
              onChange={(event) => change({ sort: event.target.value })}
            >
              <option value="featured">Featured order</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="newest">Newest</option>
              <option value="popularity">Most popular</option>
              <option value="rating">Highest rated</option>
            </SelectField>
          </div>
          {page.items.length ? (
            <div className="product-grid">
              {page.items.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  image={images.find((item) => item.id === product.imageIds[0])}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No products found"
              description="Try another category or browse the full collection."
              action={
                <Link className="button button-primary" to="/products">
                  Browse all products
                </Link>
              }
            />
          )}
          <Pagination
            page={page.page}
            total={page.total}
            pageSize={page.pageSize}
            onPage={(value) => change({ page: String(value) }, false)}
          />
        </div>
      </div>
    </section>
  );
}
