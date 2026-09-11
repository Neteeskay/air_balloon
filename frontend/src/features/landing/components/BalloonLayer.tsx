import { CSSProperties, useEffect, useRef } from 'react';
import { createFloatingAnimation } from '../animations/floating';
import { SPRITES } from '../config/sprites';
import type { BalloonColor } from '../config/sprites';

export interface Balloon {
  id: string;
  color: BalloonColor;
  x: number; // % от ширины viewport
  y: number; // % от высоты viewport
  scale: number;
  floatDelay?: number;
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
        return createFloatingAnimation(el, {
          delay: balloon.floatDelay || Math.random() * 2,
        });
      })
      .filter((anim): anim is ReturnType<typeof createFloatingAnimation> => anim !== null);

    return () => {
      animations.forEach((anim) => anim.kill());
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
