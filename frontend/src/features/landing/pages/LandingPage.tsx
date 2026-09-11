import { useEffect, useRef } from 'react';
import { CloudLayer, type Cloud } from '../components/CloudLayer';
import { BalloonLayer, type Balloon } from '../components/BalloonLayer';
import { CONTENT } from '../config/content';
import { gsap } from '../animations/gsapSetup';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import '../styles/landing.css';

// INTRO CLOUDS - видны сразу, разлетаются при скролле
const INTRO_CLOUDS: Cloud[] = [
  { id: 'intro-1', x: 5, y: 20, scale: 0.7, cloudNum: 1 },
  { id: 'intro-2', x: 88, y: 15, scale: 0.65, cloudNum: 3 },
  { id: 'intro-3', x: 10, y: 60, scale: 0.75, cloudNum: 5 },
  { id: 'intro-4', x: 85, y: 55, scale: 0.7, cloudNum: 2 },
  { id: 'intro-5', x: 3, y: 85, scale: 0.8, cloudNum: 4 },
  { id: 'intro-6', x: 92, y: 80, scale: 0.75, cloudNum: 6 },
];

// BACKGROUND CLOUDS - дальние, медленные
const BG_CLOUDS: Cloud[] = [
  { id: 'bg-1', x: 8, y: 25, scale: 0.3, cloudNum: 13 },
  { id: 'bg-2', x: 90, y: 70, scale: 0.28, cloudNum: 15 },
  { id: 'bg-3', x: 12, y: 75, scale: 0.32, cloudNum: 14 },
  { id: 'bg-4', x: 87, y: 30, scale: 0.3, cloudNum: 16 },
];

// MIDDLE CLOUDS - средняя скорость
const MID_CLOUDS: Cloud[] = [
  { id: 'mid-1', x: 15, y: 40, scale: 0.45, cloudNum: 8 },
  { id: 'mid-2', x: 82, y: 45, scale: 0.48, cloudNum: 10 },
  { id: 'mid-3', x: 10, y: 80, scale: 0.42, cloudNum: 11 },
  { id: 'mid-4', x: 88, y: 65, scale: 0.46, cloudNum: 9 },
];

// FOREGROUND CLOUDS - близкие, быстрые
const FG_CLOUDS: Cloud[] = [
  { id: 'fg-1', x: 2, y: 50, scale: 0.6, cloudNum: 2 },
  { id: 'fg-2', x: 93, y: 40, scale: 0.58, cloudNum: 4 },
  { id: 'fg-3', x: 5, y: 90, scale: 0.62, cloudNum: 7 },
  { id: 'fg-4', x: 90, y: 85, scale: 0.6, cloudNum: 3 },
];

// BALLOONS - плавно плывут снизу вверх
const BALLOONS: Balloon[] = [
  { id: 'b-1', color: 'red', x: 18, y: 110, scale: 0.35, floatDelay: 0, pathConfig: { xOffset: -25, yOffset: -180, rotation: -4 } },
  { id: 'b-2', color: 'green', x: 78, y: 115, scale: 0.4, floatDelay: 2, pathConfig: { xOffset: 30, yOffset: -200, rotation: 5 } },
  { id: 'b-3', color: 'red', x: 35, y: 120, scale: 0.32, floatDelay: 4, pathConfig: { xOffset: 20, yOffset: -190, rotation: 3 } },
  { id: 'b-4', color: 'green', x: 65, y: 125, scale: 0.38, floatDelay: 6, pathConfig: { xOffset: -28, yOffset: -195, rotation: -5 } },
];

// FINAL BALLOONS - появляются внизу
const FINAL_BALLOONS: Balloon[] = [
  { id: 'f-b-1', color: 'green', x: 25, y: 110, scale: 0.42, floatDelay: 1, pathConfig: { xOffset: 22, yOffset: -170, rotation: 4 } },
  { id: 'f-b-2', color: 'red', x: 50, y: 115, scale: 0.48, floatDelay: 3, pathConfig: { xOffset: -26, yOffset: -185, rotation: -4 } },
  { id: 'f-b-3', color: 'green', x: 72, y: 120, scale: 0.4, floatDelay: 5, pathConfig: { xOffset: 24, yOffset: -175, rotation: 3 } },
];

export function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const finalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

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

    // Затемнение уходит - УБРАНО, без затемнения на первом экране

    // Облака наплывают при открытии (появляются с opacity 0)
    gsap.set(introClouds, { opacity: 0, scale: 0.5 });

    introTl.to(introClouds, {
      opacity: 1,
      scale: 1,
      duration: 1.5,
      stagger: 0.2,
      ease: 'power2.out',
    }, 0);

    // Облака двигаются в стороны при первом скролле
    introClouds.forEach((cloud, i) => {
      const isLeft = i % 2 === 0;

      introTl.to(cloud, {
        x: isLeft ? -800 : 800,
        y: -200,
        opacity: 0,
        ease: 'power1.inOut',
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

    // Hero content fade out при скролле
    if (heroContentRef.current) {
      gsap.to(heroContentRef.current, {
        opacity: 0,
        y: -100,
        ease: 'power2.inOut',
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: '20% top',
          scrub: 1,
        },
      });
    }

    // Final content fade in при приближении к концу
    if (finalContentRef.current) {
      gsap.fromTo(finalContentRef.current, {
        opacity: 0,
        y: 100,
      }, {
        opacity: 1,
        y: 0,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: container,
          start: '70% top',
          end: '85% top',
          scrub: 1,
        },
      });
    }

    return () => {
      introTl.kill();
      ScrollTrigger.getAll().forEach((st) => st.kill());
    };
  }, []);

  return (
    <div ref={containerRef} className="landing-page">
      {/* Тёмный overlay - УБРАН, без затемнения */}

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
