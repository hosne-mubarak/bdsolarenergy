import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../app/providers/ToastProvider';
import { RepositoryError } from '../../services/errors';
import { EmptyState, ErrorState, LoadingState } from './Feedback';
import { useToast } from './useToast';

describe('shared asynchronous feedback', () => {
  it('announces a meaningful loading status', () => {
    render(<LoadingState message="Loading catalogue" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading catalogue');
  });

  it('hides arbitrary exception details behind an actionable error', () => {
    render(<ErrorState error={new Error('private transport credentials')} />);
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.queryByText(/private transport credentials/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/');
  });

  it('preserves safe repository feedback and retries the supplied operation', async () => {
    const retry = vi.fn();
    render(
      <ErrorState
        error={new RepositoryError('validation', 'Review your address.')}
        onRetry={retry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Review your address.');
    await userEvent.click(screen.getByRole('button', { name: /try again|retry/i }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('gives an empty state a descriptive title and recovery action', () => {
    render(
      <EmptyState
        title="Your wishlist is empty"
        description="Save products to find them again."
        action={<a href="/products">Browse products</a>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Your wishlist is empty' })).toBeVisible();
    expect(screen.getByText('Save products to find them again.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Browse products' })).toHaveAttribute(
      'href',
      '/products',
    );
  });

  it('announces successful interactions and permits notification dismissal', async () => {
    function Example() {
      const { notify } = useToast();
      return (
        <button type="button" onClick={() => notify('Saved to your wishlist.')}>
          Save product
        </button>
      );
    }
    render(
      <ToastProvider>
        <Example />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save product' }));
    expect(screen.getByRole('status')).toHaveTextContent('Saved to your wishlist.');
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText('Saved to your wishlist.')).not.toBeInTheDocument();
  });
});
