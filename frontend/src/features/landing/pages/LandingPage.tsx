import { useEffect, useRef } from 'react';
import { BalloonLayer, type Balloon } from '../components/BalloonLayer';
import { CONTENT } from '../config/content';
import { gsap } from '../animations/gsapSetup';
import { CLOUD_DEPTH, type CloudDepth } from '../animations/cloudDepth';
import { SPRITES } from '../config/sprites';
import '../styles/landing.css';

// ============================================
// Types
// ============================================

interface CloudConfig {
  id: string;
  x: number;
  y: number;
  scale: number;
  cloudNum: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;
  delay: number;
}

// ============================================
// INTRO CLOUDS — appear on first screen
// Left side, right side, top
// ============================================

const INTRO_CLOUDS: CloudConfig[] = [
  { id: 'in-1', x: -12.9, y: 4.5, scale: 1, cloudNum: 1, delay: 0 },
  { id: 'in-2', x: 31.1, y: -2, scale: 1, cloudNum: 2, delay: 0 },
  { id: 'in-3', x: -10.3, y: -2.7, scale: 1, cloudNum: 3, delay: 0 },
  { id: 'in-4', x: 72.9, y: 1.4, scale: 1, cloudNum: 9, delay: 0 },
  { id: 'in-5', x: -11.8, y: 23.8, scale: 1, cloudNum: 6, delay: 0 },
  { id: 'in-6', x: 80.3, y: 14.9, scale: 1, cloudNum: 5, delay: 0 },
  { id: 'in-7', x: -4.9, y: 44.4, scale: 1, cloudNum: 7, delay: 0 },
  { id: 'in-8', x: -13.5, y: 31.4, scale: 1, cloudNum: 10, delay: 0 },
  { id: 'in-9', x: -6.7, y: 17.9, scale: 1, cloudNum: 14, delay: 0 },
  { id: 'in-10', x: 74.6, y: 22.9, scale: 1, cloudNum: 13, delay: 0 },
  { id: 'in-11', x: 72.1, y: 9.2, scale: 1, cloudNum: 10, delay: 0 },
  { id: 'in-12', x: -11, y: 62.6, scale: 1, cloudNum: 10, delay: 0 },
  { id: 'in-13', x: 68.7, y: 67.9, scale: 1, cloudNum: 10, delay: 0 },
  { id: 'in-14', x: 78.2, y: 97.3, scale: 1, cloudNum: 6, delay: 0 },
  { id: 'in-15', x: -22, y: 94.8, scale: 1, cloudNum: 6, delay: 0 },
  { id: 'in-16', x: -2, y: 99.1, scale: 1, cloudNum: 4, delay: 0 },
  { id: 'in-17', x: 60.1, y: 99.2, scale: 1, cloudNum: 13, delay: 0 },
  { id: 'in-18', x: -5.7, y: 84.6, scale: 0.5, cloudNum: 8, delay: 0 },
  { id: 'in-19', x: -13.1, y: 9.8, scale: 0.5, cloudNum: 8, delay: 0 },
];

// ============================================
// FAR CLOUDS — small, low contrast, slow
// ============================================

const FAR_CLOUDS: CloudConfig[] = [
  { id: 'f-1', x: 74.2, y: 59.2, scale: 0.3, cloudNum: 11, delay: 0 },
  { id: 'f-2', x: 22.26, y: 47.09, scale: 0.3, cloudNum: 11, delay: 0 },
  { id: 'f-3', x: 71.3, y: 41.2, scale: 0.3, cloudNum: 9, delay: 0 },
  { id: 'f-4', x: 68.3, y: 26.6, scale: 0.3, cloudNum: 5, delay: 0 },
  { id: 'f-5', x: 92.7, y: 58.4, scale: 0.3, cloudNum: 1, delay: 0 },
  { id: 'f-6', x: -7.7, y: 57, scale: 0.3, cloudNum: 13, delay: 0 },
  { id: 'f-7', x: 82.8, y: 81, scale: 0.85, cloudNum: 14, delay: 0 },
  { id: 'f-8', x: 72.4, y: 63.6, scale: 0.85, cloudNum: 9, delay: 0 },
  { id: 'f-9', x: -11.7, y: 69.7, scale: 0.85, cloudNum: 7, delay: 0 },
  { id: 'f-10', x: -9, y: 78.6, scale: 0.85, cloudNum: 1, delay: 0 },
  { id: 'f-11', x: 68, y: 56.9, scale: 0.85, cloudNum: 2, delay: 0 },
  { id: 'f-12', x: 39.7, y: 101.7, scale: 0.5, cloudNum: 14, delay: 0 },
  { id: 'f-13', x: 89.5, y: 87.6, scale: 0.5, cloudNum: 13, delay: 0 },
  { id: 'f-14', x: 45.5, y: 99.6, scale: 0.5, cloudNum: 9, delay: 0 },
];

