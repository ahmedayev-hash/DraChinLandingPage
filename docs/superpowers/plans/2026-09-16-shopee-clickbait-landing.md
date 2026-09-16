# Shopee Clickbait Landing Page - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bangun single-page clickbait landing page yang memaksimalkan klik ke
Shopee affiliate, dengan link yang bisa diganti lewat web GitHub tanpa build
manual.

**Architecture:** React 19 + Vite 8 + TypeScript SPA. Konten (headline, CTA,
poster, link affiliate) hidup di `public/config.json` sebagai **data runtime** -
Vite menyalin `public/` apa adanya ke `dist/`, sehingga mengganti link tidak
memerlukan rebuild. Tiga modul logika murni (`config.ts`, `links.ts`,
`redirect.ts`) menangani pemuatan konfigurasi, pemilihan link, dan pembukaan tab
dengan fallback anti-popup-block.

**Tech Stack:** React 19.3.0, Vite 8.3.0, TypeScript 5.9.3, Vitest 5.0.1,
ESLint 10.10.0, Prettier 3.9.6, pnpm 12.4.1.

**Spec:** `docs/superpowers/specs/2026-09-16-shopee-clickbait-landing-design.md`

## Global Constraints

- **Package manager: pnpm** (terpasang 12.4.1). Bukan npm.
- **Node `^22.12.0 || ^24.0.0 || >=26.0.0`** - irisan `engines` `vite@8.3.0`
  dan `vitest@5.0.1`. Mesin saat ini Node 24.21.0.
- **`typescript` DI-PIN `5.9.3`.** Jangan naikkan ke 7.x:
  `typescript-eslint@8.70.0` mensyaratkan `>=4.8.4 <6.1.0`.
- **Semua path relatif.** `base: './'` di `vite.config.ts`.
- **`config.json` WAJIB di `public/`** dan `dist/config.json` harus ada setelah
  build. Ini inti tujuan G3.
- **Hanya protokol `http:` dan `https:`** yang diterima untuk link affiliate.
- **`window.open` dipanggil TANPA `noopener`** - dengan `noopener` browser
  selalu mengembalikan `null` sehingga deteksi popup-block mustahil. Set
  `win.opener = null` setelah berhasil.
- **Tidak ada rahasia di repo.** `archive/browser.html` wajib bebas API key.
- **`"strict": true`** di tsconfig.
- **Bahasa UI: Indonesia.**

---

## File Structure

| File                                                            | Tanggung jawab                                         |
| --------------------------------------------------------------- | ------------------------------------------------------ |
| `package.json`                                                  | Dependensi dipin, scripts, `engines`, `packageManager` |
| `vite.config.ts`                                                | `base: './'`, plugin React, konfigurasi Vitest         |
| `tsconfig.json` + `.app.json` + `.node.json`                    | Project references, strict                             |
| `eslint.config.js`                                              | Flat config ESLint 10 + typescript-eslint              |
| `.prettierrc.json`, `.gitignore`, `.gitattributes`, `.nojekyll` | Konfigurasi repo                                       |
| `index.html`                                                    | Entry Vite, meta mobile, `#root`                       |
| `src/main.tsx`                                                  | Mount React                                            |
| `src/App.tsx`                                                   | Halaman: muat config, render poster + CTA              |
| `src/components/CtaButton.tsx`                                  | Tombol CTA aksesibel                                   |
| `src/lib/config.ts`                                             | Fetch + validasi + fallback                            |
| `src/lib/links.ts`                                              | Pemilihan link (sequence/random)                       |
| `src/lib/redirect.ts`                                           | Buka tab baru + fallback popup-blocked                 |
| `src/styles.css`                                                | Tampilan premium                                       |
| `public/config.json`                                            | **Satu-satunya file yang diedit rutin**                |
| `archive/browser.html`                                          | `HTML.html` lama, API key distrip                      |
| `.github/workflows/deploy.yml`                                  | Build + deploy GitHub Pages                            |

---

### Task 1: Scaffold proyek dan toolchain

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`,
`tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`,
`.prettierrc.json`, `.gitignore`, `.gitattributes`, `.nojekyll`, `index.html`,
`.env.example`, `src/test-setup.ts`, `src/main.tsx`, `src/App.tsx`,
`src/styles.css`

**Interfaces:**

- Consumes: tidak ada
- Produces: `pnpm dev|build|lint|typecheck|test` dapat dijalankan; `#root` ada
  di `index.html`

- [ ] **Step 1: Tulis `package.json`**

```json
{
  "name": "drachin-landing-page",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "packageManager": "pnpm@12.4.1",
  "engines": {
    "node": "^22.12.0 || ^24.0.0 || >=26.0.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "typecheck": "tsc -b --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "19.3.0",
    "react-dom": "19.3.0"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@testing-library/jest-dom": "7.0.1",
    "@testing-library/react": "16.3.3",
    "@testing-library/user-event": "14.6.1",
    "@types/node": "22.20.3",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.1.1",
    "eslint": "10.10.0",
    "eslint-plugin-react-hooks": "7.1.1",
    "globals": "16.6.0",
    "jsdom": "30.0.1",
    "prettier": "3.9.6",
    "typescript": "5.9.3",
    "typescript-eslint": "8.70.0",
    "vite": "8.3.0",
    "vitest": "5.0.1"
  }
}
```

- [ ] **Step 2: Tulis `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
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
```

- [ ] **Step 3: Tulis tiga file tsconfig**

`tsconfig.json`:

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
```

`tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

> `tsBuildInfoFile` diarahkan ke `node_modules/.tmp/` supaya `tsc -b` tidak
> menumpahkan `*.tsbuildinfo` ke root proyek (diverifikasi terjadi di draft awal).

