type DecimalParts = { unscaled: bigint; scale: number };

function parseDecimal(value: string | number): DecimalParts {
  const raw = String(value);
  if (!/^-?\d+(\.\d+)?$/.test(raw)) throw new Error(`Invalid decimal: ${raw}`);
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ''] = unsigned.split('.');
  const unscaled = BigInt(`${whole}${fraction}`) * (negative ? -1n : 1n);
  return { unscaled, scale: fraction.length };
}

function pow10(power: number): bigint {
  return 10n ** BigInt(power);
}

export function decimalToScale(value: string | number, scale: number): bigint {
  const parsed = parseDecimal(value);
  if (parsed.scale === scale) return parsed.unscaled;
  if (parsed.scale < scale) return parsed.unscaled * pow10(scale - parsed.scale);
  return parsed.unscaled / pow10(parsed.scale - scale);
}

export function multiplyMoney(stake: string | number, multiplier: string | number): string {
  const left = parseDecimal(stake);
  const right = parseDecimal(multiplier);
  const product = left.unscaled * right.unscaled;
  const productScale = left.scale + right.scale;
  const cents = productScale > 2 ? product / pow10(productScale - 2) : product * pow10(2 - productScale);
  return formatScaled(cents, 2);
}

export function formatScaled(value: bigint, scale: number): string {
  const negative = value < 0n;
  const unsigned = negative ? -value : value;
  const digits = unsigned.toString().padStart(scale + 1, '0');
  const whole = digits.slice(0, -scale) || '0';
  const fraction = scale ? `.${digits.slice(-scale)}` : '';
  return `${negative ? '-' : ''}${whole}${fraction}`;
}

export function equalDecimal(left: string | number, right: string | number, scale = 4): boolean {
  return decimalToScale(left, scale) === decimalToScale(right, scale);
}
