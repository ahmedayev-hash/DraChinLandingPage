import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openAffiliate, tryOpenNewTab } from './redirect';

type OpenFn = (url?: string, target?: string, features?: string) => Window | null;

/** Mengganti window.location dengan objek yang merekam penulisan href. */
function stubLocation(): {
  hrefSetter: ReturnType<typeof vi.fn>;
  restore: () => void;
} {
  const hrefSetter = vi.fn();
  const originalLocation = window.location;

  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...originalLocation,
      set href(value: string) {
        hrefSetter(value);
      },
      get href() {
        return '';
      },
    },
  });

  return {
    hrefSetter,
    restore: () => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    },
  };
}

describe('tryOpenNewTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mengembalikan true dan menonaktifkan opener saat popup berhasil', () => {
    const fakeWindow = { opener: {} as Window } as unknown as Window;
    vi.stubGlobal(
      'open',
      vi.fn<OpenFn>(() => fakeWindow),
    );

    expect(tryOpenNewTab('https://s.shopee.co.id/abc')).toBe(true);
    expect(fakeWindow.opener).toBeNull();
  });

  it('mengembalikan false saat popup diblokir', () => {
    vi.stubGlobal(
      'open',
      vi.fn<OpenFn>(() => null),
    );

    expect(tryOpenNewTab('https://s.shopee.co.id/abc')).toBe(false);
  });

  it('tidak pernah menyentuh location, bahkan saat popup diblokir', () => {
    vi.stubGlobal(
      'open',
      vi.fn<OpenFn>(() => null),
    );
    const { hrefSetter, restore } = stubLocation();

    try {
      tryOpenNewTab('https://s.shopee.co.id/abc');
      expect(hrefSetter).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('tidak memakai noopener sebagai string fitur', () => {
    const openSpy = vi.fn<OpenFn>(() => null);
    vi.stubGlobal('open', openSpy);

    tryOpenNewTab('https://s.shopee.co.id/abc');

    // Argumen ketiga harus undefined. Dengan 'noopener', browser selalu
    // mengembalikan null sehingga deteksi popup-block menjadi mustahil.
    expect(openSpy.mock.calls[0]?.[2]).toBeUndefined();
  });

  it('tidak melempar saat window.open melempar', () => {
    vi.stubGlobal(
      'open',
      vi.fn<OpenFn>(() => {
        throw new Error('diblokir keras');
      }),
    );

    expect(() => tryOpenNewTab('https://s.shopee.co.id/abc')).not.toThrow();
    expect(tryOpenNewTab('https://s.shopee.co.id/abc')).toBe(false);
  });
});

describe('openAffiliate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('membuka tab baru dan menonaktifkan opener saat popup berhasil', () => {
    const fakeWindow = { opener: {} as Window } as unknown as Window;
    const openSpy = vi.fn<OpenFn>(() => fakeWindow);
    vi.stubGlobal('open', openSpy);

    openAffiliate('https://s.shopee.co.id/abc');

    expect(openSpy).toHaveBeenCalledWith('https://s.shopee.co.id/abc', '_blank');
    expect(fakeWindow.opener).toBeNull();
  });

  it('tidak memakai noopener sebagai string fitur', () => {
    const openSpy = vi.fn<OpenFn>(() => null);
    vi.stubGlobal('open', openSpy);

    openAffiliate('https://s.shopee.co.id/abc');

    expect(openSpy.mock.calls[0]?.[2]).toBeUndefined();
  });

  it('memakai location.href saat popup diblokir', () => {
    vi.stubGlobal(
      'open',
      vi.fn<OpenFn>(() => null),
    );
    const { hrefSetter, restore } = stubLocation();

    try {
      openAffiliate('https://s.shopee.co.id/fallback');
      expect(hrefSetter).toHaveBeenCalledWith('https://s.shopee.co.id/fallback');
    } finally {
      restore();
    }
  });
});
