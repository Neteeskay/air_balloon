export const PARALLAX_LAYERS = {
  background: 0.15, // Очень медленные (дальние облака)
  middle: 0.5, // Средняя скорость (средние облака)
  foreground: 1.2, // Очень быстрые (ближние облака, проходят мимо камеры)
  balloons: 0.65, // Шары на средне-ближнем плане
} as const;

export type ParallaxDepth = keyof typeof PARALLAX_LAYERS;
