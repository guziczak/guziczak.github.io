import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService, Achievement } from '../../core/services/data.service';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-achievements-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="achievements" class="achievements-section section">
      <div class="container">
        <div class="section-header animate-on-scroll">
          <h2 class="section-title">
            {{ t('achievements.title') || 'Key Achievements' }}
          </h2>
          <p class="section-subtitle">
            {{
              t('achievements.subtitle') ||
                'Milestones and accomplishments throughout my career'
            }}
          </p>
        </div>

        <div class="achievements-grid">
          @for (
            achievement of achievements();
            track achievement.id;
            let i = $index
          ) {
            <div
              class="achievement-card animate-on-scroll"
              [style.animation-delay.s]="i * 0.1"
              [attr.data-color]="achievement.color"
            >
              <div
                class="achievement-icon"
                [style.background]="getColorGradient(achievement.color)"
              >
                <i [class]="'fas ' + achievement.icon"></i>
              </div>
              <h3 class="achievement-title">{{ achievement.title }}</h3>
              <p class="achievement-description">
                {{ achievement.description }}
              </p>
            </div>
          }
        </div>

        <div class="achievements-stats animate-on-scroll">
          <div class="stat-item">
            <span class="stat-number">{{ achievements().length }}</span>
            <span class="stat-label">Total Achievements</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">30+</span>
            <span class="stat-label">Certifications</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">70%</span>
            <span class="stat-label">Performance Improvement</span>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .achievements-section {
        padding: 5rem 0;
        background: var(--bg-primary);
      }

      .section-header {
        text-align: center;
        margin-bottom: 3rem;
      }

      .section-title {
        font-size: clamp(2rem, 4vw, 3rem);
        margin-bottom: 1rem;
        color: var(--color-primary);
        font-weight: 700;
      }

      .section-subtitle {
        font-size: 1.125rem;
        color: var(--text-secondary);
        max-width: 600px;
        margin: 0 auto;
      }

      .achievements-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 2rem;
        margin-bottom: 3rem;
      }

      .achievement-card {
        background: var(--bg-secondary);
        padding: 2rem;
        border-radius: var(--radius-lg);
        text-align: center;
        transition: all var(--transition-base) ease;
        border: 1px solid var(--border-color);
        position: relative;
        overflow: hidden;
      }

      .achievement-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(
          90deg,
          var(--color-primary),
          var(--color-secondary)
        );
        transform: scaleX(0);
        transform-origin: left;
        transition: transform 0.5s ease;
      }

      .achievement-card:hover::before {
        transform: scaleX(1);
      }

      .achievement-card:hover {
        transform: translateY(-10px);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      }

      .achievement-icon {
        width: 80px;
        height: 80px;
        margin: 0 auto 1.5rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(
          135deg,
          var(--color-primary),
          var(--color-secondary)
        );
        position: relative;
        transition: transform 0.3s ease;
      }

      .achievement-card:hover .achievement-icon {
        transform: scale(1.1) rotate(5deg);
      }

      .achievement-icon i {
        font-size: 2rem;
        color: white;
      }

      .achievement-title {
        font-size: 1.25rem;
        margin-bottom: 1rem;
        color: var(--text-primary);
        font-weight: 600;
      }

      .achievement-description {
        font-size: 0.95rem;
        color: var(--text-secondary);
        line-height: 1.6;
      }

      .achievements-stats {
        display: flex;
        justify-content: center;
        gap: 4rem;
        margin-top: 3rem;
        padding: 2rem;
        background: var(--bg-secondary);
        border-radius: var(--radius-lg);
      }

      .stat-item {
        text-align: center;
      }

      .stat-number {
        display: block;
        font-size: 2.5rem;
        font-weight: 700;
        color: var(--color-primary);
        margin-bottom: 0.5rem;
      }

      .stat-label {
        font-size: 0.95rem;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      @media (max-width: 768px) {
        .achievements-section {
          padding: 3rem 0;
        }

        .achievements-grid {
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }

        .achievements-stats {
          flex-direction: column;
          gap: 2rem;
        }

        .stat-number {
          font-size: 2rem;
        }
      }

      @media (max-width: 480px) {
        .achievement-card {
          padding: 1.5rem;
        }

        .achievement-icon {
          width: 60px;
          height: 60px;
        }

        .achievement-icon i {
          font-size: 1.5rem;
        }
      }
    `,
  ],
})
export class AchievementsSectionComponent implements OnInit {
  private dataService = inject(DataService);
  private languageService = inject(LanguageService);

  achievements = signal<Achievement[]>([]);

  ngOnInit() {
    this.loadAchievements();
  }

  t(key: string): string {
    return this.languageService.t(key);
  }

  private loadAchievements() {
    this.dataService.getAchievements().subscribe((data) => {
      this.achievements.set(data);
    });
  }

  getColorGradient(color: string): string {
    const gradients: Record<string, string> = {
      primary: 'linear-gradient(135deg, #0070f3, #00a8ff)',
      secondary: 'linear-gradient(135deg, #8b5cf6, #d946ef)',
      success: 'linear-gradient(135deg, #10b981, #34d399)',
      warning: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
      info: 'linear-gradient(135deg, #06b6d4, #22d3ee)',
      danger: 'linear-gradient(135deg, #ef4444, #f87171)',
    };

    return gradients[color] || gradients['primary'];
  }
}
