import { useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { loginInputSchema } from '../../schemas';
import type { LoginInput } from '../../types';
import { safeReturnPath } from '../../domain/auth/redirect';
import { Field, PasswordField } from '../../components/forms/Fields';
import { Button } from '../../components/common/primitives';
import { useDemoAccess } from './useAuth';
import { useLogin } from './useLogin';

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mutation = useLogin();
  const submitting = useRef(false);
  const demo = useDemoAccess();
  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof loginInputSchema>, unknown, LoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: '', password: '', remember: false },
  });
  return (
    <section className="auth-page">
      <div className="auth-intro">
        <p className="eyebrow">WELCOME BACK</p>
        <h1>Sign in to your account</h1>
        <p>Keep your projects, saved products and demo orders in one place.</p>
      </div>
      <div className="auth-card">
        <p className="demo-banner">
          Demo authentication only. Use sample details; this is not secure production
          authentication.
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
              } catch {
                /* Safe error rendered below. */
              } finally {
                resetField('password', { defaultValue: '' });
                submitting.current = false;
              }
            })(event);
          }}
        >
          <Field
            id="login-email"
            label="Email address"
            type="email"
            autoComplete="username"
            {...register('email')}
            error={errors.email?.message}
          />
          <PasswordField
            id="login-password"
            label="Password"
            autoComplete="current-password"
            {...register('password')}
            error={errors.password?.message}
          />
          <div className="form-between">
            <label className="checkbox-label">
              <input type="checkbox" {...register('remember')} />
              Remember me
            </label>
            <Link to="/forgot-password" className="text-action">
              Forgot password?
            </Link>
          </div>
          {mutation.isError && (
            <p role="alert" className="field-error">
              {mutation.error.message}
            </p>
          )}
          <Button type="submit" disabled={mutation.isPending || isSubmitting}>
            {mutation.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="auth-switch">
          New here?{' '}
          <Link
            to={`/register${params.get('returnTo') ? `?returnTo=${encodeURIComponent(params.get('returnTo')!)}` : ''}`}
            className="text-action"
          >
            Create a demo account
          </Link>
        </p>
        {demo.data && (
          <aside className="demo-access">
            <strong>Try the public demo</strong>
            <p>
              Email: <code>{demo.data.email}</code>
            </p>
            <p>
              Passphrase: <code>{demo.data.passphrase}</code>
            </p>
          </aside>
        )}
      </div>
    </section>
  );
}
