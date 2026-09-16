# Landing Page Clickbait Shopee Affiliate - Katalog dan Trailer - Design

Dokumen ini adalah lanjutan dari
`docs/superpowers/specs/2026-09-16-shopee-clickbait-landing-design.md`. Dokumen
lama tetap berlaku untuk semua hal yang tidak diubah di sini.

Bagian dari dokumen lama yang **digantikan** oleh dokumen ini:

| Bagian dokumen lama | Yang berubah                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------- |
| 6, Struktur file    | Digantikan seluruhnya oleh Bagian 6 dokumen ini.                                             |
| 8, Alur klik        | Landing tidak lagi langsung membuka Shopee. Alurnya menjadi landing, katalog, modal, Shopee. |
| 16, Di luar cakupan | Katalog dan trailer yang tadinya di luar cakupan sekarang menjadi inti dokumen ini.          |

Aturan yang **tidak** berubah dan tetap berlaku: penggunaan `config.json`
sebagai data runtime, larangan menaruh rahasia di bundle, keharusan
`openAffiliate()` dengan fallback popup-blocked, dan seluruh aturan tooling.

## 1. Ringkasan

Halaman ini berubah dari satu layar tunggal menjadi **dua halaman dengan satu
modal**:

1. **Landing** - tampilan clickbait yang sekarang sudah ada.
2. **Katalog** - grid drama yang isinya di-generate dari TMDB saat build.
3. **Modal trailer** - muncul **di atas** katalog, bukan sebagai halaman
   terpisah. Trailer YouTube diputar di dalam modal, dan satu tombol di
   dalamnya menuju Shopee.

Modal dipilih, bukan halaman detail terpisah, karena katalog tetap terlihat
samar di belakangnya. Perpindahannya terasa seperti membuka sesuatu, bukan
seperti memuat halaman baru. Untuk halaman clickbait satu arah, menghilangkan
satu kali pemuatan halaman berarti menghilangkan satu kesempatan pengunjung
pergi.

Perubahan intinya: katalog **tidak lagi ditulis manual**. Setiap kali build
berjalan, katalog diambil dari TMDB, sehingga isi katalog dapat berbeda pada
tiap build tanpa mengubah satu baris pun kode. Kunci API TMDB **hanya hidup di
proses build** dan tidak pernah ikut terkirim ke browser.

## 2. Latar belakang dan masalah

Desain lama sengaja dibuat sesederhana mungkin: satu poster, satu judul, satu
tombol. Itu bagus untuk konversi, tetapi punya dua kelemahan:

1. **Terasa kosong.** Pengunjung tidak punya alasan untuk percaya bahwa ada
   tontonan sungguhan di baliknya. Tidak ada bukti sosial.
2. **Repot dirawat.** Setiap judul, poster, dan sinopsis harus ditulis manual di
   `config.json`.

Di sisi lain, arsip lama (`archive/browser.html`) sudah membuktikan bahwa
pengambilan data dari TMDB bisa dilakukan. Masalahnya, arsip itu memanggil TMDB
**dari browser**, sehingga API key ikut terkirim ke pengunjung dan bisa dicuri
siapa saja. Itu persis kesalahan yang sedang kita tinggalkan.

Solusinya: pindahkan pengambilan data dari runtime ke **waktu build**.

## 3. Tujuan

1. Katalog drama di-generate otomatis saat build, isinya dapat berubah tiap
   build.
2. Kunci API TMDB tidak pernah masuk ke bundle JavaScript atau ke repositori.
3. Link Shopee tetap dapat diubah dari GitHub tanpa menyentuh kode.
4. Trailer YouTube diputar di dalam modal di atas katalog, dan tidak
   memperlambat pemuatan awal.
5. Halaman katalog tidak pernah terlihat "setengah jadi": selama poster belum
   selesai diunduh, pengunjung melihat spinner.
6. Build tidak pernah gagal hanya karena TMDB bermasalah.

## 4. Non-tujuan

- Tidak ada pencarian, filter, atau genre di halaman katalog. Daftar dibatasi
  jumlahnya, jadi tidak perlu.
- Tidak ada pagination.
- Tidak ada SEO. Domain akan berganti-ganti.
- Tidak ada backend, server, atau database. Tetap situs statis.
- Tidak ada autentikasi atau akun pengguna.
- Tidak ada pemutar video penuh di dalam situs. Tombol "TONTON FULL" selalu
  menuju Shopee, sesuai keputusan sebelumnya.
- Tidak ada penalaran apakah channel YouTube pemilik trailer masih aktif.

## 5. Keputusan arsitektur

### 5.1 Pengambilan data TMDB dilakukan saat build

Alternatif yang dipertimbangkan:

| Pendekatan                            | Hasil                                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| TMDB dipanggil dari browser (runtime) | **Ditolak.** API key ikut ke bundle dan dapat dibaca siapa pun lewat DevTools.                             |
| TMDB dipanggil saat build             | **Dipilih.** Key hanya ada di memori proses Node. Yang ter-deploy adalah `catalog.json` dan berkas poster. |
| Katalog ditulis manual di JSON        | **Ditolak.** Tidak memenuhi permintaan "isi katalog bisa berbeda setiap build".                            |

Konsekuensi yang harus diterima: katalog hanya berubah ketika build berjalan.
Untuk memicu build ulang tanpa mengubah kode, buka tab **Actions** di GitHub,
pilih workflow **Deploy to GitHub Pages**, lalu klik **Run workflow**.
Workflow `workflow_dispatch` sudah ada di `.github/workflows/deploy.yml`, jadi
tidak ada berkas tambahan yang perlu dibuat atau di-commit.

### 5.2 Logika katalog sebagai Vite plugin, bukan script terpisah

Alternatif yang dipertimbangkan:

| Pendekatan                                       | Hasil                                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Vite plugin di dalam `vite.config.ts`            | **Dipilih.** Tidak menambah dependency, ikut ter-typecheck, dan dapat menyajikan data yang sama di mode `dev`.                        |
| Script Node terpisah dijalankan lewat `prebuild` | **Ditolak.** Berkas harus `.mjs` (tidak ter-typecheck) atau menambah dependency `tsx`, dan mode `dev` tetap perlu penanganan sendiri. |
| Proxy backend (Cloudflare Worker)                | **Ditolak.** Menambah satu layanan yang harus dirawat dan di-deploy. Tidak sebanding untuk proyek ini.                                |

Plugin ini tipis. Semua logika yang dapat diuji diletakkan di modul murni
terpisah, sehingga plugin hanya bertugas sebagai perekat.

### 5.3 Routing berbasis hash

| Pendekatan         | Hasil                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Hash (`#/katalog`) | **Dipilih.** Bekerja di host statis mana pun tanpa konfigurasi. Ganti domain tidak merusak apa pun.              |
| Path (`/katalog`)  | **Ditolak.** GitHub Pages membutuhkan berkas `404.html` dan trik salin `index.html`. Rapuh saat domain berganti. |
| React Router       | **Ditolak.** Menambah sekitar 25 KB gzip untuk dua rute. Tidak sebanding.                                        |

