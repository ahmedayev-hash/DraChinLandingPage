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
