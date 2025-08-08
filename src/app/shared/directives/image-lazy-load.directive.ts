import {
  Directive,
  ElementRef,
  Input,
  OnInit,
  inject,
  OnDestroy,
} from '@angular/core';

@Directive({
  selector: 'img[appLazyLoad]',
  standalone: true,
})
export class ImageLazyLoadDirective implements OnInit, OnDestroy {
  @Input() appLazyLoad?: string;
  @Input() placeholder =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3C/svg%3E';

  private el = inject(ElementRef);
  private observer?: IntersectionObserver;

  ngOnInit() {
    const img = this.el.nativeElement as HTMLImageElement;

    // Set placeholder
    img.src = this.placeholder;

    // Check if IntersectionObserver is supported
    if ('IntersectionObserver' in window) {
      this.createObserver();
    } else {
      // Fallback: load image immediately
      this.loadImage();
    }
  }

  private createObserver() {
    const options = {
      rootMargin: '50px',
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.loadImage();
          this.observer?.disconnect();
        }
      });
    }, options);

    this.observer.observe(this.el.nativeElement);
  }

  private loadImage() {
    const img = this.el.nativeElement as HTMLImageElement;
    const src = this.appLazyLoad || img.dataset['src'];

    if (src) {
      // Create a new image to preload
      const newImg = new Image();

      newImg.onload = () => {
        img.src = src;
        img.classList.add('loaded');
      };

      newImg.onerror = () => {
        img.classList.add('error');
      };

      newImg.src = src;
    }
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
