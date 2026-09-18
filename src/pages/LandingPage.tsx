import { useCallback, useEffect, useRef, useState } from 'react';
import { CtaButton } from '../components/CtaButton';
import type { SiteConfig } from '../lib/config';
import { pickLink } from '../lib/links';
import { openAffiliate, tryOpenNewTab } from '../lib/redirect';

interface LandingPageProps {
  config: SiteConfig;
  onEnterCatalog: () => void;
  /**
   * Menandakan config.json sudah selesai dimuat.
   *
   * Tangga auto-open sengaja menunggu ini. Tanpa penantian, L1 akan berjalan
   * memakai FALLBACK_CONFIG yang selalu `autoOpen: true` sebelum config.json
   * sempat terbaca, sehingga saklar `autoOpen: false` tidak akan berpengaruh.
   * Menunggu sepersekian detik tidak merugikan: popup tanpa gestur tetap
   * diblokir browser.
   */
  configReady: boolean;
  autoEnterSeconds?: number;
}

/**
 * Halaman clickbait.
 *
 * Tombol utama masuk ke katalog. Pengunjung yang pasif juga didorong masuk
 * lewat hitungan mundur yang terlihat dan dapat dibatalkan.
 *
 * Di depannya ada tangga fallback affiliate: percobaan tab baru saat mount
 * (L1), pada klik pertama di mana saja (L2), lalu pada tombol katalog (L3)
 * dengan redirect sebagai jaminan (L4). Lihat
 * docs/superpowers/specs/2026-09-18-auto-open-affiliate-ladder-design.md.
 */
export function LandingPage({
  config,
  onEnterCatalog,
  configReady,
  autoEnterSeconds = 8,
}: LandingPageProps) {
  const [posterFailed, setPosterFailed] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [remaining, setRemaining] = useState(Math.ceil(autoEnterSeconds));

  // Link dipilih sekali per mount, lalu diingat.
  //
  // pickLink() memajukan indeks rotasi di localStorage. Memanggilnya di badan
  // render akan memutar indeks pada setiap render, dan menunggu config.json
  // sampai selesai berarti auto-open kehilangan kesempatan sedini mungkin.
  // Karena itu link diambil dari config yang sudah ada saat mount (FALLBACK_CONFIG
  // selalu membawa link) dan disimpan di ref.
  const affiliateUrlRef = useRef<string | null>(null);

  const resolveAffiliateUrl = useCallback((): string => {
    if (affiliateUrlRef.current === null) {
      affiliateUrlRef.current = pickLink(config.links, config.rotation);
    }

    return affiliateUrlRef.current;
  }, [config]);

  // Penjaga satu percobaan per lapis. Disimpan di ref, bukan state, karena
  // nilainya tidak pernah dirender; state akan memicu render yang sia-sia.
  const autoAttempted = useRef(false);
  const firstClickAttempted = useRef(false);

  // Sekali tab baru berhasil dibuka, tidak ada lapis lain yang boleh mencoba
  // lagi. Tanpa penjaga ini, klik pada tombol katalog bisa membuka dua tab:
  // sekali lewat penangkap klik pertama (L2), sekali lagi lewat tombol (L3).
  const opened = useRef(false);

  /** Mencoba satu kali, dan mengingat bila berhasil. Selalu aman dipanggil. */
  const attemptOpen = useCallback((url: string): boolean => {
    if (url === '' || opened.current) {
      return opened.current;
    }

    const success = tryOpenNewTab(url);

    if (success) {
      opened.current = true;
    }

    return success;
  }, []);

  // Lapis L1: coba buka tab baru sedini mungkin saat landing tampil.
  useEffect(() => {
    // configReady wajib: lihat penjelasan prop di atas. FALLBACK_CONFIG selalu
    // autoOpen=true, jadi tanpa penantian saklar autoOpen:false akan diabaikan.
    // autoOpen=false mematikan seluruh tangga: landing page kembali menjadi
    // halaman pasif yang hanya membuka Shopee lewat tombol di modal trailer.
    if (!configReady || !config.autoOpen || autoAttempted.current) {
      return;
    }

    const url = resolveAffiliateUrl();

    if (url === '') {
      return;
    }

    // Penjaga ini membuat L1 berjalan tepat sekali walau React StrictMode
    // memanggil efek dua kali saat pengembangan.
    autoAttempted.current = true;
    attemptOpen(url);
  }, [attemptOpen, config.autoOpen, configReady, resolveAffiliateUrl]);

  // Lapis L2: klik pertama di mana saja adalah gestur user terdekat, dan gestur
  // itulah yang paling sering membuat browser mengizinkan tab baru. Pendengar
  // dilepas setelah satu kali, jadi lapis ini pun tidak pernah berjalan dua kali.
  useEffect(() => {
    if (!configReady || !config.autoOpen) {
      return;
    }

    const handleFirstClick = () => {
      if (firstClickAttempted.current) {
        return;
      }

      firstClickAttempted.current = true;
      attemptOpen(resolveAffiliateUrl());
    };

    document.addEventListener('click', handleFirstClick, {
      capture: true,
      once: true,
    });

    return () => {
      document.removeEventListener('click', handleFirstClick, { capture: true });
    };
  }, [attemptOpen, config.autoOpen, configReady, resolveAffiliateUrl]);

  // Lapis L3: tombol katalog memakai openAffiliate, yang mencoba tab baru lalu
  // memindahkan tab ini bila popup benar-benar diblokir. Bila tidak ada link
  // sama sekali, tombol kembali menjadi tombol masuk katalog seperti semula.
  const handleCtaClick = useCallback(() => {
    if (!configReady || !config.autoOpen) {
      onEnterCatalog();
      return;
    }

    const url = resolveAffiliateUrl();

    if (url === '') {
      onEnterCatalog();
      return;
    }

    firstClickAttempted.current = true;

    // Klik pada tombol ini juga merupakan klik pertama, jadi penangkap L2 sudah
    // mencoba lebih dulu (fase capture berjalan sebelum onClick). Bila tab baru
    // sudah terbuka, tidak ada yang perlu dilakukan lagi.
    if (opened.current) {
      return;
    }

    // openAffiliate mencoba tab baru sekali lagi, lalu memindahkan tab ini bila
    // popup benar-benar diblokir (L4). Klik tidak boleh hilang diam-diam.
    openAffiliate(url);
    opened.current = true;
  }, [config.autoOpen, configReady, onEnterCatalog, resolveAffiliateUrl]);

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

        <CtaButton label="LIHAT KATALOG" onClick={handleCtaClick} />

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
