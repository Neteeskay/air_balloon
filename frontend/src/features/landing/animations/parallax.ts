export const PARALLAX_LAYERS = {
  background: 0.2, // Самые медленные (дальние облака)
  middle: 0.5, // Средняя скорость (средние облака)
  foreground: 0.8, // Быстрые (ближние облака)
  balloons: 0.6, // Шары на среднем плане
} as const;

export type ParallaxDepth = keyof typeof PARALLAX_LAYERS;
