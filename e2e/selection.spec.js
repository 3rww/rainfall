import { test, expect } from '@playwright/test';
import { registerMockApiRoutes } from './helpers/mockApi';
import { rainfallGeometry } from './helpers/largeRainfall';

const pixelIds = Array.from({ length: 1000 }, (_, i) => String(100 + i));
const lookup = {
  basin: {
    'North Basin': { pixel: pixelIds.slice(0, 700), gauge: ['8'] },
    'South Basin': { pixel: pixelIds.slice(400), gauge: ['8'] },
    'Small Basin': { pixel: pixelIds.slice(0, 10), gauge: ['8'] }
  }
};

async function openPicker(page) {
  await registerMockApiRoutes(page, { pixels: rainfallGeometry(pixelIds.length) });
  await page.route('**/static/data/geography-lookup.json', route => route.fulfill({ json: lookup }));
  await page.goto('/');
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.waitForFunction(() => window.__APP_STORE__?.getState().refData.lookups?.basin?.['North Basin']);
  await page.getByRole('button', { name: 'Calibrated Radar Rainfall', exact: true }).click();
  await page.getByRole('tab', { name: 'By Geography', exact: true }).click();
  await expect(page.locator('#geom-picker-pixel-input')).toHaveCount(0);
}

async function pickBasin(page, name) {
  await page.getByRole('combobox', { name: 'Basin, municipality, or watershed' }).fill(name);
  await page.getByRole('option', { name, exact: true }).click();
}

const selection = page => page.evaluate(() => {
  const state = window.__APP_STORE__.getState();
  const { pixel, gauge, geographies } = state.fetchKwargs.legacyGarr.active.sensorLocations;
  return {
    pixels: pixel.map(option => option.value),
    gauges: gauge.map(option => option.value),
    geographies: geographies.map(option => option.label),
    highlighted: state.mapStyle.sources.pixel.data.features.filter(f => f.properties.selected).map(f => f.id)
  };
});

test('large overlapping basins keep selection and highlights when inactive pickers unmount', async ({ page }) => {
  await openPicker(page);
  await pickBasin(page, 'North Basin');
  await pickBasin(page, 'South Basin');
  await expect.poll(() => selection(page)).toEqual({
    pixels: pixelIds, gauges: [], geographies: ['North Basin', 'South Basin'], highlighted: pixelIds
  });
  // Hidden controls must be absent, not just CSS-hidden with hundreds of chips.
  await expect(page.locator('#geom-picker-pixel-input')).toHaveCount(0);
  await expect(page.locator('.pixel-select__multi-value')).toHaveCount(0);

  await page.getByRole('tab', { name: 'By Sensor', exact: true }).click();
  await expect(page.getByText('1000 pixels selected', { exact: true })).toBeVisible();
  await expect(page.locator('.pixel-select__multi-value')).toHaveCount(0);
  await expect(page.locator('#geom-picker-geography-input')).toHaveCount(0);

  await page.getByRole('tab', { name: 'By Geography', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove North Basin', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Historical Rain Gauge', exact: true }).click();
  await expect(page.locator('#geom-picker-pixel-input')).toHaveCount(0);
  await expect(page.locator('#geom-picker-geography-input')).toHaveCount(0);
  await page.getByRole('button', { name: 'Calibrated Radar Rainfall', exact: true }).click();
  await page.getByRole('tab', { name: 'By Geography', exact: true }).click();
  await page.getByRole('button', { name: 'Remove North Basin', exact: true }).click();
  await expect.poll(() => selection(page)).toEqual({
    pixels: pixelIds.slice(400), gauges: [], geographies: ['South Basin'], highlighted: pixelIds.slice(400)
  });
  await page.getByRole('button', { name: 'Remove South Basin', exact: true }).click();
  await expect.poll(() => selection(page)).toEqual({ pixels: [], gauges: [], geographies: [], highlighted: [] });
});

test('pixel summary preserves keyboard add/remove, small selection chips, and clear-all', async ({ page }) => {
  await openPicker(page);
  await pickBasin(page, 'Small Basin');
  await page.getByRole('tab', { name: 'By Sensor', exact: true }).click();
  await expect(page.locator('.pixel-select__multi-value')).toHaveCount(10);
  const input = page.getByRole('combobox', { name: 'Radar Pixels', exact: true });
  const choosePixel = async () => {
    await input.fill('799');
    await expect(page.getByRole('option', { name: '799', exact: true })).toBeVisible();
    await input.press('ArrowDown');
    await input.press('Enter');
  };
  await choosePixel();
  await expect(page.getByText('11 pixels selected', { exact: true })).toBeVisible();
  await expect(page.locator('.pixel-select__multi-value')).toHaveCount(0);
  await expect.poll(async () => (await selection(page)).highlighted).toEqual([...pixelIds.slice(0, 10), '799']);

  // Selected options remain searchable in summary mode, including keyboard removal.
  await choosePixel();
  await expect(page.locator('.pixel-select__multi-value')).toHaveCount(10);
  await expect.poll(async () => (await selection(page)).pixels).toEqual(pixelIds.slice(0, 10));

  await choosePixel();
  await page.locator('.pixel-select__clear-indicator').click();
  await expect.poll(async () => {
    const { pixels, highlighted } = await selection(page);
    return { pixels, highlighted };
  }).toEqual({ pixels: [], highlighted: [] });
  await expect(page.locator('.pixel-select__multi-value')).toHaveCount(0);
  await expect(page.getByText('11 pixels selected', { exact: true })).toHaveCount(0);
});
