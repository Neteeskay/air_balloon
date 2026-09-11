import { useEffect, useRef } from 'react';
import { CloudLayer, type Cloud } from '../components/CloudLayer';
import { BalloonLayer, type Balloon } from '../components/BalloonLayer';
import { CONTENT } from '../config/content';
import { gsap } from '../animations/gsapSetup';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import '../styles/landing.css';

// INTRO CLOUDS - видны сразу, наплывают при входе
const INTRO_CLOUDS: Cloud[] = [
  // Верхний ряд
  { id: 'intro-1', x: 2, y: 5, scale: 0.6, cloudNum: 1 },
  { id: 'intro-2', x: 22, y: 8, scale: 0.55, cloudNum: 3 },
  { id: 'intro-3', x: 78, y: 6, scale: 0.58, cloudNum: 5 },
  { id: 'intro-4', x: 95, y: 10, scale: 0.6, cloudNum: 2 },

  // Средний ряд
  { id: 'intro-5', x: 5, y: 35, scale: 0.65, cloudNum: 4 },
  { id: 'intro-6', x: 88, y: 38, scale: 0.62, cloudNum: 6 },
  { id: 'intro-7', x: 3, y: 55, scale: 0.68, cloudNum: 7 },
  { id: 'intro-8', x: 92, y: 52, scale: 0.64, cloudNum: 1 },

  // Нижний ряд
  { id: 'intro-9', x: 8, y: 75, scale: 0.7, cloudNum: 3 },
  { id: 'intro-10', x: 25, y: 78, scale: 0.66, cloudNum: 5 },
  { id: 'intro-11', x: 75, y: 80, scale: 0.68, cloudNum: 2 },
  { id: 'intro-12', x: 90, y: 76, scale: 0.72, cloudNum: 4 },
];

// BACKGROUND CLOUDS - дальние, медленные (по краям)
const BG_CLOUDS: Cloud[] = [
  { id: 'bg-1', x: 5, y: 15, scale: 0.28, cloudNum: 13 },
  { id: 'bg-2', x: 92, y: 20, scale: 0.26, cloudNum: 15 },
  { id: 'bg-3', x: 8, y: 45, scale: 0.3, cloudNum: 14 },
  { id: 'bg-4', x: 88, y: 50, scale: 0.28, cloudNum: 16 },
  { id: 'bg-5', x: 10, y: 70, scale: 0.32, cloudNum: 13 },
  { id: 'bg-6', x: 85, y: 68, scale: 0.3, cloudNum: 15 },
];

// MIDDLE CLOUDS - средняя скорость (по краям)
const MID_CLOUDS: Cloud[] = [
  { id: 'mid-1', x: 12, y: 25, scale: 0.42, cloudNum: 8 },
  { id: 'mid-2', x: 85, y: 28, scale: 0.44, cloudNum: 10 },
  { id: 'mid-3', x: 10, y: 48, scale: 0.4, cloudNum: 11 },
  { id: 'mid-4', x: 88, y: 52, scale: 0.43, cloudNum: 9 },
  { id: 'mid-5', x: 15, y: 72, scale: 0.46, cloudNum: 8 },
  { id: 'mid-6', x: 82, y: 75, scale: 0.44, cloudNum: 10 },
];

// FOREGROUND CLOUDS - близкие, быстрые (по краям)
const FG_CLOUDS: Cloud[] = [
  { id: 'fg-1', x: 2, y: 30, scale: 0.55, cloudNum: 2 },
  { id: 'fg-2', x: 93, y: 35, scale: 0.58, cloudNum: 4 },
  { id: 'fg-3', x: 5, y: 60, scale: 0.6, cloudNum: 7 },
  { id: 'fg-4', x: 90, y: 58, scale: 0.56, cloudNum: 3 },
  { id: 'fg-5', x: 8, y: 85, scale: 0.62, cloudNum: 2 },
  { id: 'fg-6', x: 88, y: 88, scale: 0.58, cloudNum: 4 },
];

// BALLOONS - стартуют на экране и медленно плывут вверх
const BALLOONS: Balloon[] = [
  { id: 'b-1', color: 'red', x: 20, y: 60, scale: 0.35, floatDelay: 0, pathConfig: { xOffset: -25, yOffset: -150, rotation: -4 } },
  { id: 'b-2', color: 'green', x: 75, y: 70, scale: 0.4, floatDelay: 3, pathConfig: { xOffset: 30, yOffset: -180, rotation: 5 } },
  { id: 'b-3', color: 'red', x: 35, y: 80, scale: 0.32, floatDelay: 6, pathConfig: { xOffset: 20, yOffset: -160, rotation: 3 } },
  { id: 'b-4', color: 'green', x: 65, y: 85, scale: 0.38, floatDelay: 9, pathConfig: { xOffset: -28, yOffset: -170, rotation: -5 } },

  // Новые шары появляются снизу с задержкой
  { id: 'b-5', color: 'red', x: 25, y: 105, scale: 0.36, floatDelay: 12, pathConfig: { xOffset: 22, yOffset: -190, rotation: 4 } },
  { id: 'b-6', color: 'green', x: 70, y: 108, scale: 0.42, floatDelay: 15, pathConfig: { xOffset: -26, yOffset: -175, rotation: -4 } },
  { id: 'b-7', color: 'red', x: 40, y: 110, scale: 0.34, floatDelay: 18, pathConfig: { xOffset: 24, yOffset: -165, rotation: 3 } },
];

// FINAL BALLOONS - появляются внизу страницы
const FINAL_BALLOONS: Balloon[] = [
  { id: 'f-b-1', color: 'green', x: 30, y: 95, scale: 0.42, floatDelay: 1, pathConfig: { xOffset: 22, yOffset: -140, rotation: 4 } },
  { id: 'f-b-2', color: 'red', x: 50, y: 100, scale: 0.48, floatDelay: 4, pathConfig: { xOffset: -26, yOffset: -155, rotation: -4 } },
  { id: 'f-b-3', color: 'green', x: 68, y: 105, scale: 0.4, floatDelay: 7, pathConfig: { xOffset: 24, yOffset: -145, rotation: 3 } },
];

export function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const finalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // INTRO ANIMATION - облака наплывают при входе на сайт
    const introClouds = Array.from(
      container.querySelectorAll('.intro-clouds .cloud'),
    ) as HTMLElement[];

    // Скрываем облака изначально
    gsap.set(introClouds, { opacity: 0, scale: 0.3 });

    const introTl = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        start: 'top top',
        end: '30% top',
        scrub: 2,
      },
    });

    // Облака наплывают (появляются) при загрузке
    gsap.to(introClouds, {
      opacity: 1,
      scale: 1,
      duration: 2,
      stagger: 0.15,
      ease: 'power2.out',
    });

    // Облака плавно двигаются в стороны при первом скролле
    introClouds.forEach((cloud, i) => {
      const isLeft = i % 2 === 0;

      introTl.to(cloud, {
        x: isLeft ? -600 : 600,
        y: -150,
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
