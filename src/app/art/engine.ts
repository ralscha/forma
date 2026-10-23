import { normalizeRecipe, PALETTES, Recipe, RenderStats } from './model';

type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Point = { x: number; y: number };
type Random = () => number;
const TAU = Math.PI * 2;
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp = (n: number, low = 0, high = 1): number => Math.max(low, Math.min(high, n));

export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function noiseFactory(seed: number): (x: number, y: number) => number {
  const hash = (x: number, y: number): number => {
    let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  return (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    return mix(mix(hash(ix, iy), hash(ix + 1, iy), fx), mix(hash(ix, iy + 1), hash(ix + 1, iy + 1), fx), fy);
  };
}

function rgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

interface Studio {
  ctx: Context;
  r: Recipe;
  random: Random;
  noise: (x: number, y: number) => number;
  colors: string[];
  marks: number;
}

function color(s: Studio, position: number): string {
  return s.colors[Math.min(s.colors.length - 1, Math.floor(clamp(position) * s.colors.length))];
}

function flow(s: Studio): void {
  const { ctx, r, random, noise } = s, p = r.params;
  const offsetX = random() * 100, offsetY = random() * 100;
  ctx.lineCap = 'round';
  for (let i = 0; i < p['density']; i++) {
    let x = random() * 1040 - 20, y = random() * 1040 - 20;
    const tint = noise(x / 450 + 8, y / 450 + 8);
    ctx.strokeStyle = color(s, tint);
    ctx.lineWidth = r.strokeWidth * (.35 + random() * .9);
    ctx.globalAlpha = r.opacity * (.25 + random() * .5);
    ctx.beginPath(); ctx.moveTo(x, y);
    const length = Math.round(p['length'] * (.35 + random() * .65));
    for (let j = 0; j < length; j++) {
      const nx = x / 1000 * p['scale'] + offsetX, ny = y / 1000 * p['scale'] + offsetY;
      const field = noise(nx, ny) + (noise(nx * 2.1, ny * 2.1) - .5) * .24;
      const angle = field * TAU * p['turbulence'] + Math.atan2(y - 500, x - 500) * p['curl'];
      x += Math.cos(angle) * p['step']; y += Math.sin(angle) * p['step'];
      ctx.lineTo(x, y);
      if (x < -80 || x > 1080 || y < -80 || y > 1080) break;
    }
    ctx.stroke(); s.marks++;
  }
}

function contours(s: Studio): void {
  const { ctx, r, noise, random } = s, p = r.params;
  const n = Math.round(p['resolution']), side = n + 1, step = 1100 / n;
  const values = new Float32Array(side * side);
  const ox = random() * 40, oy = random() * 40;
  let min = Infinity, max = -Infinity;
  for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) {
    const u = x / n, v = y / n, nx = u * p['scale'] + ox, ny = v * p['scale'] + oy;
    const radial = Math.hypot(u - .5, v - .5);
    const value = noise(nx, ny) + (noise(nx * 2.6, ny * 2.6) - .5) * p['detail'] * .45 - radial * p['island'];
    values[y * side + x] = value; min = Math.min(min, value); max = Math.max(max, value);
  }
  for (let level = 1; level <= p['levels']; level++) {
    const threshold = mix(min, max, level / (p['levels'] + 1));
    ctx.strokeStyle = color(s, level / (p['levels'] + 1));
    ctx.globalAlpha = r.opacity * (level % 4 === 0 ? .95 : .67);
    ctx.lineWidth = r.strokeWidth * (level % 4 === 0 ? 1.65 : .8);
    ctx.beginPath();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const a = values[y * side + x], b = values[y * side + x + 1], c = values[(y + 1) * side + x + 1], d = values[(y + 1) * side + x];
      const points: Point[] = [];
      const x0 = x * step - 50, y0 = y * step - 50;
      if ((a < threshold) !== (b < threshold)) points.push({ x: x0 + step * (threshold - a) / (b - a), y: y0 });
      if ((b < threshold) !== (c < threshold)) points.push({ x: x0 + step, y: y0 + step * (threshold - b) / (c - b) });
      if ((c < threshold) !== (d < threshold)) points.push({ x: x0 + step * (threshold - d) / (c - d), y: y0 + step });
      if ((d < threshold) !== (a < threshold)) points.push({ x: x0, y: y0 + step * (threshold - a) / (d - a) });
      // For saddle cells, join the edges according to the center value.
      if (points.length === 4 && (((a + b + c + d) / 4 > threshold) !== (a > threshold))) points.push(points.shift()!);
      for (let k = 0; k + 1 < points.length; k += 2) {
        ctx.moveTo(points[k].x, points[k].y); ctx.lineTo(points[k + 1].x, points[k + 1].y); s.marks++;
      }
    }
    ctx.stroke();
  }
}

