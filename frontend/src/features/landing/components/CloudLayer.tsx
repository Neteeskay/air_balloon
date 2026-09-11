import { CSSProperties } from 'react';
import { CLOUD_DEPTH, type CloudDepth } from '../animations/cloudDepth';
import { SPRITES } from '../config/sprites';

export interface Cloud {
  id: string;
  x: number; // % от ширины viewport
  y: number; // % от высоты viewport
  scale: number;
  cloudNum: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;
}

export interface CloudLayerProps {
  depth: CloudDepth;
  clouds: Cloud[];
  className?: string;
}

export function CloudLayer({ depth, clouds, className = '' }: CloudLayerProps) {
  const depthConfig = CLOUD_DEPTH[depth];

  return (
    <div className={`cloud-layer cloud-layer--${depth} ${className}`}>
      {clouds.map((cloud) => {
        const style: CSSProperties = {
          position: 'absolute',
          left: `${cloud.x}%`,
          top: `${cloud.y}%`,
          transform: `scale(${cloud.scale})`,
          filter: depthConfig.blur > 0 ? `blur(${depthConfig.blur}px)` : 'none',
          opacity: depthConfig.opacity,
          willChange: 'transform, opacity',
        };

        return (
          <img
            key={cloud.id}
            src={SPRITES.clouds[cloud.cloudNum]}
            alt=""
            className={`cloud cloud--${cloud.cloudNum}`}
            style={style}
          />
        );
      })}
    </div>
  );
}
