import { useEffect, useRef } from 'react';
import { CloudLayer, type Cloud } from '../components/CloudLayer';
import { BalloonLayer, type Balloon } from '../components/BalloonLayer';
import { CONTENT } from '../config/content';
import { gsap } from '../animations/gsapSetup';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import '../styles/landing.css';

// INTRO CLOUDS - наплывают со всех сторон при входе на сайт
const INTRO_CLOUDS: Cloud[] = [
  // Слева
  { id: 'intro-1', x: -15, y: 10, scale: 0.7, cloudNum: 1 },
  { id: 'intro-2', x: -12, y: 35, scale: 0.65, cloudNum: 3 },
  { id: 'intro-3', x: -10, y: 60, scale: 0.72, cloudNum: 5 },
  { id: 'intro-4', x: -14, y: 82, scale: 0.68, cloudNum: 2 },

  // Справа
  { id: 'intro-5', x: 112, y: 8, scale: 0.68, cloudNum: 4 },
  { id: 'intro-6', x: 115, y: 40, scale: 0.7, cloudNum: 6 },
  { id: 'intro-7', x: 110, y: 65, scale: 0.66, cloudNum: 7 },
  { id: 'intro-8', x: 113, y: 85, scale: 0.72, cloudNum: 1 },

  // Сверху
  { id: 'intro-9', x: 25, y: -10, scale: 0.64, cloudNum: 3 },
  { id: 'intro-10', x: 50, y: -8, scale: 0.68, cloudNum: 5 },
  { id: 'intro-11', x: 75, y: -12, scale: 0.66, cloudNum: 2 },

  // Снизу
  { id: 'intro-12', x: 20, y: 105, scale: 0.7, cloudNum: 4 },
  { id: 'intro-13', x: 55, y: 108, scale: 0.68, cloudNum: 6 },
  { id: 'intro-14', x: 80, y: 106, scale: 0.72, cloudNum: 7 },
];

// FLOATING CLOUDS - постоянно парят по экрану (не привязаны к скроллу)
const FLOATING_CLOUDS: Cloud[] = [
  { id: 'float-1', x: 15, y: 20, scale: 0.5, cloudNum: 8 },
  { id: 'float-2', x: 70, y: 25, scale: 0.48, cloudNum: 10 },
  { id: 'float-3', x: 30, y: 45, scale: 0.52, cloudNum: 11 },
  { id: 'float-4', x: 80, y: 50, scale: 0.5, cloudNum: 9 },
  { id: 'float-5', x: 20, y: 70, scale: 0.54, cloudNum: 12 },
  { id: 'float-6', x: 85, y: 68, scale: 0.48, cloudNum: 8 },
  { id: 'float-7', x: 45, y: 80, scale: 0.5, cloudNum: 10 },
  { id: 'float-8', x: 65, y: 85, scale: 0.52, cloudNum: 11 },
];

// BACKGROUND CLOUDS - дальние, медленные (по краям)
const BG_CLOUDS: Cloud[] = [
  { id: 'bg-1', x: 5, y: 15, scale: 0.28, cloudNum: 13 },
  { id: 'bg-2', x: 92, y: 20, scale: 0.26, cloudNum: 15 },
  { id: 'bg-3', x: 8, y: 45, scale: 0.3, cloudNum: 14 },
  { id: 'bg-4', x: 88, y: 50, scale: 0.28, cloudNum: 16 },
  { id: 'bg-5', x: 10, y: 70, scale: 0.32, cloudNum: 13 },
  { id: 'bg-6', x: 85, y: 68, scale: 0.3, cloudNum: 15 },
  { id: 'bg-7', x: 12, y: 88, scale: 0.28, cloudNum: 14 },
  { id: 'bg-8', x: 90, y: 85, scale: 0.3, cloudNum: 16 },
];

