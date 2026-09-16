// loadEnv datang dari 'vite', sedangkan defineConfig tetap dari 'vitest/config'.
// Jangan ganti ke 'vite': defineConfig milik Vite tidak mengenal blok `test`,
// sehingga `pnpm typecheck` akan gagal pada berkas ini.
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { catalogPlugin } from './tools/catalog/vitePlugin.ts';

// base: './' membuat semua path aset relatif sehingga aplikasi tetap bekerja
// baik di username.github.io/<repo>/ maupun di domain kustom, tanpa mengubah
// konfigurasi. Mendukung kebutuhan "domain akan berganti-ganti".
//
// TMDB_API_KEY dibaca lewat loadEnv dan HANYA dipakai di dalam plugin saat
// build. Nama variabelnya tanpa prefix VITE_, jadi nilainya tidak pernah masuk
// ke kode aplikasi dan tidak pernah ikut terkirim ke browser.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: './',
    plugins: [
      react(),
      catalogPlugin({
        apiKey: env['TMDB_API_KEY'] ?? '',
        limit: Number(env['CATALOG_LIMIT'] ?? 20),
        language: env['CATALOG_LANGUAGE'] ?? 'id-ID',
        fallbackLanguage: env['CATALOG_FALLBACK_LANGUAGE'] ?? 'en-US',
        pagePool: Number(env['CATALOG_PAGE_POOL'] ?? 20),
        timeoutMs: Number(env['CATALOG_TIMEOUT_MS'] ?? 10_000),
      }),
    ],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test-setup.ts',
      include: ['src/**/*.test.{ts,tsx}', 'tools/**/*.test.ts'],
    },
  };
});
