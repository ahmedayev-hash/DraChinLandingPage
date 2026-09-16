import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogFile } from '../tools/catalog/types';
import App from './App';

const catalog: CatalogFile = {
  generatedAt: '2026-09-16T00:00:00.000Z',
  source: 'tmdb',
  page: 3,
  items: [
    {
      id: '1',
      title: 'Drama Satu',
      overview: 'Sinopsis satu.',
      year: '2022',
      rating: 8.4,
      // Poster sengaja kosong supaya tidak ada penantian unduhan di tes ini.
      poster: '',
      trailerKey: 'abcdefghijk',
    },
  ],
};

/**
 * Menjawab config.json dan catalog.json sekaligus.
 *
 * Keduanya melalui fetch. Bila hanya config.json yang ditirukan, permintaan
 * catalog.json akan gagal di jsdom dan rute katalog tidak pernah tampil -
 * tesnya akan lulus atau gagal karena alasan yang salah.
 */
function stubFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const url = String(input);
      const body = url.includes('catalog.json') ? catalog : {};
      return { ok: true, json: async () => body };
    }),
  );
}

/** Poster langsung dianggap selesai supaya overlay cepat hilang. */
function stubImage(): void {
  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = '';

      constructor() {
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    },
  );
}

beforeEach(() => {
  stubFetch();
  stubImage();
});

afterEach(() => {
  vi.unstubAllGlobals();
  // replaceState dipakai, bukan penugasan hash, supaya tidak memicu
  // hashchange yang dapat membangunkan komponen yang sudah dilepas.
  window.history.replaceState(null, '', window.location.pathname);
});

describe('App', () => {
  it('menampilkan landing untuk hash kosong', async () => {
    render(<App />);

    expect(
      await screen.findByRole('button', { name: /lihat katalog/i }),
    ).toBeInTheDocument();
  });

  it('menampilkan katalog untuk hash katalog', async () => {
    window.history.replaceState(null, '', '#/katalog');

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: /katalog drama/i }),
    ).toBeInTheDocument();
  });

  it('kembali ke landing untuk hash yang tidak dikenal', async () => {
    window.history.replaceState(null, '', '#/entah');

    render(<App />);

    expect(
      await screen.findByRole('button', { name: /lihat katalog/i }),
    ).toBeInTheDocument();
  });

  it('membuka modal sesuai id drama di hash', async () => {
    window.history.replaceState(null, '', '#/drama/1');

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Drama Satu' }),
    ).toBeInTheDocument();
  });

  it('mengikuti perubahan hash tanpa memuat ulang halaman', async () => {
    render(<App />);

    expect(
      await screen.findByRole('button', { name: /lihat katalog/i }),
    ).toBeInTheDocument();

    window.history.replaceState(null, '', '#/katalog');
    window.dispatchEvent(new Event('hashchange'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /katalog drama/i })).toBeInTheDocument();
    });
  });
});
