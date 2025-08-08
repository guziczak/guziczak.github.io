import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../core/services/language.service';
import { DataService, SkillCategory } from '../../core/services/data.service';
import { SkillsRadarChartComponent } from '../../shared/ui/skills-radar-chart/skills-radar-chart.component';
import { AnimateOnViewDirective } from '../../shared/directives/animate-on-view.directive';

@Component({
  selector: 'app-skills-section',
  standalone: true,
  imports: [CommonModule, SkillsRadarChartComponent, AnimateOnViewDirective],
  template: `
    <section id="skills" class="skills-section section">
      <div class="container">
        <div class="section-header animate-on-scroll">
          <h2 class="section-title">{{ t('skills.title') }}</h2>
          <p class="section-subtitle">{{ t('skills.subtitle') }}</p>
        </div>

        <!-- Skills Radar Chart -->
        <div class="chart-section animate-on-scroll">
          <app-skills-radar-chart />
        </div>

        <div class="skills-grid">
          @for (category of skillCategories(); track category.category) {
            <div
              class="skill-category animate-on-scroll"
              [style.animation-delay.s]="$index * 0.1"
            >
              <h3 class="category-title">{{ category.category }}</h3>
              <div class="skills-list">
                @for (skill of category.items; track skill.name) {
                  <div class="skill-item">
                    <div class="skill-header">
                      <span class="skill-name">{{ skill.name }}</span>
                      <span class="skill-level">{{ skill.level }}%</span>
                    </div>
                    <div class="skill-bar">
                      <div
                        class="skill-progress"
                        [attr.data-level]="skill.level"
                        appAnimateOnView
                        [threshold]="0.1"
                        style="width: 0"
                      ></div>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <div class="skills-footer animate-on-scroll">
          <p class="skills-note">{{ t('skills.note') }}</p>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .skills-section {
        padding: 5rem 0;
        background: var(--bg-secondary);
      }

      .section-header {
        text-align: center;
        margin-bottom: 3rem;
      }

      .section-title {
        font-size: clamp(2rem, 4vw, 3rem);
        margin-bottom: 1rem;
        color: var(--text-primary);
      }

      .section-subtitle {
        font-size: 1.125rem;
        color: var(--text-secondary);
        max-width: 600px;
        margin: 0 auto;
      }

      .skills-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 2rem;
        margin-bottom: 3rem;
      }

      .skill-category {
        background: var(--bg-primary);
        padding: 2rem;
        border-radius: var(--radius-lg);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        transition:
          transform var(--transition-base) ease,
          box-shadow var(--transition-base) ease;
      }

      .skill-category:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
      }

      .category-title {
        font-size: 1.25rem;
        margin-bottom: 1.5rem;
        color: var(--color-primary);
        padding-bottom: 0.75rem;
        border-bottom: 2px solid var(--bg-tertiary);
      }

      .skills-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .skill-item {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .skill-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .skill-name {
        font-size: 0.95rem;
        font-weight: 500;
        color: var(--text-primary);
      }

      .skill-level {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--color-primary);
      }

      .skill-bar {
        height: 6px;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 10px;
        overflow: hidden;
        position: relative;
      }

      body.dark-mode .skill-bar {
        background: rgba(255, 255, 255, 0.1);
      }

      .skill-progress {
        height: 100%;
        background: linear-gradient(
          90deg,
          var(--color-primary),
          var(--color-secondary)
        );
        border-radius: 10px;
        position: relative;
        transition: width 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        width: 0;
        box-shadow: 0 2px 8px rgba(0, 112, 243, 0.3);
      }

      .skill-progress::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(
          90deg,
          transparent,
          rgba(255, 255, 255, 0.3),
          transparent
        );
        animation: shimmer 2s infinite;
      }

      @keyframes shimmer {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(100%);
        }
      }

      .chart-section {
        margin-bottom: 3rem;
      }

      .skills-footer {
        text-align: center;
      }

      .skills-note {
        font-size: 0.95rem;
        color: var(--text-secondary);
        font-style: italic;
      }

      @media (max-width: 768px) {
        .skills-section {
          padding: 3rem 0;
        }

        .skills-grid {
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }

        .skill-category {
          padding: 1.5rem;
        }
      }
    `,
  ],
})
export class SkillsSectionComponent implements OnInit {
  private languageService = inject(LanguageService);
  private dataService = inject(DataService);

  skillCategories = signal<SkillCategory[]>([]);

  ngOnInit() {
    this.loadSkills();
  }

  t(key: string): string {
    return this.languageService.t(key);
  }

  private loadSkills() {
    this.dataService.getSkills().subscribe((skills) => {
      this.skillCategories.set(skills);
    });
  }
}
