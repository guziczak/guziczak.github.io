import {
  Directive,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  OnInit,
  OnDestroy,
  inject,
  Renderer2,
  OnChanges,
  SimpleChanges,
} from '@angular/core';

@Directive({
  selector: '[appVirtualScroll]',
  standalone: true,
})
export class VirtualScrollDirective implements OnInit, OnDestroy, OnChanges {
  @Input() itemHeight = 50;
  @Input() items: any[] = [];
  @Input() bufferSize = 5;
  @Input() containerHeight = 600;
  @Output() visibleItemsChange = new EventEmitter<any[]>();

  private el = inject(ElementRef);
  private renderer = inject(Renderer2);
  private scrollContainer!: HTMLElement;
  private scrollListener?: () => void;
  private observer?: IntersectionObserver;
  private visibleRange = { start: 0, end: 0 };
  private spacer?: HTMLElement;

  ngOnInit() {
    this.scrollContainer = this.el.nativeElement;
    this.setupVirtualScroll();
    this.setupIntersectionObserver();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['items'] && this.spacer) {
      this.updateSpacerHeight();
      this.updateVisibleRange();
    }
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.scrollListener) {
      this.scrollContainer.removeEventListener('scroll', this.scrollListener);
    }
  }

  private setupVirtualScroll() {
    // Set container styles
    this.renderer.setStyle(
      this.scrollContainer,
      'height',
      `${this.containerHeight}px`,
    );
    this.renderer.setStyle(this.scrollContainer, 'overflow-y', 'auto');
    this.renderer.setStyle(this.scrollContainer, 'position', 'relative');

    // Create spacer element
    this.spacer = this.renderer.createElement('div');
    this.updateSpacerHeight();
    this.renderer.setStyle(this.spacer, 'position', 'absolute');
    this.renderer.setStyle(this.spacer, 'width', '1px');
    this.renderer.setStyle(this.spacer, 'opacity', '0');
    this.renderer.setStyle(this.spacer, 'pointer-events', 'none');
    this.renderer.appendChild(this.scrollContainer, this.spacer);

    // Add scroll listener
    this.scrollListener = () => this.updateVisibleRange();
    this.scrollContainer.addEventListener('scroll', this.scrollListener, {
      passive: true,
    });

    this.updateVisibleRange();
  }

  private updateSpacerHeight() {
    if (this.spacer) {
      const totalHeight = this.items.length * this.itemHeight;
      this.renderer.setStyle(this.spacer, 'height', `${totalHeight}px`);
    }
  }

  private updateVisibleRange() {
    const scrollTop = this.scrollContainer.scrollTop;
    const containerHeight =
      this.containerHeight || this.scrollContainer.clientHeight;

    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / this.itemHeight) - this.bufferSize,
    );
    const endIndex = Math.min(
      this.items.length,
      Math.ceil((scrollTop + containerHeight) / this.itemHeight) +
        this.bufferSize,
    );

    if (
      startIndex !== this.visibleRange.start ||
      endIndex !== this.visibleRange.end
    ) {
      this.visibleRange = { start: startIndex, end: endIndex };
      const visibleItems = this.items
        .slice(startIndex, endIndex)
        .map((item, index) => ({
          item,
          index: startIndex + index,
          style: {
            position: 'absolute',
            top: `${(startIndex + index) * this.itemHeight}px`,
            height: `${this.itemHeight}px`,
            left: '0',
            right: '0',
          },
        }));
      this.visibleItemsChange.emit(visibleItems);
    }
  }

  private setupIntersectionObserver() {
    const options = {
      root: this.scrollContainer,
      rootMargin: '100px',
      threshold: 0,
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Load images or heavy content when visible
          const element = entry.target as HTMLElement;
          const lazyLoad = element.getAttribute('data-lazy-src');
          if (lazyLoad && element instanceof HTMLImageElement) {
            element.src = lazyLoad;
            element.removeAttribute('data-lazy-src');
          }
        }
      });
    }, options);

    // Observe all items with lazy loading
    const lazyElements =
      this.scrollContainer.querySelectorAll('[data-lazy-src]');
    lazyElements.forEach((el) => this.observer?.observe(el));
  }
}
