import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FALLBACK_CONFIG } from '../lib/config';
import { LandingPage } from './LandingPage';

afterEach(() => {
  vi.useRealTimers();
});

describe('LandingPage', () => {
  it('menampilkan headline dan badge dari config', () => {
    render(<LandingPage config={FALLBACK_CONFIG} onEnterCatalog={() => undefined} />);

    expect(
      screen.getByRole('heading', { name: FALLBACK_CONFIG.headline }),
    ).toBeInTheDocument();

    for (const badge of FALLBACK_CONFIG.badges) {
      expect(screen.getByText(badge)).toBeInTheDocument();
    }
  });

  it('tombol utama masuk ke katalog', async () => {
    const onEnterCatalog = vi.fn();
    render(<LandingPage config={FALLBACK_CONFIG} onEnterCatalog={onEnterCatalog} />);

    await userEvent.click(screen.getByRole('button', { name: /lihat katalog/i }));

    expect(onEnterCatalog).toHaveBeenCalledOnce();
  });

  it('masuk katalog otomatis setelah hitungan mundur selesai', async () => {
    vi.useFakeTimers();
    const onEnterCatalog = vi.fn();

    render(
      <LandingPage
        config={FALLBACK_CONFIG}
        onEnterCatalog={onEnterCatalog}
        autoEnterSeconds={8}
      />,
    );

    await vi.advanceTimersByTimeAsync(8000);

    expect(onEnterCatalog).toHaveBeenCalledOnce();
  });

  it('menampilkan hitungan mundur yang dapat dibatalkan', async () => {
    const onEnterCatalog = vi.fn();
    const user = userEvent.setup();

    render(
      <LandingPage
        config={FALLBACK_CONFIG}
        onEnterCatalog={onEnterCatalog}
        autoEnterSeconds={0.05}
      />,
    );

    await user.click(screen.getByRole('button', { name: /batalkan/i }));
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(onEnterCatalog).not.toHaveBeenCalled();
  });

  it('menyembunyikan hitungan mundur setelah dibatalkan', async () => {
    render(
      <LandingPage
        config={FALLBACK_CONFIG}
        onEnterCatalog={() => undefined}
        autoEnterSeconds={30}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /batalkan/i }));

    expect(screen.queryByText(/masuk katalog otomatis/i)).not.toBeInTheDocument();
  });

  it('tidak masuk otomatis setelah komponen dilepas', async () => {
    vi.useFakeTimers();
    const onEnterCatalog = vi.fn();

    const { unmount } = render(
      <LandingPage
        config={FALLBACK_CONFIG}
        onEnterCatalog={onEnterCatalog}
        autoEnterSeconds={8}
      />,
    );

    unmount();
    await vi.advanceTimersByTimeAsync(20_000);

    expect(onEnterCatalog).not.toHaveBeenCalled();
  });

  it('memakai latar gradien saat poster gagal dimuat', async () => {
    render(<LandingPage config={FALLBACK_CONFIG} onEnterCatalog={() => undefined} />);

    const poster = document.querySelector('.poster__img');
    expect(poster).not.toBeNull();

    poster?.dispatchEvent(new Event('error'));

    // Harus ditunggu: perubahan state di dalam penangan error diproses React
    // secara asinkron, jadi pemeriksaan langsung akan selalu gagal.
    await waitFor(() => {
      expect(document.querySelector('.poster__img')).toBeNull();
    });
  });

  it('tidak menghitung mundur bila autoEnterSeconds bernilai 0', async () => {
    vi.useFakeTimers();
    const onEnterCatalog = vi.fn();

    render(
      <LandingPage
        config={FALLBACK_CONFIG}
        onEnterCatalog={onEnterCatalog}
        autoEnterSeconds={0}
      />,
    );

    await vi.advanceTimersByTimeAsync(30_000);

    expect(onEnterCatalog).not.toHaveBeenCalled();
  });

  it('menampilkan atribusi TMDB tanpa kerangka header atau footer', () => {
    render(<LandingPage config={FALLBACK_CONFIG} onEnterCatalog={() => undefined} />);

    expect(screen.getByText(/TMDB/)).toBeInTheDocument();
    // Landing page sengaja tidak memakai header/footer situs.
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });
});