// ============================================
// MIDDLE CLOUDS — medium size, noticeable parallax
// ============================================

const MIDDLE_CLOUDS: CloudConfig[] = [
  { id: 'm-1', x: 64.4, y: 13.9, scale: 0.5, cloudNum: 6, delay: 0 },
  { id: 'm-2', x: 66.5, y: 17.7, scale: 0.5, cloudNum: 9, delay: 0 },
  { id: 'm-3', x: 12.1, y: -2.3, scale: 0.5, cloudNum: 7, delay: 0 },
  { id: 'm-4', x: 54.7, y: -2.4, scale: 0.5, cloudNum: 7, delay: 0 },
  { id: 'm-5', x: -14.2, y: 39.9, scale: 0.5, cloudNum: 7, delay: 0 },
  { id: 'm-6', x: 3.03, y: 57.59, scale: 0.5, cloudNum: 16, delay: 0 },
  { id: 'm-7', x: 88.92, y: 50, scale: 0.5, cloudNum: 7, delay: 0 },
  { id: 'm-8', x: 77.1, y: 44.9, scale: 0.5, cloudNum: 5, delay: 0 },
  { id: 'm-9', x: 79.5, y: 32.7, scale: 0.5, cloudNum: 3, delay: 0 },
  { id: 'm-10', x: -7.5, y: 49.7, scale: 0.85, cloudNum: 3, delay: 0 },
  { id: 'm-11', x: 86.73, y: 64.29, scale: 0.85, cloudNum: 3, delay: 0 },
  { id: 'm-12', x: 80.1, y: 38, scale: 0.85, cloudNum: 3, delay: 0 },
  { id: 'm-13', x: 98.64, y: 48.65, scale: 0.5, cloudNum: 10, delay: 0 },
  { id: 'm-14', x: 85.27, y: 48.53, scale: 0.5, cloudNum: 10, delay: 0 },
  { id: 'm-15', x: 5.8, y: 40.6, scale: 0.7, cloudNum: 12, delay: 0 },
  { id: 'm-16', x: -7.8, y: 54.4, scale: 0.7, cloudNum: 13, delay: 0 },
  { id: 'm-17', x: 75.8, y: 52.2, scale: 0.85, cloudNum: 1, delay: 0 },
  { id: 'm-18', x: 87.6, y: 94.1, scale: 0.5, cloudNum: 14, delay: 0 },
  { id: 'm-19', x: 84.4, y: 74.4, scale: 0.5, cloudNum: 14, delay: 0 },
  { id: 'm-20', x: -20, y: 90.4, scale: 1, cloudNum: 15, delay: 0 },
  { id: 'm-21', x: 81.5, y: 89.84, scale: 0.85, cloudNum: 5, delay: 0 },
];

// ============================================
// BALLOONS
// ============================================

const BALLOONS: Balloon[] = [
  { id: 'b-1', variant: 'balloon1', x: 12, y: 6, scale: 0.45, floatDelay: 0, pathConfig: { xOffset: -18, yOffset: 40, rotation: -4, duration: 110, wave: 12 } },
  { id: 'b-2', variant: 'green', x: 78, y: 14, scale: 0.5, floatDelay: 2, pathConfig: { xOffset: 22, yOffset: 50, rotation: 5, duration: 180, wave: 22 } },
  { id: 'b-3', variant: 'balloon2', x: 45, y: 22, scale: 0.35, floatDelay: 1, pathConfig: { xOffset: 15, yOffset: 35, rotation: 3, duration: 160, wave: 10 } },
  { id: 'b-4', variant: 'red', x: 88, y: 32, scale: 0.4, floatDelay: 3, pathConfig: { xOffset: -20, yOffset: 45, rotation: -5, duration: 130, wave: 26 } },
  { id: 'b-5', variant: 'balloon3', x: 8, y: 42, scale: 0.32, floatDelay: 1.5, pathConfig: { xOffset: 12, yOffset: 38, rotation: 3, duration: 200, wave: 16 } },
  { id: 'b-6', variant: 'blue', x: 60, y: 52, scale: 0.42, floatDelay: 0.5, pathConfig: { xOffset: 18, yOffset: 42, rotation: 4, duration: 155, wave: 20 } },
  { id: 'b-7', variant: 'balloon4', x: 25, y: 62, scale: 0.38, floatDelay: 2.5, pathConfig: { xOffset: -15, yOffset: 40, rotation: -3, duration: 175, wave: 14 } },
  { id: 'b-8', variant: 'balloon5', x: 72, y: 72, scale: 0.48, floatDelay: 4, pathConfig: { xOffset: 25, yOffset: 48, rotation: 5, duration: 125, wave: 24 } },
  { id: 'b-9', variant: 'balloon6', x: 18, y: 82, scale: 0.3, floatDelay: 3.5, pathConfig: { xOffset: -12, yOffset: 35, rotation: -4, duration: 190, wave: 18 } },
  { id: 'b-10', variant: 'balloon7', x: 55, y: 92, scale: 0.44, floatDelay: 5, pathConfig: { xOffset: 20, yOffset: 45, rotation: 4, duration: 170, wave: 30 } },
];

