import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../core/services/language.service';

interface Project {
  title: string;
  description: string;
  imageSrc: string;
  tags: string[];
  projectLink: string;
  codeLink: string;
}

@Component({
  selector: 'app-projects-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="projects" class="projects-section section">
      <div class="container">
        <div class="section-header animate-on-scroll">
          <h2 class="section-title">{{ t('projects.title') }}</h2>
          <p class="section-subtitle">{{ t('projects.subtitle') }}</p>
        </div>

        <!-- Filter Tags -->
        <div class="filter-container animate-on-scroll">
          <button
            class="filter-tag"
            [class.active]="selectedTag() === 'all'"
            (click)="filterByTag('all')"
          >
            {{ t('projects.filter.all') }}
          </button>
          @for (tag of allTags(); track tag) {
            <button
              class="filter-tag"
              [class.active]="selectedTag() === tag"
              (click)="filterByTag(tag)"
            >
              {{ tag }}
            </button>
          }
        </div>

        <!-- Projects Grid -->
        <div class="projects-grid">
          @for (project of filteredProjects(); track project.title) {
            <div
              class="project-card animate-on-scroll"
              [style.animation-delay.s]="$index * 0.1"
            >
              <div class="project-image">
                <img
                  [src]="project.imageSrc"
                  [alt]="project.title"
                  loading="lazy"
                  (error)="onImageError($event)"
                />
                <div class="project-overlay">
                  <div class="project-links">
                    @if (project.projectLink) {
                      <a
                        [href]="project.projectLink"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="project-link"
                        [attr.aria-label]="'View ' + project.title + ' live'"
                      >
                        <i class="fas fa-external-link-alt"></i>
                      </a>
                    }
                    @if (project.codeLink) {
                      <a
                        [href]="project.codeLink"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="project-link"
                        [attr.aria-label]="'View ' + project.title + ' code'"
                      >
                        <i class="fab fa-github"></i>
                      </a>
                    }
                  </div>
                </div>
              </div>

              <div class="project-content">
                <h3 class="project-title">{{ project.title }}</h3>
                <p class="project-description">{{ project.description }}</p>

                <div class="project-tags">
                  @for (tag of project.tags; track tag) {
                    <span class="project-tag">{{ tag }}</span>
                  }
                </div>
              </div>
            </div>
          }
        </div>

        @if (filteredProjects().length === 0) {
          <div class="no-projects animate-on-scroll">
            <i class="fas fa-folder-open"></i>
            <p>{{ t('projects.noProjects') }}</p>
          </div>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .projects-section {
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
      }

      .section-subtitle {
        font-size: 1.125rem;
        color: var(--text-secondary);
        max-width: 600px;
        margin: 0 auto;
      }

      /* Filter Container */
      .filter-container {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-bottom: 3rem;
      }

      .filter-tag {
        padding: 0.5rem 1rem;
        background: var(--bg-primary);
        border: 2px solid transparent;
        border-radius: var(--radius-full);
        color: var(--text-secondary);
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: all var(--transition-base) ease;
      }

      .filter-tag:hover {
        background: var(--bg-tertiary);
        transform: translateY(-2px);
      }

      .filter-tag.active {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      /* Projects Grid */
      .projects-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        gap: 2rem;
      }

      .project-card {
        background: var(--bg-primary);
        border-radius: var(--radius-lg);
        overflow: hidden;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        transition:
          transform var(--transition-base) ease,
          box-shadow var(--transition-base) ease;
      }

      .project-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
      }

      /* Project Image */
      .project-image {
        position: relative;
        height: 250px;
        overflow: hidden;
        background: var(--bg-tertiary);
      }

      .project-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform var(--transition-base) ease;
      }

      .project-card:hover .project-image img {
        transform: scale(1.05);
      }

      .project-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity var(--transition-base) ease;
      }

      .project-card:hover .project-overlay {
        opacity: 1;
      }

      .project-links {
        display: flex;
        gap: 1rem;
      }

      .project-link {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 3rem;
        height: 3rem;
        background: var(--color-primary);
        color: white;
        border-radius: var(--radius-full);
        text-decoration: none;
        transition:
          transform var(--transition-base) ease,
          background var(--transition-base) ease;
      }

      .project-link:hover {
        transform: scale(1.1);
        background: var(--color-primary-dark);
      }

      .project-link i {
        font-size: 1.25rem;
      }

      /* Project Content */
      .project-content {
        padding: 1.5rem;
      }

      .project-title {
        font-size: 1.25rem;
        margin-bottom: 0.75rem;
        color: var(--text-primary);
      }

      .project-description {
        font-size: 0.95rem;
        line-height: 1.6;
        color: var(--text-secondary);
        margin-bottom: 1rem;
      }

      .project-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .project-tag {
        padding: 0.25rem 0.75rem;
        background: var(--bg-tertiary);
        border-radius: var(--radius-full);
        font-size: 0.85rem;
        color: var(--text-secondary);
      }

      /* No Projects */
      .no-projects {
        text-align: center;
        padding: 3rem;
        color: var(--text-tertiary);
      }

      .no-projects i {
        font-size: 3rem;
        margin-bottom: 1rem;
        opacity: 0.5;
      }

      /* Mobile */
      @media (max-width: 768px) {
        .projects-section {
          padding: 3rem 0;
        }

        .filter-container {
          gap: 0.5rem;
        }

        .filter-tag {
          padding: 0.4rem 0.8rem;
          font-size: 0.85rem;
        }

        .projects-grid {
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }

        .project-image {
          height: 200px;
        }
      }
    `,
  ],
})
export class ProjectsSectionComponent {
  constructor(private languageService: LanguageService) {}

  t(key: string): string {
    return this.languageService.t(key);
  }

  // Selected filter tag
  selectedTag = signal<string>('all');

  // Projects data
  projects = signal<Project[]>([
    {
      title: 'Analytical automation decision support system for healthcare',
      description:
        'A comprehensive system for healthcare analytics with features including user preset saving, automated analysis, appointment scheduling with payment integration, and optimized database performance.',
      imageSrc: 'assets/images/projects/healthcare-analytics.jpg',
      tags: [
        'Java',
        'Spring Boot',
        'React',
        'TypeScript',
        'PostgreSQL',
        'Azure',
        'Docker',
        'Kubernetes',
      ],
      projectLink: '',
      codeLink: 'https://github.com/guziczak',
    },
    {
      title: 'Resource management system for telecommunications platform',
      description:
        'A sophisticated platform for managing resources in advanced telecommunications systems, with features for resource allocation, monitoring, and optimization.',
      imageSrc: 'assets/images/projects/telecom-resource.jpg',
      tags: [
        'Java',
        'Angular',
        'Spring Boot',
        'Microservices',
        'AWS',
        'REST APIs',
      ],
      projectLink: '',
      codeLink: 'https://github.com/guziczak',
    },
    {
      title: 'ERP system for payments, accounting and payroll',
      description:
        'A modern ERP solution with fiscal printer integration, exception management with automated notifications, and label printer integration for inventory management.',
      imageSrc: 'assets/images/projects/erp-system.jpg',
      tags: [
        'Java',
        'Spring',
        'React',
        'TypeScript',
        'Microservices',
        'REST APIs',
      ],
      projectLink: '',
      codeLink: 'https://github.com/guziczak',
    },
  ]);

  // Get all unique tags
  allTags = computed(() => {
    const tags = new Set<string>();
    this.projects().forEach((project) => {
      project.tags.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  });

  // Filter projects by tag
  filteredProjects = computed(() => {
    const tag = this.selectedTag();
    if (tag === 'all') {
      return this.projects();
    }
    return this.projects().filter((project) => project.tags.includes(tag));
  });

  // Set filter tag
  filterByTag(tag: string): void {
    this.selectedTag.set(tag);
  }

  // Handle image error
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    // Use a data URL for placeholder to avoid 404
    img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"%3E%3Crect fill="%23f3f4f6" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-family="system-ui" font-size="20"%3EProject Image%3C/text%3E%3C/svg%3E';
    // Remove the error handler to prevent infinite loop
    img.onerror = null;
  }
}
