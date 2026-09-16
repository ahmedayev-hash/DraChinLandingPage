/**
 * Overlay pemuatan katalog.
 *
 * Tampil selama poster belum selesai diunduh, supaya katalog tidak pernah
 * terlihat setengah jadi. `role="status"` membuat pembaca layar mengumumkan
 * keadaannya.
 */
export function LoadingOverlay() {
  return (
    <div className="overlay" role="status" aria-live="polite" aria-busy="true">
      <span className="overlay__spinner" aria-hidden="true" />
      <p className="overlay__text">Menyiapkan katalog…</p>
    </div>
  );
}