function orbits(s: Studio): void {
  const { ctx, r, random } = s, p = r.params;
  const phase = random() * TAU, samples = 1000;
  for (let layer = 0; layer < p['layers']; layer++) {
    const t = layer / Math.max(1, p['layers'] - 1);
    const radius = mix(390 * p['inner'], 390, t) / (1 + p['amplitude']);
    ctx.strokeStyle = color(s, t); ctx.globalAlpha = r.opacity * (.5 + .4 * t);
    ctx.lineWidth = r.strokeWidth * (.7 + t * .4); ctx.beginPath();
    for (let i = 0; i <= samples; i++) {
      const angle = i / samples * TAU;
      const wave = 1 + p['amplitude'] * Math.cos(angle * p['petals'] + t * p['twist'] * TAU + phase);
      const rr = radius * wave;
      const x = 500 + Math.cos(angle + t * p['twist'] * .15) * rr * Math.sqrt(p['eccentricity']);
      const y = 500 + Math.sin(angle + t * p['twist'] * .15) * rr / Math.sqrt(p['eccentricity']);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke(); s.marks++;
  }
}

function branches(s: Studio): void {
  const { ctx, r, random } = s, p = r.params;
  ctx.lineCap = 'round';
  const grow = (x: number, y: number, angle: number, length: number, depth: number, tint: number): void => {
    const bend = (random() - .5) * .2 + p['wind'] * .12;
    const endX = x + Math.cos(angle + bend) * length, endY = y + Math.sin(angle + bend) * length;
    ctx.strokeStyle = color(s, clamp(tint + (1 - depth / p['depth']) * .45));
    ctx.lineWidth = Math.max(.4, depth * depth * .095) * r.strokeWidth;
    ctx.globalAlpha = r.opacity * (.5 + depth / p['depth'] * .45);
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(angle) * length * .55, y + Math.sin(angle) * length * .55, endX, endY); ctx.stroke(); s.marks++;
    if (depth <= 1) {
      if (random() < p['foliage']) {
        ctx.fillStyle = color(s, .3 + random() * .7); ctx.globalAlpha = r.opacity * .48;
        ctx.beginPath(); ctx.ellipse(endX, endY, 3 + random() * 5, 1.5 + random() * 3, angle, 0, TAU); ctx.fill(); s.marks++;
      }
      return;
    }
    const spread = p['spread'] / 180 * Math.PI;
    grow(endX, endY, angle + bend - spread * (.65 + random() * .6), length * p['decay'] * (.85 + random() * .25), depth - 1, tint);
    grow(endX, endY, angle + bend + spread * (.65 + random() * .6), length * p['decay'] * (.85 + random() * .25), depth - 1, tint);
  };
  for (let i = 0; i < p['trees']; i++) {
    const x = p['trees'] === 1 ? 500 : 170 + i / (p['trees'] - 1) * 660;
    const length = (145 + random() * 55) * (p['trees'] > 3 ? .8 : 1);
    grow(x, 890 + (random() - .5) * 60, -Math.PI / 2 + p['wind'] * .15, length, p['depth'], i / p['trees'] * .4);
  }
}

