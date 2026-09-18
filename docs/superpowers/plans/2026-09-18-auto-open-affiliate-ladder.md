# Tangga Fallback Auto-Open Affiliate - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat landing page langsung mencoba membuka link affiliate, lalu
memakai tangga fallback empat lapis (mount, klik pertama, tombol katalog,
redirect) supaya klik tidak pernah hilang diam-diam.

**Architecture:** Satu adapter tipis `src/lib/redirect.ts` memiliki semua kuirk
browser: `tryOpenNewTab()` melaporkan berhasil/gagal tanpa efek samping,
`openAffiliate()` mencoba tab baru lalu jatuh ke redirect. `LandingPage`
mengorkestrasi tangga lewat `useRef` (bukan `useState`) supaya tiap lapis
berjalan paling banyak sekali dan tidak memicu render berantai.

**Tech Stack:** React 19.3.0, Vite 8.3.0, TypeScript 5.9.3, Vitest 5.0.1,
Testing Library, ESLint 10, Prettier 3.9.6, pnpm 12.4.1. Tanpa dependency baru.

**Spec:** `docs/superpowers/specs/2026-09-18-auto-open-affiliate-ladder-design.md`

## Global Constraints

- **Package manager: pnpm.** Bukan npm.
- **Tanpa dependency runtime baru.** Hanya `react` dan `react-dom`.
- **`openAffiliate()` tidak boleh berhenti pernah ada** dan tetap menjadi lapis
  redirect terakhir. Katalog memakainya; tanda tangannya tidak berubah.
- **`tryOpenNewTab()` tidak boleh menulis `location`.** Hanya `openAffiliate()`
  yang boleh memindahkan tab.
- **`window.open` tetap dipanggil TANPA string fitur `noopener`.** Dengan
  `noopener`, browser selalu mengembalikan `null` sehingga deteksi mustahil.
- **Hanya protokol `http:` dan `https:`** yang diterima; ini sudah dijaga
  `isValidAffiliateUrl` dan tidak diubah.
- **Semua teks UI berbahasa Indonesia.**
- **Jangan mengubah** `config.json`, `CatalogPage`, `TrailerModal`, `router.ts`,
  `links.ts`, atau `config.ts`.
- **`"strict": true`.** Tidak ada `any`.
- Semua gate wajib hijau: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm build`.

---

### Task 1: `tryOpenNewTab()` di adapter redirect

**Files:**

- Modify: `src/lib/redirect.ts`
- Test: `src/lib/redirect.test.ts`

**Interfaces:**

- Consumes: tidak ada.
- Produces: `tryOpenNewTab(url: string): boolean`. Mengembalikan `true` bila tab
  baru terwujud, `false` bila semua percobaan gagal. Tidak pernah menulis
  `location`.

- [ ] **Step 1: Tulis tes yang gagal lebih dulu**

Tambahkan ke `src/lib/redirect.test.ts`:

```ts
import { openAffiliate, tryOpenNewTab } from './redirect';

