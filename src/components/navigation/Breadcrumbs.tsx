import { ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

function readableSegment(segment: string) {
  let label = segment;
  try {
    label = decodeURIComponent(segment);
  } catch {
    /* Keep malformed URL text safely escaped by React. */
  }
  return label.replaceAll('-', ' ').replace(/^./, (character) => character.toUpperCase());
}

export function Breadcrumbs({ items }: { items?: BreadcrumbItem[] }) {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  if (!items && segments.length === 0) return null;
  const crumbs =
    items ??
    segments.map((segment, index) => ({
      label: readableSegment(segment),
      to: index < segments.length - 1 ? `/${segments.slice(0, index + 1).join('/')}` : undefined,
    }));
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <ol>
        <li>
          <Link to="/">Home</Link>
        </li>
        {crumbs.map((crumb, index) => (
          <li key={`${index}-${crumb.label}`}>
            <ChevronRight size={13} aria-hidden="true" />
            {crumb.to ? (
              <Link to={crumb.to}>{crumb.label}</Link>
            ) : (
              <span aria-current="page">{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
