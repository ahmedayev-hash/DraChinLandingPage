import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogFile } from '../../tools/catalog/types';
import { FALLBACK_CONFIG } from '../lib/config';
import { CatalogPage } from './CatalogPage';

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
      poster: '',
      trailerKey: 'abcdefghijk',
    },
    {
      id: '2',
      title: 'Drama Dua',
      overview: 'Sinopsis dua.',
      year: '2021',
      rating: 7.1,
      poster: '',
      trailerKey: '',
    },
  ],
};

const firstItem = catalog.items[0] as CatalogFile['items'][number];

/** Semua poster langsung dianggap selesai diunduh. */
function stubImageDone(): void {
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

/** Poster tidak pernah selesai, sehingga overlay tetap tampil. */
function stubImagePending(): void {
  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = '';
    },
  );
}

// Tanpa tipe argumen yang eksplisit, vi.fn() menghasilkan tuple argumen
// kosong sehingga openSpy.mock.calls[0]?.[0] menjadi galat tipe.
type OpenFn = (url?: string | URL, target?: string, features?: string) => Window | null;

const noop = () => undefined;

const renderPage = (
  over: Partial<Parameters<typeof CatalogPage>[0]> = {},
): ReturnType<typeof render> =>
  render(
    <CatalogPage
      catalog={catalog}
      config={FALLBACK_CONFIG}
      detailId={undefined}
      onOpenDetail={noop}
      onCloseDetail={noop}
      {...over}
    />,
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CatalogPage', () => {
  it('menampilkan kartu untuk setiap drama', () => {
    stubImageDone();
    renderPage();

    expect(screen.getByRole('button', { name: /Drama Satu/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Drama Dua/ })).toBeInTheDocument();
  });

  it('memberitahu id saat kartu diklik', async () => {
    stubImageDone();
    const onOpenDetail = vi.fn();

    renderPage({ onOpenDetail });
    await userEvent.click(screen.getByRole('button', { name: /Drama Satu/ }));

    expect(onOpenDetail).toHaveBeenCalledWith('1');
  });

  it('menampilkan overlay selama poster belum selesai', () => {
    stubImagePending();

    renderPage({
      catalog: { ...catalog, items: [{ ...firstItem, poster: './posters/1.jpg' }] },
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('menyembunyikan overlay setelah semua poster selesai', async () => {
    stubImageDone();

    renderPage({
      catalog: { ...catalog, items: [{ ...firstItem, poster: './posters/1.jpg' }] },
    });

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  it('tidak menampilkan overlay bila tidak ada poster sama sekali', async () => {
    stubImagePending();
    renderPage();

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  it('membuka modal untuk id yang ada di URL', () => {
    stubImageDone();
    renderPage({ detailId: '1' });

    expect(screen.getByRole('heading', { name: 'Drama Satu' })).toBeInTheDocument();
  });

  it('menampilkan pesan bila id di URL tidak ada di katalog', () => {
    stubImageDone();
    renderPage({ detailId: '999' });

    expect(screen.getByText(/tidak ditemukan/i)).toBeInTheDocument();
  });

  it('menampilkan pesan kosong dengan tombol coba lagi saat katalog gagal', async () => {
    stubImageDone();
    const onRetry = vi.fn();

    renderPage({ catalog: null, onRetry });
    await userEvent.click(screen.getByRole('button', { name: /coba lagi/i }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('memakai link dari config saat tombol Shopee di modal diklik', async () => {
    stubImageDone();
    let requested = '';
    const openSpy = vi.fn<OpenFn>((url) => {
      requested = String(url);
      // Mengembalikan jendela tiruan supaya openAffiliate tidak perlu
      // menjalankan fallback same-tab (yang tidak dapat diuji di jsdom).
      return { opener: null } as unknown as Window;
    });
    vi.stubGlobal('open', openSpy);

    renderPage({ detailId: '1' });
    await userEvent.click(screen.getByRole('button', { name: /tonton full/i }));

    expect(openSpy).toHaveBeenCalledOnce();
    expect(requested).toContain('s.shopee.co.id');
  });

  it('tidak melempar saat popup diblokir sehingga jatuh ke navigasi same-tab', async () => {
    stubImageDone();
    vi.stubGlobal('open', () => null);

    renderPage({ detailId: '1' });

    // location.href tidak dapat diubah di jsdom, jadi hanya dipastikan tidak
    // ada lemparan. Pengujian sesungguhnya ada di Task 13 di peramban asli.
    await userEvent.click(screen.getByRole('button', { name: /tonton full/i }));
  });
});

describe('kerangka situs', () => {
  it('menampilkan header berisi nama brand tanpa satu pun tombol', () => {
    stubImageDone();
    renderPage();

    const header = screen.getByRole('banner');

    expect(header).toHaveTextContent(FALLBACK_CONFIG.brand);
    // Permintaan eksplisit: header tidak boleh punya tombol sama sekali.
    expect(within(header).queryAllByRole('button')).toHaveLength(0);
  });

  it('menampilkan footer berisi atribusi TMDB tanpa satu pun tombol', () => {
    stubImageDone();
    renderPage();

    const footer = screen.getByRole('contentinfo');

    expect(footer).toHaveTextContent(/TMDB/);
    expect(within(footer).queryAllByRole('button')).toHaveLength(0);
  });
});
