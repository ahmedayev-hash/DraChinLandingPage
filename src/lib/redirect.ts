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
