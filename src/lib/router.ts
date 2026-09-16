/**
 * Rute yang dikenali.
 *
 * Katalog dan modal berbagi rute yang sama: modal hanyalah lapisan di atas
 * katalog, sehingga halaman di belakangnya tidak pernah berubah.
 */
export interface Route {
  name: 'landing' | 'catalog';
  detailId?: string;
}

export const catalogHash = '#/katalog';

export function detailHash(id: string): string {
  return `#/drama/${encodeURIComponent(id)}`;
}

/** Mengubah hash menjadi rute. Hash yang tidak dikenali menjadi landing. */
export function parseRoute(hash: string): Route {
  if (typeof hash !== 'string') {
    return { name: 'landing' };
  }

  // Garis miring di akhir dibuang supaya #/katalog/ dan #/katalog sama.
  const clean = hash.replace(/^#/, '').replace(/\/+$/, '');

  if (clean === '' || clean === '/') {
    return { name: 'landing' };
  }

  if (clean === '/katalog') {
    return { name: 'catalog' };
  }

  const detail = /^\/drama\/([^/]+)$/.exec(clean);
  if (detail?.[1] !== undefined) {
    let id = detail[1];

    try {
      id = decodeURIComponent(id);
    } catch {
      // Hash yang berisi persen encoding rusak diperlakukan apa adanya.
    }

    if (id.trim() !== '') {
      return { name: 'catalog', detailId: id.trim() };
    }
  }

  return { name: 'landing' };
}

/** Mengubah rute menjadi hash. Kebalikan dari parseRoute. */
export function buildHash(route: Route): string {
  if (route.name === 'landing') {
    return '#/';
  }

  return route.detailId === undefined ? catalogHash : detailHash(route.detailId);
}
