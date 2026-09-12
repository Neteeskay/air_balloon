import { gsap } from './gsapSetup';

export interface FloatingConfig {
  duration?: number;
  yOffset?: number;
  rotation?: number;
  delay?: number;
}

export function createFloatingAnimation(
  element: HTMLElement,
  config: FloatingConfig = {},
) {
  const {
    duration = 3 + Math.random() * 2, // 3-5 seconds
    yOffset = 20 + Math.random() * 10, // 20-30px
    rotation = 5 + Math.random() * 5, // 5-10 degrees
    delay = Math.random() * 2, // 0-2 seconds
  } = config;

  const tl = gsap.timeline({
    repeat: -1,
    yoyo: true,
    delay,
  });

  tl.to(element, {
    y: -yOffset,
    rotation: rotation,
    duration: duration,
    ease: 'sine.inOut',
  });

  return tl;
}
