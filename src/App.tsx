import { useCallback, useEffect, useState } from 'react';
import { CtaButton } from './components/CtaButton';
import { FALLBACK_CONFIG, loadConfig, type SiteConfig } from './lib/config';
import { pickLink } from './lib/links';
import { openAffiliate } from './lib/redirect';

export default function App() {
  // Dimulai dari FALLBACK_CONFIG agar CTA langsung tampil dan dapat diklik
  // sejak frame pertama - tidak pernah ada tombol mati sementara config dimuat.
  const [config, setConfig] = useState<SiteConfig>(FALLBACK_CONFIG);
  const [posterFailed, setPosterFailed] = useState(false);

  useEffect(() => {
    let active = true;

    void loadConfig().then((loaded) => {
      if (active) {
        setConfig(loaded);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const handleClick = useCallback(() => {
    const url = pickLink(config.links, config.rotation);

    if (url) {
      openAffiliate(url);
    }
  }, [config]);

  return (
    <main className="page">
      <div className="poster">
        {!posterFailed && (
          <img
            className="poster__img"
            src={config.poster}
            alt=""
            fetchPriority="high"
            onError={() => setPosterFailed(true)}
          />
        )}
        <div className="poster__scrim" />
      </div>

      <section className="content">
        {config.badges.length > 0 && (
          <ul className="badges">
            {config.badges.map((badge) => (
              <li key={badge} className="badges__item">
                {badge}
              </li>
            ))}
          </ul>
        )}

        <h1 className="headline">{config.headline}</h1>
        <p className="subheadline">{config.subheadline}</p>

        <CtaButton label={config.ctaText} onClick={handleClick} />

        <p className="note">Gratis • Tanpa registrasi</p>
      </section>
    </main>
  );
}
