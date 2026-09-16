interface SiteFooterProps {
  brand: string;
  legal?: string;
}

const DEFAULT_LEGAL =
  'This product uses the TMDB API but is not endorsed or certified by TMDB.';

/**
 * Kaki situs: nama brand, penutup, dan atribusi TMDB.
 *
 * Sama seperti kepala situs, tidak ada tombol di sini. Atribusi TMDB wajib
 * tampil karena judul dan poster berasal dari TMDB.
 */
export function SiteFooter({ brand, legal = DEFAULT_LEGAL }: SiteFooterProps) {
  return (
    <footer className="site-foot">
      <div className="site-foot__inner">
        <p className="site-foot__brand">{brand}</p>
        <p className="site-foot__tagline">Selamat menonton.</p>
        <p className="site-foot__legal">{legal}</p>
      </div>
    </footer>
  );
}
