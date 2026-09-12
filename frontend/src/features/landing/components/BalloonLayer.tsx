import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { createBalloonPath } from '../animations/balloonPath';
import { SPRITES } from '../config/sprites';
import type { BalloonVariant } from '../config/sprites';

export interface Balloon {
  id: string;
  variant: BalloonVariant;
  x: number; // % от ширины viewport
  y: number; // % от высоты viewport
  scale: number;
  floatDelay?: number;
  pathConfig?: {
    xOffset?: number;
    yOffset?: number;
    rotation?: number;
    /** Скорость: длительность полного цикла, сек (меньше = быстрее) */
    duration?: number;
    /** Амплитуда волнистого движения, px */
    wave?: number;
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

        return createBalloonPath(el, {
          delay: balloon.floatDelay,
          xOffset: balloon.pathConfig?.xOffset,
          yOffset: balloon.pathConfig?.yOffset,
          rotation: balloon.pathConfig?.rotation,
          duration: balloon.pathConfig?.duration,
          wave: balloon.pathConfig?.wave,
        });
      })
      .filter((anim): anim is ReturnType<typeof createBalloonPath> => anim !== null);

    return () => {
      animations.forEach((anim) => {
        anim.kill();
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
        };

        return (
          <img
            key={balloon.id}
            ref={(el) => (balloonsRef.current[index] = el)}
            src={SPRITES.balloons[balloon.variant]}
            alt=""
            className={`balloon balloon--${balloon.variant}`}
            style={style}
          />
        );
      })}
    </div>
  );
}
