import { CSSProperties } from 'react';
import { CLOUD_DEPTH, type CloudDepth } from '../animations/cloudDepth';

export interface Cloud {
  id: string;
  x: number; // % от ширины viewport
  y: number; // % от высоты viewport
  scale: number;
  size: 'large' | 'medium' | 'small';
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
            src={`/sprites/cloud-${cloud.size === 'large' ? '1' : cloud.size === 'medium' ? '2' : '3'}.svg`}
            alt=""
            className={`cloud cloud--${cloud.size}`}
            style={style}
          />
        );
      })}
    </div>
  );
}
