import { useEffect, useRef } from 'react';
import { CloudLayer, type Cloud } from '../components/CloudLayer';
import { BalloonLayer, type Balloon } from '../components/BalloonLayer';
import { CONTENT } from '../config/content';
import { createScrollParallax } from '../animations/scrollParallax';

// Background clouds - far away, slow
const HERO_CLOUDS_BG: Cloud[] = [
  { id: 'hero-bg-1', x: 5, y: 10, scale: 0.7, size: 'large' },
  { id: 'hero-bg-2', x: 70, y: 60, scale: 0.6, size: 'medium' },
  { id: 'hero-bg-3', x: 85, y: 15, scale: 0.65, size: 'small' },
  { id: 'hero-bg-4', x: 30, y: 75, scale: 0.55, size: 'small' },
];

// Middle clouds - medium speed
const HERO_CLOUDS_MID: Cloud[] = [
  { id: 'hero-md-1', x: 15, y: 30, scale: 0.85, size: 'medium' },
  { id: 'hero-md-2', x: 75, y: 45, scale: 0.9, size: 'medium' },
  { id: 'hero-md-3', x: 50, y: 10, scale: 0.8, size: 'small' },
];

// Foreground clouds - close, fast
const HERO_CLOUDS_FG: Cloud[] = [
  { id: 'hero-fg-1', x: 10, y: 80, scale: 1.1, size: 'large' },
  { id: 'hero-fg-2', x: 80, y: 70, scale: 1.0, size: 'medium' },
];

// Balloons at various depths
const HERO_BALLOONS: Balloon[] = [
  { id: 'hero-b-1', color: 'red', x: 8, y: 25, scale: 0.7, floatDelay: 0 },
  { id: 'hero-b-2', color: 'green', x: 88, y: 35, scale: 0.8, floatDelay: 0.5 },
  { id: 'hero-b-3', color: 'red', x: 12, y: 65, scale: 0.6, floatDelay: 1 },
  { id: 'hero-b-4', color: 'green', x: 90, y: 75, scale: 0.65, floatDelay: 1.5 },
  { id: 'hero-b-5', color: 'red', x: 5, y: 50, scale: 0.55, floatDelay: 0.8 },
];

export function Hero() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const bgClouds = Array.from(
      sectionRef.current.querySelectorAll('.hero-clouds-bg .cloud'),
    ) as HTMLElement[];

    const midClouds = Array.from(
      sectionRef.current.querySelectorAll('.hero-clouds-mid .cloud'),
    ) as HTMLElement[];

    const fgClouds = Array.from(
      sectionRef.current.querySelectorAll('.hero-clouds-fg .cloud'),
    ) as HTMLElement[];

    const balloons = Array.from(
      sectionRef.current.querySelectorAll('.balloon'),
    ) as HTMLElement[];

    const parallax = createScrollParallax({
      trigger: sectionRef.current,
      layers: {
        background: bgClouds,
        middle: midClouds,
        foreground: fgClouds,
        balloons,
      },
    });

    return () => {
      parallax.kill();
    };
  }, []);

  return (
    <section ref={sectionRef} className="hero">
      <CloudLayer depth="background" clouds={HERO_CLOUDS_BG} className="hero-clouds-bg" />
      <CloudLayer depth="middle" clouds={HERO_CLOUDS_MID} className="hero-clouds-mid" />
      <CloudLayer depth="foreground" clouds={HERO_CLOUDS_FG} className="hero-clouds-fg" />

      <div className="hero__content">
        <h1 className="hero__title">{CONTENT.hero.title}</h1>
        <p className="hero__subtitle">{CONTENT.hero.subtitle}</p>
        <p className="hero__description">{CONTENT.hero.description}</p>
        <button className="hero__cta button button--primary">
          {CONTENT.hero.cta}
        </button>
      </div>

      <BalloonLayer balloons={HERO_BALLOONS} />
    </section>
  );
}