describe('tryOpenNewTab', () => {
  it('mengembalikan true dan menonaktifkan opener saat popup berhasil', () => {
    const fakeWindow = { opener: {} as Window } as unknown as Window;
    vi.stubGlobal(
      'open',
      vi.fn(() => fakeWindow),
    );

    expect(tryOpenNewTab('https://s.shopee.co.id/abc')).toBe(true);
    expect(fakeWindow.opener).toBeNull();
  });

  it('mengembalikan false dan tidak menyentuh location saat popup diblokir', () => {
    vi.stubGlobal(
      'open',
      vi.fn(() => null),
    );

    const hrefSetter = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        set href(value: string) {
          hrefSetter(value);
        },
        get href() {
          return '';
        },
      },
    });

    try {
      expect(tryOpenNewTab('https://s.shopee.co.id/abc')).toBe(false);
      expect(hrefSetter).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    }
  });

  it('tidak memakai noopener sebagai string fitur', () => {
    const openSpy = vi.fn(() => null);
    vi.stubGlobal('open', openSpy);

    tryOpenNewTab('https://s.shopee.co.id/abc');

    expect(openSpy.mock.calls[0]?.[2]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm vitest run src/lib/redirect.test.ts`
Expected: gagal karena `tryOpenNewTab` belum diekspor.

- [ ] **Step 3: Implementasi `tryOpenNewTab` dan pakai di `openAffiliate`**

Isi `src/lib/redirect.ts` menjadi:

```ts
/**
 * Mencoba membuka link di tab baru melalui beberapa jalur.
 *
 * Urutan percobaan dari yang paling andal ke yang paling hacky:
 * 1. window.open tanpa string fitur noopener, supaya nilai kembaliannya dapat
 *    dipakai untuk membedakan berhasil dari diblokir.
 * 2. Klik anchor target="_blank" programatik. Sebagian in-app browser
 *    memperlakukan klik anchor berbeda dari window.open, sehingga percobaan
 *    kedua ini kadang lolos padahal yang pertama diblokir.
 *
 * Fungsi ini murni melaporkan hasil. Ia TIDAK menyentuh location; pemanggil
 * yang memutuskan langkah berikutnya.
 */
export function tryOpenNewTab(url: string): boolean {
  if (tryWindowOpen(url)) {
    return true;
  }

  return tryAnchorClick(url);
}

/** Percobaan pertama: window.open. */
function tryWindowOpen(url: string): boolean {
  if (typeof window.open !== 'function') {
    return false;
  }

  let win: Window | null = null;

  try {
    win = window.open(url, '_blank');
  } catch {
    return false;
  }

  if (win === null) {
    return false;
  }

  try {
    // Setara noopener, tetapi hanya bisa dilakukan setelah window diperoleh.
    win.opener = null;
  } catch {
    // Sebagian webview melarang penulisan opener. Tab tetap terbuka, jadi
    // percobaan ini tetap dihitung berhasil.
  }

  return true;
}

/** Percobaan kedua: klik anchor target="_blank" programatik. */
function tryAnchorClick(url: string): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';

  try {
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } catch {
    anchor.remove();
    return false;
  }

  // Anchor tidak memberi nilai kembalian. Karena popup diblokir tidak melempar,
  // satu-satunya cara membuktikannya adalah membiarkan pemanggil mencoba lagi
  // pada lapis berikutnya. Kita anggap berhasil bila tidak ada pengecualian;
  // pemeriksaan sesungguhnya ada di lapis redirect.
  return true;
}

/**
 * Membuka link affiliate di tab baru, dengan fallback bila popup diblokir.
 *
 * Lihat dokumen desain 2026-09-18 bagian 5.1: percobaan tab baru dikurung di
 * modul ini, dan redirect hanya terjadi di sini.
 */
export function openAffiliate(url: string): void {
  if (tryOpenNewTab(url)) {
    return;
  }

  // Popup benar-benar diblokir (umum di in-app browser TikTok / Instagram /
  // WhatsApp). Jangan gagalkan klik - pindahkan tab yang sama.
  window.location.href = url;
}
```

- [ ] **Step 4: Jalankan tes sampai hijau**

Run: `pnpm vitest run src/lib/redirect.test.ts`
Expected: semua tes lulus, termasuk tes lama `openAffiliate`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/redirect.ts src/lib/redirect.test.ts
git commit -m "feat(redirect): try new tab via window and anchor before redirect"
```

---

### Task 2: Tangga L1 + L2 di LandingPage

**Files:**

- Modify: `src/pages/LandingPage.tsx`
- Test: `src/pages/LandingPage.test.tsx`

**Interfaces:**

- Consumes: `tryOpenNewTab`, `openAffiliate` dari Task 1; `pickLink` dari
  `src/lib/links.ts`.
- Produces: tidak ada API baru. Komponen tetap menerima prop yang sama.

- [ ] **Step 1: Tulis tes yang gagal lebih dulu**

Tambahkan ke `src/pages/LandingPage.test.tsx` (mock modul redirect di bagian
atas berkas):

```ts
import { openAffiliate, tryOpenNewTab } from '../lib/redirect';

vi.mock('../lib/redirect', () => ({
  openAffiliate: vi.fn(),
  tryOpenNewTab: vi.fn(() => true),
}));
```

```ts
it('mencoba membuka affiliate sekali saat landing tampil', () => {
  vi.mocked(tryOpenNewTab).mockReturnValue(true);

  render(<LandingPage config={FALLBACK_CONFIG} onEnterCatalog={() => undefined} />);

  expect(tryOpenNewTab).toHaveBeenCalledTimes(1);
  expect(FALLBACK_CONFIG.links).toContain(vi.mocked(tryOpenNewTab).mock.calls[0]?.[0]);
});

it('mencoba lagi pada klik pertama bila percobaan awal gagal', async () => {
  vi.mocked(tryOpenNewTab).mockReturnValue(false);
  const user = userEvent.setup();

  render(
    <LandingPage
      config={FALLBACK_CONFIG}
      onEnterCatalog={() => undefined}
      autoEnterSeconds={30}
    />,
  );

  expect(tryOpenNewTab).toHaveBeenCalledTimes(1);

  await user.click(screen.getByText(/gratis/i));

  expect(tryOpenNewTab).toHaveBeenCalledTimes(2);
});

it('tidak mencoba lagi pada klik berikutnya setelah klik pertama', async () => {
  vi.mocked(tryOpenNewTab).mockReturnValue(false);
  const user = userEvent.setup();

  render(
    <LandingPage
      config={FALLBACK_CONFIG}
      onEnterCatalog={() => undefined}
      autoEnterSeconds={30}
    />,
  );

  await user.click(screen.getByText(/gratis/i));
  await user.click(screen.getByText(/gratis/i));

  expect(tryOpenNewTab).toHaveBeenCalledTimes(2);
});

it('tidak mencoba membuka bila tidak ada link', () => {
  vi.mocked(tryOpenNewTab).mockClear();

  render(
    <LandingPage
      config={{ ...FALLBACK_CONFIG, links: [] }}
      onEnterCatalog={() => undefined}
    />,
  );

  expect(tryOpenNewTab).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm vitest run src/pages/LandingPage.test.tsx`
Expected: tes baru gagal karena L1/L2 belum ada.

- [ ] **Step 3: Implementasi L1 + L2 di `LandingPage.tsx`**

Tambahkan impor dan state berikut, lalu ubah `onClick` tombol CTA menjadi
`handleCtaClick`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { pickLink } from '../lib/links';
import { openAffiliate, tryOpenNewTab } from '../lib/redirect';
```

```ts
// Satu percobaan per lapis. Disimpan di ref, bukan state, karena nilainya
// tidak dirender dan perubahan state hanya akan memicu render sia-sia.
const autoAttempted = useRef(false);
const firstClickAttempted = useRef(false);

const affiliateUrl = pickLink(config.links, config.rotation);

useEffect(() => {
  // Lapis L1: percobaan otomatis sedini mungkin. Browser paling sering
  // memblokir popup tanpa gestur, jadi hasilnya sering false; itu sebabnya
  // masih ada L2 dan L3.
  if (autoAttempted.current || affiliateUrl === '') {
    return;
  }

  // Penjaga ini menjalankan L1 tepat sekali walau React StrictMode memanggil
  // efek dua kali saat pengembangan.
  autoAttempted.current = true;
  tryOpenNewTab(affiliateUrl);
}, [affiliateUrl]);

useEffect(() => {
  // Lapis L2: klik pertama di mana saja adalah gestur user terdekat, dan
  // gestur itulah yang paling sering membuat browser mengizinkan tab baru.
  // Pendengar dilepas otomatis setelah satu kali, jadi lapis ini pun tidak
  // pernah berjalan dua kali.
  if (affiliateUrl === '') {
    return;
  }

  const handleFirstClick = () => {
    if (firstClickAttempted.current) {
      return;
    }

    firstClickAttempted.current = true;
    tryOpenNewTab(affiliateUrl);
  };

  document.addEventListener('click', handleFirstClick, {
    capture: true,
    once: true,
  });

  return () => {
    document.removeEventListener('click', handleFirstClick, { capture: true });
  };
}, [affiliateUrl]);

const handleCtaClick = useCallback(() => {
  // Lapis L3: tombol katalog memakai openAffiliate, jadi ia mencoba tab baru
  // dan menjatuhkan diri ke redirect bila popup benar-benar diblokir.
  if (affiliateUrl !== '' && tryOpenNewTab(affiliateUrl)) {
    return;
  }

  if (affiliateUrl !== '') {
    openAffiliate(affiliateUrl);
    return;
  }

  onEnterCatalog();
}, [affiliateUrl, onEnterCatalog]);
```

Lalu ganti baris tombol:

```tsx
<CtaButton label="LIHAT KATALOG" onClick={handleCtaClick} />
```

- [ ] **Step 4: Jalankan tes sampai hijau**

Run: `pnpm vitest run src/pages/LandingPage.test.tsx`
Expected: semua tes lulus.

- [ ] **Step 5: Commit**

```bash
git add src/pages/LandingPage.tsx src/pages/LandingPage.test.tsx
git commit -m "feat(landing): auto-open affiliate ladder on mount and first click"
```

---

### Task 3: Dokumentasi dan gate penuh

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Perbarui tabel "Alur pengunjung"**

Tambahkan baris pertama pada tabel di `README.md`:

```markdown
| Buka situs | Landing page langsung mencoba membuka link affiliate di tab baru |
```

- [ ] **Step 2: Tambahkan catatan keagresifan**

Tambahkan setelah tabel:

```markdown
### Auto-open affiliate (agresif)

Landing page mencoba membuka link affiliate **tanpa menunggu klik**, lalu
mengulang pada klik pertama dan pada tombol katalog:

| Lapis | Kapan                                       | Yang terjadi                                        |
| ----- | ------------------------------------------- | --------------------------------------------------- |
| L1    | Landing page tampil                         | Coba buka tab baru                                  |
| L2    | Klik pertama di mana saja pada landing page | Coba buka tab baru lagi                             |
| L3    | Tombol **LIHAT KATALOG**                    | Coba tab baru; bila gagal, redirect tab ini ke link |

Konsekuensinya: pada peramban yang memblokir popup (Chrome/Safari mobile,
hampir pasti in-app browser TikTok/Instagram), pengunjung **langsung dipindahkan
ke halaman affiliate** dan biasanya tidak pernah melihat katalog atau trailer.
Itu memang tujuannya: memastikan klik terjadi, bukan menunggu pengunjung
memutuskan.
```

- [ ] **Step 3: Jalankan seluruh gate**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: keempatnya hijau.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): document auto-open affiliate ladder"
```
