// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  mergeOverview,
  normalizeItem,
  pickTrailerKey,
  toRating,
  toYear,
} from './normalize.ts';

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
