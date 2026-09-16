import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { preloadImages, useImagePreloader } from './useImagePreloader';

interface FakeImage {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
}

const created: FakeImage[] = [];

/** Mengganti Image global dengan tiruan yang dapat dipicu manual. */
function stubImage(): void {
  created.length = 0;
  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = '';

      constructor() {
        created.push(this as unknown as FakeImage);
      }
    },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('preloadImages', () => {
  it('selesai hanya setelah semua gambar memanggil onload', async () => {
    stubImage();

    let done = false;
    void preloadImages(['a.jpg', 'b.jpg']).then(() => {
      done = true;
    });

    created[0]?.onload?.();
    await Promise.resolve();
    expect(done).toBe(false);

    created[1]?.onload?.();
    await waitFor(() => {
      expect(done).toBe(true);
    });
  });

  it('menghitung gambar yang gagal sebagai selesai', async () => {
    stubImage();

    let done = false;
    void preloadImages(['a.jpg']).then(() => {
      done = true;
    });

    created[0]?.onerror?.();
    await waitFor(() => {
      expect(done).toBe(true);
    });
  });

  it('selesai segera untuk daftar kosong tanpa membuat gambar', async () => {
    stubImage();

    await preloadImages([]);

    expect(created).toHaveLength(0);
  });

  it('selesai setelah batas waktu walau gambar tidak pernah menjawab', async () => {
    stubImage();
    vi.useFakeTimers();

    let done = false;
    void preloadImages(['a.jpg'], { timeoutMs: 5000 }).then(() => {
      done = true;
    });

    await vi.advanceTimersByTimeAsync(5000);
    expect(done).toBe(true);
  });

  it('memasang src pada setiap gambar', async () => {
    stubImage();

    void preloadImages(['a.jpg', 'b.jpg']);
    await Promise.resolve();

    expect(created.map((image) => image.src)).toEqual(['a.jpg', 'b.jpg']);
  });
});

describe('useImagePreloader', () => {
  it('mulai dari memuat lalu berubah menjadi selesai', async () => {
    stubImage();

    const { result } = renderHook(() => useImagePreloader(['a.jpg']));
    expect(result.current).toBe(true);

    created[0]?.onload?.();
    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it('tidak memuat apa pun bila daftar kosong', async () => {
    stubImage();

    const { result } = renderHook(() => useImagePreloader([]));

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
    expect(created).toHaveLength(0);
  });
});
