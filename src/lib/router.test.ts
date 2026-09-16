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
