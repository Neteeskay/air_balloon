import { expect, type Locator, type Page } from '@playwright/test';
import { blocked } from '../helpers/status';

export class GamePage {
  constructor(private readonly page: Page) {}

  theme(name: 'GREEN' | 'RED'): Locator {
    const localized = name === 'GREEN' ? /green|зел[её]н/i : /red|красн/i;
    return this.page.getByRole('button', { name: localized }).or(this.page.getByRole('radio', { name: localized })).first();
  }

  stake(value: string): Locator {
    return this.page.getByRole('button', { name: new RegExp(`(^|\\D)${escapeRegex(value)}([,.]00)?(\\D|$)`) }).first();
  }

  booster(value: number): Locator {
    return this.page.getByRole('button', { name: new RegExp(`(?:×|x)\\s*${value}`, 'i') }).first();
  }

  start(): Locator { return this.page.getByRole('button', { name: /начать|start/i }); }
  cashout(): Locator { return this.page.getByRole('button', { name: /забрать|cash\s*out/i }); }
  playAgain(): Locator { return this.page.getByRole('button', { name: /играть снова|play again/i }); }
  rules(): Locator { return this.page.getByRole('button', { name: /правила|rules/i }); }
  history(): Locator { return this.page.getByRole('heading', { name: /история|history/i }).or(this.page.getByRole('region', { name: /история|history/i })).first(); }
  multiplier(): Locator { return this.page.getByTestId('multiplier'); }
  result(): Locator { return this.page.getByTestId('round-result').or(this.page.getByRole('dialog', { name: /результат|result/i })).first(); }

  levels(): Locator {
    const semantic = this.page.getByRole('list', { name: /уровни|levels/i }).getByRole('listitem');
    return this.page.locator('[data-level]').or(semantic);
  }

  async requireGameControls(): Promise<void> {
    if (!(await this.theme('GREEN').count()) || !(await this.start().count())) {
      blocked('WAITING FOR FRONTEND: game controls are not integrated');
    }
  }

  async selectTheme(name: 'GREEN' | 'RED', expectedLevels: number): Promise<void> {
    await this.theme(name).click();
    await expect(this.levels()).toHaveCount(expectedLevels);
  }

  async assertThemeSelected(name: 'GREEN' | 'RED'): Promise<void> {
    const control = this.theme(name);
    const checked = await control.getAttribute('aria-checked');
    const pressed = await control.getAttribute('aria-pressed');
    if (checked !== 'true' && pressed !== 'true' && !(await control.isChecked().catch(() => false))) {
      throw new Error(`${name} theme is not represented as selected in accessible DOM state`);
    }
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
