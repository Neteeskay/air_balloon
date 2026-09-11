import { expect, type Page } from '@playwright/test';
import { GamePage } from './game.page';

export class ResultPage {
  private readonly game: GamePage;
  constructor(private readonly page: Page) { this.game = new GamePage(page); }

  async expectVisible(): Promise<void> {
    await expect(this.game.result()).toBeVisible();
    await expect(this.game.result()).toContainText(/выигрыш|проигрыш|win|lose/i);
    await expect(this.game.result()).toContainText(/(?:×|x)?\s*\d+[,.]\d+/i);
    await expect(this.game.playAgain()).toBeVisible();
  }
}
