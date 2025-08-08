import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="section">
      <div class="container">
        <h2 class="section-title">{{ t('about.title') }}</h2>

        <div class="about-content">
          <div class="about-intro">
            <p>{{ t('about.description') }}</p>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-number">5+</div>
              <div class="stat-label">Years Experience</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">50+</div>
              <div class="stat-label">Projects Completed</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">30+</div>
              <div class="stat-label">Happy Clients</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">10+</div>
              <div class="stat-label">Certifications</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .section {
        padding: 5rem 0;
        min-height: calc(100vh - 200px);
      }

      .container {
        max-width: 1280px;
        margin: 0 auto;
        padding: 0 1.25rem;
      }

      .section-title {
        font-size: 2.5rem;
        text-align: center;
        margin-bottom: 3rem;
        color: var(--text-primary);
      }

      .about-content {
        max-width: 900px;
        margin: 0 auto;
      }

      .about-intro {
        font-size: 1.125rem;
        line-height: 1.8;
        text-align: center;
        margin-bottom: 3rem;
        color: var(--text-secondary);
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 2rem;
        margin-top: 3rem;
      }

      .stat-card {
        background: var(--bg-card);
        padding: 2rem;
        border-radius: 1rem;
        text-align: center;
        box-shadow: var(--shadow-md);
        transition: transform 0.3s ease;
      }

      .stat-card:hover {
        transform: translateY(-5px);
      }

      .stat-number {
        font-size: 3rem;
        font-weight: 700;
        color: var(--color-primary);
        margin-bottom: 0.5rem;
      }

      .stat-label {
        font-size: 1rem;
        color: var(--text-secondary);
      }
    `,
  ],
})
export class AboutComponent {
  private languageService = inject(LanguageService);

  protected t(key: string): string {
    return this.languageService.t(key);
  }
}
