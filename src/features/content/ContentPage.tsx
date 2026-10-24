import { useLocation, Link } from 'react-router';
import { useContentPage } from './useContentPage';
import { ErrorState, LoadingState } from '../../components/common/Feedback';
export function ContentPage() {
  const { pathname } = useLocation();
  const query = useContentPage(pathname.replace(/^\/+|\/+$/g, ''));
  if (query.isPending) return <LoadingState message="Loading store information…" />;
  if (query.isError)
    return (
      <ErrorState
        resource="Store information"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  const page = query.data;
  return (
    <article className="content-page">
      <div className="page-heading">
        <p className="eyebrow">Store information</p>
        <h1>{page.title}</h1>
        <p>
          Updated{' '}
          <time dateTime={page.updatedAt}>
            {new Intl.DateTimeFormat('en-BD', { dateStyle: 'long', timeZone: 'Asia/Dhaka' }).format(
              new Date(page.updatedAt),
            )}
          </time>
        </p>
      </div>
      <p className="demo-notice">
        Sample / draft content. Store owner and legal review are required before production
        publication.
      </p>
      {page.sections.map((section, index) => (
        <section key={`${section.heading}-${index}`}>
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
        </section>
      ))}
      {page.faqs.length > 0 && (
        <section aria-label="Frequently asked questions">
          {page.faqs.map((faq) => (
            <details className="faq-disclosure" key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </section>
      )}
      <Link className="button button-secondary" to="/contact">
        Contact and demo inquiry
      </Link>
    </article>
  );
}
