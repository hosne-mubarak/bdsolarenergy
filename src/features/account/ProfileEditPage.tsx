import { Link, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { User, ProfileInput } from '../../types';
import { profileInputSchema } from '../../schemas';
import { useProfile, useProfileUpdate } from './useAccount';
import { Field } from '../../components/forms/Fields';
import { Button } from '../../components/common/primitives';
import { ErrorState, LoadingState } from '../../components/common/Feedback';
import { useToast } from '../../components/common/useToast';
function ProfileForm({ user }: { user: User }) {
  const mutation = useProfileUpdate();
  const navigate = useNavigate();
  const { notify } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileInputSchema),
    defaultValues: { displayName: user.displayName, phone: user.phone },
  });
  return (
    <section>
      <div className="page-heading">
        <h1>Edit profile</h1>
        <p>
          Email is read-only in this demo. Real email changes will require backend verification.
        </p>
      </div>
      <form
        className="profile-form"
        noValidate
        onSubmit={handleSubmit(async (input) => {
          try {
            await mutation.mutateAsync(input);
            notify('Profile updated');
            await navigate('/account/profile');
          } catch {
            /* Safe error below. */
          }
        })}
      >
        <Field
          id="profile-name"
          label="Full name"
          {...register('displayName')}
          autoComplete="name"
          error={errors.displayName?.message}
        />
        <Field
          id="profile-phone"
          label="Phone number"
          type="tel"
          {...register('phone')}
          autoComplete="tel"
          error={errors.phone?.message}
        />
        <Field id="profile-email" label="Email address" type="email" readOnly value={user.email} />
        {mutation.isError && (
          <p role="alert" className="field-error">
            {mutation.error.message}
          </p>
        )}
        <div className="action-row">
          <Button type="submit" disabled={mutation.isPending || isSubmitting}>
            Save profile
          </Button>
          <Link className="button button-secondary" to="/account/profile">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
export function ProfileEditPage() {
  const query = useProfile();
  if (query.isPending) return <LoadingState message="Loading profile…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return <ProfileForm key={query.data.id} user={query.data} />;
}