- [ ] **Step 4: Tulis `eslint.config.js`**

```js
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'archive'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    files: ['*.config.{js,ts}', 'vite.config.ts', 'src/test-setup.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);
```

- [ ] **Step 5: Tulis konfigurasi repo**

`.prettierrc.json`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 90,
  "tabWidth": 2,
  "endOfLine": "lf"
}
```

`.gitignore`:

```text
node_modules/
dist/
*.tsbuildinfo
.env
.env.local
.env.*.local
*.local
.DS_Store
.vite/
```

`.gitattributes`:

```text
* text=auto eol=lf
```

`.nojekyll`: file kosong (nol byte). Mencegah GitHub Pages memproses folder
ber-underscore seperti `_assets` hasil build Vite.

- [ ] **Step 6: Tulis `index.html`**

```html
<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover"
    />
    <meta name="theme-color" content="#090a0e" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Nonton Sekarang</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

> `noindex` sesuai keputusan spec: tidak butuh SEO.

- [ ] **Step 7: Tulis `.env.example` dan `src/test-setup.ts`**

`.env.example`:

```text
# Proyek ini adalah situs statis (GitHub Pages).
#
# PERINGATAN: setiap variabel ber-prefix VITE_ akan DISUNTIKKAN ke dalam
# bundle JavaScript dan dapat dibaca siapa pun lewat DevTools. Jangan pernah
# menaruh API key, token, atau kredensial di sini.
#
# Jika suatu saat butuh rahasia sungguhan (mis. proxy TMDB), letakkan di
# backend terpisah (Cloudflare Worker / Vercel Function), bukan di proyek ini.
#
# Tidak ada variabel yang dibutuhkan saat ini.
```

`src/test-setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 8: Tulis placeholder `src/main.tsx`, `src/App.tsx`, `src/styles.css`**

`src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Elemen #root tidak ditemukan di index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx` (placeholder, diganti di Task 5):

```tsx
export default function App() {
  return <main>placeholder</main>;
}
```

`src/styles.css` (placeholder, diisi di Task 5):

```css
:root {
  color-scheme: dark;
}
```

- [ ] **Step 9: Install dependensi**

Run: `pnpm install`
Expected: selesai tanpa error; `node_modules/` dan `pnpm-lock.yaml` terbentuk.

- [ ] **Step 10: Verifikasi scaffold**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: ketiganya exit 0; `dist/index.html` terbentuk.
Catatan: `pnpm test` belum dijalankan karena test baru ditulis mulai Task 2.

- [ ] **Step 11: Commit**

```bash
git add package.json pnpm-lock.yaml vite.config.ts tsconfig*.json eslint.config.js .prettierrc.json .gitignore .gitattributes .nojekyll index.html .env.example src/
git commit -m "chore: scaffold React + Vite + TypeScript dengan tooling lengkap"
```

---

### Task 2: `redirect.ts` - buka tab baru dengan fallback anti-popup-block

**Files:** Create `src/lib/redirect.ts`, `src/lib/redirect.test.ts`

**Interfaces:**

- Consumes: tidak ada
- Produces: `export function openAffiliate(url: string): void`

Ini modul terpenting di proyek: bila ia gagal, klik hilang tanpa jejak.

- [ ] **Step 1: Tulis test yang gagal**

`src/lib/redirect.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openAffiliate } from './redirect';

describe('openAffiliate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('membuka tab baru dan menonaktifkan opener saat popup berhasil', () => {
    const fakeWindow = { opener: {} as Window } as unknown as Window;
    const openSpy = vi.fn(() => fakeWindow);
    vi.stubGlobal('open', openSpy);

    openAffiliate('https://s.shopee.co.id/abc');

    expect(openSpy).toHaveBeenCalledWith('https://s.shopee.co.id/abc', '_blank');
    expect(fakeWindow.opener).toBeNull();
  });

  it('tidak memakai noopener sebagai string fitur', () => {
    const openSpy = vi.fn(() => null);
    vi.stubGlobal('open', openSpy);

    openAffiliate('https://s.shopee.co.id/abc');

    // Argumen ketiga harus undefined. Dengan 'noopener', browser selalu
    // mengembalikan null sehingga deteksi popup-block menjadi mustahil.
    expect(openSpy.mock.calls[0]?.[2]).toBeUndefined();
  });

  it('memakai location.href saat popup diblokir', () => {
    const openSpy = vi.fn(() => null);
    vi.stubGlobal('open', openSpy);

    const hrefSetter = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        set href(value: string) {
          hrefSetter(value);
        },
      },
    });

    openAffiliate('https://s.shopee.co.id/fallback');

    expect(hrefSetter).toHaveBeenCalledWith('https://s.shopee.co.id/fallback');

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });
});
```

> Test ketiga mengganti `window.location` karena jsdom menolak navigasi nyata.
> Stub ini menjaga test tetap memverifikasi perilaku sebenarnya: bahwa jalur
> fallback benar-benar menulis ke `location.href`.

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `pnpm vitest run src/lib/redirect.test.ts`
Expected: FAIL dengan "Failed to resolve import" atau
"openAffiliate is not a function".

- [ ] **Step 3: Tulis implementasi**

`src/lib/redirect.ts`:

