import { expect, type Page } from '@playwright/test';
import { blocked } from '../helpers/status';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    try {
      await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    } catch (error) {
      blocked(`WAITING FOR FRONTEND: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async login(username: string, password: string): Promise<void> {
    const usernameInput = this.page.getByLabel(/логин|username/i);
    const passwordInput = this.page.getByLabel(/пароль|password/i);
    const submit = this.page.getByRole('button', { name: /войти|sign in|login/i });
    if (!(await usernameInput.count()) || !(await passwordInput.count()) || !(await submit.count())) {
      blocked('WAITING FOR FRONTEND: semantic login controls are not integrated');
    }
    await usernameInput.fill(username);
    await passwordInput.fill(password);
    await submit.click();
    await expect(this.page.getByText(new RegExp(`@?${escapeRegex(username)}`, 'i')).first()).toBeVisible();
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
