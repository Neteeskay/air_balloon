import { useEffect, useRef } from 'react';
import { CloudLayer, type Cloud } from '../components/CloudLayer';
import { BalloonLayer, type Balloon } from '../components/BalloonLayer';
import { CONTENT } from '../config/content';
import { gsap } from '../animations/gsapSetup';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import '../styles/landing.css';

// INTRO CLOUDS - наплывают со всех сторон при входе на сайт (стартуют далеко за экраном)
const INTRO_CLOUDS: Cloud[] = [
  // Слева (далеко)
  { id: 'intro-1', x: -30, y: 8, scale: 0.7, cloudNum: 1 },
  { id: 'intro-2', x: -32, y: 25, scale: 0.65, cloudNum: 3 },
  { id: 'intro-3', x: -28, y: 42, scale: 0.72, cloudNum: 5 },
  { id: 'intro-4', x: -35, y: 58, scale: 0.68, cloudNum: 2 },
  { id: 'intro-5', x: -30, y: 75, scale: 0.7, cloudNum: 4 },
  { id: 'intro-6', x: -33, y: 90, scale: 0.66, cloudNum: 6 },

  // Справа (далеко)
  { id: 'intro-7', x: 130, y: 5, scale: 0.68, cloudNum: 7 },
  { id: 'intro-8', x: 135, y: 22, scale: 0.7, cloudNum: 1 },
  { id: 'intro-9', x: 128, y: 40, scale: 0.66, cloudNum: 3 },
  { id: 'intro-10', x: 132, y: 55, scale: 0.72, cloudNum: 5 },
  { id: 'intro-11', x: 136, y: 72, scale: 0.68, cloudNum: 2 },
  { id: 'intro-12', x: 130, y: 88, scale: 0.7, cloudNum: 4 },

  // Сверху (далеко)
  { id: 'intro-13', x: 18, y: -25, scale: 0.64, cloudNum: 6 },
  { id: 'intro-14', x: 35, y: -28, scale: 0.68, cloudNum: 7 },
  { id: 'intro-15', x: 50, y: -30, scale: 0.66, cloudNum: 1 },
  { id: 'intro-16', x: 65, y: -28, scale: 0.7, cloudNum: 3 },
  { id: 'intro-17', x: 82, y: -26, scale: 0.68, cloudNum: 5 },

  // Снизу (далеко)
  { id: 'intro-18', x: 15, y: 125, scale: 0.7, cloudNum: 2 },
  { id: 'intro-19', x: 32, y: 128, scale: 0.68, cloudNum: 4 },
  { id: 'intro-20', x: 50, y: 130, scale: 0.72, cloudNum: 6 },
  { id: 'intro-21', x: 68, y: 128, scale: 0.66, cloudNum: 7 },
  { id: 'intro-22', x: 85, y: 126, scale: 0.7, cloudNum: 1 },
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

    // INTRO ANIMATION - облака наплывают со всех сторон ОДНОВРЕМЕННО
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

    // Устанавливаем начальные позиции облаков (за экраном) и анимируем ОДНОВРЕМЕННО
    introClouds.forEach((cloud, i) => {
      const cloudData = INTRO_CLOUDS[i];
      if (!cloudData) return;

      // Определяем откуда должно наплыть облако и насколько глубже в середину
      let startX = 0;
      let startY = 0;
      let targetX = 0; // Движение глубже к середине
      let targetY = 0;

      if (cloudData.x < 0) {
        // Слева - движется вправо глубже к середине
        startX = cloudData.x;
        targetX = 15; // Вместо 0, идёт на 15% от края
      } else if (cloudData.x > 100) {
        // Справа - движется влево глубже к середине
        startX = cloudData.x;
        targetX = -15; // Вместо 0, идёт на 15% влево
      }

      if (cloudData.y < 0) {
        // Сверху - движется вниз глубже к середине
        startY = cloudData.y;
        targetY = 12; // Вместо 0, идёт на 12% вниз
      } else if (cloudData.y > 100) {
        // Снизу - движется вверх глубже к середине
        startY = cloudData.y;
        targetY = -12; // Вместо 0, идёт на 12% вверх
      }

      // Устанавливаем начальное положение
      gsap.set(cloud, {
        x: startX + '%',
        y: startY + '%',
        opacity: 0,
      });

      // Анимация наплывания ОДНОВРЕМЕННО (без delay между облаками)
      gsap.to(cloud, {
        x: targetX + '%',
        y: targetY + '%',
        opacity: 1,
        duration: 1.5, // Быстрее (было 2.5)
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
        exitX = -180; // Дальше за экран
      } else if (cloudData.x > 100) {
        exitX = 180;
      }

      if (cloudData.y < 0) {
        exitY = -120;
      } else if (cloudData.y > 100) {
        exitY = 120;
      }

      introTl.to(cloud, {
        x: exitX + '%',
        y: exitY + '%',
        opacity: 0,
        ease: 'power1.inOut',
      }, 0);
    });

    // CONTINUOUS PARALLAX для шаров
    const balloons = Array.from(container.querySelectorAll('.balloon')) as HTMLElement[];

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
