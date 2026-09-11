export const SPRITES = {
  clouds: {
    large: '/sprites/cloud-1.svg',
    medium: '/sprites/cloud-2.svg',
    small: '/sprites/cloud-3.svg',
  },
  balloons: {
    green: '/sprites/balloon-green.png',
    red: '/sprites/balloon-red.png',
    blue: '/sprites/balloon-blue.png',
  },
} as const;

export type BalloonColor = keyof typeof SPRITES.balloons;
export type CloudSize = keyof typeof SPRITES.clouds;
