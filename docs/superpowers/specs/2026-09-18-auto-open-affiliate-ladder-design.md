# Tangga Fallback Auto-Open Affiliate di Landing Page - Design

Dokumen ini adalah lanjutan dari
`docs/superpowers/specs/2026-09-16-shopee-clickbait-landing-design.md` dan
`docs/superpowers/specs/2026-09-16-shopee-catalog-trailer-design.md`. Kedua
dokumen lama tetap berlaku untuk semua hal yang tidak diubah di sini.

Bagian dokumen lama yang **digantikan** oleh dokumen ini:

| Bagian dokumen lama                                                | Yang berubah                                                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Dokumen clickbait, bagian 8 (Alur klik)                            | Membuka Shopee **tidak lagi** menunggu klik pengunjung. Alur klik kini punya tangga fallback berlapis. |
| Dokumen clickbait, bagian 9 (Penanganan error), baris popup-block  | Fallback tidak lagi berhenti di `location.href`; ada percobaan tab baru berlapis sebelum redirect.     |
| Dokumen catalog, bagian pernyataan "katalog/modal = inti konversi" | Katalog dan modal turun menjadi **jalur sekunder**. Konversi utama terjadi tanpa interaksi.            |

Aturan yang **tidak** berubah dan tetap berlaku: `config.json` sebagai data
runtime, larangan rahasia di bundle, `openAffiliate()` sebagai lapis redirect
terakhir, `pickLink()` untuk rotasi link, dan seluruh aturan tooling.

## 1. Ringkasan

Saat ini link affiliate baru dibuka setelah pengunjung menonton trailer dan
menekan tombol "TONTON FULL". Itu berarti satu klik penonton hilang setiap kali
sesi berakhir sebelum trailer selesai.

Perubahan ini membuat landing page **langsung mencoba membuka link affiliate
tanpa menunggu klik**. Karena browser modern memblokir popup tanpa gestur
pengunjung, percobaan tunggal tidak cukup. Desain ini memakai **tangga
fallback** yang makin lama makin memaksa:

| Lapis | Pemicu                                              | Aksi                                                                                |
| ----- | --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| L1    | Landing page selesai mount                          | Coba buka tab baru secara programatik                                               |
| L2    | L1 gagal                                            | Klik pertama di mana saja pada landing page memicu percobaan tab baru lagi          |
| L3    | L2 gagal                                            | Tombol "LIHAT KATALOG" mencoba tab baru; bila masih gagal, barulah redirect tab ini |
| L4    | Tab baru jelas mustahil (mis. iframe without allow) | Redirect tab yang sama                                                              |

Landing page yang sekarang menampilkan hitungan mundur 8 detik dan tombol
"LIHAT KATALOG" **tetap dipertahankan apa adanya**. Tangga ini hanya menyisipkan
percobaan lebih awal di depannya.

## 2. Latar belakang dan masalah

Mayoritas trafik affiliate datang dari in-app browser (TikTok, Instagram,
WhatsApp) yang memblokir `window.open` tanpa gestur. Desain lama sudah
menyiasatinya untuk klik tombol, tetapi belum untuk kasus "pengunjung pasif".

Tiga kenyataan yang membentuk desain ini:

1. **Popup tanpa gestur hampir selalu diblokir.** Chrome, Safari mobile, dan
   hampir semua webview mengembalikan `null` dari `window.open()` saat tidak ada
   aktivasi pengunjung.
2. **Popup pada gestur asli paling sering lolos.** Karena itu klik pertama
   pengunjung adalah kesempatan kedua terbaik setelah mount.
3. **Sebagian webview hanya memblokir percobaan pertama.** Mengulang percobaan
   pada gestur dan lewat anchor `<a target="_blank">` meningkatkan peluang lolos.

## 3. Tujuan

1. Link affiliate dibuka otomatis segera setelah landing page tampil.
2. Bila percobaan otomatis diblokir, setiap kesempatan berikutnya (klik pertama,
   tombol katalog) dipakai untuk mencoba lagi.
3. Klik pengunjung tidak pernah hilang diam-diam: selalu ada lapis terakhir yang
   pasti terlaksana.
4. Tidak ada dependency runtime baru. Keanehan browser tetap terkurung di satu
   modul adapter (`src/lib/redirect.ts`).

## 4. Non-tujuan

