interface SiteHeaderProps {
  brand: string;
  tagline?: string;
}

/**
 * Kepala situs: hanya nama brand, tanpa satu pun tombol.
 *
 * Sengaja tanpa kontrol interaktif. Navigasi katalog dilakukan lewat kartu
 * drama, jadi tidak ada tautan yang perlu ditempatkan di sini.
 *
 * `position: sticky` membuat brand tetap terlihat saat menggulir grid yang
 * panjang, dan `aria-hidden` pada lambang mencegah pembaca layar mengeja
 * ulang nama brand dua kali.
 */
export function SiteHeader({
  brand,
  tagline = 'Drama China • Sub Indo',
}: SiteHeaderProps) {
  return (
    <header className="site-head">
      <div className="site-head__inner">
        <span className="site-head__brand">
          <svg
            className="site-head__mark"
            viewBox="0 0 32 32"
            aria-hidden="true"
            focusable="false"
          >
            <rect width="32" height="32" rx="7" />
            <path d="M12 9.5v13l11-6.5z" />
          </svg>
          {brand}
        </span>

        {tagline !== '' && <span className="site-head__tagline">{tagline}</span>}
      </div>
    </header>
  );
}