Router ditulis sendiri dan hanya memuat dua fungsi murni. Ukurannya di bawah
1 KB.

Tiga rute yang dikenali:

| Hash          | Tampilan                                        |
| ------------- | ----------------------------------------------- |
| kosong        | Landing                                         |
| `#/katalog`   | Katalog                                         |
| `#/drama/123` | Katalog **dengan modal terbuka** untuk ID `123` |

Rute ketiga sengaja diarahkan ke katalog, bukan ke layar tersendiri. Modal
hanyalah lapisan di atas katalog, sehingga halaman di belakangnya tetap sama.
Hash apa pun yang tidak dikenali dikembalikan ke landing.

### 5.3.1 Modal dikendalikan URL, bukan state React

Alternatif yang dipertimbangkan:

| Pendekatan                                 | Hasil                                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Modal dikendalikan hash (`#/drama/123`)    | **Dipilih.** Tombol kembali menutup modal, refresh mengembalikan modal yang sama, dan tautannya bisa dibagikan.                 |
| Modal murni state React, URL tidak berubah | **Ditolak.** Tombol kembali akan keluar dari situs alih-alih menutup modal. Di Android itu melanggar kebiasaan yang diharapkan. |

Karena hash menjadi satu-satunya sumber kebenaran, tidak ada state ganda.
Menutup modal berarti mengubah hash ke `#/katalog`, bukan menyetel variabel
`isOpen` menjadi `false`.

### 5.4 Kunci API hanya untuk proses build

Aturan yang tidak boleh dilanggar:

1. Nama variabel adalah `TMDB_API_KEY`, **tanpa** prefix `VITE_`.
2. Variabel dibaca lewat `loadEnv` di dalam `vite.config.ts`, bukan lewat
   `import.meta.env` di kode aplikasi.
3. Di GitHub Actions, nilainya diambil dari `secrets.TMDB_API_KEY`.
4. Tidak ada satu pun berkas di `src/` yang boleh menyebut `TMDB_API_KEY`.

## 6. Struktur file

Berkas baru:

| Path                                  | Isi                                                                |
| ------------------------------------- | ------------------------------------------------------------------ |
| `tools/catalog/types.ts`              | Tipe `CatalogItem` dan `CatalogFile`.                              |
| `tools/catalog/normalize.ts`          | Mengubah respons TMDB menjadi `CatalogItem[]`. Murni, tanpa I/O.   |
| `tools/catalog/normalize.test.ts`     | Tes untuk `normalize.ts`.                                          |
| `tools/catalog/fetchCatalog.ts`       | Orkestrasi: panggil TMDB, unduh poster. `fetch` disuntikkan.       |
| `tools/catalog/fetchCatalog.test.ts`  | Tes untuk `fetchCatalog.ts`.                                       |
| `tools/catalog/fallback.ts`           | Katalog cadangan yang ikut ter-commit.                             |
| `tools/catalog/vitePlugin.ts`         | Perekat: baca env, panggil orkestrasi, emit aset, layani mode dev. |
| `src/lib/router.ts`                   | `parseRoute()` dan `buildHash()`. Murni.                           |
| `src/lib/router.test.ts`              | Tes untuk `router.ts`.                                             |
| `src/hooks/useHashRoute.ts`           | Langganan `hashchange`.                                            |
| `src/hooks/useCatalog.ts`             | Memuat dan memvalidasi `catalog.json` sekali saja.                 |
| `src/hooks/useCatalog.test.ts`        | Tes untuk `useCatalog.ts`.                                         |
| `src/hooks/useImagePreloader.ts`      | Menunggu semua poster selesai diunduh.                             |
| `src/hooks/useImagePreloader.test.ts` | Tes untuk logika penantian gambar.                                 |
| `src/components/LoadingOverlay.tsx`   | Overlay spinner.                                                   |
| `src/components/MovieCard.tsx`        | Satu kartu drama.                                                  |
| `src/components/TrailerModal.tsx`     | Dialog trailer: `<dialog>` native, fokus, Esc, klik backdrop.      |
| `src/pages/LandingPage.tsx`           | Isi `App.tsx` yang sekarang, ditambah hitungan mundur.             |
| `src/pages/CatalogPage.tsx`           | Grid katalog.                                                      |
| `src/styles.css`                      | Bertambah, bukan diganti.                                          |

Berkas yang berubah:

| Path                           | Perubahan                                                     |
| ------------------------------ | ------------------------------------------------------------- |
| `src/App.tsx`                  | Menjadi kerangka router. Isinya yang lama pindah ke `pages/`. |
| `vite.config.ts`               | Mendaftarkan plugin katalog.                                  |
| `tsconfig.node.json`           | Menambahkan `tools/**/*` ke `include`.                        |
| `eslint.config.js`             | Memastikan `tools/` ikut diperiksa.                           |
| `.env.example`                 | Mendokumentasikan `TMDB_API_KEY`.                             |
| `.github/workflows/deploy.yml` | Meneruskan `secrets.TMDB_API_KEY` ke langkah build.           |
| `README.md`                    | Menambah bagian katalog dan cara memasang secret.             |

## 7. Skema `catalog.json`

Berkas ini **dihasilkan**, tidak pernah ditulis manual, dan tidak masuk
repositori.

```json
{
  "generatedAt": "2026-09-16T03:58:55.915Z",
  "source": "tmdb",
  "page": 7,
  "items": [
    {
      "id": "94997",
      "title": "House of the Dragon",
      "overview": "Kisah keluarga Targaryen...",
      "year": "2022",
      "rating": 8.4,
      "poster": "./posters/94997.jpg",
      "trailerKey": "DotnJ7tTA34"
    }
  ]
}
```

Aturan tiap medan:

| Medan         | Tipe                    | Aturan                                                                                |
| ------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| `generatedAt` | string                  | Waktu build dalam format ISO. Berguna untuk memastikan katalog benar-benar baru.      |
| `source`      | `"tmdb"` / `"fallback"` | Menandai apakah data berasal dari TMDB atau katalog cadangan. Dipakai untuk diagnosa. |
| `page`        | number                  | Halaman TMDB yang terpilih secara acak. Bernilai `0` bila memakai katalog cadangan.   |
| `items`       | array                   | Maksimum `CATALOG_LIMIT` entri. Urutannya dijelaskan di Bagian 8.6 dan 8.7.           |
| `id`          | string                  | ID TMDB, diubah ke string agar stabil.                                                |
| `title`       | string                  | `name` dari TMDB. Entri tanpa judul dibuang.                                          |
| `overview`    | string                  | Boleh string kosong. Teks Indonesia diutamakan, jatuh ke Inggris bila kosong.         |
| `year`        | string                  | Empat digit pertama `first_air_date`. Boleh string kosong.                            |
| `rating`      | number                  | Satu angka di belakang koma, 0-10. Bernilai `0` bila TMDB tidak punya data.           |
| `poster`      | string                  | Path relatif ke berkas hasil unduhan. String kosong bila unduhan gagal.               |
| `trailerKey`  | string                  | ID video YouTube, 11 karakter. String kosong bila tidak ada trailer yang layak.       |

