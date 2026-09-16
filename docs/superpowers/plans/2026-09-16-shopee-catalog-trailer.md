# Katalog dan Modal Trailer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun katalog drama yang di-generate dari TMDB saat build, dengan
modal trailer YouTube dan satu tombol menuju Shopee.

**Architecture:** Logika katalog diletakkan di `tools/catalog/` sebagai modul
murni yang teruji, lalu disambungkan ke build lewat satu Vite plugin tipis.
Kunci API TMDB hanya hidup di proses Node saat build dan tidak pernah masuk ke
bundle. Di sisi browser, router hash kecil di bawah 1 KB memilih antara landing,
katalog, dan modal trailer yang dikendalikan URL.

**Tech Stack:** React 19, Vite 8, TypeScript 5.9, Vitest 5, Testing Library,
Prettier 3, ESLint 10, pnpm 12. Tanpa dependency runtime baru.

**Spec:** `docs/superpowers/specs/2026-09-16-shopee-catalog-trailer-design.md`

## Global Constraints

- Node.js `^22.12.0 || ^24.0.0 || >=26.0.0`. Versi lain tidak didukung.
- Dependency runtime tetap **dua**: `react` dan `react-dom`. Tidak boleh
  menambah dependency runtime baru. Semua kode katalog memakai `fetch` bawaan
  Node, bukan `axios` atau `node-fetch`.
- Versi dependency dipin **persis** tanpa tanda `^` atau `~`.
- Tidak ada satu pun berkas di `src/` yang boleh menyebut `TMDB_API_KEY`.
  Nama variabel tanpa prefix `VITE_`.
- Tidak ada berkas gambar pihak ketiga yang boleh masuk ke repositori.
  Poster hanya ada di `dist/` hasil build.
- Semua jalur aset memakai awalan `./` agar bekerja di sub-path GitHub Pages.
- Semua teks yang dilihat pengguna ditulis dalam bahasa Indonesia.
- `.env` wajib tetap di-ignore git. `.env.example` hanya memuat nama variabel.
- Proses build **tidak boleh gagal** karena TMDB bermasalah. Selalu jatuh ke
  katalog cadangan.
- Aturan dari spec lama yang tetap berlaku: `openAffiliate()` dengan fallback
  popup-blocked, dan `config.json` sebagai data runtime yang dapat diubah tanpa
  build ulang.

## Catatan penting sebelum mulai

**Perintah `git commit` di dalam rencana ini memerlukan izin eksplisit dari
pemilik repositori.** `AGENTS.md` melarang menjalankan
`git add/commit/reset/checkout/revert/stash` tanpa permintaan eksplisit. Bila
belum ada izin, lewati langkah commit dan lanjutkan ke task berikutnya. Jangan
menganggap langkah commit di dalam rencana ini sebagai izin.

---

## Struktur File

| Berkas                              | Tanggung jawab                                              |
| ----------------------------------- | ----------------------------------------------------------- |
| `tools/catalog/types.ts`            | Tipe bersama `CatalogItem` dan `CatalogFile`.               |
| `tools/catalog/normalize.ts`        | Mengubah data mentah TMDB menjadi `CatalogItem`. Murni.     |
| `tools/catalog/fetchCatalog.ts`     | Orkestrasi permintaan TMDB. `fetch` disuntikkan.            |
| `tools/catalog/downloadPosters.ts`  | Mengunduh poster dengan batas paralel. `fetch` disuntikkan. |
| `tools/catalog/fallback.ts`         | Katalog cadangan tanpa gambar.                              |
| `tools/catalog/vitePlugin.ts`       | Perekat Vite: emit aset saat build, middleware saat dev.    |
| `src/lib/router.ts`                 | `parseRoute()` dan `buildHash()`. Murni.                    |
| `src/lib/catalogSchema.ts`          | Memvalidasi `catalog.json` dari jaringan. Murni.            |
| `src/hooks/useHashRoute.ts`         | Langganan `hashchange`.                                     |
| `src/hooks/useCatalog.ts`           | Memuat `catalog.json` sekali, dengan penjaga pembatalan.    |
| `src/hooks/useImagePreloader.ts`    | Menunggu semua poster selesai diunduh.                      |
| `src/components/LoadingOverlay.tsx` | Overlay spinner.                                            |
| `src/components/MovieCard.tsx`      | Satu kartu drama.                                           |
| `src/components/TrailerModal.tsx`   | Dialog trailer berbasis `<dialog>` native.                  |
| `src/pages/LandingPage.tsx`         | Tampilan clickbait dan hitungan mundur 8 detik.             |
| `src/pages/CatalogPage.tsx`         | Grid katalog, overlay, dan modal.                           |
| `src/App.tsx`                       | Kerangka router dan pemuatan data.                          |

Urutan pengerjaan: Task 1 sampai 4 membangun sisi build (tidak terlihat
pengguna). Task 5 sampai 12 membangun sisi browser. Setiap task meninggalkan
repositori dalam keadaan yang dapat diuji dan dapat dijalankan.

---

## Task 1: Tipe katalog dan normalisasi data TMDB

Modul ini murni: masuk data mentah, keluar data bersih. Tidak ada jaringan,
sehingga tesnya cepat dan tidak rapuh.

**Files:**

- Create: `tools/catalog/types.ts`
- Create: `tools/catalog/normalize.ts`
- Test: `tools/catalog/normalize.test.ts`
- Modify: `vite.config.ts:14` (tambahkan pola tes `tools/`)
- Modify: `tsconfig.node.json:22` (tambahkan `tools/**/*`)

**Interfaces:**

- Consumes: tidak ada.
- Produces: tipe `CatalogItem`, `CatalogFile`; fungsi `toYear()`,
  `toRating()`, `mergeOverview()`, `pickTrailerKey()`, `normalizeItem()`.

- [ ] **Step 1: Daftarkan folder `tools/` ke Vitest dan TypeScript**

Tanpa langkah ini, tes di `tools/` tidak akan pernah dijalankan dan tidak akan
ter-typecheck, sehingga kegagalannya tidak terlihat sama sekali.

Pada `vite.config.ts`, ubah baris `include` di dalam blok `test`:

```ts
    include: ['src/**/*.test.{ts,tsx}', 'tools/**/*.test.ts'],
```

Pada `tsconfig.node.json`, ubah baris `include`:

```json
  "include": ["vite.config.ts", "tools/**/*"]
```

- [ ] **Step 2: Tulis berkas tipe**

Buat `tools/catalog/types.ts`:

```ts
/** Satu drama di dalam katalog yang dipakai halaman web. */
export interface CatalogItem {
  id: string;
  title: string;
  overview: string;
  year: string;
  rating: number;
  poster: string;
  trailerKey: string;
}

/** Isi lengkap catalog.json. */
export interface CatalogFile {
  generatedAt: string;
  source: 'tmdb' | 'fallback';
  page: number;
  items: CatalogItem[];
}
```

- [ ] **Step 3: Tulis tes yang gagal**

Buat `tools/catalog/normalize.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  mergeOverview,
  normalizeItem,
  pickTrailerKey,
  toRating,
  toYear,
} from './normalize';

describe('toYear', () => {
  it('mengambil empat digit pertama', () => {
    expect(toYear('2022-08-21')).toBe('2022');
  });

  it('mengembalikan string kosong untuk nilai kosong atau tidak valid', () => {
    expect(toYear('')).toBe('');
    expect(toYear(undefined)).toBe('');
    expect(toYear('bukan-tanggal')).toBe('');
  });
});

describe('toRating', () => {
  it('membulatkan ke satu angka di belakang koma', () => {
    expect(toRating(8.357)).toBe(8.4);
    expect(toRating(7)).toBe(7);
  });

  it('mengembalikan 0 untuk nilai tidak valid atau di luar rentang', () => {
    expect(toRating(undefined)).toBe(0);
    expect(toRating('8.4')).toBe(0);
    expect(toRating(-1)).toBe(0);
    expect(toRating(11)).toBe(0);
  });
});

describe('mergeOverview', () => {
  it('memakai bahasa utama bila terisi', () => {
    expect(mergeOverview('Teks Indonesia', 'English text')).toBe('Teks Indonesia');
  });

  it('jatuh ke bahasa kedua bila bahasa utama kosong', () => {
    expect(mergeOverview('', 'English text')).toBe('English text');
    expect(mergeOverview('   ', 'English text')).toBe('English text');
  });

  it('mengembalikan string kosong bila keduanya kosong', () => {
    expect(mergeOverview('', undefined)).toBe('');
  });
});

describe('pickTrailerKey', () => {
  const video = (over: Record<string, unknown>) => ({
    site: 'YouTube',
    key: 'abcdefghijk',
    ...over,
  });

  it('mendahulukan Trailer di atas Teaser', () => {
    const key = pickTrailerKey([
      video({ type: 'Teaser', key: 'teaserkey01' }),
      video({ type: 'Trailer', key: 'trailerkey1' }),
    ]);
    expect(key).toBe('trailerkey1');
  });

  it('memakai Teaser bila tidak ada Trailer', () => {
    expect(pickTrailerKey([video({ type: 'Teaser', key: 'teaserkey01' })])).toBe(
      'teaserkey01',
    );
  });

  it('menolak video yang bukan YouTube', () => {
    expect(pickTrailerKey([video({ type: 'Trailer', site: 'Vimeo' })])).toBe('');
  });

  it('menolak key yang panjangnya bukan 11 karakter', () => {
    expect(pickTrailerKey([video({ type: 'Trailer', key: 'pendek' })])).toBe('');
    expect(
      pickTrailerKey([video({ type: 'Trailer', key: 'terlalupanjangsekali' })]),
    ).toBe('');
  });

  it('menolak key dengan karakter di luar huruf, angka, strip, dan garis bawah', () => {
    expect(pickTrailerKey([video({ type: 'Trailer', key: 'abc!efghijk' })])).toBe('');
  });

  it('mengembalikan string kosong untuk masukan bukan array', () => {
    expect(pickTrailerKey(undefined)).toBe('');
    expect(pickTrailerKey(null)).toBe('');
    expect(pickTrailerKey('bukan array')).toBe('');
  });
});

describe('normalizeItem', () => {
  const raw = {
    id: 94997,
    name: 'House of the Dragon',
    overview: 'Kisah keluarga Targaryen.',
    first_air_date: '2022-08-21',
    vote_average: 8.357,
    poster_path: '/abc123.jpg',
  };

  it('memetakan medan TMDB ke CatalogItem', () => {
    expect(normalizeItem(raw, raw.overview)).toEqual({
      id: '94997',
      title: 'House of the Dragon',
      overview: 'Kisah keluarga Targaryen.',
      year: '2022',
      rating: 8.4,
      poster: './posters/94997.jpg',
      trailerKey: '',
    });
  });

  it('membuang entri tanpa judul', () => {
    expect(normalizeItem({ ...raw, name: '' }, '')).toBeNull();
    expect(normalizeItem({ ...raw, name: undefined }, '')).toBeNull();
  });

  it('membuang entri tanpa id yang dapat dipakai', () => {
    expect(normalizeItem({ ...raw, id: undefined }, '')).toBeNull();
  });

  it('memakai string kosong untuk poster bila poster_path kosong', () => {
    expect(normalizeItem({ ...raw, poster_path: null }, '')?.poster).toBe('');
  });

  it('memakai sinopsis hasil gabungan, bukan sinopsis mentah', () => {
    expect(normalizeItem({ ...raw, overview: '' }, 'English text')?.overview).toBe(
      'English text',
    );
  });
});
```

- [ ] **Step 4: Jalankan tes dan pastikan gagal**

Run: `pnpm vitest run tools/catalog/normalize.test.ts`
Expected: FAIL dengan pesan seperti `Failed to resolve import "./normalize"`.

- [ ] **Step 5: Tulis implementasi minimal**

Buat `tools/catalog/normalize.ts`:

