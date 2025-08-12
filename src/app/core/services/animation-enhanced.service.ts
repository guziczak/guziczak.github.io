import { Injectable, signal } from '@angular/core';
import { animate, AnimationBuilder, style } from '@angular/animations';

export enum AnimationDirection {
  LEFT = 'left',
  RIGHT = 'right',
  UP = 'up',
  DOWN = 'down'
}

export interface AnimationConfig {
  duration?: number;
  delay?: number;
  easing?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AnimationEnhancedService {
  private prefersReducedMotion = signal(false);

  constructor(private builder: AnimationBuilder) {
    // Check user preference for reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.prefersReducedMotion.set(mediaQuery.matches);

    mediaQuery.addEventListener('change', (e) => {
      this.prefersReducedMotion.set(e.matches);
    });
  }

  fadeIn(element: HTMLElement, duration = 300, delay = 0) {
    if (this.prefersReducedMotion()) {
      element.style.opacity = '1';
      return;
    }

    const animation = this.builder.build([
      style({ opacity: 0 }),
      animate(`${duration}ms ${delay}ms ease-out`, style({ opacity: 1 })),
    ]);

    const player = animation.create(element);
    player.play();
    return player;
  }

  slideIn(
    element: HTMLElement,
    direction: AnimationDirection = AnimationDirection.UP,
    duration = 400,
  ) {
    if (this.prefersReducedMotion()) {
      element.style.transform = 'none';
      element.style.opacity = '1';
      return;
    }

    const transforms = {
      [AnimationDirection.LEFT]: 'translateX(-100%)',
      [AnimationDirection.RIGHT]: 'translateX(100%)',
      [AnimationDirection.UP]: 'translateY(100%)',
      [AnimationDirection.DOWN]: 'translateY(-100%)',
    };

    const animation = this.builder.build([
      style({
        transform: transforms[direction],
        opacity: 0,
      }),
      animate(
        `${duration}ms cubic-bezier(0.35, 0, 0.25, 1)`,
        style({
          transform: 'none',
          opacity: 1,
        }),
      ),
    ]);

    const player = animation.create(element);
    player.play();
    return player;
  }

  scale(element: HTMLElement, from = 0.8, to = 1, duration = 300) {
    if (this.prefersReducedMotion()) {
      element.style.transform = `scale(${to})`;
      return;
    }

    const animation = this.builder.build([
      style({ transform: `scale(${from})` }),
      animate(
        `${duration}ms cubic-bezier(0.35, 0, 0.25, 1)`,
        style({ transform: `scale(${to})` }),
      ),
    ]);

    const player = animation.create(element);
    player.play();
    return player;
  }

  stagger(
    elements: HTMLElement[],
    animationType: 'fadeIn' | 'slideIn' = 'fadeIn',
    staggerDelay = 50,
  ) {
    elements.forEach((element, index) => {
      const delay = index * staggerDelay;

      switch (animationType) {
        case 'fadeIn':
          this.fadeIn(element, 400, delay);
          break;
        case 'slideIn':
          this.slideIn(element, AnimationDirection.UP, 400);
          break;
      }
    });
  }

  parallax(element: HTMLElement, scrollY: number, speed = 0.5) {
    if (this.prefersReducedMotion()) return;

    requestAnimationFrame(() => {
      const yPos = -(scrollY * speed);
      element.style.transform = `translateY(${yPos}px)`;
    });
  }

  morphText(element: HTMLElement, newText: string, duration = 500) {
    if (this.prefersReducedMotion()) {
      element.textContent = newText;
      return;
    }

    // Fade out
    const fadeOut = this.builder.build([
      animate(`${duration / 2}ms ease-out`, style({ opacity: 0 })),
    ]);

    const fadeIn = this.builder.build([
      style({ opacity: 0 }),
      animate(`${duration / 2}ms ease-in`, style({ opacity: 1 })),
    ]);

    const playerOut = fadeOut.create(element);
    playerOut.onDone(() => {
      requestAnimationFrame(() => {
        element.textContent = newText;
        const playerIn = fadeIn.create(element);
        playerIn.play();
      });
    });
    playerOut.play();
  }
}
