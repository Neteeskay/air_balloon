import { expect, test } from '@playwright/test';
import { decimalToScale, equalDecimal, multiplyMoney } from '../../helpers/decimal';

test('HARNESS-ECONOMY calculates payout with exact decimal arithmetic', () => {
  expect(multiplyMoney('100.00', '1.2345')).toBe('123.45');
  expect(multiplyMoney('0.01', '1.9999')).toBe('0.01');
  expect(decimalToScale('5000', 2) - decimalToScale('100', 2)).toBe(490000n);
  expect(equalDecimal('8.4200', '8.42')).toBe(true);
});
