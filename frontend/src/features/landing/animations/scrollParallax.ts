import { gsap } from './gsapSetup';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PARALLAX_LAYERS } from './parallax';

export interface ScrollParallaxConfig {
  trigger: HTMLElement | string;
  layers: {
    background?: HTMLElement[];
    middle?: HTMLElement[];
    foreground?: HTMLElement[];
    balloons?: HTMLElement[];
  };
}

export function createScrollParallax(config: ScrollParallaxConfig) {
  const { trigger, layers } = config;

  const animations: gsap.core.Tween[] = [];

  // Background clouds - slowest movement
  if (layers.background) {
    layers.background.forEach((cloud) => {
      const anim = gsap.to(cloud, {
        y: () => -window.innerHeight * PARALLAX_LAYERS.background,
        ease: 'none',
        scrollTrigger: {
          trigger,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      });
      animations.push(anim);
    });
  }

  // Middle clouds - medium speed
  if (layers.middle) {
    layers.middle.forEach((cloud) => {
      const anim = gsap.to(cloud, {
        y: () => -window.innerHeight * PARALLAX_LAYERS.middle,
        ease: 'none',
        scrollTrigger: {
          trigger,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      });
      animations.push(anim);
    });
  }

  // Foreground clouds - fastest movement
  if (layers.foreground) {
    layers.foreground.forEach((cloud) => {
      const anim = gsap.to(cloud, {
        y: () => -window.innerHeight * PARALLAX_LAYERS.foreground,
        ease: 'none',
        scrollTrigger: {
          trigger,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      });
      animations.push(anim);
    });
  }

  // Balloons - medium-fast movement
  if (layers.balloons) {
    layers.balloons.forEach((balloon) => {
      const anim = gsap.to(balloon, {
        y: () => -window.innerHeight * PARALLAX_LAYERS.balloons,
        ease: 'none',
        scrollTrigger: {
          trigger,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      });
      animations.push(anim);
    });
  }

  return {
    kill: () => {
      animations.forEach((anim) => anim.kill());
      ScrollTrigger.getAll().forEach((st) => {
        if (st.vars.trigger === trigger) {
          st.kill();
        }
      });
    },
  };
}
