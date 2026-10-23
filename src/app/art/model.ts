export type AlgorithmId = 'flow' | 'contours' | 'orbits' | 'branches' | 'packing' | 'truchet' | 'constellation' | 'waves' | 'mosaic' | 'painter';

export interface ParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  hint?: string;
}

export interface Algorithm {
  id: AlgorithmId;
  name: string;
  category: string;
  description: string;
  icon: string;
  params: ParamDef[];
}

const p = (key: string, label: string, min: number, max: number, step: number, initial: number, hint?: string): ParamDef =>
  ({ key, label, min, max, step, default: initial, hint });

export const ALGORITHMS: Algorithm[] = [
  { id: 'flow', name: 'Flow field', category: 'Organic', icon: '≋', description: 'Lines follow directions determined by a seeded noise field.', params: [
    p('density', 'Thread count', 150, 3000, 50, 1500), p('length', 'Trail length', 20, 220, 5, 110),
    p('scale', 'Field scale', .4, 6, .1, 2.1), p('turbulence', 'Turbulence', .1, 3, .05, 1.15),
    p('curl', 'Curl', -2, 2, .05, .45), p('step', 'Step length', .8, 5, .1, 2.4),
  ] },
  { id: 'contours', name: 'Contour atlas', category: 'Organic', icon: '◎', description: 'Contour lines connect equal values in a generated terrain.', params: [
    p('levels', 'Contour levels', 5, 36, 1, 18), p('scale', 'Terrain scale', .5, 5, .1, 2.1),
    p('detail', 'Fine detail', 0, 1, .05, .45), p('island', 'Island shape', 0, 1, .05, .65),
    p('resolution', 'Grid resolution', 40, 130, 5, 95),
  ] },
  { id: 'orbits', name: 'Orbital harmonics', category: 'Geometric', icon: '✺', description: 'Nested radial curves form repeating lobed patterns.', params: [
    p('layers', 'Orbit layers', 8, 100, 1, 55), p('petals', 'Petals', 2, 18, 1, 7),
    p('amplitude', 'Petal depth', 0, .65, .01, .24), p('twist', 'Layer twist', -3, 3, .05, .6),
    p('inner', 'Inner opening', 0, .8, .01, .17), p('eccentricity', 'Eccentricity', .3, 1.6, .05, 1),
  ] },
  { id: 'branches', name: 'Recursive branches', category: 'Organic', icon: '⑂', description: 'Recursive line segments form branching structures with optional leaves.', params: [
    p('trees', 'Growth points', 1, 7, 1, 3), p('depth', 'Branching depth', 4, 11, 1, 9),
    p('spread', 'Branch angle', 10, 65, 1, 28), p('decay', 'Length decay', .5, .79, .01, .71),
    p('wind', 'Wind', -1, 1, .05, .15), p('foliage', 'Foliage', 0, 1, .05, .45),
  ] },
  { id: 'packing', name: 'Circle packing', category: 'Geometric', icon: '◌', description: 'Circles of varying sizes fill a square region without overlapping.', params: [
    p('count', 'Circle limit', 100, 1800, 50, 850), p('minimum', 'Smallest radius', 2, 15, .5, 4),
    p('maximum', 'Largest radius', 18, 100, 1, 55), p('padding', 'Circle spacing', 0, 12, .5, 2),
    p('fill', 'Filled circles', 0, 1, .05, .35), p('rings', 'Inner rings', 0, 5, 1, 2),
  ] },
  { id: 'truchet', name: 'Truchet tiles', category: 'Geometric', icon: '⌘', description: 'Grid tiles connect quarter-circle arcs with randomized orientations.', params: [
    p('grid', 'Tiles per side', 4, 30, 1, 12), p('bias', 'Orientation bias', 0, 1, .05, .5),
    p('bands', 'Parallel paths', 1, 7, 1, 3), p('spacing', 'Path spacing', .04, .2, .01, .11),
  ] },
  { id: 'constellation', name: 'Constellation', category: 'Systems', icon: '⁙', description: 'Clustered points connect to other points within a specified distance.', params: [
    p('count', 'Stars', 60, 700, 10, 320), p('reach', 'Connection distance', 25, 180, 5, 88),
    p('clusters', 'Star clusters', 1, 9, 1, 5), p('spread', 'Cluster spread', 40, 240, 5, 125),
    p('size', 'Star size', .5, 5, .25, 1.75),
  ] },
  { id: 'waves', name: 'Parametric waves', category: 'Geometric', icon: '∿', description: 'Stacked sine waves use phase offsets and noise displacement.', params: [
    p('lines', 'Wave count', 15, 160, 5, 85), p('frequency', 'Frequency', .5, 9, .1, 2.8),
    p('amplitude', 'Amplitude', 5, 180, 5, 75), p('distortion', 'Noise distortion', 0, 120, 5, 35),
    p('phase', 'Phase drift', 0, 4, .05, 1.1),
  ] },
  { id: 'mosaic', name: 'Cellular mosaic', category: 'Systems', icon: '◇', description: 'Voronoi cells divide the canvas around seed points.', params: [
    p('cells', 'Cell count', 20, 250, 5, 110), p('irregularity', 'Irregularity', 0, 1, .05, .85),
    p('relaxation', 'Relaxation passes', 0, 3, 1, 1), p('gap', 'Cell spacing', 0, 15, .5, 3),
    p('fill', 'Color coverage', .1, 1, .05, .85),
  ] },
  { id: 'painter', name: 'Image painter', category: 'Painterly', icon: '◈', description: 'Polygon strokes sample colors from an uploaded image or generated field. Brush size decreases and opacity increases over successive strokes.', params: [
    p('marks', 'Paint strokes', 500, 16000, 500, 5500), p('size', 'Starting brush size', 20, 350, 5, 150),
    p('decay', 'Brush decay', .0001, .003, .0001, .0009), p('jitter', 'Position jitter', 0, 150, 5, 25),
    p('sides', 'Polygon sides', 3, 9, 1, 5), p('initialOpacity', 'Starting opacity', .01, 1, .01, .04),
    p('opacityGrowth', 'Opacity buildup', 0, 1, .01, .82),
    p('outlineThreshold', 'Outline threshold', .01, .5, .01, .05, 'Outlines appear when the brush shrinks below this fraction of its starting size.'),
    p('detail', 'Outline strength', 0, 1, .05, .2),
  ] },
];

