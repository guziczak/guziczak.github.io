import { Component, computed, inject } from '@angular/core';
import { LanguageService } from '../../core/services/language.service';

interface IntegrityStep {
  label: string;
  title: string;
  body: string;
}

interface IntegrityCopy {
  eyebrow: string;
  titleLead: string;
  titlePunch: string;
  intro: string;
  handoverLabel: string;
  handoverTitle: string;
  handoverBody: string;
  repository: string;
  agreement: string;
  steps: IntegrityStep[];
  closeLead: string;
  closePunch: string;
  closeNote: string;
  cta: string;
}

const INTEGRITY: Record<string, IntegrityCopy> = {
  en: {
    eyebrow: 'Structural integrity',
    titleLead: 'A repository',
    titlePunch: 'is not a rights transfer.',
    intro:
      'A company can pay for a system, deploy it to production and still fail to acquire the rights it expected. AI adds models, data, open source and the boundary between human and machine contribution.',
    handoverLabel: 'Clean IP Handover',
    handoverTitle: 'The cathedral does not end with code.',
    handoverBody:
      'With me, the rights architecture is part of delivery. We define the intended use before the first commit and close the handover with documentation and an execution form that actually has legal effect.',
    repository: 'source · documentation · build',
    agreement: 'rights · licences · reuse',
    steps: [
      {
        label: 'Scope',
        title: 'A named deliverable',
        body: 'Source, documentation, models and build instructions are tied to a defined release—not to a vague promise about “everything”.',
      },
      {
        label: 'Provenance',
        title: 'A clean chain of title',
        body: 'Project code is separated from background IP, open-source libraries, model terms, data sources and AI-assisted contributions.',
      },
      {
        label: 'Rights',
        title: 'Rights that match real use',
        body: 'Assignment or licence covers the agreed maintenance, modification, integration and onward-transfer model, with the required fields of use.',
      },
      {
        label: 'Execution',
        title: 'A signature that works',
        body: 'The handover points to a concrete repository version and uses the form required by the governing law—wet ink or QES where Polish law applies.',
      },
    ],
    closeLead: 'From model to signature.',
    closePunch: 'No cracks.',
    closeNote:
      'Ready for procurement, counsel, auditors and investors—including questions around IP Box, R&D incentives or a vendor transition.',
    cta: 'Build something that survives due diligence',
  },
  pl: {
    eyebrow: 'Integralność konstrukcji',
    titleLead: 'Repozytorium',
    titlePunch: 'to nie prawa.',
    intro:
      'Firma może zapłacić za system, wdrożyć go na produkcję i nadal nie nabyć skutecznie praw, których oczekiwała. W AI dochodzą modele, dane, open source i granica między wkładem człowieka i maszyny.',
    handoverLabel: 'Clean IP Handover',
    handoverTitle: 'Katedra nie kończy się na kodzie.',
    handoverBody:
      'Ze mną architektura praw jest częścią delivery. Docelowy sposób użycia ustalamy przed pierwszym commitem, a przekazanie zamykamy dokumentacją i formą, która naprawdę wywołuje skutek prawny.',
    repository: 'kod · dokumentacja · build',
    agreement: 'prawa · licencje · ponowne użycie',
    steps: [
      {
        label: 'Zakres',
        title: 'Nazwany rezultat',
        body: 'Kod, dokumentacja, modele i instrukcje builda są powiązane z konkretnym wydaniem — nie z mglistą obietnicą przekazania „wszystkiego”.',
      },
      {
        label: 'Pochodzenie',
        title: 'Czysty łańcuch praw',
        body: 'Kod projektu oddzielam od wcześniejszego IP, bibliotek open source, warunków modeli, źródeł danych i wkładu wspomaganego przez AI.',
      },
      {
        label: 'Uprawnienia',
        title: 'Prawa dopasowane do użycia',
        body: 'Przeniesienie albo licencja obejmują uzgodniony model utrzymania, modyfikacji, integracji i przekazania dalej, wraz z właściwymi polami eksploatacji.',
      },
      {
        label: 'Forma',
        title: 'Podpis, który działa',
        body: 'Przekazanie wskazuje konkretną wersję repozytorium i zachowuje formę wymaganą przez prawo — podpis własnoręczny albo QES, gdy stosujemy prawo polskie.',
      },
    ],
    closeLead: 'Od modelu do podpisu.',
    closePunch: 'Bez jednej rysy.',
    closeNote:
      'Gotowe na pytania procurementu, prawnika, audytora i inwestora — także gdy projekt dotyka IP Box, B+R albo zmiany dostawcy.',
    cta: 'Zbudujmy coś, co przejdzie due diligence',
  },
  de: {
    eyebrow: 'Strukturelle Integrität',
    titleLead: 'Das Repository',
    titlePunch: 'ist kein Rechteübergang.',
    intro:
      'Ein Unternehmen kann ein System bezahlen und produktiv einsetzen, ohne die erwarteten Rechte wirksam zu erwerben. Bei KI kommen Modelle, Daten, Open Source und die Grenze zwischen menschlichem und maschinellem Beitrag hinzu.',
    handoverLabel: 'Clean IP Handover',
    handoverTitle: 'Die Kathedrale endet nicht beim Code.',
    handoverBody:
      'Mit mir ist die Rechtearchitektur Teil des Delivery. Die vorgesehene Nutzung wird vor dem ersten Commit geklärt; die Übergabe wird mit Dokumentation und einer rechtlich wirksamen Form abgeschlossen.',
    repository: 'Quellcode · Dokumentation · Build',
    agreement: 'Rechte · Lizenzen · Wiederverwendung',
    steps: [
      {
        label: 'Umfang',
        title: 'Ein klar benanntes Ergebnis',
        body: 'Quellcode, Dokumentation, Modelle und Build-Anweisungen werden einer konkreten Version zugeordnet — nicht einem vagen Versprechen über „alles”.',
      },
      {
        label: 'Herkunft',
        title: 'Eine saubere Rechtekette',
        body: 'Projektcode wird von bestehendem IP, Open-Source-Bibliotheken, Modellbedingungen, Datenquellen und KI-gestützten Beiträgen getrennt.',
      },
      {
        label: 'Rechte',
        title: 'Rechte passend zur Nutzung',
        body: 'Übertragung oder Lizenz decken das vereinbarte Modell für Wartung, Änderung, Integration und Weitergabe sowie die erforderlichen Nutzungsarten ab.',
      },
      {
        label: 'Form',
        title: 'Eine Unterschrift, die wirkt',
        body: 'Die Übergabe verweist auf eine konkrete Repository-Version und wahrt die gesetzlich verlangte Form — eigenhändig oder per QES, wenn polnisches Recht gilt.',
      },
    ],
    closeLead: 'Vom Modell bis zur Unterschrift.',
    closePunch: 'Ohne Risse.',
    closeNote:
      'Bereit für Einkauf, Rechtsabteilung, Audit und Investoren — auch bei Fragen zu IP Box, F&E-Förderung oder einem Anbieterwechsel.',
    cta: 'Bauen wir etwas, das Due Diligence besteht',
  },
};

