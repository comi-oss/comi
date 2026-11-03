import { expect, test } from '@playwright/test'

const mapUrl = 'https://cf.mikira.id/'

test('opens the map as the full page rather than embedding it', async ({ page }) => {
  await page.route(mapUrl, async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*' },
      contentType: 'text/html',
      body: '<title>Comifuro map</title><main>Map content</main>',
    })
  })
  await page.goto('/')
  await expect(page).toHaveURL(mapUrl)
  await expect(page.getByRole('main')).toHaveText('Map content')
  await expect(page.locator('iframe')).toHaveCount(0)
})

test('offers a working retry when the map is unavailable', async ({ page }) => {
  let available = false
  await page.route(mapUrl, async (route) => {
    if (!available) return route.abort('internetdisconnected')
    await route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*' },
      contentType: 'text/html',
      body: '<main>Map content</main>',
    })
  })
  await page.goto('/')
  await expect(page.getByText('The map couldn’t be reached.')).toBeVisible()
  const retry = page.getByRole('button', { name: 'Try again' })
  await expect(retry).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  available = true
  await retry.click()
  await expect(page).toHaveURL(mapUrl)
})