```ts
import type { CatalogItem } from './types';

const TRAILER_TYPES = ['Trailer', 'Teaser'] as const;
const YOUTUBE_KEY = /^[A-Za-z0-9_-]{11}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Empat digit pertama tanggal TMDB. Kosong bila tidak ada. */
export function toYear(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  const match = /^\d{4}/.exec(value.trim());
  return match?.[0] ?? '';
}

/** Rating 0-10 dengan satu angka di belakang koma. Di luar rentang menjadi 0. */
export function toRating(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  if (value < 0 || value > 10) {
    return 0;
  }

  return Math.round(value * 10) / 10;
}

/**
 * Sinopsis: pakai bahasa utama bila terisi, jika tidak pakai bahasa kedua.
 *
 * Ini perlu karena diukur langsung terhadap TMDB: pada 20 hasil teratas,
 * hanya 2 yang punya sinopsis berbahasa Indonesia, sedangkan 18 di antaranya
 * punya sinopsis Inggris. Tanpa penggabungan ini katalog akan 90 persen
 * kosong teksnya.
 */
export function mergeOverview(primary: unknown, secondary: unknown): string {
  const first = typeof primary === 'string' ? primary.trim() : '';
  if (first !== '') {
    return first;
  }

  return typeof secondary === 'string' ? secondary.trim() : '';
}

/** Memilih ID trailer YouTube yang layak. Kosong bila tidak ada. */
export function pickTrailerKey(videos: unknown): string {
  if (!Array.isArray(videos)) {
    return '';
  }

  const youtube = videos.filter(
    (video) => isRecord(video) && video['site'] === 'YouTube',
  );

  for (const type of TRAILER_TYPES) {
    for (const video of youtube) {
      if (video['type'] !== type) {
        continue;
      }

      const key = video['key'];
      if (typeof key === 'string' && YOUTUBE_KEY.test(key)) {
        return key;
      }
    }
  }

  return '';
}

/**
 * Mengubah satu hasil TMDB menjadi CatalogItem.
 * Mengembalikan null bila entri tidak dapat dipakai.
 */
export function normalizeItem(raw: unknown, overview: string): CatalogItem | null {
  if (!isRecord(raw)) {
    return null;
  }

  const id = raw['id'];
  if (typeof id !== 'number' && typeof id !== 'string') {
    return null;
  }

  const idText = String(id).trim();
  if (idText === '') {
    return null;
  }

  const title = typeof raw['name'] === 'string' ? raw['name'].trim() : '';
  if (title === '') {
    return null;
  }

  const posterPath =
    typeof raw['poster_path'] === 'string' ? raw['poster_path'].trim() : '';

  return {
    id: idText,
    title,
    overview,
    year: toYear(raw['first_air_date']),
    rating: toRating(raw['vote_average']),
    poster: posterPath === '' ? '' : `./posters/${idText}.jpg`,
    trailerKey: '',
  };
}
```

- [ ] **Step 6: Jalankan tes dan pastikan lulus**

Run: `pnpm vitest run tools/catalog/normalize.test.ts`
Expected: PASS, seluruh tes hijau.

- [ ] **Step 7: Verifikasi typecheck dan lint masih bersih**

Run: `pnpm typecheck && pnpm lint`
Expected: keduanya exit 0.

- [ ] **Step 8: Commit**

```bash
git add tools/catalog/types.ts tools/catalog/normalize.ts tools/catalog/normalize.test.ts vite.config.ts tsconfig.node.json
git commit -m "feat(catalog): normalisasi data TMDB"
```

(Lihat "Catatan penting sebelum mulai": lewati bila belum ada izin commit.)

---

## Task 2: Orkestrasi permintaan TMDB

**Files:**

- Create: `tools/catalog/fallback.ts`
- Create: `tools/catalog/fetchCatalog.ts`
- Test: `tools/catalog/fetchCatalog.test.ts`

**Interfaces:**

- Consumes: `normalizeItem()`, `pickTrailerKey()`, `mergeOverview()` dari Task 1;
  tipe `CatalogFile`, `CatalogItem` dari Task 1.
- Produces: tipe `PosterRequest`, `FetchCatalogOptions`, `FetchCatalogResult`;
  fungsi `fetchCatalog()`; konstanta `FALLBACK_CATALOG`.

- [ ] **Step 1: Tulis katalog cadangan**

Buat `tools/catalog/fallback.ts`:

```ts
import type { CatalogFile } from './types';

/**
 * Katalog darurat yang ikut ter-commit.
 *
 * Poster sengaja dikosongkan: tidak ada berkas gambar pihak ketiga yang boleh
 * masuk ke repositori. Kartu memakai latar gradien, sama seperti perilaku
 * poster gagal muat yang sudah ada.
 *
 * Dipakai hanya bila kunci API kosong atau TMDB tidak dapat dihubungi.
 */
export const FALLBACK_CATALOG: CatalogFile = {
  generatedAt: '1970-01-01T00:00:00.000Z',
  source: 'fallback',
  page: 0,
  items: [
    {
      id: 'fallback-1',
      title: 'Drama paling dicari minggu ini',
      overview: 'Kisah yang sedang ramai dibicarakan.',
      year: '',
      rating: 0,
      poster: '',
      trailerKey: '',
    },
    {
      id: 'fallback-2',
      title: 'Episode baru tiap hari',
      overview: 'Tayang rutin dengan sub Indo.',
      year: '',
      rating: 0,
      poster: '',
      trailerKey: '',
    },
    {
      id: 'fallback-3',
      title: 'Sedang trending di banyak negara',
      overview: 'Masuk daftar tontonan paling banyak dicari.',
      year: '',
      rating: 0,
      poster: '',
      trailerKey: '',
    },
    {
      id: 'fallback-4',
      title: 'Rekomendasi untuk akhir pekan',
      overview: 'Cocok ditonton berurutan tanpa berhenti.',
      year: '',
      rating: 0,
      poster: '',
      trailerKey: '',
    },
    {
      id: 'fallback-5',
      title: 'Paling banyak dibahas penonton',
      overview: 'Sering muncul di kolom komentar.',
      year: '',
      rating: 0,
      poster: '',
      trailerKey: '',
    },
    {
      id: 'fallback-6',
      title: 'Lanjutan yang dinanti',
      overview: 'Musim terbaru sudah tersedia.',
      year: '',
      rating: 0,
      poster: '',
      trailerKey: '',
    },
  ],
};
```

- [ ] **Step 2: Tulis tes yang gagal**

Buat `tools/catalog/fetchCatalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fetchCatalog } from './fetchCatalog';
import { FALLBACK_CATALOG } from './fallback';

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

  it('memundurkan halaman ke 1 bila melebihi total_pages', async () => {
    const requested: string[] = [];
    const fetcher = makeFetcher((url) => {
      requested.push(url);
      // Halaman pertama yang diminta mengaku hanya punya 2 halaman.
      return { total_pages: 2, results: [drama(1)] };
    });

    await fetchCatalog({ ...base, pagePool: 20, random: () => 0.99, fetcher });

    expect(requested[0]).toContain('page=20');
    expect(requested[1]).toContain('page=1');
    expect(requested[1]).toContain('language=id-ID');
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
```

- [ ] **Step 3: Jalankan tes dan pastikan gagal**

Run: `pnpm vitest run tools/catalog/fetchCatalog.test.ts`
Expected: FAIL karena `./fetchCatalog` belum ada.

- [ ] **Step 4: Tulis implementasi orkestrasi**

Buat `tools/catalog/fetchCatalog.ts`:

```ts
import { FALLBACK_CATALOG } from './fallback';
import { mergeOverview, normalizeItem, pickTrailerKey } from './normalize';
import type { CatalogFile, CatalogItem } from './types';

const TMDB_API = 'https://api.themoviedb.org/3';
const IMAGE_API = 'https://image.tmdb.org/t/p/w500';

/**
 * Penyaring genre. Tanpa ini, daftar teratas berisi acara berita, gelar
 * wicara, dan sinetron. Diukur langsung terhadap TMDB: tanpa penyaring hanya
 * 43 persen kandidat yang punya trailer, sedangkan dengan penyaring 80 persen.
 *
 * 18 = Drama. 10767 = Talk. 10763 = News. 10764 = Reality. 10766 = Soap.
 */
const DISCOVER_FILTER = [
  'with_genres=18',
  'without_genres=10767,10763,10764,10766',
  'vote_count.gte=100',
  'sort_by=popularity.desc',
  'include_adult=false',
].join('&');

export interface PosterRequest {
  id: string;
  url: string;
}

export interface FetchCatalogOptions {
  apiKey: string;
  limit?: number;
  language?: string;
  fallbackLanguage?: string;
  pagePool?: number;
  timeoutMs?: number;
  fetcher?: typeof fetch;
  random?: () => number;
  now?: () => Date;
}

export interface FetchCatalogResult {
  catalog: CatalogFile;
  posters: PosterRequest[];
}

function clampInteger(
  value: number | undefined,
  fallbackValue: number,
  min: number,
  max: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallbackValue;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
}

function readId(raw: unknown): string {
  if (typeof raw !== 'object' || raw === null) {
    return '';
  }

  const id = (raw as Record<string, unknown>)['id'];
  if (typeof id !== 'number' && typeof id !== 'string') {
    return '';
  }

  return String(id).trim();
}

/**
 * Mengubah hasil discover menjadi daftar entri yang dapat dipakai.
 *
 * Hasil bahasa kedua dipetakan berdasarkan id, lalu sinopsisnya dipakai
 * sebagai cadangan saat sinopsis bahasa utama kosong.
 */
function toItems(
  primary: unknown[],
  secondary: unknown[],
  trailers: Map<string, string>,
): CatalogItem[] {
  const secondaryById = new Map<string, Record<string, unknown>>();
  for (const raw of secondary) {
    const id = readId(raw);
    if (id !== '') {
      secondaryById.set(id, raw as Record<string, unknown>);
    }
  }

  const items: CatalogItem[] = [];
  for (const raw of primary) {
    const id = readId(raw);
    if (id === '') {
      continue;
    }

    const record = raw as Record<string, unknown>;
    const overview = mergeOverview(
      record['overview'],
      secondaryById.get(id)?.['overview'],
    );
    const item = normalizeItem(record, overview);
    if (item === null) {
      continue;
    }

    items.push({ ...item, trailerKey: trailers.get(item.id) ?? '' });
  }

  return items;
}

/** Entri bertrailer didahulukan, sisanya menambal sampai batas terpenuhi. */
function orderByTrailer(items: CatalogItem[], limit: number): CatalogItem[] {
  const withTrailer = items.filter((item) => item.trailerKey !== '');
  const withoutTrailer = items.filter((item) => item.trailerKey === '');

  return [...withTrailer, ...withoutTrailer].slice(0, limit);
}

/**
 * Mengambil katalog dari TMDB.
 *
 * Tidak pernah melempar. Kegagalan apa pun menghasilkan katalog cadangan,
 * supaya build tidak pernah gagal hanya karena TMDB bermasalah.
 */
export async function fetchCatalog(
  options: FetchCatalogOptions,
): Promise<FetchCatalogResult> {
  const {
    apiKey,
    limit: rawLimit,
    language = 'id-ID',
    fallbackLanguage = 'en-US',
    pagePool: rawPagePool,
    timeoutMs: rawTimeout,
    fetcher = fetch,
    random = Math.random,
    now = () => new Date(),
  } = options;

  const fallback = (): FetchCatalogResult => ({ catalog: FALLBACK_CATALOG, posters: [] });

  if (apiKey.trim() === '') {
    return fallback();
  }

  const limit = clampInteger(rawLimit, 20, 1, 40);
  const pagePool = clampInteger(rawPagePool, 20, 1, 40);
  const timeoutMs = clampInteger(rawTimeout, 10_000, 1_000, 60_000);
  const page = 1 + Math.floor(random() * pagePool);
  const signal = AbortSignal.timeout(timeoutMs);

  const discoverUrl = (pageNumber: number, lang: string): string =>
    `${TMDB_API}/discover/tv?api_key=${encodeURIComponent(apiKey)}&language=${encodeURIComponent(lang)}&${DISCOVER_FILTER}&page=${String(pageNumber)}`;

  const getJson = async (url: string): Promise<Record<string, unknown>> => {
    const response = await fetcher(url, { signal });
    if (!response.ok) {
      throw new Error(`TMDB membalas ${String(response.status)}`);
    }

    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null) {
      throw new Error('Balasan TMDB bukan objek');
    }

    return body as Record<string, unknown>;
  };

  const readResults = (body: Record<string, unknown>): unknown[] =>
    Array.isArray(body['results']) ? (body['results'] as unknown[]) : [];

  try {
    const primaryBody = await getJson(discoverUrl(page, language));
    let primaryResults = readResults(primaryBody);

    const totalPages =
      typeof primaryBody['total_pages'] === 'number' ? primaryBody['total_pages'] : 0;

    // Halaman yang dipilih acak bisa saja melebihi jumlah halaman yang
    // tersedia. Dua tanda yang diperiksa: TMDB menyebut jumlah halaman lebih
    // kecil dari halaman yang diminta, atau balasannya berisi daftar kosong.
    // Tanpa pemeriksaan ini, build bisa menerima katalog kosong.
    //
    // usedPage dicatat terpisah dari page supaya catalog.json melaporkan
    // halaman yang benar-benar menghasilkan data, bukan halaman yang gagal.
    // Tanpa itu, diagnosa justru menyesatkan.
    let usedPage = page;
    const beyondLastPage = totalPages > 0 && page > totalPages;
    if ((primaryResults.length === 0 || beyondLastPage) && page !== 1) {
      primaryResults = readResults(await getJson(discoverUrl(1, language)));
      usedPage = 1;
    }

    if (primaryResults.length === 0) {
      return fallback();
    }

    // Memakai usedPage, bukan page, supaya sinopsis bahasa kedua diambil dari
    // halaman yang sama dengan hasil bahasa utama.
    const secondaryBody = await getJson(discoverUrl(usedPage, fallbackLanguage)).catch(
      () => ({ results: [] }) as Record<string, unknown>,
    );

    // Trailer diambil satu per satu karena /discover/tv tidak mendukung
    // append_to_response. Sudah diuji langsung terhadap TMDB.
    const trailers = new Map<string, string>();
    await Promise.all(
      primaryResults.map(async (raw) => {
        const id = readId(raw);
        if (id === '') {
          return;
        }

        try {
          const body = await getJson(
            `${TMDB_API}/tv/${encodeURIComponent(id)}/videos?api_key=${encodeURIComponent(apiKey)}`,
          );
          const key = pickTrailerKey(body['results']);
          if (key !== '') {
            trailers.set(id, key);
          }
        } catch {
          // Satu trailer gagal tidak boleh membatalkan seluruh katalog.
        }
      }),
    );

    const items = orderByTrailer(
      toItems(primaryResults, readResults(secondaryBody), trailers),
      limit,
    );

    if (items.length === 0) {
      return fallback();
    }

    const posterPathById = new Map<string, string>();
    for (const raw of primaryResults) {
      const id = readId(raw);
      const path = (raw as Record<string, unknown>)['poster_path'];
      if (id !== '' && typeof path === 'string' && path.trim() !== '') {
        posterPathById.set(id, path.trim());
      }
    }

    const posters: PosterRequest[] = [];
    for (const item of items) {
      if (item.poster === '') {
        continue;
      }

      const path = posterPathById.get(item.id);
      if (path !== undefined) {
        posters.push({ id: item.id, url: `${IMAGE_API}${path}` });
      }
    }

    return {
      catalog: {
        generatedAt: now().toISOString(),
        source: 'tmdb',
        page: usedPage,
        items,
      },
      posters,
    };
  } catch {
    return fallback();
  }
}
```

