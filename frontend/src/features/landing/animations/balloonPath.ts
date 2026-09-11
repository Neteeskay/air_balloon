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
 * Balloons rise slowly from bottom to top with gentle wave motion
 */
export function createBalloonPath(
  element: HTMLElement,
  config: BalloonPathConfig = {},
) {
  const {
    duration = 20 + Math.random() * 10, // 20-30 seconds - очень медленное движение вверх
    yOffset = config.yOffset || (15 + Math.random() * 10), // Вертикальное смещение
    xOffset = config.xOffset || ((Math.random() - 0.5) * 30), // Горизонтальное волнистое движение
    rotation = config.rotation || ((Math.random() - 0.5) * 6), // -3 to +3 degrees
    delay = config.delay || Math.random() * 2,
    scaleVariation = 0.01 + Math.random() * 0.02, // Едва заметное изменение масштаба
  } = config;

  const tl = gsap.timeline({
    repeat: -1,
    delay,
  });

  // Плавное волнистое движение снизу вверх (без yoyo - только вверх)
  tl.to(element, {
    y: yOffset * 0.3,
    x: xOffset * 0.2,
    rotation: rotation * 0.3,
    scale: `+=${scaleVariation * 0.5}`,
    duration: duration * 0.25,
    ease: 'sine.inOut',
  })
    .to(element, {
      y: yOffset * 0.6,
      x: xOffset * 0.6,
      rotation: rotation * 0.7,
      scale: `+=${scaleVariation * 0.3}`,
      duration: duration * 0.25,
      ease: 'sine.inOut',
    })
    .to(element, {
      y: yOffset * 0.85,
      x: xOffset * 0.9,
      rotation: rotation * 0.9,
      scale: `+=${scaleVariation * 0.2}`,
      duration: duration * 0.25,
      ease: 'sine.inOut',
    })
    .to(element, {
      y: yOffset,
      x: xOffset,
      rotation: rotation,
      scale: `-=${scaleVariation}`,
      duration: duration * 0.25,
      ease: 'sine.inOut',
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