Semua path gambar memakai awalan `./` agar tetap benar ketika situs di-deploy
di sub-path, sama seperti `config.json` sekarang.

## 8. Alur pengambilan data saat build

Urutan langkah di dalam plugin:

1. Baca `TMDB_API_KEY`, `CATALOG_LIMIT`, `CATALOG_LANGUAGE`,
   `CATALOG_FALLBACK_LANGUAGE`, dan `CATALOG_TIMEOUT_MS` dari lingkungan.
2. Bila `TMDB_API_KEY` kosong, langsung pakai katalog cadangan. Build tetap
   sukses, hanya mencetak peringatan.
3. Panggil `/discover/tv` dengan penyaring genre yang ketat, bukan sekadar
   `popularity.desc`. Penyaring lengkapnya ada di Bagian 8.4. Tanpa penyaring
   ini, daftar teratas berisi acara berita, gelar wicara, dan sinetron, dan
   hanya 43 persen yang punya trailer.
4. Panggil endpoint itu **dua kali**, sekali dengan `language=id-ID` dan sekali
   dengan `language=en-US`, lalu gabungkan per entri. Alasannya di Bagian 8.5.
5. Untuk setiap kandidat, panggil `/tv/{id}/videos` untuk mencari trailer.
6. Susun daftar akhir: dahulukan kandidat yang punya trailer sampai
   `CATALOG_LIMIT` terpenuhi, lalu tambal sisanya dengan kandidat tanpa
   trailer. Alasannya di Bagian 8.6.
7. Unduh poster dari `image.tmdb.org/t/p/w500` dengan batas 6 unduhan paralel.
8. Susun `CatalogFile` dan kirim sebagai aset lewat `this.emitFile`.
9. Kirim setiap poster sebagai aset dengan nama `posters/<id>.jpg`.

Bila salah satu langkah gagal, seluruh proses jatuh ke katalog cadangan. Tidak
ada keadaan setengah berhasil, karena katalog setengah jadi lebih buruk daripada
katalog cadangan yang utuh.

Pemanggilan `/tv/{id}/videos` dilakukan satu per satu drama, bukan lewat
`append_to_response`, karena `/discover/tv` tidak mendukung `append_to_response`
untuk daftar hasil.

### 8.1 Variabel lingkungan build

| Nama                        | Wajib | Default | Keterangan                                                      |
| --------------------------- | ----- | ------- | --------------------------------------------------------------- |
| `TMDB_API_KEY`              | tidak | kosong  | Bila kosong, katalog cadangan yang dipakai.                     |
| `CATALOG_LIMIT`             | tidak | `20`    | Jumlah drama. Dibatasi maksimum 40 agar tidak berat.            |
| `CATALOG_LANGUAGE`          | tidak | `id-ID` | Bahasa sinopsis yang diutamakan.                                |
| `CATALOG_FALLBACK_LANGUAGE` | tidak | `en-US` | Bahasa kedua yang dipakai bila sinopsis bahasa utama kosong.    |
| `CATALOG_TIMEOUT_MS`        | tidak | `10000` | Batas waktu satu permintaan HTTP.                               |
| `CATALOG_PAGE_POOL`         | tidak | `20`    | Banyak halaman yang boleh dipilih acak. Minimum 1, maksimum 40. |

`CATALOG_LANGUAGE` dan `CATALOG_FALLBACK_LANGUAGE` selalu dipanggil keduanya.
Lihat Bagian 8.5 untuk alasannya.

### 8.2 Cache saat mode dev

Mode `dev` tidak boleh memanggil TMDB setiap kali server dijalankan ulang.
Hasilnya disimpan di `node_modules/.cache/drachin-catalog/catalog.json` selama
60 menit. Direktori ini sudah tertutup oleh `node_modules/` di `.gitignore`.

### 8.3 Middleware mode dev

Plugin menambahkan middleware yang melayani:

- `GET /catalog.json` - mengembalikan katalog hasil generate.
- `GET /posters/<id>.jpg` - mengembalikan poster dari cache.

Dengan begitu mode `dev` dan hasil `build` memakai jalur data yang sama persis.

### 8.4 Penyaring genre: kenapa `popularity.desc` saja tidak cukup

Ini temuan yang diukur langsung terhadap TMDB, bukan dugaan.

Dengan `/discover/tv?sort_by=popularity.desc` tanpa penyaring, 20 hasil teratas
adalah campuran acara berita, gelar wicara, dan sinetron:
`Tagesschau`, `Sesame Street`, `The Tonight Show Starring Jimmy Fallon`,
`Watch What Happens Live`, `Radio Star`.

Hanya **43 persen** dari kandidat seperti itu yang punya trailer layak:

| Percobaan                         | Kandidat | Punya trailer layak |
| --------------------------------- | -------- | ------------------- |
| 60 kandidat tanpa penyaring genre | 60       | 26 (**43 %**)       |

Untuk mendapat 20 entri bertrailer, perlu memindai sekitar 47 kandidat. Dua kali
lebih banyak permintaan daripada hasil yang didapat, dan setengah katalog akan
berisi acara yang tidak cocok dengan tema.

Dengan penyaring genre, hasilnya jauh lebih baik:

| Percobaan                                                  | Kandidat | Punya trailer layak |
| ---------------------------------------------------------- | -------- | ------------------- |
| 20 kandidat dengan `with_genres=18` dan pengecualian genre | 20       | 16 (**80 %**)       |

Parameter yang dipakai:

```
with_genres=18
without_genres=10767,10763,10764,10766
vote_count.gte=100
sort_by=popularity.desc
include_adult=false
```

Keterangan kode genre TMDB:

| Kode  | Genre   | Alasan                                |
| ----- | ------- | ------------------------------------- |
| 18    | Drama   | Genre yang diinginkan.                |
| 10767 | Talk    | Gelar wicara. Tidak punya trailer.    |
| 10763 | News    | Acara berita. Tidak punya trailer.    |
| 10764 | Reality | Acara realitas. Jarang punya trailer. |
| 10766 | Soap    | Sinetron. Tidak punya trailer.        |

`vote_count.gte=100` membuang judul yang belum punya cukup penilaian, sehingga
rating yang ditampilkan tidak menyesatkan.

Penyaring ini juga menghilangkan sampah dengan cara yang tahan lama, tanpa
perlu daftar judul manual.

### 8.5 Mengapa dua bahasa dipanggil, bukan satu

Diukur dengan `/discover/tv?sort_by=popularity.desc`, 20 hasil teratas:

| Bahasa  | Entri dengan sinopsis tidak kosong |
| ------- | ---------------------------------- |
| `id-ID` | **2 dari 20**                      |
| `en-US` | 20 dari 20                         |

Dari 18 entri yang kosong di `id-ID`, **seluruhnya punya sinopsis di `en-US`**.
Tidak ada satu pun entri yang kosong di kedua bahasa.

