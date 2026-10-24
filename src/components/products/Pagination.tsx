import { Button } from '../common/primitives';
export function Pagination({
  label = 'Product pagination',
  page,
  total,
  pageSize,
  onPage,
}: {
  label?: string;
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const count = Math.max(1, Math.ceil(total / pageSize));
  if (count === 1) return null;
  return (
    <nav className="pagination" aria-label={label}>
      <Button variant="secondary" disabled={page === 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span aria-live="polite">
        Page {page} of {count}
      </span>
      <Button variant="secondary" disabled={page === count} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </nav>
  );
}
