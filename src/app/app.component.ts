import { Component, ElementRef, HostListener, ViewChild, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';
import { ArtPreviewComponent } from './art-preview.component';
import { ALGORITHMS, PALETTES, AlgorithmId, Recipe, RenderStats, defaultRecipe, normalizeRecipe } from './art/model';
import { renderArt } from './art/engine';

interface Study { id: string; name: string; created: number; recipe: Recipe; aspect: number; thumbnail: string; source?: string }
interface Frame { image: ImageBitmap | HTMLCanvasElement; stats: RenderStats }
type NumericKey = 'seed' | 'strokeWidth' | 'opacity' | 'rotation' | 'zoom' | 'grain';

@Component({
  selector: 'app-root', standalone: true,
  imports: [CommonModule, IconComponent, ArtPreviewComponent],
  templateUrl: './app.component.html'
})
export class AppComponent {
  readonly algorithms = ALGORITHMS;
  readonly palettes = PALETTES;
  readonly recipe = signal<Recipe>(defaultRecipe('flow'));
  readonly algorithm = computed(() => ALGORITHMS.find(a => a.id === this.recipe().algorithm)!);
  readonly paletteName = computed(() => PALETTES.find(p => p.id === this.recipe().palette)?.name || 'Custom');
  readonly search = signal('');
  readonly filteredAlgorithms = computed(() => ALGORITHMS.filter(a => `${a.name} ${a.category}`.toLowerCase().includes(this.search().toLowerCase())));
  readonly tab = signal<'explore' | 'saved'>('explore');
  readonly focus = signal(false);
  readonly busy = signal(true);
  readonly exporting = signal(false);
  readonly renderError = signal('');
  readonly renderTime = signal(0);
  readonly renderId = signal(0);
  readonly previewWidth = signal(1000);
  readonly previewHeight = signal(1000);
  readonly toast = signal('');
  readonly toastError = signal(false);
  readonly showAbout = signal(false);
  readonly saved = signal<Study[]>([]);
  readonly sourceName = signal('');
  readonly aspect = signal(1);
  readonly exportSize = signal(2048);
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);
  readonly variations = signal<Recipe[]>([]);
  readonly ratios = [{ label: '1:1', value: 1 }, { label: '4:3', value: 4 / 3 }, { label: '3:4', value: 3 / 4 }];
  readonly styleControls: { key: NumericKey; label: string; min: number; max: number; step: number; suffix: string }[] = [
    { key: 'strokeWidth', label: 'Line weight', min: 0.2, max: 8, step: 0.1, suffix: '' },
    { key: 'opacity', label: 'Ink opacity', min: 0.05, max: 1, step: 0.01, suffix: '' },
    { key: 'grain', label: 'Paper grain', min: 0, max: 1, step: 0.01, suffix: '' },
    { key: 'rotation', label: 'Rotation', min: -180, max: 180, step: 1, suffix: '°' },
    { key: 'zoom', label: 'Scale', min: 0.4, max: 2.5, step: 0.05, suffix: '×' }
  ];
  readonly thumbnails: Record<string, Recipe> = Object.fromEntries(ALGORITHMS.map((a, i) => {
    const r = defaultRecipe(a.id);
    const p = PALETTES[i % PALETTES.length];
    return [a.id, { ...r, palette: p.id, background: p.background }];
  }));
  sourceUrl = '';
  private sourceData?: ImageData;
  private canvas?: HTMLCanvasElement;
  private history: Recipe[] = [];
  private future: Recipe[] = [];
  private renderTimer?: ReturnType<typeof setTimeout>;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private cancelPreview?: () => void;
  private jobId = 0;
  private initialized = false;
  private modalReturnFocus?: HTMLElement;
  private fullscreenReturnFocus?: HTMLElement;
  private previousBodyOverflow = '';
  private nativeFullscreenActive = false;
  private fullscreenRequest = 0;
  private restoreSource: Promise<void> = Promise.resolve();

  @ViewChild('artWorkspace') private workspaceRef?: ElementRef<HTMLElement>;

  @ViewChild('artCanvas') set canvasRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.canvas = ref?.nativeElement;
    if (this.canvas && this.initialized) queueMicrotask(() => this.scheduleRender());
  }

  constructor() {
    const sharedLink = location.hash.startsWith('#study=');
    try {
      const stored = JSON.parse(localStorage.getItem('forma.current.v1') || 'null');
      if (stored) {
        this.recipe.set(normalizeRecipe(stored.recipe));
        this.aspect.set(this.validAspect(stored.aspect));
        if (!sharedLink && this.isSourceUrl(stored.source)) this.restoreSource = this.loadSource(stored.source).catch(() => this.notify('The saved source image could not be restored.', true));
      }
      const collection: unknown = JSON.parse(localStorage.getItem('forma.studies.v1') || '[]');
      if (Array.isArray(collection)) {
        const studies: Study[] = [];
        for (const entry of collection.slice(0, 24)) {
          try {
            if (!entry || typeof entry.id !== 'string' || typeof entry.name !== 'string' || !this.isSourceUrl(entry.thumbnail)) continue;
            studies.push({ ...entry, recipe: normalizeRecipe(entry.recipe), aspect: this.validAspect(entry.aspect), source: this.isSourceUrl(entry.source) ? entry.source : undefined });
          } catch { /* An invalid saved study does not prevent loading the others. */ }
        }
        this.saved.set(studies);
      }
    } catch { /* Private browsing or invalid local data: start a fresh studio. */ }
    if (sharedLink) {
      try {
        const payload = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(7)))));
        this.recipe.set(normalizeRecipe(payload));
        this.aspect.set(this.validAspect(payload.aspect));
      } catch { this.recipe.set(defaultRecipe('flow')); this.aspect.set(1); this.notify('This study link is invalid. Starting a fresh study.', true); }
    }
    this.refreshVariations();
    this.initialized = true;
  }

  globalValue(key: NumericKey): number { return this.recipe()[key]; }
  rangePercent(value: number, min: number, max: number): string { return `${100 * (value - min) / (max - min)}%`; }
  formatValue(value: number, step: number): string { return step >= 1 ? Math.round(value).toLocaleString('en-US') : value.toFixed(Math.min(5, (step.toString().split('.')[1] || '').length)); }
  private validAspect(value: unknown): number { return this.ratios.some(r => r.value === value) ? Number(value) : 1; }
  private clone(r: Recipe): Recipe { return { ...r, params: { ...r.params } }; }
  private seed(): number { return crypto.getRandomValues(new Uint32Array(1))[0]; }

  applyRecipe(next: Recipe, record = true) {
    const normalized = normalizeRecipe(next);
    if (record) { this.history.push(this.clone(this.recipe())); this.history = this.history.slice(-80); this.future = []; }
    this.recipe.set(normalized);
    this.updateHistory();
    this.scheduleRender();
  }
  selectAlgorithm(id: AlgorithmId) {
    if (this.recipe().algorithm === id) return;
    this.applyRecipe({ ...defaultRecipe(id), seed: this.recipe().seed });
    this.refreshVariations();
  }
  setParam(key: string, value: number) { this.applyRecipe({ ...this.recipe(), params: { ...this.recipe().params, [key]: value } }); }
  setGlobal(key: NumericKey, value: number) { if (Number.isFinite(value)) this.applyRecipe({ ...this.recipe(), [key]: value }); }
  setBackground(background: string) { this.applyRecipe({ ...this.recipe(), background }); }
  setPalette(id: string) { const p = PALETTES.find(p => p.id === id)!; this.applyRecipe({ ...this.recipe(), palette: id, background: p.background }); }
  setAspect(aspect: number) { this.aspect.set(this.validAspect(aspect)); this.scheduleRender(); }
  newSeed() { this.applyRecipe({ ...this.recipe(), seed: this.seed() }); }
  randomize() {
    const params: Record<string, number> = {};
    for (const p of this.algorithm().params) {
      const value = p.min + (this.seed() / 4294967296) * (p.max - p.min);
      params[p.key] = Math.round(value / p.step) * p.step;
    }
    const palette = PALETTES[this.seed() % PALETTES.length];
    this.applyRecipe({ ...this.recipe(), params, palette: palette.id, background: palette.background });
  }
  reset() { this.applyRecipe({ ...defaultRecipe(this.recipe().algorithm), seed: this.recipe().seed }); this.refreshVariations(); }
  undo() { const r = this.history.pop(); if (r) { this.future.push(this.clone(this.recipe())); this.applyRecipe(r, false); } }
  redo() { const r = this.future.pop(); if (r) { this.history.push(this.clone(this.recipe())); this.applyRecipe(r, false); } }
  private updateHistory() { this.canUndo.set(this.history.length > 0); this.canRedo.set(this.future.length > 0); }
  refreshVariations() {
    this.variations.set([0, 1, 2].map((i) => {
      const base = defaultRecipe(this.recipe().algorithm);
      const palette = PALETTES[(i * 2 + 1) % PALETTES.length];
      return { ...base, seed: this.seed(), palette: palette.id, background: palette.background, rotation: [0, 25, -40][i], strokeWidth: [0.6, 1.4, 2][i] };
    }));
  }

  scheduleRender() {
    clearTimeout(this.renderTimer);
    this.cancelPreview?.();
    this.cancelPreview = undefined;
    const id = ++this.jobId;
    this.busy.set(true);
    this.renderError.set('');
    this.renderTimer = setTimeout(() => void this.renderPreview(id), 90);
  }
  private dimensions(longest: number): [number, number] {
    return this.aspect() >= 1 ? [longest, Math.round(longest / this.aspect())] : [Math.round(longest * this.aspect()), longest];
  }
  private async renderPreview(id: number) {
    await this.restoreSource;
    if (!this.canvas || id !== this.jobId) return;
    const [width, height] = this.dimensions(1000);
    const started = performance.now();
    try {
      const frame = await this.renderFrame(width, height, this.clone(this.recipe()), true);
      if (id !== this.jobId || !this.canvas) { if (typeof ImageBitmap !== 'undefined' && frame.image instanceof ImageBitmap) frame.image.close(); return; }
      this.canvas.width = width;
      this.canvas.height = height;
      // Keep saved/exported pixels stable instead of switching raster backends after readback.
      this.canvas.getContext('2d', { willReadFrequently: true })!.drawImage(frame.image, 0, 0);
      if (typeof ImageBitmap !== 'undefined' && frame.image instanceof ImageBitmap) frame.image.close();
      this.previewWidth.set(width); this.previewHeight.set(height);
      this.renderTime.set(Math.round(performance.now() - started));
      this.renderId.update(v => v + 1);
      this.busy.set(false);
      this.persistCurrent();
    } catch (error) {
      if (id !== this.jobId || (error instanceof Error && error.name === 'AbortError')) return;
      this.busy.set(false); this.renderError.set('This study could not render. Try resetting its settings.');
    }
  }
  private renderFrame(width: number, height: number, recipe: Recipe, preview = false): Promise<Frame> {
    const source = this.sourceData;
    return new Promise((resolve, reject) => {
      const fallback = () => {
        try {
          const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) throw new Error('Canvas is unavailable');
          resolve({ image: canvas, stats: renderArt(ctx, width, height, recipe, source) });
        } catch (e) { reject(e); }
      };
      if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') { setTimeout(fallback, 0); return; }
      let worker: Worker;
      try { worker = new Worker(new URL('./art/render.worker', import.meta.url), { type: 'module' }); } catch { setTimeout(fallback, 0); return; }
      const timeout = setTimeout(() => { worker.terminate(); reject(new Error('Render timed out')); }, 45000);
      const finish = () => { clearTimeout(timeout); worker.terminate(); if (preview) this.cancelPreview = undefined; };
      if (preview) this.cancelPreview = () => { finish(); reject(new DOMException('Superseded', 'AbortError')); };
      worker.onmessage = ({ data }) => {
        finish();
        if (data.error) reject(new Error(data.error)); else resolve({ image: data.bitmap, stats: data.stats });
      };
      worker.onerror = (event) => { event.preventDefault(); finish(); setTimeout(fallback, 0); };
      worker.postMessage({ id: 1, width, height, recipe, source });
    });
  }
  private persistCurrent() {
    try { localStorage.setItem('forma.current.v1', JSON.stringify({ recipe: this.recipe(), aspect: this.aspect(), source: this.sourceUrl || undefined })); }
    catch { /* Saving a named study has an explicit storage error; autosave remains best effort. */ }
  }

  saveStudy() {
    if (!this.canvas || this.busy()) return;
    if (this.saved().length >= 24) { this.notify('Your collection is full. Export a recipe or remove a study to make room.', true); return; }
    const preview = document.createElement('canvas'); preview.width = 360; preview.height = Math.round(360 / this.aspect());
    preview.getContext('2d', { willReadFrequently: true })!.drawImage(this.canvas, 0, 0, preview.width, preview.height);
    const study: Study = { id: crypto.randomUUID?.() || `${Date.now()}-${this.seed()}`, name: `${this.algorithm().name} ${this.saved().length + 1}`, created: Date.now(), recipe: this.clone(this.recipe()), aspect: this.aspect(), thumbnail: preview.toDataURL('image/jpeg', 0.85), source: this.recipe().algorithm === 'painter' ? this.sourceUrl || undefined : undefined };
    const next = [study, ...this.saved()];
    try { localStorage.setItem('forma.studies.v1', JSON.stringify(next)); this.saved.set(next); this.notify('Study saved.'); }
    catch { this.notify('Browser storage is full or unavailable. Export your recipe to keep this study.', true); }
  }
  async restoreStudy(study: Study) {
    try {
      if (study.source) await this.loadSource(study.source); else this.clearSource(false);
      this.aspect.set(study.aspect); this.applyRecipe(study.recipe); this.tab.set('explore'); this.refreshVariations();
    } catch { this.notify('This study’s source image could not be restored.', true); }
  }
  deleteStudy(id: string) {
    const next = this.saved().filter(s => s.id !== id);
    try { localStorage.setItem('forma.studies.v1', JSON.stringify(next)); this.saved.set(next); this.notify('Study removed.'); }
    catch { this.notify('Could not update browser storage.', true); }
  }

  async exportPng() {
    if (this.exporting()) return;
    this.exporting.set(true);
    const recipe = this.clone(this.recipe());
    const [width, height] = this.dimensions(this.exportSize());
    try {
      await this.restoreSource;
      const frame = await this.renderFrame(width, height, recipe);
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      canvas.getContext('2d', { willReadFrequently: true })!.drawImage(frame.image, 0, 0);
      if (typeof ImageBitmap !== 'undefined' && frame.image instanceof ImageBitmap) frame.image.close();
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG encoding failed')), 'image/png'));
      this.download(blob, `forma-${recipe.algorithm}-${recipe.seed}-${width}x${height}.png`);
      this.notify(`PNG exported at ${width} × ${height}.`);
    } catch { this.notify('Export failed. Try a smaller export size.', true); }
    finally { this.exporting.set(false); }
  }
  exportRecipe() {
    this.download(new Blob([JSON.stringify({ ...this.recipe(), aspect: this.aspect(), sourceImage: this.recipe().algorithm === 'painter' ? this.sourceUrl || undefined : undefined }, null, 2)], { type: 'application/json' }), `forma-${this.recipe().algorithm}-${this.recipe().seed}.json`);
    this.notify('Recipe exported.');
  }
  async importRecipe(event: Event) {
    const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
    if (!file) return;
    try {
      if (file.size > 8_000_000) throw new Error('Recipe too large');
      const data = JSON.parse(await file.text());
      const next = normalizeRecipe(data);
      if (data.sourceImage) { if (!this.isSourceUrl(data.sourceImage)) throw new Error('Invalid image'); await this.loadSource(data.sourceImage); }
      else this.clearSource(false);
      this.aspect.set(this.validAspect(data.aspect)); this.applyRecipe(next); this.refreshVariations(); this.notify('Recipe imported.');
    } catch { this.notify('Invalid recipe. Choose a Forma JSON recipe with valid settings.', true); }
  }
  async copyLink() {
    if (this.sourceUrl && this.recipe().algorithm === 'painter') { this.notify('Export a recipe to share this study with its source image.', true); return; }
    const value = btoa(unescape(encodeURIComponent(JSON.stringify({ ...this.recipe(), aspect: this.aspect() }))));
    try { await navigator.clipboard.writeText(`${location.origin}${location.pathname}#study=${value}`); this.notify('Study link copied.'); }
    catch { this.notify('Clipboard unavailable. Export a recipe to share this study.', true); }
  }
  private download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async uploadImage(event: Event) {
    const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 20_000_000) { this.notify('Choose a PNG, JPEG, or WebP image under 20 MB.', true); return; }
    const url = URL.createObjectURL(file);
    try { await this.loadSource(url); this.sourceName.set(file.name); this.scheduleRender(); this.notify('Source image loaded.'); }
    catch { this.notify('This image could not be opened. Try a PNG or JPEG.', true); }
    finally { URL.revokeObjectURL(url); }
  }
  private isSourceUrl(value: unknown): value is string { return typeof value === 'string' && value.length < 8_000_000 && /^data:image\/(png|jpeg|webp);base64,/.test(value); }
  private async loadSource(url: string) {
    const img = new Image(); img.src = url; await img.decode();
    const scale = Math.min(1, 768 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.sourceData = data; this.sourceUrl = canvas.toDataURL('image/png'); this.sourceName.set('Source image loaded');
  }
  clearSource(render = true) { this.sourceData = undefined; this.sourceUrl = ''; this.sourceName.set(''); if (render) this.scheduleRender(); }
  private notify(message: string, error = false) { clearTimeout(this.toastTimer); this.toastError.set(error); this.toast.set(message); this.toastTimer = setTimeout(() => this.toast.set(''), 6500); }

  openAbout() {
    this.modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.showAbout.set(true);
    setTimeout(() => document.querySelector<HTMLButtonElement>('.modal-close')?.focus(), 0);
  }
  closeAbout() { this.showAbout.set(false); this.modalReturnFocus?.focus(); }

  async toggleFullscreen() {
    if (this.focus()) { await this.exitFullscreen(); return; }
    const workspace = this.workspaceRef?.nativeElement;
    if (!workspace) return;

    const request = ++this.fullscreenRequest;
    this.fullscreenReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.focus.set(true);
    try {
      // Keep the viewport layout as a fallback when browser fullscreen is unavailable.
      if (workspace.requestFullscreen) {
        await workspace.requestFullscreen();
        if (request !== this.fullscreenRequest && document.fullscreenElement === workspace) await document.exitFullscreen();
      }
    } catch { /* Embedded browsers can disallow fullscreen; the expanded view still works. */ }
  }

  private async exitFullscreen() {
    ++this.fullscreenRequest;
    if (document.fullscreenElement === this.workspaceRef?.nativeElement) {
      try { await document.exitFullscreen(); }
      catch { return; } // Keep the exit control available until the browser exits.
    }
    this.restoreEditorLayout();
  }

  private restoreEditorLayout() {
    this.nativeFullscreenActive = false;
    if (!this.focus()) return;
    this.focus.set(false);
    document.body.style.overflow = this.previousBodyOverflow;
    this.fullscreenReturnFocus?.focus({ preventScroll: true });
  }

  @HostListener('document:fullscreenchange') onFullscreenChange() {
    if (document.fullscreenElement === this.workspaceRef?.nativeElement) {
      this.nativeFullscreenActive = true;
    } else if (this.nativeFullscreenActive) {
      ++this.fullscreenRequest;
      this.restoreEditorLayout();
    }
  }

  @HostListener('window:keydown', ['$event']) onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (this.showAbout()) this.closeAbout();
      if (this.focus()) void this.exitFullscreen();
      return;
    }
    if (this.showAbout() && event.key === 'Tab') {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.about-modal button'));
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      return;
    }
    if (this.showAbout() || (event.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName))) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) this.redo(); else this.undo(); }
    else if (!event.ctrlKey && !event.metaKey && !event.altKey && this.tab() === 'explore') {
      if (event.key.toLowerCase() === 'n') this.newSeed();
      if (event.key.toLowerCase() === 's') { event.preventDefault(); this.saveStudy(); }
    }
  }
}