@Component({
  selector: 'app-ip-integrity-section',
  standalone: true,
  template: `
    <section
      class="integrity"
      id="handover"
      [attr.data-lang]="lang()"
      aria-labelledby="handover-title"
    >
      <div class="integrity__arch" aria-hidden="true"></div>

      <div class="integrity__inner">
        <header class="integrity__head animate-on-scroll">
          <span class="integrity__eyebrow">{{ copy().eyebrow }}</span>
          <div class="integrity__intro-grid">
            <h2 class="integrity__title" id="handover-title">
              <span>{{ copy().titleLead }}</span>
              <strong>{{ copy().titlePunch }}</strong>
            </h2>
            <p class="integrity__intro">{{ copy().intro }}</p>
          </div>
        </header>

        <div class="handover animate-on-scroll">
          <div class="handover__manifesto">
            <span class="handover__label">{{ copy().handoverLabel }}</span>
            <h3>{{ copy().handoverTitle }}</h3>
            <p>{{ copy().handoverBody }}</p>

            <dl
              class="handover__equation"
              [attr.aria-label]="copy().titleLead + ' — ' + copy().titlePunch"
            >
              <div>
                <dt>REPOSITORY</dt>
                <dd>{{ copy().repository }}</dd>
              </div>
              <span class="handover__not-equal" aria-hidden="true">≠</span>
              <div>
                <dt>AGREEMENT</dt>
                <dd>{{ copy().agreement }}</dd>
              </div>
            </dl>
          </div>

          <ol class="handover__steps">
            @for (step of copy().steps; track step.label; let i = $index) {
              <li class="handover__step">
                <span class="handover__index" aria-hidden="true"
                  >0{{ i + 1 }}</span
                >
                <span class="handover__step-label">{{ step.label }}</span>
                <div>
                  <h4>{{ step.title }}</h4>
                  <p>{{ step.body }}</p>
                </div>
              </li>
            }
          </ol>
        </div>

        <footer class="integrity__close animate-on-scroll">
          <div>
            <p class="integrity__close-title">
              <span>{{ copy().closeLead }}</span>
              <strong>{{ copy().closePunch }}</strong>
            </p>
            <p class="integrity__close-note">{{ copy().closeNote }}</p>
          </div>
          <a class="integrity__cta" href="#contact">
            {{ copy().cta }} <span aria-hidden="true">→</span>
          </a>
        </footer>
      </div>
    </section>
  `,
  styleUrls: ['./ip-integrity-section.component.scss'],
})
export class IpIntegritySectionComponent {
  private readonly languageService = inject(LanguageService);
  protected readonly lang = this.languageService.currentLanguage;
  protected readonly copy = computed(
    () => INTEGRITY[this.languageService.currentLanguage()] ?? INTEGRITY['en'],
  );
}
