import { expect, test, type Page } from '@playwright/test'

const ONBOARDING_KEY = 'air-balloon-flight-mode-onboarding-complete:00000000-0000-4000-8000-000000000001'
const MOCK_STATE_KEY = 'air-balloon:full-mock:v1'

async function login(page: Page) {
  await page.goto('/')
  await page.evaluate((key) => localStorage.setItem(key, 'true'), ONBOARDING_KEY)
  await page.getByRole('button', { name: 'Играть', exact: true }).first().click()
  await page.getByLabel('Email или логин').fill('demo')
  await page.getByRole('textbox', { name: 'Пароль', exact: true }).fill('demo123')
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page).toHaveURL(/\/mode$/)
}

async function chooseMode(page: Page, mode: 'green' | 'red') {
  await page.locator(`article.mode-card--${mode} button.mode-card__button`).click()
  await expect(page).toHaveURL(/\/bet$/)
}

async function start(page: Page) {
  await page.getByRole('button', { name: /^Начать/ }).click()
  await expect(page).toHaveURL(/\/game$/)
}

async function setCrashPoint(page: Page, crashMultiplier: number) {
  await page.evaluate(({ key, crashMultiplier: value }) => {
    const raw = sessionStorage.getItem(key)
    if (!raw) return
    const state = JSON.parse(raw)
    state.mockRound.crashMultiplier = value
    sessionStorage.setItem(key, JSON.stringify(state))
  }, { key: MOCK_STATE_KEY, crashMultiplier })
  await page.reload()
  await expect(page).toHaveURL(/\/game$/)
}

async function finishWin(page: Page) {
  await setCrashPoint(page, 1.4)
  await expect(page.getByTestId('cashout-button')).toBeEnabled({ timeout: 3_000 })
  await page.getByTestId('cashout-button').click()
  await page.waitForTimeout(6_500)
  await expect(page).toHaveURL(/\/result\/win$/)
}

async function finishLoss(page: Page) {
  await setCrashPoint(page, 1.2)
  await page.waitForTimeout(4_000)
  await expect(page).toHaveURL(/\/result\/loss$/)
}

test('GREEN complete flow is mock-only and awards one puzzle fragment on WIN', async ({ page }) => {
  const forbidden: string[] = []
  page.on('request', (request) => {
    if (/localhost:8080|\/api(?:\/|$)|\/ws(?:\/|$)/.test(request.url())) forbidden.push(request.url())
  })
  await login(page)
  await chooseMode(page, 'green')
  await start(page)
  await expect(page.locator('.crash-level')).toHaveCount(9)
  await finishWin(page)
  await expect(page.getByText('Полёт удался')).toBeVisible()
  await expect(page.getByText('6 / 6')).toBeVisible()
  expect(forbidden).toEqual([])
})

test('RED reaches its 12-level gameplay and LOSS grants no fragment', async ({ page }) => {
  await login(page)
  await chooseMode(page, 'red')
  await start(page)
  await expect(page.locator('.crash-level')).toHaveCount(12)
  await finishLoss(page)
  await expect(page.getByText('В этот раз не успели')).toBeVisible()
  await expect(page.getByText('5 / 6')).toBeVisible()
  await expect(page.getByText('Фрагмент не получен')).toBeVisible()
  await expect(page.getByText('Пазл собран!')).toHaveCount(0)
})

test('WIN unlocks CLOUD_SCARF and equipped outfit survives reload', async ({ page }) => {
  await login(page)
  await chooseMode(page, 'green')
  await start(page)
  await finishWin(page)
  await page.getByRole('button', { name: 'В профиль' }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByText('6 / 6 фрагментов')).toBeVisible()
  await page.getByRole('button', { name: 'Открыть гардероб' }).click()
  await page.getByRole('button', { name: 'Шея' }).click()
  await page.getByRole('button', { name: 'Облачный шарфик' }).click()
  await page.getByRole('button', { name: 'Надеть' }).click()
  await page.getByRole('button', { name: 'Сохранить образ' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Открыть гардероб' }).click()
  await expect(page.getByRole('img', { name: /Облачный шарфик/ })).toBeVisible()
})

test('logout goes directly to login and protected mode is not restored by Back', async ({ page }) => {
  await login(page)
  await page.getByRole('button', { name: 'Выйти' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goBack()
  await expect(page).not.toHaveURL(/\/mode$/)
})
