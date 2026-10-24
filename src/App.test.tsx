import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('development scaffold', () => {
  it('renders a semantic application entry and honest demo boundary', async () => {
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: 'Power a brighter tomorrow.', level: 1 }),
    ).toBeVisible();
    expect(screen.getByRole('main')).toBeVisible();
    expect(screen.getAllByText(/nothing is sent to a merchant/).length).toBeGreaterThan(0);
  });
});
