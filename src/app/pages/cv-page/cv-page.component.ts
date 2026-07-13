import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';
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
import { ScrollProgressComponent } from '../../shared/ui/scroll-progress/scroll-progress.component';
import { BackToTopComponent } from '../../shared/ui/back-to-top/back-to-top.component';
import { LanguageService } from '../../core/services/language.service';
import {
  createSwiatlo,
  loadSwiatloScore,
  SwiatloPlayer,
} from '../../features/home/swiatlo-player';
import {
  loadHandoff,
  saveHandoff,
  swiatloBus,
} from '../../features/home/swiatlo-sync';

@Component({
  selector: 'app-cv-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ScrollProgressComponent,
    BackToTopComponent,
  ],
  template: `
    <app-scroll-progress />

    <div class="cv-page">
      <div class="container">
        <header class="cv-header">
          <div class="profile-section">
            <img
              src="/cv-html/assets/photo_optimized.jpg"
              alt="Łukasz Guziczak"
              class="profile-image"
            />
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
            <div class="cv-iframe-wrapper" #cvWrapper>
              <iframe
                [src]="cvIframeUrl()"
                class="cv-iframe"
                title="CV"
                (load)="onCvFrameLoad()"
                #cvFrame
              ></iframe>
            </div>
          </div>
        </section>
      </div>
    </div>

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
        box-sizing: border-box;
        width: 100%;
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

      .profile-info {
        min-width: 0;
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
        min-height: 200px;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        background: white;
      }

      .cv-iframe {
        width: 794px;
        height: 1123px;
        border: 0;
        display: block;
        transform-origin: top left;
      }

      @media (max-width: 820px) {
        .cv-iframe-wrapper {
          max-width: 100%;
        }
      }

      @media (max-width: 768px) {
        .cv-page {
          padding: 76px 0 24px;
        }

        .container {
          padding: 0 12px;
        }

        .cv-header {
          padding: 24px 18px;
          margin-bottom: 20px;
          overflow: hidden;
        }

        .profile-section {
          flex-direction: column;
          gap: 20px;
          margin-bottom: 24px;
          text-align: center;
        }

        .profile-image {
          width: 116px;
          height: 116px;
        }

        .profile-info {
          width: 100%;
        }

        .profile-info h1 {
          font-size: clamp(1.7rem, 9vw, 2rem);
          overflow-wrap: anywhere;
        }

        .profile-info h2 {
          font-size: 1.25rem;
        }

        .contact-info {
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .cv-actions {
          display: grid;
          grid-template-columns: 1fr;
          width: 100%;
          gap: 10px;
        }

        .btn-action {
          box-sizing: border-box;
          justify-content: center;
          width: 100%;
          padding: 11px 14px;
        }

        .cv-preview-section {
          padding: 0;
          background: transparent;
        }

        .cv-preview-section--top {
          margin-bottom: 20px;
        }

        .cv-preview-container {
          padding: 0;
          overflow: hidden;
        }

        .cv-iframe-wrapper {
          border-radius: 6px;
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
export class CvPageComponent implements OnInit, OnDestroy {
  private dataService = inject(DataService);
  private languageService = inject(LanguageService);
  private sanitizer = inject(DomSanitizer);

  // The bell, handed off from the portfolio tab — continues here from the same position.
  private player: SwiatloPlayer | null = null;
  private notes: number[][] | null = null;
  private bus?: { claim: () => void; close: () => void };
  private removeKick?: () => void;
  private removeIframeKick?: () => void;
  private musicSaveTimer?: ReturnType<typeof setInterval>;
  private iframeMusicButton: HTMLButtonElement | null = null;
  private readonly iframeMusicClick = (event: Event) => {
    event.preventDefault();
    this.toggleMusicFromIframe();
  };
  private readonly handoffKick = (event?: Event) => {
    const target = event?.target as HTMLElement | null;
    if (target?.closest?.('.cover__music')) return;
    if (!this.notes || this.player?.isPlaying()) return;
    const handoff = loadHandoff();
    if (!handoff?.playing) return;
    this.ensurePlayer()?.play(handoff.offset);
  };

  @ViewChild('cvFrame') private cvFrame?: ElementRef<HTMLIFrameElement>;
  @ViewChild('cvWrapper') private cvWrapper?: ElementRef<HTMLElement>;
  private static readonly CV_DOC_WIDTH = 794;
  private static readonly MUSIC_LEAD_IN_SEC = 6;
  private fitFrameId?: number;
  private fitGeneration = 0;

  experience = signal<Experience[]>([]);
  education = signal<Education[]>([]);
  skills = signal<SkillCategory[]>([]);

  // Reactive: follows the global language (en/pl/de) from LanguageService
  currentLang = this.languageService.currentLanguage;

  private static readonly CV_HTML_BY_LANG: Record<string, string> = {
    en: '/cv-html/cv_fixed.html?portfolio-embed=1',
    pl: '/cv-html/cv_fixed_pl.html?portfolio-embed=1',
    de: '/cv-html/cv_fixed_de.html?portfolio-embed=1',
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
    this.initBellHandoff();
  }

  ngOnDestroy(): void {
    if (this.fitFrameId !== undefined) {
      cancelAnimationFrame(this.fitFrameId);
      this.fitFrameId = undefined;
    }
    this.removeKick?.();
    this.unbindIframeMusicButton();
    this.stopMusicSave();
    this.bus?.close();
    this.player?.dispose();
    this.player = null;
  }

  // Continue "Lux in tenebris" here, from where the portfolio tab left it. A new tab can't
  // auto-play audio, so resume on the first gesture; only resume if the bell was actually playing.
  private initBellHandoff(): void {
    if (typeof window === 'undefined') return;
    this.bus = swiatloBus(() => {
      if (this.player?.isPlaying()) this.player.toggle(); // another tab took over → yield
    });
    loadSwiatloScore()
      .then((score) => {
        if (score) {
          this.notes = score.notes;
          this.updateIframeMusicAvailability();
        }
      })
      .catch(() => {});
    const evs = ['pointerup', 'touchend', 'click', 'keydown'];
    this.removeKick = () =>
      evs.forEach((ev) => document.removeEventListener(ev, this.handoffKick));
    evs.forEach((ev) =>
      document.addEventListener(ev, this.handoffKick, { passive: true }),
    );
  }

  /**
   * Both the cross-tab handoff and the button embedded in the CV iframe use this one canonical
   * player. Keeping the AudioContext in the Angular page also lets the existing cross-tab handoff
   * prevent two tabs from playing at once.
   */
  private ensurePlayer(): SwiatloPlayer | null {
    if (!this.notes) return null;
    if (!this.player) {
      this.player = createSwiatlo(this.notes, {
        onState: (on) => {
          this.updateIframeMusicState(on);
          if (on) {
            this.removeKick?.();
            this.removeIframeKick?.();
            this.bus?.claim();
            this.startMusicSave();
          } else {
            this.stopMusicSave();
            saveHandoff(this.player ? this.player.position() : 0, false);
          }
        },
        leadInSec: CvPageComponent.MUSIC_LEAD_IN_SEC,
      });
    }
    return this.player;
  }

  /** Runs synchronously in the iframe click gesture so WebKit can unlock the parent AudioContext. */
  private toggleMusicFromIframe(): void {
    const player = this.ensurePlayer();
    if (!player) return;
    if (player.isPlaying()) {
      player.toggle();
      return;
    }

    // Opening /cv from the playing portfolio should continue the same timeline. A normal,
    // standalone visit starts at the beginning, exactly like the portfolio's bell button.
    const handoff = loadHandoff();
    if (handoff?.playing) player.play(handoff.offset);
    else player.toggle();
  }

  private updateIframeMusicState(on: boolean): void {
    const button = this.iframeMusicButton;
    if (!button) return;
    button.classList.toggle('is-playing', on);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  private updateIframeMusicAvailability(): void {
    const button = this.iframeMusicButton;
    if (!button) return;
    button.disabled = !this.notes;
    button.setAttribute('aria-disabled', this.notes ? 'false' : 'true');
  }

  /**
   * The static CV still contains an anonymous legacy audio listener. Replacing the same-origin
   * button with a deep clone removes that listener before a reader can invoke it, while preserving
   * the complete visual and accessibility markup. The replacement calls the shared player above.
   */
  private bindIframeMusicButton(): void {
    this.unbindIframeMusicButton();
    const frame = this.cvFrame?.nativeElement;
    if (!frame) return;

    try {
      const doc = frame.contentDocument ?? frame.contentWindow?.document;
      if (!doc) return;
      this.bindIframeHandoff(doc);
      const legacyButton =
        doc?.querySelector<HTMLButtonElement>('.cover__music');
      if (!legacyButton) return;

      const button = legacyButton.cloneNode(true) as HTMLButtonElement;
      legacyButton.replaceWith(button);
      button.addEventListener('click', this.iframeMusicClick);
      this.iframeMusicButton = button;
      this.updateIframeMusicAvailability();
      this.updateIframeMusicState(!!this.player?.isPlaying());
    } catch {
      // The deployed iframe is same-origin. If that ever changes, leave its standalone fallback.
    }
  }

  private unbindIframeMusicButton(): void {
    this.iframeMusicButton?.removeEventListener('click', this.iframeMusicClick);
    this.iframeMusicButton = null;
    this.removeIframeKick?.();
    this.removeIframeKick = undefined;
  }

  private bindIframeHandoff(doc: Document): void {
    const evs = ['pointerup', 'touchend', 'click', 'keydown'];
    this.removeIframeKick = () =>
      evs.forEach((ev) => doc.removeEventListener(ev, this.handoffKick));
    evs.forEach((ev) =>
      doc.addEventListener(ev, this.handoffKick, { passive: true }),
    );
  }

  private startMusicSave(): void {
    this.stopMusicSave();
    this.musicSaveTimer = setInterval(() => {
      if (this.player) saveHandoff(this.player.position(), true);
    }, 700);
  }
  private stopMusicSave(): void {
    if (this.musicSaveTimer) {
      clearInterval(this.musicSaveTimer);
      this.musicSaveTimer = undefined;
    }
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

  onCvFrameLoad(): void {
    this.bindIframeMusicButton();
    this.fitCv();
  }

  /**
   * Fit the fixed-width (A4 / 794px) CV document to the frame:
   * always keep the desktop composition and scale the whole document down on
   * narrow screens. The outer page scrolls; the preview never does.
   */
  fitCv(): void {
    const frame = this.cvFrame?.nativeElement;
    const wrapper = this.cvWrapper?.nativeElement;
    if (!frame || !wrapper) return;

    const availableWidth = Math.max(1, wrapper.clientWidth);
    const scale = Math.min(1, availableWidth / CvPageComponent.CV_DOC_WIDTH);

    // Keep the iframe viewport at the A4 desktop width even on phones. This
    // prevents the embedded document's mobile media query from reflowing and
    // deforming the CV; the finished desktop layout is scaled as one unit.
    frame.style.width = CvPageComponent.CV_DOC_WIDTH + 'px';
    frame.style.height = '1123px';
    frame.style.transform = `scale(${scale})`;
    wrapper.style.height = Math.ceil(1123 * scale) + 'px';

    if (this.fitFrameId !== undefined) {
      cancelAnimationFrame(this.fitFrameId);
    }
    const generation = ++this.fitGeneration;

    const measure = () => {
      if (generation !== this.fitGeneration) return;

      let docHeight = 1123;
      try {
        const doc = frame.contentDocument ?? frame.contentWindow?.document;
        if (doc) {
          doc.documentElement.style.overflow = 'hidden';
          doc.body.style.overflow = 'hidden';
          docHeight = Math.max(
            doc.documentElement.scrollHeight,
            doc.body.scrollHeight,
            docHeight,
          );
        }
      } catch {
        // same-origin iframe; retain the safe fallback if unavailable
      }

      const h = docHeight + 2;
      frame.style.height = h + 'px';
      frame.style.transform = `scale(${scale})`;
      wrapper.style.height = Math.ceil(h * scale) + 'px';
      this.fitFrameId = undefined;
    };

    // Chromium updates the iframe layout asynchronously after a width change.
    // Measure after two frames so the fixed-width composition is complete.
    this.fitFrameId = requestAnimationFrame(() => {
      this.fitFrameId = requestAnimationFrame(measure);
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.fitCv();
  }
}
