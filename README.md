# DraChinLandingPage

Situs statis untuk GitHub Pages. Tiga lapisan:

1. **Landing page** — halaman clickbait dengan hitungan mundur 8 detik.
2. **Katalog drama** — grid poster yang dibangun otomatis dari TMDB saat build.
3. **Modal trailer** — trailer YouTube diputar di atas katalog; tombol di dalam
   modal membuka link Shopee affiliate.

Tidak ada server. Semua berkas statis.

## Alur pengunjung

| Langkah                            | Yang terjadi                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| Buka situs                         | Landing page tampil, hitungan mundur 8 detik mulai                                             |
| Klik **LIHAT KATALOG** atau tunggu | Masuk ke katalog (riwayat di-_replace_, jadi tombol kembali tidak memicu hitungan mundur lagi) |
| Klik kartu drama                   | Modal terbuka, URL jadi `#/drama/<id>`, trailer diputar otomatis                               |
| Tutup modal                        | Tombol ✕, tombol Esc, klik area gelap, atau tombol kembali peramban                            |
| Klik **TONTON FULL DI SHOPEE**     | Link affiliate dibuka di tab baru                                                              |

## Mengganti link affiliate

Tidak perlu terminal, tidak perlu build ulang. Semua konten landing page ada di
satu berkas.

1. Buka `public/config.json` di GitHub
2. Klik ikon pensil (Edit)
3. Ubah bagian yang diinginkan
4. Klik **Commit changes**

GitHub Actions membangun ulang dan men-deploy otomatis, sekitar 1-2 menit.

### Isi `config.json`

```json
{
  "brand": "DRACINMOVIE",
  "headline": "Drama ini bikin kamu lupa waktu",
  "subheadline": "Episode baru tiap hari • Sub Indo",
  "ctaText": "TONTON SEKARANG",
  "poster": "./poster.jpg",
  "badges": ["HD", "Sub Indo", "Full Episode"],
  "links": ["https://s.shopee.co.id/link-anda"],
  "rotation": "sequence"
}
```

| Kunci         | Arti                                                            |
| ------------- | --------------------------------------------------------------- |
| `brand`       | Nama merek di header dan footer halaman katalog                 |
| `headline`    | Judul besar di landing page                                     |
| `subheadline` | Kalimat kecil di bawah judul                                    |
| `ctaText`     | Teks tombol di dalam modal trailer                              |
| `poster`      | Latar landing page. Kosongkan (`""`) untuk memakai gradien saja |
| `badges`      | Label kecil di atas judul                                       |
| `links`       | Daftar link Shopee. Boleh lebih dari satu                       |
| `rotation`    | `"sequence"` (bergiliran) atau `"random"` (acak)                |

## Header dan footer

Halaman **katalog** memakai kerangka tetap: header berisi nama merek
(`brand`) dan footer berisi atribusi TMDB. Keduanya **sengaja tanpa tombol
sama sekali** — satu-satunya kontrol di halaman katalog adalah kartu drama.

Landing page tidak memakai kerangka ini. Landing page hanya memuat satu baris
atribusi TMDB kecil di paling bawah, karena posternya juga berasal dari TMDB.

Atribusi TMDB tidak boleh dihapus: syarat pemakaian API TMDB mewajibkannya.

Dengan `"rotation": "sequence"`, setiap kunjungan membuka link berikutnya,
berguna untuk A/B test. Hanya URL `http` dan `https` yang diterima; skema lain
dibuang otomatis.

### Poster landing page

Saran: rasio **2:3** (misalnya 1080x1620 px), ukuran **di bawah 300 KB**, format
`.webp` bila memungkinkan. Simpan sebagai `public/poster.jpg` agar cocok dengan
nilai bawaan di `config.json`.

Poster yang ada sekarang **hanyalah contoh**: satu poster dracin acak yang
diunduh dari TMDB saat proyek ini dibuat (1600x2398, sekitar 214 KB). Ganti
dengan poster pilihan Anda dengan cara menimpa berkas `public/poster.jpg` —
tidak perlu mengubah kode.

Bila berkasnya belum ada atau gagal dimuat, halaman memakai latar gradien —
tidak muncul ikon gambar rusak.

## Katalog drama

Katalog **tidak** ditulis tangan. Saat `pnpm build`, plugin di
`tools/catalog/vitePlugin.ts` memanggil TMDB, mengambil drama China
(`with_original_language=zh`, `vote_count.gte=30`), mengunduh posternya, lalu
menulis:

