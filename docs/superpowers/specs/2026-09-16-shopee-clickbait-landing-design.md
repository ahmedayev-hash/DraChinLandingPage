# Landing Page Clickbait Shopee Affiliate - Design

| | |
|---|---|
| **Tanggal** | 16 September 2026 |
| **Status** | Disetujui, siap masuk tahap implementation plan |
| **Repo** | `ahmedayev-hash/DraChinLandingPage` (public, GitHub Pages) |
| **Path spec** | `docs/superpowers/specs/2026-09-16-shopee-clickbait-landing-design.md` |

## 1. Ringkasan

Membangun ulang `HTML.html` yang ada (2414 baris, satu file monolitik) menjadi
**single-page clickbait landing page** dengan **React + Vite + TypeScript**, yang
tujuan utamanya adalah **memaksimalkan klik ke Shopee affiliate**, sambil
memberi pemilik proyek tooling pengembangan yang layak (linter, typechecker,
formatter, tests, build).

Target deploy: **GitHub Pages** (static hosting, tanpa server).

### Prinsip pengarah

1. **Konversi di atas segalanya.** Setiap keputusan teknis diukur dari satu hal:
   apakah ia menambah atau mengurangi jumlah klik yang berhasil sampai ke Shopee.
2. **Link affiliate harus bisa diganti dalam hitungan detik, tanpa terminal,
   tanpa build manual.** Ini kebutuhan eksplisit pemilik proyek karena link
   affiliate berganti sangat dinamis.
3. **Jangan pernah kehilangan klik secara diam-diam.** Kegagalan harus terlihat
   dan punya jalur fallback, bukan gagal sunyi.

## 2. Latar belakang dan masalah

### Kondisi saat ini

- `HTML.html` - 2414 baris, satu file berisi HTML + CSS + JS inline.
- Fitur: grid drama dari TMDB API, pencarian, load-more, player trailer YouTube,
  dan logika *two-step click* (klik 1 menjadi sponsor CPM/Shopee bergantian,
  klik 2 menjadi trailer).
- `README.md` - hanya satu baris deskripsi.
- File `HTML` (tanpa ekstensi) - ke-track git tapi sudah hilang dari working tree
  (file nyasar hasil rename yang salah).
- **TMDB API key `0f29...109f` sudah ter-commit dan repo bersifat publik.**

### Masalah

| # | Masalah | Dampak |
|---|---|---|
| M1 | Fitur drama/TMDB adalah mesin traffic, bukan mesin konversi. Untuk affiliate murni, kompleksitasnya tidak terbayar. | Halaman berat, banyak titik gagal |
| M2 | Mengganti link affiliate berarti mengedit JS inline di file 2414 baris. | Rawan salah, lambat, butuh terminal |
| M3 | API key TMDB publik dan masih aktif. | Risiko penyalahgunaan kuota |
| M4 | Tidak ada tooling: tanpa lint, typecheck, test, atau build. | Refactor berbahaya, bug tidak terdeteksi |
| M5 | Tidak ada mekanisme anti-popup-block. | Klik hilang diam-diam di in-app browser |

### Kebutuhan eksplisit dari pemilik proyek

- Frontend harus terasa **premium**, agar reach clickbait maksimal.
- Ingin **React + Vite + Node.js**, dengan **linter, typechecker, formatter,
  tests, dan build**.
- Link affiliate **sangat dinamis** - harus sangat mudah diganti.
- **Tidak butuh SEO** (domain akan berganti-ganti).
- Link diklik menjadi **langsung buka Shopee di tab baru** (tanpa countdown,
  tanpa dua langkah).

## 3. Tujuan

| # | Tujuan | Ukuran keberhasilan |
|---|---|---|
| G1 | Halaman clickbait premium yang meyakinkan di mobile | LCP < 2.5s di 4G; tidak ada layout shift |
| G2 | Klik membuka Shopee di tab baru | Setiap klik membuka Shopee, termasuk saat popup diblokir |
| G3 | Link bisa diganti tanpa terminal dan tanpa build manual | Edit 1 file di web GitHub, commit, live |
| G4 | Tooling berkualitas | `lint`, `typecheck`, `test`, `build` semua hijau |
| G5 | Bebas rahasia di dalam bundle | Tidak ada API key di repo maupun di `dist/` |
| G6 | Aman saat gonta-ganti domain | Semua aset dan config pakai path relatif |

