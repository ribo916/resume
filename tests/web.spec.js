// @ts-check
const { test, expect } = require('@playwright/test');
const { collectErrors } = require('./helpers');

test.describe('Interactive web resume', () => {
  test('loads with no JS errors and shows resume content', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/web/');
    await expect(page).toHaveTitle(/Rich Boesch/i);

    // key career content is present (hand-written monolith)
    const body = page.locator('body');
    for (const company of ['Intuit', 'FIS', 'TruStage', 'Polly']) {
      await expect(body).toContainText(company);
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('theme switcher changes the active theme', async ({ page }) => {
    await page.goto('/web/');

    // starts on arctic
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'arctic');

    // switch to ember and verify the attribute + active swatch update
    await page.locator('.theme-swatch[data-t="ember"]').click();
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'ember');
    await expect(page.locator('.theme-swatch[data-t="ember"]')).toHaveClass(/active/);

    // and to forest
    await page.locator('.theme-swatch[data-t="forest"]').click();
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'forest');
  });

  test('side navigation links are present and target real sections', async ({ page }) => {
    await page.goto('/web/');
    const links = page.locator('.sidenav .nav-link');
    await expect(links).toHaveCount(5);

    // The sidenav is intentionally hidden at mobile widths (responsive collapse),
    // so only assert visibility on wider viewports.
    const isNarrow = page.viewportSize().width < 700;

    for (const id of ['about', 'experience', 'achievements', 'skills', 'education']) {
      const link = page.locator(`.nav-link[href="#${id}"]`);
      await expect(link).toHaveCount(1);
      if (!isNarrow) await expect(link).toBeVisible();
      // the section it points to exists in the document
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
  });
});
