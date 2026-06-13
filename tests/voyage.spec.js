// @ts-check
const { test, expect } = require('@playwright/test');
const { collectErrors } = require('./helpers');

// The voyage is WebGL-heavy; give the engine room to boot.
test.describe('Career Voyage', () => {
  test.setTimeout(60_000);

  test('WebGL scene boots with no JS errors', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/voyage/');

    // Three.js loaded (vendored or CDN fallback)
    await page.waitForFunction(() => typeof window.THREE !== 'undefined', null, { timeout: 20_000 });
    // engine booted and exposed its debug hook
    await page.waitForFunction(() => !!window.__voyage, null, { timeout: 20_000 });

    // a canvas was rendered into the scene with real dimensions
    const canvas = page.locator('#scene canvas');
    await expect(canvas).toBeAttached();
    const box = await canvas.boundingBox();
    expect(box && box.width).toBeGreaterThan(0);
    expect(box && box.height).toBeGreaterThan(0);

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('shared data drives the islands (all 7, correct order)', async ({ page }) => {
    await page.goto('/voyage/');
    await page.waitForFunction(() => !!window.__voyage);

    const ids = await page.evaluate(() => window.__voyage.islands);
    expect(ids).toEqual(['csus', 'intuit', 'fis', 'trustage', 'oneinc', 'paynearme', 'polly']);

    // confirm the content actually came from RESUME_DATA (single source of truth).
    // RESUME_DATA / VOYAGE_DATA are `const` globals → bare identifiers, not on window.
    const wired = await page.evaluate(() => {
      const r = RESUME_DATA.roles.map((x) => x.id).join(',');
      const v = VOYAGE_DATA.islands.map((x) => x.id).join(',');
      return r === v;
    });
    expect(wired).toBe(true);
  });

  test('docking each island shows a panel whose content matches the data', async ({ page }) => {
    await page.goto('/voyage/');
    await page.waitForFunction(() => !!window.__voyage);

    const islands = await page.evaluate(() => VOYAGE_DATA.islands.map((i) => ({
      id: i.id, name: i.name, role: i.role, dates: i.dates,
      highlights: i.highlights.length, tech: i.tech.length,
    })));

    const panel = page.locator('#panel');

    for (const isl of islands) {
      await page.evaluate((id) => window.__voyage.dock(id), isl.id);
      await expect(panel).toHaveClass(/open/);

      await expect(page.locator('#panel-name')).toHaveText(isl.name);
      await expect(page.locator('#panel-role')).toHaveText(isl.role);
      // current role's date line gets a "· Current" suffix from the engine
      await expect(page.locator('#panel-dates')).toContainText(isl.dates);
      await expect(page.locator('#panel-highlights li')).toHaveCount(isl.highlights);
      await expect(page.locator('#panel-tech .tag')).toHaveCount(isl.tech);

      await page.evaluate(() => window.__voyage.undock());
      await expect(panel).not.toHaveClass(/open/);
    }
  });

  test('status hook reports docked/sailing state correctly', async ({ page }) => {
    await page.goto('/voyage/');
    await page.waitForFunction(() => !!window.__voyage);

    // status().docked is the docked island's id (or null when sailing), by design
    await page.evaluate(() => window.__voyage.dock('polly'));
    let s = await page.evaluate(() => window.__voyage.status());
    expect(s.docked).toBe('polly');

    await page.evaluate(() => window.__voyage.undock());
    s = await page.evaluate(() => window.__voyage.status());
    expect(s.docked).toBeNull();
  });
});
