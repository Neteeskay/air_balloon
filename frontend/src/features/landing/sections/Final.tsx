import { useEffect, useRef } from 'react';
import { BalloonLayer, type Balloon } from '../components/BalloonLayer';
import { CloudLayer, type Cloud } from '../components/CloudLayer';
import { CONTENT } from '../config/content';
import { createScrollParallax } from '../animations/scrollParallax';

// Background clouds
const FINAL_CLOUDS_BG: Cloud[] = [
  { id: 'final-bg-1', x: 10, y: 20, scale: 0.6, size: 'medium' },
  { id: 'final-bg-2', x: 75, y: 55, scale: 0.7, size: 'small' },
];

// Middle clouds
const FINAL_CLOUDS_MID: Cloud[] = [
  { id: 'final-md-1', x: 40, y: 35, scale: 0.85, size: 'medium' },
  { id: 'final-md-2', x: 80, y: 15, scale: 0.8, size: 'small' },
];

// Balloons forming a composition
const FINAL_BALLOONS: Balloon[] = [
  { id: 'final-b-1', color: 'green', x: 20, y: 25, scale: 0.85, floatDelay: 0 },
  { id: 'final-b-2', color: 'red', x: 45, y: 15, scale: 0.95, floatDelay: 0.3 },
  { id: 'final-b-3', color: 'green', x: 70, y: 30, scale: 0.8, floatDelay: 0.6 },
  { id: 'final-b-4', color: 'red', x: 30, y: 60, scale: 0.7, floatDelay: 0.9 },
  { id: 'final-b-5', color: 'green', x: 65, y: 65, scale: 0.75, floatDelay: 1.2 },
];

export function Final() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const bgClouds = Array.from(
      sectionRef.current.querySelectorAll('.final-clouds-bg .cloud'),
    ) as HTMLElement[];

    const midClouds = Array.from(
      sectionRef.current.querySelectorAll('.final-clouds-mid .cloud'),
    ) as HTMLElement[];

    const balloons = Array.from(
      sectionRef.current.querySelectorAll('.balloon'),
    ) as HTMLElement[];

    const parallax = createScrollParallax({
      trigger: sectionRef.current,
      layers: {
        background: bgClouds,
        middle: midClouds,
        balloons,
      },
    });

    return () => {
      parallax.kill();
    };
  }, []);

  return (
    <section ref={sectionRef} className="final">
      <CloudLayer depth="background" clouds={FINAL_CLOUDS_BG} className="final-clouds-bg" />
      <CloudLayer depth="middle" clouds={FINAL_CLOUDS_MID} className="final-clouds-mid" />

      <BalloonLayer balloons={FINAL_BALLOONS} />

      <div className="final__content">
        <h2 className="final__title">{CONTENT.final.title}</h2>
        <p className="final__subtitle">{CONTENT.final.subtitle}</p>
        <button className="final__cta button button--primary">
          {CONTENT.final.cta}
        </button>

        <footer className="final__footer">
          <p>© 2026 Воздушный Шар. Все права защищены.</p>
        </footer>
      </div>
    </section>
  );
}
