import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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
              <h2>AI Engineer</h2>
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

        <!-- CV Preview Section — surfaced first so recruiters see the CV immediately.
             Language follows the global LanguageService (nav dropdown). -->
        <section class="cv-preview-section cv-preview-section--top">
          <div class="cv-preview-container">
            <div class="cv-iframe-wrapper">
              <iframe
                [src]="cvIframeUrl()"
                class="cv-iframe"
                title="CV"
              ></iframe>
            </div>
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

      .cv-preview-section--top {
        margin-bottom: 40px;
      }

      .cv-preview-section h3 {
        font-size: 1.8rem;
        margin-bottom: 30px;
        text-align: center;
      }

      .cv-content__header {
        font-size: 1.4rem;
        margin-bottom: 30px;
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        gap: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
      }

      .cv-content__header i {
        color: var(--color-primary);
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

      .cv-iframe-wrapper {
        position: relative;
        width: 100%;
        max-width: 794px;
        margin: 0 auto;
        aspect-ratio: 794 / 2246;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        background: white;
      }

      .cv-iframe {
        width: 100%;
        height: 100%;
        border: 0;
        display: block;
      }

      @media (max-width: 820px) {
        .cv-iframe-wrapper {
          max-width: 100%;
        }
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
  private sanitizer = inject(DomSanitizer);

  experience = signal<Experience[]>([]);
  education = signal<Education[]>([]);
  skills = signal<SkillCategory[]>([]);

  // Reactive: follows the global language (en/pl/de) from LanguageService
  currentLang = this.languageService.currentLanguage;

  private static readonly CV_HTML_BY_LANG: Record<string, string> = {
    en: '/cv-html/cv_fixed.html',
    pl: '/cv-html/cv_fixed_pl.html',
    de: '/cv-html/cv_fixed_de.html',
  };

  private static readonly CV_PDF_BY_LANG: Record<string, string> = {
    en: '/cv_en.pdf',
    pl: '/cv_pl.pdf',
    de: '/cv_de.pdf',
  };

  cvIframeUrl = computed<SafeResourceUrl>(() => {
    const path =
      CvPageComponent.CV_HTML_BY_LANG[this.currentLang()] ??
      CvPageComponent.CV_HTML_BY_LANG['en'];
    return this.sanitizer.bypassSecurityTrustResourceUrl(path);
  });

  ngOnInit() {
    this.loadData();
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

  downloadCV() {
    const url =
      CvPageComponent.CV_PDF_BY_LANG[this.currentLang()] ??
      CvPageComponent.CV_PDF_BY_LANG['en'];
    window.open(url, '_blank');
  }
}