Kesimpulan: memakai `id-ID` saja menghasilkan katalog yang 90 persen kosong
teksnya. Memakai `en-US` saja membuang sinopsis Indonesia yang tersedia.
Memanggil keduanya dan memilih yang tidak kosong memberi hasil terbaik.

Diukur ulang memakai penyaring genre dari Bagian 8.4: `id-ID` terisi 10 dari
20, dan setelah digabung dengan `en-US` menjadi 20 dari 20.

Biaya tambahan hanya satu permintaan HTTP saat build, dan itu tidak terasa.

Poster, judul, tanggal tayang, dan rating tidak terpengaruh bahasa, sehingga
tidak perlu digabungkan.

### 8.6 Urutan akhir: trailer didahulukan

Meski sudah disaring, sekitar 20 persen kandidat tetap tidak punya trailer
(terukur: 4 dari 20 pada Bagian 8.4). Bila urutan TMDB dipakai apa adanya,
halaman katalog bisa menampilkan beberapa kartu yang trailer-nya kosong, dan
pengunjung yang mengklik kartu tersebut langsung melihat halaman tanpa trailer.

Aturannya:

1. Kandidat dikelompokkan menjadi dua: yang punya `trailerKey`, dan yang tidak.
2. Kelompok bertrailer didahulukan, urut sesuai urutan TMDB.
3. Bila jumlahnya belum mencapai `CATALOG_LIMIT`, sisanya ditambal dari
   kelompok tanpa trailer, juga urut sesuai urutan TMDB.
4. Bila kelompok bertrailer sudah melebihi `CATALOG_LIMIT`, kandidat tanpa
   trailer tidak dipakai sama sekali.

Alternatif yang dipertimbangkan:

| Pendekatan                            | Hasil                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| Buang kandidat tanpa trailer          | **Ditolak.** Jumlah permintaan naik terus untuk mendapat cukup entri, dan katalog mengecil. |
| Tampilkan urutan TMDB apa adanya      | **Ditolak.** Sebagian kartu menuju halaman tanpa trailer, merusak alur utama.               |
| Trailer didahulukan, sisanya menambal | **Dipilih.** Semua entri tetap terpakai, dan mayoritas kartu menuju halaman yang lengkap.   |

Untuk mengimbangi kartu yang tetap tanpa trailer, modal menampilkan poster
dengan keterangan singkat, dan tombol Shopee tetap tampil. Perilakunya sudah
didefinisikan di Bagian 10.3.

### 8.7 Cara membuat isi katalog berbeda pada tiap build

Pemilik proyek meminta isi katalog dapat berbeda setiap build. Ini diukur
langsung terhadap TMDB:

| Yang diukur                            | Hasil          |
| -------------------------------------- | -------------- |
| `total_results` dengan penyaring 8.4   | 2536 judul     |
| `total_pages`                          | 127 halaman    |
| Halaman 1 sampai 100                   | 20 hasil penuh |
| Halaman 200 dan 500                    | 0 hasil        |
| Tumpang tindih halaman 1 dan halaman 7 | 0 dari 20      |

Halaman 1 dan halaman 7 tidak berbagi satu judul pun, jadi memilih halaman
secara acak sudah cukup membuat katalog berbeda setiap build.

Namun kualitas menurun pada halaman yang terlalu dalam. Diukur per halaman:

| Halaman | Rata-rata rating | Judul dengan kurang dari 500 suara | Punya trailer layak |
| ------- | ---------------- | ---------------------------------- | ------------------- |
| 1       | 8.07             | 3                                  | 16/20               |
| 5       | 7.95             | 4                                  | 17/20               |
| 10      | 7.70             | 5                                  | 15/20               |
| 20      | 7.76             | 10                                 | 18/20               |
| 40      | 7.48             | 12                                 | 18/20               |
| 90      | 7.41             | 17                                 | 17/20               |
| 120     | 7.49             | 18                                 | 15/20               |

Rata-rata rating masih wajar sampai halaman 120, tetapi jumlah judul yang
belum banyak dinilai naik terus, dari 3 menjadi 18. Rating dari judul seperti
itu tidak dapat dipercaya.

Aturannya:

1. Halaman dipilih acak dari `1` sampai `CATALOG_PAGE_POOL`, default `20`.
2. `CATALOG_PAGE_POOL` dibatasi maksimum 40, karena di atas itu kualitas
   turun tanpa manfaat yang sepadan.
3. Untuk memenuhi `CATALOG_LIMIT` yang lebih besar dari 20, halaman berikutnya
   diambil berurutan mulai dari halaman yang terpilih, lalu berputar kembali
   ke halaman 1 bila sudah melewati batas kolam.
4. Bila nomor halaman melebihi `total_pages` dari TMDB, permintaan diulang dari
   halaman 1. Tanpa aturan ini, build bisa menerima daftar kosong.
5. Nilai acak memakai `Math.random()` bawaan. Tidak perlu sumber acak khusus:
   katalog hanya perlu berbeda antar build, bukan tidak dapat diprediksi.
6. Halaman yang terpilih dicatat di log build dan disimpan di
   `catalog.json` sebagai medan `page`, agar hasil yang aneh dapat ditelusuri.

Konsekuensi yang harus diterima: dua build berturut-turut dapat kebetulan
memilih halaman yang sama, sehingga katalognya identik. Itu wajar dan tidak
perlu dicegah.

## 9. Katalog cadangan

`tools/catalog/fallback.ts` berisi enam drama dengan poster yang **tidak ada**.
Kartu akan menampilkan latar gradien, sama seperti perilaku poster gagal muat
yang sudah ada sekarang. Ini disengaja:

- Tidak ada berkas gambar yang perlu ikut di-commit.
- Tidak ada hak cipta pihak ketiga yang tersimpan di repositori.
- Halaman tetap tampil rapi, hanya tanpa gambar.

Katalog cadangan hanya muncul dalam dua keadaan: `TMDB_API_KEY` tidak diisi,
atau TMDB tidak dapat dihubungi saat build.

## 10. Alur pengguna

```
Landing  --(klik tombol, atau 8 detik)-->  Katalog  --(klik kartu)-->  Detail
                                                                            |
                                                              (klik TONTON FULL)
                                                                            v
                                                                         Shopee
```

### 10.1 Landing

Tampilan dipertahankan persis seperti sekarang. Dua perubahan:

1. Tombol CTA berubah menjadi **"LIHAT KATALOG"** dan tidak lagi membuka Shopee.
2. Ditambahkan hitungan mundur yang terlihat: "Masuk katalog otomatis dalam 8
   detik", dengan tautan **Batalkan**.

Aturan hitungan mundur:

- Timer dibersihkan saat komponen dilepas, sehingga tidak ada navigasi hantu
  yang terjadi setelah pengunjung berpindah halaman.