```ts
/**
 * Membuka link affiliate di tab baru, dengan fallback bila popup diblokir.
 *
 * Mengapa TIDAK memakai 'noopener' pada argumen window.open: ketika noopener
 * dispesifikasikan, browser SELALU mengembalikan null, bahkan saat popup
 * berhasil dibuka. Akibatnya mustahil membedakan "berhasil" dari "diblokir",
 * dan kode akan menjalankan fallback tanpa perlu. Sebagai gantinya kita
 * menonaktifkan opener secara manual setelah window berhasil diperoleh.
 *
 * Popup-block nyata terjadi di in-app browser (TikTok, Instagram, WhatsApp)
 * yang membawa mayoritas trafik affiliate. Di sana window.open mengembalikan
 * null, dan kita HARUS memindahkan tab yang sama agar klik tidak hilang
 * diam-diam.
 */
export function openAffiliate(url: string): void {
  const win = window.open(url, '_blank');

  if (win) {
    win.opener = null;
    return;
  }

  window.location.href = url;
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `pnpm vitest run src/lib/redirect.test.ts`
Expected: PASS, 3 test lulus.

- [ ] **Step 5: Commit**

```bash
git add src/lib/redirect.ts src/lib/redirect.test.ts
git commit -m "feat: redirect affiliate dengan fallback anti-popup-block"
```

---

### Task 3: `links.ts` - pemilihan link dengan rotasi

**Files:** Create `src/lib/links.ts`, `src/lib/links.test.ts`

**Interfaces:**

- Consumes: tidak ada
- Produces: `export type Rotation = 'sequence' | 'random'`;
  `export function pickLink(links: string[], rotation: Rotation, storage?: Storage | null): string`

- [ ] **Step 1: Tulis test yang gagal**

`src/lib/links.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pickLink } from './links';

const LINKS = ['https://a.example', 'https://b.example', 'https://c.example'];

function makeStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

