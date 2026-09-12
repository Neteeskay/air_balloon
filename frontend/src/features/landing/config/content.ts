import type { BenefitIconName } from '../components/BenefitIcon';

export const CONTENT = {
  hero: {
    title: 'Как высоко ты рискнешь подняться?',
    subtitle: 'Следи как растет коэффициент. Забери выигрыш вовремя, пока шар не лопнул',
    cta: 'Играть',
    howToPlay: 'Как играть?',
  },
  why: {
    title: 'Почему стоит играть?',
    benefits: [
      { title: 'Красивые локации', icon: 'locations' },
      { title: 'Развитие шара', icon: 'growth' },
      { title: 'Увлекательные задания', icon: 'quest' },
      { title: 'Играй с друзьями', icon: 'friends' },
    ] satisfies ReadonlyArray<{ title: string; icon: BenefitIconName }>,
    boosterTitle: 'Лови бустеры!',
    boosterSubtitle: 'Долетай до бустеров чтобы увеличить коэффициент',
  },
  modes: {
    title: 'Два режима — два настроения',
    subtitle: 'Выбери свой стиль полёта',
    green: {
      levels: '9 уровней',
      description: 'Более спокойный',
      cta: 'Играть',
    },
    red: {
      levels: '12 уровней',
      description: 'Более рискованный',
      cta: 'Играть',
    },
  },
} as const;