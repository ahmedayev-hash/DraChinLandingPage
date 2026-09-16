import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCatalog } from './useCatalog';

const file = {
  generatedAt: '2026-09-16T00:00:00.000Z',
  source: 'tmdb',
  page: 3,
  items: [
    {
      id: '1',
      title: 'Judul',
      overview: 'Sinopsis',
      year: '2022',
      rating: 8.4,
      poster: './posters/1.jpg',
      trailerKey: '',
    },
  ],
};

const okFetch = (body: unknown): typeof fetch =>
  (() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(body),
    } as Response)) as unknown as typeof fetch;

describe('useCatalog', () => {
  it('memuat katalog dan menandai selesai', async () => {
    const { result } = renderHook(() => useCatalog(okFetch(file)));

    await waitFor(() => {
      expect(result.current.catalog?.items).toHaveLength(1);
    });

    expect(result.current.failed).toBe(false);
  });

  it('menandai gagal bila balasan bukan 200', async () => {
    const fetcher = (() =>
      Promise.resolve({ ok: false, status: 404 } as Response)) as unknown as typeof fetch;

    const { result } = renderHook(() => useCatalog(fetcher));

    await waitFor(() => {
      expect(result.current.failed).toBe(true);
    });

    expect(result.current.catalog).toBeNull();
  });

  it('menandai gagal bila JSON rusak', async () => {
    const fetcher = (() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.reject(new Error('JSON rusak')),
      } as unknown as Response)) as unknown as typeof fetch;

    const { result } = renderHook(() => useCatalog(fetcher));

    await waitFor(() => {
      expect(result.current.failed).toBe(true);
    });
  });

  it('memuat ulang saat retry dipanggil', async () => {
    let calls = 0;
    const fetcher = (() => {
      calls += 1;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(file),
      } as Response);
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useCatalog(fetcher));

    await waitFor(() => {
      expect(result.current.catalog).not.toBeNull();
    });

    const before = calls;
    result.current.retry();

    await waitFor(() => {
      expect(calls).toBeGreaterThan(before);
    });
  });

  it('tidak menulis state setelah komponen dilepas', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let resolveFetch: ((value: Response) => void) | undefined;

    const fetcher = (() =>
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })) as unknown as typeof fetch;

    const { unmount } = renderHook(() => useCatalog(fetcher));
    unmount();

    resolveFetch?.({ ok: true, json: () => Promise.resolve(file) } as Response);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
