import { useEffect, useRef } from 'react';
import { CloudLayer, type Cloud } from '../components/CloudLayer';
import { gsap } from '../animations/gsapSetup';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LIGHTING } from '../animations/lighting';

// Massive foreground clouds that user starts inside
const INTRO_CLOUDS_FG: Cloud[] = [
  { id: 'intro-fg-1', x: 5, y: 15, scale: 1.8, size: 'large' },
  { id: 'intro-fg-2', x: 55, y: 35, scale: 2.0, size: 'large' },
  { id: 'intro-fg-3', x: 70, y: 5, scale: 1.6, size: 'large' },
  { id: 'intro-fg-4', x: 20, y: 55, scale: 1.7, size: 'medium' },
];

// Middle layer clouds
const INTRO_CLOUDS_MID: Cloud[] = [
  { id: 'intro-md-1', x: 25, y: 45, scale: 1.2, size: 'medium' },
  { id: 'intro-md-2', x: 50, y: 10, scale: 1.3, size: 'medium' },
  { id: 'intro-md-3', x: 75, y: 40, scale: 1.1, size: 'medium' },
  { id: 'intro-md-4', x: 35, y: 70, scale: 1.15, size: 'small' },
];

// Background clouds
const INTRO_CLOUDS_BG: Cloud[] = [
  { id: 'intro-bg-1', x: 15, y: 25, scale: 0.9, size: 'small' },
  { id: 'intro-bg-2', x: 40, y: 50, scale: 0.95, size: 'small' },
  { id: 'intro-bg-3', x: 65, y: 20, scale: 0.85, size: 'small' },
  { id: 'intro-bg-4', x: 80, y: 65, scale: 0.8, size: 'small' },
];

export function CloudIntro() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !overlayRef.current) return;

    const section = sectionRef.current;
    const overlay = overlayRef.current;

    // Get cloud layers
    const fgClouds = Array.from(
      section.querySelectorAll('.intro-clouds-fg .cloud'),
    ) as HTMLElement[];

    const midClouds = Array.from(
      section.querySelectorAll('.intro-clouds-mid .cloud'),
    ) as HTMLElement[];

    const bgClouds = Array.from(
      section.querySelectorAll('.intro-clouds-bg .cloud'),
    ) as HTMLElement[];

    // Create scroll-driven camera movement timeline
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: 'bottom top',
        scrub: 1,
      },
    });

    // Lighting transition - from dark to bright
    tl.to(
      overlay,
      {
        opacity: 0,
        ease: 'power2.inOut',
      },
      0,
    );

    // Foreground clouds - explode outward and scale up (camera moving forward)
    fgClouds.forEach((cloud, i) => {
      const direction = i % 2 === 0 ? -1 : 1;
      tl.to(
        cloud,
        {
          scale: 2.5,
          x: direction * 400,
          y: -300,
          opacity: 0,
          ease: 'power2.out',
        },
        0,
      );
    });

    // Middle clouds - medium scale and movement
    midClouds.forEach((cloud, i) => {
      const direction = i % 2 === 0 ? -1 : 1;
      tl.to(
        cloud,
        {
          scale: 1.8,
          x: direction * 250,
          y: -200,
          opacity: 0,
          ease: 'power1.out',
        },
        0,
      );
    });

    // Background clouds - slow drift upward
    bgClouds.forEach((cloud) => {
      tl.to(
        cloud,
        {
          y: -150,
          opacity: 0,
          ease: 'power1.out',
        },
        0,
      );
    });

    return () => {
      tl.kill();
      ScrollTrigger.getAll().forEach((st) => {
        if (st.vars.trigger === section) {
          st.kill();
        }
      });
    };
  }, []);

  return (
    <section ref={sectionRef} className="cloud-intro">
      {/* Dark overlay that fades as we exit clouds */}
      <div
        ref={overlayRef}
        className="cloud-intro__overlay"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: `rgba(0, 0, 0, ${LIGHTING.dark})`,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />

      {/* Cloud layers */}
      <CloudLayer
        depth="background"
        clouds={INTRO_CLOUDS_BG}
        className="intro-clouds-bg"
      />

      <CloudLayer
        depth="middle"
        clouds={INTRO_CLOUDS_MID}
        className="intro-clouds-mid"
      />

      <CloudLayer
        depth="foreground"
        clouds={INTRO_CLOUDS_FG}
        className="intro-clouds-fg"
      />
    </section>
  );
}
