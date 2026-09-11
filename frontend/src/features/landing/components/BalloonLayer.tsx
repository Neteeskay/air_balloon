import { CSSProperties, useEffect, useRef } from 'react';
import { createBalloonPath } from '../animations/balloonPath';
import { SPRITES } from '../config/sprites';
import type { BalloonColor } from '../config/sprites';
import { gsap } from '../animations/gsapSetup';

export interface Balloon {
  id: string;
  color: BalloonColor;
  x: number; // % от ширины viewport
  y: number; // % от высоты viewport
  scale: number;
  floatDelay?: number;
  pathConfig?: {
    xOffset?: number;
    yOffset?: number;
    rotation?: number;
  };
}

export interface BalloonLayerProps {
  balloons: Balloon[];
  className?: string;
}

export function BalloonLayer({ balloons, className = '' }: BalloonLayerProps) {
  const balloonsRef = useRef<(HTMLImageElement | null)[]>([]);

  useEffect(() => {
    const animations = balloonsRef.current
      .filter((el): el is HTMLImageElement => el !== null)
      .map((el, index) => {
        const balloon = balloons[index];
        if (!balloon) return null;

        const animation = createBalloonPath(el, {
          delay: balloon.floatDelay || Math.random() * 2,
          xOffset: balloon.pathConfig?.xOffset,
          yOffset: balloon.pathConfig?.yOffset,
          rotation: balloon.pathConfig?.rotation,
        });

        // Отслеживаем позицию шара и плавно скрываем когда он вылетает за границу
        const checkBounds = () => {
          const rect = el.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const viewportWidth = window.innerWidth;

          // Шар вылетел за верхнюю границу
          if (rect.bottom < -100) {
            gsap.to(el, { opacity: 0, duration: 1, ease: 'power2.out' });
          }
          // Шар вылетел за нижнюю границу
          else if (rect.top > viewportHeight + 100) {
            gsap.to(el, { opacity: 0, duration: 1, ease: 'power2.out' });
          }
          // Шар вылетел за левую границу
          else if (rect.right < -100) {
            gsap.to(el, { opacity: 0, duration: 1, ease: 'power2.out' });
          }
          // Шар вылетел за правую границу
          else if (rect.left > viewportWidth + 100) {
            gsap.to(el, { opacity: 0, duration: 1, ease: 'power2.out' });
          }
          // Шар в пределах видимости (с запасом)
          else {
            gsap.to(el, { opacity: 1, duration: 0.5, ease: 'power2.in' });
          }
        };

        // Проверяем границы каждые 500ms
        const interval = setInterval(checkBounds, 500);

        return { animation, interval };
      })
      .filter((anim): anim is { animation: ReturnType<typeof createBalloonPath>, interval: NodeJS.Timeout } => anim !== null);

    return () => {
      animations.forEach(({ animation, interval }) => {
        animation.kill();
        clearInterval(interval);
      });
    };
  }, [balloons]);

  return (
    <div className={`balloon-layer ${className}`}>
      {balloons.map((balloon, index) => {
        const style: CSSProperties = {
          position: 'absolute',
          left: `${balloon.x}%`,
          top: `${balloon.y}%`,
          transform: `scale(${balloon.scale})`,
          willChange: 'transform, opacity',
          opacity: 1,
        };

        return (
          <img
            key={balloon.id}
            ref={(el) => (balloonsRef.current[index] = el)}
            src={SPRITES.balloons[balloon.color]}
            alt=""
            className={`balloon balloon--${balloon.color}`}
            style={style}
          />
        );
      })}
    </div>
  );
}
