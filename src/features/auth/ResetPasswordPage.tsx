import { useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordInputSchema } from '../../schemas';
import type { ResetPasswordInput } from '../../types';
import { Button } from '../../components/common/primitives';
import { EmptyState } from '../../components/common/Feedback';
import { PasswordField } from '../../components/forms/Fields';
import { useResetPassword } from './useRecovery';
function ResetPasswordForm({ intent }: { intent: string }) {
  const mutation = useResetPassword();
  const busy = useRef(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordInputSchema),
    defaultValues: { intentId: intent, password: '', confirmPassword: '' },
  });
  return (
    <section className="auth-page">
      <div className="auth-intro">
        <p className="eyebrow">DEMO PASSWORD RESET</p>
        <h1>Choose a new demo password</h1>
      </div>
      <div className="auth-card">
        <p className="demo-banner">
          Local demonstration only. No email is sent and no production password is changed.
        </p>
        {mutation.isSuccess ? (
          <div>
            <p role="status">Demo password updated. Please sign in with your new password.</p>
            <Link className="button button-primary" to="/login">
              Sign in
            </Link>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={(event) => {
              void handleSubmit(async (input) => {
                if (busy.current) return;
                busy.current = true;
                try {
                  await mutation.mutateAsync(input);
                } catch {
                  /* Error rendered. */
                } finally {
                  reset({ intentId: intent, password: '', confirmPassword: '' });
                  busy.current = false;
                }
              })(event);
            }}
          >
            <input type="hidden" {...register('intentId')} />
            <PasswordField
              id="reset-password"
              label="New password"
              autoComplete="new-password"
              {...register('password')}
              error={errors.password?.message}
            />
            <PasswordField
              id="reset-confirm"
              label="Confirm password"
              autoComplete="new-password"
              {...register('confirmPassword')}
              error={errors.confirmPassword?.message}
            />
            {mutation.isError && (
              <p role="alert" className="field-error">
                {mutation.error.message}
              </p>
            )}
            <Button type="submit" disabled={mutation.isPending || isSubmitting}>
              Update demo password
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const intent = params.get('intent');
  return intent ? (
    <ResetPasswordForm key={intent} intent={intent} />
  ) : (
    <EmptyState
      title="Demo reset link required"
      description="Start a simulated recovery request to create a temporary local reset action."
      action={
        <Link className="button button-primary" to="/forgot-password">
          Request a demo reset
        </Link>
      }
    />
  );
}
