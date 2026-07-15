import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../core/services/language.service';
import { MusicHandoffService } from '../../core/services/music-handoff.service';

const PROOF: Record<string, any> = {
  en: {
    eyebrow: 'The proof',
    title: 'Not promises — systems.',
    s1flag: "In production · maintained by the bank's team",
    s1where: 'Natek · embedded at a bank',
    s1desc:
      "Sole engineer, end to end. Local vision + language models on the bank's own GPUs — extracting structured data from scanned financial statements. No document ever leaves the network. Built for EU AI Act readiness and GDPR.",
    s1scan: 'Scanned statement',
    s1output: 'Structured output',
    s1caption: 'Exhibit 01 · on-prem · no egress',
    s2flag: 'Built solo · Sold',
    s2where: 'A commercial product',
    s2desc:
      'An AI scribe for veterinary clinics — it turns the conversation in the room into clinical documentation. Architected, built and shipped alone, end to end. Then sold.',
    s2input: 'Conversation',
    s2output: 'Clinical documentation',
    s2sold: 'Sold',
    s2caption: 'Exhibit 02 · voice to record · shipped',
    s3flag: 'Built solo · 17 specialties',
    s3where: 'A multi-specialty scribe + NFZ billing',
    s3desc:
      'The human-medicine sibling — one AI scribe across 17 specialties. Records the visit, transcribes offline (Whisper) with Doctor/Patient diarization, then drafts the documentation with ICD-10 diagnoses, ICD-9 procedures and ready NFZ point-scoring. Nothing leaves the machine.',
    s3input: 'Offline diarization',
    s3output: 'Coding ledger',
    s3doctor: 'Doctor',
    s3patient: 'Patient',
    s3caption: 'Exhibit 03 · offline · settlement-ready',
    rangeLabel: 'And the range —',
    r1: 'Single-file IDE · Git/GitHub client',
    r2: 'Art-studio site · shipped for a client',
    r3: 'Sheet-music player',
    r4: 'Claude Code / Codex session browser · single file',
  },
  pl: {
    eyebrow: 'Dowód',
    title: 'Nie obietnice — systemy.',
    s1flag: 'Na produkcji · utrzymywany przez zespół banku',
    s1where: 'Natek · oddelegowany do banku',
    s1desc:
      'Jedyny inżynier, end to end. Lokalne modele wizyjne i językowe na GPU banku — ekstrakcja danych ustrukturyzowanych ze skanów sprawozdań finansowych. Żaden dokument nie opuszcza sieci. Pod kątem EU AI Act i RODO.',
    s1scan: 'Skan sprawozdania',
    s1output: 'Dane ustrukturyzowane',
    s1caption: 'Eksponat 01 · on-prem · bez transferu danych',
    s2flag: 'Zbudowany solo · Sprzedany',
    s2where: 'Produkt komercyjny',
    s2desc:
      'AI-skryba dla klinik weterynaryjnych — zamienia rozmowę w gabinecie w dokumentację kliniczną. Zaprojektowany, zbudowany i wdrożony w pojedynkę, end to end. Potem sprzedany.',
    s2input: 'Rozmowa',
    s2output: 'Dokumentacja kliniczna',
    s2sold: 'Sprzedany',
    s2caption: 'Eksponat 02 · od głosu do dokumentacji · wdrożony',
    s3flag: 'Zbudowany solo · 17 specjalizacji',
    s3where: 'Skryba wielospecjalizacyjny + rozliczenia NFZ',
    s3desc:
      'Brat bliźniak dla medycyny człowieka — jeden AI-skryba w 17 specjalizacjach. Nagrywa wizytę, transkrybuje offline (Whisper) z rozróżnianiem Lekarz/Pacjent, i układa dokumentację z rozpoznaniami ICD-10, procedurami ICD-9 i gotową punktacją NFZ. Dane nie opuszczają komputera.',
    s3input: 'Diaryzacja offline',
    s3output: 'Rejestr rozliczeniowy',
    s3doctor: 'Lekarz',
    s3patient: 'Pacjent',
    s3caption: 'Eksponat 03 · offline · gotowy do rozliczenia',
    rangeLabel: 'A do tego zasięg —',
    r1: 'Jednoplikowe IDE · klient Git/GitHub',
    r2: 'Strona studia artystycznego · dla klienta',
    r3: 'Odtwarzacz nut',
    r4: 'Przeglądarka sesji Claude Code / Codex · jeden plik',
  },
  de: {
    eyebrow: 'Der Beweis',
    title: 'Keine Versprechen — Systeme.',
    s1flag: 'In Produktion · gepflegt vom Bank-Team',
    s1where: 'Natek · in einer Bank',
    s1desc:
      'Alleiniger Entwickler, end to end. Lokale Vision- und Sprachmodelle auf den GPUs der Bank — Extraktion strukturierter Daten aus gescannten Finanzberichten. Kein Dokument verlässt das Netzwerk. Für EU AI Act und DSGVO ausgelegt.',
    s1scan: 'Gescannter Bericht',
    s1output: 'Strukturierte Ausgabe',
    s1caption: 'Exponat 01 · on-prem · kein Datenabfluss',
    s2flag: 'Allein gebaut · Verkauft',
    s2where: 'Ein kommerzielles Produkt',
    s2desc:
      'Ein KI-Schreiber für Tierkliniken — verwandelt das Gespräch im Raum in klinische Dokumentation. Allein konzipiert, gebaut und ausgeliefert, end to end. Dann verkauft.',
    s2input: 'Gespräch',
    s2output: 'Klinische Dokumentation',
    s2sold: 'Verkauft',
    s2caption: 'Exponat 02 · von Sprache zur Akte · ausgeliefert',
    s3flag: 'Allein gebaut · 17 Fachgebiete',
    s3where: 'Multidisziplinärer Schreiber + NFZ-Abrechnung',
    s3desc:
      'Das Pendant für die Humanmedizin — ein KI-Schreiber über 17 Fachgebiete. Nimmt den Besuch auf, transkribiert offline (Whisper) mit Arzt/Patient-Trennung und erstellt die Dokumentation mit ICD-10-Diagnosen, ICD-9-Prozeduren und fertiger NFZ-Punktebewertung. Nichts verlässt den Rechner.',
    s3input: 'Offline-Diarisierung',
    s3output: 'Abrechnungsregister',
    s3doctor: 'Arzt',
    s3patient: 'Patient',
    s3caption: 'Exponat 03 · offline · abrechnungsbereit',
    rangeLabel: 'Und die Bandbreite —',
    r1: 'Single-File-IDE · Git/GitHub-Client',
    r2: 'Kunststudio-Website · für einen Kunden',
    r3: 'Notenplayer',
    r4: 'Claude-Code-/Codex-Sitzungsbrowser · eine Datei',
  },
};

