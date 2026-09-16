import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pickLink } from './links';

const LINKS = ['https://a.example', 'https://b.example', 'https://c.example'];

function makeStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

describe('pickLink', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = makeStorage();
  });

  it('merotasi link secara berurutan', () => {
    expect(pickLink(LINKS, 'sequence', storage)).toBe('https://a.example');
    expect(pickLink(LINKS, 'sequence', storage)).toBe('https://b.example');
    expect(pickLink(LINKS, 'sequence', storage)).toBe('https://c.example');
    expect(pickLink(LINKS, 'sequence', storage)).toBe('https://a.example');
  });

  it('menyimpan indeks di storage antar pemanggilan', () => {
    const reused = makeStorage();
    expect(pickLink(LINKS, 'sequence', reused)).toBe('https://a.example');
    expect(pickLink(LINKS, 'sequence', reused)).toBe('https://b.example');
    expect(reused.getItem('dracin.rotationIndex')).toBe('2');
  });

  it('selalu mengembalikan elemen valid pada mode random', () => {
    for (let i = 0; i < 40; i += 1) {
      expect(LINKS).toContain(pickLink(LINKS, 'random', storage));
    }
  });

  it('tidak crash saat storage melempar error', () => {
    const broken = {
      getItem: vi.fn(() => {
        throw new Error('storage diblokir');
      }),
      setItem: vi.fn(() => {
        throw new Error('storage diblokir');
      }),
    } as unknown as Storage;

    expect(() => pickLink(LINKS, 'sequence', broken)).not.toThrow();
    expect(LINKS).toContain(pickLink(LINKS, 'sequence', broken));
  });

  it('mengembalikan string kosong bila daftar link kosong', () => {
    expect(pickLink([], 'sequence', storage)).toBe('');
  });

  it('mengembalikan satu-satunya link tanpa menyentuh storage', () => {
    const spy = makeStorage();
    const setItem = vi.spyOn(spy, 'setItem');

    expect(pickLink(['https://only.example'], 'sequence', spy)).toBe(
      'https://only.example',
    );
    expect(setItem).not.toHaveBeenCalled();
  });
});
