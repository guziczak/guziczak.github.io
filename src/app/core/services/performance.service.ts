import { Injectable, inject } from '@angular/core';
import { LoggerService } from './logger.service';

interface PerformanceMark {
  name: string;
  timestamp: number;
}

interface PerformanceMeasure {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
}

@Injectable({
  providedIn: 'root',
})
export class PerformanceService {
  private logger = inject(LoggerService);
  private marks = new Map<string, PerformanceMark>();
  private measures = new Map<string, PerformanceMeasure>();

  mark(name: string): void {
    const timestamp = performance.now();
    this.marks.set(name, { name, timestamp });
    
    if (typeof performance.mark === 'function') {
      try {
        performance.mark(name);
      } catch (e) {
        this.logger.debug(`Performance mark failed: ${name}`, e);
      }
    }
  }

  measure(name: string, startMark?: string, endMark?: string): number {
    let duration = 0;
    
    if (typeof performance.measure === 'function') {
      try {
        performance.measure(name, startMark, endMark);
        const entries = performance.getEntriesByName(name, 'measure');
        if (entries.length > 0) {
          duration = entries[entries.length - 1].duration;
        }
      } catch (e) {
        this.logger.debug(`Performance measure failed: ${name}`, e);
      }
    }

    if (duration === 0 && startMark && endMark) {
      const start = this.marks.get(startMark);
      const end = this.marks.get(endMark);
      
      if (start && end) {
        duration = end.timestamp - start.timestamp;
      }
    }

    const measure: PerformanceMeasure = {
      name,
      duration,
      startTime: this.marks.get(startMark!)?.timestamp ?? 0,
      endTime: this.marks.get(endMark!)?.timestamp ?? performance.now(),
    };

    this.measures.set(name, measure);
    this.logger.debug(`Performance: ${name} took ${duration.toFixed(2)}ms`);
    
    return duration;
  }

  startTimer(label: string): () => number {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      this.logger.debug(`Timer: ${label} took ${duration.toFixed(2)}ms`);
      return duration;
    };
  }

  async measureAsync<T>(
    label: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      this.logger.debug(`Async: ${label} took ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.error(`Async failed: ${label} after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  }

  getResourceTimings(): PerformanceResourceTiming[] {
    if (typeof performance.getEntriesByType !== 'function') {
      return [];
    }
    
    return performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  }

  getNavigationTiming(): PerformanceNavigationTiming | null {
    if (typeof performance.getEntriesByType !== 'function') {
      return null;
    }
    
    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return entries.length > 0 ? entries[0] : null;
  }

  getPaintTimings(): PerformancePaintTiming[] {
    if (typeof performance.getEntriesByType !== 'function') {
      return [];
    }
    
    return performance.getEntriesByType('paint') as PerformancePaintTiming[];
  }

  getLargestContentfulPaint(): number {
    const paintTimings = this.getPaintTimings();
    const lcp = paintTimings.find(timing => timing.name === 'largest-contentful-paint');
    return lcp?.startTime ?? 0;
  }

  getFirstInputDelay(): number {
    if ('PerformanceObserver' in window) {
      // This would need a PerformanceObserver to track properly
      // Returning 0 as placeholder
      return 0;
    }
    return 0;
  }

  getCumulativeLayoutShift(): number {
    if ('PerformanceObserver' in window) {
      // This would need a PerformanceObserver to track properly
      // Returning 0 as placeholder
      return 0;
    }
    return 0;
  }

  getWebVitals(): {
    lcp: number;
    fid: number;
    cls: number;
    ttfb: number;
    fcp: number;
  } {
    const navigation = this.getNavigationTiming();
    const paintTimings = this.getPaintTimings();
    
    const fcp = paintTimings.find(t => t.name === 'first-contentful-paint')?.startTime ?? 0;
    const ttfb = navigation ? navigation.responseStart - navigation.requestStart : 0;
    
    return {
      lcp: this.getLargestContentfulPaint(),
      fid: this.getFirstInputDelay(),
      cls: this.getCumulativeLayoutShift(),
      ttfb,
      fcp,
    };
  }

  reportMetrics(): void {
    const vitals = this.getWebVitals();
    const navigation = this.getNavigationTiming();
    
    this.logger.group('Performance Metrics');
    this.logger.table({
      'First Contentful Paint': `${vitals.fcp.toFixed(2)}ms`,
      'Largest Contentful Paint': `${vitals.lcp.toFixed(2)}ms`,
      'First Input Delay': `${vitals.fid.toFixed(2)}ms`,
      'Cumulative Layout Shift': vitals.cls.toFixed(3),
      'Time to First Byte': `${vitals.ttfb.toFixed(2)}ms`,
    });
    
    if (navigation) {
      this.logger.table({
        'DOM Content Loaded': `${navigation.domContentLoadedEventEnd.toFixed(2)}ms`,
        'Load Complete': `${navigation.loadEventEnd.toFixed(2)}ms`,
        'DOM Interactive': `${navigation.domInteractive.toFixed(2)}ms`,
        'DOM Complete': `${navigation.domComplete.toFixed(2)}ms`,
      });
    }
    
    this.logger.groupEnd();
  }

  clearMarks(name?: string): void {
    if (name) {
      this.marks.delete(name);
      if (typeof performance.clearMarks === 'function') {
        performance.clearMarks(name);
      }
    } else {
      this.marks.clear();
      if (typeof performance.clearMarks === 'function') {
        performance.clearMarks();
      }
    }
  }

  clearMeasures(name?: string): void {
    if (name) {
      this.measures.delete(name);
      if (typeof performance.clearMeasures === 'function') {
        performance.clearMeasures(name);
      }
    } else {
      this.measures.clear();
      if (typeof performance.clearMeasures === 'function') {
        performance.clearMeasures();
      }
    }
  }
}