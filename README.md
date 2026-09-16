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
