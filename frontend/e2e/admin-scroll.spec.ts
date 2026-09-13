import { expect, test } from '@playwright/test'
import path from 'node:path'

const phase = process.env.SCREENSHOT_PHASE ?? 'after'
const screenshot = (name: string) => path.resolve(process.cwd(), '..', 'artifacts', 'frontend-regressions', phase, name)

test('admin-scroll.spec: Configuration uses the document scroll owner', async ({ page }) => {
  await page.goto('/#/admin')
  await page.getByLabel('Логин', { exact: true }).fill('admin')
  await page.getByLabel('Пароль', { exact: true }).fill('admin')
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.getByRole('button', { name: 'Конфигурация' }).click()
  await expect(page.getByRole('heading', { name: 'Конфигурация' })).toBeVisible()

  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: screenshot('admin-scroll-top.png'), fullPage: false })
  const metrics = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    bodyOverflow: getComputedStyle(document.body).overflow,
    rootOverflow: getComputedStyle(document.querySelector('#root')!).overflow,
    adminOverflow: getComputedStyle(document.querySelector('.admin-app')!).overflow,
    touchAction: getComputedStyle(document.querySelector('.admin-app')!).touchAction,
  }))
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)
  expect(metrics.touchAction).not.toBe('none')

  const before = await page.evaluate(() => window.scrollY)
  await page.mouse.wheel(0, 700)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before)

  await page.evaluate(() => window.scrollTo(0, 0))
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 640, y: 650 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 640, y: 180 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const after = await page.evaluate(() => window.scrollY)
  expect(after).toBeGreaterThan(before)
  await expect(page.getByRole('heading', { name: 'Очки' })).toBeVisible()
  await page.screenshot({ path: screenshot('admin-scroll-bottom.png'), fullPage: false })
})
