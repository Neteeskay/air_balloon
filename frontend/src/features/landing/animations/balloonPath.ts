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
 * Creates smooth, realistic floating animation for hot air balloons
 * Balloons rise continuously with infinite seamless loop
 */
export function createBalloonPath(
  element: HTMLElement,
  config: BalloonPathConfig = {},
) {
  const {
    duration = 30 + Math.random() * 15, // 30-45 seconds
    xOffset = config.xOffset || ((Math.random() - 0.5) * 60),
    rotation = config.rotation || ((Math.random() - 0.5) * 8),
    delay = Math.random() * duration, // Случайная стартовая позиция в цикле
  } = config;

  // Получаем начальную позицию элемента
  const initialY = parseFloat(getComputedStyle(element).top);
  const viewportHeight = window.innerHeight;

  // Конечная точка - далеко за верхом экрана
  const endY = -viewportHeight * 1.5;

  // Стартовая точка - начальная позиция элемента
  const startY = initialY;

  // Бесконечная анимация с yoyo:false для бесшовного цикла
  const tl = gsap.timeline({
    repeat: -1,
    delay: delay,
    onRepeat: () => {
      // При повторе сбрасываем на начальную позицию без видимого прыжка
      gsap.set(element, { y: 0, x: 0, rotation: 0 });
    }
  });

  // Плавный подъём вверх
  tl.to(element, {
    y: endY - startY, // Относительное смещение вверх
    x: xOffset,
    rotation: rotation,
    duration: duration,
    ease: 'none',
    modifiers: {
      // Волнистость по X
      x: function(x) {
        const progress = tl.progress();
        const wave = Math.sin(progress * Math.PI * 3) * 25;
        return parseFloat(x) + wave + 'px';
      }
    }
  });

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
      scrub: 1.5, // Более плавный scrub для реалистичности
    },
  });

  // Balloon approaches camera (gets larger) very smoothly
  tl.to(element, {
    scale: '+=0.3',
    y: -80,
    ease: 'power1.inOut',
  });

  return tl;
}

