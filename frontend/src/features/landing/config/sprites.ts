export const SPRITES = {
  clouds: {
    // Large clouds (для foreground/близких)
    1: '/sprites/cloud-1.png',
    2: '/sprites/cloud-2.png',
    3: '/sprites/cloud-3.png',
    4: '/sprites/cloud-4.png',
    5: '/sprites/cloud-5.png',
    6: '/sprites/cloud-6.png',
    // Medium clouds (для middle слоя)
    7: '/sprites/cloud-7.png',
    8: '/sprites/cloud-8.png',
    9: '/sprites/cloud-9.png',
    10: '/sprites/cloud-10.png',
    11: '/sprites/cloud-11.png',
    // Small clouds (для background/дальних)
    12: '/sprites/cloud-12.png',
    13: '/sprites/cloud-13.png',
    14: '/sprites/cloud-14.png',
    15: '/sprites/cloud-15.png',
    16: '/sprites/cloud-16.png',
  },
  balloons: {
    green: '/sprites/balloon-green.png',
    red: '/sprites/balloon-red.png',
    blue: '/sprites/balloon-blue.png',
  },
} as const;

export type BalloonColor = keyof typeof SPRITES.balloons;
export type CloudNumber = keyof typeof SPRITES.clouds;
