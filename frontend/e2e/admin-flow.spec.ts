import { expect, test } from '@playwright/test';

const username = process.env.E2E_ADMIN_USERNAME;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe('real admin flow', () => {
  test.skip(!username || !password, 'Set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD for the real backend test.');

  test('edit pointsPerLine, validate, save, activate, inspect history/audit and restore via rollback', async ({ page }) => {
    let originalRevision = 0;
    let activationMayHaveChangedBackend = false;

    await page.goto('/admin/login');
    await page.getByLabel('Логин').fill(username!);
    await page.getByLabel('Пароль').fill(password!);
    await page.getByRole('button', { name: 'Войти' }).click();
    await expect(page).toHaveURL(/\/admin$/);

    try {
      await page.getByRole('link', { name: 'Конфигурация' }).click();
      const activeText = await page.getByText(/ACTIVE revision \d+/).textContent();
      originalRevision = Number(activeText?.match(/\d+/)?.[0]);
      expect(originalRevision).toBeGreaterThan(0);

      await page.getByRole('tab', { name: 'Очки' }).click();
      const pointsField = page.locator('.form-field').filter({ hasText: 'points.pointsPerLine' });
      const pointsInput = pointsField.locator('input');
      const originalValue = Number(await pointsInput.inputValue());
      await pointsInput.fill(String(originalValue + 1));

      await page.getByRole('button', { name: 'Проверить' }).click();
      await expect(page.getByText('Проверка пройдена')).toBeVisible();
      await page.getByRole('button', { name: 'Сохранить DRAFT' }).click();
      await expect(page.getByText(/Черновик revision \d+ создан/)).toBeVisible();
      await page.getByRole('button', { name: 'Активировать версию' }).click();
      activationMayHaveChangedBackend = true;
      await page.getByRole('dialog').getByRole('button', { name: 'Активировать версию' }).click();
      await expect(page.getByText(/Revision \d+ активирована/)).toBeVisible();

      await page.getByRole('link', { name: 'Версии' }).click();
      const originalRow = page
        .locator('tbody tr')
        .filter({ has: page.locator('td').filter({ hasText: new RegExp(`^${originalRevision}$`) }) });
      await expect(originalRow).toContainText('ARCHIVED');
      await originalRow.getByRole('link', { name: 'Открыть' }).click();
      await expect(page.getByText('points.pointsPerLine')).toBeVisible();

      await page.getByRole('link', { name: 'Audit log' }).click();
      await expect(page.locator('body')).toContainText(/CONFIG_(CREATED|VALIDATED|ACTIVATED)/);
    } finally {
      if (activationMayHaveChangedBackend && originalRevision > 0) {
        await page.goto('/admin/versions');
        const restoreRow = page
          .locator('tbody tr')
          .filter({ has: page.locator('td').filter({ hasText: new RegExp(`^${originalRevision}$`) }) });

        if (await restoreRow.count()) {
          const rowText = await restoreRow.first().innerText();
          if (rowText.includes('ARCHIVED')) {
            await restoreRow.first().getByRole('link', { name: 'Открыть' }).click();
            await page.getByRole('button', { name: 'Rollback' }).click();
            await page.getByRole('dialog').getByRole('button', { name: 'Создать rollback и активировать' }).click();
            await expect(page.getByText(/Rollback создан: новая ACTIVE revision/)).toBeVisible();
          }
        }
      }
    }
  });
});
