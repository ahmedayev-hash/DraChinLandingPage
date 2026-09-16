export type Rotation = 'sequence' | 'random';

const STORAGE_KEY = 'dracin.rotationIndex';

function resolveStorage(storage: Storage | null | undefined): Storage | null {
  if (storage !== undefined) {
    return storage;
  }

  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Mengakses localStorage dapat melempar di sebagian webview dengan mode
    // private. Kegagalan di sini tidak boleh merusak alur klik.
    return null;
  }
}

function safeGet(storage: Storage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage: Storage | null, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // Sengaja diabaikan: lihat resolveStorage.
  }
}

function pickRandom(links: string[]): string {
  return links[Math.floor(Math.random() * links.length)] ?? '';
}

/**
 * Memilih satu link dari daftar.
 *
 * Mode 'sequence' merotasi link secara berurutan dan menyimpan posisinya di
 * storage, sehingga kunjungan berurutan membuka link berbeda - berguna untuk
 * A/B test dua link Shopee. Bila storage tidak dapat dipakai, rotasi turun ke
 * pemilihan acak agar link tetap terdistribusi, bukan selalu link pertama.
 */
export function pickLink(
  links: string[],
  rotation: Rotation,
  storage?: Storage | null,
): string {
  if (links.length === 0) {
    return '';
  }

  if (links.length === 1) {
    return links[0] ?? '';
  }

  const store = resolveStorage(storage);

  if (rotation === 'random') {
    return pickRandom(links);
  }

  if (store === null) {
    return pickRandom(links);
  }

  const stored = safeGet(store, STORAGE_KEY);
  const parsed = stored === null ? Number.NaN : Number.parseInt(stored, 10);
  const index = Number.isFinite(parsed) && parsed >= 0 ? parsed % links.length : 0;

  safeSet(store, STORAGE_KEY, String((index + 1) % links.length));

  return links[index] ?? '';
}
