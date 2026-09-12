import { expect, test, type Page } from '@playwright/test'

const ONBOARDING_KEY = 'air-balloon-flight-mode-onboarding-complete:00000000-0000-4000-8000-000000000001'

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    root: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  expect(overflow.root, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.innerWidth + 1)
  expect(overflow.body, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.innerWidth + 1)
}

async function login(page: Page) {
  await page.goto('/')
  await page.evaluate(([key]) => localStorage.setItem(key, 'true'), [ONBOARDING_KEY])
  await page.getByRole('button', { name: 'Играть', exact: true }).first().click()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('Email или логин').fill('demo')
  await page.getByRole('textbox', { name: 'Пароль', exact: true }).fill('demo123')
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page).toHaveURL(/\/mode$/)
}

function collectBackendRequests(page: Page) {
  const forbidden: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('localhost:8080') || /\/api(?:\/|$)/.test(url) || /\/ws(?:\/|$)/.test(url)) forbidden.push(url)
  })
  return forbidden
}

test('WIN flow is connected and mock-only', async ({ page }) => {
  const forbiddenRequests = collectBackendRequests(page)
  await login(page)
  await page.getByRole('button', { name: /Выбрать зелёный шар/ }).click()
  await expect(page).toHaveURL(/\/bet$/)
  await page.getByRole('button', { name: /Начать/ }).click()
  await expect(page).toHaveURL(/\/game$/)
  await page.getByRole('button', { name: 'Завершить победой' }).click()
  await expect(page).toHaveURL(/\/result\/win$/)
  await expect(page.getByText('Полёт удался')).toBeVisible()
  await page.getByRole('button', { name: /Играть снова/ }).click()
  await expect(page).toHaveURL(/\/bet$/)
  expect(forbiddenRequests).toEqual([])
})

