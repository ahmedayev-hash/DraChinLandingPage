import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openAffiliate } from './redirect';

type OpenFn = (url?: string, target?: string, features?: string) => Window | null;

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

    // Argumen ketiga harus undefined. Dengan 'noopener', browser selalu
    // mengembalikan null sehingga deteksi popup-block menjadi mustahil.
    expect(openSpy.mock.calls[0]?.[2]).toBeUndefined();
  });

  it('memakai location.href saat popup diblokir', () => {
    const openSpy = vi.fn(() => null);
    vi.stubGlobal('open', openSpy);

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

    try {
      openAffiliate('https://s.shopee.co.id/fallback');
      expect(hrefSetter).toHaveBeenCalledWith('https://s.shopee.co.id/fallback');
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    }
  });
});
