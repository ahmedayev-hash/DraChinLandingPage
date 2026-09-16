import type { Rotation } from './links';

export interface SiteConfig {
  headline: string;
  subheadline: string;
  ctaText: string;
  poster: string;
  badges: string[];
  links: string[];
  rotation: Rotation;
}

/**
 * Link darurat yang ditanam di kode.
 *
 * Halaman ini tidak boleh pernah menampilkan tombol mati. Bila config.json
 * gagal dimuat - 404, offline, atau JSON rusak - konfigurasi inilah yang
 * dipakai sehingga tombol CTA tetap berfungsi.
 */
export const FALLBACK_CONFIG: SiteConfig = {
  headline: 'Drama ini bikin kamu lupa waktu',
  subheadline: 'Episode baru tiap hari • Sub Indo',
  ctaText: 'TONTON SEKARANG',
  poster: './poster.jpg',
  badges: ['HD', 'Sub Indo', 'Full Episode'],
  links: ['https://s.shopee.co.id/9peLe2gVIP'],
  rotation: 'sequence',
};

/** Hanya http dan https yang diterima. Skema lain ditolak. */
export function isValidAffiliateUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === 'string' && item.trim() !== '',
  );
}

/** Menormalkan data mentah menjadi SiteConfig yang selalu dapat dipakai. */
export function parseConfig(raw: unknown): SiteConfig {
  const source =
    typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

  const links = readStringArray(source['links']).filter(isValidAffiliateUrl);
  const badges = readStringArray(source['badges']);

  return {
    headline: readString(source['headline'], FALLBACK_CONFIG.headline),
    subheadline: readString(source['subheadline'], FALLBACK_CONFIG.subheadline),
    ctaText: readString(source['ctaText'], FALLBACK_CONFIG.ctaText),
    poster: readString(source['poster'], FALLBACK_CONFIG.poster),
    badges: badges.length > 0 ? badges : FALLBACK_CONFIG.badges,
    links: links.length > 0 ? links : FALLBACK_CONFIG.links,
    rotation: source['rotation'] === 'random' ? 'random' : 'sequence',
  };
}

/**
 * Memuat config.json saat runtime.
 *
 * Query timestamp ditambahkan untuk cache busting: GitHub Pages men-cache aset
 * di CDN sekitar 10 menit, sehingga tanpa ini perubahan link akan tampak
 * "tidak berfungsi" selama beberapa menit setelah commit.
 */
export async function loadConfig(fetcher: typeof fetch = fetch): Promise<SiteConfig> {
  try {
    const response = await fetcher(`./config.json?t=${Date.now()}`);

    if (!response.ok) {
      return FALLBACK_CONFIG;
    }

    return parseConfig(await response.json());
  } catch {
    return FALLBACK_CONFIG;
  }
}
