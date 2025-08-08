import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type SkeletonType = 'text' | 'title' | 'avatar' | 'image' | 'card' | 'list';

@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    @switch (type) {
      @case ('text') {
        <div class="skeleton skeleton-text" [style.width]="width"></div>
      }
      @case ('title') {
        <div class="skeleton skeleton-title" [style.width]="width"></div>
      }
      @case ('avatar') {
        <div
          class="skeleton skeleton-avatar"
          [style.width]="width"
          [style.height]="height"
        ></div>
      }
      @case ('image') {
        <div
          class="skeleton skeleton-image"
          [style.width]="width"
          [style.height]="height"
        ></div>
      }
      @case ('card') {
        <div class="skeleton-card">
          <div class="skeleton skeleton-image"></div>
          <div class="skeleton-card-content">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text" style="width: 80%"></div>
          </div>
        </div>
      }
      @case ('list') {
        @for (item of items; track item) {
          <div class="skeleton-list-item">
            <div class="skeleton skeleton-avatar"></div>
            <div class="skeleton-list-content">
              <div class="skeleton skeleton-text" style="width: 60%"></div>
              <div class="skeleton skeleton-text" style="width: 40%"></div>
            </div>
          </div>
        }
      }
    }
  `,
  styles: [
    `
      @keyframes shimmer {
        0% {
          background-position: -1000px 0;
        }
        100% {
          background-position: 1000px 0;
        }
      }

      .skeleton {
        background: linear-gradient(
          90deg,
          var(--skeleton-base) 0%,
          var(--skeleton-shine) 50%,
          var(--skeleton-base) 100%
        );
        background-size: 1000px 100%;
        animation: shimmer 2s infinite ease-out;
        border-radius: 4px;
        --skeleton-base: rgba(0, 0, 0, 0.1);
        --skeleton-shine: rgba(0, 0, 0, 0.05);
      }

      :host-context(.dark-mode) .skeleton {
        --skeleton-base: rgba(255, 255, 255, 0.1);
        --skeleton-shine: rgba(255, 255, 255, 0.05);
      }

      .skeleton-text {
        height: 16px;
        margin-bottom: 8px;
        width: 100%;
      }

      .skeleton-title {
        height: 24px;
        margin-bottom: 12px;
        width: 100%;
      }

      .skeleton-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
      }

      .skeleton-image {
        width: 100%;
        height: 200px;
        border-radius: 8px;
      }

      .skeleton-card {
        padding: 16px;
        background: var(--bg-secondary);
        border-radius: 8px;
        margin-bottom: 16px;
      }

      .skeleton-card-content {
        margin-top: 16px;
      }

      .skeleton-list-item {
        display: flex;
        gap: 16px;
        padding: 12px 0;
        border-bottom: 1px solid var(--border-color);
      }

      .skeleton-list-item:last-child {
        border-bottom: none;
      }

      .skeleton-list-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
    `,
  ],
})
export class SkeletonLoaderComponent {
  @Input() type: SkeletonType = 'text';
  @Input() width?: string;
  @Input() height?: string;
  @Input() count = 1;

  get items() {
    return Array(this.count).fill(0);
  }
}
