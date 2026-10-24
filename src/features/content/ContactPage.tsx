import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useContentPage } from './useContentPage';
import { useSiteSettings } from '../store/useStore';
import { Field } from '../../components/forms/Fields';
import { Button } from '../../components/common/primitives';
import { ErrorState, LoadingState } from '../../components/common/Feedback';
const inquirySchema = z.object({
  name: z.string().trim().min(2, 'Enter at least 2 characters.').max(100),
  email: z.string().trim().email('Enter a valid email address.').max(254),
  subject: z.string().trim().min(3, 'Enter at least 3 characters.').max(120),
  message: z.string().trim().min(10, 'Enter a message of at least 10 characters.').max(3000),
});
export function ContactPage() {
  const page = useContentPage('contact');
  const settings = useSiteSettings();
  const [validated, setValidated] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof inquirySchema>>({
    resolver: zodResolver(inquirySchema),
    defaultValues: { name: '', email: '', subject: '', message: '' },
  });
  if (page.isPending || settings.isPending)
    return <LoadingState message="Loading contact information…" />;
  const error = page.error ?? settings.error;
  if (error)
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          void page.refetch();
          void settings.refetch();
        }}
      />
    );
  return (
    <section className="content-page">
      <div className="page-heading">
        <p className="eyebrow">Contact</p>
        <h1>{page.data!.title}</h1>
      </div>
      {page.data!.sections.map((section) => (
        <p key={section.heading}>{section.body}</p>
      ))}
      <p className="demo-notice">
        These contact details are samples. This demo form validates input locally and does not send
        or save your message. Use invented information.
      </p>
      <address>
        <p>{settings.data!.contact.address}</p>
        <p>
          <a href={`mailto:${settings.data!.contact.email}`}>{settings.data!.contact.email}</a> ·{' '}
          <a href={`tel:${settings.data!.contact.phone}`}>{settings.data!.contact.phone}</a>
        </p>
      </address>
      <form
        className="profile-form"
        noValidate
        onChange={() => setValidated(false)}
        onSubmit={handleSubmit(() => setValidated(true))}
      >
        <Field
          id="inquiry-name"
          label="Full name"
          autoComplete="name"
          {...register('name')}
          error={errors.name?.message}
        />
        <Field
          id="inquiry-email"
          label="Email address"
          type="email"
          autoComplete="email"
          {...register('email')}
          error={errors.email?.message}
        />
        <Field
          id="inquiry-subject"
          label="Subject"
          {...register('subject')}
          error={errors.subject?.message}
        />
        <div className="field">
          <label htmlFor="inquiry-message">Message</label>
          <textarea
            className="input"
            id="inquiry-message"
            rows={6}
            {...register('message')}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? 'inquiry-message-error' : undefined}
          />
          {errors.message && (
            <p id="inquiry-message-error" className="field-error">
              {errors.message.message}
            </p>
          )}
        </div>
        {validated && <p role="status">Demo inquiry validated. Your message was not sent.</p>}
        <Button type="submit">Preview demo inquiry</Button>
      </form>
    </section>
  );
}
