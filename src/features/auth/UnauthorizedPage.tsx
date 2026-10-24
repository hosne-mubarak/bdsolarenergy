import { Link } from 'react-router';
import { EmptyState } from '../../components/common/Feedback';
export function UnauthorizedPage() {
  return (
    <EmptyState
      title="Access unavailable"
      description="Sign in with the demo account that owns this information."
      action={
        <Link className="button button-primary" to="/login">
          Sign in
        </Link>
      }
    />
  );
}
