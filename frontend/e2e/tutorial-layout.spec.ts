import { expect, test } from '@playwright/test'
import path from 'node:path'

const phase = process.env.SCREENSHOT_PHASE ?? 'after'
const screenshot = (name: string) => path.resolve(process.cwd(), '..', 'artifacts', 'frontend-regressions', phase, name)

async function login(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Играть', exact: true }).first().click()
  await page.getByLabel('Email или логин').fill('maks')
  await page.getByLabel('Пароль', { exact: true }).fill('balloon2')
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page).toHaveURL(/\/mode$/)
}

async function assertStep(page: import('@playwright/test').Page, color: 'red' | 'green') {
  const card = page.locator(`.tutorial-tip--${color}`)
  const character = page.locator(`.tutorial-step--${color === 'red' ? 'two' : 'three'} .chinchillot`)
  await expect(card).toBeVisible()
  const capture = page.viewportSize()?.width === 1280
  if (phase === 'before' && capture) await page.screenshot({ path: screenshot(`tutorial-${color}-before.png`), fullPage: false })
  await expect(character).toBeVisible()
  await expect.poll(() => character.evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true)
  if (phase !== 'before' && capture) await page.screenshot({ path: screenshot(`tutorial-${color}-fixed.png`), fullPage: false })
  const layout = await page.evaluate((kind) => {
    const card = document.querySelector(`.tutorial-tip--${kind}`)!
    const character = card.parentElement!.querySelector('.chinchillot')!
    const cardRect = card.getBoundingClientRect()
    const characterRect = character.getBoundingClientRect()
    return {
      viewport: { width: innerWidth, height: innerHeight },
      card: { left: cardRect.left, right: cardRect.right, top: cardRect.top, bottom: cardRect.bottom, width: cardRect.width, height: cardRect.height },
      character: { left: characterRect.left, right: characterRect.right, top: characterRect.top, bottom: characterRect.bottom, width: characterRect.width, height: characterRect.height },
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      imageLoaded: character instanceof HTMLImageElement && character.complete && character.naturalWidth > 0,
    }
  }, color)
  expect(layout.card.width).toBeLessThan(layout.viewport.width)
  expect(layout.card.left).toBeGreaterThanOrEqual(0)
  expect(layout.card.right).toBeLessThanOrEqual(layout.viewport.width)
  expect(layout.character.width).toBeGreaterThan(0)
  expect(layout.character.height).toBeGreaterThan(0)
  expect(layout.character.left).toBeGreaterThanOrEqual(0)
  expect(layout.character.right).toBeLessThanOrEqual(layout.viewport.width)
  expect(layout.character.top).toBeGreaterThanOrEqual(0)
  expect(layout.character.bottom).toBeLessThanOrEqual(layout.viewport.height)
  expect(layout.horizontalOverflow).toBe(false)
  expect(layout.imageLoaded).toBe(true)
}

const viewports = [
  { width: 375, height: 812 }, { width: 390, height: 844 }, { width: 430, height: 932 },
  { width: 768, height: 1024 }, { width: 1280, height: 720 }, { width: 1366, height: 768 },
  { width: 1440, height: 900 }, { width: 1920, height: 1080 },
]

for (const viewport of viewports) {
  test(`tutorial-layout.spec: RED and GREEN fit ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await login(page)
    await page.locator('.flight-mode-page').click({ position: { x: Math.max(20, viewport.width - 40), y: 80 } })
    await assertStep(page, 'red')
    await page.locator('.flight-mode-page').click({ position: { x: Math.max(20, viewport.width - 40), y: 80 } })
    await assertStep(page, 'green')
  })
}
