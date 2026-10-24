import { Link, useRevalidator } from 'react-router';

export function RouteErrorBoundary() {
  const revalidator = useRevalidator();
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">Unable to open this page</h1>
      <p role="alert" className="mt-4">
        Please retry or return home.
      </p>
      <div className="mt-6 flex gap-6">
        <button
          type="button"
          disabled={revalidator.state === 'loading'}
          onClick={() => void revalidator.revalidate()}
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          Try again
        </button>
        <Link to="/" className="self-center underline">
          Return home
        </Link>
      </div>
    </main>
  );
}
