// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fetchCatalog } from './fetchCatalog.ts';
import { FALLBACK_CATALOG } from './fallback.ts';

const json = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

const drama = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  name: `Drama ${id}`,
  overview: `Sinopsis ${id}`,
  first_air_date: '2022-01-01',
  vote_average: 8,
  poster_path: `/p${id}.jpg`,
  ...over,
});

/** Fetcher tiruan yang menjawab endpoint discover dan videos. */
function makeFetcher(
  discover: (url: string) => unknown,
  videos: Record<string, unknown> = {},
): typeof fetch {
  return ((url: string) => {
    const videosMatch = /\/tv\/(\d+)\/videos/.exec(url);
    if (videosMatch) {
      return json({ results: videos[videosMatch[1] as string] ?? [] });
    }

    return json(discover(url));
  }) as unknown as typeof fetch;
}

const base = {
  apiKey: 'kunci',
  limit: 2,
  pagePool: 1,
  random: () => 0,
  now: () => new Date('2026-09-16T00:00:00.000Z'),
};

describe('fetchCatalog', () => {
  it('memakai katalog cadangan bila kunci kosong, tanpa memanggil jaringan', async () => {
    let called = false;
    const fetcher = (() => {
      called = true;
      return json({});
    }) as unknown as typeof fetch;

    const result = await fetchCatalog({ ...base, apiKey: '', fetcher });

    expect(result.catalog).toBe(FALLBACK_CATALOG);
    expect(result.posters).toEqual([]);
    expect(called).toBe(false);
  });

  it('memakai katalog cadangan bila balasan bukan 200', async () => {
    const fetcher = (() => json({}, false)) as unknown as typeof fetch;
    const result = await fetchCatalog({ ...base, fetcher });

    expect(result.catalog).toBe(FALLBACK_CATALOG);
  });

  it('memakai katalog cadangan bila fetch melempar', async () => {
    const fetcher = (() =>
      Promise.reject(new Error('jaringan mati'))) as unknown as typeof fetch;
    const result = await fetchCatalog({ ...base, fetcher });

    expect(result.catalog).toBe(FALLBACK_CATALOG);
  });

  it('menggabungkan sinopsis bahasa utama dengan bahasa kedua', async () => {
    const fetcher = makeFetcher((url) => {
      const isPrimary = url.includes('language=id-ID');
      return {
        total_pages: 5,
        results: [
          drama(1, { overview: isPrimary ? 'Indonesia' : 'English' }),
          drama(2, { overview: isPrimary ? '' : 'Hanya Inggris' }),
        ],
      };
    });

    const result = await fetchCatalog({ ...base, fetcher });
    const byId = new Map(result.catalog.items.map((item) => [item.id, item]));

    expect(byId.get('1')?.overview).toBe('Indonesia');
    expect(byId.get('2')?.overview).toBe('Hanya Inggris');
  });

  it('mendahulukan entri yang punya trailer', async () => {
    const fetcher = makeFetcher(
      () => ({ total_pages: 5, results: [drama(1), drama(2)] }),
      {
        '1': [],
        '2': [{ site: 'YouTube', type: 'Trailer', key: 'trailerkey1' }],
      },
    );

    const result = await fetchCatalog({ ...base, fetcher });

    expect(result.catalog.items[0]?.id).toBe('2');
    expect(result.catalog.items[0]?.trailerKey).toBe('trailerkey1');
  });

  it('membatasi jumlah entri sesuai limit', async () => {
    const fetcher = makeFetcher(() => ({
      total_pages: 5,
      results: [drama(1), drama(2), drama(3), drama(4)],
    }));

    const result = await fetchCatalog({ ...base, limit: 2, fetcher });

    expect(result.catalog.items).toHaveLength(2);
  });

  it('hanya meminta poster untuk entri yang punya poster', async () => {
    const fetcher = makeFetcher(() => ({
      total_pages: 5,
      results: [drama(1), drama(2, { poster_path: null })],
    }));

    const result = await fetchCatalog({ ...base, fetcher });

    expect(result.posters).toHaveLength(1);
    expect(result.posters[0]).toEqual({
      id: '1',
      url: 'https://image.tmdb.org/t/p/w500/p1.jpg',
    });
  });

  it('memilih halaman acak di dalam kolam dan mencatatnya', async () => {
    const requested: string[] = [];
    const fetcher = makeFetcher((url) => {
      requested.push(url);
      return { total_pages: 100, results: [drama(1)] };
    });

    const result = await fetchCatalog({
      ...base,
      pagePool: 20,
      random: () => 0.5,
      fetcher,
    });

    expect(result.catalog.page).toBe(11);
    expect(requested[0]).toContain('page=11');
  });

  it('mengundi ulang di dalam total_pages bila halaman acak melewati halaman terakhir', async () => {
    const requested: string[] = [];
    const fetcher = makeFetcher((url) => {
      requested.push(url);
      // Halaman pertama yang diminta mengaku hanya punya 2 halaman.
      return { total_pages: 2, results: [drama(1)] };
    });

    const result = await fetchCatalog({
      ...base,
      pagePool: 20,
      random: () => 0.99,
      fetcher,
    });

    expect(requested[0]).toContain('page=20');
    // Diundi ulang di dalam 1..2. Kalau selalu dipundurkan ke halaman 1,
    // halaman 1 akan menampung hampir semua build dan variasi katalog hilang.
    expect(requested[1]).toContain('page=2');
    expect(requested[1]).toContain('language=id-ID');
    // Halaman yang dicatat harus halaman yang benar-benar menghasilkan data.
    expect(result.catalog.page).toBe(2);
  });

  it('tetap mendarat di halaman 1 saat katalog hanya punya satu halaman', async () => {
    const requested: string[] = [];
    const fetcher = makeFetcher((url) => {
      requested.push(url);
      return { total_pages: 1, results: [drama(1)] };
    });

    const result = await fetchCatalog({
      ...base,
      pagePool: 20,
      random: () => 0.99,
      fetcher,
    });

    expect(requested[0]).toContain('page=20');
    expect(requested[1]).toContain('page=1');
    expect(result.catalog.page).toBe(1);
  });

  it('memundurkan halaman ke 1 bila daftar hasil kosong', async () => {
    const requested: string[] = [];
    const fetcher = makeFetcher((url) => {
      requested.push(url);
      // Halaman yang dipilih kosong, tetapi halaman 1 ada isinya.
      return url.includes('page=20')
        ? { total_pages: 127, results: [] }
        : { total_pages: 127, results: [drama(1)] };
    });

    const result = await fetchCatalog({
      ...base,
      limit: 1,
      pagePool: 20,
      random: () => 0.99,
      fetcher,
    });

    expect(result.catalog.items).toHaveLength(1);
    expect(requested[1]).toContain('page=1');
  });

  it('menandai sumber tmdb dan mencatat waktu generate', async () => {
    const fetcher = makeFetcher(() => ({ total_pages: 5, results: [drama(1)] }));
    const result = await fetchCatalog({ ...base, fetcher });

    expect(result.catalog.source).toBe('tmdb');
    expect(result.catalog.generatedAt).toBe('2026-09-16T00:00:00.000Z');
  });

  it('membatasi discover ke drama China, bukan drama Barat', async () => {
    const requested: string[] = [];
    const fetcher = makeFetcher((url) => {
      requested.push(url);
      return { total_pages: 5, results: [drama(1)] };
    });

    await fetchCatalog({ ...base, fetcher });

    const url = requested[0] as string;
    // Inti proyek ini drama China. Tanpa parameter ini katalog terisi
    // Breaking Bad, ER, Tulsa King, dan sejenisnya.
    expect(url).toContain('with_original_language=zh');
    // Ambang 30 dipilih dari pengukuran TMDB: 138 judul (7 halaman), bukan
    // 21 judul (2 halaman) seperti ambang 100.
    expect(url).toContain('vote_count.gte=30');
    // Penyaring genre tetap ada supaya berita dan gelar wicara tidak lolos.
    expect(url).toContain('with_genres=18');
    expect(url).toContain('without_genres=10767,10763,10764,10766');
  });

  it('tidak menggagalkan seluruh katalog bila satu permintaan trailer gagal', async () => {
    const fetcher = ((url: string) => {
      if (url.includes('/tv/1/videos')) {
        return Promise.reject(new Error('trailer mati'));
      }

      if (url.includes('/videos')) {
        return json({ results: [] });
      }

      return json({ total_pages: 5, results: [drama(1), drama(2)] });
    }) as unknown as typeof fetch;

    const result = await fetchCatalog({ ...base, fetcher });

    expect(result.catalog.items).toHaveLength(2);
  });
});
