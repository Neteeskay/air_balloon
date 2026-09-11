import { gsap } from './gsapSetup';

export interface CameraMovementConfig {
  foregroundClouds: HTMLElement[];
  middleClouds: HTMLElement[];
  backgroundClouds: HTMLElement[];
  overlay: HTMLElement;
  duration?: number;
}

export function createCameraMovement(config: CameraMovementConfig) {
  const {
    foregroundClouds,
    middleClouds,
    backgroundClouds,
    overlay,
    duration = 3,
  } = config;

  const tl = gsap.timeline();

  // Lighting transition
  tl.to(
    overlay,
    {
      opacity: 0,
      duration: duration * 0.85,
      ease: 'power2.inOut',
    },
    0,
  );

  // Foreground clouds - fastest and largest scale
  foregroundClouds.forEach((cloud, i) => {
    tl.to(
      cloud,
      {
        scale: 1.5,
        x: i % 2 === 0 ? -300 : 300,
        y: -100,
        opacity: 0,
        duration: duration * 0.67,
        ease: 'power2.out',
      },
      i * 0.15,
    );
  });

  // Middle clouds
  middleClouds.forEach((cloud, i) => {
    tl.to(
      cloud,
      {
        scale: 1.2,
        y: -150,
        opacity: 0,
        duration: duration * 0.83,
        ease: 'power1.out',
      },
      0.3 + i * 0.2,
    );
  });

  // Background clouds - slowest
  backgroundClouds.forEach((cloud, i) => {
    tl.to(
      cloud,
      {
        y: -100,
        opacity: 0,
        duration: duration,
        ease: 'power1.out',
      },
      0.5 + i * 0.25,
    );
  });

  return tl;
}
