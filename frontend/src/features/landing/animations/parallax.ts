/** Скорости parallax для каждого слоя (в множителях) */
export const PARALLAX_LAYERS = {
  far: 0.15,
  middle: 0.45,
  near: 1.0,
  balloons: 0.65,
} as const;

export type ParallaxDepth = keyof typeof PARALLAX_LAYERS;
