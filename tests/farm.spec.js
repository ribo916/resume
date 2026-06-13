// @ts-check
const { test, expect } = require('@playwright/test');
const { collectErrors } = require('./helpers');

// Canvas game; give the engine a moment to boot and expose its hook.
test.describe('Career Valley (farm)', () => {
  test.setTimeout(60_000);

  test('canvas boots with no JS errors', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/farm/');

    // engine booted and exposed its debug hook
    await page.waitForFunction(() => !!window.__farm, null, { timeout: 20_000 });

    // the game canvas rendered with real dimensions
    const canvas = page.locator('#game');
    await expect(canvas).toBeAttached();
    const box = await canvas.boundingBox();
    expect(box && box.width).toBeGreaterThan(0);
    expect(box && box.height).toBeGreaterThan(0);

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('shared data drives the farms (all 7, correct order)', async ({ page }) => {
    await page.goto('/farm/');
    await page.waitForFunction(() => !!window.__farm);

    const ids = await page.evaluate(() => window.__farm.farms);
    expect(ids).toEqual(['csus', 'intuit', 'fis', 'trustage', 'oneinc', 'paynearme', 'polly']);

    // content actually comes from RESUME_DATA (single source of truth).
    // RESUME_DATA / FARM_DATA are `const` globals → bare identifiers, not on window.
    const wired = await page.evaluate(() => {
      const r = RESUME_DATA.roles.map((x) => x.id).join(',');
      const v = FARM_DATA.farms.map((x) => x.id).join(',');
      return r === v;
    });
    expect(wired).toBe(true);
  });

  test('visiting each farm shows a panel whose content matches the data', async ({ page }) => {
    await page.goto('/farm/');
    await page.waitForFunction(() => !!window.__farm);

    const items = await page.evaluate(() => FARM_DATA.farms.map((i) => ({
      id: i.id, name: i.name, role: i.role, dates: i.dates,
      highlights: i.highlights.length, tech: i.tech.length,
    })));

    const panel = page.locator('#panel');

    for (const it of items) {
      await page.evaluate((id) => window.__farm.visit(id), it.id);
      await expect(panel).toHaveClass(/open/);

      await expect(page.locator('#panel-name')).toHaveText(it.name);
      await expect(page.locator('#panel-role')).toHaveText(it.role);
      // current role's date line gets a "· Current" suffix from the engine
      await expect(page.locator('#panel-dates')).toContainText(it.dates);
      await expect(page.locator('#panel-highlights li')).toHaveCount(it.highlights);
      await expect(page.locator('#panel-tech .tag')).toHaveCount(it.tech);

      await page.evaluate(() => window.__farm.leave());
      await expect(panel).not.toHaveClass(/open/);
    }
  });

  test('status hook reports visiting state correctly', async ({ page }) => {
    await page.goto('/farm/');
    await page.waitForFunction(() => !!window.__farm);

    await page.evaluate(() => window.__farm.visit('polly'));
    let s = await page.evaluate(() => window.__farm.status());
    expect(s.visiting).toBe('polly');

    await page.evaluate(() => window.__farm.leave());
    s = await page.evaluate(() => window.__farm.status());
    expect(s.visiting).toBeNull();
  });
});
