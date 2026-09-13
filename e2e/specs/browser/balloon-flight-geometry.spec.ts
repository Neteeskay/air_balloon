import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { ApiClient } from '../../helpers/api-client'
import { settings } from '../../helpers/env'

const screenshots = path.resolve(__dirname, '..', '..', '..', 'artifacts', 'balloon-flight')
const milestones = [1.15, 2, 3, 5, 7] as const
const viewports = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const

type Geometry = {
  balloon: { bottom: number; centerY: number; left: number; right: number; top: number; y: number }
  coefficient: { bottom: number; left: number; right: number; top: number }
  gap: number
  markerCenterY: number
  panel: { top: number }
  progress: number
  stage: { bottom: number; top: number }
}

test('balloon follows authoritative level progress inside the cashout safe area', async ({ page, request }) => {
  test.setTimeout(240_000)
  fs.mkdirSync(screenshots, { recursive: true })
  const api = new ApiClient(request)
  const active = await api.adminConfig(settings.adminToken)
  await api.updateAdminConfig(settings.adminToken, active.version, {
    ...active.config,
    minCrashMultiplier: 1,
    maxCrashMultiplier: 8.42,
    growthRate: 0.1,
  })

  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/mode', { waitUntil: 'domcontentloaded' })
  const login = page.getByLabel('Email или логин')
  const greenMode = page.getByRole('button', { name: /выбрать зел[её]ный шар/i })
  await expect(login.or(greenMode)).toBeVisible()
  if (await login.isVisible()) {
    await login.fill(settings.username)
    await page.getByRole('textbox', { name: 'Пароль', exact: true }).fill(settings.password)
    await page.getByRole('button', { name: /^войти$/i }).click()
    await expect(page).toHaveURL(/\/mode$/)
  }
  const skipTutorial = page.getByRole('button', { name: /пропустить обучение/i })
  if (await skipTutorial.isVisible().catch(() => false)) await skipTutorial.click()
  await greenMode.click()
  await expect(page).toHaveURL(/\/bet$/)
  await page.getByRole('button', { name: /бустер ×2$/i }).click()
  await page.getByRole('button', { name: /^начать/i }).click()
  await expect(page).toHaveURL(/\/game$/)

  const samples: Array<{ gap: number; milestone: number; multiplier: number; panelTop: number; progress: number; y: number }> = []
  for (const milestone of milestones) {
    await reachMilestone(page, milestone)
    await page.waitForTimeout(180)
    const geometry = await readGeometry(page)
    assertSafeGeometry(geometry)
    samples.push({
      gap: geometry.gap,
      milestone,
      multiplier: await currentMultiplier(page),
      panelTop: geometry.panel.top,
      progress: geometry.progress,
      y: geometry.balloon.y,
    })
    await page.screenshot({
      path: path.join(screenshots, `game-x${String(milestone).replace('.', '-')}.png`),
    })
    if (milestone === 1.15) {
      const cashout = page.getByRole('button', { name: /забрать/i })
      await expect(cashout).toBeEnabled({ timeout: 7_000 })
      await cashout.click()
      await expect(page.getByText('Выигрыш зафиксирован')).toBeVisible()
    }
    if (milestone === 5) {
      const beforeReload = geometry
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('flight-balloon')).toBeVisible()
      await expect(page.getByText(/восстанавливаем соединение/i)).toBeHidden({ timeout: 10_000 })
      const afterReload = await readGeometry(page)
      assertSafeGeometry(afterReload)
      expect(afterReload.progress).toBeGreaterThanOrEqual(beforeReload.progress)
      expect(afterReload.balloon.y).toBeLessThanOrEqual(beforeReload.balloon.y + 10)
    }
  }

  for (let index = 1; index < samples.length; index += 1) {
    expect(samples[index].y, JSON.stringify(samples)).toBeLessThan(samples[index - 1].y - 8)
  }

  const responsive: Array<{ gap: number; height: number; width: number; y: number }> = []
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    const geometry = await readGeometry(page)
    assertSafeGeometry(geometry)
    responsive.push({ ...viewport, gap: geometry.gap, y: geometry.balloon.y })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  }

  await page.setViewportSize({ width: 1366, height: 768 })
  await expect(page.locator('.crash-balloon--crashed')).toBeVisible({ timeout: 30_000 })
  const crashedHighGeometry = await readGeometry(page)
  assertSafeGeometry(crashedHighGeometry)
  await expect(page.getByTestId('flight-balloon')).toHaveAttribute('data-flight-progress', String(crashedHighGeometry.progress.toFixed(6)))

  await page.getByRole('button', { name: /играть снова/i }).click()
  await page.getByRole('button', { name: /бустер ×1$/i }).click()
  await page.getByRole('button', { name: /^начать/i }).click()
  await expect(page.locator('.crash-balloon--crashed')).toBeVisible({ timeout: 15_000 })
  const lowCrash = await readGeometry(page)
  assertSafeGeometry(lowCrash)
  await page.screenshot({ path: path.join(screenshots, 'game-crash-low.png') })
  fs.writeFileSync(path.join(screenshots, 'geometry.json'), JSON.stringify({ lowCrash, responsive, samples }, null, 2))
})

