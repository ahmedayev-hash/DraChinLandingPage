import { useEffect, useState } from 'react';

const DEFAULT_TIMEOUT_MS = 12_000;

export interface PreloadOptions {
  timeoutMs?: number;
}

/**
 * Menunggu semua gambar selesai diunduh.
 *
 * Memakai objek `new Image()` alih-alih elemen <img> di dalam grid, karena
 * objek ini dapat mulai diunduh sebelum React merender apa pun.
 *
 * Gambar yang gagal dihitung selesai. Tanpa aturan itu, satu poster rusak akan
 * membuat overlay menggantung selamanya.
 */
export function preloadImages(
  urls: string[],
  options: PreloadOptions = {},
): Promise<void> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  if (urls.length === 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let remaining = urls.length;
    let settled = false;

    const finish = (): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      resolve();
    };

    // Batas waktu pengaman: pengunjung tidak boleh terjebak di balik overlay
    // hanya karena satu gambar tidak pernah menjawab.
    const timer = setTimeout(finish, timeoutMs);

    for (const url of urls) {
      const image = new Image();

      const step = (): void => {
        remaining -= 1;
        if (remaining <= 0) {
          finish();
        }
      };

      // Handler dipasang sebelum src supaya gambar yang selesai seketika
      // (dari cache) tetap terhitung.
      image.onload = step;
      image.onerror = step;
      image.src = url;
    }
  });
}

/**
 * Mengembalikan true selama setidaknya satu poster belum selesai diunduh.
 *
 * Status "sedang memuat" diturunkan saat render, bukan direset lewat setState
 * di dalam effect. Memanggil setState secara sinkron di badan effect memicu
 * render berantai (dan ditolak oleh react-hooks/set-state-in-effect). Dengan
 * cara ini, daftar URL yang berubah otomatis membuat status kembali memuat
 * tanpa setState tambahan.
 */
export function useImagePreloader(urls: string[], timeoutMs?: number): boolean {
  // Kunci dibuat dari URL supaya efek tidak berjalan ulang hanya karena array
  // baru dibuat pada setiap render.
  const key = urls.join('|');
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    if (key === '') {
      return;
    }

    let active = true;
    const list = key.split('|');
    const options = timeoutMs === undefined ? {} : { timeoutMs };

    void preloadImages(list, options).then(() => {
      if (active) {
        setLoadedKey(key);
      }
    });

    return () => {
      active = false;
    };
  }, [key, timeoutMs]);

  return urls.length > 0 && loadedKey !== key;
}
