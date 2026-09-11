import { useEffect, useRef } from 'react';
import { CloudLayer, type Cloud } from '../components/CloudLayer';
import { BalloonLayer, type Balloon } from '../components/BalloonLayer';
import { CONTENT } from '../config/content';
import { gsap } from '../animations/gsapSetup';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LIGHTING } from '../animations/lighting';
import { createScrollParallax } from '../animations/scrollParallax';

// INTRO: Massive clouds that user starts inside (explode on entry)
const INTRO_CLOUDS_FG: Cloud[] = [
  { id: 'intro-fg-1', x: 10, y: 20, scale: 2.5, cloudNum: 1 },
  { id: 'intro-fg-2', x: 60, y: 40, scale: 2.8, cloudNum: 3 },
  { id: 'intro-fg-3', x: 75, y: 10, scale: 2.3, cloudNum: 5 },
  { id: 'intro-fg-4', x: 25, y: 60, scale: 2.6, cloudNum: 7 },
];

const INTRO_CLOUDS_MID: Cloud[] = [
  { id: 'intro-md-1', x: 30, y: 50, scale: 1.7, cloudNum: 8 },
  { id: 'intro-md-2', x: 70, y: 30, scale: 1.6, cloudNum: 9 },
  { id: 'intro-md-3', x: 45, y: 70, scale: 1.5, cloudNum: 10 },
];

// HERO: Background clouds (slow parallax during scroll)
const HERO_CLOUDS_BG: Cloud[] = [
  { id: 'hero-bg-1', x: 5, y: 25, scale: 0.5, cloudNum: 12 },
  { id: 'hero-bg-2', x: 75, y: 65, scale: 0.45, cloudNum: 13 },
  { id: 'hero-bg-3', x: 88, y: 35, scale: 0.4, cloudNum: 14 },
  { id: 'hero-bg-4', x: 20, y: 80, scale: 0.48, cloudNum: 15 },
];

// HERO: Middle clouds (medium parallax)
const HERO_CLOUDS_MID: Cloud[] = [
  { id: 'hero-md-1', x: 12, y: 40, scale: 0.75, cloudNum: 8 },
  { id: 'hero-md-2', x: 78, y: 55, scale: 0.8, cloudNum: 9 },
  { id: 'hero-md-3', x: 50, y: 15, scale: 0.7, cloudNum: 10 },
  { id: 'hero-md-4', x: 35, y: 75, scale: 0.72, cloudNum: 11 },
];

// HERO: Foreground clouds (fast parallax, pass close)
const HERO_CLOUDS_FG: Cloud[] = [
  { id: 'hero-fg-1', x: 8, y: 78, scale: 1.1, cloudNum: 2 },
  { id: 'hero-fg-2', x: 82, y: 72, scale: 1.0, cloudNum: 4 },
];

// Balloons with varied trajectories
const HERO_BALLOONS: Balloon[] = [
  {
    id: 'hero-b-1',
    color: 'red',
    x: 7,
    y: 32,
    scale: 0.55,
    floatDelay: 0,
    pathConfig: { xOffset: -20, yOffset: 18, rotation: -4 }
  },
  {
    id: 'hero-b-2',
    color: 'green',
    x: 89,
    y: 42,
    scale: 0.7,
    floatDelay: 0.8,
    pathConfig: { xOffset: 25, yOffset: 22, rotation: 5 }
  },
  {
    id: 'hero-b-3',
    color: 'red',
    x: 11,
    y: 68,
    scale: 0.5,
    floatDelay: 1.5,
    pathConfig: { xOffset: 15, yOffset: 16, rotation: 3 }
  },
  {
    id: 'hero-b-4',
    color: 'green',
    x: 91,
    y: 80,
    scale: 0.58,
    floatDelay: 2.2,
    pathConfig: { xOffset: -18, yOffset: 20, rotation: -3 }
  },
  {
    id: 'hero-b-5',
    color: 'red',
    x: 4,
    y: 52,
    scale: 0.48,
    floatDelay: 1.2,
    pathConfig: { xOffset: 12, yOffset: 15, rotation: 2 }
  },
];

