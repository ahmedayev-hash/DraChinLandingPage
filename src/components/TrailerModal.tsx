import { useEffect, useRef } from 'react';
import type { CatalogItem } from '../../tools/catalog/types';
import { CtaButton } from './CtaButton';

interface TrailerModalProps {
  item: CatalogItem | null;
  onClose: () => void;
  ctaText?: string;
  onWatch?: () => void;
}

function noop(): void {
  // Tombol tetap tampil walau tidak ada penangan. Lebih baik begitu daripada
  // tombol mati tanpa penjelasan.
}

/**
 * Modal trailer di atas katalog.
 *
 * Memakai <dialog> native agar perangkap fokus dan tombol Esc ditangani
 * peramban, bukan ditulis manual.
 *
 * Iframe hanya dirender selama ada item. Bila dibiarkan terpasang, suara
 * trailer akan terus berbunyi walau modalnya sudah tidak terlihat.
 */
export function TrailerModal({ item, onClose, ctaText, onWatch }: TrailerModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const open = item !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      // Fokus diarahkan ke tombol tutup, bukan ke iframe, supaya pengunjung
      // melihat dulu apa yang sedang terbuka.
      closeRef.current?.focus();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Kunci gulir halaman di belakang modal. Nilai asli selalu dipulihkan supaya
  // halaman tidak tertinggal dalam keadaan tidak dapat digulir.
  useEffect(() => {
    if (!open) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-label={item === null ? 'Trailer' : `Trailer ${item.title}`}
      onClose={() => {
        // dialog.close() juga memicu event close. Saat modal ditutup secara
        // program karena item menjadi null, event itu akan memanggil onClose
        // untuk kedua kali dan mendorong navigasi tambahan. Penjagaan ini
        // memastikan onClose hanya berjalan untuk penutupan sungguhan oleh
        // pengunjung (tombol Esc atau penutupan oleh peramban).
        if (item !== null) {
          onClose();
        }
      }}
      onClick={(event) => {
        // Hanya klik tepat pada elemen <dialog> yang dihitung sebagai latar.
        // Karena itu <dialog> tidak boleh diberi padding: area padding akan ikut
        // terhitung sebagai latar dan menutup modal secara tak terduga.
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      {item !== null && (
        <div className="modal__panel">
          <button
            ref={closeRef}
            type="button"
            className="modal__close"
            aria-label="Tutup"
            onClick={onClose}
          >
            ✕
          </button>

          <div className="modal__player">
            {item.trailerKey === '' ? (
              <p className="modal__no-trailer">Trailer belum tersedia untuk judul ini.</p>
            ) : (
              <iframe
                className="modal__frame"
                title={`Trailer ${item.title}`}
                src={`https://www.youtube-nocookie.com/embed/${item.trailerKey}?autoplay=1&rel=0&playsinline=1&modestbranding=1`}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>

          <div className="modal__body">
            <h2 className="modal__title">{item.title}</h2>

            {(item.year !== '' || item.rating > 0) && (
              <p className="modal__meta">
                {item.year !== '' && <span>{item.year}</span>}
                {item.rating > 0 && <span>★ {item.rating.toFixed(1)}</span>}
              </p>
            )}

            {item.overview !== '' && <p className="modal__overview">{item.overview}</p>}

            <CtaButton
              // Label sengaja tidak menyebut Shopee. Menyebut nama toko di
              // tombol membuat pengunjung merasa akan dipindahkan ke toko
              // sebelum menonton, sehingga tombolnya jarang diklik.
              label={ctaText ?? 'TONTON FULL'}
              onClick={onWatch ?? noop}
            />

            <p className="modal__attribution">
              This product uses the TMDB API but is not endorsed or certified by TMDB.
            </p>
          </div>
        </div>
      )}
    </dialog>
  );
}