describe('pickLink', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = makeStorage();
  });

  it('merotasi link secara berurutan', () => {
    expect(pickLink(LINKS, 'sequence', storage)).toBe('https://a.example');
    expect(pickLink(LINKS, 'sequence', storage)).toBe('https://b.example');
    expect(pickLink(LINKS, 'sequence', storage)).toBe('https://c.example');
    expect(pickLink(LINKS, 'sequence', storage)).toBe('https://a.example');
  });

  it('menyimpan indeks di storage antar pemanggilan', () => {
    const reused = makeStorage();
    expect(pickLink(LINKS, 'sequence', reused)).toBe('https://a.example');
    expect(pickLink(LINKS, 'sequence', reused)).toBe('https://b.example');
    expect(pickLink(LINKS, 'sequence', reused)).toBe('https://c.example');
  });

  it('selalu mengembalikan elemen valid pada mode random', () => {
    for (let i = 0; i < 40; i += 1) {
      expect(LINKS).toContain(pickLink(LINKS, 'random', storage));
    }
  });

  it('tidak crash saat storage melempar error', () => {
    const broken = {
      getItem: vi.fn(() => {
        throw new Error('storage diblokir');
      }),
      setItem: vi.fn(() => {
        throw new Error('storage diblokir');
      }),
    } as unknown as Storage;

    expect(() => pickLink(LINKS, 'sequence', broken)).not.toThrow();
    expect(LINKS).toContain(pickLink(LINKS, 'sequence', broken));
  });

  it('mengembalikan string kosong bila daftar link kosong', () => {
    expect(pickLink([], 'sequence', storage)).toBe('');
  });

  it('mengembalikan satu-satunya link tanpa menyentuh storage', () => {
    const spy = makeStorage();
    const setItem = vi.spyOn(spy, 'setItem');
    expect(pickLink(['https://only.example'], 'sequence', spy)).toBe(
      'https://only.example',
    );
    expect(setItem).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `pnpm vitest run src/lib/links.test.ts`
Expected: FAIL - modul `./links` belum ada.

- [ ] **Step 3: Tulis implementasi**

`src/lib/links.ts`:

```ts
export type Rotation = 'sequence' | 'random';

const STORAGE_KEY = 'dracin.rotationIndex';

function resolveStorage(storage: Storage | null | undefined): Storage | null {
  if (storage !== undefined) {
    return storage;
  }
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Mengakses localStorage dapat melempar di sebagian webview dengan mode
    // private. Kegagalan di sini tidak boleh merusak alur klik.
    return null;
  }
}

function safeGet(storage: Storage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage: Storage | null, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // Sengaja diabaikan: lihat resolveStorage.
  }
}

/**
 * Memilih satu link dari daftar.
 *
 * Mode 'sequence' merotasi link secara berurutan dan menyimpan posisinya di
 * storage, sehingga kunjungan berurutan membuka link berbeda - berguna untuk
 * A/B test dua link Shopee. Bila storage tidak dapat dipakai, rotasi turun ke
 * pemilihan acak agar alur klik tetap berfungsi.
 */
export function pickLink(
  links: string[],
  rotation: Rotation,
  storage?: Storage | null,
): string {
  if (links.length === 0) {
    return '';
  }

  if (links.length === 1) {
    return links[0] ?? '';
  }

  const store = resolveStorage(storage);

  if (rotation === 'random') {
    return links[Math.floor(Math.random() * links.length)] ?? '';
  }

  const stored = safeGet(store, STORAGE_KEY);
  const parsed = stored === null ? Number.NaN : Number.parseInt(stored, 10);
  const index = Number.isFinite(parsed) && parsed >= 0 ? parsed % links.length : 0;

  if (store === null) {
    // Tanpa storage, 'sequence' tidak dapat melacak posisi. Turun ke acak
    // supaya link tetap terdistribusi, bukan selalu mengembalikan link pertama.
    return links[Math.floor(Math.random() * links.length)] ?? '';
  }

  safeSet(store, STORAGE_KEY, String((index + 1) % links.length));

  return links[index] ?? '';
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `pnpm vitest run src/lib/links.test.ts`
Expected: PASS, 6 test lulus.

- [ ] **Step 5: Commit**

```bash
git add src/lib/links.ts src/lib/links.test.ts
git commit -m "feat: pemilihan link affiliate dengan rotasi dan fallback storage"
```

---

### Task 4: `config.ts` - pemuatan, validasi, dan fallback

**Files:** Create `src/lib/config.ts`, `src/lib/config.test.ts`

**Interfaces:**

- Consumes: `Rotation` dari `./links`
- Produces: `export interface SiteConfig`; `export const FALLBACK_CONFIG: SiteConfig`;
  `export function isValidAffiliateUrl(value: unknown): value is string`;
  `export function parseConfig(raw: unknown): SiteConfig`;
  `export async function loadConfig(fetcher?: typeof fetch): Promise<SiteConfig>`

- [ ] **Step 1: Tulis test yang gagal**

`src/lib/config.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { FALLBACK_CONFIG, isValidAffiliateUrl, loadConfig, parseConfig } from './config';

describe('isValidAffiliateUrl', () => {
  it('menerima http dan https', () => {
    expect(isValidAffiliateUrl('https://s.shopee.co.id/abc')).toBe(true);
    expect(isValidAffiliateUrl('http://example.com')).toBe(true);
  });

  it('menolak skema berbahaya dan nilai tidak valid', () => {
    expect(isValidAffiliateUrl('javascript:alert(1)')).toBe(false);
    expect(isValidAffiliateUrl('data:text/html,x')).toBe(false);
    expect(isValidAffiliateUrl('')).toBe(false);
    expect(isValidAffiliateUrl('bukan-url')).toBe(false);
    expect(isValidAffiliateUrl(123)).toBe(false);
    expect(isValidAffiliateUrl(null)).toBe(false);
  });
});

describe('parseConfig', () => {
  it('memakai nilai yang diberikan saat valid', () => {
    const config = parseConfig({
      headline: 'Judul',
      ctaText: 'KLIK',
      links: ['https://s.shopee.co.id/abc'],
      rotation: 'random',
      badges: ['HD'],
      poster: './p.jpg',
    });

    expect(config.headline).toBe('Judul');
    expect(config.ctaText).toBe('KLIK');
    expect(config.rotation).toBe('random');
    expect(config.links).toEqual(['https://s.shopee.co.id/abc']);
    expect(config.badges).toEqual(['HD']);
    expect(config.poster).toBe('./p.jpg');
  });

  it('membuang link dengan skema tidak valid', () => {
    const config = parseConfig({
      links: ['javascript:alert(1)', 'https://ok.example', 'data:x'],
    });
    expect(config.links).toEqual(['https://ok.example']);
  });

  it('jatuh ke fallback bila tidak ada link valid', () => {
    expect(parseConfig({ links: ['javascript:alert(1)'] }).links).toEqual(
      FALLBACK_CONFIG.links,
    );
    expect(parseConfig({ links: [] }).links).toEqual(FALLBACK_CONFIG.links);
  });

  it('jatuh ke fallback bila input bukan objek', () => {
    expect(parseConfig(null).links).toEqual(FALLBACK_CONFIG.links);
    expect(parseConfig('string').links).toEqual(FALLBACK_CONFIG.links);
    expect(parseConfig(undefined).links).toEqual(FALLBACK_CONFIG.links);
    expect(parseConfig(42).links).toEqual(FALLBACK_CONFIG.links);
  });

  it('memakai rotation sequence bila nilainya tidak dikenal', () => {
    expect(parseConfig({ rotation: 'acak' }).rotation).toBe('sequence');
  });

  it('memakai teks default bila field teks hilang atau kosong', () => {
    const config = parseConfig({ headline: '   ', subheadline: 123 });
    expect(config.headline).toBe(FALLBACK_CONFIG.headline);
    expect(config.subheadline).toBe(FALLBACK_CONFIG.subheadline);
  });
});

describe('loadConfig', () => {
  it('mengembalikan config saat fetch berhasil', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ headline: 'Halo', links: ['https://ok.example'] }),
    })) as unknown as typeof fetch;

    const config = await loadConfig(fetcher);
    expect(config.headline).toBe('Halo');
    expect(config.links).toEqual(['https://ok.example']);
  });

  it('menambahkan cache-busting pada URL', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await loadConfig(fetcher);
    expect(String(fetcher.mock.calls[0]?.[0])).toMatch(/^\.\/config\.json\?t=\d+$/);
  });

  it('memakai fallback saat fetch gagal', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;

    expect((await loadConfig(fetcher)).links).toEqual(FALLBACK_CONFIG.links);
  });

  it('memakai fallback saat response tidak ok', async () => {
    const fetcher = vi.fn(async () => ({
      ok: false,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    expect((await loadConfig(fetcher)).links).toEqual(FALLBACK_CONFIG.links);
  });

  it('memakai fallback saat JSON rusak', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => {
        throw new Error('JSON rusak');
      },
    })) as unknown as typeof fetch;

    expect((await loadConfig(fetcher)).links).toEqual(FALLBACK_CONFIG.links);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `pnpm vitest run src/lib/config.test.ts`
Expected: FAIL - modul `./config` belum ada.

- [ ] **Step 3: Tulis implementasi**

`src/lib/config.ts`:

```ts
import type { Rotation } from './links';

export interface SiteConfig {
  headline: string;
  subheadline: string;
  ctaText: string;
  poster: string;
  badges: string[];
  links: string[];
  rotation: Rotation;
}

/**
 * Link darurat yang ditanam di kode.
 *
 * Halaman ini tidak boleh pernah menampilkan tombol mati. Bila config.json
 * gagal dimuat - 404, offline, atau JSON rusak - konfigurasi inilah yang
 * dipakai sehingga tombol CTA tetap berfungsi.
 */
export const FALLBACK_CONFIG: SiteConfig = {
  headline: 'Drama ini bikin kamu lupa waktu',
  subheadline: 'Episode baru tiap hari • Sub Indo',
  ctaText: 'TONTON SEKARANG',
  poster: './poster.jpg',
  badges: ['HD', 'Sub Indo', 'Full Episode'],
  links: ['https://s.shopee.co.id/9peLe2gVIP'],
  rotation: 'sequence',
};

/** Hanya http dan https yang diterima. Skema lain ditolak. */
export function isValidAffiliateUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is string => typeof item === 'string' && item.trim() !== '',
  );
}

/** Menormalkan data mentah menjadi SiteConfig yang selalu dapat dipakai. */
export function parseConfig(raw: unknown): SiteConfig {
  const source =
    typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

  const links = readStringArray(source['links']).filter(isValidAffiliateUrl);
  const badges = readStringArray(source['badges']);

  return {
    headline: readString(source['headline'], FALLBACK_CONFIG.headline),
    subheadline: readString(source['subheadline'], FALLBACK_CONFIG.subheadline),
    ctaText: readString(source['ctaText'], FALLBACK_CONFIG.ctaText),
    poster: readString(source['poster'], FALLBACK_CONFIG.poster),
    badges: badges.length > 0 ? badges : FALLBACK_CONFIG.badges,
    links: links.length > 0 ? links : FALLBACK_CONFIG.links,
    rotation: source['rotation'] === 'random' ? 'random' : 'sequence',
  };
}

/**
 * Memuat config.json saat runtime.
 *
 * Query timestamp ditambahkan untuk cache busting: GitHub Pages men-cache aset
 * di CDN sekitar 10 menit, sehingga tanpa ini perubahan link akan tampak
 * "tidak berfungsi" selama beberapa menit setelah commit.
 */
export async function loadConfig(fetcher: typeof fetch = fetch): Promise<SiteConfig> {
  try {
    const response = await fetcher(`./config.json?t=${Date.now()}`);

    if (!response.ok) {
      return FALLBACK_CONFIG;
    }

    return parseConfig(await response.json());
  } catch {
    return FALLBACK_CONFIG;
  }
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `pnpm vitest run src/lib/config.test.ts`
Expected: PASS, 14 test lulus.

- [ ] **Step 5: Commit**

```bash
git add src/lib/config.ts src/lib/config.test.ts
git commit -m "feat: pemuatan config runtime dengan validasi dan link darurat"
```

---

### Task 5: UI - komponen, halaman, dan tampilan premium

**Files:** Create `src/components/CtaButton.tsx`,
`src/components/CtaButton.test.tsx`, `src/App.test.tsx`, `public/config.json`;
Modify `src/App.tsx`, `src/styles.css`

**Interfaces:**

- Consumes: `SiteConfig`, `loadConfig`, `FALLBACK_CONFIG` dari `./lib/config`;
  `pickLink` dari `./lib/links`; `openAffiliate` dari `./lib/redirect`
- Produces: `export function CtaButton(props: { label: string; onClick: () => void })`;
  `App` default export

- [ ] **Step 1: Tulis test yang gagal - `src/components/CtaButton.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CtaButton } from './CtaButton';

