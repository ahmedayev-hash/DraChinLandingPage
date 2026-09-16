import { useEffect, useRef, useState } from 'react';
import { CtaButton } from '../components/CtaButton';
import type { SiteConfig } from '../lib/config';

interface LandingPageProps {
  config: SiteConfig;
  onEnterCatalog: () => void;
  autoEnterSeconds?: number;
}

/**
 * Halaman clickbait.
 *
 * Tombol utama masuk ke katalog. Pengunjung yang pasif juga didorong masuk
 * lewat hitungan mundur yang terlihat dan dapat dibatalkan.
 */
export function LandingPage({
  config,
  onEnterCatalog,
  autoEnterSeconds = 8,
}: LandingPageProps) {
  const [posterFailed, setPosterFailed] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [remaining, setRemaining] = useState(Math.ceil(autoEnterSeconds));

  // Penangan disimpan di ref, bukan dipasang sebagai dependensi efek.
  //
  // Bila onEnterCatalog menjadi dependensi efek dan induknya membuat fungsi
  // baru pada setiap render, efek akan berjalan ulang dan menetapkan tenggat
  // baru terus-menerus. Hitungan mundur tidak akan pernah selesai selama
  // induknya masih sering merender.
  const enterRef = useRef(onEnterCatalog);

  useEffect(() => {
    enterRef.current = onEnterCatalog;
  }, [onEnterCatalog]);

  useEffect(() => {
    if (cancelled || autoEnterSeconds <= 0) {
      return;
    }

    const deadline = Date.now() + autoEnterSeconds * 1000;

    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);

      if (left <= 0) {
        clearInterval(tick);
        enterRef.current();
      }
    }, 250);

    // Pembersihan ini wajib: tanpa itu, pengunjung yang sudah berpindah
    // halaman tetap akan dipindahkan lagi oleh timer yang tertinggal.
    return () => {
      clearInterval(tick);
    };
  }, [autoEnterSeconds, cancelled]);

  return (
    <main className="page">
      <div className="poster">
        {!posterFailed && (
          <img
            className="poster__img"
            src={config.poster}
            alt=""
            fetchPriority="high"
            onError={() => {
              setPosterFailed(true);
            }}
          />
        )}
        <div className="poster__scrim" />
      </div>

      <section className="content">
        {config.badges.length > 0 && (
          <ul className="badges">
            {config.badges.map((badge) => (
              <li key={badge} className="badges__item">
                {badge}
              </li>
            ))}
          </ul>
        )}

        <h1 className="headline">{config.headline}</h1>
        <p className="subheadline">{config.subheadline}</p>

        <CtaButton label="LIHAT KATALOG" onClick={onEnterCatalog} />

        {!cancelled && autoEnterSeconds > 0 && (
          <p className="countdown">
            Masuk katalog otomatis dalam {remaining} detik.{' '}
            <button
              type="button"
              className="countdown__cancel"
              onClick={() => {
                setCancelled(true);
              }}
            >
              Batalkan
            </button>
          </p>
        )}

        <p className="note">Gratis • Tanpa registrasi</p>

        {/* Landing page tidak memakai header/footer situs, tetapi atribusi
            TMDB tetap wajib karena poster di halaman ini berasal dari TMDB. */}
        <p className="attribution">
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </section>
    </main>
  );
}
