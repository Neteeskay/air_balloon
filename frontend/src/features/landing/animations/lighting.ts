export const LIGHTING = {
  dark: 0.3, // Inside clouds
  normal: 0, // Open sky
} as const;

export function getLightingOverlay(opacity: number): string {
  return `rgba(0, 0, 0, ${opacity})`;
}
