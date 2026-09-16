import { FALLBACK_CATALOG } from './fallback.ts';
import { mergeOverview, normalizeItem, pickTrailerKey } from './normalize.ts';
import type { CatalogFile, CatalogItem } from './types.ts';

const TMDB_API = 'https://api.themoviedb.org/3';
const IMAGE_API = 'https://image.tmdb.org/t/p/w500';

/**
 * Penyaring genre. Tanpa ini, daftar teratas berisi acara berita, gelar
 * wicara, dan sinetron. Diukur langsung terhadap TMDB: tanpa penyaring hanya
 * 43 persen kandidat yang punya trailer, sedangkan dengan penyaring 80 persen.
 *
 * 18 = Drama. 10767 = Talk. 10763 = News. 10764 = Reality. 10766 = Soap.
 *
 * with_original_language=zh membatasi ke drama China, sesuai nama dan maksud
 * proyek ini (DraChin). Tanpa itu katalog terisi drama Barat.
 *
 * Ambang vote 30, bukan 100 seperti arsip lama. Diukur langsung terhadap TMDB
 * dengan penyaring di atas: vote_count>=100 hanya menyisakan 21 judul (2
 * halaman), sedangkan >=30 menyisakan 138 judul (7 halaman). TMDB memang
 * lemah meliput drama China, jadi ambang 100 terlalu ketat di kategori ini dan
 * membuat variasi katalog nyaris hilang.
 */
const DISCOVER_FILTER = [
  'with_genres=18',
  'without_genres=10767,10763,10764,10766',
  'with_original_language=zh',
  'vote_count.gte=30',
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

  const fallback = (): FetchCatalogResult => ({
    catalog: FALLBACK_CATALOG,
    posters: [],
  });

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
    // tersedia. Ini sangat mudah terjadi di kategori ini: katalog drama China
    // hanya punya sekitar 7 halaman, sedangkan CATALOG_PAGE_POOL default 20.
    //
    // Memundurkan halaman ke 1 akan membuat halaman 1 menampung hampir semua
    // build (13 dari 20 undian), sehingga variasi katalog hilang. Mengundi
    // ulang di dalam 1..total_pages justru membuat sebarannya rata: peluang
    // tiap halaman = 1/pagePool + (pagePool-1)/pagePool * 1/totalPages. Untuk
    // pagePool 20 dan totalPages 7 hasilnya tepat 1/7. Jadi CATALOG_PAGE_POOL
    // tidak perlu disetel manual setiap kali kategori berubah.
    //
    // usedPage dicatat terpisah dari page supaya catalog.json melaporkan
    // halaman yang benar-benar menghasilkan data, bukan halaman yang gagal.
    // Tanpa itu, diagnosa justru menyesatkan.
    let usedPage = page;
    if (totalPages > 0 && page > totalPages) {
      usedPage = Math.min(totalPages, 1 + Math.floor(random() * totalPages));
      primaryResults = readResults(await getJson(discoverUrl(usedPage, language)));
    }

    // Halaman yang diminta kosong: halaman 1 adalah jaring terakhir supaya
    // build tidak pernah menerima katalog kosong.
    if (primaryResults.length === 0 && usedPage !== 1) {
      usedPage = 1;
      primaryResults = readResults(await getJson(discoverUrl(1, language)));
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