export function Hero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !overlayRef.current || !contentRef.current) return;

    const section = sectionRef.current;
    const overlay = overlayRef.current;
    const content = contentRef.current;

    // INTRO EXPLOSION: Clouds explode outward on page load/scroll start
    const introClouds = Array.from(
      section.querySelectorAll('.intro-clouds-fg .cloud, .intro-clouds-mid .cloud'),
    ) as HTMLElement[];

    const introTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '40% top',
        scrub: 1.2,
      },
    });

    // Lighting transition (dark → light)
    introTimeline.to(overlay, {
      opacity: 0,
      ease: 'power2.inOut',
    }, 0);

    // Intro clouds EXPLODE outward dramatically
    introClouds.forEach((cloud, i) => {
      const isForeground = cloud.closest('.intro-clouds-fg');
      const direction = i % 2 === 0 ? -1 : 1;
      const angle = (i / introClouds.length) * Math.PI * 2; // Распределить по окружности

      introTimeline.to(cloud, {
        scale: isForeground ? 3.5 : 2.5,
        x: direction * (isForeground ? 600 : 400) + Math.cos(angle) * 100,
        y: (isForeground ? -500 : -300) + Math.sin(angle) * 100,
        rotation: direction * 15,
        opacity: 0,
        ease: 'power2.out',
      }, 0);
    });

    // Content fades in as clouds clear
    introTimeline.fromTo(content, {
      opacity: 0,
      y: 40,
      scale: 0.95,
    }, {
      opacity: 1,
      y: 0,
      scale: 1,
      ease: 'power2.out',
    }, 0.4);

    // HERO PARALLAX: Continuous smooth movement during scroll
    const bgClouds = Array.from(
      section.querySelectorAll('.hero-clouds-bg .cloud'),
    ) as HTMLElement[];

    const midClouds = Array.from(
      section.querySelectorAll('.hero-clouds-mid .cloud'),
    ) as HTMLElement[];

    const fgClouds = Array.from(
      section.querySelectorAll('.hero-clouds-fg .cloud'),
    ) as HTMLElement[];

    const balloons = Array.from(
      section.querySelectorAll('.balloon'),
    ) as HTMLElement[];

    const parallax = createScrollParallax({
      trigger: section,
      layers: {
        background: bgClouds,
        middle: midClouds,
        foreground: fgClouds,
        balloons,
      },
    });

    return () => {
      introTimeline.kill();
      parallax.kill();
      ScrollTrigger.getAll().forEach((st) => {
        if (st.vars.trigger === section) {
          st.kill();
        }
      });
    };
  }, []);

  return (
    <section ref={sectionRef} className="hero">
      {/* Dark overlay (fades as clouds clear) */}
      <div
        ref={overlayRef}
        className="hero__overlay"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: `rgba(0, 0, 0, ${LIGHTING.dark})`,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />

      {/* INTRO clouds (explode on entry) */}
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

      {/* HERO clouds (smooth parallax during scroll) */}
      <CloudLayer depth="background" clouds={HERO_CLOUDS_BG} className="hero-clouds-bg" />
      <CloudLayer depth="middle" clouds={HERO_CLOUDS_MID} className="hero-clouds-mid" />
      <CloudLayer depth="foreground" clouds={HERO_CLOUDS_FG} className="hero-clouds-fg" />

      {/* Content */}
      <div ref={contentRef} className="hero__content">
        <h1 className="hero__title">{CONTENT.hero.title}</h1>
        <p className="hero__subtitle">{CONTENT.hero.subtitle}</p>
        <p className="hero__description">{CONTENT.hero.description}</p>
        <button className="hero__cta button button--primary">
          {CONTENT.hero.cta}
        </button>
      </div>

      <BalloonLayer balloons={HERO_BALLOONS} />
    </section>
  );
}