- [ ] **Step 5: Jalankan tes dan pastikan lulus**

Run: `pnpm vitest run tools/catalog/fetchCatalog.test.ts`
Expected: PASS.

- [ ] **Step 6: Verifikasi typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add tools/catalog/fetchCatalog.ts tools/catalog/fetchCatalog.test.ts tools/catalog/fallback.ts
git commit -m "feat(catalog): pengambilan data TMDB dengan fallback"
```

---

## Task 3: Mengunduh poster dengan batas paralel

**Files:**

- Create: `tools/catalog/downloadPosters.ts`
- Test: `tools/catalog/downloadPosters.test.ts`

**Interfaces:**

- Consumes: tipe `PosterRequest` dari Task 2.
- Produces: tipe `DownloadedPoster`, `DownloadPostersOptions`; fungsi
  `downloadPosters()`.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `tools/catalog/downloadPosters.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { downloadPosters } from './downloadPosters';

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
```

- [ ] **Step 2: Jalankan tes dan pastikan gagal**

Run: `pnpm vitest run tools/catalog/downloadPosters.test.ts`
Expected: FAIL karena modulnya belum ada.

- [ ] **Step 3: Tulis implementasi**

Buat `tools/catalog/downloadPosters.ts`:

```ts
import type { PosterRequest } from './fetchCatalog';

export interface DownloadedPoster {
  id: string;
  data: Uint8Array;
}

export interface DownloadPostersOptions {
  fetcher?: typeof fetch;
  concurrency?: number;
  timeoutMs?: number;
}

/**
 * Mengunduh poster dengan batas jumlah permintaan paralel.
 *
 * Poster yang gagal dibuang tanpa menggagalkan sisanya. Satu poster rusak
 * tidak boleh membuat seluruh build memakai katalog cadangan.
 *
 * Batas paralel dipakai supaya build tidak membuka 20 koneksi sekaligus ke
 * CDN gambar TMDB.
 */
export async function downloadPosters(
  requests: PosterRequest[],
  options: DownloadPostersOptions = {},
): Promise<DownloadedPoster[]> {
  const { fetcher = fetch, concurrency = 6, timeoutMs = 15_000 } = options;

  if (requests.length === 0) {
    return [];
  }

  const size = Math.max(1, Math.min(concurrency, requests.length));
  const results: DownloadedPoster[] = [];
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < requests.length) {
      const request = requests[cursor];
      cursor += 1;

      if (request === undefined) {
        continue;
      }

      try {
        const response = await fetcher(request.url, {
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
          continue;
        }

        const buffer = await response.arrayBuffer();
        results.push({ id: request.id, data: new Uint8Array(buffer) });
      } catch {
        // Diabaikan: lihat komentar fungsi.
      }
    }
  };

  await Promise.all(Array.from({ length: size }, () => worker()));

  return results;
}
```

- [ ] **Step 4: Jalankan tes dan pastikan lulus**

Run: `pnpm vitest run tools/catalog/downloadPosters.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/catalog/downloadPosters.ts tools/catalog/downloadPosters.test.ts
git commit -m "feat(catalog): unduh poster dengan batas paralel"
```

---

## Task 4: Vite plugin katalog

Perekat antara dunia Node dan build Vite. Plugin ini sengaja tipis: seluruh
logika sudah diuji di Task 1 sampai 3, sehingga yang tersisa hanya
penggabungan dan penyajian berkas.

**Files:**

- Create: `tools/catalog/vitePlugin.ts`
- Modify: `vite.config.ts` (daftarkan plugin, baca env)
- Modify: `eslint.config.js` (global Node untuk `tools/**/*.ts`)
- Modify: `.env.example` (dokumentasikan variabel katalog)
- Modify: `.github/workflows/deploy.yml` (meneruskan `secrets.TMDB_API_KEY`)

**Interfaces:**

- Consumes: `fetchCatalog()` dari Task 2, `downloadPosters()` dari Task 3.
- Produces: fungsi `catalogPlugin()` dengan tipe `CatalogPluginOptions`.

- [ ] **Step 1: Pastikan ESLint mengenali lingkungan Node di `tools/`**

`tools/` berjalan di Node, bukan di peramban. Tanpa langkah ini, `process` dan
`console` akan dilaporkan sebagai variabel yang tidak dikenal.

Pada `eslint.config.js`, ubah blok terakhir sehingga `tools/**/*.ts` memakai
global Node:

```js
  {
    files: [
      '*.config.{js,ts}',
      'vite.config.ts',
      'src/test-setup.ts',
      'tools/**/*.ts',
    ],
    languageOptions: { globals: { ...globals.node } },
  },
```

- [ ] **Step 2: Tulis plugin**

Buat `tools/catalog/vitePlugin.ts`:

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { downloadPosters } from './downloadPosters';
import { fetchCatalog } from './fetchCatalog';
import type { CatalogFile } from './types';

const CACHE_DIR = 'node_modules/.cache/drachin-catalog';
const CATALOG_FILE = 'catalog.json';

export interface CatalogPluginOptions {
  apiKey: string;
  limit?: number;
  language?: string;
  fallbackLanguage?: string;
  pagePool?: number;
  timeoutMs?: number;
}

interface GeneratedCatalog {
  catalog: CatalogFile;
  posters: Map<string, Uint8Array>;
}

/**
 * Membaca katalog dari cache saat mode dev.
 *
 * Tanpa cache ini, setiap kali server dev dijalankan ulang TMDB akan dipanggil
 * lagi dan puluhan permintaan trailer dikirim ulang.
 */
async function readCache(root: string): Promise<GeneratedCatalog | null> {
  try {
    const dir = path.resolve(root, CACHE_DIR);
    const raw = await readFile(path.join(dir, CATALOG_FILE), 'utf8');
    const catalog = JSON.parse(raw) as CatalogFile;
    const posters = new Map<string, Uint8Array>();

    for (const item of catalog.items) {
      if (item.poster === '') {
        continue;
      }

      try {
        const bytes = await readFile(path.join(dir, `${item.id}.jpg`));
        posters.set(item.id, new Uint8Array(bytes));
      } catch {
        // Poster hilang dari cache bukan masalah: kartu memakai gradien.
      }
    }

    return { catalog, posters };
  } catch {
    return null;
  }
}

async function writeCache(root: string, generated: GeneratedCatalog): Promise<void> {
  try {
    const dir = path.resolve(root, CACHE_DIR);
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, CATALOG_FILE),
      JSON.stringify(generated.catalog, null, 2),
      'utf8',
    );

    for (const [id, data] of generated.posters) {
      await writeFile(path.join(dir, `${id}.jpg`), data);
    }
  } catch {
    // Cache hanyalah percepatan. Gagal menulis tidak boleh menggagalkan build.
  }
}

export function catalogPlugin(options: CatalogPluginOptions): Plugin {
  let generated: GeneratedCatalog | null = null;
  let root = process.cwd();
  let isBuild = false;

  const generate = async (): Promise<GeneratedCatalog> => {
    const result = await fetchCatalog({
      apiKey: options.apiKey,
      limit: options.limit,
      language: options.language,
      fallbackLanguage: options.fallbackLanguage,
      pagePool: options.pagePool,
      timeoutMs: options.timeoutMs,
    });

    const downloaded = await downloadPosters(result.posters);
    const posters = new Map(downloaded.map((poster) => [poster.id, poster.data]));

    return { catalog: result.catalog, posters };
  };

  /**
   * Hasil hanya dihitung sekali per proses.
   *
   * Cache HANYA dipakai saat mode dev. Saat build, data selalu diambil ulang
   * dari TMDB. Tanpa aturan itu, build kedua akan memakai katalog hasil build
   * pertama dan isi katalog tidak akan pernah berubah. Itu merusak tujuan
   * utama fitur ini.
   */
  const resolve = async (): Promise<GeneratedCatalog> => {
    if (generated !== null) {
      return generated;
    }

    if (!isBuild) {
      const cached = await readCache(root);
      if (cached !== null) {
        generated = cached;
        return cached;
      }
    }

    generated = await generate();
    await writeCache(root, generated);
    return generated;
  };

  return {
    name: 'drachin-catalog',

    configResolved(config) {
      root = config.root;
      isBuild = config.command === 'build';
    },

    async buildStart() {
      const result = await resolve();

      if (result.catalog.source === 'fallback') {
        this.warn(
          'Katalog memakai data cadangan. Isi TMDB_API_KEY untuk memakai data asli dari TMDB.',
        );
      } else {
        this.info(
          `Katalog TMDB: ${String(result.catalog.items.length)} drama dari halaman ${String(result.catalog.page)}.`,
        );
      }

      this.emitFile({
        type: 'asset',
        fileName: CATALOG_FILE,
        source: JSON.stringify(result.catalog, null, 2),
      });

      for (const [id, data] of result.posters) {
        this.emitFile({ type: 'asset', fileName: `posters/${id}.jpg`, source: data });
      }
    },

    configureServer(server: ViteDevServer) {
      server.middlewares.use((request, response, next) => {
        const url = request.url ?? '';

        if (url.startsWith('/catalog.json')) {
          void resolve().then((result) => {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result.catalog));
          });
          return;
        }

        const posterMatch = /^\/posters\/([A-Za-z0-9_-]+)\.jpg/.exec(url);
        if (posterMatch?.[1] !== undefined) {
          const id = posterMatch[1];
          void resolve().then((result) => {
            const data = result.posters.get(id);

            if (data === undefined) {
              next();
              return;
            }

            response.setHeader('Content-Type', 'image/jpeg');
            response.end(Buffer.from(data));
          });
          return;
        }

        next();
      });
    },
  };
}

export default catalogPlugin;
```

- [ ] **Step 3: Daftarkan plugin di `vite.config.ts`**

Ganti seluruh isi `vite.config.ts` menjadi:

```ts
// loadEnv datang dari 'vite', sedangkan defineConfig tetap dari 'vitest/config'.
// Jangan ganti ke 'vite': defineConfig milik Vite tidak mengenal blok `test`,
// sehingga `pnpm typecheck` akan gagal pada berkas ini.
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { catalogPlugin } from './tools/catalog/vitePlugin';

// base: './' membuat semua path aset relatif sehingga aplikasi tetap bekerja
// baik di username.github.io/<repo>/ maupun di domain kustom, tanpa mengubah
// konfigurasi. Mendukung kebutuhan "domain akan berganti-ganti".
//
// TMDB_API_KEY dibaca lewat loadEnv dan HANYA dipakai di dalam plugin saat
// build. Nilainya tidak pernah masuk ke kode aplikasi, sehingga tidak pernah
// ikut terkirim ke browser.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: './',
    plugins: [
      react(),
      catalogPlugin({
        apiKey: env['TMDB_API_KEY'] ?? '',
        limit: Number(env['CATALOG_LIMIT'] ?? 20),
        language: env['CATALOG_LANGUAGE'] ?? 'id-ID',
        fallbackLanguage: env['CATALOG_FALLBACK_LANGUAGE'] ?? 'en-US',
        pagePool: Number(env['CATALOG_PAGE_POOL'] ?? 20),
        timeoutMs: Number(env['CATALOG_TIMEOUT_MS'] ?? 10_000),
      }),
    ],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test-setup.ts',
      include: ['src/**/*.test.{ts,tsx}', 'tools/**/*.test.ts'],
    },
  };
});
```

