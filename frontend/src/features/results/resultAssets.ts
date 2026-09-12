import type { GameTheme, RoundOutcome } from '../../types/result';

export const resultAssets = {
  background: new URL('../../assets/results/background-sky.png', import.meta.url).href,
  coin: new URL('../../assets/results/coin.png', import.meta.url).href,
  trophy: new URL('../../assets/results/trophy.png', import.meta.url).href,
  puzzle: new URL('../../assets/results/puzzle.png', import.meta.url).href,
  ribbons: {
    win: new URL('../../assets/results/ribbon-win.png', import.meta.url).href,
    loss: new URL('../../assets/results/ribbon-loss.png', import.meta.url).href,
  },
  balloons: {
    red: {
      win: new URL('../../assets/results/balloon-red.png', import.meta.url).href,
      loss: new URL('../../assets/results/balloon-red-crashed.png', import.meta.url).href,
    },
    green: {
      win: new URL('../../assets/results/balloon-green.png', import.meta.url).href,
      loss: new URL('../../assets/results/balloon-green-crashed.png', import.meta.url).href,
    },
  },
} as const;

export const getResultBalloon = (theme: GameTheme, result: RoundOutcome) =>
  resultAssets.balloons[theme][result];
