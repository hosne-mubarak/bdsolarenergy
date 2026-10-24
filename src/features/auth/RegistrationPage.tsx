import { useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { registerInputSchema } from '../../schemas';
import type { RegisterInput } from '../../types';
import { safeReturnPath } from '../../domain/auth/redirect';
import { RepositoryError } from '../../services/errors';
import { Field, PasswordField } from '../../components/forms/Fields';
import { Button } from '../../components/common/primitives';
import { useRegister } from './useRegister';

export function RegistrationPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mutation = useRegister();
  const submitting = useRef(false);
  const {
    register,
    handleSubmit,
    resetField,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof registerInputSchema>, unknown, RegisterInput>({
    resolver: zodResolver(registerInputSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });
  useEffect(
    () => () => {
      resetField('password', { defaultValue: '' });
      resetField('confirmPassword', { defaultValue: '' });
    },
    [resetField],
  );
  return (
    <section className="auth-page">
      <div className="auth-intro">
        <p className="eyebrow">START YOUR NEXT PROJECT</p>
        <h1>Create your demo account</h1>
        <p>Save products, addresses and simulated orders in this browser.</p>
      </div>
      <div className="auth-card">
        <p className="demo-banner">
          Local demo only. Use sample details and a password you do not use elsewhere. Browser-based
          authentication is not secure production authentication.
        </p>
        <form
          noValidate
          aria-busy={mutation.isPending || isSubmitting}
          onSubmit={(event) => {
            void handleSubmit(async (input) => {
              if (submitting.current) return;
              submitting.current = true;
              try {
                await mutation.mutateAsync(input);
                navigate(safeReturnPath(params.get('returnTo')), { replace: true });
              } catch (error) {
                if (error instanceof RepositoryError && error.fieldErrors?.email?.[0]) {
                  setError('email', { type: 'server', message: error.fieldErrors.email[0] });
                }
              } finally {
                resetField('password', { defaultValue: '' });
                resetField('confirmPassword', { defaultValue: '' });
                submitting.current = false;
              }
            })(event);
          }}
        >
          <Field
            id="register-name"
            label="Full name"
            autoComplete="name"
            {...register('displayName')}
            error={errors.displayName?.message}
          />
          <Field
            id="register-email"
            label="Email address"
            type="email"
            autoComplete="username"
            {...register('email')}
            error={errors.email?.message}
          />
          <PasswordField
            id="register-password"
            label="Password"
            autoComplete="new-password"
            {...register('password')}
            error={errors.password?.message}
          />
          <PasswordField
            id="register-confirm-password"
            label="Confirm password"
            autoComplete="new-password"
            {...register('confirmPassword')}
            error={errors.confirmPassword?.message}
          />
          <div className="form-field">
            <label className="checkbox-label" htmlFor="register-terms">
              <input
                id="register-terms"
                type="checkbox"
                {...register('acceptTerms')}
                aria-invalid={errors.acceptTerms ? true : undefined}
                aria-describedby={errors.acceptTerms ? 'register-terms-error' : undefined}
              />
              I agree to the terms
            </label>
            <Link to="/terms" className="text-action">
              Read terms and conditions
            </Link>
            {errors.acceptTerms && (
              <p id="register-terms-error" role="alert" className="field-error">
                {errors.acceptTerms.message}
              </p>
            )}
          </div>
          {mutation.isError && (
            <p role="alert" className="field-error">
              {mutation.error instanceof RepositoryError
                ? mutation.error.message
                : 'We could not create this demo account. Please try again.'}
            </p>
          )}
          <Button type="submit" disabled={mutation.isPending || isSubmitting}>
            {mutation.isPending ? 'Creating account…' : 'Create demo account'}
          </Button>
        </form>
        <p className="auth-switch">
          Already have an account?{' '}
          <Link
            to={`/login${params.get('returnTo') ? `?returnTo=${encodeURIComponent(safeReturnPath(params.get('returnTo')))}` : ''}`}
            className="text-action"
          >
            Sign in
          </Link>
        </p>
      </div>
    </section>
  );
}