function packing(s: Studio): void {
  const { ctx, r, random } = s, p = r.params;
  const cellSize = p['maximum'] * 2 + p['padding'];
  const buckets = new Map<string, Array<{ x: number; y: number; radius: number }>>();
  const circles: Array<{ x: number; y: number; radius: number }> = [];
  for (let attempt = 0; attempt < p['count'] * 40 && circles.length < p['count']; attempt++) {
    const radius = mix(p['minimum'], p['maximum'], Math.pow(random(), 2.4));
    const x = 60 + radius + random() * (880 - radius * 2), y = 60 + radius + random() * (880 - radius * 2);
    const gx = Math.floor(x / cellSize), gy = Math.floor(y / cellSize);
    let valid = true;
    for (let yy = gy - 1; yy <= gy + 1 && valid; yy++) for (let xx = gx - 1; xx <= gx + 1 && valid; xx++) {
      for (const other of buckets.get(`${xx},${yy}`) ?? []) {
        if (Math.hypot(x - other.x, y - other.y) < radius + other.radius + p['padding']) { valid = false; break; }
      }
    }
    if (!valid) continue;
    const circle = { x, y, radius }, key = `${gx},${gy}`;
    circles.push(circle); const bucket = buckets.get(key) ?? []; bucket.push(circle); buckets.set(key, bucket);
  }
  for (const circle of circles) {
    const { x, y, radius } = circle;
    ctx.strokeStyle = color(s, (x + y) / 2000 * .7 + random() * .3); ctx.fillStyle = ctx.strokeStyle;
    ctx.globalAlpha = r.opacity * (.5 + random() * .5); ctx.lineWidth = r.strokeWidth;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU);
    if (random() < p['fill']) { ctx.globalAlpha *= .7; ctx.fill(); } else ctx.stroke();
    s.marks++;
    for (let ring = 1; ring <= p['rings'] && radius > 10; ring++) {
      ctx.globalAlpha = r.opacity * .45; ctx.lineWidth = r.strokeWidth * .65;
      ctx.beginPath(); ctx.arc(x, y, radius * (1 - ring / (p['rings'] + 1)), 0, TAU); ctx.stroke(); s.marks++;
    }
  }
}

function truchet(s: Studio): void {
  const { ctx, r, random } = s, p = r.params;
  const grid = p['grid'], size = 900 / grid;
  ctx.lineWidth = r.strokeWidth * 1.7; ctx.lineCap = 'round';
  for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) {
    const flip = random() < p['bias'];
    const left = 50 + x * size, top = 50 + y * size;
    ctx.save(); ctx.beginPath(); ctx.rect(left, top, size, size); ctx.clip();
    ctx.strokeStyle = color(s, ((x + y) / (grid * 2) + random() * .25) % 1);
    for (let band = 0; band < p['bands']; band++) {
      const radius = size * clamp(.5 + (band - (p['bands'] - 1) / 2) * p['spacing'], .04, .96);
      ctx.globalAlpha = r.opacity * (.6 + .3 * band / p['bands']); ctx.beginPath();
      if (flip) {
        ctx.arc(left, top, radius, 0, Math.PI / 2);
        ctx.moveTo(left + size - radius, top + size); ctx.arc(left + size, top + size, radius, Math.PI, Math.PI * 1.5);
      } else {
        ctx.arc(left + size, top, radius, Math.PI / 2, Math.PI);
        ctx.moveTo(left, top + size - radius); ctx.arc(left, top + size, radius, -Math.PI / 2, 0);
      }
      ctx.stroke(); s.marks += 2;
    }
    ctx.restore();
  }
}

function constellation(s: Studio): void {
  const { ctx, r, random } = s, p = r.params;
  const centers = Array.from({ length: p['clusters'] }, (_, i) => ({ x: 500 + Math.cos(i / p['clusters'] * TAU) * (p['clusters'] === 1 ? 0 : 255), y: 500 + Math.sin(i / p['clusters'] * TAU) * (p['clusters'] === 1 ? 0 : 245) }));
  const points = Array.from({ length: p['count'] }, () => {
    const cluster = Math.floor(random() * centers.length), center = centers[cluster];
    const angle = random() * TAU, radius = Math.sqrt(-2 * Math.log(Math.max(.001, random()))) * p['spread'];
    return { x: clamp(center.x + Math.cos(angle) * radius, 55, 945), y: clamp(center.y + Math.sin(angle) * radius, 55, 945), cluster };
  });
  ctx.lineWidth = r.strokeWidth * .6;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]; ctx.strokeStyle = color(s, a.cluster / centers.length);
    for (let j = i + 1; j < points.length; j++) {
      const b = points[j], distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance >= p['reach']) continue;
      ctx.globalAlpha = r.opacity * .5 * Math.pow(1 - distance / p['reach'], 1.5);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); s.marks++;
    }
  }
  for (const point of points) {
    ctx.globalAlpha = r.opacity; ctx.fillStyle = color(s, point.cluster / centers.length);
    const radius = p['size'] * (.55 + random()); ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, TAU); ctx.fill(); s.marks++;
    if (random() < .06) {
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = r.strokeWidth * .6;
      ctx.beginPath(); ctx.moveTo(point.x - radius * 3, point.y); ctx.lineTo(point.x + radius * 3, point.y);
      ctx.moveTo(point.x, point.y - radius * 3); ctx.lineTo(point.x, point.y + radius * 3); ctx.stroke();
    }
  }
}

