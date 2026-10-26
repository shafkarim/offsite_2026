import { test, expect } from '@playwright/test'

test.describe('Frontend', () => {
  test('loads the forecast workspace', async ({ page }) => {
    await page.goto('http://localhost:3000/forecast/')

    await expect(page).toHaveTitle(/Figma Forecast/)
    await expect(page.locator('main#main-content')).toBeVisible()
    await expect(page.getByText('Marketing workspace')).toBeVisible()
  })
})