## 4. Non-tujuan

Secara eksplisit **tidak** dikerjakan, agar scope tidak melebar:

- **SEO / ranking Google** - pemilik proyek menyatakan tidak perlu.
- **Multi-halaman / routing** - satu halaman saja.
- **Data drama dari TMDB** - dibuang sepenuhnya (menghapus M3 sekaligus).
- **Player video / trailer** - tidak diperlukan untuk alur klik-ke-Shopee.
- **Backend / proxy server** - GitHub Pages murni static.
- **Analytics** - di luar cakupan; bisa ditambah nanti.
- **Autentikasi / database** - tidak ada.

## 5. Keputusan arsitektur

### 5.1 Stack: React 19 + Vite 8 + TypeScript 5.9

**Dipilih.** Pemilik proyek secara sadar memilih jalur ini bukan semata karena
kebutuhan runtime, melainkan karena ingin **tooling dan struktur proyek yang
layak** untuk iterasi jangka panjang. Itu keputusan yang sah dan disetujui.

Yang didapat: komponen yang bisa diuji, TypeScript yang menangkap kesalahan
sebelum runtime, Vitest untuk regression test, ESLint + Prettier untuk
konsistensi, dan `vite build` untuk bundle yang di-minify.

### 5.2 Kenapa `config.json` di `public/` - keputusan paling penting

**Masalah:** build step dan "ganti link dengan gampang" saling bertentangan.
Jika link ditanam di source code, setiap perubahan memerlukan `npm run build`
manual, yang justru mempersulit pemilik proyek.

**Solusi:** Vite menyalin isi `public/` **apa adanya** ke `dist/` tanpa
memprosesnya. Dengan menaruh `config.json` di `public/`, konfigurasi menjadi
**data runtime, bukan bagian dari bundle**.

```ts
// src/lib/config.ts - dibaca saat halaman dibuka, bukan saat build
const res = await fetch(`./config.json?t=${Date.now()}`);
```

Sebab ini berhasil:

- Link **tidak ikut ter-bundle** - bisa diganti tanpa rebuild.
- Pemilik proyek cukup edit `config.json` di web GitHub, commit, live.
- GitHub Actions tetap rebuild untuk aset aplikasi, tapi konten link
  selalu diambil dari file runtime.

**Konsekuensi yang diterima:** `config.json` dapat dibaca siapa pun yang
membuka DevTools. Ini **tidak masalah** karena isinya memang link publik,
bukan rahasia. Lihat bagian 13.

### 5.3 Kenapa tanpa routing

Satu halaman, satu tujuan. React Router akan menambah sekitar 10KB dan
kompleksitas tanpa manfaat. Semua interaksi ada di satu layar.

### 5.4 Kenapa `base: './'` di `vite.config.ts`

Pemilik proyek menyatakan domain akan berganti-ganti. Dengan `base: './'`,
semua path aset menjadi relatif sehingga aplikasi bekerja baik di
`username.github.io/repo/` maupun di domain kustom, **tanpa perlu mengubah
konfigurasi**.

## 6. Struktur file

```
DraChinLandingPage/
|-- index.html                  # entry Vite (root, bukan di public/)
|-- package.json
|-- vite.config.ts              # base: './', plugin React
|-- tsconfig.json               # strict: true
|-- tsconfig.node.json
|-- eslint.config.js            # flat config, ESLint 10
|-- .prettierrc.json
|-- .gitignore                  # termasuk .env
|-- .nojekyll                   # cegah GitHub Pages memproses folder ber-underscore
|-- .env.example                # dokumentasi: tidak ada secret client-side
|-- src/
|   |-- main.tsx                # mount React ke #root
|   |-- App.tsx                 # halaman clickbait
|   |-- styles.css              # tampilan premium (tema gelap lama dipertahankan)
|   |-- components/
|   |   `-- CtaButton.tsx       # tombol CTA (aksesibel, keyboard-ready)
|   `-- lib/
|       |-- config.ts           # load + validasi + fallback config
|       |-- links.ts            # pemilihan link (sequence / random)
|       `-- redirect.ts         # buka tab baru + fallback popup-blocked
|-- src/lib/__tests__/          # unit test Vitest
|-- public/
|   |-- config.json             # <<< SATU-SATUNYA file yang diedit rutin
|   `-- poster.jpg              # gambar poster (bisa diganti tanpa sentuh kode)
|-- archive/
|   `-- browser.html            # HTML.html lama, API key sudah distrip
`-- .github/workflows/deploy.yml # build + deploy ke GitHub Pages
```

