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
 * Balloons drift slowly and gracefully like real aircraft
 */
export function createBalloonPath(
  element: HTMLElement,
  config: BalloonPathConfig = {},
) {
  const {
    duration = 6 + Math.random() * 4, // 6-10 seconds - медленнее, плавнее
    yOffset = 15 + Math.random() * 10, // 15-25px - меньшее вертикальное движение
    xOffset = (Math.random() - 0.5) * 30, // -15 to +15px - лёгкий дрейф
    rotation = (Math.random() - 0.5) * 6, // -3 to +3 degrees - очень лёгкое покачивание
    delay = Math.random() * 2,
    scaleVariation = 0.02 + Math.random() * 0.03, // 0.02-0.05 - едва заметное изменение масштаба
  } = config;

  const tl = gsap.timeline({
    repeat: -1,
    yoyo: true,
    delay,
  });

  // Плавное S-образное движение (как настоящий воздушный шар)
  tl.to(element, {
    y: -yOffset * 0.4,
    x: xOffset * 0.2,
    rotation: rotation * 0.3,
    scale: `+=${scaleVariation * 0.5}`,
    duration: duration * 0.25,
    ease: 'sine.inOut',
  })
    .to(element, {
      y: -yOffset * 0.7,
      x: xOffset * 0.6,
      rotation: rotation * 0.7,
      scale: `+=${scaleVariation * 0.3}`,
      duration: duration * 0.3,
      ease: 'sine.inOut',
    })
    .to(element, {
      y: -yOffset,
      x: xOffset,
      rotation: rotation,
      scale: `+=${scaleVariation * 0.2}`,
      duration: duration * 0.25,
      ease: 'sine.inOut',
    })
    .to(element, {
      y: -yOffset * 0.8,
      x: xOffset * 0.7,
      rotation: rotation * 0.6,
      scale: `-=${scaleVariation * 0.3}`,
      duration: duration * 0.2,
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