// MIDDLE CLOUDS - средняя скорость (больше по краям)
const MID_CLOUDS: Cloud[] = [
  { id: 'mid-1', x: 12, y: 25, scale: 0.42, cloudNum: 8 },
  { id: 'mid-2', x: 85, y: 28, scale: 0.44, cloudNum: 10 },
  { id: 'mid-3', x: 10, y: 48, scale: 0.4, cloudNum: 11 },
  { id: 'mid-4', x: 88, y: 52, scale: 0.43, cloudNum: 9 },
  { id: 'mid-5', x: 15, y: 72, scale: 0.46, cloudNum: 8 },
  { id: 'mid-6', x: 82, y: 75, scale: 0.44, cloudNum: 10 },
  { id: 'mid-7', x: 8, y: 90, scale: 0.42, cloudNum: 11 },
  { id: 'mid-8', x: 90, y: 88, scale: 0.45, cloudNum: 9 },
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

// BALLOONS - разнообразные по размеру и глубине, распределены по экрану
const BALLOONS: Balloon[] = [
  // Ближние (большие, быстрые)
  { id: 'b-1', color: 'red', x: 25, y: 55, scale: 0.5, floatDelay: 0, pathConfig: { xOffset: -30, yOffset: -200, rotation: -5 } },
  { id: 'b-2', color: 'green', x: 72, y: 65, scale: 0.52, floatDelay: 4, pathConfig: { xOffset: 35, yOffset: -210, rotation: 6 } },

  // Средние
  { id: 'b-3', color: 'red', x: 15, y: 75, scale: 0.38, floatDelay: 2, pathConfig: { xOffset: 25, yOffset: -170, rotation: 4 } },
  { id: 'b-4', color: 'green', x: 50, y: 70, scale: 0.42, floatDelay: 6, pathConfig: { xOffset: -28, yOffset: -180, rotation: -5 } },
  { id: 'b-5', color: 'red', x: 82, y: 80, scale: 0.4, floatDelay: 8, pathConfig: { xOffset: 22, yOffset: -175, rotation: 3 } },

  // Дальние (маленькие, медленные)
  { id: 'b-6', color: 'green', x: 35, y: 85, scale: 0.28, floatDelay: 3, pathConfig: { xOffset: 18, yOffset: -140, rotation: 3 } },
  { id: 'b-7', color: 'red', x: 62, y: 88, scale: 0.3, floatDelay: 7, pathConfig: { xOffset: -20, yOffset: -145, rotation: -4 } },

  // Новые появляются снизу
  { id: 'b-8', color: 'green', x: 20, y: 105, scale: 0.45, floatDelay: 10, pathConfig: { xOffset: 28, yOffset: -190, rotation: 5 } },
  { id: 'b-9', color: 'red', x: 45, y: 108, scale: 0.32, floatDelay: 13, pathConfig: { xOffset: -25, yOffset: -160, rotation: -4 } },
  { id: 'b-10', color: 'green', x: 75, y: 110, scale: 0.48, floatDelay: 16, pathConfig: { xOffset: 30, yOffset: -195, rotation: 5 } },
];

// FINAL BALLOONS - больше разнообразия внизу страницы
const FINAL_BALLOONS: Balloon[] = [
  { id: 'f-b-1', color: 'green', x: 22, y: 92, scale: 0.5, floatDelay: 1, pathConfig: { xOffset: 26, yOffset: -170, rotation: 5 } },
  { id: 'f-b-2', color: 'red', x: 48, y: 98, scale: 0.55, floatDelay: 3, pathConfig: { xOffset: -30, yOffset: -185, rotation: -5 } },
  { id: 'f-b-3', color: 'green', x: 68, y: 95, scale: 0.42, floatDelay: 5, pathConfig: { xOffset: 24, yOffset: -165, rotation: 4 } },
  { id: 'f-b-4', color: 'red', x: 35, y: 105, scale: 0.38, floatDelay: 7, pathConfig: { xOffset: 22, yOffset: -155, rotation: 3 } },
  { id: 'f-b-5', color: 'green', x: 80, y: 108, scale: 0.48, floatDelay: 9, pathConfig: { xOffset: -28, yOffset: -175, rotation: -4 } },
];

export function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const finalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // INTRO ANIMATION - облака наплывают со всех сторон
    const introClouds = Array.from(
      container.querySelectorAll('.intro-clouds .cloud'),
    ) as HTMLElement[];

    const introTl = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        start: 'top top',
        end: '30% top',
        scrub: 2,
      },
    });

    // Устанавливаем начальные позиции облаков (за экраном) и анимируем на позиции
    introClouds.forEach((cloud, i) => {
      const cloudData = INTRO_CLOUDS[i];
      if (!cloudData) return;

      // Определяем откуда должно наплыть облако
      let startX = 0;
      let startY = 0;

      if (cloudData.x < 0) {
        // Слева
        startX = cloudData.x;
      } else if (cloudData.x > 100) {
        // Справа
        startX = cloudData.x;
      } else if (cloudData.y < 0) {
        // Сверху
        startY = cloudData.y;
      } else if (cloudData.y > 100) {
        // Снизу
        startY = cloudData.y;
      }

      // Устанавливаем начальное положение
      gsap.set(cloud, {
        x: startX + '%',
        y: startY + '%',
        opacity: 0,
      });

      // Анимация наплывания на свою позицию
      gsap.to(cloud, {
        x: '0%',
        y: '0%',
        opacity: 1,
        duration: 2.5,
        delay: i * 0.15,
        ease: 'power2.out',
      });
    });

    // При скролле облака уходят обратно за края
    introClouds.forEach((cloud, i) => {
      const cloudData = INTRO_CLOUDS[i];
      if (!cloudData) return;

      let exitX = 0;
      let exitY = 0;

      if (cloudData.x < 0) {
        exitX = -150;
      } else if (cloudData.x > 100) {
        exitX = 150;
      }

      if (cloudData.y < 0) {
        exitY = -100;
      } else if (cloudData.y > 100) {
        exitY = 100;
      }

      introTl.to(cloud, {
        x: exitX + '%',
        y: exitY + '%',
        opacity: 0,
        ease: 'power1.inOut',
      }, 0);
    });

    // FLOATING CLOUDS - постоянно парят (не зависят от скролла)
    const floatingClouds = Array.from(
      container.querySelectorAll('.floating-clouds .cloud'),
    ) as HTMLElement[];

    floatingClouds.forEach((cloud, i) => {
      const duration = 40 + Math.random() * 20;
      const xOffset = (Math.random() - 0.5) * 100;
      const yOffset = (Math.random() - 0.5) * 50;

      gsap.to(cloud, {
        x: `+=${xOffset}`,
        y: `+=${yOffset}`,
        duration: duration,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: i * 2,
      });
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

      {/* INTRO CLOUDS - наплывают со всех сторон */}
      <CloudLayer depth="foreground" clouds={INTRO_CLOUDS} className="intro-clouds" />

      {/* FLOATING CLOUDS - постоянно парят по экрану */}
      <CloudLayer depth="middle" clouds={FLOATING_CLOUDS} className="floating-clouds" />

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
