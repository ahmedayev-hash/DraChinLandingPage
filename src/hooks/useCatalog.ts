import { useCallback, useEffect, useState } from 'react';
import type { CatalogFile } from '../../tools/catalog/types';
import { loadCatalog } from '../lib/catalogSchema';

export interface UseCatalogResult {
  catalog: CatalogFile | null;
  failed: boolean;
  retry: () => void;
}

/**
 * Memuat catalog.json satu kali, dengan penjaga pembatalan.
 *
 * Penjaga ini penting: tanpa itu, komponen yang sudah dilepas masih menulis
 * state saat balasan jaringan tiba, dan React akan memperingatkannya.
 */
export function useCatalog(fetcher?: typeof fetch): UseCatalogResult {
  const [catalog, setCatalog] = useState<CatalogFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    void loadCatalog(fetcher).then((loaded) => {
      if (!active) {
        return;
      }

      if (loaded === null) {
        setFailed(true);
        return;
      }

      setCatalog(loaded);
      setFailed(false);
    });

    return () => {
      active = false;
    };
  }, [fetcher, attempt]);

  const retry = useCallback(() => {
    // Diatur di sini, bukan di dalam effect. Memanggil setState secara
    // sinkron di badan effect memicu render berantai dan ditolak oleh aturan
    // react-hooks/set-state-in-effect.
    setFailed(false);
    setAttempt((value) => value + 1);
  }, []);

  return { catalog, failed, retry };
}