- Klik tombol membatalkan timer dan langsung masuk katalog.
- Perpindahan dari landing ke katalog memakai `location.replace()`, bukan
  penugasan `location.hash` biasa. Tanpa ini, riwayat berisi landing lalu
  katalog, sehingga tombol kembali mengembalikan pengunjung ke landing dan
  hitungan mundur 8 detik terpicu lagi. Pengunjung terjebak dalam lingkaran
  landing ke katalog ke landing.
  Konsekuensi yang disengaja: landing tidak dapat dicapai lewat tombol kembali.
  Untuk halaman clickbait satu arah, itu memang perilaku yang diinginkan.

Selama hitungan mundur berjalan, poster katalog **sudah mulai diunduh di latar
belakang**. Ini membuat spinner di halaman katalog sering kali hanya muncul
sekilas.

### 10.1.1 Kapan `catalog.json` dimuat

`App.tsx` memuat `config.json` dan `catalog.json` bersamaan saat pertama kali
dimount, memakai pola yang sama seperti `loadConfig()` sekarang, termasuk
penjaga `active` agar tidak menulis state setelah komponen dilepas.

Alasan tidak memuatnya di halaman katalog saja: penundaan pengunduhan poster
baru dimulai setelah pengunjung sampai di katalog, sehingga overlay spinner
selalu terlihat penuh. Dengan memuat lebih awal, pengunduhan sudah berjalan
selama hitungan mundur 8 detik dan overlay sering kali hanya berkedip.

Isi katalog diteruskan sebagai properti ke halaman katalog dan ke modal.
Tidak ada permintaan kedua dan tidak perlu context.

### 10.2 Katalog

- Grid responsif: 2 kolom di ponsel, 3 di tablet, 4 sampai 5 di desktop.
- Tiap kartu: poster, judul, tahun, dan rating.
- Kartu adalah `<button>` asli, sehingga dapat diakses lewat papan ketik.
- Judul dibatasi dua baris agar tinggi kartu seragam.

### 10.3 Modal trailer

Modal dibuka dengan mengklik kartu drama di katalog. Isinya:

- Judul, tahun, rating, dan sinopsis.
- Trailer YouTube dimuat begitu modal terbuka, dengan `autoplay=1`. Tidak ada
  klik kedua. Rincian perilaku dan kemundurannya di Bagian 13.1.
- Tombol **"TONTON FULL DI SHOPEE"** selalu terlihat. Klik memakai
  `openAffiliate()` yang sudah ada, termasuk fallback popup-blocked.
- Tombol tutup yang jelas di pojok.

Bila `trailerKey` kosong, area trailer menampilkan poster dengan keterangan
singkat bahwa trailer tidak tersedia. Tombol Shopee tetap tampil, sehingga
kartu tanpa trailer tetap dapat menghasilkan klik.

Latar belakang modal diberi lapisan gelap dan **blur**. Katalog tetap terlihat
samar di belakangnya, sehingga pengunjung tidak merasa berpindah halaman.

#### 10.3.1 Memakai elemen `<dialog>` bawaan

Modal dibangun di atas elemen `<dialog>` dengan `showModal()`, bukan `div`
buatan sendiri. Alasannya `<dialog>` sudah memberi tiga hal yang sulit dibuat
manual dan mudah salah:

| Kebutuhan       | Yang diberikan `<dialog>`                         |
| --------------- | ------------------------------------------------- |
| Perangkap fokus | Fokus otomatis terkurung di dalam modal.          |
| Tombol Esc      | Menutup modal tanpa kode tambahan.                |
| Lapisan latar   | `::backdrop` dapat digayakan langsung dengan CSS. |

Alternatif yang dipertimbangkan:

| Pendekatan                      | Hasil                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `<dialog>` dengan `showModal()` | **Dipilih.** Perangkap fokus dan Esc ditangani browser, jadi tidak ada kode rapuh yang harus dirawat.                   |
| `div` dengan `role="dialog"`    | **Ditolak.** Perangkap fokus, Esc, dan pengurungan latar harus ditulis semua sendiri, dan itu sumber bug aksesibilitas. |

#### 10.3.2 Aturan tutup dan riwayat

Ada empat cara modal ditutup, dan semuanya harus menyisakan riwayat yang rapi:

| Cara                   | Perilaku                                                                   |
| ---------------------- | -------------------------------------------------------------------------- |
| Tombol tutup           | Tutup, lalu jalankan aturan riwayat di bawah.                              |
| Tombol Esc             | Ditangani browser. Ditangkap lewat peristiwa `close`, lalu aturan riwayat. |
| Klik latar             | Tutup, lalu aturan riwayat.                                                |
| Tombol kembali browser | Hash berubah menjadi `#/katalog`, modal ikut tertutup.                     |

Aturan riwayat:

1. **Membuka** modal memakai `location.hash`, sehingga menambah satu entri
   riwayat. Ini yang membuat tombol kembali menutup modal, sesuai kebiasaan
   yang diharapkan di Android.
2. **Menutup** modal memakai `location.replace('#/katalog')`, bukan penugasan
   `location.hash`. Bedanya penting: `replace` menimpa entri saat ini alih-alih
   menambah entri baru.

Bila aturan 2 dilanggar dan penugasan `location.hash` dipakai untuk menutup,
riwayat menjadi `#/katalog`, `#/drama/123`, `#/katalog`. Akibatnya pengunjung
harus menekan tombol kembali dua kali hanya untuk keluar dari satu modal, dan
tekanan pertama terasa seperti tidak terjadi apa-apa.

Saat halaman dibuka langsung lewat tautan `#/drama/123`, tidak ada entri
sebelumnya. Karena penutupan memakai `replace`, riwayat tetap bersih dan
pengunjung tidak terjebak.

#### 10.3.3 Klik latar

`<dialog>` bawaan tidak menutup saat latar diklik, jadi ini harus ditangani
manual. Aturannya:

1. Pengendali klik dipasang pada elemen `<dialog>` itu sendiri.
2. Modal ditutup hanya bila `event.target` **adalah** elemen `<dialog>`
   tersebut.

Syarat agar cara ini benar: elemen `<dialog>` tidak boleh punya `padding`, dan
seluruh isi modal harus berada di dalam satu elemen anak. Bila `<dialog>` diberi
`padding`, area padding itu ikut terhitung sebagai latar, sehingga klik di
pinggir dalam modal akan menutupnya secara tak terduga.

#### 10.3.4 Kunci gulir

`<dialog>` tidak mengunci gulir halaman di belakangnya pada semua mesin
peramban. Karena itu, saat modal dibuka:

1. `document.body` diberi `overflow: hidden` agar halaman di belakang tidak
   bergeser.
2. Elemen modal diberi `overscroll-behavior: contain`, sehingga gulir di dalam
   modal tidak menular ke halaman di belakangnya.
3. Nilai `overflow` asli dipulihkan saat modal ditutup. Pemulihan harus
   ditempatkan di satu jalur yang selalu berjalan, supaya halaman tidak
   tertinggal dalam keadaan tidak dapat digulir.

Bila aturan ini dilewatkan, pengunjung dapat menggulir katalog di belakang
modal. Itu terlihat seperti kesalahan dan merusak kesan premium.

