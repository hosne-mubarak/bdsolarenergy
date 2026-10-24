import { useState } from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, Dialog } from './primitives';
import { Field, PasswordField, SelectField } from '../forms/Fields';

describe('accessible design primitives', () => {
  it('retains native disabled behavior and accessible names', async () => {
    const action = vi.fn();
    render(
      <Button disabled onClick={action}>
        Place demo order
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Place demo order' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(action).not.toHaveBeenCalled();
  });

  it('associates input labels, hints and validation errors', () => {
    render(
      <Field
        id="email"
        label="Email address"
        hint="Use your demo email."
        error="Enter a valid address."
      />,
    );
    const input = screen.getByLabelText('Email address');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(/Use your demo email/);
    expect(input).toHaveAccessibleDescription(/Enter a valid address/);
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(
      screen.getByText('Enter a valid address.').id,
    );
  });

  it('uses native selects with labels and controlled change events', async () => {
    render(
      <SelectField id="delivery" label="Delivery zone" defaultValue="dhaka">
        <option value="dhaka">Dhaka</option>
        <option value="outside">Outside Dhaka</option>
      </SelectField>,
    );
    const select = screen.getByRole('combobox', { name: 'Delivery zone' });
    await userEvent.selectOptions(select, 'outside');
    expect(select).toHaveValue('outside');
  });

  it('toggles password visibility without losing the typed value', async () => {
    render(<PasswordField id="password" label="Password" autoComplete="current-password" />);
    const input = screen.getByLabelText('Password');
    await userEvent.type(input, 'demo-passphrase');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('demo-passphrase');
    await userEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('enters a labeled modal, cycles focus and returns it after Escape', async () => {
    function Example() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Open confirmation</Button>
          <Dialog open={open} onClose={() => setOpen(false)} title="Confirm reset">
            <p>Only demo data will be reset.</p>
            <Button onClick={() => setOpen(false)}>Cancel reset</Button>
            <Button variant="danger">Confirm reset</Button>
          </Dialog>
        </>
      );
    }
    render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Open confirmation' });
    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Confirm reset' });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    const buttons = within(dialog).getAllByRole('button');
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    last.focus();
    await userEvent.tab();
    expect(first).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(last).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