function waves(s: Studio): void {
  const { ctx, r, random, noise } = s, p = r.params, phase = random() * TAU;
  for (let row = 0; row < p['lines']; row++) {
    const t = row / Math.max(1, p['lines'] - 1);
    ctx.strokeStyle = color(s, t); ctx.lineWidth = r.strokeWidth * (.6 + .45 * Math.sin(t * Math.PI));
    ctx.globalAlpha = r.opacity * .85; ctx.beginPath();
    for (let i = 0; i <= 320; i++) {
      const x = 45 + i / 320 * 910;
      const u = i / 320, envelope = Math.pow(Math.sin(u * Math.PI), .8);
      const wave = Math.sin(u * p['frequency'] * TAU + t * p['phase'] * TAU + phase);
      const secondary = Math.sin(u * p['frequency'] * TAU * .5 - t * 4 + phase) * .35;
      const y = 130 + t * 740 + envelope * ((wave + secondary) * p['amplitude'] + (noise(u * 5 + 40, t * 3 + 20) - .5) * p['distortion'] * 2);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke(); s.marks++;
  }
}

function voronoi(sites: Point[]): Point[][] {
  return sites.map((site, index) => {
    let polygon: Point[] = [{ x: 50, y: 50 }, { x: 950, y: 50 }, { x: 950, y: 950 }, { x: 50, y: 950 }];
    for (let j = 0; j < sites.length && polygon.length; j++) {
      if (j === index) continue;
      const other = sites[j], nx = other.x - site.x, ny = other.y - site.y;
      const limit = (other.x * other.x + other.y * other.y - site.x * site.x - site.y * site.y) / 2;
      const clipped: Point[] = [];
      for (let k = 0; k < polygon.length; k++) {
        const a = polygon[k], b = polygon[(k + 1) % polygon.length];
        const da = a.x * nx + a.y * ny - limit, db = b.x * nx + b.y * ny - limit;
        if (da <= 0) clipped.push(a);
        if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); clipped.push({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) }); }
      }
      polygon = clipped;
    }
    return polygon;
  });
}

function polygonCenter(points: Point[]): Point {
  let area = 0, x = 0, y = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], cross = a.x * b.y - b.x * a.y;
    area += cross; x += (a.x + b.x) * cross; y += (a.y + b.y) * cross;
  }
  return Math.abs(area) < .00001 ? points[0] ?? { x: 500, y: 500 } : { x: x / (3 * area), y: y / (3 * area) };
}

