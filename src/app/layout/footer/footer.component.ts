import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CONTACT_CONFIG } from '../../core/config/contact.config';

/** Near-silent footer — a single carved line at the base of the cathedral. */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <footer class="footer">
      <div class="footer__inner">
        <div class="footer__left">
          <span class="footer__name">Łukasz Guziczak</span>
          <span class="footer__meta">AI Engineer · Wrocław</span>
        </div>
        <nav class="footer__links">
          <a [href]="contact.github" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a [href]="contact.linkedin" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          <a [href]="'mailto:' + contact.email">Email</a>
          <a routerLink="/cv">CV</a>
        </nav>
      </div>
      <div class="footer__base">© {{ year }} Łukasz Guziczak</div>
    </footer>
  `,
  styles: [
    `
      .footer {
        background: var(--bg-primary);
        border-top: 1px solid var(--border-color);
        padding: clamp(2.5rem, 5vw, 3.5rem) clamp(1.5rem, 6vw, 6rem) 2rem;
      }
      .footer__inner {
        max-width: 70rem;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
        flex-wrap: wrap;
      }
      .footer__left { display: flex; flex-direction: column; gap: 0.25rem; }
      .footer__name { color: var(--text-primary); font-weight: 600; font-size: 1rem; }
      .footer__meta { color: var(--text-tertiary); font-size: 0.85rem; }
      .footer__links { display: flex; gap: 1.5rem; flex-wrap: wrap; }
      .footer__links a {
        color: var(--text-secondary);
        font-size: 0.9rem;
        text-decoration: none;
        transition: color 0.25s ease;
      }
      .footer__links a:hover { color: var(--color-primary); text-decoration: none; }
      .footer__base {
        max-width: 70rem;
        margin: 2.5rem auto 0;
        color: var(--text-tertiary);
        font-size: 0.8rem;
        letter-spacing: 0.02em;
      }
    `,
  ],
})
export class FooterComponent {
  protected readonly contact = CONTACT_CONFIG;
  protected readonly year = new Date().getFullYear();
}
