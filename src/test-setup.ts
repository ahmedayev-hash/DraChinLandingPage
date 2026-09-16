import '@testing-library/jest-dom/vitest';

// jsdom mengenali elemen <dialog> tetapi tidak menyediakan showModal dan close.
// Tanpa tiruan ini, komponen modal akan melempar TypeError saat diuji.
//
// Tiruan ini sengaja sederhana: tujuannya mencegah TypeError, bukan meniru
// perangkap fokus yang asli. Perangkap fokus, tombol Esc, dan klik latar tidak
// dapat dibuktikan di jsdom dan wajib diuji di peramban sungguhan.
// Berkas ini dimuat untuk SEMUA berkas tes, termasuk yang memakai lingkungan
// node (tools/**). HTMLDialogElement tidak ada di sana, jadi tanpa penjagaan
// ini seluruh tes node gagal dengan ReferenceError.
if (typeof HTMLDialogElement !== 'undefined') {
  const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;

  if (typeof dialogProto['showModal'] !== 'function') {
    dialogProto['showModal'] = function showModal(this: HTMLDialogElement): void {
      this.setAttribute('open', '');
    };
  }

  if (typeof dialogProto['close'] !== 'function') {
    dialogProto['close'] = function close(this: HTMLDialogElement): void {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
}
