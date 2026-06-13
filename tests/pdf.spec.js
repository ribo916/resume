// @ts-check
const { test, expect } = require('@playwright/test');
const { collectErrors } = require('./helpers');

test.describe('PDF placeholder', () => {
  test('loads, shows the coming-soon message, and links home', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/pdf/');

    await expect(page.locator('h1')).toContainText('PDF Resume');
    await expect(page.locator('body')).toContainText(/coming soon/i);

    // back-home link points at the repo root and actually navigates there
    const back = page.locator('a[href="../"]');
    await expect(back).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('#r-name')).toBeVisible();

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
