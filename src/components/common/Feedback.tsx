import type { ReactNode } from 'react';
import { RepositoryError } from '../../services/errors';
import { Button } from './primitives';

export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="loading-state" role="status">
      <p>{message}</p>
      <div className="skeleton" aria-hidden="true" />
    </div>
  );
}
export function ErrorState({
  error,
  onRetry,
  resource,
}: {
  error?: unknown;
  onRetry?: () => void;
  resource?: string;
}) {
  const message =
    error instanceof RepositoryError
      ? error.message
      : 'We could not load this information. Please try again.';
  return (
    <section className="state-panel">
      <h2>
        {error instanceof RepositoryError && error.code === 'not_found'
          ? `${resource ?? 'Record'} not found`
          : resource
            ? `${resource} needs attention`
            : 'Something needs attention'}
      </h2>
      <p role="alert">{message}</p>
      <div className="action-row">
        {onRetry && <Button onClick={onRetry}>Try again</Button>}
        <a href="/" className="text-action">
          Return home
        </a>
      </div>
    </section>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <section className="state-panel">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </section>
  );
}
