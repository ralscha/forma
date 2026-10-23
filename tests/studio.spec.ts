import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test, type Download, type Locator, type Page } from '@playwright/test';

const generators = [
  'Contour atlas',
  'Orbital harmonics',
  'Recursive branches',
  'Circle packing',
  'Truchet tiles',
  'Constellation',
  'Parametric waves',
  'Cellular mosaic',
  'Image painter',
  'Flow field',
];

async function ready(page: Page): Promise<void> {
  await expect(page.getByTestId('art-canvas')).toBeVisible();
  await expect(page.getByTestId('render-status')).toHaveText('Ready');
}

async function renderAfter(page: Page, action: () => Promise<unknown>): Promise<void> {
  const canvas = page.getByTestId('art-canvas');
  const previousId = await canvas.getAttribute('data-render-id');
  await action();
  await expect.poll(() => canvas.getAttribute('data-render-id')).not.toBe(previousId);
  await ready(page);
}

async function canvasHash(page: Page): Promise<string> {
  const image = await page.getByTestId('art-canvas').evaluate((node) =>
    (node as HTMLCanvasElement).toDataURL('image/png'));
  return createHash('sha256').update(image).digest('hex');
}

async function enterSeed(page: Page, value: string): Promise<void> {
  const seed = page.getByLabel('Seed', { exact: true });
  await seed.fill(value);
  await seed.press('Tab');
}

async function expectPaintedCanvas(page: Page): Promise<void> {
  const colors = await page.getByTestId('art-canvas').evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (!context || !canvas.width || !canvas.height) return 0;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const unique = new Set<number>();
    // Sample across the complete image so transparent or single-color output fails.
    const stride = Math.max(1, Math.floor(pixels.length / 4 / 20_000)) * 4;
    for (let index = 0; index < pixels.length; index += stride) {
      if (pixels[index + 3] > 0) {
        unique.add((pixels[index] << 16) | (pixels[index + 1] << 8) | pixels[index + 2]);
      }
    }
    return unique.size;
  });
  expect(colors).toBeGreaterThan(8);
}

async function downloadBytes(download: Download): Promise<Buffer> {
  expect(await download.failure()).toBeNull();
  const path = await download.path();
  expect(path).not.toBeNull();
  return readFile(path!);
}

async function editorValues(page: Page): Promise<Record<string, string>> {
  return page.getByRole('complementary', { name: 'Art settings' })
    .locator('input:not([type="file"]), select')
    .evaluateAll((nodes) => Object.fromEntries(nodes.map((node) => {
      const control = node as HTMLInputElement | HTMLSelectElement;
      return [control.id, control.value];
    })));
}

