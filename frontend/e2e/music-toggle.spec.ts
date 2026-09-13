import { expect, test } from '@playwright/test'
import path from 'node:path'

const phase = process.env.SCREENSHOT_PHASE ?? 'after'
const screenshot = (name: string) => path.resolve(process.cwd(), '..', 'artifacts', 'frontend-regressions', phase, name)

type MusicAudit = { instances: Array<{ src: string; paused: boolean; muted: boolean; volume: number }>; playCalls: number; pauseCalls: number }

test('music-toggle.spec: the real button controls the one background Audio instance', async ({ page }) => {
  await page.addInitScript(() => {
    const audit: MusicAudit = { instances: [], playCalls: 0, pauseCalls: 0 }
    class InstrumentedAudio {
      src: string
      loop = false
      preload = ''
      volume = 1
      muted = false
      paused = true
      currentTime = 0
      constructor(src: string) { this.src = src; audit.instances.push(this) }
      play() { audit.playCalls += 1; this.paused = false; return Promise.resolve() }
      pause() { audit.pauseCalls += 1; this.paused = true }
    }
    Object.defineProperty(window, 'Audio', { configurable: true, value: InstrumentedAudio })
    Object.defineProperty(window, '__musicAudit', { configurable: true, value: audit })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Играть', exact: true }).first().click()
  await page.getByLabel('Email или логин').fill('maks')
  await page.getByLabel('Пароль', { exact: true }).fill('balloon2')
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page).toHaveURL(/\/mode$/)
  await page.getByRole('button', { name: 'Пропустить обучение' }).click()
  await page.locator('.mode-card--red .mode-card__button').click()
  await expect(page).toHaveURL(/\/bet$/)

  const audit = () => page.evaluate(() => (window as unknown as { __musicAudit: MusicAudit }).__musicAudit)
  await expect.poll(async () => (await audit()).instances.length).toBe(1)
  await expect.poll(async () => (await audit()).instances[0].paused).toBe(false)
  await page.screenshot({ path: screenshot('music-on.png'), fullPage: false })

  const offButton = page.getByRole('button', { name: 'Выключить звук' })
  await expect(offButton).toBeVisible()
  await offButton.click()
  await expect(page.getByRole('button', { name: 'Включить звук' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('air-balloon:background-music-muted'))).toBe('true')
  await expect.poll(async () => {
    const value = await audit(); return value.instances[0].paused || value.instances[0].muted
  }).toBe(true)
  await page.screenshot({ path: screenshot('music-off.png'), fullPage: false })

  await page.getByRole('button', { name: 'Назад' }).click()
  await expect(page).toHaveURL(/\/mode$/)
  expect((await audit()).instances[0].paused || (await audit()).instances[0].muted).toBe(true)
  await page.locator('.mode-card--red .mode-card__button').click()
  await page.getByRole('button', { name: 'Включить звук' }).click()
  await expect.poll(async () => (await audit()).instances[0].paused).toBe(false)
  expect(await page.evaluate(() => localStorage.getItem('air-balloon:background-music-muted'))).toBe('false')
  expect((await audit()).instances).toHaveLength(1)

  await page.evaluate(() => { location.hash = '#/admin' })
  await expect(page.getByRole('heading', { name: 'Администрирование' })).toBeVisible()
  expect((await audit()).instances[0].paused).toBe(true)
})