#### 10.3.5 Fokus

1. `showModal()` memindahkan fokus ke dalam modal secara otomatis.
2. Fokus pertama diarahkan ke tombol tutup, bukan ke iframe YouTube, supaya
   pengunjung melihat dulu apa yang sedang terbuka.
3. Setelah modal ditutup, fokus dikembalikan ke kartu yang membukanya. Tanpa
   ini, pengguna papan ketik terlempar kembali ke awal halaman.

#### 10.3.6 Animasi

Modal muncul dengan transisi singkat: latar menggelap dan panel naik sedikit
disertai perubahan kelegapan. Total durasinya di bawah 250 milidetik.

Bila `prefers-reduced-motion` aktif, animasi dimatikan sepenuhnya. Modal
langsung muncul dan langsung hilang, tanpa perubahan perilaku lain.

## 11. Overlay pemuatan

Ini syarat wajib dari pemilik proyek: **selama poster belum selesai diunduh,
overlay spinner harus tetap muncul.**

Aturan:

1. Overlay muncul di halaman katalog, dan menutupi seluruh layar.
2. Overlay berisi spinner berputar dan satu baris teks. Tidak ada elemen lain.
3. Overlay baru hilang setelah **semua** poster melaporkan selesai, baik
   berhasil maupun gagal.
4. Gambar yang gagal diunduh dihitung selesai. Tanpa aturan ini, satu poster
   rusak akan membuat overlay menggantung selamanya.
5. Ada batas waktu aman 12 detik. Bila terlampaui, overlay hilang dan sisa
   poster dibiarkan dimuat sendiri. Pengunjung tidak boleh terjebak.
6. Overlay memakai `aria-busy` dan tidak dapat ditembus klik.
7. Bila `prefers-reduced-motion` aktif, spinner berhenti berputar tetapi overlay
   tetap tampil.

Penantian dilakukan dengan membuat objek `new Image()` untuk setiap URL, bukan
dengan mengandalkan `onLoad` pada elemen `<img>` di dalam grid. Alasannya:
elemen di dalam grid baru dipasang setelah React merender, sedangkan objek
`Image` bisa mulai diunduh lebih awal, sebelum pengunjung sampai ke katalog.

### 11.1 Urutan saat modal dibuka lewat tautan langsung

Bila hash awal sudah berisi `#/drama/123`, ada dua hal yang ingin terjadi
bersamaan: overlay pemuatan, dan modal trailer. Urutannya harus ditetapkan.

Aturannya:

1. Overlay tampil lebih dahulu dan menutupi layar.
2. Modal **tidak** dibuka selama overlay masih tampil.
3. Setelah overlay hilang, barulah modal terbuka dan trailer diputar.

Alasannya: bila modal dibuka lebih dahulu, trailer akan berbunyi di belakang
overlay yang masih menutupi layar. Suara tanpa gambar itu terasa seperti
kerusakan, dan merusak kesan premium yang justru ingin dicapai.

Modal juga tidak dibuka di atas grid yang masih kosong. Pengunjung tidak boleh
melihat katalog setengah jadi di belakang modal.

Konsekuensi: pengunjung yang datang lewat tautan langsung menunggu sebentar
lebih lama sebelum trailer muncul. Itu pertukaran yang disengaja.

## 12. Penanganan error

| Kejadian                                  | Perilaku                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `TMDB_API_KEY` kosong                     | Pakai katalog cadangan. Build sukses, mencetak peringatan.                  |
| TMDB membalas bukan 200                   | Pakai katalog cadangan.                                                     |
| Satu permintaan HTTP melebihi batas waktu | Pakai katalog cadangan.                                                     |
| Satu poster gagal diunduh                 | Entri tetap ada, `poster` menjadi string kosong, kartu memakai gradien.     |
| Tidak ada trailer layak untuk satu drama  | `trailerKey` string kosong, area trailer menampilkan poster.                |
| `catalog.json` gagal dimuat di browser    | Halaman katalog menampilkan pesan kosong dengan tombol coba lagi.           |
| `catalog.json` rusak                      | Sama seperti di atas. Tidak ada satu pun medan yang dipercaya begitu saja.  |
| Route tidak dikenal                       | Kembali ke landing.                                                         |
| ID drama tidak ada di katalog             | Modal dibuka dengan pesan singkat, ditutup dengan tombol tutup.             |
| Trailer gagal dimuat di iframe            | Iframe dibuang, poster tampil, tombol Shopee tetap berfungsi.               |
| Iframe diblokir peramban                  | Sama seperti di atas. Tidak ada keadaan yang menyisakan kotak hitam kosong. |

Semua medan `catalog.json` divalidasi saat dibaca, dengan pola yang sama seperti
`parseConfig()` sekarang. Data dari jaringan tidak pernah dipercaya begitu saja.

## 13. Trailer YouTube

1. Pencarian trailer memakai aturan yang sama seperti arsip: `site` harus
   `"YouTube"`, dan `type` diutamakan `"Trailer"`, lalu `"Teaser"`.
2. `trailerKey` divalidasi terhadap pola `^[A-Za-z0-9_-]{11}$`. Nilai yang tidak
   cocok dianggap tidak ada trailer.
3. Iframe memakai `https://www.youtube-nocookie.com/embed/<key>`. Domain ini
   tidak memasang cookie pelacakan sebelum video diputar.
4. Parameter yang dipakai:

| Parameter        | Nilai | Alasan                                                          |
| ---------------- | ----- | --------------------------------------------------------------- |
| `autoplay`       | `1`   | Trailer langsung diputar saat modal terbuka.                    |
| `rel`            | `0`   | Membatasi video rekomendasi dari channel lain di akhir trailer. |
| `playsinline`    | `1`   | Mencegah video membuka pemutar penuh sendiri di iPhone.         |
| `modestbranding` | `1`   | Mengurangi lambang YouTube agar tampilan terasa menyatu.        |

5. Atribut `allow` pada iframe: `autoplay; encrypted-media; fullscreen;
picture-in-picture`. Tanpa `autoplay` di daftar ini, trailer tidak akan
   berputar meski parameternya sudah diset.

### 13.1 Perilaku autoplay dan kemundurannya

Modal memasang iframe **segera** saat dibuka, dengan `autoplay=1`. Trailer
langsung berputar, sehingga perpindahan terasa mulus tanpa satu klik tambahan.

Yang membuat ini aman: pemutar YouTube menangani sendiri kegagalan autoplay.

| Mesin peramban              | Yang terjadi                                                      |
| --------------------------- | ----------------------------------------------------------------- |
| Mengizinkan autoplay        | Trailer langsung berputar.                                        |
| Memblokir autoplay bersuara | Pemutar menampilkan poster dan tombol play milik YouTube sendiri. |

Karena kemundurannya ditangani pemutar, tidak perlu ada logika pengenalan
peramban atau pemeriksaan kebijakan autoplay di sisi kita. Tidak ada percabangan
kode yang harus dirawat.

