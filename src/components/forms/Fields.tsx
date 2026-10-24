import { useState, type ComponentPropsWithRef, type SelectHTMLAttributes } from 'react';

type FieldProps = ComponentPropsWithRef<'input'> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
};
export function Field({ id, label, error, hint, className = '', ...props }: FieldProps) {
  const describedBy =
    [hint ? `${id}-hint` : '', error ? `${id}-error` : '', props['aria-describedby'] ?? '']
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      <input
        {...props}
        id={id}
        className={`input ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function SelectField({
  id,
  label,
  error,
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { id: string; label: string; error?: string }) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <select
        {...props}
        id={id}
        className={`input ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        {children}
      </select>
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function PasswordField(props: Omit<FieldProps, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <Field {...props} type={visible ? 'text' : 'password'} />
      <button
        className="text-action"
        type="button"
        aria-label={`${visible ? 'Hide' : 'Show'} ${props.label.toLowerCase()}`}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
