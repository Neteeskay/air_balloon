export interface CloudDepthConfig {
  blur: number;
  opacity: number;
}

export const CLOUD_DEPTH = {
  background: {
    blur: 2,
    opacity: 0.6,
  },
  middle: {
    blur: 0.5,
    opacity: 0.8,
  },
  foreground: {
    blur: 0,
    opacity: 1,
  },
} as const;

export type CloudDepth = keyof typeof CLOUD_DEPTH;
