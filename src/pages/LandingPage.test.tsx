import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FALLBACK_CONFIG } from '../lib/config';
import { openAffiliate, tryOpenNewTab } from '../lib/redirect';
import { LandingPage } from './LandingPage';

vi.mock('../lib/redirect', () => ({
  openAffiliate: vi.fn(),
  tryOpenNewTab: vi.fn(() => true),
}));

/**
 * Membungkus LandingPage dengan prop wajib.
 *
 * configReady=true adalah kondisi normal pengunjung (config.json sudah dibaca).
 * Tes yang menguji perilaku sebelum config siap memberi nilai eksplisit.
 */
function renderLanding(
  props: Partial<Parameters<typeof LandingPage>[0]> = {},
): ReturnType<typeof render> {
  return render(
    <LandingPage
      config={FALLBACK_CONFIG}
      configReady
      onEnterCatalog={() => undefined}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.mocked(tryOpenNewTab).mockClear();
  vi.mocked(tryOpenNewTab).mockReturnValue(true);
  vi.mocked(openAffiliate).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LandingPage', () => {
  it('menampilkan headline dan badge dari config', () => {
    renderLanding();

    expect(
      screen.getByRole('heading', { name: FALLBACK_CONFIG.headline }),
    ).toBeInTheDocument();

    for (const badge of FALLBACK_CONFIG.badges) {
      expect(screen.getByText(badge)).toBeInTheDocument();
    }
  });

  it('mencoba membuka affiliate tepat sekali saat landing tampil', () => {
    renderLanding();

    expect(tryOpenNewTab).toHaveBeenCalledTimes(1);
    expect(FALLBACK_CONFIG.links).toContain(vi.mocked(tryOpenNewTab).mock.calls[0]?.[0]);
  });

  it('tidak mencoba apa pun sebelum config selesai dimuat', () => {
    renderLanding({ configReady: false });

    expect(tryOpenNewTab).not.toHaveBeenCalled();
  });

  it('tidak mencoba membuka bila tidak ada link', () => {
    renderLanding({ config: { ...FALLBACK_CONFIG, links: [] } });

    expect(tryOpenNewTab).not.toHaveBeenCalled();
  });

  it('tidak menggandakan percobaan walau StrictMode memanggil efek dua kali', () => {
    render(
      <StrictMode>
        <LandingPage
          config={FALLBACK_CONFIG}
          configReady
          onEnterCatalog={() => undefined}
        />
      </StrictMode>,
    );

    expect(tryOpenNewTab).toHaveBeenCalledTimes(1);
  });

  it('mencoba lagi pada klik pertama bila percobaan awal gagal', async () => {
    vi.mocked(tryOpenNewTab).mockReturnValue(false);
    const user = userEvent.setup();

    renderLanding({ autoEnterSeconds: 30 });

    expect(tryOpenNewTab).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText(/gratis/i));

    expect(tryOpenNewTab).toHaveBeenCalledTimes(2);
  });

  it('berhenti mencoba setelah tab baru berhasil dibuka', async () => {
    const user = userEvent.setup();

    renderLanding({ autoEnterSeconds: 30 });

    // Percobaan awal (L1) berhasil, jadi klik berikutnya tidak mencoba lagi.
    await user.click(screen.getByText(/gratis/i));
    await user.click(screen.getByRole('button', { name: /lihat katalog/i }));

    expect(tryOpenNewTab).toHaveBeenCalledTimes(1);
    expect(openAffiliate).not.toHaveBeenCalled();
  });

  it('memaksa link lewat openAffiliate saat tombol katalog dan popup diblokir', async () => {
    vi.mocked(tryOpenNewTab).mockReturnValue(false);
    const onEnterCatalog = vi.fn();
    const user = userEvent.setup();

    renderLanding({ onEnterCatalog, autoEnterSeconds: 30 });

    await user.click(screen.getByRole('button', { name: /lihat katalog/i }));

    // Klik pertama sudah dicoba lewat penangkap L2; tombol lalu jatuh ke L3/L4.
    expect(openAffiliate).toHaveBeenCalledTimes(1);
    expect(FALLBACK_CONFIG.links).toContain(vi.mocked(openAffiliate).mock.calls[0]?.[0]);
    // Katalog tidak pernah dibuka: klik tidak boleh hilang, tapi bukan berarti
    // pengunjung dipindahkan ke katalog.
    expect(onEnterCatalog).not.toHaveBeenCalled();
  });

  it('memakai tombol katalog semula bila tidak ada link sama sekali', async () => {
    const onEnterCatalog = vi.fn();
    const user = userEvent.setup();

    renderLanding({
      config: { ...FALLBACK_CONFIG, links: [] },
      onEnterCatalog,
      autoEnterSeconds: 30,
    });

    await user.click(screen.getByRole('button', { name: /lihat katalog/i }));

    expect(onEnterCatalog).toHaveBeenCalledOnce();
    expect(openAffiliate).not.toHaveBeenCalled();
  });

  it('mematikan seluruh tangga saat autoOpen bernilai false', async () => {
    const onEnterCatalog = vi.fn();
    const user = userEvent.setup();

    renderLanding({
      config: { ...FALLBACK_CONFIG, autoOpen: false },
      onEnterCatalog,
      autoEnterSeconds: 30,
    });

    // Baik percobaan otomatis (L1) maupun penangkap klik pertama (L2) diam.
    expect(tryOpenNewTab).not.toHaveBeenCalled();

    await user.click(screen.getByText(/gratis/i));
    expect(tryOpenNewTab).not.toHaveBeenCalled();
    expect(openAffiliate).not.toHaveBeenCalled();

    // Tombol katalog kembali berfungsi sebagai navigasi biasa.
    await user.click(screen.getByRole('button', { name: /lihat katalog/i }));
    expect(onEnterCatalog).toHaveBeenCalledOnce();
    expect(openAffiliate).not.toHaveBeenCalled();
  });

  it('masuk katalog otomatis setelah hitungan mundur selesai', async () => {
    vi.useFakeTimers();
    const onEnterCatalog = vi.fn();

    renderLanding({ onEnterCatalog, autoEnterSeconds: 8 });

    await vi.advanceTimersByTimeAsync(8000);

    expect(onEnterCatalog).toHaveBeenCalledOnce();
  });

  it('menampilkan hitungan mundur yang dapat dibatalkan', async () => {
    const onEnterCatalog = vi.fn();
    const user = userEvent.setup();

    renderLanding({ onEnterCatalog, autoEnterSeconds: 0.05 });

    await user.click(screen.getByRole('button', { name: /batalkan/i }));
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(onEnterCatalog).not.toHaveBeenCalled();
  });

  it('menyembunyikan hitungan mundur setelah dibatalkan', async () => {
    renderLanding({ autoEnterSeconds: 30 });

    await userEvent.click(screen.getByRole('button', { name: /batalkan/i }));

    expect(screen.queryByText(/masuk katalog otomatis/i)).not.toBeInTheDocument();
  });

  it('tidak masuk otomatis setelah komponen dilepas', async () => {
    vi.useFakeTimers();
    const onEnterCatalog = vi.fn();

    const { unmount } = renderLanding({ onEnterCatalog, autoEnterSeconds: 8 });

    unmount();
    await vi.advanceTimersByTimeAsync(20_000);

    expect(onEnterCatalog).not.toHaveBeenCalled();
  });

  it('memakai latar gradien saat poster gagal dimuat', async () => {
    renderLanding();

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

    renderLanding({ onEnterCatalog, autoEnterSeconds: 0 });

    await vi.advanceTimersByTimeAsync(30_000);

    expect(onEnterCatalog).not.toHaveBeenCalled();
  });

  it('menampilkan atribusi TMDB tanpa kerangka header atau footer', () => {
    renderLanding();

    expect(screen.getByText(/TMDB/)).toBeInTheDocument();
    // Landing page sengaja tidak memakai header/footer situs.
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });
});
