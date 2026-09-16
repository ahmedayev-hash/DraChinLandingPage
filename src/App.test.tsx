import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import * as redirect from './lib/redirect';

function stubConfigFetch(payload: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => payload })),
  );
}

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('menampilkan CTA dengan teks dari config', async () => {
    stubConfigFetch({ ctaText: 'KLIK DISINI', links: ['https://ok.example'] });

    render(<App />);

    expect(
      await screen.findByRole('button', { name: /KLIK DISINI/ }),
    ).toBeInTheDocument();
  });

  it('membuka link yang benar saat CTA diklik', async () => {
    stubConfigFetch({ ctaText: 'KLIK DISINI', links: ['https://s.shopee.co.id/abc'] });
    const spy = vi.spyOn(redirect, 'openAffiliate').mockImplementation(() => {});

    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: /KLIK DISINI/ }));

    expect(spy).toHaveBeenCalledWith('https://s.shopee.co.id/abc');
  });

  it('tetap menampilkan CTA saat config gagal dimuat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );

    render(<App />);

    expect(await screen.findByRole('button')).toBeInTheDocument();
  });

  it('menyembunyikan poster dan tetap menampilkan CTA saat gambar gagal', async () => {
    stubConfigFetch({
      ctaText: 'KLIK',
      links: ['https://ok.example'],
      poster: './rusak.jpg',
    });

    render(<App />);

    const img = document.querySelector('.poster__img');
    expect(img).not.toBeNull();

    img?.dispatchEvent(new Event('error'));

    expect(await screen.findByRole('button', { name: /KLIK/ })).toBeInTheDocument();
    expect(document.querySelector('.poster__img')).toBeNull();
  });
});
