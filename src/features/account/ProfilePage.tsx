import { Link } from 'react-router';
import { useProfile } from './useAccount';
import { ErrorState, LoadingState } from '../../components/common/Feedback';
export function ProfilePage() {
  const query = useProfile();
  if (query.isPending) return <LoadingState message="Loading profile…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <section>
      <div className="page-heading">
        <p className="eyebrow">ACCOUNT DETAILS</p>
        <h1>Your profile</h1>
      </div>
      <dl className="specifications">
        <div>
          <dt>Full name</dt>
          <dd>{query.data.displayName}</dd>
        </div>
        <div>
          <dt>Email address</dt>
          <dd>{query.data.email}</dd>
        </div>
        <div>
          <dt>Phone number</dt>
          <dd>{query.data.phone || 'Not provided'}</dd>
        </div>
        <div>
          <dt>Verification</dt>
          <dd>{query.data.verified ? 'Verified demo identity' : 'Unverified demo identity'}</dd>
        </div>
      </dl>
      <div className="action-row">
        <Link className="button button-primary" to="/account/profile/edit">
          Edit profile
        </Link>
        <Link className="button button-secondary" to="/verify-email">
          View verification status
        </Link>
      </div>
    </section>
  );
}
