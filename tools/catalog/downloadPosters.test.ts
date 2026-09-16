// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { downloadPosters } from './downloadPosters.ts';

const bytes = new Uint8Array([1, 2, 3]);

const okResponse = {
  ok: true,
  arrayBuffer: () => Promise.resolve(bytes.buffer),
} as Response;

describe('downloadPosters', () => {
  it('mengembalikan berkas yang berhasil diunduh', async () => {
    const fetcher = (() => Promise.resolve(okResponse)) as unknown as typeof fetch;

    const result = await downloadPosters([{ id: '1', url: 'https://x/1.jpg' }], {
      fetcher,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('1');
    expect(Array.from(result[0]?.data ?? [])).toEqual([1, 2, 3]);
  });

  it('membuang poster yang gagal tanpa menggagalkan sisanya', async () => {
    const fetcher = ((url: string) =>
      url.includes('gagal')
        ? Promise.resolve({ ok: false, status: 404 } as Response)
        : Promise.resolve(okResponse)) as unknown as typeof fetch;

    const result = await downloadPosters(
      [
        { id: '1', url: 'https://x/1.jpg' },
        { id: '2', url: 'https://x/gagal.jpg' },
        { id: '3', url: 'https://x/3.jpg' },
      ],
      { fetcher },
    );

    expect(result.map((poster) => poster.id).sort()).toEqual(['1', '3']);
  });

  it('membuang poster yang fetch-nya melempar', async () => {
    const fetcher = (() => Promise.reject(new Error('putus'))) as unknown as typeof fetch;

    const result = await downloadPosters([{ id: '1', url: 'https://x/1.jpg' }], {
      fetcher,
    });

    expect(result).toEqual([]);
  });

  it('tidak pernah melebihi batas paralel', async () => {
    let active = 0;
    let peak = 0;

    const fetcher = (() => {
      active += 1;
      peak = Math.max(peak, active);

      return new Promise<Response>((resolve) => {
        setTimeout(() => {
          active -= 1;
          resolve(okResponse);
        }, 1);
      });
    }) as unknown as typeof fetch;

    const requests = Array.from({ length: 10 }, (_, index) => ({
      id: String(index),
      url: `https://x/${String(index)}.jpg`,
    }));

    const result = await downloadPosters(requests, { fetcher, concurrency: 3 });

    expect(peak).toBeLessThanOrEqual(3);
    expect(result).toHaveLength(10);
  });

  it('tidak memanggil fetch untuk masukan kosong', async () => {
    let called = false;
    const fetcher = (() => {
      called = true;
      return Promise.resolve(okResponse);
    }) as unknown as typeof fetch;

    const result = await downloadPosters([], { fetcher });

    expect(result).toEqual([]);
    expect(called).toBe(false);
  });

  it('mengembalikan seluruh poster walau jumlahnya lebih banyak dari batas paralel', async () => {
    const fetcher = (() => Promise.resolve(okResponse)) as unknown as typeof fetch;

    const requests = Array.from({ length: 7 }, (_, index) => ({
      id: String(index),
      url: `https://x/${String(index)}.jpg`,
    }));

    const result = await downloadPosters(requests, { fetcher, concurrency: 2 });

    expect(result).toHaveLength(7);
  });
});
