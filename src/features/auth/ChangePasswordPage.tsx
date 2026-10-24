import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordInputSchema } from '../../schemas';
import type { ChangePasswordInput } from '../../types';
import { Button } from '../../components/common/primitives';
import { PasswordField } from '../../components/forms/Fields';
import { useChangePassword } from './useRecovery';
export function ChangePasswordPage() {
  const mutation = useChangePassword();
  const busy = useRef(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordInputSchema),
    defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
  });
  return (
    <section className="auth-page">
      <div className="auth-intro">
        <p className="eyebrow">ACCOUNT DEMONSTRATION</p>
        <h1>Change demo password</h1>
      </div>
      <div className="auth-card">
        <p className="demo-banner">This updates only your browser-controlled demo verifier.</p>
        {mutation.isSuccess && (
          <p role="status" className="coupon-success">
            Demo password updated.
          </p>
        )}
        <form
          noValidate
          onSubmit={(event) => {
            void handleSubmit(async (input) => {
              if (busy.current) return;
              busy.current = true;
              try {
                await mutation.mutateAsync(input);
              } catch {
                /* Safe error below. */
              } finally {
                reset();
                busy.current = false;
              }
            })(event);
          }}
        >
          <PasswordField
            id="current-password"
            label="Current password"
            autoComplete="current-password"
            {...register('currentPassword')}
            error={errors.currentPassword?.message}
          />
          <PasswordField
            id="new-password"
            label="New password"
            autoComplete="new-password"
            {...register('password')}
            error={errors.password?.message}
          />
          <PasswordField
            id="new-confirm"
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
      </div>
    </section>
  );
}