**Catatan penempatan:**

- `archive/` berada **di luar `public/`** sehingga **tidak ikut ter-deploy**.
  Ini sengaja: mencegah file lama (beserta sisa jejak key) dapat diakses publik.
- `.env.example` disertakan atas permintaan pemilik proyek, namun isinya
  **murni dokumentasi** (lihat bagian 13.3).

## 7. Skema `public/config.json`

```jsonc
{
  // Teks utama. Boleh diganti kapan saja.
  "headline": "Drama ini bikin kamu lupa waktu",
  "subheadline": "Episode baru tiap hari - Sub Indo",
  "ctaText": "TONTON SEKARANG",

  // Gambar poster (URL absolut atau path relatif).
  "poster": "./poster.jpg",

  // Label kecil di atas poster.
  "badges": ["HD", "Sub Indo", "Full Episode"],

  // WAJIB: minimal satu link. Hanya http/https yang diterima.
  "links": ["https://s.shopee.co.id/9peLe2gVIP"],

  // "sequence" = bergantian tiap kunjungan (A/B test)
  // "random"   = acak merata
  "rotation": "sequence"
}
```

### Aturan validasi

| Field | Aturan | Jika tidak valid |
|---|---|---|
| `links` | Array, minimal 1, setiap item lolos `new URL()` dengan protokol `http:`/`https:` | Item tidak valid dibuang; bila kosong menjadi pakai link darurat |
| `headline`, `subheadline`, `ctaText` | String non-kosong | Pakai nilai default |
| `poster` | String; bila gagal dimuat maka skeleton disembunyikan | Fallback ke placeholder CSS |
| `rotation` | `"sequence"` atau `"random"` | Default `"sequence"` |

**Validasi protokol itu wajib.** Hanya `http:`/`https:` yang diterima; skema
lain (`javascript:`, `data:`) ditolak. Ini mencegah salah konfigurasi menjadi
celah keamanan.

### Rotasi link

- Indeks disimpan di `localStorage` dengan key `dracin.rotationIndex`.
- Bila `localStorage` tidak tersedia (umum di webview in-app dengan mode
  private), fallback ke pemilihan acak.
- Mode `sequence` berguna untuk A/B test dua link Shopee.

## 8. Alur klik (inti konversi)

```
User klik tombol CTA
        |
        v
Baca config.json (sudah dimuat saat render)
        |
        v
Pilih link: rotation "sequence" atau "random"
        |
        v
window.open(url, "_blank")
        |
        |-- berhasil ---> set win.opener = null ---> Shopee terbuka di tab baru
        |
        `-- return null (popup diblokir)
                |
                v
        window.location.href = url  (tab yang sama)
