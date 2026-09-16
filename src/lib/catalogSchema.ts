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
