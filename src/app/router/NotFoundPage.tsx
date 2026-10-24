import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <>
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-4">This address does not match an available page.</p>
      <Link to="/" className="mt-4 underline">
        Return home
      </Link>
      <Link to="/products" className="button button-secondary">
        Browse products
      </Link>
    </>
  );
}