```

### Gotcha teknis penting: `noopener` vs deteksi popup-block

Cara naif yang sering ditulis orang adalah
`window.open(url, "_blank", "noopener,noreferrer")` lalu memeriksa apakah
return value-nya `null`. **Itu salah dan justru menyebabkan klik hilang.**

Sebab: ketika `noopener` dispesifikasikan, browser **selalu** mengembalikan
`null` - bahkan saat popup berhasil dibuka. Akibatnya kode akan mengira popup
diblokir padahal tidak, lalu menjalankan fallback yang tidak perlu.

Maka implementasi yang benar:

```ts
// src/lib/redirect.ts
export function openAffiliate(url: string): void {
  const win = window.open(url, "_blank");

  if (win) {
    // Setara dengan noopener, tapi kita tetap mendapatkan return value
    // sehingga bisa membedakan "berhasil" dari "diblokir".
    win.opener = null;
    return;
  }

  // Popup benar-benar diblokir (umum di in-app browser TikTok / Instagram /
  // WhatsApp). Jangan gagalkan klik - pindahkan tab yang sama.
  window.location.href = url;
}
```

### Kenapa ini krusial

Mayoritas trafik affiliate Indonesia datang dari **in-app browser** yang
memblokir `window.open`. Tanpa fallback, tombol tampak berfungsi, Shopee tidak
pernah terbuka, dan pemilik proyek **tidak akan pernah tahu** kliknya hilang.

### Aksesibilitas

- Tombol CTA memakai elemen `<button>` asli (bukan `<div onclick>`).
- Dapat dijangkau keyboard, dengan `:focus-visible` yang jelas.
- Memiliki accessible name dari `ctaText`.

## 9. Penanganan error

| Skenario | Perilaku |
|---|---|
| `config.json` gagal di-fetch (404 / offline / JSON rusak) | Pakai **link darurat** yang ditanam di `config.ts`; halaman tetap tampil dan tombol tetap berfungsi |
| `config.json` valid tapi `links` kosong | Sama seperti di atas - link darurat |
| Gambar poster gagal dimuat | Skeleton disembunyikan, fallback ke background gradient |
| Popup diblokir | `window.location.href` (lihat bagian 8) |
| `localStorage` tidak tersedia | Fallback ke pemilihan link acak |

**Prinsip:** halaman **tidak boleh pernah** menampilkan tombol mati atau layar
error total. Selalu ada jalur yang bisa diklik.

> **Catatan penting:** link darurat harus diisi oleh pemilik proyek saat
> implementasi. Link yang ada di `config.json` contoh (`9peLe2gVIP`) adalah
> link yang diambil dari `HTML.html` lama.

## 10. Tooling dan versi

Versi berikut **diverifikasi langsung dari registry npm pada 16 Sep 2026**.

| Package | Versi | Peran |
|---|---|---|
| `react` | 19.3.0 | UI |
| `react-dom` | 19.3.0 | Renderer |
| `vite` | 8.3.0 | Build tool + dev server |
| `@vitejs/plugin-react` | 6.1.1 | Fast refresh React |
| **`typescript`** | **5.9.3** | **Dipin, lihat catatan** |
| `vitest` | 5.0.1 | Test runner |
| `jsdom` | 30.0.1 | Environment DOM untuk test |
| `@testing-library/react` | 16.3.3 | Test komponen |
| `@testing-library/jest-dom` | 7.0.1 | Matcher DOM |
| `eslint` | 10.10.0 | Linter |
| `typescript-eslint` | 8.70.0 | Aturan TS untuk ESLint |
| `prettier` | 3.9.6 | Formatter |
| `@types/react` | 19.3.0 | Tipe React |
| `@types/react-dom` | 19.3.0 | Tipe React DOM |
| `@types/node` | 22.20.3 | Tipe Node (untuk config Vite) |

### TypeScript sengaja dipin di 5.9.3, bukan 7.0.2

TypeScript 7.0.2 sudah rilis, **tetapi tidak dipakai**. Alasannya nyata:

```
typescript-eslint@8.70.0 peerDependencies:
  typescript: ">=4.8.4 <6.1.0"
