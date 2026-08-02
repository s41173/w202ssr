'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useSliderWebsite } from '@/lib/hooks/useSliderWebsite';

interface SplashScreenProps {
  children: React.ReactNode;
}

export default function SplashScreen({ children }: SplashScreenProps) {
  const { data, isLoading } = useSliderWebsite();
  const [loading, setLoading] = useState(true);

  const slides = data?.content?.result?.filter((item) => item.splash === '1') ?? [];
  const slide = slides[0];

  useEffect(() => {
    if (isLoading) return;

    if (slides.length === 0) {
      setLoading(false);
      return;
    }

    const alreadyShown = sessionStorage.getItem('splashShown');
    if (alreadyShown) {
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      closeSplash();
    }, 5000);

    return () => clearTimeout(timer);
  }, [isLoading, slides.length]);

  const closeSplash = () => {
    setLoading(false);
    sessionStorage.setItem('splashShown', 'true');
  };

  if (isLoading || !slide) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        className={`splash-screen ${loading ? 'splash-visible' : 'splash-hidden'}`}
        onClick={closeSplash}
      >
        <div className="splash-frame" onClick={(e) => e.stopPropagation()}>
          <button
            className="splash-close-btn"
            onClick={closeSplash}
            aria-label="Tutup"
          >
            &times;
          </button>
          {slide.url && slide.url !== '#' ? (
            <a href={slide.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <div className="splash-logo-wrapper">
                <Image src={slide.image} alt={slide.name} fill priority />
              </div>
            </a>
          ) : (
            <div className="splash-logo-wrapper">
              <Image src={slide.image} alt={slide.name} fill priority />
            </div>
          )}
          <p className="splash-caption">{slide.name}</p>
        </div>
      </div>
      {children}
    </>
  );
}