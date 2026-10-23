import { AfterViewInit, Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';
import { Recipe } from './art/model';
import { renderArt } from './art/engine';

@Component({
  selector: 'app-art-preview', standalone: true,
  template: '<canvas #canvas width="240" height="180" aria-hidden="true"></canvas>',
  styles: [':host {display:block;overflow:hidden;background:#e9e9df} canvas {display:block;width:100%;height:100%;object-fit:cover}']
})
export class ArtPreviewComponent implements AfterViewInit, OnChanges {
  @Input({ required: true }) recipe!: Recipe;
  @ViewChild('canvas') canvas?: ElementRef<HTMLCanvasElement>;
  ngAfterViewInit() { this.draw(); }
  ngOnChanges() { this.draw(); }
  private draw() {
    const canvas = this.canvas?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (ctx) renderArt(ctx, 240, 180, { ...this.recipe, grain: 0 });
  }
}