- Tidak menambah kunci baru di `config.json`. Tangga ini selalu aktif.
- Tidak mengubah katalog, modal trailer, router, atau `pickLink()`.
- Tidak menjamin popup lolos. Browser punya keputusan akhir; yang bisa dilakukan
  hanyalah memaksimalkan peluang lalu menyediakan jalur yang pasti.
- Tidak menyembunyikan konsekuensi UX dari pemilik proyek. Lihat bagian 9.

## 5. Keputusan arsitektur

### 5.1 Percobaan tab baru dikurung di adapter

`src/lib/redirect.ts` menjadi satu-satunya berkas yang tahu soal kuirk
`window.open`, anchor `target="_blank"`, dan redirect. Komponen tidak boleh
memanggil `window.open` langsung.

API akhir modul:

```ts
/** Melaporkan apakah percobaan berhasil, tanpa efek samping bila gagal. */
export function tryOpenNewTab(url: string): boolean;

/** Perilaku lama: buka tab baru; bila gagal, redirect tab ini. */
export function openAffiliate(url: string): void;
```

`tryOpenNewTab` mengembalikan `boolean` murni. Memisahkan "mencoba" dari
"memaksa masuk" membuat tiap lapis tangga dapat memutuskan sendiri langkah
berikutnya, dan membuat perilaku ini mudah diuji tanpa efek samping jaringan.

### 5.2 Tangga memakai percobaan tab baru, bukan percobaan yang menulis status

Alih-alih fungsi yang mengembalikan enum status yang rumit, `tryOpenNewTab`
cukup menjawab "berhasil atau tidak". Lapis L2 dan L3 hanya perlu satu bit
informasi itu; sisa kebijakan hidup di pemanggil. Ini menjaga fungsi tetap kecil
dan lapisan tetap tipis.

### 5.3 Percobaan berulang dibatasi sekali per lapis

Setiap lapis tangga boleh mencoba **paling banyak sekali**. Tanpa batas ini,
kombinasi popup lolos sebagian + event beruntun dapat membuka beberapa tab
sekaligus, yang justru membuat pengunjung menutup semuanya. Riwayat percobaan
disimpan di `useRef`, bukan `useState`, karena nilainya tidak pernah dirender
dan perubahan state akan memicu render ulang yang tidak perlu.

## 6. Struktur file

Tidak ada berkas baru. Perubahan terbatas pada empat berkas yang sudah ada:

| Berkas                           | Perubahan                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/lib/redirect.ts`            | Tambah `tryOpenNewTab()`; `openAffiliate()` memakainya lalu jatuh ke redirect             |
| `src/lib/redirect.test.ts`       | Uji `tryOpenNewTab()` (sukses, ditolak, atribut `noopener`) dan regresi `openAffiliate()` |
| `src/pages/LandingPage.tsx`      | Efek L1 saat mount, penangkap klik pertama L2, tombol LIHAT KATALOG menjadi L3            |
| `src/pages/LandingPage.test.tsx` | Uji tiap lapis tangga, batas sekali per lapis, jumlah panggilan tepat satu                |
| `README.md`                      | Perbarui tabel "Alur pengunjung" dan tambah catatan keagresifan tangga                    |

## 7. Alur lengkap

```
Landing page mount
        |
        v
[L1] tryOpenNewTab(url)
        |
        |-- berhasil --> tab baru terbuka; pengunjung tetap di landing
        |
        `-- gagal
                |
                v
        Pasang pendengar klik pertama (capture, sekali pakai)
                |
                v
        Pengunjung klik apa saja (termasuk tombol "Batalkan")
                |
                v
        [L2] tryOpenNewTab(url)
                |
                |-- berhasil --> tab baru terbuka
                |
                `-- gagal
                        |
                        v
        Klik tombol "LIHAT KATALOG"
                |
                v
        [L3] openAffiliate(url)
                |
                |-- berhasil --> tab baru terbuka
                |
                `-- gagal
                        |
                        v
                [L4] window.location.href = url  (tab yang sama)
```

Perhatikan: karena L1 berjalan saat mount, pemanggilan `window.location.href`
pada L4 praktis selalu terjadi sebelum pengunjung sempat berinteraksi, sehingga
katalog dan modal **jarang terlihat** pada peramban yang memblokir popup.

## 8. Penanganan error dan detail implementasi

