import { expect, test } from '@playwright/test'

const landingViewports = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]

test.describe('remaining layout regressions', () => {
  for (const viewport of landingViewports) {
    test(`landing hero fits ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/')

      const title = page.locator('.landing-page .hero__title')
      const box = await title.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.bottom).toBeLessThan(viewport.height - 24)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })
  }

  test('cashout notice leaves a positive gap below the coefficient', async ({ page }) => {
    await page.goto('/')
    const gap = await page.evaluate(() => {
      const root = document.createElement('main')
      root.className = 'game-shell crash-shell'
      root.innerHTML = '<section class="crash-coefficient"><strong>×4.09</strong><div class="crash-bet-chip">250</div><small>Выигрыш зафиксирован</small></section><div class="toast">Могли бы забрать больше</div>'
      document.body.append(root)
      const coefficient = root.querySelector('.crash-coefficient')!.getBoundingClientRect()
      const toast = root.querySelector('.toast')!.getBoundingClientRect()
      root.remove()
      return toast.top - coefficient.bottom
    })
    expect(gap).toBeGreaterThan(0)
  })
})
