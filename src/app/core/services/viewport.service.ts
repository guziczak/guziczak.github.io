import { Injectable, signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { fromEvent, merge, debounceTime, startWith, map, shareReplay } from 'rxjs';
import { DOCUMENT } from '@angular/common';

export interface ViewportSize {
  width: number;
  height: number;
}

export interface Breakpoints {
  xs: boolean;  // < 576px
  sm: boolean;  // >= 576px
  md: boolean;  // >= 768px
  lg: boolean;  // >= 1024px
  xl: boolean;  // >= 1280px
  xxl: boolean; // >= 1536px
}

@Injectable({
  providedIn: 'root',
})
export class ViewportService {
  private document = inject(DOCUMENT);
  
  private readonly viewportSize$ = merge(
    fromEvent(window, 'resize'),
    fromEvent(window, 'orientationchange')
  ).pipe(
    startWith(null),
    debounceTime(150),
    map(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    })),
    shareReplay(1)
  );

  readonly viewport = toSignal(this.viewportSize$, {
    initialValue: {
      width: typeof window !== 'undefined' ? window.innerWidth : 1024,
      height: typeof window !== 'undefined' ? window.innerHeight : 768,
    }
  });

  readonly breakpoints = computed<Breakpoints>(() => {
    const { width } = this.viewport();
    return {
      xs: width < 576,
      sm: width >= 576,
      md: width >= 768,
      lg: width >= 1024,
      xl: width >= 1280,
      xxl: width >= 1536,
    };
  });

  readonly isMobile = computed(() => this.viewport().width < 768);
  readonly isTablet = computed(() => {
    const width = this.viewport().width;
    return width >= 768 && width < 1024;
  });
  readonly isDesktop = computed(() => this.viewport().width >= 1024);

  readonly orientation = computed(() => {
    const { width, height } = this.viewport();
    return width > height ? 'landscape' : 'portrait';
  });

  readonly aspectRatio = computed(() => {
    const { width, height } = this.viewport();
    return width / height;
  });

  readonly devicePixelRatio = signal(
    typeof window !== 'undefined' ? window.devicePixelRatio : 1
  );

  readonly isHighDensity = computed(() => this.devicePixelRatio() > 1);

  readonly zoomLevel = computed(() => {
    const { width } = this.viewport();
    const screenWidth = typeof window !== 'undefined' ? window.screen.width : width;
    return Math.round((width / screenWidth) * 100);
  });

  readonly scrollPosition = toSignal(
    fromEvent(this.document, 'scroll').pipe(
      startWith(null),
      debounceTime(50),
      map(() => ({
        x: window.scrollX,
        y: window.scrollY,
      })),
      shareReplay(1)
    ),
    { initialValue: { x: 0, y: 0 } }
  );

  readonly isScrolled = computed(() => this.scrollPosition().y > 50);

  readonly scrollProgress = computed(() => {
    const scrollY = this.scrollPosition().y;
    const documentHeight = this.document.documentElement?.scrollHeight ?? 0;
    const viewportHeight = this.viewport().height;
    const maxScroll = documentHeight - viewportHeight;
    
    if (maxScroll <= 0) return 0;
    return Math.min(100, (scrollY / maxScroll) * 100);
  });

  isInViewport(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    const { width, height } = this.viewport();
    
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= height &&
      rect.right <= width
    );
  }

  isPartiallyInViewport(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    const { width, height } = this.viewport();
    
    return (
      rect.top < height &&
      rect.bottom > 0 &&
      rect.left < width &&
      rect.right > 0
    );
  }

  getVisiblePercentage(element: Element): number {
    const rect = element.getBoundingClientRect();
    const { width, height } = this.viewport();
    
    const visibleWidth = Math.min(rect.right, width) - Math.max(rect.left, 0);
    const visibleHeight = Math.min(rect.bottom, height) - Math.max(rect.top, 0);
    
    if (visibleWidth <= 0 || visibleHeight <= 0) return 0;
    
    const elementArea = rect.width * rect.height;
    const visibleArea = visibleWidth * visibleHeight;
    
    return (visibleArea / elementArea) * 100;
  }

  matchesBreakpoint(breakpoint: keyof Breakpoints): boolean {
    return this.breakpoints()[breakpoint];
  }

  matchesMediaQuery(query: string): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  }

  observeElement(
    element: Element,
    callback: (entry: IntersectionObserverEntry) => void,
    options?: IntersectionObserverInit
  ): () => void {
    if (typeof IntersectionObserver === 'undefined') {
      return () => {};
    }

    const observer = new IntersectionObserver(
      (entries) => entries.forEach(callback),
      options
    );

    observer.observe(element);

    return () => observer.disconnect();
  }
}