test('LOSS and Tournament flows return safely', async ({ page }) => {
  test.setTimeout(60_000)
  await login(page)
  await page.getByRole('button', { name: 'Открыть глобальный рейтинг игроков' }).click()
  await expect(page).toHaveURL(/\/rating$/)
  await expect(page.getByRole('tab', { name: 'Рейтинг' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Закрыть' }).click()
  await expect(page).toHaveURL(/\/mode$/)
  await page.getByRole('button', { name: /Выбрать красный шар/ }).click()
  await page.getByRole('button', { name: 'Турнир' }).click()
  await expect(page).toHaveURL(/\/tournament$/)
  await expect(page.getByRole('tab', { name: 'Турнир' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Закрыть' }).click()
  await expect(page).toHaveURL(/\/bet$/)
  await page.getByRole('button', { name: /Начать/ }).click()
  await page.getByRole('button', { name: 'Смоделировать проигрыш' }).click()
  await expect(page).toHaveURL(/\/result\/loss$/)
  await expect(page.getByText('В этот раз не успели')).toBeVisible()
  await page.getByRole('button', { name: /Играть снова/ }).click()
  await expect(page).toHaveURL(/\/bet$/)
})

test('completed round unlocks puzzle clothing, equips it and persists after refresh', async ({ page }) => {
  const forbiddenRequests = collectBackendRequests(page)
  await login(page)
  await page.getByRole('button', { name: /Выбрать зелёный шар/ }).click()
  await page.getByRole('button', { name: /Начать/ }).click()
  await page.getByRole('button', { name: 'Смоделировать проигрыш' }).click()

  await expect(page).toHaveURL(/\/result\/loss$/)
  await expect(page.getByText('Получен фрагмент')).toBeVisible()
  await expect(page.getByText('6 / 6')).toBeVisible()
  await expect(page.getByText('Пазл собран!')).toBeVisible()
  await expect(page.getByText(/Открыт новый предмет: Облачный шарфик/)).toBeVisible()
  await page.getByRole('button', { name: 'В профиль' }).click()

  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByText('6 / 6 фрагментов')).toBeVisible()
  await page.getByRole('button', { name: 'Открыть гардероб' }).click()
  await page.getByRole('button', { name: 'Шея' }).click()
  await page.getByRole('button', { name: 'Облачный шарфик' }).click()
  await page.getByRole('button', { name: 'Надеть' }).click()
  await expect(page.getByRole('img', { name: /Пушок: Авиатор, Облачный шарфик/ })).toBeVisible()
  await page.getByRole('button', { name: 'Сохранить образ' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Открыть гардероб' }).click()
  await expect(page.getByRole('img', { name: /Пушок: Авиатор, Облачный шарфик/ })).toBeVisible()

  await page.getByRole('button', { name: /Назад/ }).click()
  await page.getByRole('button', { name: /Назад/ }).click()
  await expect(page).toHaveURL(/\/mode$/)
  expect(forbiddenRequests).toEqual([])
})

test('locked clothing cannot change the equipped outfit', async ({ page }) => {
  await login(page)
  await page.getByRole('button', { name: 'Открыть профиль' }).click()
  await page.getByRole('button', { name: 'Открыть гардероб' }).click()
  await page.getByRole('button', { name: 'Шея' }).click()
  await page.getByRole('button', { name: 'Облачный шарфик, заблокировано' }).click()
  await expect(page.getByRole('button', { name: /Закрыто/ })).toBeDisabled()
  await expect(page.getByRole('img', { name: /Пушок: Авиатор, Красная бабочка/ })).toBeVisible()
})

test('completed puzzle does not grant the same clothing twice', async ({ page }) => {
  await login(page)
  await page.getByRole('button', { name: /Выбрать зелёный шар/ }).click()
  await page.getByRole('button', { name: /Начать/ }).click()
  await page.getByRole('button', { name: 'Завершить победой' }).click()
  await expect(page.getByText('Пазл собран!')).toBeVisible()
  await page.getByRole('button', { name: /Играть снова/ }).click()
  await page.getByRole('button', { name: /Начать/ }).click()
  await page.getByRole('button', { name: 'Смоделировать проигрыш' }).click()
  await expect(page.getByText('Пазл уже собран')).toBeVisible()
  await expect(page.getByText('Пазл собран!')).toHaveCount(0)
  const rewardCount = await page.evaluate(() => {
    const raw = sessionStorage.getItem('air-balloon:full-mock:v1')
    const state = raw ? JSON.parse(raw) : null
    return state?.currentUser?.unlockedClothingIds?.filter((id: string) => id === 'cloud-scarf').length
  })
  expect(rewardCount).toBe(1)
})

test('key screens have no horizontal overflow at target widths', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Responsive matrix runs once in Chromium')
  test.setTimeout(120_000)

  for (const width of [375, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 })
    await page.goto('/')
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(page.locator('html')).toHaveAttribute('data-landing-screen', '0')
    await expect(page.locator('.landing-page')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.goto('/login')
    await expect(page.locator('.auth-card')).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }

  await login(page)
  for (const width of [375, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 })
    await page.goto('/mode')
    await expect(page.getByRole('heading', { name: 'Выбери режим полёта' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: 'Открыть профиль' }).click()
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByRole('heading', { name: 'Мой профиль' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: 'Открыть гардероб' }).click()
    await expect(page.getByRole('heading', { name: 'Настройка образа' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: /Назад/ }).click()
    await page.getByRole('button', { name: /Назад/ }).click()
    await expect(page).toHaveURL(/\/mode$/)
    await page.getByRole('button', { name: /Выбрать зелёный шар/ }).click()
    await expect(page.getByRole('button', { name: /Начать/ })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.locator(width <= 760 ? '.tournament-mobile-badge' : '.tournament-button').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: 'Закрыть' }).click()
    await page.getByRole('button', { name: /Начать/ }).click()
    await expect(page).toHaveURL(/\/game$/)
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: 'Завершить победой' }).click()
    await expect(page).toHaveURL(/\/result\/win$/)
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: /Играть снова/ }).click()
    await page.getByRole('button', { name: /Начать/ }).click()
    await page.getByRole('button', { name: 'Смоделировать проигрыш' }).click()
    await expect(page).toHaveURL(/\/result\/loss$/)
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: /Играть снова/ }).click()
  }
})
