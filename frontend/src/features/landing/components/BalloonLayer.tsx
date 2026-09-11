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
          delay: 0, // Убираем delay - шары сразу видны
          xOffset: balloon.pathConfig?.xOffset,
          yOffset: balloon.pathConfig?.yOffset,
          rotation: balloon.pathConfig?.rotation,
        });

        // Когда шар вылетает сверху, телепортируем его вниз
        const checkBounds = () => {
          const rect = el.getBoundingClientRect();

          // Шар вылетел за верхнюю границу - возвращаем вниз
          if (rect.bottom < -200) {
            // Сбрасываем трансформы GSAP и возвращаем на стартовую позицию
            gsap.set(el, {
              y: 0,
              x: 0,
              rotation: 0,
            });
          }
        };

        // Проверяем границы каждые 2 секунды
        const interval = setInterval(checkBounds, 2000);

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
          willChange: 'transform',
          opacity: 1, // Всегда видны
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
