export const number = (value: number) => value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
export const multiplier = (value: number) => `×${value.toFixed(2)}`
