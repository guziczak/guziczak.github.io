import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../core/services/language.service';
import {
  DataService,
  Experience,
  Education,
} from '../../core/services/data.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

type TabType = 'profile' | 'experience' | 'education';

@Component({
  selector: 'app-about-section',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <section id="about" class="about-section section">
      <div class="container">
        <div class="section-header animate-on-scroll">
          <h2 class="section-title">{{ 'about.title' | translate }}</h2>
        </div>

        <div class="about-content">
          <!-- Tab Navigation -->
          <div class="tab-navigation animate-on-scroll">
            <button
              class="tab-button"
              [class.active]="activeTab() === 'profile'"
              (click)="setActiveTab('profile')"
            >
              <i class="fas fa-user"></i>
              <span>{{ 'about.profile.tab' | translate }}</span>
            </button>
            <button
              class="tab-button"
              [class.active]="activeTab() === 'experience'"
              (click)="setActiveTab('experience')"
            >
              <i class="fas fa-briefcase"></i>
              <span>{{ 'about.experience.tab' | translate }}</span>
            </button>
            <button
              class="tab-button"
              [class.active]="activeTab() === 'education'"
              (click)="setActiveTab('education')"
            >
              <i class="fas fa-graduation-cap"></i>
              <span>{{ 'about.education.tab' | translate }}</span>
            </button>
          </div>

          <!-- Tab Content -->
          <div
            class="tab-content animate-on-scroll"
            [style.animation-delay.s]="0.2"
          >
            <!-- Profile Tab -->
            @if (activeTab() === 'profile') {
              <div class="profile-content">
                <div class="profile-info">
                  <h3 class="profile-title">
                    {{ 'about.profile.title' | translate }}
                  </h3>
                  <p class="profile-description">
                    {{ 'about.description' | translate }}
                  </p>

                  <div class="profile-details">
                    <div class="detail-item">
                      <i class="fas fa-map-marker-alt"></i>
                      <span>{{ 'about.location' | translate }}</span>
                    </div>
                    <div class="detail-item">
                      <i class="fas fa-language"></i>
                      <span>{{ 'about.languages' | translate }}</span>
                    </div>
                    <div class="detail-item">
                      <i class="fas fa-heart"></i>
                      <span>{{ 'about.interests' | translate }}</span>
                    </div>
                  </div>

                  <div class="profile-stats">
                    <div class="stat-item">
                      <span class="stat-number"
                        >{{ yearsOfExperience() }}+</span
                      >
                      <span class="stat-label">{{
                        'about.yearsExperience' | translate
                      }}</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-number">50+</span>
                      <span class="stat-label">{{
                        'about.projectsCompleted' | translate
                      }}</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-number">20+</span>
                      <span class="stat-label">{{
                        'about.technologies' | translate
                      }}</span>
                    </div>
                  </div>
                </div>
              </div>
            }

            <!-- Experience Tab -->
            @if (activeTab() === 'experience') {
              <div class="timeline">
                @for (exp of experiences(); track exp.company) {
                  <div
                    class="timeline-item"
                    [style.animation-delay.s]="$index * 0.1"
                  >
                    <div class="timeline-marker"></div>
                    <div class="timeline-content">
                      <div class="timeline-header">
                        <h4 class="timeline-title">{{ exp.title }}</h4>
                        <span class="timeline-company">{{ exp.company }}</span>
                      </div>
                      <span class="timeline-period">
                        <i class="far fa-calendar-alt"></i>
                        {{ exp.period }}
                      </span>
                      <p class="timeline-description">{{ exp.description }}</p>
                    </div>
                  </div>
                }
              </div>
            }

            <!-- Education Tab -->
            @if (activeTab() === 'education') {
              <div class="education-grid">
                @for (edu of education(); track edu.institution) {
                  <div
                    class="education-card"
                    [style.animation-delay.s]="$index * 0.15"
                  >
                    <div class="education-icon">
                      <i class="fas fa-university"></i>
                    </div>
                    <div class="education-content">
                      <h4 class="education-title">{{ edu.title }}</h4>
                      <span class="education-institution">{{
                        edu.institution
                      }}</span>
                      <span class="education-period">
                        <i class="far fa-calendar-alt"></i>
                        {{ edu.period }}
                      </span>
                      <p class="education-description">{{ edu.description }}</p>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .about-section {
        padding: 5rem 0;
      }

      .section-header {
        text-align: center;
        margin-bottom: 3rem;
      }

      .section-title {
        font-size: clamp(2rem, 4vw, 3rem);
        margin-bottom: 1rem;
      }

      /* Tab Navigation */
      .tab-navigation {
        display: flex;
        justify-content: center;
        gap: 1rem;
        margin-bottom: 3rem;
        flex-wrap: wrap;
      }

      .tab-button {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        background: var(--bg-secondary);
        border: 2px solid transparent;
        border-radius: var(--radius-full);
        color: var(--text-secondary);
        font-weight: 500;
        cursor: pointer;
        transition: all var(--transition-base) ease;
      }

      .tab-button:hover {
        background: var(--bg-tertiary);
        transform: translateY(-2px);
      }

      .tab-button.active {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .tab-button i {
        font-size: 1.125rem;
      }

      /* Profile Content */
      .profile-content {
        max-width: 800px;
        margin: 0 auto;
      }

      .profile-title {
        font-size: 1.75rem;
        margin-bottom: 1.5rem;
        color: var(--color-primary);
      }

      .profile-description {
        font-size: 1.125rem;
        line-height: 1.8;
        color: var(--text-secondary);
        margin-bottom: 2rem;
      }

      .profile-details {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1.5rem;
        margin-bottom: 3rem;
      }

      .detail-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        color: var(--text-primary);
      }

      .detail-item i {
        color: var(--color-primary);
        font-size: 1.25rem;
        width: 24px;
      }

      .profile-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 2rem;
        padding: 2rem;
        background: var(--bg-secondary);
        border-radius: var(--radius-lg);
        text-align: center;
      }

      .stat-item {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .stat-number {
        font-size: 2.5rem;
        font-weight: 700;
        color: var(--color-primary);
      }

      .stat-label {
        font-size: 0.95rem;
        color: var(--text-secondary);
      }

      /* Timeline */
      .timeline {
        position: relative;
        padding-left: 2rem;
        max-width: 900px;
        margin: 0 auto;
      }

      .timeline::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 2px;
        background: var(--bg-tertiary);
      }

      .timeline-item {
        position: relative;
        padding-bottom: 2.5rem;
        opacity: 0;
        transform: translateX(-20px);
        animation: slideInLeft 0.6s ease forwards;
      }

      .timeline-marker {
        position: absolute;
        left: -2rem;
        top: 0.5rem;
        width: 12px;
        height: 12px;
        background: var(--color-primary);
        border-radius: 50%;
        box-shadow: 0 0 0 4px var(--bg-primary);
      }

      .timeline-content {
        background: var(--bg-secondary);
        padding: 1.5rem;
        border-radius: var(--radius-md);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      }

      .timeline-header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 0.5rem;
      }

      .timeline-title {
        font-size: 1.25rem;
        color: var(--text-primary);
        margin-bottom: 0.25rem;
      }

      .timeline-company {
        color: var(--color-primary);
        font-weight: 600;
      }

      .timeline-period {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9rem;
        color: var(--text-tertiary);
        margin-bottom: 1rem;
      }

      .timeline-description {
        color: var(--text-secondary);
        line-height: 1.6;
      }

      /* Education */
      .education-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
        gap: 2rem;
        max-width: 1000px;
        margin: 0 auto;
      }

      .education-card {
        background: var(--bg-secondary);
        padding: 2rem;
        border-radius: var(--radius-lg);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        opacity: 0;
        transform: translateY(20px);
        animation: slideInUp 0.6s ease forwards;
        transition:
          transform var(--transition-base) ease,
          box-shadow var(--transition-base) ease;
      }

      .education-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
      }

      .education-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 60px;
        height: 60px;
        background: var(--color-primary);
        color: white;
        border-radius: var(--radius-md);
        font-size: 1.5rem;
        margin-bottom: 1.5rem;
      }

      .education-title {
        font-size: 1.25rem;
        margin-bottom: 0.5rem;
        color: var(--text-primary);
      }

      .education-institution {
        display: block;
        color: var(--color-primary);
        font-weight: 600;
        margin-bottom: 0.5rem;
      }

      .education-period {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9rem;
        color: var(--text-tertiary);
        margin-bottom: 1rem;
      }

      .education-description {
        color: var(--text-secondary);
        line-height: 1.6;
        font-size: 0.95rem;
      }

      /* Animations */
      @keyframes slideInLeft {
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      @keyframes slideInUp {
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* Mobile */
      @media (max-width: 768px) {
        .about-section {
          padding: 3rem 0;
        }

        .tab-navigation {
          gap: 0.5rem;
        }

        .tab-button {
          padding: 0.5rem 1rem;
          font-size: 0.9rem;
        }

        .profile-stats {
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          padding: 1.5rem;
        }

        .stat-number {
          font-size: 2rem;
        }

        .timeline {
          padding-left: 1.5rem;
        }

        .timeline-marker {
          left: -1.5rem;
        }

        .education-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AboutSectionComponent implements OnInit {
  private languageService = inject(LanguageService);
  private dataService = inject(DataService);

  t(key: string): string {
    return this.languageService.t(key);
  }

  // Active tab state
  activeTab = signal<TabType>('profile');

  // Calculate years of experience
  yearsOfExperience = computed(() => {
    const startYear = 2019; // First professional experience
    const currentYear = new Date().getFullYear();
    return currentYear - startYear;
  });

  // Set active tab
  setActiveTab(tab: TabType): void {
    this.activeTab.set(tab);
  }

  // Experience and Education data from service
  experiences = signal<Experience[]>([]);
  education = signal<Education[]>([]);

  ngOnInit() {
    this.loadData();
  }

  private loadData() {
    // Load experience data
    this.dataService.getExperience().subscribe((exp) => {
      this.experiences.set(exp);
    });

    // Load education data
    this.dataService.getEducation().subscribe((edu) => {
      this.education.set(edu);
    });
  }
}
