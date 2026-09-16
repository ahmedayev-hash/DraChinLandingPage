interface CtaButtonProps {
  label: string;
  onClick: () => void;
}

/**
 * Tombol ajakan utama.
 *
 * Memakai elemen <button> asli, bukan <div onclick>, agar dapat dijangkau
 * keyboard dan memiliki accessible name dari teks labelnya.
 */
export function CtaButton({ label, onClick }: CtaButtonProps) {
  return (
    <button type="button" className="cta" onClick={onClick}>
      <span className="cta__label">{label}</span>
      <span className="cta__icon" aria-hidden="true">
        ▶
      </span>
    </button>
  );
}
