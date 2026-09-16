import type { CatalogItem } from './types.ts';

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
