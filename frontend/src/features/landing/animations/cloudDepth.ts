export interface CloudDepthConfig {
  blur: number;
  opacity: number;
  /** Множитель parallax (чем больше, тем быстрее движение) */
  parallaxFactor: number;
  /** Максимальный scale при приближении */
  scaleBoost: number;
}

export const CLOUD_DEPTH = {
  far: {
    blur: 1.5,
    opacity: 0.5,
    parallaxFactor: 0.15,
    scaleBoost: 0.1,
  },
  middle: {
    blur: 0.5,
    opacity: 0.75,
    parallaxFactor: 0.45,
    scaleBoost: 0.2,
  },
  near: {
    blur: 0,
    opacity: 1,
    parallaxFactor: 1.0,
    scaleBoost: 0.35,
  },
} as const;

export type CloudDepth = keyof typeof CLOUD_DEPTH;
