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
