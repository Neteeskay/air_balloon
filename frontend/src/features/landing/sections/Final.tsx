import { useEffect, useRef } from 'react';
import { BalloonLayer, type Balloon } from '../components/BalloonLayer';
import { CloudLayer, type Cloud } from '../components/CloudLayer';
import { CONTENT } from '../config/content';
import { createScrollParallax } from '../animations/scrollParallax';

// Background clouds
const FINAL_CLOUDS_BG: Cloud[] = [
  { id: 'final-bg-1', x: 12, y: 22, scale: 0.5, cloudNum: 14 },
  { id: 'final-bg-2', x: 78, y: 58, scale: 0.48, cloudNum: 15 },
  { id: 'final-bg-3', x: 88, y: 30, scale: 0.45, cloudNum: 16 },
];

// Middle clouds
const FINAL_CLOUDS_MID: Cloud[] = [
  { id: 'final-md-1', x: 38, y: 38, scale: 0.75, cloudNum: 10 },
  { id: 'final-md-2', x: 82, y: 18, scale: 0.72, cloudNum: 11 },
  { id: 'final-md-3', x: 20, y: 65, scale: 0.7, cloudNum: 12 },
];

// Balloons forming final composition
const FINAL_BALLOONS: Balloon[] = [
  {
    id: 'final-b-1',
    color: 'green',
    x: 18,
    y: 28,
    scale: 0.75,
    floatDelay: 0,
    pathConfig: { xOffset: 20, yOffset: 18, rotation: 4 }
  },
  {
    id: 'final-b-2',
    color: 'red',
    x: 43,
    y: 18,
    scale: 0.85,
    floatDelay: 0.5,
    pathConfig: { xOffset: -22, yOffset: 20, rotation: -5 }
  },
  {
    id: 'final-b-3',
    color: 'green',
    x: 72,
    y: 32,
    scale: 0.7,
    floatDelay: 1,
    pathConfig: { xOffset: 18, yOffset: 17, rotation: 3 }
  },
  {
    id: 'final-b-4',
    color: 'red',
    x: 28,
    y: 62,
    scale: 0.62,
    floatDelay: 1.5,
    pathConfig: { xOffset: -15, yOffset: 16, rotation: -3 }
  },
  {
    id: 'final-b-5',
    color: 'green',
    x: 67,
    y: 68,
    scale: 0.65,
    floatDelay: 2,
    pathConfig: { xOffset: 17, yOffset: 19, rotation: 4 }
  },
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