- [ ] **Step 4: Dokumentasikan variabel di `.env.example`**

Tambahkan ke bagian bawah `.env.example`:

```
# --- Katalog TMDB (hanya dipakai saat build) ---
#
# Key ini TIDAK berprefix VITE_, jadi tidak pernah masuk ke bundle browser.
# Di GitHub Actions, nilainya diambil dari repository secret TMDB_API_KEY.
#
# TMDB_API_KEY=
# CATALOG_LIMIT=20
# CATALOG_LANGUAGE=id-ID
# CATALOG_FALLBACK_LANGUAGE=en-US
# CATALOG_PAGE_POOL=20
# CATALOG_TIMEOUT_MS=10000
```

- [ ] **Step 5: Verifikasi build menghasilkan katalog**

Run: `pnpm build`
Expected: exit 0, dan muncul baris `Katalog TMDB: ... drama dari halaman ...`.

Run: `ls dist/catalog.json && ls dist/posters | head -3`
Expected: `dist/catalog.json` ada, dan `dist/posters/` berisi berkas `.jpg`.

Catatan: bila perintah `ls` gagal karena folder kosong, periksa apakah
`TMDB_API_KEY` terbaca. Tanpa kunci, katalog cadangan dipakai dan `posters/`
memang kosong.

- [ ] **Step 6: Verifikasi build tetap sukses tanpa kunci**

Run: `TMDB_API_KEY= pnpm build`
Expected: exit 0, muncul peringatan katalog memakai data cadangan, dan
`dist/catalog.json` memuat `"source": "fallback"`.

- [ ] **Step 7: Verifikasi kunci tidak masuk ke `dist/`**

Ganti `KUNCI_ANDA` dengan nilai sebenarnya, lalu:

```bash
grep -rl "KUNCI_ANDA" dist/ && echo "BAHAYA: kunci bocor" || echo "BERSIH: kunci tidak ada di dist"
```

Expected: `BERSIH: kunci tidak ada di dist`.

- [ ] **Step 8: Jalankan seluruh pemeriksaan**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: ketiganya exit 0.

- [ ] **Step 9: Teruskan secret ke build di GitHub Actions**

Tanpa langkah ini, situs yang sudah di-deploy akan **selalu** memakai katalog
cadangan, karena build di CI tidak pernah menerima kunci API. Ini celah yang
harus ditutup sebelum men-deploy.

Pada `.github/workflows/deploy.yml`, ganti baris `- run: pnpm build` menjadi:

```yaml
- run: pnpm build
  env:
    TMDB_API_KEY: ${{ secrets.TMDB_API_KEY }}

- name: Pastikan kunci API tidak bocor ke hasil build
  env:
    TMDB_API_KEY: ${{ secrets.TMDB_API_KEY }}
  run: |
    if [ -z "$TMDB_API_KEY" ]; then
      echo "TMDB_API_KEY kosong, pemeriksaan dilewati."
      exit 0
    fi

    if grep -rl -- "$TMDB_API_KEY" dist/; then
      echo "BAHAYA: kunci API ditemukan di dalam dist/"
      exit 1
    fi

    echo "BERSIH: kunci API tidak ada di dalam dist/"
```

Catatan: pemeriksaan ini ditulis sebagai perintah shell, bukan sebagai tes
Vitest, karena hanya di CI nilai kuncinya tersedia.

- [ ] **Step 10: Commit**

```bash
git add tools/catalog/vitePlugin.ts vite.config.ts eslint.config.js .env.example .github/workflows/deploy.yml
git commit -m "feat(catalog): sambungkan katalog ke build lewat Vite plugin"
```

---

## Task 5: Router hash

**Files:**

- Create: `src/lib/router.ts`
- Test: `src/lib/router.test.ts`

**Interfaces:**

- Consumes: tidak ada.
- Produces: tipe `Route`; konstanta `catalogHash`; fungsi `parseRoute()`,
  `buildHash()`, `detailHash()`.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `src/lib/router.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildHash, detailHash, parseRoute } from './router';

describe('parseRoute', () => {
  it('mengembalikan landing untuk hash kosong', () => {
    expect(parseRoute('')).toEqual({ name: 'landing' });
    expect(parseRoute('#')).toEqual({ name: 'landing' });
    expect(parseRoute('#/')).toEqual({ name: 'landing' });
  });

  it('mengenali katalog', () => {
    expect(parseRoute('#/katalog')).toEqual({ name: 'catalog' });
  });

  it('mengenali modal drama dan mengambil id-nya', () => {
    expect(parseRoute('#/drama/123')).toEqual({ name: 'catalog', detailId: '123' });
  });

  it('mengabaikan garis miring tambahan di akhir', () => {
    expect(parseRoute('#/katalog/')).toEqual({ name: 'catalog' });
    expect(parseRoute('#/drama/123/')).toEqual({ name: 'catalog', detailId: '123' });
  });

  it('mengembalikan landing untuk id kosong', () => {
    expect(parseRoute('#/drama/')).toEqual({ name: 'landing' });
    expect(parseRoute('#/drama')).toEqual({ name: 'landing' });
  });

  it('mengembalikan landing untuk hash yang tidak dikenal', () => {
    expect(parseRoute('#/entah')).toEqual({ name: 'landing' });
    expect(parseRoute('#/katalog/extra')).toEqual({ name: 'landing' });
  });

  it('menerima id bertanda hubung, karena id cadangan memakai huruf', () => {
    expect(parseRoute('#/drama/fallback-1')).toEqual({
      name: 'catalog',
      detailId: 'fallback-1',
    });
  });

  it('mengembalikan landing untuk nilai yang bukan string', () => {
    expect(parseRoute(undefined as unknown as string)).toEqual({ name: 'landing' });
  });
});

describe('buildHash', () => {
  it('membangun hash katalog', () => {
    expect(buildHash({ name: 'catalog' })).toBe('#/katalog');
  });

  it('membangun hash drama', () => {
    expect(buildHash({ name: 'catalog', detailId: '123' })).toBe('#/drama/123');
  });

  it('membangun hash landing', () => {
    expect(buildHash({ name: 'landing' })).toBe('#/');
  });

  it('bolak-balik parse dan build menghasilkan nilai yang sama', () => {
    const hash = buildHash({ name: 'catalog', detailId: 'fallback-1' });
    expect(parseRoute(hash)).toEqual({ name: 'catalog', detailId: 'fallback-1' });
  });
});

describe('detailHash', () => {
  it('membangun tautan modal', () => {
    expect(detailHash('94997')).toBe('#/drama/94997');
  });
});
```

- [ ] **Step 2: Jalankan tes dan pastikan gagal**

Run: `pnpm vitest run src/lib/router.test.ts`
Expected: FAIL karena modulnya belum ada.

- [ ] **Step 3: Tulis implementasi**

Buat `src/lib/router.ts`:

```ts
/**
 * Rute yang dikenali.
 *
 * Katalog dan modal berbagi rute yang sama: modal hanyalah lapisan di atas
 * katalog, sehingga halaman di belakangnya tidak pernah berubah.
 */
export interface Route {
  name: 'landing' | 'catalog';
  detailId?: string;
}

export const catalogHash = '#/katalog';

export function detailHash(id: string): string {
  return `#/drama/${encodeURIComponent(id)}`;
}

/** Mengubah hash menjadi rute. Hash yang tidak dikenali menjadi landing. */
export function parseRoute(hash: string): Route {
  if (typeof hash !== 'string') {
    return { name: 'landing' };
  }

  // Garis miring di akhir dibuang supaya #/katalog/ dan #/katalog sama.
  const clean = hash.replace(/^#/, '').replace(/\/+$/, '');

  if (clean === '' || clean === '/') {
    return { name: 'landing' };
  }

  if (clean === '/katalog') {
    return { name: 'catalog' };
  }

  const detail = /^\/drama\/([^/]+)$/.exec(clean);
  if (detail?.[1] !== undefined) {
    let id = detail[1];

    try {
      id = decodeURIComponent(id);
    } catch {
      // Hash yang berisi persen encoding rusak diperlakukan apa adanya.
    }

    if (id.trim() !== '') {
      return { name: 'catalog', detailId: id.trim() };
    }
  }

  return { name: 'landing' };
}

/** Mengubah rute menjadi hash. Kebalikan dari parseRoute. */
export function buildHash(route: Route): string {
  if (route.name === 'landing') {
    return '#/';
  }

  return route.detailId === undefined ? catalogHash : detailHash(route.detailId);
}
```

- [ ] **Step 4: Jalankan tes dan pastikan lulus**

Run: `pnpm vitest run src/lib/router.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/router.ts src/lib/router.test.ts
git commit -m "feat(router): router hash untuk landing, katalog, dan modal"
```

---

## Task 6: Validasi `catalog.json` dan hook pemuatannya

Data dari jaringan tidak pernah dipercaya begitu saja. Modul validasi dibuat
terpisah dan murni agar dapat diuji tanpa React.

**Files:**

- Create: `src/lib/catalogSchema.ts`
- Create: `src/hooks/useCatalog.ts`
- Test: `src/lib/catalogSchema.test.ts`
- Test: `src/hooks/useCatalog.test.ts`

**Interfaces:**

- Consumes: tipe `CatalogFile`, `CatalogItem` dari Task 1.
- Produces: fungsi `parseCatalog()`, `loadCatalog()`; hook `useCatalog()`
  dengan tipe `UseCatalogResult`.

- [ ] **Step 1: Tulis tes validasi yang gagal**

Buat `src/lib/catalogSchema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseCatalog } from './catalogSchema';

const item = {
  id: '1',
  title: 'Judul',
  overview: 'Sinopsis',
  year: '2022',
  rating: 8.4,
  poster: './posters/1.jpg',
  trailerKey: 'abcdefghijk',
};

const file = {
  generatedAt: '2026-09-16T00:00:00.000Z',
  source: 'tmdb',
  page: 7,
  items: [item],
};

describe('parseCatalog', () => {
  it('menerima berkas yang valid', () => {
    const parsed = parseCatalog(file);

    expect(parsed?.items).toHaveLength(1);
    expect(parsed?.items[0]?.title).toBe('Judul');
    expect(parsed?.page).toBe(7);
    expect(parsed?.source).toBe('tmdb');
  });

  it('mengembalikan null untuk masukan bukan objek', () => {
    expect(parseCatalog(null)).toBeNull();
    expect(parseCatalog('bukan objek')).toBeNull();
    expect(parseCatalog([])).toBeNull();
  });

  it('mengembalikan null bila tidak ada satu pun entri yang dapat dipakai', () => {
    expect(parseCatalog({ items: [] })).toBeNull();
    expect(parseCatalog({ items: [{ id: '1' }] })).toBeNull();
  });

  it('membuang entri cacat tanpa membuang entri yang sehat', () => {
    const parsed = parseCatalog({ ...file, items: [item, { id: '2' }, null] });

    expect(parsed?.items.map((entry) => entry.id)).toEqual(['1']);
  });

  it('mengisi nilai aman untuk medan yang hilang', () => {
    const parsed = parseCatalog({
      items: [{ id: '9', title: 'Judul', overview: 'Ada', poster: './posters/9.jpg' }],
    });

    expect(parsed?.items[0]).toEqual({
      id: '9',
      title: 'Judul',
      overview: 'Ada',
      year: '',
      rating: 0,
      poster: './posters/9.jpg',
      trailerKey: '',
    });
    expect(parsed?.source).toBe('fallback');
    expect(parsed?.page).toBe(0);
  });

  it('menolak trailerKey yang bentuknya tidak sah', () => {
    const parsed = parseCatalog({ ...file, items: [{ ...item, trailerKey: 'pendek' }] });

    expect(parsed?.items[0]?.trailerKey).toBe('');
  });

  it('menolak rating di luar rentang', () => {
    const parsed = parseCatalog({ ...file, items: [{ ...item, rating: 99 }] });

    expect(parsed?.items[0]?.rating).toBe(0);
  });

  it('mengabaikan poster yang bukan jalur relatif di dalam situs', () => {
    const parsed = parseCatalog({
      ...file,
      items: [{ ...item, poster: 'https://jahat.example/x.jpg' }],
    });

    expect(parsed?.items[0]?.poster).toBe('');
  });

  it('mengabaikan poster dengan jalur keluar dari folder posters', () => {
    const parsed = parseCatalog({
      ...file,
      items: [{ ...item, poster: './posters/../../rahasia.jpg' }],
    });

    expect(parsed?.items[0]?.poster).toBe('');
  });
});
```

- [ ] **Step 2: Jalankan tes dan pastikan gagal**

Run: `pnpm vitest run src/lib/catalogSchema.test.ts`
Expected: FAIL karena modulnya belum ada.

- [ ] **Step 3: Tulis implementasi validasi**

Buat `src/lib/catalogSchema.ts`:

```ts
import type { CatalogFile, CatalogItem } from '../../tools/catalog/types';