```

Memakai TypeScript 7 akan melanggar peer dependency `typescript-eslint`,
sehingga linter - salah satu alasan utama proyek ini memakai tooling - akan
rusak pada hari pertama. **Keputusan: pin `typescript@5.9.3`** sampai
`typescript-eslint` merilis dukungan resmi.

### Kebutuhan runtime

- Node.js **>= 20.19** (mesin saat ini: Node 24.21.0 - memenuhi).
- npm >= 10 (mesin saat ini: npm 11.19.0 - memenuhi).

### Scripts `package.json`

| Script | Perintah |
|---|---|
| `dev` | `vite` |
| `build` | `tsc -b && vite build` |
| `preview` | `vite preview` |
| `lint` | `eslint .` |
| `typecheck` | `tsc -b --noEmit` |
| `format` | `prettier --write .` |
| `format:check` | `prettier --check .` |
| `test` | `vitest run` |
| `test:watch` | `vitest` |

### TypeScript strict

`tsconfig.json` mengaktifkan `"strict": true`, termasuk `noUncheckedIndexedAccess`
dan `noImplicitOverride`. Mode strict adalah alasan utama typechecker ini
berguna, jadi tidak dilonggarkan.

## 11. Testing

Fokus pada logika yang bisa menyebabkan kehilangan klik atau uang - bukan test
untuk mengejar coverage.

| # | Test | Yang diverifikasi | Kenapa penting |
|---|---|---|---|
| T1 | `links.ts` - rotasi sequence | Indeks maju 0, 1, 2, lalu 0, dan memakai `localStorage` | Bug di rotasi berarti link ter-skip |
| T2 | `links.ts` - mode random | Mengembalikan elemen dari array, tidak pernah `undefined` | Mencegah link kosong |
| T3 | `links.ts` - fallback storage | Tidak crash saat `localStorage` melempar error | Webview private mode |
| T4 | `config.ts` - fetch gagal | Mengembalikan link darurat | Halaman tidak boleh mati |
| T5 | `config.ts` - JSON rusak | Mengembalikan link darurat | Konfigurasi salah ketik |
| T6 | `config.ts` - validasi URL | Menolak `javascript:`, `data:`, string kosong; menerima `https://` | Mencegah salah config jadi celah |
| T7 | `redirect.ts` - popup berhasil | `window.open` dipanggil; `opener` di-null-kan | Jalur normal |
| T8 | `redirect.ts` - popup diblokir | `window.location.href` di-set ke URL | **Skenario TikTok/IG** |
| T9 | `App.tsx` | CTA ter-render dengan teks dari config | Halaman benar-benar tampil |
| T10 | `App.tsx` | Klik CTA memicu `openAffiliate` dengan URL yang benar | Integrasi end-to-end |

Test menggunakan `jsdom`; `window.open` di-mock dengan `vi.fn()`.

## 12. Build dan deploy

### Alur deploy

Pemilik proyek push ke `main` menjadi GitHub Actions menjalankan `npm ci`,
lalu `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, lalu
deploy folder `dist/` ke GitHub Pages.

Jika salah satu langkah gagal, deploy dibatalkan, sehingga versi rusak tidak
pernah sampai ke publik.

### Alur ganti link affiliate (target pengalaman pengguna)

1. Buka `github.com/ahmedayev-hash/DraChinLandingPage/blob/main/public/config.json`
2. Klik ikon pensil (Edit)
3. Ganti URL di array `links`, lalu **Commit changes**
4. Actions rebuild dan deploy otomatis (sekitar 1-2 menit)

**Tanpa terminal, tanpa `npm install`, tanpa build manual.** Bisa dilakukan dari
ponsel.

### Cache busting

`fetch('./config.json?t=' + Date.now())`. GitHub Pages men-cache aset di CDN
sekitar 10 menit; tanpa cache-busting, perubahan link akan tampak "tidak
berfungsi" selama beberapa menit.

### `.nojekyll`

Diperlukan agar GitHub Pages tidak memproses folder yang diawali underscore
(seperti `_assets` hasil build Vite) dan tidak menjalankan Jekyll.

### Alternatif bila Actions tidak diinginkan

Menjalankan `npm run build` secara lokal lalu push folder `dist/` ke branch
`gh-pages`. **Tidak direkomendasikan** karena memerlukan langkah manual tiap
kali - bertentangan dengan tujuan G3.

## 13. Keamanan dan penanganan rahasia

### 13.1 Kenyataan fundamental yang harus dipahami

> **`.env` tidak menyembunyikan apa pun di situs statis.**

Di Vite, environment variable ber-prefix `VITE_` **disuntikkan ke dalam bundle
JavaScript saat build** dan dikirim ke browser. Siapa pun dapat membukanya
di DevTools, bagian Sources. GitHub Pages tidak menjalankan server yang membaca
`.env`.

`.env` berguna untuk **manajemen konfigurasi**, bukan **keamanan**.
Menaruh rahasia di `.env` pada proyek ini hanya memindahkan lokasi penulisannya.

### 13.2 Konsekuensi desain: halaman ini nol rahasia

Karena TMDB dibuang sepenuhnya (bagian 4), **tidak ada satu pun rahasia** yang
dibutuhkan oleh halaman ini. Yang perlu dilindungi hanyalah:

- Link affiliate - memang publik menurut definisinya.
- Nomor rekening atau identitas dashboard affiliate - tidak pernah masuk repo.

### 13.3 `.env.example`

Disertakan atas permintaan pemilik proyek, dengan isi murni dokumentasi, yang
berfungsi sebagai peringatan bagi masa depan:

```bash
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

