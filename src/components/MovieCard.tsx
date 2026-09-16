import { useState } from 'react';
import type { CatalogItem } from '../../tools/catalog/types';

interface MovieCardProps {
  item: CatalogItem;
  onSelect: (id: string) => void;
}

/**
 * Satu kartu drama.
 *
 * Memakai <button> asli agar dapat dijangkau papan ketik dan memiliki
 * accessible name dari teks di dalamnya.
 */
export function MovieCard({ item, onSelect }: MovieCardProps) {
  const [failed, setFailed] = useState(false);
  const showImage = item.poster !== '' && !failed;

  return (
    <button
      type="button"
      className="card"
      onClick={() => {
        onSelect(item.id);
      }}
    >
      <span className="card__poster">
        {showImage && (
          <img
            className="card__img"
            src={item.poster}
            alt=""
            loading="lazy"
            onError={() => {
              setFailed(true);
            }}
          />
        )}

        {item.trailerKey !== '' && (
          <span className="card__play" aria-hidden="true">
            ▶
          </span>
        )}
      </span>

      <span className="card__title">{item.title}</span>

      {(item.year !== '' || item.rating > 0) && (
        <span className="card__meta">
          {item.year !== '' && <span>{item.year}</span>}
          {item.rating > 0 && <span>★ {item.rating.toFixed(1)}</span>}
        </span>
      )}
    </button>
  );
}
