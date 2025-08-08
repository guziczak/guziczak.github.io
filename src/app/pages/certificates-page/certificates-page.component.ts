import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataService, Certificate } from '../../core/services/data.service';
import { NavigationComponent } from '../../layout/navigation/navigation.component';
import { FooterComponent } from '../../layout/footer/footer.component';
import { ScrollProgressComponent } from '../../shared/ui/scroll-progress/scroll-progress.component';
import { BackToTopComponent } from '../../shared/ui/back-to-top/back-to-top.component';

@Component({
  selector: 'app-certificates-page',
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

    <div class="certificates-page">
      <div class="container">
        <header class="page-header">
          <h1>My Certificates</h1>
          <p>Professional certifications and achievements</p>
          <div class="header-actions">
            <a routerLink="/" class="btn-back">
              <i class="fas fa-arrow-left"></i>
              Back to Portfolio
            </a>
            <span class="certificate-count">
              {{ certificates().length }} Certificates
            </span>
          </div>
        </header>

        <div class="filters">
          <button
            class="filter-btn"
            [class.active]="selectedCategory() === 'all'"
            (click)="filterByCategory('all')"
          >
            All
          </button>
          @for (category of categories(); track category) {
            <button
              class="filter-btn"
              [class.active]="selectedCategory() === category"
              (click)="filterByCategory(category)"
            >
              {{ category }}
            </button>
          }
        </div>

        <div class="certificates-grid">
          @for (cert of filteredCertificates(); track cert.id) {
            <div
              class="certificate-card animate-on-scroll"
              [attr.data-category]="cert.category"
            >
              <div class="certificate-header">
                @if (cert.logo) {
                  <img
                    [src]="cert.logo"
                    [alt]="cert.issuer"
                    class="certificate-logo"
                  />
                }
                <div class="certificate-info">
                  <h3>{{ cert.name }}</h3>
                  <p class="issuer">{{ cert.issuer }}</p>
                  <p class="date">{{ cert.date }}</p>
                </div>
              </div>

              @if (cert.credential) {
                <div class="credential">
                  <span class="credential-label">Credential ID:</span>
                  <span class="credential-value">{{ cert.credential }}</span>
                </div>
              }

              @if (cert.skills && cert.skills.length > 0) {
                <div class="skills">
                  @for (skill of cert.skills; track skill) {
                    <span class="skill-tag">{{ skill }}</span>
                  }
                </div>
              }

              <div class="certificate-category">
                <span class="category-badge">{{ cert.category }}</span>
              </div>
            </div>
          }
        </div>
      </div>
    </div>

    <app-footer />
    <app-back-to-top />
  `,
  styles: [
    `
      .certificates-page {
        min-height: 100vh;
        padding: 100px 0 50px;
        background: var(--bg-primary);
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 20px;
      }

      .page-header {
        text-align: center;
        margin-bottom: 50px;
      }

      .page-header h1 {
        font-size: 3rem;
        font-weight: 700;
        margin-bottom: 10px;
        color: var(--color-primary);
      }

      .page-header p {
        font-size: 1.2rem;
        color: var(--text-secondary);
      }

      .header-actions {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 30px;
        margin-top: 30px;
      }

      .btn-back {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 12px 24px;
        background: var(--color-primary);
        color: white;
        border-radius: 8px;
        text-decoration: none;
        transition: all 0.3s ease;
      }

      .btn-back:hover {
        transform: translateX(-5px);
        box-shadow: 0 5px 15px rgba(0, 112, 243, 0.3);
      }

      .certificate-count {
        padding: 12px 24px;
        background: var(--bg-secondary);
        border-radius: 8px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .filters {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 15px;
        margin-bottom: 50px;
      }

      .filter-btn {
        padding: 10px 20px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        border: 2px solid transparent;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        font-weight: 500;
      }

      .filter-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
      }

      .filter-btn.active {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .certificates-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        gap: 30px;
      }

      .certificate-card {
        background: var(--bg-secondary);
        border-radius: 12px;
        padding: 25px;
        transition: all 0.3s ease;
        border: 1px solid var(--border-color);
      }

      .certificate-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      }

      .certificate-header {
        display: flex;
        gap: 20px;
        margin-bottom: 20px;
      }

      .certificate-logo {
        width: 60px;
        height: 60px;
        object-fit: contain;
        border-radius: 8px;
        padding: 5px;
        background: var(--bg-primary);
      }

      .certificate-info h3 {
        font-size: 1.2rem;
        margin-bottom: 5px;
        color: var(--text-primary);
      }

      .issuer {
        color: var(--color-primary);
        font-weight: 500;
        margin-bottom: 3px;
      }

      .date {
        color: var(--text-secondary);
        font-size: 0.9rem;
      }

      .credential {
        padding: 10px;
        background: var(--bg-primary);
        border-radius: 6px;
        margin-bottom: 15px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .credential-label {
        color: var(--text-secondary);
        font-size: 0.9rem;
      }

      .credential-value {
        font-family: monospace;
        color: var(--text-primary);
        font-weight: 500;
      }

      .skills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 15px;
      }

      .skill-tag {
        padding: 5px 12px;
        background: var(--bg-primary);
        border-radius: 20px;
        font-size: 0.85rem;
        color: var(--text-primary);
      }

      .category-badge {
        display: inline-block;
        padding: 6px 16px;
        background: linear-gradient(
          135deg,
          var(--color-primary),
          var(--color-secondary)
        );
        color: white;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 500;
      }

      .animate-on-scroll {
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.5s ease;
      }

      .animate-on-scroll.visible {
        opacity: 1;
        transform: translateY(0);
      }

      @media (max-width: 768px) {
        .page-header h1 {
          font-size: 2rem;
        }

        .certificates-grid {
          grid-template-columns: 1fr;
        }

        .header-actions {
          flex-direction: column;
          gap: 15px;
        }
      }
    `,
  ],
})
export class CertificatesPageComponent implements OnInit {
  private dataService = inject(DataService);

  certificates = signal<Certificate[]>([]);
  filteredCertificates = signal<Certificate[]>([]);
  categories = signal<string[]>([]);
  selectedCategory = signal<string>('all');

  ngOnInit() {
    this.loadCertificates();
    this.setupScrollAnimations();
  }

  private loadCertificates() {
    this.dataService.getCertificates().subscribe((certs) => {
      this.certificates.set(certs);
      this.filteredCertificates.set(certs);

      // Extract unique categories
      const uniqueCategories = [...new Set(certs.map((c) => c.category))];
      this.categories.set(uniqueCategories);
    });
  }

  filterByCategory(category: string) {
    this.selectedCategory.set(category);

    if (category === 'all') {
      this.filteredCertificates.set(this.certificates());
    } else {
      const filtered = this.certificates().filter(
        (cert) => cert.category === category,
      );
      this.filteredCertificates.set(filtered);
    }
  }

  private setupScrollAnimations() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 },
    );

    setTimeout(() => {
      document.querySelectorAll('.animate-on-scroll').forEach((el) => {
        observer.observe(el);
      });
    }, 100);
  }
}
