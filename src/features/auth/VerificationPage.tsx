import { Link } from 'react-router';
import { useVerification } from './useRecovery';
import { LoadingState, ErrorState } from '../../components/common/Feedback';
export function VerificationPage() {
  const query = useVerification();
  if (query.isPending) return <LoadingState message="Checking demo verification status…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <section className="auth-page">
      <div className="auth-intro">
        <p className="eyebrow">SIMULATED STATUS</p>
        <h1>Demo email verification</h1>
      </div>
      <div className="auth-card">
        <p role="status">
          {query.data.status === 'guest'
            ? 'Sign in to view your demo verification status.'
            : query.data.status === 'verified'
              ? 'Your demo email is marked verified.'
              : 'Your demo email is unverified.'}
        </p>
        <p className="demo-banner">
          This is a simulated status only. No verification email was sent. Real verification will be
          enforced by the future backend.
        </p>
        <Link
          className="button button-secondary"
          to={query.data.status === 'guest' ? '/login' : '/account'}
        >
          {query.data.status === 'guest' ? 'Sign in' : 'Back to account'}
        </Link>
      </div>
    </section>
  );
}
