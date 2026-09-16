import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base: './' membuat semua path aset relatif sehingga aplikasi tetap bekerja
// baik di username.github.io/<repo>/ maupun di domain kustom, tanpa mengubah
// konfigurasi. Mendukung kebutuhan "domain akan berganti-ganti".
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
