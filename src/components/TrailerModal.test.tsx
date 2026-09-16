import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../tools/catalog/types';
import { TrailerModal } from './TrailerModal';

const item: CatalogItem = {
  id: '123',
  title: 'Judul Drama',
  overview: 'Sinopsis drama.',
  year: '2022',
  rating: 8.4,
  poster: './posters/123.jpg',
  trailerKey: 'abcdefghijk',
};

const noop = () => undefined;

describe('TrailerModal', () => {
  it('tidak merender iframe saat tidak ada item', () => {
    render(<TrailerModal item={null} onClose={noop} />);

    expect(document.querySelector('iframe')).toBeNull();
  });

  it('merender iframe YouTube begitu modal dibuka', () => {
    render(<TrailerModal item={item} onClose={noop} />);

    const src = document.querySelector('iframe')?.getAttribute('src') ?? '';
    expect(src).toContain('youtube-nocookie.com/embed/abcdefghijk');
  });

  it('menyalakan autoplay dan membatasi video rekomendasi', () => {
    render(<TrailerModal item={item} onClose={noop} />);

    const src = document.querySelector('iframe')?.getAttribute('src') ?? '';
    expect(src).toContain('autoplay=1');
    expect(src).toContain('rel=0');
  });

  it('memberi izin autoplay pada atribut allow iframe', () => {
    render(<TrailerModal item={item} onClose={noop} />);

    const allow = document.querySelector('iframe')?.getAttribute('allow') ?? '';
    expect(allow).toContain('autoplay');
  });

  it('tidak merender iframe bila trailerKey kosong', () => {
    render(<TrailerModal item={{ ...item, trailerKey: '' }} onClose={noop} />);

    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByText(/trailer belum tersedia/i)).toBeInTheDocument();
  });

  it('menampilkan judul, tahun, rating, dan sinopsis', () => {
    render(<TrailerModal item={item} onClose={noop} />);

    expect(screen.getByRole('heading', { name: 'Judul Drama' })).toBeInTheDocument();
    expect(screen.getByText('2022')).toBeInTheDocument();
    expect(screen.getByText(/8\.4/)).toBeInTheDocument();
    expect(screen.getByText('Sinopsis drama.')).toBeInTheDocument();
  });

  it('selalu menampilkan tombol Shopee', () => {
    render(<TrailerModal item={item} onClose={noop} />);

    expect(screen.getByRole('button', { name: /tonton full/i })).toBeInTheDocument();
  });

  it('memanggil onClose saat tombol tutup diklik', async () => {
    const onClose = vi.fn();
    render(<TrailerModal item={item} onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: /tutup/i }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('membuang iframe dari DOM saat item menjadi null', () => {
    const { rerender } = render(<TrailerModal item={item} onClose={noop} />);
    expect(document.querySelector('iframe')).not.toBeNull();

    rerender(<TrailerModal item={null} onClose={noop} />);

    expect(document.querySelector('iframe')).toBeNull();
  });

  it('memanggil onWatch saat tombol Shopee diklik', async () => {
    const onWatch = vi.fn();
    render(<TrailerModal item={item} onClose={noop} onWatch={onWatch} />);

    await userEvent.click(screen.getByRole('button', { name: /tonton full/i }));

    expect(onWatch).toHaveBeenCalledOnce();
  });
});