Catatan jujurnya: pada sebagian peramban di ponsel, autoplay bersuara akan
diblokir dan pengunjung melihat tombol play. Itu bukan kerusakan, dan tidak
perlu dipaksakan. Harus diuji di peramban sungguhan, bukan diasumsikan.

### 13.2 Iframe wajib dibuang saat modal ditutup

Iframe hanya boleh ada selama modal terbuka. Saat modal ditutup, elemen iframe
harus dilepas dari pohon DOM, bukan sekadar disembunyikan.

Ini bukan soal kerapian. Bila iframe tetap terpasang:

1. Suara trailer terus berbunyi padahal modal sudah tidak terlihat.
2. Video terus diunduh di latar belakang, memakai kuota pengunjung.
3. Membuka modal lain menumpuk pemutar kedua yang juga ikut berbunyi.

Cara yang dipakai: `TrailerModal` hanya merender iframe selama ada ID yang
sedang dibuka. Begitu ID menjadi kosong, komponen dilepas dan iframe ikut
hilang.

Syarat pengujiannya harus memeriksa DOM dan permintaan jaringan, bukan hanya
melihat layar. Modal yang tertutup terlihat benar walau suaranya masih berbunyi.

Atribusi wajib dari TMDB: teks "This product uses the TMDB API but is not
endorsed or certified by TMDB." ditampilkan di footer katalog. Karena modal
menutupi footer, atribusi juga diulang kecil di dalam modal.

## 14. Tooling dan konfigurasi

Tidak ada dependency runtime baru. React dan React DOM tetap dua-satunya
dependency. Semua perkakas katalog berjalan di Node memakai `fetch` bawaan,
sehingga tidak perlu `axios` atau `node-fetch`.

Perubahan konfigurasi:

- `tsconfig.node.json`: `include` bertambah `tools/**/*`.
- `eslint.config.js`: `files` bertambah `tools/**/*.ts`.
- `eslint.config.js` tidak lagi mengabaikan `tools/`.

Perintah baru:

| Perintah             | Isi                                                             |
| -------------------- | --------------------------------------------------------------- |
| `pnpm catalog:check` | Menjalankan generate katalog tanpa build penuh, untuk diagnosa. |

## 15. Testing

Tes baru, semuanya murni dan tanpa jaringan:

| Berkas                                 | Yang diuji                                                                                                                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/catalog/normalize.test.ts`      | Pemetaan medan, entri tanpa judul dibuang, trailer non-YouTube ditolak, rating dibulatkan, tahun kosong.                                                                                              |
| `tools/catalog/fetchCatalog.test.ts`   | Jatuh ke cadangan saat key kosong, saat bukan 200, dan saat `fetch` melempar. Poster gagal tidak membatalkan entri. `fetch` disuntikkan sebagai tiruan.                                               |
| `src/lib/router.test.ts`               | Hash kosong, `#/katalog`, `#/drama/123`, hash dengan garis miring tambahan, ID kosong, ID bukan angka, dan hash tidak dikenal.                                                                        |
| `src/hooks/useCatalog.test.ts`         | `catalog.json` bukan 200, JSON rusak, entri cacat dibuang, dan pembatalan saat komponen dilepas.                                                                                                      |
| `src/hooks/useImagePreloader.test.ts`  | `Image` tiruan: selesai hanya setelah semua `onload`, gambar gagal tetap dihitung selesai, dan batas waktu membebaskan overlay.                                                                       |
| `src/components/TrailerModal.test.tsx` | Modal tertutup tidak merender iframe, modal terbuka merender iframe dengan `trailerKey` benar, `trailerKey` kosong tidak merender iframe, dan klik latar menutup sedangkan klik di dalam panel tidak. |

Tes lama yang perlu disesuaikan:

- `src/App.test.tsx`: sekarang menguji kerangka router. Isi lama pindah ke
  `src/pages/LandingPage.test.tsx`.

Tes yang tidak berubah: `config.test.ts`, `links.test.ts`, `redirect.test.ts`,
`CtaButton.test.tsx`.

### 15.1 Batasan `jsdom` dan cara mengatasinya

Diukur langsung pada `jsdom` versi yang dipakai proyek ini:

| Yang diperiksa            | Hasil                |
| ------------------------- | -------------------- |
| `dialog.constructor.name` | `HTMLDialogElement`  |
| `typeof dialog.showModal` | `undefined`          |
| `typeof dialog.show`      | `undefined`          |
| `dialog.showModal()`      | melempar `TypeError` |

Jadi `jsdom` mengenali elemennya, tetapi tidak menyediakan metodenya. Bila
dibiarkan, `TrailerModal.test.tsx` akan gagal dengan `TypeError` dan tidak
menguji apa pun.

Solusinya: `src/test-setup.ts` menambahkan dua metode tiruan pada
`HTMLDialogElement.prototype` **hanya untuk lingkungan tes**:

| Metode        | Perilaku tiruan                                       |
| ------------- | ----------------------------------------------------- |
| `showModal()` | Menyetel `open = true` dan mencatat pemanggilannya.   |
| `close()`     | Menyetel `open = false` dan memicu peristiwa `close`. |

Tiruan ini sengaja sederhana. Tujuannya hanya mencegah `TypeError`, bukan
meniru perangkap fokus yang asli.

Tes `jsdom` membuktikan hal-hal yang tidak bergantung tata letak: atribut
`open`, pemasangan dan pelepasan iframe, `trailerKey` kosong, serta pemanggilan
penangan tutup.

Yang **tidak** dibuktikan `jsdom` dan wajib diuji di peramban sungguhan lewat
Playwright: perangkap fokus, tombol Esc, klik latar, penguncian gulir, dan
apakah trailer benar-benar berputar. Menulis tes `jsdom` untuk hal-hal itu akan
menghasilkan tes yang lulus tanpa membuktikan apa pun, jadi tidak ditulis.

## 16. Build dan deploy

Urutan di GitHub Actions menjadi:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm build`, dengan `TMDB_API_KEY` dari `secrets.TMDB_API_KEY`
6. Pemeriksaan tambahan: pastikan nilai `TMDB_API_KEY` **tidak muncul** di
   dalam `dist/`. Langkah ini gagal bila nilainya ditemukan.
7. Deploy seperti sekarang.

Langkah 6 ditulis sebagai perintah shell di dalam workflow, bukan sebagai tes
Vitest, karena hanya di CI nilai key tersedia.

## 17. Keamanan dan penanganan rahasia

1. `TMDB_API_KEY` disimpan di GitHub sebagai repository secret, bukan variable.
2. Nilainya tidak pernah ditulis ke berkas mana pun di dalam repositori.
3. `.env` tetap di-ignore oleh git. `.env.example` hanya memuat nama variabel
   tanpa nilai.
4. Kode di `src/` tidak boleh menyebut `TMDB_API_KEY`. Plugin katalog hanya
   dipakai saat build dan tidak pernah masuk ke bundle browser.
5. Key TMDB lama yang sudah bocor di riwayat git **wajib di-revoke** di dasbor
   TMDB. Selama belum di-revoke, key itu masih dapat dipakai orang lain.
6. Karena key dikirim sebagai secret, build dari pull request dari fork tidak
   akan menerimanya. Workflow hanya berjalan pada push ke `main` dan
   `workflow_dispatch`, jadi hal ini tidak menjadi masalah.

## 18. Verifikasi

Yang harus dibuktikan sebelum pekerjaan dianggap selesai:

1. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`, dan
   `pnpm build` semuanya keluar dengan kode 0.