/**
 * The Proof — system slabs, not a card grid.
 * Three systems (the bank Document AI, OpisAI, Wizyta) you scroll into one at a time,
 * then the range. Real systems, real links. Depth over breadth.
 */
@Component({
  selector: 'app-projects-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="proof" id="projects">
      <header class="proof__head animate-on-scroll">
        <span class="proof__eyebrow">{{ p().eyebrow }}</span>
        <h2 class="proof__title">{{ p().title }}</h2>
      </header>

      <article class="slab slab--document animate-on-scroll">
        <div class="slab__copy">
          <div class="slab__meta">
            <span class="slab__index">01</span>
            <span class="slab__flag">{{ p().s1flag }}</span>
          </div>
          <h3 class="slab__name">On-prem Document AI</h3>
          <p class="slab__where">{{ p().s1where }}</p>
          <p class="slab__desc">{{ p().s1desc }}</p>
          <p class="slab__tech">
            Python · PyTorch · Computer Vision (ViT) · Local LLMs (vLLM) ·
            Structured Outputs
          </p>
        </div>
        <figure class="exhibit exhibit--document">
          <div class="exhibit__lintel">
            <span>DOC_AI / PIPELINE_01</span><span>LOCAL GPU</span>
          </div>
          <div class="exhibit__stage document-stage" aria-hidden="true">
            <div class="document-stage__scan">
              <span class="artifact-label">{{ p().s1scan }}</span>
              <div class="scan-sheet">
                <span class="scan-sheet__heading"></span>
                <span class="scan-sheet__line scan-sheet__line--long"></span>
                <span class="scan-sheet__line"></span>
                <span class="scan-sheet__line scan-sheet__line--short"></span>
                <span class="scan-sheet__line scan-sheet__line--long"></span>
                <span class="scan-sheet__line"></span>
                <span class="scan-sheet__line scan-sheet__line--short"></span>
                <span class="scan-box scan-box--revenue"><i>REV</i></span>
                <span class="scan-box scan-box--assets"><i>AST</i></span>
                <span class="scan-box scan-box--total"><i>TOTAL</i></span>
              </div>
            </div>
            <div class="pipeline-arrow">
              <span>ViT</span><i></i><span>LLM</span>
            </div>
            <div class="document-stage__output">
              <span class="artifact-label">{{ p().s1output }}</span>
              <pre
                class="json-output"
              ><code><span class="json-brace">&#123;</span>
  <span class="json-key">"period"</span>: <span class="json-value">"2025-Q4"</span>,
  <span class="json-key">"revenue"</span>: <span class="json-number">84210000</span>,
  <span class="json-key">"assets"</span>: <span class="json-number">191440000</span>,
  <span class="json-key">"currency"</span>: <span class="json-value">"PLN"</span>,
  <span class="json-key">"confidence"</span>: <span class="json-number">0.984</span>
<span class="json-brace">&#125;</span></code></pre>
            </div>
          </div>
          <figcaption>
            <span>{{ p().s1caption }}</span
            ><strong>NO NETWORK EGRESS</strong>
          </figcaption>
        </figure>
      </article>

      <article class="slab slab--opisai animate-on-scroll">
        <div class="slab__copy">
          <div class="slab__meta">
            <span class="slab__index">02</span>
            <span class="slab__flag">{{ p().s2flag }}</span>
          </div>
          <h3 class="slab__name">OpisAI</h3>
          <p class="slab__where">{{ p().s2where }}</p>
          <p class="slab__desc">{{ p().s2desc }}</p>
          <p class="slab__tech">
            LLMs · Structured Outputs · Python · Full-stack
          </p>
          <a
            class="slab__link"
            href="https://guziczak.github.io/opisai"
            target="_blank"
            rel="noopener noreferrer"
            data-music-handoff
            (click)="prepareDemoNavigation($event)"
          >
            guziczak.github.io/opisai <span aria-hidden="true">→</span>
          </a>
        </div>
        <figure class="exhibit exhibit--opisai animate-on-scroll">
          <div class="exhibit__lintel">
            <span>OPISAI / SCRIBE_02</span><span>VOICE → RECORD</span>
          </div>
          <div class="exhibit__stage scribe-stage" aria-hidden="true">
            <div class="scribe-stage__voice">
              <span class="artifact-label">{{ p().s2input }}</span>
              <svg
                class="waveform"
                viewBox="0 0 320 96"
                preserveAspectRatio="none"
              >
                <path class="waveform__base" d="M0 48H320" />
                <path
                  class="waveform__trace"
                  pathLength="1"
                  d="M0 48 L8 46 14 52 21 26 28 70 34 40 42 48 50 47 58 34 66 62 73 43 80 49 88 48 96 19 103 78 111 39 120 55 128 46 137 48 145 31 152 66 160 42 168 51 176 48 184 10 192 86 200 32 208 62 216 43 224 50 232 47 240 27 248 72 256 38 264 56 272 46 280 49 288 35 296 61 304 44 312 50 320 48"
                />
              </svg>
              <div class="transcript">
                <span></span><span></span><span></span><span></span>
              </div>
            </div>
            <div class="pipeline-arrow pipeline-arrow--cobalt">
              <span>STT</span><i></i><span>LLM</span>
            </div>
            <div class="scribe-stage__record">
              <span class="artifact-label">{{ p().s2output }}</span>
              <div class="clinical-note">
                <strong>SOAP / 07</strong>
                <span
                  class="clinical-note__rule clinical-note__rule--long"
                ></span
                ><span class="clinical-note__rule"></span> <b>S</b
                ><span class="clinical-note__rule"></span> <b>O</b
                ><span
                  class="clinical-note__rule clinical-note__rule--long"
                ></span>
                <b>A</b><span class="clinical-note__rule"></span> <b>P</b
                ><span
                  class="clinical-note__rule clinical-note__rule--long"
                ></span>
              </div>
            </div>
          </div>
          <a
            class="opisai-stamp"
            href="https://guziczak.github.io/opisai"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="OpisAI"
            data-music-handoff
            (click)="prepareDemoNavigation($event)"
          >
            <svg
              class="opisai-stamp__icon"
              viewBox="20 21 60 60"
              aria-hidden="true"
            >
              <mask id="opisaiStampBag">
                <rect
                  x="38"
                  y="24.5"
                  width="24"
                  height="14"
                  rx="6.3"
                  fill="#fff"
                />
                <rect
                  x="20.9"
                  y="33.4"
                  width="58.2"
                  height="43.7"
                  rx="10.4"
                  fill="#fff"
                />
                <rect
                  x="43.5"
                  y="28.6"
                  width="13"
                  height="6.5"
                  rx="2.6"
                  fill="#000"
                />
                <rect
                  x="45.9"
                  y="42.5"
                  width="8.1"
                  height="25.3"
                  rx="2.4"
                  fill="#000"
                />
                <rect
                  x="37.3"
                  y="51.1"
                  width="25.3"
                  height="8.1"
                  rx="2.4"
                  fill="#000"
                />
              </mask>
              <rect
                width="100"
                height="100"
                fill="currentColor"
                mask="url(#opisaiStampBag)"
              />
            </svg>
            <span>{{ p().s2sold }}</span>
          </a>
          <figcaption>
            <span>{{ p().s2caption }}</span
            ><strong>END TO END</strong>
          </figcaption>
        </figure>
      </article>

      <article class="slab slab--wizyta animate-on-scroll">
        <div class="slab__copy">
          <div class="slab__meta">
            <span class="slab__index">03</span>
            <span class="slab__flag">{{ p().s3flag }}</span>
          </div>
          <h3 class="slab__name">Wizyta</h3>
          <p class="slab__where">{{ p().s3where }}</p>
          <p class="slab__desc">{{ p().s3desc }}</p>
          <p class="slab__tech">
            Offline STT (Whisper) · Diarization · RAG (OpenVINO) ·
            ICD-10/ICD-9/NFZ · LLMs · Python
          </p>
          <a
            class="slab__link"
            href="https://guziczak.github.io/wizyta"
            target="_blank"
            rel="noopener noreferrer"
            data-music-handoff
            (click)="prepareDemoNavigation($event)"
          >
            guziczak.github.io/wizyta <span aria-hidden="true">→</span>
          </a>
        </div>
        <figure class="exhibit exhibit--wizyta animate-on-scroll">
          <div class="exhibit__lintel">
            <span>WIZYTA / VISIT_03</span><span>OFFLINE → NFZ</span>
          </div>
          <div class="exhibit__stage visit-stage" aria-hidden="true">
            <div class="visit-stage__dialogue">
              <span class="artifact-label">{{ p().s3input }}</span>
              <div class="speaker speaker--doctor">
                <b>{{ p().s3doctor }}</b
                ><i></i><i></i>
              </div>
              <div class="speaker speaker--patient">
                <b>{{ p().s3patient }}</b
                ><i></i><i></i>
              </div>
              <div class="speaker speaker--doctor">
                <b>{{ p().s3doctor }}</b
                ><i></i><i></i>
              </div>
              <div class="audio-axis">
                <span>00:00</span><i></i><span>18:42</span>
              </div>
            </div>
            <div class="pipeline-arrow pipeline-arrow--cobalt">
              <span>STT</span><i></i><span>RAG</span>
            </div>
            <div class="visit-stage__ledger">
              <span class="artifact-label">{{ p().s3output }}</span>
              <div class="ledger-row ledger-row--head">
                <span>CLASS</span><span>CODE</span><span>STATE</span>
              </div>
              <div class="ledger-row">
                <strong>ICD-10</strong><code>F32.1</code><i>OK</i>
              </div>
              <div class="ledger-row">
                <strong>ICD-9</strong><code>94.111</code><i>OK</i>
              </div>
              <div class="ledger-row">
                <strong>NFZ</strong><code>75.00 pkt</code><i>READY</i>
              </div>
            </div>
          </div>
          <figcaption>
            <span>{{ p().s3caption }}</span
            ><strong>17 SPECIALTIES</strong>
          </figcaption>
        </figure>
      </article>

      <div class="range animate-on-scroll">
        <span class="range__label">{{ p().rangeLabel }}</span>
        <div class="range__items">
          <a
            class="range__item"
            href="https://github.com/guziczak/ide"
            target="_blank"
            rel="noopener noreferrer"
          >
            <b>ForgeIDE</b><span>{{ p().r1 }}</span>
          </a>
          <a
            class="range__item"
            href="https://zofiasiek.pl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <b>Siek-Art</b><span>{{ p().r2 }}</span>
          </a>
          <a
            class="range__item"
            href="https://github.com/guziczak/noteplayer"
            target="_blank"
            rel="noopener noreferrer"
          >
            <b>noteplayer</b><span>{{ p().r3 }}</span>
          </a>
          <a
            class="range__item"
            href="https://github.com/guziczak/przegladaczka"
            target="_blank"
            rel="noopener noreferrer"
          >
            <b>przeglądaczka</b><span>{{ p().r4 }}</span>
          </a>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .proof {
        padding: clamp(5rem, 12vh, 9rem) clamp(1.5rem, 6vw, 6rem);
        background: transparent;
      }
      .proof__head {
        max-width: 70rem;
        margin: 0 auto clamp(2.5rem, 6vw, 4.5rem);
      }
      .proof__eyebrow {
        display: block;
        color: var(--color-primary);
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        margin-bottom: 1rem;
      }
      .proof__title {
        font-size: clamp(1.8rem, 4vw, 2.8rem);
        font-weight: 700;
        letter-spacing: -0.02em;
        color: var(--text-primary);
        margin: 0;
      }

      .slab {
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        align-items: center;
        column-gap: clamp(2rem, 5vw, 5rem);
        max-width: 70rem;
        margin: 0 auto;
        padding: clamp(3.75rem, 8vw, 7rem) 0;
        border-top: 1px solid var(--border-color);
      }
      .slab__copy {
        grid-column: span 5;
        min-width: 0;
      }
      .slab__meta {
        display: flex;
        align-items: baseline;
        gap: 1.2rem;
        margin-bottom: 1.2rem;
        flex-wrap: wrap;
      }
      .slab__index {
        font-family: var(--font-mono);
        color: var(--color-primary);
        font-size: 0.9rem;
        letter-spacing: 0.1em;
      }
      .slab__flag {
        font-size: 0.78rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-tertiary);
      }
      .slab__name {
        font-size: clamp(2rem, 5.5vw, 3.4rem);
        font-weight: 700;
        letter-spacing: -0.03em;
        line-height: 1.02;
        color: var(--text-primary);
        margin: 0 0 0.5rem;
      }
      .slab__where {
        font-size: 0.95rem;
        color: var(--text-secondary);
        margin: 0 0 1.4rem;
      }
      .slab__desc {
        max-width: 44rem;
        font-size: clamp(1rem, 1.6vw, 1.15rem);
        line-height: 1.75;
        color: var(--text-secondary);
        margin: 0 0 1.4rem;
      }
      .slab__tech {
        font-family: var(--font-mono);
        font-size: 0.82rem;
        letter-spacing: 0.02em;
        color: var(--text-tertiary);
        margin: 0;
      }
      .slab__link {
        display: inline-block;
        margin-top: 1.4rem;
        color: var(--color-primary);
        font-size: 0.95rem;
        text-decoration: none;
        transition: opacity 0.25s ease;
      }
      .slab__link:hover {
        opacity: 0.8;
        text-decoration: none;
      }
      .slab__link span {
        transition: transform 0.25s ease;
        display: inline-block;
      }
      .slab__link:hover span {
        transform: translateX(4px);
      }

      /* Technical exhibits: proof rendered as native, inspectable interface fragments. */
      .exhibit {
        --exhibit-accent: var(--color-primary);
        grid-column: span 7;
        position: relative;
        min-width: 0;
        margin: 0;
        border-top: 1px solid
          color-mix(in srgb, var(--exhibit-accent) 38%, var(--border-color));
        border-bottom: 1px solid var(--border-color);
        background:
          linear-gradient(
            115deg,
            color-mix(in srgb, var(--exhibit-accent) 5%, transparent),
            transparent 42%
          ),
          rgba(5, 12, 24, 0.42);
        box-shadow: 0 2rem 5rem rgba(0, 0, 0, 0.16);
        isolation: isolate;
      }
      .exhibit--opisai,
      .exhibit--wizyta {
        --exhibit-accent: #286cff;
      }
      .exhibit::after {
        content: '';
        position: absolute;
        inset: 2.8rem 0 2.1rem;
        z-index: -1;
        pointer-events: none;
        opacity: 0.28;
        background-image:
          linear-gradient(rgba(148, 163, 184, 0.055) 1px, transparent 1px),
          linear-gradient(
            90deg,
            rgba(148, 163, 184, 0.055) 1px,
            transparent 1px
          );
        background-size: 1.5rem 1.5rem;
        mask-image: linear-gradient(
          to bottom,
          transparent,
          #000 15%,
          #000 85%,
          transparent
        );
      }
      .exhibit__lintel {
        position: relative;
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.72rem 0.85rem 0.65rem 1rem;
        border-bottom: 1px solid var(--border-color);
        color: var(--text-tertiary);
        font-family: var(--font-mono);
        font-size: 0.61rem;
        line-height: 1;
        letter-spacing: 0.13em;
        text-transform: uppercase;
      }
      .exhibit__lintel::before {
        content: '';
        position: absolute;
        top: -1px;
        left: 0;
        width: clamp(4rem, 18%, 7rem);
        height: 3px;
        background: var(--exhibit-accent);
        box-shadow: 0 0 1.4rem
          color-mix(in srgb, var(--exhibit-accent) 55%, transparent);
      }
      .exhibit__lintel span:last-child {
        color: color-mix(in srgb, var(--exhibit-accent) 84%, white);
      }
      .exhibit__stage {
        min-height: clamp(19rem, 31vw, 24rem);
        padding: clamp(1.2rem, 2.5vw, 2rem);
      }
      .exhibit figcaption {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.75rem 1rem 0;
        color: var(--text-tertiary);
        font-family: var(--font-mono);
        font-size: 0.6rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .exhibit figcaption strong {
        color: color-mix(in srgb, var(--exhibit-accent) 86%, white);
        font-weight: 600;
        white-space: nowrap;
      }
      .artifact-label {
        display: block;
        margin-bottom: 0.7rem;
        color: var(--text-tertiary);
        font-family: var(--font-mono);
        font-size: 0.62rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .document-stage,
      .scribe-stage,
      .visit-stage {
        display: grid;
        grid-template-columns: minmax(0, 0.92fr) minmax(2.4rem, 0.22fr) minmax(
            0,
            1.08fr
          );
        align-items: center;
        gap: clamp(0.65rem, 1.6vw, 1.15rem);
      }
      .pipeline-arrow {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        min-width: 0;
        color: var(--text-tertiary);
        font-family: var(--font-mono);
        font-size: 0.52rem;
        letter-spacing: 0.08em;
      }
      .pipeline-arrow i {
        position: relative;
        display: block;
        width: 100%;
        height: 1px;
        background: color-mix(in srgb, var(--exhibit-accent) 58%, transparent);
      }
      .pipeline-arrow i::after {
        content: '';
        position: absolute;
        top: 50%;
        right: -1px;
        width: 0.35rem;
        height: 0.35rem;
        border-top: 1px solid var(--exhibit-accent);
        border-right: 1px solid var(--exhibit-accent);
        transform: translateY(-50%) rotate(45deg);
      }
      .pipeline-arrow--cobalt {
        color: #7da9ff;
      }

      /* Document AI: a synthetic statement is boxed, then resolved into a local JSON contract. */
      .document-stage__scan,
      .document-stage__output,
      .scribe-stage__voice,
      .scribe-stage__record,
      .visit-stage__dialogue,
      .visit-stage__ledger {
        min-width: 0;
      }
      .scan-sheet {
        position: relative;
        width: min(100%, 13.5rem);
        aspect-ratio: 4 / 5;
        margin: 0 auto;
        padding: 16% 12%;
        overflow: hidden;
        background:
          linear-gradient(
            104deg,
            transparent 0 47%,
            rgba(15, 23, 42, 0.055) 48%,
            transparent 50%
          ),
          #d9dfe6;
        box-shadow: 0 1.3rem 3rem rgba(0, 0, 0, 0.27);
        transform: rotate(-1.25deg);
      }
      .scan-sheet::before {
        content: 'FINANCIAL STATEMENT / 0184';
        position: absolute;
        top: 6%;
        left: 12%;
        color: rgba(15, 23, 42, 0.6);
        font-family: var(--font-mono);
        font-size: clamp(0.34rem, 0.62vw, 0.48rem);
        letter-spacing: 0.06em;
      }
      .scan-sheet__heading,
      .scan-sheet__line {
        display: block;
        height: 3px;
        margin-bottom: 9%;
        background: rgba(15, 23, 42, 0.31);
      }
      .scan-sheet__heading {
        width: 45%;
        height: 7px;
        margin-bottom: 14%;
        background: rgba(15, 23, 42, 0.58);
      }
      .scan-sheet__line {
        width: 72%;
      }
      .scan-sheet__line--long {
        width: 100%;
      }
      .scan-sheet__line--short {
        width: 52%;
      }
      .scan-box {
        position: absolute;
        border: 1px solid #0284c7;
        box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.14);
      }
      .scan-box i {
        position: absolute;
        top: -0.72rem;
        left: -1px;
        padding: 0.1rem 0.22rem;
        background: #0284c7;
        color: white;
        font-family: var(--font-mono);
        font-size: 0.4rem;
        font-style: normal;
        line-height: 1;
      }
      .scan-box--revenue {
        top: 36%;
        left: 9%;
        width: 82%;
        height: 12%;
      }
      .scan-box--assets {
        top: 58%;
        left: 9%;
        width: 82%;
        height: 11%;
      }
      .scan-box--total {
        right: 9%;
        bottom: 9%;
        width: 44%;
        height: 9%;
      }
      .json-output {
        margin: 0;
        padding: clamp(0.85rem, 1.8vw, 1.35rem);
        overflow: hidden;
        border-left: 1px solid
          color-mix(in srgb, var(--color-primary) 48%, var(--border-color));
        background: rgba(3, 8, 18, 0.72);
        color: #9aa9bb;
        font-family: var(--font-mono);
        font-size: clamp(0.52rem, 0.85vw, 0.7rem);
        line-height: 1.85;
        box-shadow: 1rem 1.4rem 3rem rgba(0, 0, 0, 0.2);
      }
      .json-key {
        color: #7dd3fc;
      }
      .json-value {
        color: #d4b98c;
      }
      .json-number {
        color: #a7f3d0;
      }
      .json-brace {
        color: var(--text-primary);
      }

      /* OpisAI: voice energy and transcript condense into the clinical record. */
      .waveform {
        display: block;
        width: 100%;
        height: clamp(4.5rem, 8vw, 6rem);
        margin: 0.4rem 0 1rem;
        overflow: visible;
      }
      .waveform__base {
        fill: none;
        stroke: rgba(148, 163, 184, 0.18);
        stroke-width: 1;
      }
      .waveform__trace {
        fill: none;
        stroke: #286cff;
        stroke-width: 2;
        vector-effect: non-scaling-stroke;
        filter: drop-shadow(0 0 0.35rem rgba(40, 108, 255, 0.55));
      }
      .transcript {
        display: grid;
        gap: 0.48rem;
      }
      .transcript span {
        display: block;
        height: 2px;
        background: rgba(148, 163, 184, 0.28);
      }
      .transcript span:nth-child(2) {
        width: 84%;
      }
      .transcript span:nth-child(3) {
        width: 91%;
      }
      .transcript span:nth-child(4) {
        width: 62%;
      }
      .clinical-note {
        display: grid;
        grid-template-columns: 1rem 1fr;
        align-items: center;
        gap: 0.75rem 0.55rem;
        padding: clamp(1rem, 2vw, 1.5rem);
        border-left: 1px solid rgba(40, 108, 255, 0.62);
        background: linear-gradient(
          145deg,
          rgba(255, 255, 255, 0.075),
          rgba(255, 255, 255, 0.025)
        );
        box-shadow: 1rem 1.4rem 3rem rgba(0, 0, 0, 0.18);
      }
      .clinical-note strong {
        grid-column: 1 / -1;
        color: #9ebcff;
        font-family: var(--font-mono);
        font-size: 0.62rem;
        letter-spacing: 0.1em;
      }
      .clinical-note b {
        color: #7da9ff;
        font-family: var(--font-mono);
        font-size: 0.65rem;
      }
      .clinical-note__rule {
        display: block;
        height: 2px;
        background: rgba(148, 163, 184, 0.28);
      }
      .clinical-note > .clinical-note__rule:first-of-type {
        grid-column: 1 / -1;
      }
      .clinical-note__rule--long {
        width: 100%;
      }
      .opisai-stamp {
        position: absolute;
        top: 3.3rem;
        right: -1.15rem;
        display: flex;
        width: clamp(5.2rem, 9vw, 6.6rem);
        aspect-ratio: 1;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.15rem;
        border: 1px solid #82aaff;
        border-radius: 50%;
        background: radial-gradient(circle at 38% 32%, #3479ff, #1949b8 72%);
        box-shadow:
          inset 0 0 0 0.35rem #143d9d,
          inset 0 0 0 0.42rem rgba(255, 255, 255, 0.32),
          0 1rem 2.5rem rgba(0, 24, 90, 0.42);
        color: white;
        font-family: var(--font-mono);
        font-size: clamp(0.47rem, 0.75vw, 0.6rem);
        font-weight: 700;
        letter-spacing: 0.11em;
        text-decoration: none;
        text-transform: uppercase;
        rotate: -7deg;
        z-index: 2;
      }
      .opisai-stamp::after {
        content: '✦';
        position: absolute;
        bottom: 0.45rem;
        font-size: 0.52rem;
        opacity: 0.8;
      }
      .opisai-stamp__icon {
        display: block;
        width: 2.05rem;
        height: 2.05rem;
      }
      .exhibit--opisai.active .waveform__trace {
        animation: opisaiTrace 720ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both;
      }
      .exhibit--opisai.active .clinical-note {
        animation: opisaiRecord 580ms cubic-bezier(0.16, 1, 0.3, 1) 520ms both;
      }
      .exhibit--opisai.active .opisai-stamp {
        animation: opisaiSeal 460ms cubic-bezier(0.2, 0.8, 0.2, 1) 920ms both;
      }
      .opisai-stamp:hover {
        transform: scale(1.05);
        text-decoration: none;
        filter: brightness(1.08);
      }
      .opisai-stamp:focus-visible {
        outline: 2px solid white;
        outline-offset: 4px;
      }
      @keyframes opisaiTrace {
        from {
          opacity: 0.25;
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
        }
        to {
          opacity: 1;
          stroke-dasharray: 1;
          stroke-dashoffset: 0;
        }
      }
      @keyframes opisaiRecord {
        from {
          opacity: 0.2;
          clip-path: inset(0 100% 0 0);
          translate: -0.4rem 0;
        }
        to {
          opacity: 1;
          clip-path: inset(0);
          translate: 0;
        }
      }
      @keyframes opisaiSeal {
        from {
          opacity: 0;
          translate: 0 -0.55rem;
          scale: 1.05;
          rotate: -9deg;
        }
        to {
          opacity: 1;
          translate: 0;
          scale: 1;
          rotate: -7deg;
        }
      }

      /* Wizyta: a diarized visit resolves into an explicit coding and NFZ ledger. */
      .speaker {
        display: grid;
        grid-template-columns: minmax(3.5rem, auto) 1fr;
        gap: 0.35rem 0.7rem;
        margin-bottom: 1rem;
      }
      .speaker b {
        grid-row: span 2;
        align-self: center;
        color: #7da9ff;
        font-family: var(--font-mono);
        font-size: clamp(0.52rem, 0.78vw, 0.66rem);
        font-weight: 600;
      }
      .speaker--patient b {
        color: #b7c3d5;
      }
      .speaker i {
        display: block;
        height: 2px;
        background: rgba(148, 163, 184, 0.27);
      }
      .speaker i:last-child {
        width: 72%;
      }
      .speaker--patient i:first-of-type {
        width: 84%;
      }
      .audio-axis {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 1.6rem;
        color: var(--text-tertiary);
        font-family: var(--font-mono);
        font-size: 0.5rem;
      }
      .audio-axis i {
        position: relative;
        display: block;
        flex: 1;
        height: 1px;
        background: rgba(40, 108, 255, 0.5);
      }
      .audio-axis i::after {
        content: '';
        position: absolute;
        left: 64%;
        top: 50%;
        width: 0.38rem;
        height: 0.38rem;
        border-radius: 50%;
        background: #286cff;
        box-shadow: 0 0 0 0.25rem rgba(40, 108, 255, 0.12);
        transform: translate(-50%, -50%);
      }
      .visit-stage__ledger {
        border-top: 1px solid rgba(40, 108, 255, 0.42);
        background: rgba(3, 8, 18, 0.64);
      }
      .visit-stage__ledger > .artifact-label {
        margin: 0;
        padding: 0.8rem 0.75rem;
        border-bottom: 1px solid var(--border-color);
      }
      .ledger-row {
        display: grid;
        grid-template-columns: 1fr 0.8fr 0.7fr;
        align-items: center;
        min-height: 2.65rem;
        padding: 0 0.75rem;
        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        font-family: var(--font-mono);
        font-size: clamp(0.52rem, 0.75vw, 0.64rem);
      }
      .ledger-row--head {
        min-height: 1.8rem;
        color: var(--text-tertiary);
        font-size: 0.48rem;
        letter-spacing: 0.08em;
      }
      .ledger-row strong {
        color: #9ebcff;
        font-weight: 600;
      }
      .ledger-row code {
        color: var(--text-secondary);
        font-family: inherit;
      }
      .ledger-row i {
        color: #86efac;
        font-size: 0.5rem;
        font-style: normal;
        text-align: right;
      }
      .exhibit--wizyta.active .visit-stage__dialogue {
        animation: visitSource 500ms cubic-bezier(0.16, 1, 0.3, 1) 120ms both;
      }
      .exhibit--wizyta.active .pipeline-arrow i {
        transform-origin: left center;
        animation: visitFlow 360ms ease-out 420ms both;
      }
      .exhibit--wizyta.active .visit-stage__ledger {
        animation: ledgerCommit 620ms cubic-bezier(0.16, 1, 0.3, 1) 580ms both;
      }
      .exhibit--wizyta.active .ledger-row:last-child i {
        animation: readyCommit 220ms ease-out 1060ms both;
      }
      @keyframes visitSource {
        from {
          opacity: 0;
          translate: 0 0.5rem;
        }
        to {
          opacity: 1;
          translate: 0;
        }
      }
      @keyframes visitFlow {
        from {
          scale: 0 1;
        }
        to {
          scale: 1 1;
        }
      }
      @keyframes ledgerCommit {
        from {
          opacity: 0.25;
          clip-path: inset(0 0 100% 0);
        }
        to {
          opacity: 1;
          clip-path: inset(0);
        }
      }
      @keyframes readyCommit {
        from {
          opacity: 0.25;
        }
        to {
          opacity: 1;
        }
      }

      @media (max-width: 900px) {
        .slab {
          grid-template-columns: minmax(0, 1fr);
          row-gap: clamp(2.5rem, 7vw, 4rem);
        }
        .slab__copy,
        .exhibit {
          grid-column: 1;
        }
        .slab__desc {
          max-width: 48rem;
        }
      }
      @media (max-width: 640px) {
        .document-stage,
        .scribe-stage,
        .visit-stage {
          grid-template-columns: minmax(0, 1fr);
          gap: 1.4rem;
        }
        .exhibit__stage {
          min-height: 0;
          padding: 1.15rem;
        }
        .pipeline-arrow {
          display: grid;
          grid-template-columns: auto minmax(2rem, 1fr) auto;
          width: 100%;
        }
        .scan-sheet {
          width: min(72%, 12.5rem);
        }
        .json-output {
          font-size: clamp(0.52rem, 2.6vw, 0.67rem);
        }
        .opisai-stamp {
          top: 3.15rem;
          right: 0.6rem;
          width: 5rem;
        }
        .exhibit figcaption {
          align-items: flex-start;
          flex-direction: column;
        }
        .exhibit__lintel {
          font-size: 0.52rem;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .exhibit--opisai.active .waveform__trace,
        .exhibit--opisai.active .clinical-note,
        .exhibit--opisai.active .opisai-stamp,
        .exhibit--wizyta.active .visit-stage__dialogue,
        .exhibit--wizyta.active .pipeline-arrow i,
        .exhibit--wizyta.active .visit-stage__ledger,
        .exhibit--wizyta.active .ledger-row:last-child i {
          animation: none;
        }
        .waveform__trace {
          stroke-dasharray: none;
          stroke-dashoffset: 0;
        }
        .clinical-note,
        .visit-stage__dialogue,
        .visit-stage__ledger {
          opacity: 1;
          clip-path: none;
          translate: 0;
        }
        .opisai-stamp {
          opacity: 1;
          translate: 0;
          scale: 1;
          rotate: -7deg;
        }
        .pipeline-arrow i {
          scale: 1 1;
        }
        .ledger-row:last-child i {
          opacity: 1;
        }
      }

      .range {
        max-width: 70rem;
        margin: clamp(2.5rem, 5vw, 4rem) auto 0;
        padding-top: clamp(2.5rem, 5vw, 4rem);
        border-top: 1px solid var(--border-color);
      }
      .range__label {
        display: block;
        color: var(--text-tertiary);
        font-size: 0.9rem;
        margin-bottom: 1.6rem;
      }
      .range__items {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
        gap: 1.5rem;
      }
      .range__item {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        padding: 1.2rem 1.4rem;
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        text-decoration: none;
        transition:
          border-color 0.25s ease,
          transform 0.25s ease;
      }
      .range__item:hover {
        border-color: var(--border-color-dark);
        transform: translateY(-2px);
        text-decoration: none;
      }
      .range__item b {
        color: var(--text-primary);
        font-weight: 600;
        font-size: 1.05rem;
      }
      .range__item span {
        color: var(--text-tertiary);
        font-size: 0.85rem;
      }
    `,
  ],
})
export class ProjectsSectionComponent {
  private languageService = inject(LanguageService);
  private musicHandoff = inject(MusicHandoffService);
  protected readonly p = computed(
    () => PROOF[this.languageService.currentLanguage()] ?? PROOF['en'],
  );

  protected prepareDemoNavigation(event: MouseEvent): void {
    event.stopPropagation();

    const anchor = event.currentTarget as HTMLAnchorElement | null;
    if (!anchor) return;

    const state = this.musicHandoff.captureAndPause();
    anchor.href = this.musicHandoff.withState(anchor.href, state);
  }
}
