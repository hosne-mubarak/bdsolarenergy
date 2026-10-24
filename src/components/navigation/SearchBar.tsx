import { useId, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { useSuggestions } from '../../features/search/useSuggestions';

function SearchInput({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const id = useId();
  const navigate = useNavigate();
  const query = useSuggestions(value);
  const suggestions = query.matchesInput ? (query.data?.items ?? []) : [];
  const expanded = focused && value.trim().length >= 2 && suggestions.length > 0;
  function submit(event: FormEvent) {
    event.preventDefault();
    setFocused(false);
    const selected = expanded && active >= 0 ? suggestions[active] : null;
    navigate(
      selected
        ? `/product/${selected.slug}`
        : value.trim()
          ? `/search?q=${encodeURIComponent(value.trim())}`
          : '/products',
    );
  }
  return (
    <form role="search" className="header-search" onSubmit={submit}>
      <label htmlFor={id} className="sr-only">
        Search products
      </label>
      <input
        id={id}
        type="search"
        className="input"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={expanded ? `${id}-suggestions` : undefined}
        aria-activedescendant={expanded && active >= 0 ? `${id}-option-${active}` : undefined}
        autoComplete="off"
        placeholder="Search products or SKU…"
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => {
          setValue(event.target.value);
          setActive(-1);
          setFocused(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setFocused(false);
            setActive(-1);
          }
          if (event.key === 'ArrowDown' && suggestions.length) {
            event.preventDefault();
            setFocused(true);
            setActive((current) => (current + 1) % suggestions.length);
          }
          if (event.key === 'ArrowUp' && suggestions.length) {
            event.preventDefault();
            setFocused(true);
            setActive((current) => (current - 1 + suggestions.length) % suggestions.length);
          }
        }}
      />
      <button type="submit" className="button button-primary" aria-label="Submit search">
        <Search size={21} aria-hidden="true" />
      </button>
      {focused && query.isError && (
        <p role="status" className="search-suggestions">
          Suggestions unavailable. Submit your search to retry.
        </p>
      )}
      {expanded && (
        <ul
          className="search-suggestions"
          id={`${id}-suggestions`}
          role="listbox"
          aria-label="Product suggestions"
        >
          {suggestions.map((product, index) => (
            <li
              role="option"
              id={`${id}-option-${index}`}
              key={product.id}
              aria-selected={active === index}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setFocused(false);
                navigate(`/product/${product.slug}`);
              }}
            >
              {product.name}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
export function SearchBar() {
  const location = useLocation();
  return (
    <SearchInput
      key={location.key}
      initialValue={new URLSearchParams(location.search).get('q') ?? ''}
    />
  );
}
