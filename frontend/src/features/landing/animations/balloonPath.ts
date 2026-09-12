import { gsap } from './gsapSetup';

export interface BalloonPathConfig {
  duration?: number;
  yOffset?: number;
  xOffset?: number;
  rotation?: number;
  delay?: number;
  scaleVariation?: number;
}

/**
 * Creates smooth floating animation for hot air balloons.
 * Balloons continuously rise upward with wave motion and loop back to start.
 */
export function createBalloonPath(
  element: HTMLElement,
  config: BalloonPathConfig = {},
) {
  const {
    duration = 40 + Math.random() * 20, // 40-60 seconds для полного цикла
    yOffset = 0,
    xOffset = config.xOffset ?? ((Math.random() - 0.5) * 40),
    rotation = config.rotation ?? ((Math.random() - 0.5) * 6),
    delay = config.delay ?? Math.random() * 40, // Случайное начало цикла
  } = config;

  // Шар должен гарантированно выйти за верхнюю границу экрана до того,
  // как замкнётся цикл. Иначе при повторе он «телепортировался» бы обратно
  // вниз, ещё не долетев до края (шар исчезал на середине видимого пути).
  const startTop = element.getBoundingClientRect().top + window.scrollY;
  const balloonHeight = element.offsetHeight + 120;
  const riseDistance =
    Math.max(
      window.innerHeight * 2,
      startTop + balloonHeight + window.innerHeight,
    ) + yOffset;

  const tl = gsap.timeline({ repeat: -1, delay });

  // fromTo для плавного зацикливания — шар поднимается дальше,
  // чем нужно, чтобы к моменту повторного цикла он был за экраном
  tl.fromTo(
    element,
    {
      y: 0,
      x: 0,
      rotation: 0,
    },
    {
      y: -riseDistance, // Поднимаем далеко вверх (гарантированно за экран)
      x: xOffset,
      rotation,
      duration,
      ease: 'none',
      modifiers: {
        // Волнистая траектория
        x: (x: string) => {
          const progress = gsap.getProperty(element, 'y') as number;
          const normalized = Math.abs(progress) / riseDistance;
          const wave = Math.sin(normalized * Math.PI * 3) * 20;
          return parseFloat(x) + wave + 'px';
        },
      },
    }
  );

  return tl;
}

/**
 * Creates approach/departure animation for balloons that pass close to camera
 */
export function createBalloonApproach(
  element: HTMLElement,
  scrollTrigger: {
    trigger: HTMLElement | string;
    start?: string;
    end?: string;
  },
) {
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: scrollTrigger.trigger,
      start: scrollTrigger.start || 'top center',
      end: scrollTrigger.end || 'bottom center',
      scrub: 1.5,
    },
  });

  tl.to(element, {
    scale: '+=0.3',
    y: -80,
    ease: 'power1.inOut',
  });

  return tl;
}
