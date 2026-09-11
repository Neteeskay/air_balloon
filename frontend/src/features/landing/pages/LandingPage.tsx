import { useEffect, useRef } from 'react';
import { CloudLayer, type Cloud } from '../components/CloudLayer';
import { BalloonLayer, type Balloon } from '../components/BalloonLayer';
import { CONTENT } from '../config/content';
import { gsap } from '../animations/gsapSetup';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LIGHTING } from '../animations/lighting';

// INTRO CLOUDS - видны сразу, разлетаются при скролле
const INTRO_CLOUDS: Cloud[] = [
  { id: 'intro-1', x: 15, y: 25, scale: 2.0, cloudNum: 1 },
  { id: 'intro-2', x: 65, y: 45, scale: 2.3, cloudNum: 3 },
  { id: 'intro-3', x: 80, y: 15, scale: 1.8, cloudNum: 5 },
];

// BACKGROUND CLOUDS - дальние, медленные
const BG_CLOUDS: Cloud[] = [
  { id: 'bg-1', x: 10, y: 30, scale: 0.45, cloudNum: 13 },
  { id: 'bg-2', x: 85, y: 70, scale: 0.4, cloudNum: 15 },
];

// MIDDLE CLOUDS - средняя скорость
const MID_CLOUDS: Cloud[] = [
  { id: 'mid-1', x: 20, y: 50, scale: 0.7, cloudNum: 8 },
  { id: 'mid-2', x: 75, y: 35, scale: 0.75, cloudNum: 10 },
  { id: 'mid-3', x: 45, y: 80, scale: 0.65, cloudNum: 11 },
];

// FOREGROUND CLOUDS - близкие, быстрые
const FG_CLOUDS: Cloud[] = [
  { id: 'fg-1', x: 5, y: 85, scale: 1.0, cloudNum: 2 },
  { id: 'fg-2', x: 88, y: 75, scale: 0.95, cloudNum: 4 },
];

// BALLOONS - плавно плывут
const BALLOONS: Balloon[] = [
  { id: 'b-1', color: 'red', x: 8, y: 35, scale: 0.55, floatDelay: 0, pathConfig: { xOffset: -18, yOffset: 18, rotation: -3 } },
  { id: 'b-2', color: 'green', x: 88, y: 45, scale: 0.7, floatDelay: 1, pathConfig: { xOffset: 22, yOffset: 20, rotation: 4 } },
  { id: 'b-3', color: 'red', x: 12, y: 70, scale: 0.5, floatDelay: 2, pathConfig: { xOffset: 15, yOffset: 17, rotation: 2 } },
  { id: 'b-4', color: 'green', x: 90, y: 82, scale: 0.58, floatDelay: 2.5, pathConfig: { xOffset: -20, yOffset: 19, rotation: -4 } },
];

// FINAL BALLOONS - появляются внизу
const FINAL_BALLOONS: Balloon[] = [
  { id: 'f-b-1', color: 'green', x: 20, y: 25, scale: 0.75, floatDelay: 0.5, pathConfig: { xOffset: 18, yOffset: 18, rotation: 3 } },
  { id: 'f-b-2', color: 'red', x: 45, y: 15, scale: 0.85, floatDelay: 1.2, pathConfig: { xOffset: -20, yOffset: 20, rotation: -4 } },
  { id: 'f-b-3', color: 'green', x: 72, y: 30, scale: 0.7, floatDelay: 1.8, pathConfig: { xOffset: 16, yOffset: 17, rotation: 3 } },
];