function mosaic(s: Studio): void {
  const { ctx, r, random } = s, p = r.params, grid = Math.ceil(Math.sqrt(p['cells']));
  let sites: Point[] = Array.from({ length: p['cells'] }, (_, i) => ({
    x: 50 + ((i % grid) + .5 + (random() - .5) * p['irregularity']) / grid * 900,
    y: 50 + (Math.floor(i / grid) + .5 + (random() - .5) * p['irregularity']) / grid * 900,
  }));
  let polygons = voronoi(sites);
  for (let iteration = 0; iteration < p['relaxation']; iteration++) { sites = polygons.map(polygonCenter); polygons = voronoi(sites); }
  polygons.forEach((polygon, index) => {
    if (!polygon.length) return;
    const center = polygonCenter(polygon);
    const tint = (center.x / 1000 * .45 + center.y / 1000 * .35 + random() * .35) % 1;
    ctx.fillStyle = color(s, tint); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = r.strokeWidth;
    ctx.globalAlpha = r.opacity * (.6 + random() * .35); ctx.beginPath();
    polygon.forEach((point, i) => {
      const length = Math.hypot(point.x - center.x, point.y - center.y), inset = Math.max(0, 1 - p['gap'] / Math.max(1, length));
      const x = mix(center.x, point.x, inset), y = mix(center.y, point.y, inset);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    if (random() < p['fill']) ctx.fill();
    ctx.stroke(); s.marks++;
    if (index % 7 === 0) { ctx.globalAlpha = r.opacity * .25; ctx.beginPath(); ctx.arc(center.x, center.y, 2.5 * r.strokeWidth, 0, TAU); ctx.fill(); }
  });
}

function painter(s: Studio, source?: ImageData): void {
  const { ctx, r, random, noise } = s, p = r.params;
  const colors = s.colors.map(rgb), background = rgb(r.background);
  const synthetic = (x: number, y: number): [number, number, number] => {
    const field = clamp(noise(x / 360 + 10, y / 400 + 20) * .7 + Math.sin(x / 220 + y / 480) * .18 + .15);
    const value = field * (colors.length - 1), index = Math.min(colors.length - 2, Math.floor(value));
    return colors[index].map((channel, k) => Math.round(mix(channel, colors[index + 1][k], value - index))) as [number, number, number];
  };
  for (let i = 0; i < p['marks']; i++) {
    const x = random() * 1000, y = random() * 1000;
    let paint: [number, number, number];
    if (source && source.width > 0 && source.height > 0) {
      // Cover the square without stretching the source image.
      const side = Math.min(source.width, source.height);
      const sx = Math.min(source.width - 1, Math.floor((source.width - side) / 2 + x / 1000 * side));
      const sy = Math.min(source.height - 1, Math.floor((source.height - side) / 2 + y / 1000 * side));
      const index = (sy * source.width + sx) * 4, alpha = source.data[index + 3] / 255;
      paint = [0, 1, 2].map(k => Math.round(mix(background[k], source.data[index + k], alpha))) as [number, number, number];
    } else paint = synthetic(x, y);
    const radius = Math.max(1.7, p['size'] * Math.exp(-p['decay'] * i));
    const cx = x + (random() * 2 - 1) * p['jitter'], cy = y + (random() * 2 - 1) * p['jitter'];
    const angle = random() * TAU;
    ctx.fillStyle = `rgb(${paint[0]},${paint[1]},${paint[2]})`;
    ctx.globalAlpha = r.opacity * clamp(p['initialOpacity'] + i / p['marks'] * p['opacityGrowth']);
    ctx.beginPath();
    for (let edge = 0; edge < p['sides']; edge++) {
      const a = angle + edge / p['sides'] * TAU, px = cx + Math.cos(a) * radius, py = cy + Math.sin(a) * radius;
      if (edge === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    if (radius < p['size'] * p['outlineThreshold'] && p['detail'] > 0) {
      const luminance = paint[0] * .21 + paint[1] * .72 + paint[2] * .07;
      ctx.strokeStyle = luminance > 128 ? '#192222' : '#f4f0e5';
      ctx.globalAlpha *= p['detail'] * .45; ctx.lineWidth = r.strokeWidth * .5; ctx.stroke();
    }
    s.marks++;
  }
}

/** Render using a fixed virtual square: export resolution never changes composition. */
export function renderArt(ctx: Context, width: number, height: number, recipe: Recipe, source?: ImageData): RenderStats {
  const started = performance.now();
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('Canvas dimensions must be positive.');
  const r = normalizeRecipe(recipe);
  const palette = PALETTES.find(palette => palette.id === r.palette)!;
  ctx.save();
  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = r.background; ctx.fillRect(0, 0, width, height);
    const scale = Math.max(width, height) / 1000;
    ctx.setTransform(scale, 0, 0, scale, width / 2, height / 2);
    ctx.rotate(r.rotation / 180 * Math.PI); ctx.scale(r.zoom, r.zoom); ctx.translate(-500, -500);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = r.strokeWidth; ctx.globalAlpha = r.opacity;
    const studio: Studio = { ctx, r, random: seededRandom(r.seed), noise: noiseFactory(r.seed), colors: palette.colors, marks: 0 };
    switch (r.algorithm) {
      case 'flow': flow(studio); break;
      case 'contours': contours(studio); break;
      case 'orbits': orbits(studio); break;
      case 'branches': branches(studio); break;
      case 'packing': packing(studio); break;
      case 'truchet': truchet(studio); break;
      case 'constellation': constellation(studio); break;
      case 'waves': waves(studio); break;
      case 'mosaic': mosaic(studio); break;
      case 'painter': painter(studio, source); break;
    }
    if (r.grain > 0) {
      // Texture uses its own stream so texture changes never perturb the artwork.
      const grainRandom = seededRandom(r.seed ^ 0x7f4a7c15);
      ctx.setTransform(scale, 0, 0, scale, (width - 1000 * scale) / 2, (height - 1000 * scale) / 2);
      const count = Math.round(r.grain * 18000);
      for (let i = 0; i < count; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#000000' : '#ffffff'; ctx.globalAlpha = .025 + grainRandom() * .04;
        const size = .3 + grainRandom() * 1.3; ctx.fillRect(grainRandom() * 1000, grainRandom() * 1000, size, size);
      }
    }
    return { marks: studio.marks, elapsed: performance.now() - started };
  } finally { ctx.restore(); }
}