describe('CtaButton', () => {
  it('menampilkan label sebagai accessible name', () => {
    render(<CtaButton label="TONTON SEKARANG" onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /TONTON SEKARANG/ })).toBeInTheDocument();
  });

  it('memanggil onClick saat diklik', async () => {
    const onClick = vi.fn();
    render(<CtaButton label="TONTON" onClick={onClick} />);

    await userEvent.click(screen.getByRole('button', { name: /TONTON/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

Run: `pnpm vitest run src/components/CtaButton.test.tsx`
Expected: FAIL - `./CtaButton` belum ada.

- [ ] **Step 3: Tulis `src/components/CtaButton.tsx`**

```tsx
interface CtaButtonProps {
  label: string;
  onClick: () => void;
}

/**
 * Tombol ajakan utama.
 *
 * Memakai elemen <button> asli, bukan <div onclick>, agar dapat dijangkau
 * keyboard dan memiliki accessible name dari teks labelnya.
 */
export function CtaButton({ label, onClick }: CtaButtonProps) {
  return (
    <button type="button" className="cta" onClick={onClick}>
      <span className="cta__label">{label}</span>
      <span className="cta__icon" aria-hidden="true">
        ▶
      </span>
    </button>
  );
}
```

- [ ] **Step 4: Jalankan, pastikan LULUS**

Run: `pnpm vitest run src/components/CtaButton.test.tsx`
Expected: PASS, 2 test lulus.

- [ ] **Step 5: Tulis test yang gagal - `src/App.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import * as redirect from './lib/redirect';

function stubConfigFetch(payload: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => payload })),
  );
}

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('menampilkan CTA dengan teks dari config', async () => {
    stubConfigFetch({ ctaText: 'KLIK DISINI', links: ['https://ok.example'] });
    render(<App />);

    expect(
      await screen.findByRole('button', { name: /KLIK DISINI/ }),
    ).toBeInTheDocument();
  });

  it('membuka link yang benar saat CTA diklik', async () => {
    stubConfigFetch({ ctaText: 'KLIK DISINI', links: ['https://s.shopee.co.id/abc'] });
    const spy = vi.spyOn(redirect, 'openAffiliate').mockImplementation(() => {});

    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: /KLIK DISINI/ }));

    expect(spy).toHaveBeenCalledWith('https://s.shopee.co.id/abc');
  });

  it('tetap menampilkan CTA saat config gagal dimuat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    render(<App />);

    expect(await screen.findByRole('button')).toBeInTheDocument();
  });

  it('menyembunyikan poster dan tetap menampilkan CTA saat gambar gagal', async () => {
    stubConfigFetch({
      ctaText: 'KLIK',
      links: ['https://ok.example'],
      poster: './rusak.jpg',
    });
    render(<App />);

    const img = await screen.findByRole('img', { hidden: true });
    img.dispatchEvent(new Event('error'));

    expect(await screen.findByRole('button', { name: /KLIK/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Jalankan, pastikan GAGAL**

Run: `pnpm vitest run src/App.test.tsx`
Expected: FAIL - `App` masih placeholder dan tidak memuat config.

- [ ] **Step 7: Tulis `src/App.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { CtaButton } from './components/CtaButton';
import { FALLBACK_CONFIG, loadConfig, type SiteConfig } from './lib/config';
import { pickLink } from './lib/links';
import { openAffiliate } from './lib/redirect';

export default function App() {
  // Dimulai dari FALLBACK_CONFIG agar CTA langsung tampil dan dapat diklik
  // sejak frame pertama - tidak pernah ada tombol mati sementara config dimuat.
  const [config, setConfig] = useState<SiteConfig>(FALLBACK_CONFIG);
  const [posterFailed, setPosterFailed] = useState(false);

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

  const handleClick = useCallback(() => {
    const url = pickLink(config.links, config.rotation);
    if (url) {
      openAffiliate(url);
    }
  }, [config]);

  return (
    <main className="page">
      <div className="poster">
        {!posterFailed && (
          <img
            className="poster__img"
            src={config.poster}
            alt=""
            fetchPriority="high"
            onError={() => setPosterFailed(true)}
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

        <CtaButton label={config.ctaText} onClick={handleClick} />

        <p className="note">Gratis • Tanpa registrasi</p>
      </section>
    </main>
  );
}
```

- [ ] **Step 8: Tulis `src/styles.css`**

```css
:root {
  color-scheme: dark;
  --bg: #090a0e;
  --fg: #ffffff;
  --muted: #9aa0ab;
  --accent: #e50914;
  --safe-b: env(safe-area-inset-bottom, 0px);
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    Arial,
    sans-serif;
  -webkit-font-smoothing: antialiased;
}

.page {
  position: relative;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
}

/* Latar gelap selalu ada, sehingga poster yang gagal dimuat tidak
   menghasilkan area putih atau ikon gambar rusak. */
.poster {
  position: absolute;
  inset: 0;
  background: linear-gradient(160deg, #16181f 0%, #090a0e 70%);
}

.poster__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.poster__scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    var(--bg) 6%,
    rgba(9, 10, 14, 0.86) 34%,
    rgba(9, 10, 14, 0.35) 62%,
    rgba(9, 10, 14, 0.55) 100%
  );
}

.content {
  position: relative;
  width: 100%;
  max-width: 620px;
  margin: 0 auto;
  padding: 24px 20px calc(28px + var(--safe-b));
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.badges__item {
  padding: 5px 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #e8eaee;
  background: rgba(255, 255, 255, 0.06);
}

.headline {
  margin: 0;
  font-size: clamp(28px, 8.4vw, 44px);
  line-height: 1.05;
  letter-spacing: -0.03em;
  font-weight: 900;
}

.subheadline {
  margin: 0;
  color: var(--muted);
  font-size: clamp(14px, 3.9vw, 17px);
  line-height: 1.5;
}

.cta {
  margin-top: 6px;
  width: 100%;
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 0;
  border-radius: 14px;
  background: var(--accent);
  color: #fff;
  font-size: clamp(15px, 4.3vw, 19px);
  font-weight: 800;
  letter-spacing: 0.02em;
  cursor: pointer;
  box-shadow: 0 12px 34px rgba(229, 9, 20, 0.38);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    filter 160ms ease;
  -webkit-tap-highlight-color: transparent;
}

.cta:hover {
  filter: brightness(1.08);
}

.cta:active {
  transform: translateY(1px) scale(0.995);
}

/* Fokus keyboard harus terlihat jelas - aksesibilitas tidak dikorbankan
   demi tampilan. */
.cta:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 3px;
}

.cta__icon {
  font-size: 0.85em;
}

.note {
  margin: 2px 0 0;
  text-align: center;
  color: var(--muted);
  font-size: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .cta {
    transition: none;
  }
}
```

- [ ] **Step 9: Tulis `public/config.json`**

```json
{
  "headline": "Drama ini bikin kamu lupa waktu",
  "subheadline": "Episode baru tiap hari • Sub Indo",
  "ctaText": "TONTON SEKARANG",
  "poster": "./poster.jpg",
  "badges": ["HD", "Sub Indo", "Full Episode"],
  "links": ["https://s.shopee.co.id/9peLe2gVIP"],
  "rotation": "sequence"
}
```

- [ ] **Step 10: Jalankan seluruh test**

Run: `pnpm test`
Expected: PASS - seluruh test Task 2-5 lulus.

- [ ] **Step 11: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/styles.css src/components/ public/config.json
git commit -m "feat: halaman clickbait premium dengan CTA dan poster responsif"
```

---

### Task 6: Migrasi aset lama dan tulis ulang README

**Files:** Create `archive/browser.html`, `README.md` (ditulis ulang);
Delete `HTML.html`, `HTML`

**Interfaces:**

- Consumes: tidak ada
- Produces: tidak ada

> **Peringatan keamanan.** `archive/browser.html` **wajib** bebas API key TMDB
> sebelum di-commit. Tanpa langkah ini, key kembali masuk ke git history dan
> membatalkan seluruh upaya pembersihan.

- [ ] **Step 1: Salin `HTML.html` menjadi `archive/browser.html`**

Salin seluruh isi `HTML.html` ke `archive/browser.html`.

- [ ] **Step 2: Ganti API key dengan placeholder**

Di `archive/browser.html`, cari:

```js
const API_KEY = '<nilai-key-32-karakter-yang-ada-di-HTML.html>';
```

Ganti menjadi:

```js
// API key TMDB dihapus saat migrasi ke landing page affiliate.
// Key lama sudah publik di riwayat git dan WAJIB di-revoke di dashboard TMDB.
// File ini sengaja tidak dapat dijalankan tanpa key.
const API_KEY = 'MASUKKAN_API_KEY_TMDB_DI_SINI_BILA_INGIN_MENJALANKAN';
```

Catatan: file asli memakai indentasi berbeda dan kemungkinan tanda kutip ganda.
Sesuaikan dengan bentuk aslinya; yang penting string key-nya hilang.

- [ ] **Step 3: Tambahkan komentar arsip di bagian atas file**

Tepat setelah baris `<!DOCTYPE html>`, tambahkan:

```html
<!--
  ARSIP - tidak ikut ter-deploy ke GitHub Pages (berada di luar folder public/).
  Ini versi lama browser drama berbasis TMDB, disimpan hanya sebagai referensi.
  Tidak akan berfungsi tanpa API key TMDB.
-->
```

- [ ] **Step 4: Verifikasi key benar-benar hilang - BLOKIR bila gagal**

Run: `grep -rnE "0f29[0-9a-f]{28}" archive/ || echo "BERSIH"`
Expected: `BERSIH`.

Jangan lanjut sebelum output benar-benar `BERSIH`.

- [ ] **Step 5: Hapus file lama**

Run: `git rm HTML.html HTML`
Expected: kedua file terhapus dari index git.

Isi `HTML.html` sudah tersalin ke `archive/browser.html` pada Step 1, dan versi
aslinya tetap ada di commit `9b5b035`.

- [ ] **Step 6: Tulis ulang `README.md`**

````markdown
# DraChinLandingPage

Landing page clickbait satu halaman. Tombol CTA membuka link Shopee affiliate di
tab baru.

## Mengganti link affiliate

Tidak perlu terminal, tidak perlu build. Semua konten ada di satu file.

1. Buka `public/config.json` di GitHub
2. Klik ikon pensil (Edit)
3. Ubah bagian yang diinginkan
4. Klik **Commit changes**

GitHub Actions membangun ulang dan men-deploy otomatis, sekitar 1-2 menit.

### Isi `config.json`

```json
{
  "headline": "Drama ini bikin kamu lupa waktu",
  "subheadline": "Episode baru tiap hari",
  "ctaText": "TONTON SEKARANG",
  "poster": "./poster.jpg",
  "badges": ["HD", "Sub Indo"],
  "links": ["https://s.shopee.co.id/link-anda"],
  "rotation": "sequence"
}
```

Anda dapat menambahkan lebih dari satu link ke array `links`. Dengan
`"rotation": "sequence"`, setiap kunjungan membuka link berikutnya, berguna
untuk A/B test. Gunakan `"rotation": "random"` untuk pemilihan acak.

Hanya URL `http` dan `https` yang diterima. Link dengan skema lain akan dibuang
otomatis.

## Mengganti poster

Saran: rasio **2:3** (misalnya 1080x1620 px), ukuran **di bawah 300 KB**, format
`.webp` bila memungkinkan. Poster menentukan seberapa cepat halaman terasa
tampil, jadi foto besar dari ponsel akan membuatnya lambat.

Bila gambar gagal dimuat, halaman memakai latar gradien, sehingga tidak muncul
ikon gambar rusak.

## Pengembangan lokal

```bash
pnpm install
pnpm dev
```

Perintah lain:

```bash
pnpm lint         # ESLint
pnpm typecheck    # TypeScript
pnpm test         # Vitest
pnpm build        # build ke dist/
pnpm format       # Prettier
```

Kebutuhan: Node.js `^22.12.0 || ^24.0.0 || >=26.0.0` dan pnpm.

## Struktur singkat

| Path                   | Isi                                     |
| ---------------------- | --------------------------------------- |
| `public/config.json`   | Semua konten yang biasa diganti         |
| `src/App.tsx`          | Halaman                                 |
| `src/lib/config.ts`    | Pemuatan dan validasi config            |
| `src/lib/links.ts`     | Pemilihan link                          |
| `src/lib/redirect.ts`  | Membuka link dan fallback popup-blocked |
| `archive/browser.html` | Versi lama (arsip, tidak ter-deploy)    |

## `archive/browser.html`

Versi lama berupa browser drama berbasis TMDB. Disimpan hanya sebagai referensi
dan tidak ikut ter-deploy. File ini tidak akan berfungsi tanpa API key TMDB,
yang sengaja tidak disertakan.
````

- [ ] **Step 7: Verifikasi tidak ada key di seluruh repo kerja**

Run: `grep -rnE "0f29[0-9a-f]{28}" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist || echo "BERSIH"`
Expected: `BERSIH`, atau hanya kecocokan di `docs/` yang berupa bentuk
terpotong (`0f29...109f`).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: arsipkan browser lama tanpa API key, hapus file nyasar, tulis ulang README"
```

---

### Task 7: Workflow deploy GitHub Pages

**Files:** Create `.github/workflows/deploy.yml`

**Interfaces:**

- Consumes: scripts `lint`, `typecheck`, `test`, `build` dari Task 1
- Produces: tidak ada

> Deploy **belum dijalankan** oleh task ini. Workflow hanya dibuat dan
> diverifikasi secara statis. Menjalankannya butuh push ke `main`, yang
> memerlukan otorisasi terpisah.

- [ ] **Step 1: Tulis `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

# Batalkan deploy yang masih berjalan bila ada push baru.
concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7.0.1

      - uses: pnpm/action-setup@v6.1.0

      - uses: actions/setup-node@v7.0.0
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build

      - uses: actions/configure-pages@v6.0.0

      - uses: actions/upload-pages-artifact@v5.0.0
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5.0.1
```

> Semua action dipin ke versi persis agar build tidak berubah perilaku tanpa
> sengaja. Versi diverifikasi dari GitHub Releases pada 16 Sep 2026.
> `pnpm/action-setup` membaca versi pnpm dari field `packageManager`, yang sudah
> ditambahkan di Task 1 Step 1.

- [ ] **Step 2: Verifikasi workflow adalah YAML valid**

Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml')); print('YAML valid')"`
Expected: `YAML valid`.

Bila `yaml` tidak tersedia, gunakan
`pnpm dlx js-yaml .github/workflows/deploy.yml > /dev/null && echo "YAML valid"`.
Jangan menandai langkah ini selesai tanpa salah satu perintah menghasilkan
output valid.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: workflow build dan deploy ke GitHub Pages"
```

---

### Task 8: Verifikasi akhir menyeluruh

**Files:** Modify `AGENTS.md`

**Interfaces:**

- Consumes: seluruh hasil Task 1-7
- Produces: bukti untuk laporan penyelesaian

- [ ] **Step 1: Jalankan seluruh pemeriksaan statis dan test**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: semuanya exit 0. Catat jumlah test yang lulus.

- [ ] **Step 2: Verifikasi `config.json` benar-benar ikut ke `dist/`**

Run: `ls -l dist/config.json && diff dist/config.json public/config.json && echo "IDENTIK"`
Expected: `IDENTIK`.

Ini memverifikasi tujuan G3, inti dari seluruh desain. Bila file ini tidak ada,
strategi harus diganti: pindahkan `config.json` ke root dan salin ke `dist/`
sebagai langkah build eksplisit.

- [ ] **Step 3: Verifikasi `config.json` benar-benar mengendalikan link yang diklik**

Catatan: URL darurat di `src/lib/config.ts` (`FALLBACK_CONFIG.links`) **memang
sengaja ikut ter-bundle** - itu perilaku yang diminta bagian 9 spec, bukan bug.
Fallback hanya dipakai saat `config.json` gagal dimuat.

Yang harus dibuktikan adalah kebalikannya: saat `config.json` berhasil dimuat,
URL yang dibuka berasal dari `config.json`, bukan dari bundle. Bukti runtime:
suntik `fetch` agar `config.json` mengembalikan link penanda yang berbeda, klik
CTA, lalu pastikan link penanda itulah yang dipakai.

Expected: link penanda dari `config.json` menang. Bila link bundle yang menang,
tujuan G3 gagal.

- [ ] **Step 4: Verifikasi tidak ada rahasia di artefak build**

Run: `grep -rniE "themoviedb|api_key|0f29[0-9a-f]{28}" dist/ || echo "BERSIH"`
Expected: `BERSIH`.

- [ ] **Step 5: Verifikasi runtime dari hasil build**

Jalankan `pnpm preview` di background, lalu ambil HTML-nya dengan curl:

Run: `curl -s http://localhost:4173/ | head -20`
Expected: HTML halaman terbentuk, dan `dist/config.json` dapat diambil:
`curl -s "http://localhost:4173/config.json"` mengembalikan JSON yang identik
dengan `public/config.json`.

Ini membuktikan config benar-benar tersedia sebagai data runtime di URL relatif.

- [ ] **Step 6: Perbarui `AGENTS.md` dengan konteks proyek yang terverifikasi**

Ganti bagian `Repository Notes` dengan nilai yang sudah terbukti:

```text
Frontend: React 19 + Vite 8 + TypeScript 5.9.3, entry src/App.tsx
Backend: tidak ada (static GitHub Pages)
Shared: public/config.json adalah sumber konten runtime
Tests: Vitest + jsdom + @testing-library/react
Generated files: dist/, node_modules/.tmp/*.tsbuildinfo

Targeted test: pnpm vitest run <path>
Typecheck: pnpm typecheck
Lint: pnpm lint

Important constraints:
- pnpm, bukan npm
- typescript dipin 5.9.3 (typescript-eslint mensyaratkan <6.1.0)
- jangan tambahkan 'noopener' ke window.open di src/lib/redirect.ts
- config.json harus tetap berada di public/
```

- [ ] **Step 7: Commit**

```bash
git add AGENTS.md
git commit -m "docs: catat konteks proyek yang terverifikasi di AGENTS.md"
```

---

## Catatan penutup

- **Tidak ada langkah push atau deploy** dalam rencana ini. Push ke `main` akan
  memicu deploy produksi dan memerlukan otorisasi terpisah dari pemilik proyek.
- **Revoke API key TMDB** adalah tindakan manual pemilik proyek di dashboard
  TMDB. Tidak ada langkah otomatis dalam rencana ini yang dapat
  menggantikannya.
