import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { createBalloonPath } from '../animations/balloonPath';
import { SPRITES } from '../config/sprites';
import type { BalloonColor } from '../config/sprites';

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

        return createBalloonPath(el, {
          delay: balloon.floatDelay,
          xOffset: balloon.pathConfig?.xOffset,
          yOffset: balloon.pathConfig?.yOffset,
          rotation: balloon.pathConfig?.rotation,
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
