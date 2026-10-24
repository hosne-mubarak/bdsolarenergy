import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import type { z } from 'zod';
import { addressInputSchema } from '../../schemas';
import type { AddressInput } from '../../types';
import { normalizeRepositoryError } from '../../services/errors';
import { Field } from './Fields';
import { Button } from '../common/primitives';
export function AddressForm({
  defaultValues,
  onSubmit,
  pending = false,
  error,
  submitLabel = 'Save address',
  cancel,
  showDefault = true,
  onDraftChange,
}: {
  defaultValues?: AddressInput;
  onSubmit: (input: AddressInput) => Promise<void>;
  pending?: boolean;
  error?: unknown;
  submitLabel?: string;
  cancel?: React.ReactNode;
  showDefault?: boolean;
  onDraftChange?: () => void;
}) {
  const prefix = useId();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof addressInputSchema>, unknown, AddressInput>({
    resolver: zodResolver(addressInputSchema),
    defaultValues: defaultValues ?? {
      recipient: '',
      phone: '',
      division: '',
      district: '',
      area: '',
      street: '',
      postcode: '',
      isDefault: false,
    },
  });
  return (
    <form
      className="address-form"
      noValidate
      onChange={onDraftChange}
      onSubmit={handleSubmit(async (input) => {
        try {
          await onSubmit(input);
        } catch {
          /* Parent mutation displays a safe error. */
        }
      })}
    >
      <div className="form-grid">
        <Field
          id={`${prefix}-recipient`}
          label="Recipient name"
          autoComplete="shipping name"
          {...register('recipient')}
          error={errors.recipient?.message}
        />
        <Field
          id={`${prefix}-phone`}
          label="Phone number"
          type="tel"
          autoComplete="shipping tel"
          {...register('phone')}
          error={errors.phone?.message}
        />
        <Field
          id={`${prefix}-division`}
          label="Division"
          autoComplete="shipping address-level1"
          {...register('division')}
          error={errors.division?.message}
        />
        <Field
          id={`${prefix}-district`}
          label="District"
          autoComplete="shipping address-level2"
          {...register('district')}
          error={errors.district?.message}
        />
        <Field
          id={`${prefix}-area`}
          label="Area"
          autoComplete="shipping address-level3"
          {...register('area')}
          error={errors.area?.message}
        />
        <Field
          id={`${prefix}-postcode`}
          label="Postal code"
          hint="Optional four-digit code"
          autoComplete="shipping postal-code"
          {...register('postcode')}
          error={errors.postcode?.message}
        />
      </div>
      <Field
        id={`${prefix}-street`}
        label="Street address"
        autoComplete="shipping street-address"
        {...register('street')}
        error={errors.street?.message}
      />
      {showDefault && (
        <label className="checkbox-label">
          <input type="checkbox" {...register('isDefault')} />
          Make this my default address
        </label>
      )}
      {Boolean(error) && (
        <p role="alert" className="field-error">
          {normalizeRepositoryError(error).message}
        </p>
      )}
      <div className="action-row">
        <Button type="submit" disabled={pending || isSubmitting}>
          {submitLabel}
        </Button>
        {cancel}
      </div>
    </form>
  );
}
