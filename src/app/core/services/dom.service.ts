import { Injectable, inject, Renderer2, RendererFactory2 } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class DomService {
  private renderer: Renderer2;
  private document = inject(DOCUMENT);
  
  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  setBodyStyle(property: string, value: string): void {
    if (this.document.body) {
      this.renderer.setStyle(this.document.body, property, value);
    }
  }

  removeBodyStyle(property: string): void {
    if (this.document.body) {
      this.renderer.removeStyle(this.document.body, property);
    }
  }

  addClass(element: HTMLElement | Element, className: string): void {
    this.renderer.addClass(element, className);
  }

  removeClass(element: HTMLElement | Element, className: string): void {
    this.renderer.removeClass(element, className);
  }

  toggleClass(element: HTMLElement | Element, className: string, condition?: boolean): void {
    const shouldAdd = condition !== undefined ? condition : !element.classList.contains(className);
    
    if (shouldAdd) {
      this.addClass(element, className);
    } else {
      this.removeClass(element, className);
    }
  }

  setStyle(element: HTMLElement, property: string, value: string): void {
    this.renderer.setStyle(element, property, value);
  }

  removeStyle(element: HTMLElement, property: string): void {
    this.renderer.removeStyle(element, property);
  }

  setAttribute(element: Element, name: string, value: string): void {
    this.renderer.setAttribute(element, name, value);
  }

  removeAttribute(element: Element, name: string): void {
    this.renderer.removeAttribute(element, name);
  }

  setProperty(element: Element, property: string, value: any): void {
    this.renderer.setProperty(element, property, value);
  }

  listen(
    element: Element | Window | Document | 'window' | 'document' | 'body',
    eventName: string,
    callback: (event: Event) => void
  ): () => void {
    const target = this.resolveTarget(element);
    return this.renderer.listen(target, eventName, callback);
  }

  appendChild(parent: Element, child: Element): void {
    this.renderer.appendChild(parent, child);
  }

  removeChild(parent: Element, child: Element): void {
    this.renderer.removeChild(parent, child);
  }

  createElement(tagName: string, namespace?: string): Element {
    return this.renderer.createElement(tagName, namespace);
  }

  createText(text: string): Text {
    return this.renderer.createText(text);
  }

  insertBefore(parent: Element, newChild: Element, refChild: Element): void {
    this.renderer.insertBefore(parent, newChild, refChild);
  }

  selectRootElement(selector: string, preserveContent?: boolean): Element {
    return this.renderer.selectRootElement(selector, preserveContent);
  }

  querySelector(selector: string): Element | null {
    return this.document.querySelector(selector);
  }

  querySelectorAll(selector: string): NodeListOf<Element> {
    return this.document.querySelectorAll(selector);
  }

  getElementById(id: string): HTMLElement | null {
    return this.document.getElementById(id);
  }

  scrollTo(options: ScrollToOptions): void {
    if (this.document.defaultView) {
      this.document.defaultView.scrollTo(options);
    }
  }

  getScrollPosition(): { x: number; y: number } {
    const win = this.document.defaultView;
    return {
      x: win?.scrollX ?? 0,
      y: win?.scrollY ?? 0,
    };
  }

  getViewportSize(): { width: number; height: number } {
    const win = this.document.defaultView;
    return {
      width: win?.innerWidth ?? 0,
      height: win?.innerHeight ?? 0,
    };
  }

  getDocumentSize(): { width: number; height: number } {
    return {
      width: this.document.documentElement?.scrollWidth ?? 0,
      height: this.document.documentElement?.scrollHeight ?? 0,
    };
  }

  getBoundingClientRect(element: Element): DOMRect {
    return element.getBoundingClientRect();
  }

  requestAnimationFrame(callback: FrameRequestCallback): number {
    return this.document.defaultView?.requestAnimationFrame(callback) ?? 0;
  }

  cancelAnimationFrame(id: number): void {
    this.document.defaultView?.cancelAnimationFrame(id);
  }

  matchMedia(query: string): MediaQueryList | null {
    return this.document.defaultView?.matchMedia(query) ?? null;
  }

  private resolveTarget(element: Element | Window | Document | 'window' | 'document' | 'body'): any {
    switch (element) {
      case 'window':
        return this.document.defaultView;
      case 'document':
        return this.document;
      case 'body':
        return this.document.body;
      default:
        return element;
    }
  }
}