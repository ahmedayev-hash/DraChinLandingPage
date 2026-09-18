/**
 * Pembukaan link affiliate, dengan tangga percobaan tab baru.
 *
 * Mengapa TIDAK memakai 'noopener' pada argumen window.open: ketika noopener
 * dispesifikasikan, browser SELALU mengembalikan null, bahkan saat popup
 * berhasil dibuka. Akibatnya mustahil membedakan "berhasil" dari "diblokir",
 * dan kode akan menjalankan fallback tanpa perlu. Sebagai gantinya kita
 * menonaktifkan opener secara manual setelah window berhasil diperoleh.
 *
 * Popup-block nyata terjadi di in-app browser (TikTok, Instagram, WhatsApp)
 * yang membawa mayoritas trafik affiliate. Di sana window.open mengembalikan
 * null, sehingga pemanggil perlu mencoba lagi pada gestur berikutnya, dan
 * akhirnya memindahkan tab yang sama agar klik tidak hilang diam-diam.
 *
 * Modul ini adalah satu-satunya tempat yang mengetahui kuirk browser di atas.
 * Ia sengaja memisahkan "mencoba" dari "memindahkan tab" supaya pemanggil
 * dapat menyusun tangga fallback tanpa risiko membuka dua tab.
 */

/** Memindahkan tab yang sedang aktif ke link affiliate. */
export function redirectToAffiliate(url: string): void {
  window.location.href = url;
}

/**
 * Mencoba membuka link di tab baru melalui beberapa jalur.
 *
 * Mengembalikan true hanya bila percobaan pertama (window.open) terbukti
 * berhasil, yaitu browser mengembalikan objek Window. Percobaan kedua memakai
 * anchor target="_blank"; hasilnya tidak dapat dibaca dari JavaScript, jadi ia
 * hanya bonus best-effort dan tidak pernah membuat fungsi ini melapor berhasil.
 * Karena itu pemanggil selalu masih menyediakan redirect sebagai jaminan.
 *
 * Fungsi ini TIDAK menyentuh location.
 */
export function tryOpenNewTab(url: string): boolean {
  if (tryWindowOpen(url)) {
    return true;
  }

  tryAnchorClick(url);

  return false;
}

/** Percobaan pertama: window.open. Hasilnya dapat dibaca. */
function tryWindowOpen(url: string): boolean {
  if (typeof window === 'undefined' || typeof window.open !== 'function') {
    return false;
  }

  const win = openWindow(url);

  if (win === null) {
    return false;
  }

  try {
    // Setara noopener, tetapi baru bisa dilakukan setelah window diperoleh.
    win.opener = null;
  } catch {
    // Sebagian webview melarang penulisan opener. Tab tetap terbuka, jadi
    // percobaan ini tetap dihitung berhasil.
  }

  return true;
}

/** Membungkus window.open supaya pengecualian webview tidak merusak halaman. */
function openWindow(url: string): Window | null {
  try {
    return window.open(url, '_blank');
  } catch {
    return null;
  }
}

/**
 * Percobaan kedua: klik anchor target="_blank" programatik.
 *
 * Sebagian in-app browser memperlakukan klik anchor berbeda dari window.open,
 * sehingga percobaan ini kadang lolos padahal yang pertama diblokir. Karena
 * popup-block tidak melempar pengecualian, tidak ada cara mengetahui hasilnya;
 * itulah sebabnya fungsi ini tidak melaporkan apa pun.
 */
function tryAnchorClick(url: string): void {
  if (typeof document === 'undefined' || document.body === null) {
    return;
  }

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';

  try {
    document.body.append(anchor);
    anchor.click();
  } catch {
    // Diabaikan: percobaan ini memang best-effort.
  } finally {
    anchor.remove();
  }
}

/**
 * Buka tab baru; bila gagal, pindahkan tab ini. Ini lapis terakhir tangga,
 * sehingga klik tidak pernah hilang.
 */
export function openAffiliate(url: string): void {
  if (tryOpenNewTab(url)) {
    return;
  }

  redirectToAffiliate(url);
}