async function currentMultiplier(page: import('@playwright/test').Page) {
  const text = await page.getByTestId('multiplier').textContent()
  return Number(text?.replace(/[^\d.,]/g, '').replace(',', '.') ?? 0)
}

async function reachMilestone(page: import('@playwright/test').Page, milestone: number) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const outcome = await page.waitForFunction((target) => {
      const text = document.querySelector<HTMLElement>('[data-testid="multiplier"]')?.textContent ?? ''
      const multiplier = Number(text.replace(/[^\d.,]/g, '').replace(',', '.'))
      if (multiplier >= target) return 'reached'
      if (document.querySelector('.crash-balloon--crashed') || !document.querySelector('.crash-stage')) return 'ended'
      return false
    }, milestone, { timeout: 20_000 }).then(handle => handle.jsonValue())

    if (outcome === 'reached') return
    const playAgain = page.getByRole('button', { name: /играть снова/i })
    await expect(playAgain).toBeVisible({ timeout: 7_000 })
    await playAgain.click()
    await page.getByRole('button', { name: /бустер ×2$/i }).click({ timeout: 7_000 })
    await page.getByRole('button', { name: /^начать/i }).click({ timeout: 7_000 })
    await expect(page).toHaveURL(/\/game$/, { timeout: 7_000 })
  }
  throw new Error(`No authoritative GREEN round reached x${milestone} in 30 attempts`)
}

async function readGeometry(page: import('@playwright/test').Page): Promise<Geometry> {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (!element) throw new Error(`Missing ${selector}`)
      const box = element.getBoundingClientRect()
      return { bottom: box.bottom, centerY: box.top + box.height / 2, left: box.left, right: box.right, top: box.top, y: box.y }
    }
    const balloon = document.querySelector<HTMLElement>('[data-testid="flight-balloon"]')
    const marker = document.querySelector<HTMLElement>('[data-testid="level-progress-marker"]')
    if (!balloon || !marker) throw new Error('Missing flight geometry elements')
    const balloonRect = rect('[data-testid="flight-balloon"]')
    const markerRect = marker.getBoundingClientRect()
    const panel = rect('[data-testid="cashout-panel"]')
    return {
      balloon: balloonRect,
      coefficient: rect('.crash-coefficient'),
      gap: panel.top - balloonRect.bottom,
      markerCenterY: markerRect.top + markerRect.height / 2,
      panel,
      progress: Number(balloon.dataset.flightProgress),
      stage: rect('.crash-stage'),
    }
  })
}

function assertSafeGeometry(geometry: Geometry) {
  expect(geometry.gap).toBeGreaterThanOrEqual(23)
  expect(geometry.balloon.top).toBeGreaterThanOrEqual(geometry.stage.top)
  expect(geometry.balloon.bottom).toBeLessThan(geometry.panel.top)
  expect(Math.abs(geometry.balloon.centerY - geometry.markerCenterY)).toBeLessThanOrEqual(4)
  const overlapsCoefficientHorizontally = geometry.balloon.bottom > geometry.coefficient.top
    && geometry.balloon.top < geometry.coefficient.bottom
    && geometry.balloon.right > geometry.coefficient.left
    && geometry.balloon.left < geometry.coefficient.right
  expect(overlapsCoefficientHorizontally).toBe(false)
}