const FINAL_BALLOONS: Balloon[] = [
  { id: 'f-b-1', variant: 'balloon1', x: 35, y: 68, scale: 0.38, floatDelay: 1, pathConfig: { xOffset: 18, yOffset: 38, rotation: 3, duration: 150, wave: 16 } },
  { id: 'f-b-2', variant: 'balloon5', x: 82, y: 78, scale: 0.42, floatDelay: 3, pathConfig: { xOffset: -20, yOffset: 42, rotation: -4, duration: 120, wave: 26 } },
  { id: 'f-b-3', variant: 'balloon3', x: 48, y: 88, scale: 0.35, floatDelay: 2, pathConfig: { xOffset: 15, yOffset: 36, rotation: 3, duration: 185, wave: 12 } },
];

// ============================================
// Render helper
// ============================================

function CloudImages({
  clouds,
  depth,
  layerClass,
}: {
  clouds: CloudConfig[];
  depth: CloudDepth;
  layerClass: string;
}) {
  const cfg = CLOUD_DEPTH[depth];

  return (
    <div
      className={`cloud-layer cloud-layer--${depth} ${layerClass}`}
      data-depth={depth}
    >
      {clouds.map((c) => (
        <img
          key={c.id}
          src={SPRITES.clouds[c.cloudNum]}
          alt=""
          className={`cloud cloud--${c.cloudNum}`}
          data-cloud={c.id}
          style={{
            position: 'absolute',
            left: `${c.x}%`,
            top: `${c.y}%`,
            transform: `scale(${c.scale})`,
            filter: cfg.blur > 0 ? `blur(${cfg.blur}px)` : 'none',
            opacity: cfg.opacity,
            willChange: 'transform, opacity',
          }}
          loading="lazy"
        />
      ))}
    </div>
  );
}

// ============================================
// LandingPage
// ============================================

