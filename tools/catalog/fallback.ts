import type { CatalogFile } from './types.ts';

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