const YOUTUBE_KEY = /^[A-Za-z0-9_-]{11}$/;
// Hanya jalur relatif di dalam folder posters sendiri. Pola ini juga menolak
// jalur yang keluar dari folder, seperti ./posters/../../rahasia.jpg.
const RELATIVE_POSTER = /^\.\/posters\/[A-Za-z0-9_-]+\.jpg$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toItem(raw: unknown): CatalogItem | null {
  if (!isRecord(raw)) {
    return null;
  }

  const id = readText(raw['id']);
  const title = readText(raw['title']);

  if (id === '' || title === '') {
    return null;
  }

  const rating = raw['rating'];
  const poster = readText(raw['poster']);
  const trailerKey = readText(raw['trailerKey']);

  return {
    id,
    title,
    overview: readText(raw['overview']),
    year: readText(raw['year']),
    rating:
      typeof rating === 'number' && Number.isFinite(rating) && rating >= 0 && rating <= 10
        ? rating
        : 0,
    poster: RELATIVE_POSTER.test(poster) ? poster : '',
    trailerKey: YOUTUBE_KEY.test(trailerKey) ? trailerKey : '',
  };
}

/**
 * Menormalkan catalog.json.
 * Mengembalikan null bila tidak ada satu pun entri yang dapat dipakai.
 */
export function parseCatalog(raw: unknown): CatalogFile | null {
  if (!isRecord(raw)) {
    return null;
  }

  const rawItems = Array.isArray(raw['items']) ? raw['items'] : [];
  const items = rawItems
    .map(toItem)
    .filter((entry): entry is CatalogItem => entry !== null);

  if (items.length === 0) {
    return null;
  }

  const page = raw['page'];

  return {
    generatedAt: readText(raw['generatedAt']) || '1970-01-01T00:00:00.000Z',
    source: raw['source'] === 'tmdb' ? 'tmdb' : 'fallback',
    page: typeof page === 'number' && Number.isFinite(page) ? page : 0,
    items,
  };
}

/** Memuat catalog.json dari jaringan. Mengembalikan null bila gagal. */
export async function loadCatalog(
  fetcher: typeof fetch = fetch,
): Promise<CatalogFile | null> {
  try {
    // Query timestamp dipakai sebagai cache busting, sama seperti config.json.
    const response = await fetcher(`./catalog.json?t=${String(Date.now())}`);

    if (!response.ok) {
      return null;
    }

    return parseCatalog(await response.json());
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Jalankan tes validasi dan pastikan lulus**

Run: `pnpm vitest run src/lib/catalogSchema.test.ts`
Expected: PASS.

- [ ] **Step 5: Tulis tes hook yang gagal**

Buat `src/hooks/useCatalog.test.ts`:

```ts
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
```

- [ ] **Step 6: Jalankan tes hook dan pastikan gagal**

Run: `pnpm vitest run src/hooks/useCatalog.test.ts`
Expected: FAIL karena `useCatalog` belum ada.

- [ ] **Step 7: Tulis implementasi hook**

Buat `src/hooks/useCatalog.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import type { CatalogFile } from '../../tools/catalog/types';
import { loadCatalog } from '../lib/catalogSchema';

export interface UseCatalogResult {
  catalog: CatalogFile | null;
  failed: boolean;
  retry: () => void;
}

/**
 * Memuat catalog.json satu kali, dengan penjaga pembatalan.
 *
 * Penjaga ini penting: tanpa itu, komponen yang sudah dilepas masih menulis
 * state saat balasan jaringan tiba, dan React akan memperingatkannya.
 */
export function useCatalog(fetcher?: typeof fetch): UseCatalogResult {
  const [catalog, setCatalog] = useState<CatalogFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    setFailed(false);

    void loadCatalog(fetcher).then((loaded) => {
      if (!active) {
        return;
      }

      if (loaded === null) {
        setFailed(true);
        return;
      }

      setCatalog(loaded);
    });

    return () => {
      active = false;
    };
  }, [fetcher, attempt]);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  return { catalog, failed, retry };
}
```

- [ ] **Step 8: Jalankan tes hook dan pastikan lulus**

Run: `pnpm vitest run src/hooks/useCatalog.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/catalogSchema.ts src/lib/catalogSchema.test.ts src/hooks/useCatalog.ts src/hooks/useCatalog.test.ts
git commit -m "feat(catalog): validasi catalog.json dan hook pemuatannya"
```

---

## Task 7: Penantian unduhan poster

Ini syarat wajib dari pemilik proyek: overlay spinner bertahan sampai semua
poster selesai diunduh.

**Files:**

- Create: `src/hooks/useImagePreloader.ts`
- Test: `src/hooks/useImagePreloader.test.ts`

**Interfaces:**

- Consumes: tidak ada.
- Produces: tipe `PreloadOptions`; fungsi `preloadImages()`, hook
  `useImagePreloader()`.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `src/hooks/useImagePreloader.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { preloadImages, useImagePreloader } from './useImagePreloader';

interface FakeImage {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
}

const created: FakeImage[] = [];

/** Mengganti Image global dengan tiruan yang dapat dipicu manual. */
function stubImage(): void {
  created.length = 0;
  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = '';

      constructor() {
        created.push(this as unknown as FakeImage);
      }
    },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('preloadImages', () => {
  it('selesai hanya setelah semua gambar memanggil onload', async () => {
    stubImage();

    let done = false;
    void preloadImages(['a.jpg', 'b.jpg']).then(() => {
      done = true;
    });

    created[0]?.onload?.();
    await Promise.resolve();
    expect(done).toBe(false);

    created[1]?.onload?.();
    await waitFor(() => {
      expect(done).toBe(true);
    });
  });

  it('menghitung gambar yang gagal sebagai selesai', async () => {
    stubImage();

    let done = false;
    void preloadImages(['a.jpg']).then(() => {
      done = true;
    });

    created[0]?.onerror?.();
    await waitFor(() => {
      expect(done).toBe(true);
    });
  });

  it('selesai segera untuk daftar kosong tanpa membuat gambar', async () => {
    stubImage();

    await preloadImages([]);

    expect(created).toHaveLength(0);
  });

  it('selesai setelah batas waktu walau gambar tidak pernah menjawab', async () => {
    stubImage();
    vi.useFakeTimers();

    let done = false;
    void preloadImages(['a.jpg'], { timeoutMs: 5000 }).then(() => {
      done = true;
    });

    await vi.advanceTimersByTimeAsync(5000);
    expect(done).toBe(true);
  });

  it('memasang src pada setiap gambar', async () => {
    stubImage();

    void preloadImages(['a.jpg', 'b.jpg']);
    await Promise.resolve();

    expect(created.map((image) => image.src)).toEqual(['a.jpg', 'b.jpg']);
  });
});

describe('useImagePreloader', () => {
  it('mulai dari memuat lalu berubah menjadi selesai', async () => {
    stubImage();

    const { result } = renderHook(() => useImagePreloader(['a.jpg']));
    expect(result.current).toBe(true);

    created[0]?.onload?.();
    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it('tidak memuat apa pun bila daftar kosong', async () => {
    stubImage();

    const { result } = renderHook(() => useImagePreloader([]));

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
    expect(created).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Jalankan tes dan pastikan gagal**

Run: `pnpm vitest run src/hooks/useImagePreloader.test.ts`
Expected: FAIL karena modulnya belum ada.

- [ ] **Step 3: Tulis implementasi**

Buat `src/hooks/useImagePreloader.ts`:

```ts
import { useEffect, useState } from 'react';

const DEFAULT_TIMEOUT_MS = 12_000;

export interface PreloadOptions {
  timeoutMs?: number;
}

/**
 * Menunggu semua gambar selesai diunduh.
 *
 * Memakai objek `new Image()` alih-alih elemen <img> di dalam grid, karena
 * objek ini dapat mulai diunduh sebelum React merender apa pun.
 *
 * Gambar yang gagal dihitung selesai. Tanpa aturan itu, satu poster rusak akan
 * membuat overlay menggantung selamanya.
 */
export function preloadImages(
  urls: string[],
  options: PreloadOptions = {},
): Promise<void> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  if (urls.length === 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let remaining = urls.length;
    let settled = false;

    const finish = (): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      resolve();
    };

    // Batas waktu pengaman: pengunjung tidak boleh terjebak di balik overlay
    // hanya karena satu gambar tidak pernah menjawab.
    const timer = setTimeout(finish, timeoutMs);

    for (const url of urls) {
      const image = new Image();

      const step = (): void => {
        remaining -= 1;
        if (remaining <= 0) {
          finish();
        }
      };

      image.onload = step;
      image.onerror = step;
      image.src = url;
    }
  });
}

