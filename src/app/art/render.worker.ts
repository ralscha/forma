/// <reference lib="webworker" />

import { renderArt } from './engine';
import { Recipe } from './model';

interface RenderRequest { id: number; width: number; height: number; recipe: Recipe; source?: ImageData; }

addEventListener('message', ({ data }: MessageEvent<RenderRequest>) => {
  const { id, width, height, recipe, source } = data;
  try {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 33554432) {
      throw new Error('Render size must be between 1 and 8192 pixels, up to 32 megapixels.');
    }
    const canvas = new OffscreenCanvas(width, height);
    // Keep one raster backend across fresh workers and pixel exports. Automatic
    // GPU/CPU changes can otherwise produce slightly different antialiased pixels.
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('A 2D drawing context is unavailable.');
    const stats = renderArt(context, width, height, recipe, source);
    const bitmap = canvas.transferToImageBitmap();
    postMessage({ id, bitmap, stats }, [bitmap]);
  } catch (error) {
    postMessage({ id, error: error instanceof Error ? error.message : 'The artwork could not be rendered.' });
  }
});
