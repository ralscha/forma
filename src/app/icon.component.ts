import { Component, input } from '@angular/core';

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="paths[name()] || paths['spark']" /></svg>`,
  styles: [':host { display:inline-flex; width:18px; height:18px; flex-shrink:0 } svg { width:100%; height:100% }']
})
export class IconComponent {
  name = input('spark');
  paths: Record<string, string> = {
    spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
    shuffle: 'M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c1.5 0 3-1.5 4-3m4-6c1-1.5 2.5-3 4-3h3m-4-4 4 4-4 4',
    download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
    bookmark: 'M6 3h12v18l-6-4-6 4V3Z',
    undo: 'm8 3-5 5 5 5M3 8h10a7 7 0 0 1 0 14',
    redo: 'm16 3 5 5-5 5m5-5H11a7 7 0 0 0 0 14',
    reset: 'M3 10a9 9 0 1 1 2 8M3 4v6h6',
    arrow: 'M5 12h14m-5-5 5 5-5 5',
    chevron: 'm8 4 8 8-8 8',
    close: 'm6 6 12 12M6 18 18 6',
    plus: 'M12 5v14M5 12h14',
    check: 'm5 12 4 4L19 6',
    upload: 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',
    image: 'M3 3h18v18H3V3Zm0 13 6-6 5 5 3-3 4 4M15 7h.01',
    trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
    info: 'M12 16v-5m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    grid: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
    fullscreen: 'M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6',
    play: 'm7 4 14 8-14 8V4Z',
    pause: 'M8 4v16m8-16v16',
    link: 'm10 14 4-4m-5-3 3-3a5 5 0 0 1 7 7l-3 3m-1 3-3 3a5 5 0 0 1-7-7l3-3',
    search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Zm5.5-2 5 5',
    sliders: 'M5 3v5m0 4v9M12 3v10m0 4v4M19 3v2m0 4v12M2 8h6m1 9h6m1-12h6'
  };
}
