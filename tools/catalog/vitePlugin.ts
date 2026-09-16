import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { downloadPosters } from './downloadPosters.ts';
import { fetchCatalog } from './fetchCatalog.ts';
import type { CatalogFile } from './types.ts';

const CACHE_DIR = 'node_modules/.cache/drachin-catalog';
const CATALOG_FILE = 'catalog.json';

export interface CatalogPluginOptions {
  apiKey: string;
  limit?: number;
  language?: string;
  fallbackLanguage?: string;
  pagePool?: number;
  timeoutMs?: number;
}

interface GeneratedCatalog {
  catalog: CatalogFile;
  posters: Map<string, Uint8Array>;
}

/**
 * Membaca katalog dari cache saat mode dev.
 *
 * Tanpa cache ini, setiap kali server dev dijalankan ulang TMDB akan dipanggil
 * lagi dan puluhan permintaan trailer dikirim ulang.
 */
async function readCache(root: string): Promise<GeneratedCatalog | null> {
  try {
    const dir = path.resolve(root, CACHE_DIR);
    const raw = await readFile(path.join(dir, CATALOG_FILE), 'utf8');
    const catalog = JSON.parse(raw) as CatalogFile;
    const posters = new Map<string, Uint8Array>();

    for (const item of catalog.items) {
      if (item.poster === '') {
        continue;
      }

      try {
        const bytes = await readFile(path.join(dir, `${item.id}.jpg`));
        posters.set(item.id, new Uint8Array(bytes));
      } catch {
        // Poster hilang dari cache bukan masalah: kartu memakai gradien.
      }
    }

    return { catalog, posters };
  } catch {
    return null;
  }
}

async function writeCache(root: string, generated: GeneratedCatalog): Promise<void> {
  try {
    const dir = path.resolve(root, CACHE_DIR);
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, CATALOG_FILE),
      JSON.stringify(generated.catalog, null, 2),
      'utf8',
    );

    for (const [id, data] of generated.posters) {
      await writeFile(path.join(dir, `${id}.jpg`), data);
    }
  } catch {
    // Cache hanyalah percepatan. Gagal menulis tidak boleh menggagalkan build.
  }
}

export function catalogPlugin(options: CatalogPluginOptions): Plugin {
  let generated: GeneratedCatalog | null = null;
  let root = process.cwd();
  let isBuild = false;

  const generate = async (): Promise<GeneratedCatalog> => {
    const result = await fetchCatalog({
      apiKey: options.apiKey,
      limit: options.limit,
      language: options.language,
      fallbackLanguage: options.fallbackLanguage,
      pagePool: options.pagePool,
      timeoutMs: options.timeoutMs,
    });

    const downloaded = await downloadPosters(result.posters);
    const posters = new Map(downloaded.map((poster) => [poster.id, poster.data]));

    return { catalog: result.catalog, posters };
  };

  /**
   * Hasil hanya dihitung sekali per proses.
   *
   * Cache HANYA dipakai saat mode dev. Saat build, data selalu diambil ulang
   * dari TMDB. Tanpa aturan itu, build kedua akan memakai katalog hasil build
   * pertama dan isi katalog tidak akan pernah berubah. Itu merusak tujuan
   * utama fitur ini.
   */
  const resolve = async (): Promise<GeneratedCatalog> => {
    if (generated !== null) {
      return generated;
    }

    if (!isBuild) {
      const cached = await readCache(root);
      if (cached !== null) {
        generated = cached;
        return cached;
      }
    }

    generated = await generate();
    await writeCache(root, generated);
    return generated;
  };

  return {
    name: 'drachin-catalog',

    configResolved(config) {
      root = config.root;
      isBuild = config.command === 'build';
    },

    async buildStart() {
      // Saat serve (dev dan vitest) berkas tidak di-emit; `emitFile` memang
      // tidak didukung dan hanya menghasilkan peringatan.
      //
      // Yang lebih penting: vitest ikut menjalankan hook ini. Tanpa penjagaan
      // di bawah, setiap kali tes dijalankan plugin akan memanggil TMDB
      // (karena `.env` berisi kunci) sehingga tes tidak lagi hermetik dan
      // hasilnya bergantung pada jaringan.
      if (!isBuild) {
        return;
      }

      const result = await resolve();

      if (result.catalog.source === 'fallback') {
        this.warn(
          'Katalog memakai data cadangan. Isi TMDB_API_KEY untuk memakai data asli dari TMDB.',
        );
      } else {
        this.info(
          `Katalog TMDB: ${String(result.catalog.items.length)} drama dari halaman ${String(result.catalog.page)}.`,
        );
      }

      this.emitFile({
        type: 'asset',
        fileName: CATALOG_FILE,
        source: JSON.stringify(result.catalog, null, 2),
      });

      for (const [id, data] of result.posters) {
        this.emitFile({ type: 'asset', fileName: `posters/${id}.jpg`, source: data });
      }
    },

    configureServer(server: ViteDevServer) {
      server.middlewares.use((request, response, next) => {
        const url = request.url ?? '';

        if (url.startsWith('/catalog.json')) {
          void resolve().then((result) => {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result.catalog));
          });
          return;
        }

        const posterMatch = /^\/posters\/([A-Za-z0-9_-]+)\.jpg/.exec(url);
        if (posterMatch?.[1] !== undefined) {
          const id = posterMatch[1];

          void resolve().then((result) => {
            const data = result.posters.get(id);

            if (data === undefined) {
              next();
              return;
            }

            response.setHeader('Content-Type', 'image/jpeg');
            response.end(Buffer.from(data));
          });
          return;
        }

        next();
      });
    },
  };
}

export default catalogPlugin;