export function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const finalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const ctx = gsap.context(() => {
      // Верхние облака «первого экрана» — для них работает
      // fly-in при загрузке + разлёт при скролле (и назад).
      // Облака ниже по странице ведут себя как раньше.
      const TOP_CLOUD_Y = 33;

      // --------------------------------------------------
      // 1. INTRO FLY-IN  (time-based, plays on mount)
      //    Clouds start off-screen (beyond the screen edges)
      //    and glide into position
      // --------------------------------------------------
      INTRO_CLOUDS.forEach((cloud) => {
        const node = el.querySelector(`[data-cloud="${cloud.id}"]`) as HTMLElement;
        if (!node) return;

        const isTop = cloud.y <= TOP_CLOUD_Y;

        // Fly-in from beyond the screen edge: the offset must exceed
        // the actual rendered cloud size, otherwise the cloud is visible.
        const side = cloud.x < 50 ? -1 : 1;
        const flyOffset = Math.max(node.offsetWidth * cloud.scale, 240) + 80;

        gsap.set(node, { x: side * flyOffset, opacity: 0 });

        gsap.to(node, {
          x: 0,
          opacity: 1,
          duration: isTop ? 1.4 + cloud.delay * 1.5 : 2 + cloud.delay * 2.5,
          delay: cloud.delay,
          ease: 'power2.out',
        });

        // Топ-облака: при скролле вниз плавно разлетаются в стороны
        // (за экран по своей стороне + лёгкий подъём и поворот),
        // при возврате наверх scrubbed ScrollTrigger налетает обратно.
        if (isTop) {
          const scatterX = side * (flyOffset + 140 + cloud.y * 4);
          const scatterY = -(40 + cloud.y * 2);
          const rotation = side * (2 + (Math.abs(cloud.x) % 6));

          gsap.fromTo(
            node,
            { x: 0, opacity: 1 },
            {
              x: scatterX,
              y: scatterY,
              opacity: 0,
              rotation,
              ease: 'none',
              immediateRender: false,
              scrollTrigger: {
                trigger: el,
                start: 'top top',
                end: '30% top',
                scrub: 1,
              },
            },
          );
        }
      });

      // --------------------------------------------------
      // 2. PARALLAX — different speeds per layer
      //    Far: slow (lags behind), Near: fast (rushes past)
      // --------------------------------------------------
      const pageHeight = el.scrollHeight - window.innerHeight;

      FAR_CLOUDS.forEach((cloud) => {
        const node = el.querySelector(`[data-cloud="${cloud.id}"]`) as HTMLElement;
        if (!node) return;

        gsap.to(node, {
          y: () => pageHeight * 0.2,
          ease: 'none',
          overwrite: 'auto',
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.5,
          },
        });
      });

      MIDDLE_CLOUDS.forEach((cloud) => {
        const node = el.querySelector(`[data-cloud="${cloud.id}"]`) as HTMLElement;
        if (!node) return;

        gsap.to(node, {
          y: () => pageHeight * 0.12,
          ease: 'none',
          overwrite: 'auto',
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.8,
          },
        });
      });

      INTRO_CLOUDS.forEach((cloud) => {
        // Верхние облака используем только для scatter — общий parallax им не нужен
        if (cloud.y <= TOP_CLOUD_Y) return;

        const node = el.querySelector(`[data-cloud="${cloud.id}"]`) as HTMLElement;
        if (!node) return;

        gsap.to(node, {
          y: () => -pageHeight * 0.18,
          ease: 'none',
          overwrite: 'auto',
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: 'bottom top',
            scrub: 1,
          },
        });
      });

      // --------------------------------------------------
      // 3. HERO CONTENT — fade out on scroll
      // --------------------------------------------------
      if (heroContentRef.current) {
        gsap.to(heroContentRef.current, {
          opacity: 0,
          y: -100,
          ease: 'power2.inOut',
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: '20% top',
            scrub: 1,
          },
        });
      }

      // --------------------------------------------------
      // 4. FINAL CONTENT — fade in near bottom
      // --------------------------------------------------
      if (finalContentRef.current) {
        gsap.fromTo(
          finalContentRef.current,
          { opacity: 0, y: 100 },
          {
            opacity: 1,
            y: 0,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: el,
              start: '70% top',
              end: '85% top',
              scrub: 1,
            },
          },
        );
      }
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="landing-page">
      {/* Far layer — small, blurred, slow */}
      <CloudImages clouds={FAR_CLOUDS} depth="far" layerClass="far-clouds" />

      {/* Middle layer — medium */}
      <CloudImages clouds={MIDDLE_CLOUDS} depth="middle" layerClass="middle-clouds" />

      {/* Near layer — intro clouds, large, scatter on scroll */}
      <CloudImages clouds={INTRO_CLOUDS} depth="near" layerClass="intro-clouds" />

      {/* Balloons */}
      <BalloonLayer balloons={BALLOONS} />

      {/* Hero */}
      <div ref={heroContentRef} className="hero-content">
        <h1 className="hero-content__title">{CONTENT.hero.title}</h1>
        <p className="hero-content__subtitle">{CONTENT.hero.subtitle}</p>
        <p className="hero-content__description">{CONTENT.hero.description}</p>
        <button className="hero-content__cta button button--primary">
          {CONTENT.hero.cta}
        </button>
      </div>

      {/* Final balloons */}
      <BalloonLayer balloons={FINAL_BALLOONS} />

      {/* Final content */}
      <div ref={finalContentRef} className="final-content">
        <h2 className="final-content__title">{CONTENT.final.title}</h2>
        <p className="final-content__subtitle">{CONTENT.final.subtitle}</p>
        <button className="final-content__cta button button--primary">
          {CONTENT.final.cta}
        </button>
        <footer className="final-content__footer">
          <p>© 2026 Воздушный Шар. Все права защищены.</p>
        </footer>
      </div>
    </div>
  );
}
