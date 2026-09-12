import { useEffect, useRef } from 'react';
import { gsap } from '../animations/gsapSetup';

const SCREEN_COUNT = 3;
const TRANSITION_DURATION = 0.65;
const WHEEL_THRESHOLD = 44;
const TOUCH_THRESHOLD = 32;
const POST_TRANSITION_COOLDOWN_MS = 180;
const LOCK_CLASS = 'landing-lock-scroll';

export function useScreenSwipe(screenCount = SCREEN_COUNT) {
  const currentRef = useRef(0);
  const lockedRef = useRef(false);

  useEffect(() => {
    let pulse = 0;
    let touchStartY: number | null = null;
    let touchConsumed = false;
    let cooldownUntil = 0;
    let tween: ReturnType<typeof gsap.to> | null = null;

    const root = document.documentElement;
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    root.classList.add(LOCK_CLASS);

    const clamp = (value: number) =>
      Math.max(0, Math.min(value, screenCount - 1));

    const markActiveScreen = (index: number) => {
      root.dataset.landingScreen = String(clamp(index));
    };

    const isBlocked = () =>
      lockedRef.current || performance.now() < cooldownUntil;

    const scrollToY = (y: number) => {
      window.scrollTo(0, Math.round(y));
    };

    const snapTo = (index: number) => {
      if (tween) {
        tween.kill();
        tween = null;
      }
      lockedRef.current = false;
      cooldownUntil = 0;
      currentRef.current = clamp(index);
      markActiveScreen(currentRef.current);
      scrollToY(currentRef.current * window.innerHeight);
    };

    const goTo = (index: number) => {
      const target = clamp(index);
      if (target === currentRef.current) return;

      lockedRef.current = true;
      if (tween) tween.kill();

      const proxy = { y: window.scrollY };
      const targetY = target * window.innerHeight;

      tween = gsap.to(proxy, {
        y: targetY,
        duration: TRANSITION_DURATION,
        ease: 'power2.inOut',
        onUpdate: () => {
          scrollToY(proxy.y);
        },
        onComplete: () => {
          currentRef.current = target;
          markActiveScreen(target);
          lockedRef.current = false;
          cooldownUntil = performance.now() + POST_TRANSITION_COOLDOWN_MS;
          tween = null;
        },
      });
    };

    const onWheel = (event: WheelEvent) => {
      if (isBlocked() || event.ctrlKey || event.metaKey || event.altKey) {
        event.preventDefault();
        return;
      }

      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      const dy = event.deltaY * unit;
      if (dy === 0) return;

      event.preventDefault();
      pulse += dy;
      if (Math.abs(pulse) < WHEEL_THRESHOLD) return;

      const delta: 1 | -1 = pulse > 0 ? 1 : -1;
      pulse = 0;
      goTo(currentRef.current + delta);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (isBlocked()) return;
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!touch) return;
      touchStartY = touch.clientY;
      touchConsumed = false;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (isBlocked()) {
        event.preventDefault();
        return;
      }
      if (touchStartY === null || touchConsumed) return;

      const touch = event.touches[0];
      if (!touch) return;

      const dy = touch.clientY - touchStartY;
      if (Math.abs(dy) < TOUCH_THRESHOLD) return;

      event.preventDefault();
      touchConsumed = true;
      touchStartY = null;
      goTo(currentRef.current + (dy > 0 ? -1 : 1));
    };

    const onTouchEnd = () => {
      touchStartY = null;
    };

    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.isContentEditable ||
        target.closest('input, textarea, select, button, a') !== null
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isBlocked()) return;
      if (isEditableTarget(event.target)) return;

      if (
        event.key === 'ArrowDown' ||
        event.key === 'PageDown' ||
        event.key === ' '
      ) {
        event.preventDefault();
        goTo(currentRef.current + 1);
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        goTo(currentRef.current - 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        goTo(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        goTo(screenCount - 1);
      }
    };

    const onResize = () => {
      snapTo(Math.round(window.scrollY / window.innerHeight));
    };

    const onScroll = () => {
      currentRef.current = clamp(
        Math.round(window.scrollY / window.innerHeight),
      );
      markActiveScreen(currentRef.current);
    };

    snapTo(0);
    const initialSnapFrame = window.requestAnimationFrame(() => snapTo(0));

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      if (tween) tween.kill();
      window.cancelAnimationFrame(initialSnapFrame);
      window.history.scrollRestoration = previousScrollRestoration;
      root.classList.remove(LOCK_CLASS);
      delete root.dataset.landingScreen;
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
    };
  }, [screenCount]);
}
