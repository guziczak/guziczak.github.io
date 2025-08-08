import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <footer class="footer">
      <div class="container">
        <div class="footer-content">
          <div class="footer-logo">
            <h3>Łukasz Guziczak</h3>
            <p class="footer-tagline">{{ t('hero.subtitle') }}</p>
          </div>

          <nav class="footer-nav">
            <a routerLink="/" class="footer-link">{{ t('nav.home') }}</a>
            <a routerLink="/about" class="footer-link">{{ t('nav.about') }}</a>
            <a routerLink="/skills" class="footer-link">{{
              t('nav.skills')
            }}</a>
            <a routerLink="/projects" class="footer-link">{{
              t('nav.projects')
            }}</a>
            <a routerLink="/contact" class="footer-link">{{
              t('nav.contact')
            }}</a>
            <a href="/cv" target="_blank" class="footer-link">{{
              t('nav.cv')
            }}</a>
          </nav>

          <div class="footer-social">
            <a
              href="https://github.com/guziczak"
              target="_blank"
              rel="noopener"
              class="social-link"
              aria-label="GitHub"
            >
              <i class="fab fa-github"></i>
            </a>
            <a
              href="https://linkedin.com/in/guziczak"
              target="_blank"
              rel="noopener"
              class="social-link"
              aria-label="LinkedIn"
            >
              <i class="fab fa-linkedin-in"></i>
            </a>
            <a
              href="mailto:guziczak@pm.me"
              class="social-link"
              aria-label="Email"
            >
              <i class="fas fa-envelope"></i>
            </a>
            <a href="tel:+48693069832" class="social-link" aria-label="Phone">
              <i class="fas fa-phone-alt"></i>
            </a>
          </div>
        </div>

        <div class="footer-bottom">
          <p class="footer-copyright">
            &copy; {{ currentYear }} Łukasz Guziczak. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  `,
  styles: [
    `
      @use '../../../styles/variables' as *;
      @use '../../../styles/mixins' as *;

      .footer {
        background-color: var(--bg-secondary);
        border-top: 1px solid var(--border-color);
        padding: var(--spacing-3xl) 0 var(--spacing-xl);
        margin-top: auto;
      }

      .footer-content {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: var(--spacing-2xl);
        margin-bottom: var(--spacing-2xl);

        @include media-up(md) {
          grid-template-columns: 2fr 3fr 1fr;
        }
      }

      .footer-logo {
        h3 {
          color: var(--color-primary);
          font-size: 1.5rem;
          margin-bottom: var(--spacing-sm);
        }
      }

      .footer-tagline {
        color: var(--text-secondary);
        font-size: 0.9rem;
      }

      .footer-nav {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-lg);
        align-items: center;

        @include media-down(sm) {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--spacing-md);
        }
      }

      .footer-link {
        color: var(--text-secondary);
        text-decoration: none;
        font-weight: 500;
        transition: color var(--transition-fast) ease;

        &:hover {
          color: var(--color-primary);
          text-decoration: none;
        }
      }

      .footer-social {
        @include flex-center;
        gap: var(--spacing-md);

        @include media-down(sm) {
          justify-content: flex-start;
        }
      }

      .social-link {
        @include flex-center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: var(--bg-tertiary);
        color: var(--text-secondary);
        text-decoration: none;
        transition: all var(--transition-fast) ease;

        &:hover {
          background-color: var(--color-primary);
          color: white;
          transform: translateY(-3px);
        }
      }

      .footer-bottom {
        text-align: center;
        padding-top: var(--spacing-xl);
        border-top: 1px solid var(--border-color);
      }

      .footer-copyright {
        color: var(--text-secondary);
        font-size: 0.875rem;
        margin: 0;
      }
    `,
  ],
})
export class FooterComponent {
  private languageService = inject(LanguageService);

  // Translation method
  protected t(key: string): string {
    return this.languageService.t(key);
  }

  // Current year for copyright
  currentYear = new Date().getFullYear();
}