| Skenario                                         | Perilaku                                                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `links` kosong setelah validasi                  | `pickLink` mengembalikan `''`; seluruh tangga dilewati, landing tampil normal                         |
| `window.open` mengembalikan `null`               | Coba anchor `<a target="_blank">` sekali; bila gagal, lapis dilaporkan gagal                          |
| Anchor `click()` melempar (webview aneh)         | Ditangkap, lapis dilaporkan gagal, tidak pernah merusak halaman                                       |
| Popup berhasil tetapi `opener` read-only         | `win.opener = null` dibungkus `try/catch`; kegagalan di sini tidak digagalkan sebagai kegagalan popup |
| React StrictMode memanggil efek dua kali         | `useRef` menjaga L1 hanya berjalan sekali per mount                                                   |
| Komponen dilepas sebelum pengunjung berinteraksi | Pendengar klik L2 dibersihkan pada cleanup efek                                                       |
| Tidak ada `document` (lingkungan non-DOM)        | `tryOpenNewTab` jatuh ke `window.open` saja; tidak melempar                                           |

Aturan penting: `tryOpenNewTab` **tidak boleh** menulis `location.href`, dan
`openAffiliate` **tidak boleh** mencoba lebih dari satu tab. Pemisahan ini yang
menjaga `openAffiliate` tetap dapat dipakai kapan saja tanpa risiko membuka dua
tab.

## 9. Konsekuensi UX yang wajib disadari

Karena L1 berjalan otomatis, pengunjung pada peramban yang memblokir popup akan
**langsung dipindahkan ke halaman affiliate**. Artinya:

- Hitungan mundur 8 detik dan tombol "LIHAT KATALOG" praktis tidak pernah
  digunakan pada peramban tersebut.
- Klik pertama pengunjung, apa pun, akan dipakai untuk mencoba membuka affiliate.
  Tombol "Batalkan" pada hitungan mundur pun akan memicu percobaan ini.
- Halaman ini menjadi gerbang satu arah, bukan halaman pilihan.

Ini konsekuensi langsung dari keputusan produk yang diminta, bukan cacat
implementasi. Perilaku ini ditulis di komentar kode supaya tidak mengejutkan
siapa pun yang membaca kode di kemudian hari.

## 10. Testing

Pengujian memakai `vi.stubGlobal` dan `vi.mock` untuk mengendalikan hasil
percobaan tab baru.

- `redirect.test.ts`: `tryOpenNewTab` mengembalikan `true` saat popup terwujud
  (dan menyetel `opener` ke `null`), `false` saat popup dan anchor sama-sama
  gagal, serta tidak memakai string fitur `noopener`.
- `LandingPage.test.tsx`: `openAffiliate` dipanggil tepat sekali saat mount;
  tidak dipanggil bila `links` kosong; klik pertama memicu percobaan L2; tombol
  "LIHAT KATALOG" tetap memanggil `onEnterCatalog`; React StrictMode tidak
  menggandakan percobaan.

Kasus "popup benar-benar lolos di peramban sungguhan" tidak dapat dibuktikan di
jsdom dan tetap wajib diuji manual di peramban.

## 11. Risiko dan mitigasi

| Risiko                                                      | Mitigasi                                                                   |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| Jaringan iklan menganggap ini cloaking                      | Link affiliate tetap berasal dari `config.json` yang diubah pemilik proyek |
| Pengunjung merasa halaman rusak karena klik pertama menjauh | Konsekuensi didokumentasikan di README dan komentar kode                   |
| Dua tab terbuka karena event beruntun                       | Satu percobaan per lapis, dijaga `useRef`                                  |
| Popup-block membuat pengunjung berpikir situs mati          | Redirect L4 memastikan selalu ada kelanjutan                               |

## 12. Ringkasan keputusan

1. Empat lapis: auto mount, klik pertama, tombol katalog, redirect.
2. `tryOpenNewTab()` murni `boolean`; `openAffiliate()` tetap seperti sekarang.
3. Percobaan tab baru memakai `window.open` lalu anchor `target="_blank"`; sisa
   kuirk browser dikurung di `src/lib/redirect.ts`.
4. Tidak ada perubahan `config.json`, katalog, modal, atau router.
5. Batas satu percobaan per lapis dijaga `useRef`, bukan `useState`.
