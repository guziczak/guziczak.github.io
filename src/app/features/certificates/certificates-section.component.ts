import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../core/services/language.service';

interface Certificate {
  name: string;
  issuer: string;
  date: string;
  credential: string;
  skills: string[];
  category: string;
  logo: string;
}

@Component({
  selector: 'app-certificates-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="certificates" class="certificates-section section">
      <div class="container">
        <div class="section-header animate-on-scroll">
          <h2 class="section-title">{{ t('certificates.title') }}</h2>
          <p class="section-subtitle">{{ t('certificates.subtitle') }}</p>
        </div>

        <!-- Category Filter -->
        <div class="category-filter animate-on-scroll">
          <button
            class="filter-button"
            [class.active]="selectedCategory() === 'all'"
            (click)="filterByCategory('all')"
          >
            {{ t('certificates.filter.all') }}
          </button>
          @for (category of categories(); track category) {
            <button
              class="filter-button"
              [class.active]="selectedCategory() === category"
              (click)="filterByCategory(category)"
            >
              {{ category }}
            </button>
          }
        </div>

        <!-- Certificates Grid -->
        <div class="certificates-grid">
          @for (cert of filteredCertificates(); track cert.name) {
            <div
              class="certificate-card animate-on-scroll"
              [style.animation-delay.s]="$index * 0.1"
              (click)="viewCertificate(cert)"
            >
              <div class="certificate-header">
                <div class="issuer-logo">
                  <img
                    [src]="cert.logo"
                    [alt]="cert.issuer"
                    loading="lazy"
                    (error)="onLogoError($event)"
                  />
                </div>
                <div class="certificate-meta">
                  <span class="certificate-date">
                    <i class="far fa-calendar"></i>
                    {{ cert.date }}
                  </span>
                  <span class="certificate-category">{{ cert.category }}</span>
                </div>
              </div>

              <div class="certificate-body">
                <h3 class="certificate-name">{{ cert.name }}</h3>
                <p class="certificate-issuer">{{ cert.issuer }}</p>

                @if (cert.credential) {
                  <div class="credential-id">
                    <i class="fas fa-certificate"></i>
                    <span
                      >{{ t('certificates.credential') }}:
                      {{ cert.credential }}</span
                    >
                  </div>
                }

                <div class="certificate-skills">
                  @for (skill of cert.skills; track skill) {
                    <span class="skill-tag">{{ skill }}</span>
                  }
                </div>
              </div>

              <div class="certificate-footer">
                <button class="view-button">
                  <i class="fas fa-eye"></i>
                  {{ t('certificates.view') }}
                </button>
              </div>
            </div>
          }
        </div>

        @if (filteredCertificates().length === 0) {
          <div class="no-certificates animate-on-scroll">
            <i class="fas fa-award"></i>
            <p>{{ t('certificates.noCertificates') }}</p>
          </div>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .certificates-section {
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

      /* Category Filter */
      .category-filter {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-bottom: 3rem;
      }

      .filter-button {
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

      .filter-button:hover {
        background: var(--bg-tertiary);
        transform: translateY(-2px);
      }

      .filter-button.active {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      /* Certificates Grid */
      .certificates-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
        gap: 2rem;
      }

      .certificate-card {
        background: var(--bg-primary);
        border-radius: var(--radius-lg);
        overflow: hidden;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        cursor: pointer;
        transition:
          transform var(--transition-base) ease,
          box-shadow var(--transition-base) ease;
      }

      .certificate-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
      }

      /* Certificate Header */
      .certificate-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem 1.5rem 0;
        margin-bottom: 1rem;
      }

      .issuer-logo {
        width: 60px;
        height: 60px;
        background: var(--bg-secondary);
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .issuer-logo img {
        max-width: 80%;
        max-height: 80%;
        object-fit: contain;
      }

      .certificate-meta {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.25rem;
      }

      .certificate-date {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
        color: var(--text-tertiary);
      }

      .certificate-category {
        font-size: 0.85rem;
        color: var(--color-primary);
        font-weight: 500;
      }

      /* Certificate Body */
      .certificate-body {
        padding: 0 1.5rem;
      }

      .certificate-name {
        font-size: 1.25rem;
        margin-bottom: 0.5rem;
        color: var(--text-primary);
        line-height: 1.3;
      }

      .certificate-issuer {
        font-size: 1rem;
        color: var(--text-secondary);
        margin-bottom: 1rem;
      }

      .credential-id {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
        color: var(--text-tertiary);
        margin-bottom: 1rem;
      }

      .credential-id i {
        color: var(--color-primary);
      }

      .certificate-skills {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }

      .skill-tag {
        padding: 0.25rem 0.75rem;
        background: var(--bg-tertiary);
        border-radius: var(--radius-full);
        font-size: 0.8rem;
        color: var(--text-secondary);
      }

      /* Certificate Footer */
      .certificate-footer {
        padding: 0 1.5rem 1.5rem;
      }

      .view-button {
        width: 100%;
        padding: 0.75rem;
        background: var(--color-primary);
        color: white;
        border: none;
        border-radius: var(--radius-md);
        font-weight: 500;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        cursor: pointer;
        transition: all var(--transition-base) ease;
      }

      .view-button:hover {
        background: var(--color-primary-dark);
        transform: translateY(-2px);
      }

      .view-button i {
        font-size: 1rem;
      }

      /* No Certificates */
      .no-certificates {
        text-align: center;
        padding: 3rem;
        color: var(--text-tertiary);
      }

      .no-certificates i {
        font-size: 3rem;
        margin-bottom: 1rem;
        opacity: 0.5;
      }

      /* Mobile */
      @media (max-width: 768px) {
        .certificates-section {
          padding: 3rem 0;
        }

        .category-filter {
          gap: 0.5rem;
        }

        .filter-button {
          padding: 0.4rem 0.8rem;
          font-size: 0.85rem;
        }

        .certificates-grid {
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }
      }
    `,
  ],
})
export class CertificatesSectionComponent {
  constructor(private languageService: LanguageService) {}

  t(key: string): string {
    return this.languageService.t(key);
  }

  // Selected category
  selectedCategory = signal<string>('all');

  // Certificates data
  certificates = signal<Certificate[]>([
    {
      name: 'Web Applications with AngularJS',
      issuer: 'The Johns Hopkins University',
      date: 'Jun 2024',
      credential: 'MNTRXU6AZV6U',
      skills: ['AngularJS', 'JavaScript', 'CSS', 'HTML'],
      category: 'Web Development',
      logo: 'assets/images/certificates/johns-hopkins.png',
    },
    {
      name: 'Foundations: Data, Data, Everywhere',
      issuer: 'Google',
      date: 'Jan 2023',
      credential: '9APHJHP9KE9H',
      skills: ['Data Analysis'],
      category: 'Data Science',
      logo: 'assets/images/certificates/google.png',
    },
    {
      name: 'Machine Learning',
      issuer: 'Stanford University',
      date: 'Aug 2022',
      credential: 'W88ME7FTDEJH',
      skills: ['Machine Learning'],
      category: 'Artificial Intelligence',
      logo: 'assets/images/certificates/stanford.png',
    },
    {
      name: 'Luxoft Java Academy',
      issuer: 'Luxoft',
      date: 'Aug 2022',
      credential: '',
      skills: ['Java', 'Spring Framework'],
      category: 'Software Development',
      logo: 'assets/images/certificates/luxoft.png',
    },
    {
      name: 'EAS-026 Kafka Fundamentals',
      issuer: 'Luxoft',
      date: 'May 2022',
      credential: '',
      skills: ['Kafka', 'Messaging', 'Distributed Systems'],
      category: 'Software Development',
      logo: 'assets/images/certificates/luxoft.png',
    },
    {
      name: 'Java Programming Masterclass',
      issuer: 'Udemy',
      date: 'Dec 2021',
      credential: 'UC-fbb8c104-5f3d-405a-8644-3b6e7b8d1657',
      skills: ['Java', 'OOP'],
      category: 'Programming',
      logo: 'assets/images/certificates/udemy.png',
    },
  ]);

  // Get unique categories
  categories = computed(() => {
    const cats = new Set<string>();
    this.certificates().forEach((cert) => cats.add(cert.category));
    return Array.from(cats).sort();
  });

  // Filter certificates by category
  filteredCertificates = computed(() => {
    const category = this.selectedCategory();
    if (category === 'all') {
      return this.certificates();
    }
    return this.certificates().filter((cert) => cert.category === category);
  });

  // Set category filter
  filterByCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  // View certificate (could open modal or external link)
  viewCertificate(cert: Certificate): void {
    // For now, just log. In real app, open modal or navigate to certificate
    console.log('View certificate:', cert);
  }

  // Handle logo error
  onLogoError(event: Event): void {
    const img = event.target as HTMLImageElement;
    // Use a data URL for default logo to avoid 404 and infinite loop
    img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"%3E%3Crect fill="%23f3f4f6" width="60" height="60" rx="8"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-family="system-ui" font-size="24"%3E%3F%3C/text%3E%3C/svg%3E';
    // Remove the error handler to prevent infinite loop
    img.onerror = null;
  }
}
