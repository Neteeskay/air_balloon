import { gsap } from './gsapSetup';

export interface BalloonPathConfig {
  duration?: number;
  yOffset?: number;
  xOffset?: number;
  rotation?: number;
  delay?: number;
  scaleVariation?: number;
  /** Амплитуда волны в px (по умолчанию 14-30) */
  wave?: number;
  /** Частота волны, число полупериодов на весь путь */
  waveFrequency?: number;
}

/**
 * Creates smooth floating animation for hot air balloons.
 * Balloons continuously rise upward with wave motion.
 *
 * The loop only restarts at a position BELOW the bottom edge of the page
 * (and exits above the top edge), so a balloon never visibly "reappears"
 * in the middle of the screen.
 */
export function createBalloonPath(
  element: HTMLElement,
  config: BalloonPathConfig = {},
) {
  const {
    duration = 90 + Math.random() * 70, // 90-160s для полного цикла (медленно)
    yOffset = 0,
    xOffset = config.xOffset ?? ((Math.random() - 0.5) * 40),
    rotation = config.rotation ?? ((Math.random() - 0.5) * 6),
    delay = config.delay ?? Math.random() * 40, // Лёгкая рассинхронизация старта
    wave = config.wave ?? (14 + Math.random() * 16), // Амплитуда волны 14-30px
    waveFrequency = config.waveFrequency ?? 4, // Частота волны на весь путь
  } = config;

  // Слой (balloon-layer) растянут на всю страницу — его высота = высота сайта.
  const layer = element.offsetParent as HTMLElement | null;
  const pageHeight =
    layer?.offsetHeight ??
    element.parentElement?.offsetHeight ??
    window.innerHeight * 3;

  // Позиция шара от верхней границы сайта (offsetTop не зависит от scale).
  const startTop = element.offsetTop;
  // Полная высота шара с запасом, чтобы он полностью скрывался за краем.
  const balloonBodyHeight = element.offsetHeight + 120;

  // Нижняя точка цикла: шар полностью ниже нижней границы сайта.
  const bottomY = pageHeight - startTop + balloonBodyHeight + yOffset;
  // Верхняя точка цикла: шар полностью выше верхней границы сайта.
  const topY = -(startTop + balloonBodyHeight + yOffset);
  const travel = bottomY - topY;

  const tl = gsap.timeline({ repeat: -1 });

  // fromTo: цикл начинается снизу (за нижней границей) и заканчивается
  // сверху (за верхней границей). При репите шар оказывается снова за
  // нижней границей — «появление» невидимо для зрителя.
  tl.fromTo(
    element,
    {
      y: bottomY,
      x: 0,
      rotation: 0,
    },
    {
      y: topY,
      x: xOffset,
      rotation,
      duration,
      ease: 'none',
      modifiers: {
        // Волнистая траектория (амплитуда/частота настраиваются на шар)
        x: (x: string) => {
          const currentY = gsap.getProperty(element, 'y') as number;
          const normalized = (bottomY - currentY) / travel;
          const waveOffset = Math.sin(normalized * Math.PI * waveFrequency) * wave;
          return parseFloat(x) + waveOffset + 'px';
        },
      },
    }
  );

  // Стартуем с фазы, когда шар стоит на своей DOM-позиции (startTop),
  // а не за нижней границей — иначе при загрузке все шары были бы скрыты.
  // delay добавляет лёгкую рассинхронизацию между шарами.
  const anchorProgress = bottomY / travel;
  tl.progress((anchorProgress + delay / duration) % 1);

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
