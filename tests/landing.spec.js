// @ts-check
const { test, expect } = require('@playwright/test');
const { collectErrors } = require('./helpers');

test.describe('Landing page', () => {
  test('loads with no JS errors and the space canvas renders', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(page).toHaveTitle(/Career History/i);

    // background animation canvas exists and has real size
    const canvas = page.locator('#bg');
    await expect(canvas).toBeAttached();
    const box = await canvas.boundingBox();
    expect(box && box.width).toBeGreaterThan(0);
    expect(box && box.height).toBeGreaterThan(0);

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('header and footer are populated from shared RESUME_DATA', async ({ page }) => {
    await page.goto('/');

    // the shared data global is present. NB: it's declared with `const`, so it
    // lives in the global lexical scope (bare identifier), NOT on `window`.
    const player = await page.evaluate(() => RESUME_DATA && RESUME_DATA.player);
    expect(player).toBeTruthy();

    // header name comes from the data, not hardcoded
    await expect(page.locator('#r-name')).toHaveText(player.name);
    await expect(page.locator('#r-tagline')).toContainText(player.title);
    await expect(page.locator('#r-tagline')).toContainText(player.location);

    // footer contact wired from data
    const email = page.locator('#r-email');
    await expect(email).toHaveText(player.email);
    await expect(email).toHaveAttribute('href', 'mailto:' + player.email);
    await expect(page.locator('#r-linkedin')).toHaveAttribute('href', 'https://' + player.linkedin);
  });

  test('all three experience cards link to their subdirectories', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('.grid .card');
    await expect(cards).toHaveCount(3);
    await expect(page.locator('.card[href="web/"]')).toBeVisible();
    await expect(page.locator('.card[href="voyage/"]')).toBeVisible();
    await expect(page.locator('.card[href="pdf/"]')).toBeVisible();
  });

  test('layout is responsive to viewport', async ({ page }) => {
    await page.goto('/');
    // wait for the staggered entrance animations to fully settle so card
    // positions are final (robust — not a guessed timeout)
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));

    const boxes = await page.locator('.grid .card').evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y })));
    const width = page.viewportSize().width;

    if (width < 640) {
      // mobile: cards stacked — each below the previous
      expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
      expect(boxes[2].y).toBeGreaterThan(boxes[1].y);
    } else {
      // desktop: first row shares a top edge (3-up)
      expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(2);
      expect(Math.abs(boxes[1].y - boxes[2].y)).toBeLessThan(2);
    }
  });
});
