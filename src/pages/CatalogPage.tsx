import { useCallback, useMemo } from 'react';
import type { CatalogFile } from '../../tools/catalog/types';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { MovieCard } from '../components/MovieCard';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { TrailerModal } from '../components/TrailerModal';
import { useImagePreloader } from '../hooks/useImagePreloader';
import type { SiteConfig } from '../lib/config';
import { pickLink } from '../lib/links';
import { openAffiliate } from '../lib/redirect';

interface CatalogPageProps {
  catalog: CatalogFile | null;
  config: SiteConfig;
  detailId: string | undefined;
  onOpenDetail: (id: string) => void;
  onCloseDetail: () => void;
  onRetry?: () => void;
}

export function CatalogPage({
  catalog,
  config,
  detailId,
  onOpenDetail,
  onCloseDetail,
  onRetry,
}: CatalogPageProps) {
  const posterUrls = useMemo(
    () =>
      (catalog?.items ?? []).map((item) => item.poster).filter((poster) => poster !== ''),
    [catalog],
  );

  const loading = useImagePreloader(posterUrls);

  const selected = useMemo(() => {
    if (detailId === undefined) {
      return null;
    }

    return catalog?.items.find((item) => item.id === detailId) ?? null;
  }, [catalog, detailId]);

  const handleWatch = useCallback(() => {
    const url = pickLink(config.links, config.rotation);

    if (url !== '') {
      openAffiliate(url);
    }
  }, [config]);

  if (catalog === null) {
    return (
      <div className="site">
        <SiteHeader brand={config.brand} />

        <main className="catalog catalog--empty">
          <p>Katalog tidak dapat dimuat.</p>
          {onRetry !== undefined && (
            <button type="button" className="retry" onClick={onRetry}>
              Coba lagi
            </button>
          )}
        </main>

        <SiteFooter brand={config.brand} />
      </div>
    );
  }

  // Modal sengaja tidak dibuka selama overlay masih tampil. Alasannya: trailer
  // akan berbunyi di balik layar yang masih tertutup, dan suara tanpa gambar
  // terasa seperti kerusakan. Pengunjung yang datang lewat tautan langsung
  // memang menunggu sedikit lebih lama, dan itu pertukaran yang disengaja.
  const showOverlay = loading;

  return (
    <div className="site">
      <SiteHeader brand={config.brand} />

      <main className="catalog">
        {/* Sengaja <div>, bukan <header>: elemen <header> di sini akan
            memunculkan landmark "banner" kedua dan membingungkan pembaca
            layar. Kepala situs sudah jadi banner halaman. */}
        <div className="catalog__head">
          <h1 className="catalog__title">Katalog Drama</h1>
          <p className="catalog__count">{catalog.items.length} judul</p>
        </div>

        <div className="grid">
          {catalog.items.map((item) => (
            <MovieCard key={item.id} item={item} onSelect={onOpenDetail} />
          ))}
        </div>

        {detailId !== undefined && !showOverlay && selected === null && (
          <p className="catalog__missing">Judul tidak ditemukan.</p>
        )}

        <TrailerModal
          item={showOverlay ? null : selected}
          onClose={onCloseDetail}
          onWatch={handleWatch}
        />

        {showOverlay && <LoadingOverlay />}
      </main>

      <SiteFooter brand={config.brand} />
    </div>
  );
}
