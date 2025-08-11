import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  DataService,
  Experience,
  Education,
  Skill,
  SkillCategory,
} from '../../core/services/data.service';
import { NavigationComponent } from '../../layout/navigation/navigation.component';
import { FooterComponent } from '../../layout/footer/footer.component';
import { ScrollProgressComponent } from '../../shared/ui/scroll-progress/scroll-progress.component';
import { BackToTopComponent } from '../../shared/ui/back-to-top/back-to-top.component';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-cv-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NavigationComponent,
    FooterComponent,
    ScrollProgressComponent,
    BackToTopComponent,
  ],
  template: `
    <app-scroll-progress />
    <app-navigation />

    <div class="cv-page">
      <div class="container">
        <header class="cv-header">
          <div class="profile-section">
            <img src="/photo.jpg" alt="Łukasz Guziczak" class="profile-image" />
            <div class="profile-info">
              <h1>Łukasz Guziczak</h1>
              <h2>Full-stack Developer & Analyst</h2>
              <div class="contact-info">
                <a href="mailto:guziczak@pm.me">
                  <i class="fas fa-envelope"></i> guziczak&#64;pm.me
                </a>
                <a
                  href="https://linkedin.com/in/guziczak"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <i class="fab fa-linkedin"></i> LinkedIn
                </a>
                <a
                  href="https://github.com/guziczak"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <i class="fab fa-github"></i> GitHub
                </a>
              </div>
            </div>
          </div>

          <div class="cv-actions">
            <a routerLink="/" class="btn-action">
              <i class="fas fa-arrow-left"></i> Back to Portfolio
            </a>
            <button (click)="downloadCV()" class="btn-action btn-primary">
              <i class="fas fa-download"></i> Download PDF
            </button>
            <a routerLink="/cv-print" class="btn-action">
              <i class="fas fa-print"></i> Print Version
            </a>
          </div>
        </header>

        <div class="cv-content">
          <!-- Professional Summary -->
          <section class="cv-section">
            <h3><i class="fas fa-user"></i> Professional Summary</h3>
            <p>
              Experienced Full-stack Developer with a strong background in Java,
              Spring Boot, React, and cloud technologies. Proven track record of
              developing scalable enterprise solutions, optimizing database
              performance, and implementing microservices architectures.
              Passionate about clean code, continuous learning, and delivering
              high-quality software that meets business objectives.
            </p>
          </section>

          <!-- Experience -->
          <section class="cv-section">
            <h3><i class="fas fa-briefcase"></i> Professional Experience</h3>
            <div class="timeline">
              @for (exp of experience(); track exp.id) {
                <div class="timeline-item" [class.current]="exp.current">
                  <div class="timeline-marker"></div>
                  <div class="timeline-content">
                    <div class="timeline-header">
                      <h4>{{ exp.title }}</h4>
                      <span class="timeline-date">{{ exp.period }}</span>
                    </div>
                    <h5>{{ exp.company }}</h5>
                    <p>{{ exp.description }}</p>
                    @if (exp.technologies && exp.technologies.length > 0) {
                      <div class="tech-tags">
                        @for (tech of exp.technologies; track tech) {
                          <span class="tech-tag">{{ tech }}</span>
                        }
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </section>

          <!-- Education -->
          <section class="cv-section">
            <h3><i class="fas fa-graduation-cap"></i> Education</h3>
            <div class="timeline">
              @for (edu of education(); track edu.id) {
                <div class="timeline-item" [class.current]="edu.current">
                  <div class="timeline-marker"></div>
                  <div class="timeline-content">
                    <div class="timeline-header">
                      <h4>{{ edu.title }}</h4>
                      <span class="timeline-date">{{ edu.period }}</span>
                    </div>
                    <h5>{{ edu.institution }}</h5>
                    <p>{{ edu.description }}</p>
                    @if (edu.skills && edu.skills.length > 0) {
                      <div class="tech-tags">
                        @for (skill of edu.skills; track skill) {
                          <span class="tech-tag">{{ skill }}</span>
                        }
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </section>

          <!-- Skills -->
          <section class="cv-section">
            <h3><i class="fas fa-code"></i> Technical Skills</h3>
            <div class="skills-grid">
              @for (category of skills(); track category.category) {
                <div class="skill-category">
                  <h4>{{ category.category }}</h4>
                  <div class="skill-items">
                    @for (skill of category.items; track skill.name) {
                      <div class="skill-item">
                        <span class="skill-name">{{ skill.name }}</span>
                        <div class="skill-bar">
                          <div
                            class="skill-progress"
                            [style.width.%]="skill.level"
                          ></div>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </section>

          <!-- Languages -->
          <section class="cv-section">
            <h3><i class="fas fa-language"></i> Languages</h3>
            <div class="languages">
              <div class="language-item">
                <span class="language-name">Polish</span>
                <span class="language-level">Native</span>
              </div>
              <div class="language-item">
                <span class="language-name">English</span>
                <span class="language-level">Professional</span>
              </div>
            </div>
          </section>
        </div>

        <!-- CV Preview Section -->
        <section class="cv-preview-section">
          <h3>CV Preview</h3>
          <div class="cv-preview-tabs">
            <button
              class="tab-btn"
              [class.active]="currentLang() === 'en'"
              (click)="switchLanguage('en')"
            >
              English Version
            </button>
            <button
              class="tab-btn"
              [class.active]="currentLang() === 'pl'"
              (click)="switchLanguage('pl')"
            >
              Polish Version
            </button>
          </div>
          <div class="cv-preview-container">
            @if (currentLang() === 'en') {
              <div class="cv-slides">
                <img src="/cv_en/Slide1.PNG" alt="CV Page 1" class="cv-slide" />
                <img src="/cv_en/Slide2.PNG" alt="CV Page 2" class="cv-slide" />
              </div>
            } @else {
              <div class="cv-slides">
                <img
                  src="/cv_pl/Slide1.PNG"
                  alt="CV Strona 1"
                  class="cv-slide"
                />
                <img
                  src="/cv_pl/Slide2.PNG"
                  alt="CV Strona 2"
                  class="cv-slide"
                />
              </div>
            }
          </div>
        </section>
      </div>
    </div>

    <app-footer />
    <app-back-to-top />
  `,
  styles: [
    `
      .cv-page {
        min-height: 100vh;
        padding: 100px 0 50px;
        background: var(--bg-primary);
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 20px;
      }

      .cv-header {
        background: var(--bg-secondary);
        border-radius: 12px;
        padding: 40px;
        margin-bottom: 40px;
      }

      .profile-section {
        display: flex;
        align-items: center;
        gap: 40px;
        margin-bottom: 30px;
      }

      .profile-image {
        width: 150px;
        height: 150px;
        border-radius: 50%;
        object-fit: cover;
        border: 4px solid var(--color-primary);
      }

      .profile-info h1 {
        font-size: 2.5rem;
        margin-bottom: 10px;
        color: var(--color-primary);
        font-weight: 700;
      }

      .profile-info h2 {
        font-size: 1.5rem;
        color: var(--text-secondary);
        margin-bottom: 20px;
      }

      .contact-info {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
      }

      .contact-info a {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--text-primary);
        text-decoration: none;
        transition: color 0.3s ease;
      }

      .contact-info a:hover {
        color: var(--color-primary);
      }

      .cv-actions {
        display: flex;
        gap: 15px;
        flex-wrap: wrap;
      }

      .btn-action {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 12px 24px;
        background: var(--bg-primary);
        color: var(--text-primary);
        border: 2px solid var(--border-color);
        border-radius: 8px;
        text-decoration: none;
        cursor: pointer;
        transition: all 0.3s ease;
        font-size: 1rem;
      }

      .btn-action:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
      }

      .btn-action.btn-primary {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .cv-content {
        background: var(--bg-secondary);
        border-radius: 12px;
        padding: 40px;
        margin-bottom: 40px;
      }

      .cv-section {
        margin-bottom: 50px;
      }

      .cv-section:last-child {
        margin-bottom: 0;
      }

      .cv-section h3 {
        font-size: 1.8rem;
        margin-bottom: 30px;
        display: flex;
        align-items: center;
        gap: 15px;
        color: var(--text-primary);
        border-bottom: 2px solid var(--border-color);
        padding-bottom: 10px;
      }

      .cv-section h3 i {
        color: var(--color-primary);
      }

      .timeline {
        position: relative;
        padding-left: 40px;
      }

      .timeline::before {
        content: '';
        position: absolute;
        left: 10px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: var(--border-color);
      }

      .timeline-item {
        position: relative;
        margin-bottom: 30px;
      }

      .timeline-marker {
        position: absolute;
        left: -35px;
        top: 5px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--bg-secondary);
        border: 3px solid var(--color-primary);
      }

      .timeline-item.current .timeline-marker {
        background: var(--color-primary);
        box-shadow: 0 0 0 5px rgba(0, 112, 243, 0.2);
      }

      .timeline-content {
        background: var(--bg-primary);
        padding: 20px;
        border-radius: 8px;
      }

      .timeline-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }

      .timeline-header h4 {
        font-size: 1.2rem;
        color: var(--text-primary);
      }

      .timeline-date {
        color: var(--color-primary);
        font-weight: 500;
      }

      .timeline-content h5 {
        color: var(--text-secondary);
        margin-bottom: 15px;
      }

      .tech-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 15px;
      }

      .tech-tag {
        padding: 5px 12px;
        background: var(--bg-secondary);
        border-radius: 20px;
        font-size: 0.85rem;
        color: var(--text-primary);
      }

      .skills-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 30px;
      }

      .skill-category h4 {
        font-size: 1.1rem;
        margin-bottom: 20px;
        color: var(--color-primary);
      }

      .skill-item {
        margin-bottom: 15px;
      }

      .skill-name {
        display: block;
        margin-bottom: 8px;
        font-size: 0.95rem;
        color: var(--text-primary);
      }

      .skill-bar {
        height: 8px;
        background: var(--bg-primary);
        border-radius: 4px;
        overflow: hidden;
      }

      .skill-progress {
        height: 100%;
        background: linear-gradient(
          90deg,
          var(--color-primary),
          var(--color-secondary)
        );
        border-radius: 4px;
        transition: width 1s ease;
      }

      .languages {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
      }

      .language-item {
        display: flex;
        justify-content: space-between;
        padding: 15px;
        background: var(--bg-primary);
        border-radius: 8px;
      }

      .language-name {
        font-weight: 500;
        color: var(--text-primary);
      }

      .language-level {
        color: var(--color-primary);
      }

      .cv-preview-section {
        background: var(--bg-secondary);
        border-radius: 12px;
        padding: 40px;
      }

      .cv-preview-section h3 {
        font-size: 1.8rem;
        margin-bottom: 30px;
        text-align: center;
      }

      .cv-preview-tabs {
        display: flex;
        justify-content: center;
        gap: 15px;
        margin-bottom: 30px;
      }

      .tab-btn {
        padding: 12px 30px;
        background: var(--bg-primary);
        color: var(--text-primary);
        border: 2px solid var(--border-color);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        font-size: 1rem;
      }

      .tab-btn.active {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .cv-preview-container {
        background: var(--bg-primary);
        border-radius: 8px;
        padding: 20px;
      }

      .cv-slides {
        display: grid;
        gap: 20px;
      }

      .cv-slide {
        width: 100%;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
      }

      @media (max-width: 768px) {
        .profile-section {
          flex-direction: column;
          text-align: center;
        }

        .profile-info h1 {
          font-size: 2rem;
        }

        .cv-actions {
          justify-content: center;
        }

        .timeline {
          padding-left: 20px;
        }

        .timeline-marker {
          left: -26px;
        }

        .skills-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class CvPageComponent implements OnInit {
  private dataService = inject(DataService);
  private languageService = inject(LanguageService);

  experience = signal<Experience[]>([]);
  education = signal<Education[]>([]);
  skills = signal<SkillCategory[]>([]);
  currentLang = signal<'en' | 'pl'>('en');

  ngOnInit() {
    this.loadData();
    this.currentLang.set(this.languageService.currentLanguage() as 'en' | 'pl');
  }

  private loadData() {
    this.dataService.getExperience().subscribe((exp) => {
      this.experience.set(exp);
    });

    this.dataService.getEducation().subscribe((edu) => {
      this.education.set(edu);
    });

    this.dataService.getSkills().subscribe((skills) => {
      this.skills.set(skills);
    });
  }

  switchLanguage(lang: 'en' | 'pl') {
    this.currentLang.set(lang);
  }

  downloadCV() {
    const cvUrl = this.currentLang() === 'en' ? '/cv_en.pdf' : '/cv_pl.pdf';
    window.open(cvUrl, '_blank');
  }
}