export interface Palette { id: string; name: string; colors: string[]; background: string; }

export const PALETTES: Palette[] = [
  { id: 'botanical', name: 'Botanical ink', colors: ['#183d38', '#39614e', '#7c8b61', '#b5aa79', '#d3b997'], background: '#f4f0e5' },
  { id: 'midnight', name: 'Midnight', colors: ['#77c9ce', '#e7c77d', '#9b93cf', '#db8675', '#e4e7e0'], background: '#131d2a' },
  { id: 'risograph', name: 'Risograph', colors: ['#d54c39', '#e59b48', '#264e79', '#7a8d69', '#d991a3'], background: '#f5ead7' },
  { id: 'ocean', name: 'Tidal', colors: ['#163f55', '#237b87', '#60a8a1', '#8ab9b1', '#d4a56f'], background: '#edf3ed' },
  { id: 'terracotta', name: 'Clay & sand', colors: ['#723c32', '#a54d36', '#cd7855', '#d6a46a', '#776d53'], background: '#f3e7d5' },
  { id: 'orchid', name: 'Orchid', colors: ['#563d68', '#88619b', '#be88aa', '#deafad', '#859a9a'], background: '#f5eff2' },
  { id: 'monochrome', name: 'Graphite', colors: ['#252b2b', '#49504e', '#737975', '#9ba09a', '#babdb5'], background: '#f1f0e9' },
  { id: 'electric', name: 'Electric dusk', colors: ['#f39b58', '#ec597b', '#ab76d7', '#6acac3', '#f2d47e'], background: '#27233e' },
];

export interface Recipe {
  version: 1;
  algorithm: AlgorithmId;
  seed: number;
  palette: string;
  background: string;
  strokeWidth: number;
  opacity: number;
  rotation: number;
  zoom: number;
  grain: number;
  params: Record<string, number>;
}

export interface RenderStats { marks: number; elapsed: number; }

export function defaultRecipe(id: AlgorithmId): Recipe {
  const algorithm = ALGORITHMS.find(a => a.id === id);
  if (!algorithm) throw new Error('Unknown generator.');
  return {
    version: 1, algorithm: id, seed: 42819, palette: 'botanical', background: PALETTES[0].background,
    strokeWidth: 1.2, opacity: .85, rotation: 0, zoom: 1, grain: .12,
    params: Object.fromEntries(algorithm.params.map(param => [param.key, param.default])),
  };
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

function numeric(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Recipe controls must contain finite numbers.');
  return Math.max(min, Math.min(max, value));
}

/** Validate untrusted imported/URL data; retain only the known, bounded recipe fields. */
export function normalizeRecipe(value: unknown): Recipe {
  if (!record(value) || value['version'] !== 1 || typeof value['algorithm'] !== 'string') throw new Error('This is not a version 1 art recipe.');
  const algorithm = ALGORITHMS.find(a => a.id === value['algorithm']);
  if (!algorithm) throw new Error('This recipe uses an unknown generator.');
  const defaults = defaultRecipe(algorithm.id);
  const palette = value['palette'] === undefined ? PALETTES[0] : PALETTES.find(palette => palette.id === value['palette']);
  if (!palette) throw new Error('This recipe uses an unknown palette.');
  const rawParams = value['params'];
  if (rawParams !== undefined && !record(rawParams)) throw new Error('Recipe parameters must be an object.');
  const params: Record<string, number> = {};
  for (const param of algorithm.params) {
    const bounded = numeric(rawParams?.[param.key], param.default, param.min, param.max);
    const stepped = param.min + Math.round((bounded - param.min) / param.step) * param.step;
    params[param.key] = Number(Math.max(param.min, Math.min(param.max, stepped)).toFixed(6));
  }
  const rawBackground = value['background'];
  let background = palette.background;
  if (rawBackground !== undefined) {
    if (typeof rawBackground !== 'string' || !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(rawBackground)) throw new Error('Background must be a hex color.');
    background = rawBackground.length === 4 ? '#' + [...rawBackground.slice(1)].map(c => c + c).join('') : rawBackground.toLowerCase();
  }
  return {
    version: 1, algorithm: algorithm.id, seed: Math.round(numeric(value['seed'], defaults.seed, 0, 4294967295)),
    palette: palette.id, background, params,
    strokeWidth: numeric(value['strokeWidth'], defaults.strokeWidth, .2, 8),
    opacity: numeric(value['opacity'], defaults.opacity, .05, 1),
    rotation: numeric(value['rotation'], defaults.rotation, -180, 180),
    zoom: numeric(value['zoom'], defaults.zoom, .4, 2.5),
    grain: numeric(value['grain'], defaults.grain, 0, 1),
  };
}