| Hasil build          | Isi                                                  |
| -------------------- | ---------------------------------------------------- |
| `dist/catalog.json`  | Daftar judul, sinopsis, tahun, rating, trailer       |
| `dist/posters/*.jpg` | Poster, diunduh saat build (bukan _hotlink_ ke TMDB) |

Katalog berubah setiap kali build karena halaman TMDB yang dipakai diundi dari
sekumpulan halaman teratas. Deploy ulang = katalog baru, tanpa mengubah kode.

Semua kolom di `catalog.json` divalidasi ulang di peramban
(`src/lib/catalogSchema.ts`). Entri cacat dibuang, jalur poster yang keluar dari
folder sendiri ditolak, dan ID trailer yang bukan 11 karakter YouTube ditolak.

### Kata kunci trailer

Trailer diambil dari TMDB `/videos` dengan bahasa `id-ID`, lalu jatuh ke
`en-US`, lalu ke bahasa apa pun. Judul tanpa trailer tetap tampil di katalog;
modalnya hanya menampilkan keterangan bahwa trailer belum tersedia.

## Kunci API TMDB

`TMDB_API_KEY` **tanpa** prefix `VITE_` — sengaja. Variabel ber-prefix `VITE_`
akan disuntikkan ke bundle JavaScript dan bisa dibaca siapa pun lewat DevTools.
Variabel ini hanya dibaca proses Node saat build, jadi tidak pernah sampai ke
peramban.

- **GitHub Actions:** ambil dari repository secret bernama `TMDB_API_KEY`
- **Lokal:** taruh di berkas `.env` (di-_ignore_ git). Lihat `.env.example`

Workflow deploy punya langkah pengaman: build **gagal** bila nilai kunci ternyata
ikut tertulis ke dalam `dist/`.

Bila kunci kosong, build tetap sukses dan memakai katalog cadangan berisi 6
judul tanpa poster. Situs tidak pernah gagal ter-deploy karena kunci hilang.

## Pengembangan lokal

```bash
pnpm install
pnpm dev
```

Perintah lain:

```bash
pnpm lint          # ESLint
pnpm typecheck     # TypeScript
pnpm test          # Vitest
pnpm format        # Prettier (--write)
pnpm format:check  # Prettier (periksa saja)
pnpm build         # build ke dist/ (memanggil TMDB)
pnpm preview       # menyajikan hasil build
```

Kebutuhan: Node.js `^22.12.0 || ^24.0.0 || >=26.0.0` dan pnpm.

## Struktur singkat

| Path                              | Isi                                                        |
| --------------------------------- | ---------------------------------------------------------- |
| `public/config.json`              | Semua konten landing page yang biasa diganti               |
| `src/App.tsx`                     | Rute: landing atau katalog                                 |
| `src/lib/router.ts`               | Pengubah hash ke rute dan sebaliknya                       |
| `src/pages/LandingPage.tsx`       | Landing page dan hitungan mundur                           |
| `src/pages/CatalogPage.tsx`       | Grid katalog dan pemuatan poster                           |
| `src/components/TrailerModal.tsx` | Modal trailer (`<dialog>` native)                          |
| `src/lib/redirect.ts`             | Membuka link, termasuk fallback bila popup diblokir        |
| `src/lib/config.ts`               | Pemuatan dan validasi `config.json`                        |
| `tools/catalog/`                  | Pembangun katalog (berjalan saat build, bukan di peramban) |
| `archive/browser.html`            | Versi lama, arsip, tidak ter-deploy                        |

### Catatan teknis

- **Popup diblokir.** `window.open(url, '_blank', 'noopener')` selalu
  mengembalikan `null`, jadi pemblokiran popup tidak bisa dideteksi. Kode ini
  membuka tab tanpa `noopener`, lalu memutus `opener` secara manual. Bila tetap
  diblokir (umum di peramban dalam aplikasi seperti TikTok/Instagram), halaman
  berpindah di tab yang sama supaya klik tidak hilang.
- **Suara trailer.** Iframe hanya dirender selama modal terbuka. Bila iframe
  dibiarkan terpasang, suara trailer akan terus berbunyi walau modal tertutup.
- **Modal ditunda.** Modal tidak dibuka selama poster masih dimuat, karena
  trailer akan berbunyi di balik layar yang belum siap.

## `archive/browser.html`

Versi lama berupa browser drama berbasis TMDB. Disimpan hanya sebagai referensi
dan tidak ikut ter-deploy. Berkas ini tidak akan berfungsi tanpa API key TMDB,
yang sengaja tidak disertakan.
