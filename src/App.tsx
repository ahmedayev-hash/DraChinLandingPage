import { useCallback, useEffect, useState } from 'react';
import { useCatalog } from './hooks/useCatalog';
import { useHashRoute } from './hooks/useHashRoute';
import { FALLBACK_CONFIG, loadConfig, type SiteConfig } from './lib/config';
import { buildHash, parseRoute } from './lib/router';
import { CatalogPage } from './pages/CatalogPage';
import { LandingPage } from './pages/LandingPage';

export default function App() {
  // Dimulai dari FALLBACK_CONFIG agar halaman langsung tampil dan dapat
  // diklik sejak frame pertama, tanpa menunggu jaringan.
  const [config, setConfig] = useState<SiteConfig>(FALLBACK_CONFIG);

  const hash = useHashRoute();
  const route = parseRoute(hash);
  const { catalog, failed, retry } = useCatalog();

  useEffect(() => {
    let active = true;

    void loadConfig().then((loaded) => {
      if (active) {
        setConfig(loaded);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  /**
   * Memakai location.replace, bukan penugasan location.hash.
   *
   * Bila penugasan biasa dipakai, riwayat berisi landing lalu katalog,
   * sehingga tombol kembali mengembalikan pengunjung ke landing dan hitungan
   * mundur 8 detik terpicu lagi. Pengunjung akan terjebak dalam lingkaran
   * landing ke katalog ke landing.
   */
  const enterCatalog = useCallback(() => {
    window.location.replace(buildHash({ name: 'catalog' }));
  }, []);

  /** Membuka modal. Menambah entri riwayat supaya tombol kembali menutupnya. */
  const openDetail = useCallback((id: string) => {
    window.location.hash = buildHash({ name: 'catalog', detailId: id });
  }, []);

  /**
   * Menutup modal. Memakai replace supaya riwayat tidak menumpuk; tanpa ini
   * pengunjung harus menekan tombol kembali dua kali hanya untuk keluar dari
   * satu modal.
   */
  const closeDetail = useCallback(() => {
    window.location.replace(buildHash({ name: 'catalog' }));
  }, []);

  if (route.name === 'landing') {
    return <LandingPage config={config} onEnterCatalog={enterCatalog} />;
  }

  return (
    <CatalogPage
      catalog={catalog}
      config={config}
      detailId={route.detailId}
      onOpenDetail={openDetail}
      onCloseDetail={closeDetail}
      {...(failed ? { onRetry: retry } : {})}
    />
  );
}
