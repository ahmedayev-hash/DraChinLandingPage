import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CtaButton } from './CtaButton';

describe('CtaButton', () => {
  it('menampilkan label sebagai accessible name', () => {
    render(<CtaButton label="TONTON SEKARANG" onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: /TONTON SEKARANG/ })).toBeInTheDocument();
  });

  it('memanggil onClick saat diklik', async () => {
    const onClick = vi.fn();
    render(<CtaButton label="TONTON" onClick={onClick} />);

    await userEvent.click(screen.getByRole('button', { name: /TONTON/ }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
