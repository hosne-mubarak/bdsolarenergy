import { useEffect, useRef, type FormEvent } from 'react';
import type { Brand, ProductQuery } from '../../types';
import { Button } from '../common/primitives';
import { Field, SelectField } from '../forms/Fields';

export function ProductFilters({
  query,
  brands,
  onChange,
  onClear,
}: {
  query: ProductQuery;
  brands: Brand[];
  onChange: (values: Record<string, string | string[]>) => void;
  onClear: () => void;
}) {
  const priceForm = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const minimum = priceForm.current?.elements.namedItem('min');
    const maximum = priceForm.current?.elements.namedItem('max');
    if (minimum instanceof HTMLInputElement)
      minimum.value = query.minimumPrice === undefined ? '' : String(query.minimumPrice / 100);
    if (maximum instanceof HTMLInputElement)
      maximum.value = query.maximumPrice === undefined ? '' : String(query.maximumPrice / 100);
  }, [query.minimumPrice, query.maximumPrice]);
  function prices(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onChange({ min: String(form.get('min') ?? ''), max: String(form.get('max') ?? '') });
  }
  return (
    <aside className="product-filters">
      <h2>Refine results</h2>
      <fieldset>
        <legend>Brands</legend>
        {brands.map((brand) => (
          <label key={brand.id} className="checkbox-label">
            <input
              type="checkbox"
              checked={query.brandIds.includes(brand.id)}
              onChange={(event) =>
                onChange({
                  brand: event.target.checked
                    ? [...query.brandIds, brand.id]
                    : query.brandIds.filter((id) => id !== brand.id),
                })
              }
            />
            {brand.name}
          </label>
        ))}
      </fieldset>
      <form ref={priceForm} onSubmit={prices}>
        <h3>Price range</h3>
        <Field
          id="minimum-price"
          label="Minimum price (৳)"
          name="min"
          type="number"
          min="0"
          step="0.01"
          defaultValue={query.minimumPrice === undefined ? '' : query.minimumPrice / 100}
        />
        <Field
          id="maximum-price"
          label="Maximum price (৳)"
          name="max"
          type="number"
          min="0"
          step="0.01"
          defaultValue={query.maximumPrice === undefined ? '' : query.maximumPrice / 100}
        />
        <Button type="submit" variant="secondary">
          Apply price range
        </Button>
      </form>
      <SelectField
        id="stock-filter"
        label="Availability"
        value={query.availability}
        onChange={(event) => onChange({ stock: event.target.value })}
      >
        <option value="all">All availability</option>
        <option value="in_stock">In stock</option>
        <option value="out_of_stock">Out of stock</option>
      </SelectField>
      <Button variant="secondary" onClick={onClear}>
        Clear filters
      </Button>
    </aside>
  );
}
