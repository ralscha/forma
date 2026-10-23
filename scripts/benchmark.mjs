#!/usr/bin/env node
/**
 * Reproducible Canvas benchmarks, independent of the Angular development server.
 * Run: node scripts/benchmark.mjs [--browser=msedge|chromium] [--repeats=3] [--json]
 * Requires npm install and either Microsoft Edge or Playwright's Chromium.
 * Each case warms once, then reports the median of three complete renders.
 * Engine time measures drawing calls; frame time additionally reads every pixel
 * to force deferred raster work to finish (and includes that pixel-copy cost).
 */
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import ts from 'typescript';

const args = process.argv.slice(2);
const repeats = Number(args.find(arg => arg.startsWith('--repeats='))?.split('=')[1] ?? 3);
const requestedBrowser = args.find(arg => arg.startsWith('--browser='))?.split('=')[1];
const json = args.includes('--json');
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 10) throw new Error('--repeats must be an integer from 1 to 10.');
if (requestedBrowser && !['msedge', 'chromium'].includes(requestedBrowser)) throw new Error('--browser must be msedge or chromium.');

const compile = name => ts.transpileModule(
  readFileSync(new URL(`../src/app/art/${name}.ts`, import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText;
const modules = { model: compile('model'), engine: compile('engine') };

let browser;
let selectedBrowser;
const launchErrors = [];
for (const candidate of requestedBrowser ? [requestedBrowser] : ['msedge', 'chromium']) {
  try {
    browser = await chromium.launch({ headless: true, ...(candidate === 'msedge' ? { channel: 'msedge' } : {}) });
    selectedBrowser = candidate;
    break;
  } catch (error) { launchErrors.push(`${candidate}: ${error.message}`); }
}
if (!browser) throw new Error(`No browser could launch. Install Microsoft Edge or run npx playwright install chromium.\n${launchErrors.join('\n')}`);

try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 1 });
  await page.evaluate(({ modelCode, engineCode }) => {
    const model = {};
    new Function('exports', modelCode)(model);
    const engine = {};
    new Function('require', 'exports', engineCode)(() => model, engine);
    globalThis.benchmarkStudio = { model, engine };
  }, { modelCode: modules.model, engineCode: modules.engine });

  const defaults = await page.evaluate(() => globalThis.benchmarkStudio.model.ALGORITHMS.map(algorithm => algorithm.id));
  const cases = [
    ...defaults.map(algorithm => ({ algorithm, size: 1000, settings: 'default' })),
    ...['flow', 'painter', 'mosaic'].map(algorithm => ({ algorithm, size: 4096, settings: 'default' })),
    ...['flow', 'contours'].map(algorithm => ({ algorithm, size: 1000, settings: 'maximum' })),
  ];
  const results = [];
  for (const testCase of cases) {
    const result = await page.evaluate(async ({ testCase, repeats }) => {
      const { model, engine } = globalThis.benchmarkStudio;
      const recipe = model.defaultRecipe(testCase.algorithm);
      if (testCase.settings === 'maximum') {
        recipe.params = Object.fromEntries(model.ALGORITHMS.find(algorithm => algorithm.id === testCase.algorithm).params.map(param => [param.key, param.max]));
      }
      const engineSamples = [];
      const frameSamples = [];
      let marks = 0;
      let checksum = 0;
      // Match the worker's fresh software surface for reproducible pixels.
      for (let trial = -1; trial < repeats; trial++) {
        const canvas = new OffscreenCanvas(testCase.size, testCase.size);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('2D Canvas is unavailable.');
        const started = performance.now();
        const stats = engine.renderArt(ctx, testCase.size, testCase.size, recipe);
        const pixels = ctx.getImageData(0, 0, testCase.size, testCase.size);
        const completed = performance.now() - started;
        // Consume a small sample so the readback is observably used.
        for (let pixel = 0; pixel < pixels.data.length; pixel += 4096) checksum = (checksum + pixels.data[pixel]) >>> 0;
        if (trial >= 0) { engineSamples.push(stats.elapsed); frameSamples.push(completed); }
        marks = stats.marks;
        canvas.width = 1;
        canvas.height = 1;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      const median = samples => {
        const sorted = [...samples].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
      };
      const rounded = number => Math.round(number * 10) / 10;
      return {
        ...testCase, marks,
        engineMedianMs: rounded(median(engineSamples)),
        frameMedianMs: rounded(median(frameSamples)),
        engineSamplesMs: engineSamples.map(rounded),
        frameSamplesMs: frameSamples.map(rounded),
        checksum,
      };
    }, { testCase, repeats });
    results.push(result);
    if (!json) process.stdout.write(`${result.algorithm.padEnd(14)} ${String(result.size).padStart(4)}² ${result.settings.padEnd(7)}  engine ${String(result.engineMedianMs).padStart(7)} ms  frame ${String(result.frameMedianMs).padStart(7)} ms\n`);
  }
  const report = {
    browser: selectedBrowser,
    browserVersion: browser.version(),
    platform: process.platform,
    architecture: process.arch,
    nodeVersion: process.version,
    repeats,
    warmupRenders: 1,
    note: 'Frame times include full-frame pixel readback; timings vary with hardware, browser, and current system load. No WASM comparison is implied.',
    results,
  };
  if (json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else process.stdout.write(`\n${report.browser} ${report.browserVersion}; ${repeats} measured renders after one warmup per case.\n${report.note}\n`);
} finally { await browser.close(); }
