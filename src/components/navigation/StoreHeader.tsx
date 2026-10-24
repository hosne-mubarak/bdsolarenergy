import { useState } from 'react';
import { Heart, Menu, ShoppingCart, Sun, UserRound, ChevronDown, Phone } from 'lucide-react';
import { Link, NavLink } from 'react-router';
import { useCategories, useNavigation, useSiteSettings } from '../../features/store/useStore';
import type { Category } from '../../types';
import { useAuth } from '../../features/auth/useAuth';
import { useWishlist } from '../../features/wishlist/useWishlist';
import { useCart } from '../../features/cart/useCart';
import { SearchBar } from './SearchBar';
import { Button, Dialog } from '../common/primitives';

function categoryPath(category: Category, categories: Category[]) {
  const parent = categories.find((record) => record.id === category.parentId);
  return parent ? `/category/${parent.slug}/${category.slug}` : `/category/${category.slug}`;
}

export function StoreHeader() {
  const settings = useSiteSettings();
  const auth = useAuth();
  const cart = useCart();
  const wishlist = useWishlist();
  const cartCount = cart.data?.lines.reduce((total, line) => total + line.quantity, 0) ?? 0;
  const navigation = useNavigation();
  const categories = useCategories();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [...(navigation.data ?? [])]
    .filter((item) => !item.parentId)
    .sort((a, b) => a.order - b.order);
  const categoryRecords = [...(categories.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <header className="store-header">
      <div className="topbar">
        <div className="container">
          <span>Demo storefront · Sample catalogue</span>
          {settings.data && (
            <a href={`tel:${settings.data.contact.phone}`}>
              <Phone size={13} aria-hidden="true" />
              {settings.data.contact.phone}
            </a>
          )}
        </div>
      </div>
      <div className="container header-main">
        <Button
          variant="secondary"
          className="mobile-menu-button"
          aria-label="Open navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={22} aria-hidden="true" />
        </Button>
        <Link to="/" className="brand" aria-label={`${settings.data?.name ?? 'Storefront'} home`}>
          <span className="brand-mark">
            <Sun size={30} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="brand-wordmark">{settings.data?.name ?? 'Storefront'}</span>
        </Link>
        <SearchBar />
        <div className="header-actions">
          <Link
            to="/wishlist"
            className="header-action"
            aria-label={`Wishlist${wishlist.isError ? ' (unavailable)' : wishlist.data ? ` (${wishlist.data.productIds.length} items)` : ''}`}
          >
            <Heart size={22} aria-hidden="true" />
            <span>Wishlist</span>
          </Link>
          <Link to="/account" className="header-action" aria-label="Account">
            <UserRound size={22} aria-hidden="true" />
            <span>Account</span>
          </Link>
          <Link
            to="/cart"
            className="header-action"
            aria-label={`Shopping cart${cart.isError ? ' (unavailable)' : cart.data ? ` (${cartCount} items)` : ''}`}
          >
            <ShoppingCart size={22} aria-hidden="true" />
            <span>Cart{cartCount > 0 ? ` (${cartCount})` : ''}</span>
          </Link>
        </div>
      </div>
      <nav aria-label="Main navigation" className="container desktop-nav">
        <details
          className="category-dropdown"
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.currentTarget.removeAttribute('open');
            event.currentTarget.querySelector('summary')?.focus();
          }}
        >
          <summary>
            <Menu size={18} aria-hidden="true" />
            Browse categories
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
          <ul className="category-links">
            {categoryRecords.map((category) => (
              <li key={category.id}>
                <Link
                  to={categoryPath(category, categoryRecords)}
                  onClick={(event) =>
                    event.currentTarget.closest('details')?.removeAttribute('open')
                  }
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
        {links.map((item) => (
          <NavLink key={item.id} to={item.path}>
            {item.label}
          </NavLink>
        ))}
        {auth.data && <NavLink to="/logout">Sign out</NavLink>}
        {navigation.isPending && <span role="status">Loading navigation…</span>}
        {(navigation.isError || categories.isError) && (
          <button
            type="button"
            onClick={() => {
              void navigation.refetch();
              void categories.refetch();
            }}
          >
            Retry navigation
          </button>
        )}
      </nav>
      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title="Navigation">
        <nav aria-label="Mobile navigation" className="mobile-menu-links">
          {links.map((item) => (
            <NavLink key={item.id} to={item.path} onClick={() => setMenuOpen(false)}>
              {item.label}
            </NavLink>
          ))}
          <h3>Categories</h3>
          {categoryRecords
            .filter((category) => category.parentId)
            .map((category) => (
              <Link
                key={category.id}
                to={categoryPath(category, categoryRecords)}
                onClick={() => setMenuOpen(false)}
              >
                {category.name}
              </Link>
            ))}
          <Link to="/wishlist" onClick={() => setMenuOpen(false)}>
            Wishlist
          </Link>
          <Link to="/account" onClick={() => setMenuOpen(false)}>
            Account
          </Link>
          <Link to="/cart" onClick={() => setMenuOpen(false)}>
            Shopping cart
          </Link>
          {auth.data && (
            <Link to="/logout" onClick={() => setMenuOpen(false)}>
              Sign out
            </Link>
          )}
          {(navigation.isError || categories.isError) && (
            <div>
              <p role="alert">
                Navigation is unavailable. Retry to load shopping links and categories.
              </p>
              <Button
                variant="secondary"
                disabled={navigation.isFetching || categories.isFetching}
                onClick={() => {
                  void navigation.refetch();
                  void categories.refetch();
                }}
              >
                Retry navigation
              </Button>
            </div>
          )}
        </nav>
      </Dialog>
    </header>
  );
}