`.gitignore` mencantumkan `.env`, `.env.local`, dan `.env.*.local` sejak awal
agar kebiasaan buruk tidak pernah terekam ke git.

### 13.4 Tindakan terhadap TMDB API key yang sudah bocor

Key `0f29...109f` **sudah publik di repositori publik**. Rencana penanganan,
diurutkan berdasarkan efektivitas:

| Langkah | Efektivitas |
|---|---|
| **1. Revoke key tersebut di dashboard TMDB dan buat key baru** | **Wajib. Satu-satunya langkah yang benar-benar menghentikan penyalahgunaan** |
| 2. Hapus key dari source dan dari `archive/browser.html` (diganti placeholder) | Mencegah kebocoran baru |
| 3. Rewrite git history agar key tidak ada lagi di commit lama | Kebersihan repo jangka panjang |
| 4. Force-push dan koordinasi dengan kolaborator | Diperlukan agar langkah 3 berlaku |

**Peringatan penting:** rewrite history **tidak** dapat menarik kembali key dari
cache GitHub, fork orang lain, klon yang sudah beredar, maupun crawler pihak
ketiga. Karena itu **langkah 1 tidak bisa digantikan oleh langkah 3**.

Penghapusan dengan `git filter-repo` memerlukan instalasi tool tersebut
(belum tersedia di mesin ini - sudah diverifikasi). Alternatif bawaan git:
`git filter-branch`, atau membuat repo baru dari working tree bersih.

**Karena repo ini hanya memiliki 2 commit dan tidak ada kolaborator, opsi
terbersih adalah: hapus key dari source, revoke key, lalu force-push.** Detail
langkah teknis akan ditentukan pada tahap implementation plan.

## 14. Migrasi dan pembersihan repo

| # | Tindakan | Hasil |
|---|---|---|
| 1 | `HTML.html` menjadi `archive/browser.html`, **API key distrip jadi placeholder** | Fitur lama tersimpan, tapi key tidak masuk history baru |
| 2 | File `HTML` (tanpa ekstensi) menjadi `git rm HTML` | `git status` bersih, tidak ada lagi `deleted: HTML` |
| 3 | Tambah `.gitignore` (termasuk `.env`, `dist/`, `node_modules`) | Repo bersih |
| 4 | Tulis ulang `README.md` | Berisi cara ganti link dan cara deploy |
| 5 | Hapus reference TMDB dari README dan proyek | Tidak ada petunjuk menuju key |

**Catatan tentang `archive/browser.html`:** file ini **tidak** akan berfungsi
tanpa API key. Ini disengaja - file tersebut dipertahankan hanya untuk
referensi kode dan desain, bukan untuk dijalankan. Hal ini akan didokumentasikan
di `README.md` dan di komentar atas file tersebut.

## 15. Verifikasi

Pekerjaan tidak dianggap selesai sebelum semua poin berikut terbukti, dengan
output perintah yang sesungguhnya dilampirkan - bukan klaim.

| # | Verifikasi | Cara |
|---|---|---|
| V1 | Linter bersih | `npm run lint` exit 0 |
| V2 | Typecheck bersih | `npm run typecheck` exit 0 |
| V3 | Semua test lulus | `npm test` - melaporkan jumlah test lulus |
| V4 | Build berhasil | `npm run build` exit 0, `dist/` terbentuk |
| V5 | **`config.json` ada di `dist/`** | `dist/config.json` benar-benar ada dan isinya utuh |
| V6 | Halaman berjalan dari hasil build | `npm run preview`, buka di browser |
| V7 | Klik membuka URL yang benar | Verifikasi manual; URL sesuai `config.json` |
| V8 | Fallback popup-blocked berfungsi | `window.open` di-mock mengembalikan `null`, verifikasi navigasi terjadi |
| V9 | Tampilan benar di viewport mobile | Cek pada lebar 375px dan 430px |
| V10 | Tidak ada jejak rahasia TMDB di `dist/` | `grep -rniE "themoviedb\|api_key\|0f29" dist/` tidak menghasilkan apa pun |

V10 adalah pengaman terhadap M3: memastikan tidak ada kunci yang bocor ke
artefak yang akan dipublikasikan.

