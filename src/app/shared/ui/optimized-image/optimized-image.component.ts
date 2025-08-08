import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageLazyLoadDirective } from '../../directives/image-lazy-load.directive';

@Component({
  selector: 'app-optimized-image',
  standalone: true,
  imports: [CommonModule, ImageLazyLoadDirective],
  template: `
    <picture class="optimized-image" [class.rounded]="rounded">
      @if (webpSrc) {
        <source type="image/webp" [srcset]="generateSrcSet(webpSrc, 'webp')" />
      }
      @if (src) {
        <source [type]="getImageType(src)" [srcset]="generateSrcSet(src)" />
      }
      <img
        [appLazyLoad]="src"
        [alt]="alt"
        [width]="width"
        [height]="height"
        [class]="imgClass"
        loading="lazy"
        decoding="async"
      />
    </picture>
  `,
  styles: [
    `
      .optimized-image {
        display: block;
        width: 100%;
        height: auto;
      }

      .optimized-image.rounded img {
        border-radius: 8px;
      }

      img {
        display: block;
        width: 100%;
        height: auto;
        transition: opacity 0.3s ease;
      }

      img:not(.loaded) {
        opacity: 0.5;
        filter: blur(5px);
      }

      img.loaded {
        opacity: 1;
        filter: none;
      }

      img.error {
        opacity: 0.3;
      }
    `,
  ],
})
export class OptimizedImageComponent {
  @Input({ required: true }) src!: string;
  @Input() webpSrc?: string;
  @Input({ required: true }) alt!: string;
  @Input() width?: number;
  @Input() height?: number;
  @Input() sizes = '100vw';
  @Input() imgClass = '';
  @Input() rounded = false;

  generateSrcSet(baseSrc: string, format?: string): string {
    const widths = [320, 640, 768, 1024, 1280, 1536];
    const ext = format || this.getExtension(baseSrc);
    const name = baseSrc.substring(0, baseSrc.lastIndexOf('.'));

    return widths.map((w) => `${name}-${w}w.${ext} ${w}w`).join(', ');
  }

  getImageType(src: string): string {
    const ext = this.getExtension(src);
    const typeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      webp: 'image/webp',
      avif: 'image/avif',
    };
    return typeMap[ext] || 'image/jpeg';
  }

  private getExtension(src: string): string {
    return src.split('.').pop()?.toLowerCase() || 'jpg';
  }
}
