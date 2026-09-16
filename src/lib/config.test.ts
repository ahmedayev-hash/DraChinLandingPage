import { describe, it, expect, vi } from 'vitest';
import { FALLBACK_CONFIG, isValidAffiliateUrl, loadConfig, parseConfig } from './config';

describe('isValidAffiliateUrl', () => {
  it('menerima http dan https', () => {
    expect(isValidAffiliateUrl('https://s.shopee.co.id/abc')).toBe(true);
    expect(isValidAffiliateUrl('http://example.com')).toBe(true);
  });

  it('menolak skema berbahaya dan nilai tidak valid', () => {
    expect(isValidAffiliateUrl('javascript:alert(1)')).toBe(false);
    expect(isValidAffiliateUrl('data:text/html,x')).toBe(false);
    expect(isValidAffiliateUrl('')).toBe(false);
    expect(isValidAffiliateUrl('bukan-url')).toBe(false);
    expect(isValidAffiliateUrl(123)).toBe(false);
    expect(isValidAffiliateUrl(null)).toBe(false);
  });
});

describe('parseConfig', () => {
  it('memakai nilai yang diberikan saat valid', () => {
    const config = parseConfig({
      headline: 'Judul',
      ctaText: 'KLIK',
      links: ['https://s.shopee.co.id/abc'],
      rotation: 'random',
      badges: ['HD'],
      poster: './p.jpg',
    });

    expect(config.headline).toBe('Judul');
    expect(config.ctaText).toBe('KLIK');
    expect(config.rotation).toBe('random');
    expect(config.links).toEqual(['https://s.shopee.co.id/abc']);
    expect(config.badges).toEqual(['HD']);
    expect(config.poster).toBe('./p.jpg');
  });

  it('membuang link dengan skema tidak valid', () => {
    const config = parseConfig({
      links: ['javascript:alert(1)', 'https://ok.example', 'data:x'],
    });
    expect(config.links).toEqual(['https://ok.example']);
  });

  it('jatuh ke fallback bila tidak ada link valid', () => {
    expect(parseConfig({ links: ['javascript:alert(1)'] }).links).toEqual(
      FALLBACK_CONFIG.links,
    );
    expect(parseConfig({ links: [] }).links).toEqual(FALLBACK_CONFIG.links);
  });

  it('jatuh ke fallback bila input bukan objek', () => {
    expect(parseConfig(null).links).toEqual(FALLBACK_CONFIG.links);
    expect(parseConfig('string').links).toEqual(FALLBACK_CONFIG.links);
    expect(parseConfig(undefined).links).toEqual(FALLBACK_CONFIG.links);
    expect(parseConfig(42).links).toEqual(FALLBACK_CONFIG.links);
  });

  it('memakai rotation sequence bila nilainya tidak dikenal', () => {
    expect(parseConfig({ rotation: 'acak' }).rotation).toBe('sequence');
  });

  it('memakai teks default bila field teks hilang atau kosong', () => {
    const config = parseConfig({ headline: '   ', subheadline: 123 });
    expect(config.headline).toBe(FALLBACK_CONFIG.headline);
    expect(config.subheadline).toBe(FALLBACK_CONFIG.subheadline);
  });
});

describe('loadConfig', () => {
  it('mengembalikan config saat fetch berhasil', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ headline: 'Halo', links: ['https://ok.example'] }),
    })) as unknown as typeof fetch;

    const config = await loadConfig(fetcher);
    expect(config.headline).toBe('Halo');
    expect(config.links).toEqual(['https://ok.example']);
  });

  it('menambahkan cache-busting pada URL', async () => {
    let requestedUrl = '';
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      requestedUrl = String(input);
      return { ok: true, json: async () => ({}) };
    }) as unknown as typeof fetch;

    await loadConfig(fetcher);

    expect(requestedUrl).toMatch(/^\.\/config\.json\?t=\d+$/);
  });

  it('memakai fallback saat fetch gagal', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;

    expect((await loadConfig(fetcher)).links).toEqual(FALLBACK_CONFIG.links);
  });

  it('memakai fallback saat response tidak ok', async () => {
    const fetcher = vi.fn(async () => ({
      ok: false,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    expect((await loadConfig(fetcher)).links).toEqual(FALLBACK_CONFIG.links);
  });

  it('memakai fallback saat JSON rusak', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => {
        throw new Error('JSON rusak');
      },
    })) as unknown as typeof fetch;

    expect((await loadConfig(fetcher)).links).toEqual(FALLBACK_CONFIG.links);
  });
});