export function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const finalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !overlayRef.current) return;

    const container = containerRef.current;
    const overlay = overlayRef.current;

    // INTRO ANIMATION - облака разлетаются при начале скролла
    const introClouds = Array.from(
      container.querySelectorAll('.intro-clouds .cloud'),
    ) as HTMLElement[];

    const introTl = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        start: 'top top',
        end: '30% top',
        scrub: 2, // Более плавный scrub
      },
    });

    // Затемнение уходит
    introTl.to(overlay, {
      opacity: 0,
      ease: 'power1.inOut',
    }, 0);

    // Облака разлетаются радиально
    introClouds.forEach((cloud, i) => {
      const angle = (i / introClouds.length) * Math.PI * 2;
      const distance = 700;

      introTl.to(cloud, {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance - 400,
        scale: 3.0,
        rotation: (i % 2 === 0 ? 1 : -1) * 20,
        opacity: 0,
        ease: 'power1.out',
      }, 0);
    });

    // CONTINUOUS PARALLAX для всех слоёв
    const bgClouds = Array.from(container.querySelectorAll('.bg-clouds .cloud')) as HTMLElement[];
    const midClouds = Array.from(container.querySelectorAll('.mid-clouds .cloud')) as HTMLElement[];
    const fgClouds = Array.from(container.querySelectorAll('.fg-clouds .cloud')) as HTMLElement[];
    const balloons = Array.from(container.querySelectorAll('.balloon')) as HTMLElement[];

    // Background - очень медленно
    bgClouds.forEach((cloud) => {
      gsap.to(cloud, {
        y: () => -window.innerHeight * 0.15,
        ease: 'none',
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 2,
        },
      });
    });

    // Middle - средняя скорость
    midClouds.forEach((cloud) => {
      gsap.to(cloud, {
        y: () => -window.innerHeight * 0.5,
        ease: 'none',
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 2,
        },
      });
    });

    // Foreground - быстро, с увеличением
    fgClouds.forEach((cloud) => {
      gsap.to(cloud, {
        y: () => -window.innerHeight * 1.2,
        scale: '+=0.4',
        ease: 'none',
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 2,
        },
      });
    });

    // Balloons - с лёгким качанием
    balloons.forEach((balloon, i) => {
      const sway = (i % 2 === 0 ? 1 : -1) * 40;
      gsap.to(balloon, {
        y: () => -window.innerHeight * 0.65,
        x: `+=${sway}`,
        ease: 'none',
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 2,
        },
      });
    });

    return () => {
      introTl.kill();
      ScrollTrigger.getAll().forEach((st) => st.kill());
    };
  }, []);

  return (
    <div ref={containerRef} className="landing-page">
      {/* Тёмный overlay (исчезает при скролле) */}
      <div
        ref={overlayRef}
        className="landing-page__overlay"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: `rgba(0, 0, 0, ${LIGHTING.dark})`,
          pointerEvents: 'none',
          zIndex: 50,
        }}
      />

      {/* INTRO CLOUDS - разлетаются */}
      <CloudLayer depth="foreground" clouds={INTRO_CLOUDS} className="intro-clouds" />

      {/* BACKGROUND CLOUDS - медленный parallax */}
      <CloudLayer depth="background" clouds={BG_CLOUDS} className="bg-clouds" />

      {/* MIDDLE CLOUDS - средний parallax */}
      <CloudLayer depth="middle" clouds={MID_CLOUDS} className="mid-clouds" />

      {/* FOREGROUND CLOUDS - быстрый parallax */}
      <CloudLayer depth="foreground" clouds={FG_CLOUDS} className="fg-clouds" />

      {/* BALLOONS */}
      <BalloonLayer balloons={BALLOONS} />

      {/* HERO CONTENT - виден сразу */}
      <div ref={heroContentRef} className="hero-content">
        <h1 className="hero-content__title">{CONTENT.hero.title}</h1>
        <p className="hero-content__subtitle">{CONTENT.hero.subtitle}</p>
        <p className="hero-content__description">{CONTENT.hero.description}</p>
        <button className="hero-content__cta button button--primary">
          {CONTENT.hero.cta}
        </button>
      </div>

      {/* FINAL BALLOONS */}
      <div className="final-area">
        <BalloonLayer balloons={FINAL_BALLOONS} />
      </div>

      {/* FINAL CONTENT - внизу страницы */}
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