> **Catatan:** dokumen ini sengaja **tidak** memuat API key secara utuh.
> Key selalu ditulis terpotong (`0f29...109f`). Sebuah spec yang menyimpan
> rahasia di dalamnya adalah cara kebocoran terjadi dua kali.

## 16. Di luar cakupan dan kemungkinan pengembangan

Bukan bagian dari pekerjaan ini, dicatat agar tidak hilang:

- Analytics klik (mis. Cloudflare Web Analytics yang bebas cookie).
- Halaman SEO dengan Astro, bila strategi berubah.
- A/B test formal dengan pelaporan konversi.
- Proxy TMDB via Cloudflare Worker, bila fitur drama ingin dihidupkan kembali.
- Multi-bahasa.

## 17. Risiko dan mitigasi

| Risiko | Kemungkinan | Dampak | Mitigasi |
|---|---|---|---|
| Popup diblokir di in-app browser, klik hilang | **Tinggi** | **Tinggi** | Fallback `location.href` (bagian 8) + test T8 |
| Pemilik proyek bingung karena perubahan link tidak langsung tampak (cache GitHub) | Sedang | Sedang | Cache-busting `?t=timestamp` (bagian 12) |
| `config.json` salah format, halaman mati | Sedang | Tinggi | Validasi + link darurat (bagian 7, 9) |
| TypeScript 7 memecahkan linter | **Tinggi** jika tidak dipin | Sedang | Pin `typescript@5.9.3` (bagian 10) |
| API key TMDB terus disalahgunakan | **Tinggi** (sudah publik) | Sedang | Revoke key (bagian 13.4) |
| Domain berganti, aset 404 | Sedang | Tinggi | Semua path relatif, `base: './'` (bagian 5.4) |
| `archive/browser.html` tanpa sengaja ter-deploy | Rendah | Tinggi | Ditaruh di luar `public/` (bagian 6) |
| Klik hilang karena tombol gagal render saat config error | Rendah | Tinggi | Link darurat di kode (bagian 9) |

## 18. Ringkasan keputusan

| Keputusan | Alasan utama |
|---|---|
| React 19 + Vite 8 + TypeScript | Permintaan pemilik proyek akan tooling dan struktur yang layak |
| `config.json` di `public/` (runtime) | Menyelesaikan konflik build step vs ganti link cepat |
| Tanpa routing | Satu halaman, YAGNI |
| Tanpa TMDB | Menghapus seluruh kebutuhan rahasia |
| `base: './'` | Tahan ganti domain |
| Pin TypeScript 5.9.3 | Kompatibilitas `typescript-eslint` |
| `window.open` tanpa `noopener`, lalu set `win.opener = null` | Agar deteksi popup-block benar-benar bekerja |
| Fallback `location.href` | Melindungi klik di in-app browser |
| Deploy via GitHub Actions | Mencegah versi rusak sampai ke publik |
| Link darurat ditanam di kode | Halaman tidak pernah menampilkan tombol mati |
| API key distrip dari `archive/` | Mencegah kebocoran berulang |

## 19. Pertanyaan terbuka

Tidak ada pertanyaan yang memblokir implementasi. Dua hal berikut sudah
diselesaikan:

1. ~~Nasib `HTML.html`~~ menjadi pindah ke `archive/` dengan API key distrip.
2. ~~Hapus file `HTML`~~ menjadi `git rm HTML`.

Yang perlu disiapkan pemilik proyek **saat implementasi**, bukan penghalang
desain:

- Link affiliate darurat (satu atau dua URL Shopee) untuk ditanam sebagai
  fallback.
- Gambar poster (`public/poster.jpg`) - atau dibiarkan memakai placeholder
  sampai siap.

## 20. Referensi

- [Vite - Static Asset Handling](https://vite.dev/guide/assets.html)
  (`public/` disalin apa adanya ke `dist/`)
- [Vite - Deploying a Static Site](https://vite.dev/guide/static-deploy.html)
- [MDN - `window.open()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/open)
  (perilaku `noopener` dan return value `null`)
- [MDN - `Window.opener`](https://developer.mozilla.org/en-US/docs/Web/API/Window/opener)
- [typescript-eslint - Dependency versions](https://typescript-eslint.io/users/dependency-versions/)
- [GitHub Docs - Configuring a publishing source for GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
