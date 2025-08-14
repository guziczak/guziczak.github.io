import { Injectable, OnDestroy, inject } from '@angular/core';
import { Subject, Subscription, timer } from 'rxjs';

interface CleanupTask {
  id: string;
  cleanup: () => void;
  type: 'subscription' | 'timer' | 'listener' | 'observer' | 'custom';
}

@Injectable()
export class CleanupService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly tasks = new Map<string, CleanupTask>();
  private readonly subscriptions = new Set<Subscription>();
  private readonly timers = new Set<number>();
  private readonly listeners = new Set<() => void>();
  private readonly observers = new Set<IntersectionObserver | MutationObserver | ResizeObserver>();

  get destroyed$() {
    return this.destroy$.asObservable();
  }

  ngOnDestroy(): void {
    this.cleanupAll();
    this.destroy$.next();
    this.destroy$.complete();
  }

  addSubscription(subscription: Subscription): void {
    this.subscriptions.add(subscription);
  }

  addTimer(timerId: number): void {
    this.timers.add(timerId);
  }

  addInterval(intervalId: number): void {
    this.timers.add(intervalId);
  }

  addAnimationFrame(frameId: number): void {
    this.timers.add(frameId);
  }

  addListener(removeListener: () => void): void {
    this.listeners.add(removeListener);
  }

  addObserver(observer: IntersectionObserver | MutationObserver | ResizeObserver): void {
    this.observers.add(observer);
  }

  addTask(id: string, cleanup: () => void, type: CleanupTask['type'] = 'custom'): void {
    this.tasks.set(id, { id, cleanup, type });
  }

  removeTask(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.cleanup();
      this.tasks.delete(id);
    }
  }

  setTimeout(callback: () => void, delay: number): () => void {
    const timerId = window.setTimeout(callback, delay);
    this.addTimer(timerId);
    
    return () => {
      clearTimeout(timerId);
      this.timers.delete(timerId);
    };
  }

  setInterval(callback: () => void, interval: number): () => void {
    const intervalId = window.setInterval(callback, interval);
    this.addInterval(intervalId);
    
    return () => {
      clearInterval(intervalId);
      this.timers.delete(intervalId);
    };
  }

  requestAnimationFrame(callback: FrameRequestCallback): () => void {
    const frameId = window.requestAnimationFrame(callback);
    this.addAnimationFrame(frameId);
    
    return () => {
      cancelAnimationFrame(frameId);
      this.timers.delete(frameId);
    };
  }

  addEventListener(
    target: EventTarget,
    eventName: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ): () => void {
    target.addEventListener(eventName, handler, options);
    
    const removeListener = () => {
      target.removeEventListener(eventName, handler, options);
    };
    
    this.addListener(removeListener);
    return removeListener;
  }

  createIntersectionObserver(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ): IntersectionObserver {
    const observer = new IntersectionObserver(callback, options);
    this.addObserver(observer);
    return observer;
  }

  createMutationObserver(callback: MutationCallback): MutationObserver {
    const observer = new MutationObserver(callback);
    this.addObserver(observer);
    return observer;
  }

  createResizeObserver(callback: ResizeObserverCallback): ResizeObserver {
    const observer = new ResizeObserver(callback);
    this.addObserver(observer);
    return observer;
  }

  cleanupSubscriptions(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions.clear();
  }

  cleanupTimers(): void {
    this.timers.forEach(timerId => {
      clearTimeout(timerId);
      clearInterval(timerId);
      cancelAnimationFrame(timerId);
    });
    this.timers.clear();
  }

  cleanupListeners(): void {
    this.listeners.forEach(removeListener => removeListener());
    this.listeners.clear();
  }

  cleanupObservers(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }

  cleanupTasks(): void {
    this.tasks.forEach(task => task.cleanup());
    this.tasks.clear();
  }

  cleanupAll(): void {
    this.cleanupSubscriptions();
    this.cleanupTimers();
    this.cleanupListeners();
    this.cleanupObservers();
    this.cleanupTasks();
  }

  createSafeTimeout(callback: () => void, delay: number): void {
    const cleanup = this.setTimeout(callback, delay);
    this.addTask(`timeout-${Date.now()}`, cleanup, 'timer');
  }

  createSafeInterval(callback: () => void, interval: number): void {
    const cleanup = this.setInterval(callback, interval);
    this.addTask(`interval-${Date.now()}`, cleanup, 'timer');
  }

  createSafeAnimationFrame(callback: FrameRequestCallback): void {
    const cleanup = this.requestAnimationFrame(callback);
    this.addTask(`frame-${Date.now()}`, cleanup, 'timer');
  }

  debounce(callback: () => void, delay: number): () => void {
    let timeoutId: number | null = null;
    
    const debounced = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        this.timers.delete(timeoutId);
      }
      
      timeoutId = window.setTimeout(() => {
        callback();
        timeoutId = null;
      }, delay);
      
      this.addTimer(timeoutId);
    };
    
    return debounced;
  }

  throttle(callback: () => void, limit: number): () => void {
    let inThrottle = false;
    
    return () => {
      if (!inThrottle) {
        callback();
        inThrottle = true;
        
        const timeoutId = window.setTimeout(() => {
          inThrottle = false;
        }, limit);
        
        this.addTimer(timeoutId);
      }
    };
  }
}