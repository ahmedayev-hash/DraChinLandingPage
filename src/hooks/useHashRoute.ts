import { useEffect, useState } from 'react';

/** Hash saat ini. Ikut berubah saat pengunjung menekan tombol kembali. */
export function useHashRoute(): string {
  const [hash, setHash] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.hash,
  );

  useEffect(() => {
    const onChange = (): void => {
      setHash(window.location.hash);
    };

    window.addEventListener('hashchange', onChange);

    return () => {
      window.removeEventListener('hashchange', onChange);
    };
  }, []);

  return hash;
}