async function expectFullscreenGeometry(page: Page): Promise<void> {
  const workspace = page.getByRole('region', { name: 'Artwork workspace' });
  const stage = workspace.locator('.canvas-stage');
  const canvas = page.getByTestId('art-canvas');
  await expect(page.getByRole('button', { name: 'Exit fullscreen', exact: true })).toBeVisible();

  // Wait for the browser's native fullscreen transition as well as the app's CSS.
  await expect.poll(async () => {
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    const bounds = await workspace.boundingBox();
    return !!bounds && bounds.width > viewport.width * .9
      && Math.abs(bounds.height - viewport.height) <= 2;
  }, { message: 'The artwork workspace should occupy the fullscreen viewport' }).toBe(true);

  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  const stageBounds = await stage.boundingBox();
  const artworkBounds = await canvas.boundingBox();
  expect(stageBounds).not.toBeNull();
  expect(artworkBounds).not.toBeNull();
  expect(stageBounds!.width).toBeGreaterThan(viewport.width * .9);
  const minimumArtSize = Math.min(viewport.width, viewport.height) * .65;
  expect(artworkBounds!.width).toBeGreaterThan(minimumArtSize);
  expect(artworkBounds!.height).toBeGreaterThan(minimumArtSize);
  expect(Math.abs(artworkBounds!.width - artworkBounds!.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(artworkBounds!.x + artworkBounds!.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(16);
  expect(artworkBounds!.y).toBeGreaterThanOrEqual(0);
  expect(artworkBounds!.y + artworkBounds!.height).toBeLessThanOrEqual(viewport.height + 1);
  const overflow = await page.evaluate(() =>
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole('complementary', { name: 'Generator library', includeHidden: true })).toBeHidden();
  await expect(page.getByRole('complementary', { name: 'Art settings', includeHidden: true })).toBeHidden();
}

async function expectEditorRestored(page: Page, settings: Record<string, string>, image: string): Promise<void> {
  await expect(page.getByRole('button', { name: 'Fullscreen', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exit fullscreen', exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await expect(page.getByRole('complementary', { name: 'Generator library' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Art settings' })).toBeVisible();
  await ready(page);
  expect(await editorValues(page)).toEqual(settings);
  expect(await canvasHash(page)).toBe(image);
}

async function expectMinimumFont(locator: Locator, minimum: number, description: string): Promise<void> {
  await expect(locator).toBeVisible();
  const size = await locator.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  expect(size, `${description} should remain readable`).toBeGreaterThanOrEqual(minimum);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
});

test('a seed reproduces the same image, with working undo, redo, and reset', async ({ page }) => {
  const seed = page.getByLabel('Seed', { exact: true });
  await renderAfter(page, () => enterSeed(page, '4242'));
  const firstImage = await canvasHash(page);

  await renderAfter(page, () => enterSeed(page, '4243'));
  expect(await canvasHash(page)).not.toBe(firstImage);
  await renderAfter(page, () => enterSeed(page, '4242'));
  expect(await canvasHash(page)).toBe(firstImage);

  await renderAfter(page, () => page.getByRole('button', { name: 'Undo', exact: true }).click());
  await expect(seed).toHaveValue('4243');
  await renderAfter(page, () => page.getByRole('button', { name: 'Redo', exact: true }).click());
  await expect(seed).toHaveValue('4242');
  expect(await canvasHash(page)).toBe(firstImage);

  await renderAfter(page, () => page.getByRole('button', { name: 'Randomize settings', exact: true }).click());
  expect(await canvasHash(page)).not.toBe(firstImage);
  await renderAfter(page, () => page.getByRole('button', { name: 'Reset settings', exact: true }).click());
  await expect(seed).toHaveValue('4242');
  expect(await canvasHash(page)).toBe(firstImage);
});

test('all ten generators produce distinct visible art without runtime errors', async ({ page }) => {
  test.setTimeout(120_000);
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  const hashes = new Set<string>();

  for (const name of generators) {
    await test.step(name, async () => {
      await renderAfter(page, () => page.getByRole('button', { name, exact: true }).click());
      await expectPaintedCanvas(page);
      await expect(page.getByTestId('render-time')).toContainText(/\d/);
      hashes.add(await canvasHash(page));
    });
  }

  expect(hashes.size).toBe(generators.length);
  expect(runtimeErrors).toEqual([]);
});

test('saved studies survive reload and restore their seed and artwork', async ({ page }) => {
  await renderAfter(page, () => enterSeed(page, '56031'));
  const savedImage = await canvasHash(page);
  await page.getByRole('button', { name: 'Save study', exact: true }).click();
  await renderAfter(page, () => page.getByRole('button', { name: 'New seed', exact: true }).click());
  expect(await canvasHash(page)).not.toBe(savedImage);

  await page.reload();
  await ready(page);
  await page.getByRole('button', { name: 'Saved studies', exact: true }).click();
  const openStudy = page.getByRole('button', { name: /Open study/ });
  await expect(openStudy).toHaveCount(1);
  await openStudy.click();
  await ready(page);
  await expect(page.getByLabel('Seed', { exact: true })).toHaveValue('56031');
  expect(await canvasHash(page)).toBe(savedImage);

  await page.getByRole('button', { name: 'Saved studies', exact: true }).click();
  await page.getByRole('button', { name: /Delete study/ }).click();
  await expect(page.getByRole('button', { name: /Open study/ })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Saved studies', exact: true }).click();
  await expect(page.getByRole('button', { name: /Open study/ })).toHaveCount(0);
});

test('recipe downloads round-trip the artwork and malformed JSON is rejected', async ({ page }) => {
  await renderAfter(page, () => enterSeed(page, '1776'));
  const originalImage = await canvasHash(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export recipe', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/i);
  const recipe = await downloadBytes(download);
  expect(JSON.parse(recipe.toString('utf8'))).toEqual(expect.any(Object));

  await renderAfter(page, () => page.getByRole('button', { name: 'New seed', exact: true }).click());
  await renderAfter(page, () => page.getByLabel('Import recipe file', { exact: true }).setInputFiles({
    name: 'study.json', mimeType: 'application/json', buffer: recipe,
  }));
  await expect(page.getByLabel('Seed', { exact: true })).toHaveValue('1776');
  expect(await canvasHash(page)).toBe(originalImage);

  await page.getByLabel('Import recipe file', { exact: true }).setInputFiles({
    name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{ invalid JSON'),
  });
  await expect(page.getByRole('status').filter({ hasText: /invalid|failed|error|could not|unable/i })).toBeVisible();
  await expect(page.getByTestId('render-status')).toHaveText('Ready');
  expect(await canvasHash(page)).toBe(originalImage);
});

test('PNG export produces a real image at the chosen output dimensions', async ({ page }) => {
  await renderAfter(page, () => page.getByRole('button', { name: '4:3', exact: true }).click());
  await page.getByLabel('Export size', { exact: true }).selectOption('1024');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/i);
  const png = await downloadBytes(download);
  expect(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
  expect(png.readUInt32BE(16)).toBe(1024);
  expect(png.readUInt32BE(20)).toBe(768);
  expect(png.length).toBeGreaterThan(10_000);
});

test('image painter uses an uploaded source image', async ({ page }) => {
  await renderAfter(page, () => page.getByRole('button', { name: 'Image painter', exact: true }).click());
  const previousImage = await canvasHash(page);
  const source = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d')!;
    for (const [index, color] of ['#ff3c55', '#ffce47', '#2979ff', '#20dba0'].entries()) {
      context.fillStyle = color;
      context.fillRect((index % 2) * 32, Math.floor(index / 2) * 32, 32, 32);
    }
    return canvas.toDataURL('image/png').split(',')[1];
  });

  await renderAfter(page, () => page.getByLabel('Upload source image', { exact: true }).setInputFiles({
    name: 'four-colors.png', mimeType: 'image/png', buffer: Buffer.from(source, 'base64'),
  }));
  expect(await canvasHash(page)).not.toBe(previousImage);
  await expectPaintedCanvas(page);
  const paintedImage = await canvasHash(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export recipe', exact: true }).click();
  const recipe = await downloadBytes(await downloadPromise);
  expect(JSON.parse(recipe.toString('utf8')).sourceImage).toMatch(/^data:image\/png;base64,/);
  await renderAfter(page, () => page.getByRole('button', { name: 'Remove source image', exact: true }).click());
  expect(await canvasHash(page)).toBe(previousImage);
  await renderAfter(page, () => page.getByLabel('Import recipe file', { exact: true }).setInputFiles({
    name: 'painted-study.json', mimeType: 'application/json', buffer: recipe,
  }));
  expect(await canvasHash(page)).toBe(paintedImage);
  await page.reload();
  await ready(page);
  expect(await canvasHash(page)).toBe(paintedImage);
  const sharedRecipe = JSON.parse(recipe.toString('utf8'));
  delete sharedRecipe.sourceImage;
  await page.goto('/#study=' + Buffer.from(JSON.stringify(sharedRecipe)).toString('base64'));
  await page.reload();
  await ready(page);
  // A linked procedural study must not inherit an unrelated, locally stored photo.
  expect(await canvasHash(page)).toBe(previousImage);
});

test('mobile exploration fits the viewport and keeps controls usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const overflow = await page.evaluate(() =>
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const canvas = await page.getByTestId('art-canvas').boundingBox();
  expect(canvas).not.toBeNull();
  expect(canvas!.width).toBeLessThanOrEqual(390);
  await renderAfter(page, () => page.getByRole('button', { name: 'Contour atlas', exact: true }).click());
  await expectPaintedCanvas(page);
  await page.getByRole('button', { name: 'Saved studies', exact: true }).click();
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await ready(page);
});

for (const width of [1280, 1512, 1920]) {
  test(`fullscreen fills a ${width}px desktop and all exit paths preserve the study`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await renderAfter(page, () => enterSeed(page, '90210'));
    await renderAfter(page, () => page.getByLabel('Thread count', { exact: true }).press('ArrowRight'));
    const settings = await editorValues(page);
    const image = await canvasHash(page);
    const fullscreen = page.getByRole('button', { name: 'Fullscreen', exact: true });
    const workspace = page.getByRole('region', { name: 'Artwork workspace' });
    const nativeFullscreenAvailable = await page.evaluate(() =>
      document.fullscreenEnabled && typeof HTMLElement.prototype.requestFullscreen === 'function');

    await test.step('fullscreen geometry and Escape', async () => {
      await fullscreen.click();
      await expectFullscreenGeometry(page);
      if (nativeFullscreenAvailable) {
        await expect.poll(() => workspace.evaluate((node) => document.fullscreenElement === node)).toBe(true);
      }
      expect(await canvasHash(page)).toBe(image);
      await page.keyboard.press('Escape');
      await expectEditorRestored(page, settings, image);
    });

    await test.step('the exit button restores the editor', async () => {
      await fullscreen.click();
      await expectFullscreenGeometry(page);
      await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
      await expectEditorRestored(page, settings, image);
    });

    if (nativeFullscreenAvailable) {
      await test.step('browser fullscreen exit synchronizes the app state', async () => {
        await fullscreen.click();
        await expect.poll(() => workspace.evaluate((node) => document.fullscreenElement === node)).toBe(true);
        await page.evaluate(() => document.exitFullscreen());
        await expectEditorRestored(page, settings, image);
      });
    }
  });
}

test('a rejected native fullscreen request falls back to a full viewport and exits cleanly', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value() {
        const data = document.documentElement.dataset;
        data['fullscreenTestRequests'] = String(Number(data['fullscreenTestRequests'] || 0) + 1);
        return Promise.reject(new DOMException('Fullscreen blocked for this test', 'NotAllowedError'));
      },
    });
  });
  await page.setViewportSize({ width: 1512, height: 1000 });
  await page.reload();
  await ready(page);
  const settings = await editorValues(page);
  const image = await canvasHash(page);

  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset['fullscreenTestRequests'])).toBe('1');
  await expectFullscreenGeometry(page);
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  expect(await canvasHash(page)).toBe(image);
  await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  await expectEditorRestored(page, settings, image);
});

for (const width of [1920, 390]) {
  test(`control and helper typography stays readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await ready(page);
    const settings = page.getByRole('complementary', { name: 'Art settings' });
    const navigation = page.getByRole('navigation', { name: 'Main navigation' });

    for (const label of ['Seed', 'Thread count', 'Ink opacity']) {
      await expectMinimumFont(settings.getByText(label, { exact: true }), 14, `${label} label`);
    }
    await expectMinimumFont(settings.getByLabel('Seed', { exact: true }), 14, 'Seed input');
    await expectMinimumFont(settings.getByLabel('Export size', { exact: true }), 14, 'Export size selector');
    for (const name of ['Explore', 'Saved studies']) {
      await expectMinimumFont(navigation.getByRole('button', { name, exact: true }), 14, `${name} navigation`);
    }
    await expectMinimumFont(settings.getByText(/pixels on the longest edge/), 12, 'Export helper');
    await expectMinimumFont(page.getByTestId('render-status'), 12, 'Render status');
    await expectMinimumFont(page.getByTestId('render-time'), 12, 'Render duration');
    const overflow = await page.evaluate(() =>
      Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