2. `dist/catalog.json` ada dan bentuknya sesuai Bagian 7.
3. `dist/posters/` berisi berkas `.jpg` sebanyak entri yang punya poster.
4. `dist/` tidak memuat nilai `TMDB_API_KEY`.
5. Menjalankan build dua kali dengan key yang sama menghasilkan
   `generatedAt` yang berbeda.
6. Menjalankan build tanpa key tetap sukses dan menghasilkan
   `"source": "fallback"`.
7. Di browser: klik dari landing sampai ke Shopee berhasil pada satu alur utuh,
   diuji dengan Playwright.
8. Overlay terlihat saat poster belum selesai, dan hilang setelah semuanya
   selesai. Diuji dengan memperlambat jaringan.
9. Pada lebar 360, 375, 390, dan 430 piksel, tidak ada gulir horizontal.
10. Iframe YouTube **belum ada** di DOM sebelum modal dibuka. Dibuktikan dengan
    memeriksa DOM dan daftar permintaan jaringan saat halaman katalog baru
    terbuka, bukan dengan melihat layar.
11. Iframe YouTube **sudah ada** di DOM setelah modal dibuka, dan trailer
    benar-benar berputar di peramban sungguhan.
12. Setelah modal ditutup, iframe **hilang dari DOM** dan suara trailer
    benar-benar berhenti. Dibuktikan dengan memeriksa DOM, bukan hanya dengan
    melihat layar. Modal yang tertutup terlihat benar walau suaranya masih
    berbunyi.
13. Tombol Esc menutup modal.
14. Tombol kembali browser menutup modal, dan menekannya sekali lagi kembali ke
    landing. Ini membuktikan riwayat tidak menumpuk.
15. Klik di dalam panel modal **tidak** menutupnya, sedangkan klik di latar
    menutupnya.
16. Halaman di belakang modal tidak dapat digulir selama modal terbuka, dan
    dapat digulir kembali setelah modal ditutup.
17. Setelah modal dibuka langsung dari tautan `#/drama/123`, menekan tombol
    tutup sekali langsung kembali ke katalog dalam satu langkah.

## 19. Risiko dan mitigasi

| Risiko                                           | Dampak                                   | Mitigasi                                                                                                            |
| ------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| TMDB mengubah bentuk respons                     | Katalog kosong                           | Normalisasi defensif, semua medan divalidasi, jatuh ke cadangan.                                                    |
| TMDB membatasi permintaan                        | Build memakai cadangan                   | Cache saat `dev`, batas 40 entri, dan cadangan yang selalu siap.                                                    |
| Build lambat karena mengunduh poster             | Waktu CI bertambah sekitar 20 detik      | Batas 6 unduhan paralel dan batas waktu per permintaan.                                                             |
| Katalog berubah tiap build padahal sedang diuji  | Hasil tes membingungkan                  | `generatedAt` dan `source` ditampilkan agar asal data selalu jelas.                                                 |
| Overlay menggantung karena poster gagal          | Pengunjung tidak bisa masuk              | Gambar gagal dihitung selesai, ditambah batas waktu 12 detik.                                                       |
| Judul trailer menuju video yang sudah dihapus    | Trailer tidak tampil                     | Iframe gagal ditangani, pengunjung tetap dapat memakai tombol Shopee.                                               |
| Suara trailer tetap berbunyi setelah modal tutup | Sangat mengganggu, terlihat rusak        | Iframe dilepas dari DOM saat modal ditutup, dan diverifikasi lewat DOM.                                             |
| Riwayat menumpuk saat modal dibuka dan ditutup   | Tombol kembali perlu ditekan dua kali    | Menutup memakai `location.replace()`, bukan penugasan `location.hash`.                                              |
| Halaman di belakang modal ikut tergulir          | Kesan premium hilang                     | `overflow: hidden` pada `body` dan `overscroll-behavior: contain`.                                                  |
| `<dialog>` tidak seragam di peramban lama        | Modal tidak mau terbuka                  | Hanya peramban modern yang disasar. Peramban lama tetap dapat memakai katalog dan tombol Shopee, hanya tanpa modal. |
| Autoplay diblokir di ponsel                      | Trailer tidak langsung berputar          | Dibiarkan: pemutar YouTube menampilkan tombol play sendiri. Tidak ada kode tambahan.                                |
| Ukuran halaman bertambah karena banyak poster    | Pemuatan lebih lambat di jaringan lambat | Maksimum 20 poster, ukuran `w500`, format asli TMDB yang sudah termampatkan.                                        |

## 20. Ringkasan keputusan

| Pertanyaan                              | Keputusan                                                              |
| --------------------------------------- | ---------------------------------------------------------------------- |
| Dari mana data katalog berasal?         | TMDB, diambil saat build, bukan saat runtime.                          |
| Bagaimana dengan kunci API?             | Hanya di proses build. Nama variabel tanpa prefix `VITE_`.             |
| Bagaimana katalog di-generate?          | Vite plugin, dengan logika murni di `tools/catalog/`.                  |
| Bagaimana masuk ke katalog?             | Tombol "LIHAT KATALOG", ditambah otomatis setelah 8 detik.             |
| Bagaimana link Shopee dipetakan?        | Satu daftar link global dari `config.json`, dengan rotasi.             |
| Poster diunduh atau di-hotlink?         | Diunduh saat build, disimpan sebagai aset di `dist/`.                  |
| Bagaimana trailer ditampilkan?          | Popup modal di atas katalog, bukan halaman terpisah.                   |
| Bagaimana modal dikendalikan?           | Lewat hash URL (`#/drama/123`), sehingga tombol kembali menutup modal. |
| Apa yang terjadi saat modal ditutup?    | Iframe YouTube dilepas dari DOM agar suara benar-benar berhenti.       |
| Bagaimana tidak terlihat setengah jadi? | Overlay spinner sampai semua poster selesai diunduh.                   |
| Bagaimana routing bekerja?              | Berbasis hash, router sendiri di bawah 1 KB.                           |
| Apa yang terjadi bila TMDB mati?        | Build sukses memakai katalog cadangan.                                 |

## 21. Referensi

- Spec sebelumnya: `docs/superpowers/specs/2026-09-16-shopee-clickbait-landing-design.md`
- Rencana sebelumnya: `docs/superpowers/plans/2026-09-16-shopee-clickbait-landing.md`
- Arsip pola TMDB: `archive/browser.html` (baris 1005, 1265, 1966, 2014)
- TMDB API: `https://developer.themoviedb.org/docs`
- Atribusi TMDB: `https://www.themoviedb.org/about/logos-attribution`
