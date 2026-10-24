import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetRequestInputSchema } from '../../schemas';
import { Button } from '../../components/common/primitives';
import { Field } from '../../components/forms/Fields';
import { useResetRequest } from './useRecovery';
import { useDemoAccess } from './useAuth';

export function ForgotPasswordPage() {
  const mutation = useResetRequest();
  const demo = useDemoAccess();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({
    resolver: zodResolver(resetRequestInputSchema),
    defaultValues: { email: '' },
  });
  return (
    <section className="auth-page">
      <div className="auth-intro">
        <p className="eyebrow">LOCAL DEMO RECOVERY</p>
        <h1>Forgot your password?</h1>
        <p>No email will be sent. This demonstrates recovery for local demo accounts.</p>
      </div>
      <div className="auth-card">
        {mutation.isSuccess ? (
          <div>
            <p role="status">{mutation.data.message}</p>
            {demo.data && (
              <Link
                className="button button-primary"
                to={`/reset-password?intent=${encodeURIComponent(mutation.data.demoIntentId)}`}
              >
                Open demo reset
              </Link>
            )}
          </div>
        ) : (
          <form
            noValidate
            onSubmit={handleSubmit(async (input) => {
              try {
                await mutation.mutateAsync(input.email);
              } catch {
                /* Safe error below. */
              }
            })}
          >
            <Field
              id="recovery-email"
              label="Email address"
              type="email"
              autoComplete="email"
              {...register('email')}
              error={errors.email?.message}
            />
            {mutation.isError && (
              <p role="alert" className="field-error">
                {mutation.error.message}
              </p>
            )}
            <Button type="submit" disabled={mutation.isPending || isSubmitting}>
              Simulate reset request
            </Button>
          </form>
        )}
        <p className="auth-switch">
          <Link className="text-action" to="/login">
            Back to sign in
          </Link>
        </p>
      </div>
    </section>
  );
}
