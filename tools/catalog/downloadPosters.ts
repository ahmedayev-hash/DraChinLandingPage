import type { PosterRequest } from './fetchCatalog.ts';

export interface DownloadedPoster {
  id: string;
  data: Uint8Array;
}

export interface DownloadPostersOptions {
  fetcher?: typeof fetch;
  concurrency?: number;
  timeoutMs?: number;
}

/**
 * Mengunduh poster dengan batas jumlah permintaan paralel.
 *
 * Poster yang gagal dibuang tanpa menggagalkan sisanya. Satu poster rusak
 * tidak boleh membuat seluruh build memakai katalog cadangan.
 *
 * Batas paralel dipakai supaya build tidak membuka 20 koneksi sekaligus ke
 * CDN gambar TMDB.
 */
export async function downloadPosters(
  requests: PosterRequest[],
  options: DownloadPostersOptions = {},
): Promise<DownloadedPoster[]> {
  const { fetcher = fetch, concurrency = 6, timeoutMs = 15_000 } = options;

  if (requests.length === 0) {
    return [];
  }

  const size = Math.max(1, Math.min(concurrency, requests.length));
  const results: DownloadedPoster[] = [];
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < requests.length) {
      const request = requests[cursor];
      cursor += 1;

      if (request === undefined) {
        continue;
      }

      try {
        const response = await fetcher(request.url, {
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
          continue;
        }

        const buffer = await response.arrayBuffer();
        results.push({ id: request.id, data: new Uint8Array(buffer) });
      } catch {
        // Diabaikan: lihat komentar fungsi.
      }
    }
  };

  await Promise.all(Array.from({ length: size }, () => worker()));

  return results;
}