/** Mengembalikan true selama setidaknya satu poster belum selesai diunduh. */
export function useImagePreloader(urls: string[], timeoutMs?: number): boolean {
  const [loading, setLoading] = useState(urls.length > 0);

  // Kunci dibuat dari URL agar efek tidak berjalan ulang hanya karena array
  // baru dibuat pada setiap render. Tanpa ini, penantian akan mengulang terus
  // dan overlay tidak pernah hilang.
  const key = urls.join('|');

  useEffect(() => {
    let active = true;

    setLoading(urls.length > 0);

    void preloadImages(urls, timeoutMs === undefined ? {} : { timeoutMs }).then(() => {
      if (active) {
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
    // urls diwakili oleh key supaya efek tidak berjalan ulang setiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, timeoutMs]);

  return loading;
}
```

- [ ] **Step 4: Jalankan tes dan pastikan lulus**

Run: `pnpm vitest run src/hooks/useImagePreloader.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useImagePreloader.ts src/hooks/useImagePreloader.test.ts
git commit -m "feat(catalog): tunggu unduhan poster sebelum menampilkan katalog"
```

---

## Task 8: Modal trailer

**Files:**

- Modify: `src/test-setup.ts` (tiruan `showModal` dan `close` untuk jsdom)
- Create: `src/components/TrailerModal.tsx`
- Test: `src/components/TrailerModal.test.tsx`

**Interfaces:**

- Consumes: tipe `CatalogItem` dari Task 1 dan `CtaButton` dari
  `src/components/CtaButton.tsx`. Modal sengaja **tidak** memanggil
  `openAffiliate()` sendiri: pemilihan link adalah tanggung jawab halaman
  katalog, yang meneruskannya lewat properti `onWatch`.
- Produces: komponen `TrailerModal` dengan properti
  `{ item: CatalogItem | null; onClose: () => void; ctaText?: string; onWatch?: () => void }`.

- [ ] **Step 1: Tambahkan tiruan `dialog` untuk jsdom**

Diukur langsung pada jsdom yang dipakai proyek ini:
`HTMLDialogElement.prototype.showModal` bernilai `undefined`, sehingga komponen
yang memanggilnya akan melempar `TypeError` dan tesnya tidak menguji apa pun.

Ganti seluruh isi `src/test-setup.ts` menjadi:

```ts
import '@testing-library/jest-dom/vitest';

// jsdom mengenali elemen <dialog> tetapi tidak menyediakan showModal dan close.
// Tanpa tiruan ini, komponen modal akan melempar TypeError saat diuji.
//
// Tiruan ini sengaja sederhana: tujuannya mencegah TypeError, bukan meniru
// perangkap fokus yang asli. Perangkap fokus, tombol Esc, dan klik latar tidak
// dapat dibuktikan di jsdom dan wajib diuji di peramban sungguhan.
const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;

if (typeof dialogProto['showModal'] !== 'function') {
  dialogProto['showModal'] = function showModal(this: HTMLDialogElement): void {
    this.setAttribute('open', '');
  };
}

if (typeof dialogProto['close'] !== 'function') {
  dialogProto['close'] = function close(this: HTMLDialogElement): void {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
```

- [ ] **Step 2: Tulis tes yang gagal**

Buat `src/components/TrailerModal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../tools/catalog/types';
import { TrailerModal } from './TrailerModal';

const item: CatalogItem = {
  id: '123',
  title: 'Judul Drama',
  overview: 'Sinopsis drama.',
  year: '2022',
  rating: 8.4,
  poster: './posters/123.jpg',
  trailerKey: 'abcdefghijk',
};

const noop = () => undefined;

describe('TrailerModal', () => {
  it('tidak merender iframe saat tidak ada item', () => {
    render(<TrailerModal item={null} onClose={noop} />);

    expect(document.querySelector('iframe')).toBeNull();
  });

  it('merender iframe YouTube begitu modal dibuka', () => {
    render(<TrailerModal item={item} onClose={noop} />);

    const src = document.querySelector('iframe')?.getAttribute('src') ?? '';
    expect(src).toContain('youtube-nocookie.com/embed/abcdefghijk');
  });

  it('menyalakan autoplay dan membatasi video rekomendasi', () => {
    render(<TrailerModal item={item} onClose={noop} />);

    const src = document.querySelector('iframe')?.getAttribute('src') ?? '';
    expect(src).toContain('autoplay=1');
    expect(src).toContain('rel=0');
  });

  it('memberi izin autoplay pada atribut allow iframe', () => {
    render(<TrailerModal item={item} onClose={noop} />);

    const allow = document.querySelector('iframe')?.getAttribute('allow') ?? '';
    expect(allow).toContain('autoplay');
  });

  it('tidak merender iframe bila trailerKey kosong', () => {
    render(<TrailerModal item={{ ...item, trailerKey: '' }} onClose={noop} />);

    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByText(/trailer belum tersedia/i)).toBeInTheDocument();
  });

  it('menampilkan judul, tahun, rating, dan sinopsis', () => {
    render(<TrailerModal item={item} onClose={noop} />);

    expect(screen.getByRole('heading', { name: 'Judul Drama' })).toBeInTheDocument();
    expect(screen.getByText('2022')).toBeInTheDocument();
    expect(screen.getByText(/8\.4/)).toBeInTheDocument();
    expect(screen.getByText('Sinopsis drama.')).toBeInTheDocument();
  });

  it('selalu menampilkan tombol Shopee', () => {
    render(<TrailerModal item={item} onClose={noop} />);

    expect(screen.getByRole('button', { name: /tonton full/i })).toBeInTheDocument();
  });

  it('memanggil onClose saat tombol tutup diklik', async () => {
    const onClose = vi.fn();
    render(<TrailerModal item={item} onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: /tutup/i }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('membuang iframe dari DOM saat item menjadi null', () => {
    const { rerender } = render(<TrailerModal item={item} onClose={noop} />);
    expect(document.querySelector('iframe')).not.toBeNull();

    rerender(<TrailerModal item={null} onClose={noop} />);

    expect(document.querySelector('iframe')).toBeNull();
  });

  it('memanggil onWatch saat tombol Shopee diklik', async () => {
    const onWatch = vi.fn();
    render(<TrailerModal item={item} onClose={noop} onWatch={onWatch} />);

    await userEvent.click(screen.getByRole('button', { name: /tonton full/i }));

    expect(onWatch).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: Jalankan tes dan pastikan gagal**

Run: `pnpm vitest run src/components/TrailerModal.test.tsx`
Expected: FAIL karena komponennya belum ada.

- [ ] **Step 4: Tulis implementasi modal**

Buat `src/components/TrailerModal.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import type { CatalogItem } from '../../tools/catalog/types';
import { CtaButton } from './CtaButton';

interface TrailerModalProps {
  item: CatalogItem | null;
  onClose: () => void;
  ctaText?: string;
  onWatch?: () => void;
}

/**
 * Modal trailer di atas katalog.
 *
 * Memakai <dialog> native agar perangkap fokus dan tombol Esc ditangani
 * peramban, bukan ditulis manual.
 *
 * Iframe hanya dirender selama ada item. Bila dibiarkan terpasang, suara
 * trailer akan terus berbunyi walau modalnya sudah tidak terlihat.
 */
export function TrailerModal({ item, onClose, ctaText, onWatch }: TrailerModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const open = item !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      // Fokus diarahkan ke tombol tutup, bukan ke iframe, supaya pengunjung
      // melihat dulu apa yang sedang terbuka.
      closeRef.current?.focus();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Kunci gulir halaman di belakang modal. Nilai asli selalu dipulihkan supaya
  // halaman tidak tertinggal dalam keadaan tidak dapat digulir.
  useEffect(() => {
    if (!open) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-label={item === null ? 'Trailer' : `Trailer ${item.title}`}
      onClose={onClose}
      onClick={(event) => {
        // Hanya klik tepat pada elemen <dialog> yang dihitung sebagai latar.
        // Karena itu <dialog> tidak boleh diberi padding: area padding akan ikut
        // terhitung sebagai latar dan menutup modal secara tak terduga.
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      {item !== null && (
        <div className="modal__panel">
          <button
            ref={closeRef}
            type="button"
            className="modal__close"
            aria-label="Tutup"
            onClick={onClose}
          >
            ✕
          </button>

          <div className="modal__player">
            {item.trailerKey === '' ? (
              <p className="modal__no-trailer">Trailer belum tersedia untuk judul ini.</p>
            ) : (
              <iframe
                className="modal__frame"
                title={`Trailer ${item.title}`}
                src={`https://www.youtube-nocookie.com/embed/${item.trailerKey}?autoplay=1&rel=0&playsinline=1&modestbranding=1`}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>

          <div className="modal__body">
            <h2 className="modal__title">{item.title}</h2>

            {(item.year !== '' || item.rating > 0) && (
              <p className="modal__meta">
                {item.year !== '' && <span>{item.year}</span>}
                {item.rating > 0 && <span>★ {item.rating.toFixed(1)}</span>}
              </p>
            )}

            {item.overview !== '' && <p className="modal__overview">{item.overview}</p>}

            <CtaButton
              label={ctaText ?? 'TONTON FULL DI SHOPEE'}
              onClick={onWatch ?? noop}
            />

            <p className="modal__attribution">
              This product uses the TMDB API but is not endorsed or certified by TMDB.
            </p>
          </div>
        </div>
      )}
    </dialog>
  );
}

function noop(): void {
  // Tombol tetap tampil walau tidak ada penangan. Lebih baik begitu daripada
  // tombol mati tanpa penjelasan.
}
```

- [ ] **Step 5: Jalankan tes dan pastikan lulus**

Run: `pnpm vitest run src/components/TrailerModal.test.tsx`
Expected: PASS.

- [ ] **Step 6: Catat apa yang tidak dibuktikan tes ini**

Perangkap fokus, tombol Esc, klik latar, penguncian gulir, dan apakah trailer
benar-benar berputar **tidak** dibuktikan jsdom. Semuanya wajib diuji di
peramban sungguhan pada Task 13. Jangan menganggap tes di atas sudah
membuktikannya.

- [ ] **Step 7: Commit**

```bash
git add src/test-setup.ts src/components/TrailerModal.tsx src/components/TrailerModal.test.tsx
git commit -m "feat(modal): modal trailer berbasis dialog native"
```

---

## Task 9: Halaman landing dengan hitungan mundur

Isi `App.tsx` yang sekarang pindah ke sini, dengan satu perubahan: tombol utama
masuk ke katalog, bukan langsung membuka Shopee.

**Files:**

- Create: `src/pages/LandingPage.tsx`
- Test: `src/pages/LandingPage.test.tsx`

**Interfaces:**

- Consumes: tipe `SiteConfig` dari `src/lib/config.ts`; `CtaButton`.
- Produces: komponen `LandingPage` dengan properti
  `{ config: SiteConfig; onEnterCatalog: () => void; autoEnterSeconds?: number }`.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `src/pages/LandingPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FALLBACK_CONFIG } from '../lib/config';
import { LandingPage } from './LandingPage';

afterEach(() => {
  vi.useRealTimers();
});

describe('LandingPage', () => {
  it('menampilkan headline dan badge dari config', () => {
    render(<LandingPage config={FALLBACK_CONFIG} onEnterCatalog={() => undefined} />);

    expect(
      screen.getByRole('heading', { name: FALLBACK_CONFIG.headline }),
    ).toBeInTheDocument();

    for (const badge of FALLBACK_CONFIG.badges) {
      expect(screen.getByText(badge)).toBeInTheDocument();
    }
  });

  it('tombol utama masuk ke katalog', async () => {
    const onEnterCatalog = vi.fn();
    render(<LandingPage config={FALLBACK_CONFIG} onEnterCatalog={onEnterCatalog} />);

    await userEvent.click(screen.getByRole('button', { name: /lihat katalog/i }));

    expect(onEnterCatalog).toHaveBeenCalledOnce();
  });

  it('masuk katalog otomatis setelah hitungan mundur selesai', async () => {
    vi.useFakeTimers();
    const onEnterCatalog = vi.fn();

    render(
      <LandingPage
        config={FALLBACK_CONFIG}
        onEnterCatalog={onEnterCatalog}
        autoEnterSeconds={8}
      />,
    );

    await vi.advanceTimersByTimeAsync(8000);

    expect(onEnterCatalog).toHaveBeenCalledOnce();
  });

  it('menampilkan hitungan mundur yang dapat dibatalkan', async () => {
    const onEnterCatalog = vi.fn();
    const user = userEvent.setup();

    render(
      <LandingPage
        config={FALLBACK_CONFIG}
        onEnterCatalog={onEnterCatalog}
        autoEnterSeconds={0.05}
      />,
    );

    await user.click(screen.getByRole('button', { name: /batalkan/i }));
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(onEnterCatalog).not.toHaveBeenCalled();
  });

  it('menyembunyikan hitungan mundur setelah dibatalkan', async () => {
    render(
      <LandingPage
        config={FALLBACK_CONFIG}
        onEnterCatalog={() => undefined}
        autoEnterSeconds={30}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /batalkan/i }));

    expect(screen.queryByText(/masuk katalog otomatis/i)).not.toBeInTheDocument();
  });

  it('tidak masuk otomatis setelah komponen dilepas', async () => {
    vi.useFakeTimers();
    const onEnterCatalog = vi.fn();

    const { unmount } = render(
      <LandingPage
        config={FALLBACK_CONFIG}
        onEnterCatalog={onEnterCatalog}
        autoEnterSeconds={8}
      />,
    );

    unmount();
    await vi.advanceTimersByTimeAsync(20_000);

    expect(onEnterCatalog).not.toHaveBeenCalled();
  });

  it('memakai latar gradien saat poster gagal dimuat', () => {
    render(<LandingPage config={FALLBACK_CONFIG} onEnterCatalog={() => undefined} />);

    const poster = document.querySelector('.poster__img');
    expect(poster).not.toBeNull();

    poster?.dispatchEvent(new Event('error'));

    expect(document.querySelector('.poster__img')).toBeNull();
  });

  it('tidak menghitung mundur bila autoEnterSeconds bernilai 0', async () => {
    vi.useFakeTimers();
    const onEnterCatalog = vi.fn();

    render(
      <LandingPage
        config={FALLBACK_CONFIG}
        onEnterCatalog={onEnterCatalog}
        autoEnterSeconds={0}
      />,
    );

    await vi.advanceTimersByTimeAsync(30_000);

    expect(onEnterCatalog).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Jalankan tes dan pastikan gagal**

Run: `pnpm vitest run src/pages/LandingPage.test.tsx`
Expected: FAIL karena `LandingPage` belum ada.

- [ ] **Step 3: Tulis implementasi**

Buat `src/pages/LandingPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { CtaButton } from '../components/CtaButton';
import type { SiteConfig } from '../lib/config';

interface LandingPageProps {
  config: SiteConfig;
  onEnterCatalog: () => void;
  autoEnterSeconds?: number;
}

/**
 * Halaman clickbait.
 *
 * Tombol utama masuk ke katalog. Pengunjung yang pasif juga didorong masuk
 * lewat hitungan mundur yang terlihat dan dapat dibatalkan.
 */
export function LandingPage({
  config,
  onEnterCatalog,
  autoEnterSeconds = 8,
}: LandingPageProps) {
  const [posterFailed, setPosterFailed] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [remaining, setRemaining] = useState(Math.ceil(autoEnterSeconds));

  useEffect(() => {
    if (cancelled || autoEnterSeconds <= 0) {
      return;
    }

    const deadline = Date.now() + autoEnterSeconds * 1000;

    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);

      if (left <= 0) {
        clearInterval(tick);
        onEnterCatalog();
      }
    }, 250);

    // Pembersihan ini wajib: tanpa itu, pengunjung yang sudah berpindah
    // halaman tetap akan dipindahkan lagi oleh timer yang tertinggal.
    return () => {
      clearInterval(tick);
    };
  }, [autoEnterSeconds, cancelled, onEnterCatalog]);

  return (
    <main className="page">
      <div className="poster">
        {!posterFailed && (
          <img
            className="poster__img"
            src={config.poster}
            alt=""
            fetchPriority="high"
            onError={() => {
              setPosterFailed(true);
            }}
          />
        )}
        <div className="poster__scrim" />
      </div>

      <section className="content">
        {config.badges.length > 0 && (
          <ul className="badges">
            {config.badges.map((badge) => (
              <li key={badge} className="badges__item">
                {badge}
              </li>
            ))}
          </ul>
        )}

        <h1 className="headline">{config.headline}</h1>
        <p className="subheadline">{config.subheadline}</p>

        <CtaButton label="LIHAT KATALOG" onClick={onEnterCatalog} />

        {!cancelled && autoEnterSeconds > 0 && (
          <p className="countdown">
            Masuk katalog otomatis dalam {remaining} detik.{' '}
            <button
              type="button"
              className="countdown__cancel"
              onClick={() => {
                setCancelled(true);
              }}
            >
              Batalkan
            </button>
          </p>
        )}

        <p className="note">Gratis • Tanpa registrasi</p>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Jalankan tes dan pastikan lulus**

Run: `pnpm vitest run src/pages/LandingPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/LandingPage.tsx src/pages/LandingPage.test.tsx
git commit -m "feat(landing): tombol katalog dan hitungan mundur 8 detik"
```

---

## Task 10: Kartu drama, overlay, dan halaman katalog

**Files:**

- Create: `src/components/MovieCard.tsx`
- Create: `src/components/LoadingOverlay.tsx`
- Create: `src/pages/CatalogPage.tsx`
- Test: `src/pages/CatalogPage.test.tsx`

**Interfaces:**

- Consumes: tipe `CatalogFile`, `CatalogItem` dari Task 1; `TrailerModal` dari
  Task 8; `useImagePreloader` dari Task 7; `pickLink` dari `src/lib/links.ts`;
  `openAffiliate` dari `src/lib/redirect.ts`; tipe `SiteConfig`.
- Produces: komponen `MovieCard`, `LoadingOverlay`, dan `CatalogPage` dengan
  properti `{ catalog: CatalogFile | null; config: SiteConfig;
detailId: string | undefined; onOpenDetail: (id: string) => void;
onCloseDetail: () => void; onRetry?: () => void }`.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `src/pages/CatalogPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
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
      catalog: {
        ...catalog,
        items: [{ ...catalog.items[0]!, poster: './posters/1.jpg' }],
      },
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('menyembunyikan overlay setelah semua poster selesai', async () => {
    stubImageDone();

    renderPage({
      catalog: {
        ...catalog,
        items: [{ ...catalog.items[0]!, poster: './posters/1.jpg' }],
      },
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

  it('memakai rotasi link dari config saat tombol Shopee di modal diklik', async () => {
    stubImageDone();
    const openSpy = vi.fn(() => null);
    vi.stubGlobal('open', openSpy);

    renderPage({ detailId: '1' });
    await userEvent.click(screen.getByRole('button', { name: /tonton full/i }));

    expect(openSpy).toHaveBeenCalledOnce();
    expect(String(openSpy.mock.calls[0]?.[0])).toContain('s.shopee.co.id');
  });

  it('memakai navigasi same-tab bila popup diblokir', async () => {
    stubImageDone();
    vi.stubGlobal('open', () => null);

    renderPage({ detailId: '1' });

    // location.href tidak dapat diubah di jsdom, jadi hanya dipastikan tidak
    // ada lemparan. Pengujian sesungguhnya ada di Task 13 di peramban asli.
    await userEvent.click(screen.getByRole('button', { name: /tonton full/i }));
  });
});
```

- [ ] **Step 2: Jalankan tes dan pastikan gagal**

Run: `pnpm vitest run src/pages/CatalogPage.test.tsx`
Expected: FAIL karena halaman belum ada.

- [ ] **Step 3: Tulis kartu dan overlay**

Buat `src/components/MovieCard.tsx`:

```tsx
import { useState } from 'react';
import type { CatalogItem } from '../../tools/catalog/types';

interface MovieCardProps {
  item: CatalogItem;
  onSelect: (id: string) => void;
}

/**
 * Satu kartu drama.
 *
 * Memakai <button> asli agar dapat dijangkau papan ketik dan memiliki
 * accessible name dari teks di dalamnya.
 */
export function MovieCard({ item, onSelect }: MovieCardProps) {
  const [failed, setFailed] = useState(false);
  const showImage = item.poster !== '' && !failed;

  return (
    <button
      type="button"
      className="card"
      onClick={() => {
        onSelect(item.id);
      }}
    >
      <span className="card__poster">
        {showImage && (
          <img
            className="card__img"
            src={item.poster}
            alt=""
            loading="lazy"
            onError={() => {
              setFailed(true);
            }}
          />
        )}

        {item.trailerKey !== '' && (
          <span className="card__play" aria-hidden="true">
            ▶
          </span>
        )}
      </span>

      <span className="card__title">{item.title}</span>

      {(item.year !== '' || item.rating > 0) && (
        <span className="card__meta">
          {item.year !== '' && <span>{item.year}</span>}
          {item.rating > 0 && <span>★ {item.rating.toFixed(1)}</span>}
        </span>
      )}
    </button>
  );
}
```

Buat `src/components/LoadingOverlay.tsx`:

```tsx
/**
 * Overlay pemuatan katalog.
 *
 * Tampil selama poster belum selesai diunduh, supaya katalog tidak pernah
 * terlihat setengah jadi. `role="status"` membuat pembaca layar mengumumkan
 * keadaannya.
 */
export function LoadingOverlay() {
  return (
    <div className="overlay" role="status" aria-live="polite" aria-busy="true">
      <span className="overlay__spinner" aria-hidden="true" />
      <p className="overlay__text">Menyiapkan katalog…</p>
    </div>
  );
}
```

- [ ] **Step 4: Tulis halaman katalog**

Buat `src/pages/CatalogPage.tsx`:

```tsx
import { useCallback, useMemo } from 'react';
import type { CatalogFile } from '../../tools/catalog/types';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { MovieCard } from '../components/MovieCard';
import { TrailerModal } from '../components/TrailerModal';
import { useImagePreloader } from '../hooks/useImagePreloader';
import type { SiteConfig } from '../lib/config';
import { pickLink } from '../lib/links';
import { openAffiliate } from '../lib/redirect';

interface CatalogPageProps {
  catalog: CatalogFile | null;
  config: SiteConfig;
  detailId: string | undefined;
  onOpenDetail: (id: string) => void;
  onCloseDetail: () => void;
  onRetry?: () => void;
}

export function CatalogPage({
  catalog,
  config,
  detailId,
  onOpenDetail,
  onCloseDetail,
  onRetry,
}: CatalogPageProps) {
  const posterUrls = useMemo(
    () =>
      (catalog?.items ?? []).map((item) => item.poster).filter((poster) => poster !== ''),
    [catalog],
  );

  const loading = useImagePreloader(posterUrls);

  const selected = useMemo(() => {
    if (detailId === undefined) {
      return null;
    }

    return catalog?.items.find((item) => item.id === detailId) ?? null;
  }, [catalog, detailId]);

  const handleWatch = useCallback(() => {
    const url = pickLink(config.links, config.rotation);

    if (url !== '') {
      openAffiliate(url);
    }
  }, [config]);

  if (catalog === null) {
    return (
      <main className="catalog catalog--empty">
        <p>Katalog tidak dapat dimuat.</p>
        {onRetry !== undefined && (
          <button type="button" className="retry" onClick={onRetry}>
            Coba lagi
          </button>
        )}
      </main>
    );
  }

  // Modal sengaja tidak dibuka selama overlay masih tampil. Alasannya: trailer
  // akan berbunyi di balik layar yang masih tertutup, dan suara tanpa gambar
  // terasa seperti kerusakan. Pengunjung yang datang lewat tautan langsung
  // memang menunggu sedikit lebih lama, dan itu pertukaran yang disengaja.
  const showOverlay = loading;

  return (
    <main className="catalog">
      <header className="catalog__head">
        <h1 className="catalog__title">Katalog Drama</h1>
        <p className="catalog__count">{catalog.items.length} judul</p>
      </header>

      <div className="grid">
        {catalog.items.map((item) => (
          <MovieCard key={item.id} item={item} onSelect={onOpenDetail} />
        ))}
      </div>

      {detailId !== undefined && !showOverlay && selected === null && (
        <p className="catalog__missing">Judul tidak ditemukan.</p>
      )}

      <TrailerModal
        item={showOverlay ? null : selected}
        onClose={onCloseDetail}
        onWatch={handleWatch}
      />

      {showOverlay && <LoadingOverlay />}

      <footer className="catalog__foot">
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </footer>
    </main>
  );
}
```

- [ ] **Step 5: Jalankan tes dan pastikan lulus**

Run: `pnpm vitest run src/pages/CatalogPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/MovieCard.tsx src/components/LoadingOverlay.tsx src/pages/CatalogPage.tsx src/pages/CatalogPage.test.tsx
git commit -m "feat(katalog): grid kartu drama dengan overlay dan modal"
```

---

## Task 11: Kerangka router di `App.tsx`

**Files:**

- Create: `src/hooks/useHashRoute.ts`
- Modify: `src/App.tsx` (ganti seluruh isi)
- Modify: `src/App.test.tsx` (ganti seluruh isi)

**Interfaces:**

- Consumes: `parseRoute`, `buildHash` dari Task 5; `useCatalog` dari Task 6;
  `LandingPage` dari Task 9; `CatalogPage` dari Task 10; `loadConfig`,
  `FALLBACK_CONFIG`, tipe `SiteConfig` dari `src/lib/config.ts`.
- Produces: hook `useHashRoute()`; komponen `App` sebagai kerangka rute.

- [ ] **Step 1: Tulis hook rute**

Buat `src/hooks/useHashRoute.ts`:

```ts
import { useEffect, useState } from 'react';

/** Hash saat ini. Ikut berubah saat pengunjung menekan tombol kembali. */
export function useHashRoute(): string {
  const [hash, setHash] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.hash,
  );

  useEffect(() => {
    const onChange = (): void => {
      setHash(window.location.hash);
    };

    window.addEventListener('hashchange', onChange);

    return () => {
      window.removeEventListener('hashchange', onChange);
    };
  }, []);

  return hash;
}
```

- [ ] **Step 2: Ganti seluruh isi `src/App.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useCatalog } from './hooks/useCatalog';
import { useHashRoute } from './hooks/useHashRoute';
import { FALLBACK_CONFIG, loadConfig, type SiteConfig } from './lib/config';
import { buildHash, parseRoute } from './lib/router';
import { CatalogPage } from './pages/CatalogPage';
import { LandingPage } from './pages/LandingPage';

export default function App() {
  // Dimulai dari FALLBACK_CONFIG agar halaman langsung tampil dan dapat
  // diklik sejak frame pertama, tanpa menunggu jaringan.
  const [config, setConfig] = useState<SiteConfig>(FALLBACK_CONFIG);

  const hash = useHashRoute();
  const route = parseRoute(hash);
  const { catalog, failed, retry } = useCatalog();

  useEffect(() => {
    let active = true;

    void loadConfig().then((loaded) => {
      if (active) {
        setConfig(loaded);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  /**
   * Memakai location.replace, bukan penugasan location.hash.
   *
   * Bila penugasan biasa dipakai, riwayat berisi landing lalu katalog,
   * sehingga tombol kembali mengembalikan pengunjung ke landing dan hitungan
   * mundur 8 detik terpicu lagi. Pengunjung akan terjebak dalam lingkaran
   * landing ke katalog ke landing.
   */
  const enterCatalog = useCallback(() => {
    window.location.replace(buildHash({ name: 'catalog' }));
  }, []);

  /** Membuka modal. Menambah entri riwayat supaya tombol kembali menutupnya. */
  const openDetail = useCallback((id: string) => {
    window.location.hash = buildHash({ name: 'catalog', detailId: id });
  }, []);

  /**
   * Menutup modal. Memakai replace supaya riwayat tidak menumpuk; tanpa ini
   * pengunjung harus menekan tombol kembali dua kali hanya untuk keluar dari
   * satu modal.
   */
  const closeDetail = useCallback(() => {
    window.location.replace(buildHash({ name: 'catalog' }));
  }, []);

  if (route.name === 'landing') {
    return <LandingPage config={config} onEnterCatalog={enterCatalog} />;
  }

  return (
    <CatalogPage
      catalog={catalog}
      config={config}
      detailId={route.detailId}
      onOpenDetail={openDetail}
      onCloseDetail={closeDetail}
      {...(failed ? { onRetry: retry } : {})}
    />
  );
}
```

- [ ] **Step 3: Ganti seluruh isi `src/App.test.tsx`**

Isi lama sudah pindah ke `src/pages/LandingPage.test.tsx`.

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

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

afterEach(() => {
  vi.unstubAllGlobals();
  window.location.hash = '';
});

describe('App', () => {
  it('menampilkan landing untuk hash kosong', async () => {
    stubImage();
    window.location.hash = '';

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /lihat katalog/i })).toBeInTheDocument();
    });
  });

  it('menampilkan katalog untuk hash katalog', async () => {
    stubImage();
    window.location.hash = '#/katalog';

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /katalog drama/i })).toBeInTheDocument();
    });
  });

  it('kembali ke landing untuk hash yang tidak dikenal', async () => {
    stubImage();
    window.location.hash = '#/entah';

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /lihat katalog/i })).toBeInTheDocument();
    });
  });

  it('mengikuti perubahan hash tanpa memuat ulang halaman', async () => {
    stubImage();
    window.location.hash = '';

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /lihat katalog/i })).toBeInTheDocument();
    });

    window.location.hash = '#/katalog';
    window.dispatchEvent(new Event('hashchange'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /katalog drama/i })).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 4: Jalankan seluruh tes**

Run: `pnpm test`
Expected: semua tes hijau, termasuk tes lama yang tidak diubah
(`config.test.ts`, `links.test.ts`, `redirect.test.ts`, `CtaButton.test.tsx`).

- [ ] **Step 5: Lint, typecheck, dan build**

Run: `pnpm lint && pnpm typecheck && pnpm build`
Expected: ketiganya exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useHashRoute.ts src/App.tsx src/App.test.tsx
git commit -m "feat(app): kerangka router hash untuk landing dan katalog"
```

---

## Task 12: Gaya visual katalog dan modal

**Files:**

- Modify: `src/styles.css` (tambahkan di bagian bawah, jangan ganti isinya)

**Interfaces:**

- Consumes: kelas yang dipakai Task 8 sampai 11.
- Produces: tidak ada API baru.

- [ ] **Step 1: Tambahkan gaya hitungan mundur, katalog, grid, dan kartu**

Tambahkan ke bagian bawah `src/styles.css`:

```css
.countdown {
  margin-top: 0.75rem;
  font-size: 0.875rem;
  color: var(--muted);
}

.countdown__cancel {
  background: none;
  border: 0;
  padding: 0;
  color: var(--accent);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.catalog {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem 1rem calc(3rem + env(safe-area-inset-bottom));
}

.catalog__title {
  font-size: clamp(1.5rem, 4vw, 2rem);
  margin: 0;
}

.catalog__count {
  color: var(--muted);
  margin: 0.25rem 0 1.25rem;
  font-size: 0.9rem;
}

.catalog__foot {
  margin-top: 2.5rem;
  font-size: 0.75rem;
  color: var(--muted);
  text-align: center;
}

.catalog__missing {
  text-align: center;
  color: var(--muted);
  padding: 2rem 0;
}

.catalog--empty {
  text-align: center;
  padding: 4rem 1rem;
}

.retry {
  margin-top: 1rem;
  padding: 0.6rem 1.2rem;
  border-radius: 999px;
  border: 1px solid var(--accent);
  background: none;
  color: var(--text);
  cursor: pointer;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

@media (min-width: 640px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
  }
}

@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.card__poster {
  position: relative;
  display: block;
  aspect-ratio: 2 / 3;
  border-radius: 0.75rem;
  overflow: hidden;
  background: linear-gradient(150deg, #2a2a35 0%, #14141b 60%, #0b0b10 100%);
  transition: transform 160ms ease;
}

.card:hover .card__poster,
.card:focus-visible .card__poster {
  transform: translateY(-2px);
}

.card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.card__play {
  position: absolute;
  right: 0.5rem;
  bottom: 0.5rem;
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: rgb(0 0 0 / 55%);
  backdrop-filter: blur(4px);
  font-size: 0.75rem;
}

.card__title {
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card__meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--muted);
}
```

- [ ] **Step 2: Tambahkan gaya overlay dan modal**

Tambahkan lagi di bawahnya:

```css
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 1rem;
  background: rgb(8 8 12 / 92%);
  backdrop-filter: blur(6px);
}

.overlay__spinner {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 999px;
  border: 3px solid rgb(255 255 255 / 18%);
  border-top-color: var(--accent);
  animation: spin 800ms linear infinite;
}

.overlay__text {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.modal {
  padding: 0;
  border: 0;
  background: none;
  width: min(92vw, 900px);
  max-width: 900px;
  max-height: 90vh;
  color: var(--text);
}

.modal::backdrop {
  background: rgb(0 0 0 / 72%);
  backdrop-filter: blur(4px);
}

.modal__panel {
  position: relative;
  border-radius: 1rem;
  background: #14141b;
  max-height: 90vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  animation: modal-in 200ms ease;
}

@keyframes modal-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

.modal__close {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 2;
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: rgb(0 0 0 / 60%);
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
}

.modal__player {
  aspect-ratio: 16 / 9;
  background: #000;
}

.modal__frame {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}

.modal__no-trailer {
  height: 100%;
  margin: 0;
  display: grid;
  place-content: center;
  color: var(--muted);
  padding: 1rem;
  text-align: center;
}

.modal__body {
  padding: 1rem 1.25rem 1.5rem;
}

.modal__title {
  font-size: clamp(1.15rem, 3vw, 1.5rem);
  margin: 0 0 0.25rem;
}

.modal__meta {
  display: flex;
  gap: 0.75rem;
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0 0 0.75rem;
}

.modal__overview {
  color: var(--muted);
  line-height: 1.6;
  margin: 0 0 1.25rem;
  /* Sinopsis panjang tidak boleh mengambil alih seluruh layar. */
  max-height: 30vh;
  overflow-y: auto;
}

.modal__attribution {
  margin: 1rem 0 0;
  font-size: 0.7rem;
  color: var(--muted);
  text-align: center;
}
```

Catatan penting pada `.modal`: elemen ini **tidak boleh diberi `padding`**.
Area padding akan ikut terhitung sebagai latar oleh pengendali klik, sehingga
klik di pinggir dalam modal akan menutupnya secara tak terduga. Semua jarak
diatur di `.modal__panel` dan `.modal__body`.

- [ ] **Step 3: Matikan animasi saat pengunjung meminta gerak minimal**

Di dalam blok `@media (prefers-reduced-motion: reduce)` yang sudah ada di
`src/styles.css`, tambahkan:

```css
.overlay__spinner {
  animation: none;
}

.modal__panel {
  animation: none;
}

.card__poster {
  transition: none;
}
```

- [ ] **Step 4: Verifikasi gaya tidak merusak build**

Run: `pnpm build`
Expected: exit 0, dan ukuran CSS bertambah wajar.

Run: `pnpm format:check`
Expected: exit 0. Bila gagal, jalankan `pnpm format` lalu ulangi.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css
git commit -m "feat(ui): gaya katalog, kartu, overlay, dan modal"
```

---

## Task 13: Verifikasi di peramban sungguhan

Ini bukan langkah opsional. Beberapa perilaku inti **tidak dapat** dibuktikan
oleh jsdom: perangkap fokus, tombol Esc, klik latar, penguncian gulir, apakah
trailer benar-benar berputar, dan apakah riwayat tombol kembali bersih.

**Files:**

- Modify: `README.md` (tambahkan bagian katalog)
- Tidak ada berkas kode baru.

**Interfaces:**

- Consumes: seluruh hasil Task 1 sampai 12.
- Produces: bukti verifikasi.

- [ ] **Step 1: Jalankan dev server dan buka halaman**

Run: `pnpm dev`
Expected: server berjalan, dan halaman menampilkan landing.

Catat port yang dipakai, lalu buka `http://localhost:<port>/` di peramban.

- [ ] **Step 2: Buktikan alur utuh landing sampai Shopee**

1. Tunggu di landing, atau klik **LIHAT KATALOG**.
2. Pastikan overlay spinner tampil, lalu hilang setelah poster selesai.
3. Klik satu kartu.
4. Pastikan modal terbuka dan trailer berputar.
5. Klik **TONTON FULL DI SHOPEE**.

Expected: tab baru terbuka menuju `s.shopee.co.id`. Tab katalog tetap di tempat
aslinya, tidak ikut berpindah.

- [ ] **Step 3: Buktikan iframe benar-benar hilang saat modal ditutup**

Ini pemeriksaan paling penting, dan tidak dapat digantikan oleh tes otomatis.

1. Buka modal sehingga trailer berbunyi.
2. Tutup modal dengan tombol tutup.
3. Periksa DOM: `document.querySelectorAll('iframe').length` harus `0`.
4. Pastikan suara benar-benar berhenti.

Expected: tidak ada iframe, dan tidak ada suara. Bila suara masih terdengar
padahal modal sudah tertutup, itu bug yang harus diperbaiki sebelum lanjut.

- [ ] **Step 4: Buktikan iframe belum ada sebelum modal dibuka**

1. Muat halaman katalog.
2. Sebelum mengklik kartu apa pun, periksa `document.querySelectorAll('iframe').length`.

Expected: `0`. Halaman katalog tidak boleh menghubungi YouTube sama sekali
sebelum modal dibuka.

- [ ] **Step 5: Buktikan tombol Esc menutup modal**

Buka modal, tekan `Esc`.

Expected: modal tertutup, dan halaman kembali ke katalog.

- [ ] **Step 6: Buktikan klik latar menutup, dan klik di dalam tidak**

1. Buka modal, klik tepat di area gelap **di luar** panel.
2. Expected: modal tertutup.
3. Buka modal lagi, klik di **dalam** panel (misalnya pada area sinopsis).
4. Expected: modal tetap terbuka.

Bila langkah 3 justru menutup modal, artinya `.modal` mendapat `padding`.

- [ ] **Step 7: Buktikan riwayat tombol kembali bersih**

1. Dari landing, klik **LIHAT KATALOG**.
2. Klik satu kartu sehingga modal terbuka.
3. Tekan tombol kembali **satu kali**.
4. Expected: modal tertutup, katalog masih tampil.
5. Tekan tombol kembali **sekali lagi**.
6. Expected: kembali ke landing.

Bila pada langkah 3 tidak terjadi apa-apa dan perlu ditekan dua kali, artinya
penutupan modal memakai penugasan `location.hash` alih-alih `location.replace`.

- [ ] **Step 8: Buktikan gulir halaman terkunci selama modal terbuka**

1. Buka modal.
2. Coba gulir halaman di belakang modal.
3. Expected: halaman di belakang tidak bergerak.
4. Tutup modal, lalu coba gulir lagi.
5. Expected: halaman dapat digulir kembali seperti semula.

- [ ] **Step 9: Buktikan tidak ada gulir horizontal di berbagai lebar**

Uji pada lebar **360, 375, 390, dan 430** piksel. Pada setiap lebar, periksa:

```js
document.documentElement.scrollWidth <= window.innerWidth;
```

Expected: `true` pada keempat lebar, baik di halaman katalog maupun saat modal
terbuka.

- [ ] **Step 10: Buktikan katalog benar-benar berubah antar build**

1. Catat 5 judul pertama di `dist/catalog.json`.
2. Jalankan `pnpm build` lagi tanpa mengubah kode.
3. Bandingkan `generatedAt` pada `dist/catalog.json`.

Expected: `generatedAt` berbeda. Bila halaman yang dipilih kebetulan sama,
judulnya boleh sama; yang dibuktikan di sini adalah katalog dibuat ulang, bukan
isi yang selalu berbeda.

- [ ] **Step 11: Dokumentasikan di `README.md`**

Tambahkan bagian ini ke `README.md`, setelah bagian "Mengganti link affiliate":

```markdown
## Katalog drama

Katalog di-generate dari TMDB **saat build**. Isinya dapat berbeda setiap kali
build berjalan.

### Memasang API key

1. Buka Settings lalu Secrets and variables, pilih Actions
2. Tambahkan repository secret bernama `TMDB_API_KEY`
3. Isi dengan API key TMDB Anda

Bila secret ini belum ada, build tetap sukses dan memakai katalog cadangan.

### Memicu build ulang

Buka tab Actions, pilih workflow Deploy to GitHub Pages, lalu klik Run workflow.
Katalog akan diambil ulang dari TMDB.
```

- [ ] **Step 12: Jalankan seluruh pemeriksaan akhir**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm format:check && pnpm build`
Expected: kelimanya exit 0.

- [ ] **Step 13: Commit**

```bash
git add README.md
git commit -m "docs: dokumentasikan katalog dan cara memasang API key"
```

---

## Catatan penutup

Aturan yang berlaku untuk seluruh task di atas:

- **Jangan** menambahkan dependency runtime baru. `react` dan `react-dom` saja.
- **Jangan** menulis nilai `TMDB_API_KEY` ke berkas mana pun. Hanya secret GitHub
  dan `.env` lokal yang di-ignore.
- **Jangan** meng-commit berkas gambar poster ke repositori.
- Setiap task harus meninggalkan `pnpm lint`, `pnpm typecheck`, dan `pnpm test`
  dalam keadaan hijau sebelum lanjut ke task berikutnya.
- Bila satu tes gagal, perbaiki tes atau implementasinya. **Jangan** melewati
  langkah dan jangan menandai selesai tanpa bukti.
