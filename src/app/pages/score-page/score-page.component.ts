import {
  Component,
  ElementRef,
  ViewChild,
  ViewChildren,
  QueryList,
  AfterViewInit,
  OnDestroy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  GCLEF_PATH,
  FCLEF_PATH,
  TS4_PATH,
  C4_STEP,
  TREB_MID,
  BASS_MID,
  diat,
  glyph,
  ink,
  isBlack,
  drawNote,
  drawSharp,
  drawNatural,
} from '../../features/home/engraving';

const CREDIT = 'Łukasz Guziczak & Claude Opus 4.6 · guziczak.github.io';

interface Sys {
  i: number;
  from: number; // first measure (inclusive)
  to: number; // last measure (exclusive)
}

/**
 * The full score of "Lux in tenebris", engraved statically from the same note data the
 * browser synthesises — every measure, wrapped into grand-staff systems down the page, so a
 * reader can actually read it. Reuses the live visualiser's engraving (clefs, note bodies,
 * pitch axis) and adds what a read score needs: accidentals (sharp/natural, remembered within
 * the bar) and ruled barlines. One canvas per system keeps memory sane on phones. Łukasz's
 * attribution is baked into every system, so any screenshot carries it.
 */
@Component({
  selector: 'app-score-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="score-page">
      <header class="score-head">
        <a routerLink="/" class="back">← <span>Wróć</span></a>
        <div class="titles">
          <h1>Lux in tenebris</h1>
          <p class="credit">{{ credit }}</p>
          <p class="sub">światło w ciemności — auto-grawerowane na żywo z danych nutowych utworu</p>
        </div>
      </header>

      <div class="systems" #wrap>
        @for (sys of systems(); track sys.i) {
          <canvas class="system" #sys></canvas>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .score-page {
        min-height: 100vh;
        padding: clamp(5.5rem, 9vh, 7rem) clamp(1rem, 4vw, 3rem) 4rem;
        background:
          radial-gradient(1100px 500px at 70% -10%, rgba(56, 189, 248, 0.06), transparent 60%),
          var(--bg-primary);
        color: var(--text-primary);
      }
      .score-head {
        max-width: 1100px;
        margin: 0 auto 2rem;
        display: flex;
        align-items: flex-start;
        gap: 1.5rem;
      }
      .back {
        flex: 0 0 auto;
        margin-top: 0.4rem;
        color: var(--text-secondary);
        text-decoration: none;
        font-size: 0.95rem;
        letter-spacing: 0.02em;
        transition: color 0.2s ease, transform 0.2s ease;
      }
      .back:hover { color: var(--color-primary); transform: translateX(-3px); }
      .back span { margin-left: 0.2rem; }
      .titles { flex: 1 1 auto; min-width: 0; }
      .score-head h1 {
        font-size: clamp(2rem, 6vw, 3.4rem);
        font-weight: 700;
        letter-spacing: -0.02em;
        margin: 0 0 0.35rem;
      }
      .credit {
        color: var(--color-primary);
        font-size: clamp(0.9rem, 2vw, 1.05rem);
        font-weight: 500;
        margin: 0 0 0.2rem;
      }
      .sub {
        color: var(--text-tertiary);
        font-style: italic;
        font-size: clamp(0.78rem, 1.8vw, 0.92rem);
        margin: 0;
      }
      .systems {
        max-width: 1100px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
      }
      canvas.system {
        display: block;
        width: 100%;
      }
    `,
  ],
})
export class ScorePageComponent implements AfterViewInit, OnDestroy {
  protected readonly credit = CREDIT;
  protected readonly systems = signal<Sys[]>([]);

  @ViewChild('wrap') private wrap?: ElementRef<HTMLElement>;
  @ViewChildren('sys') private canvases?: QueryList<ElementRef<HTMLCanvasElement>>;

  private notes: number[][] = [];
  private beatMs = 582.5;
  private readonly beatsPerBar = 4;
  private measuresPerSystem = 4;
  private dpr = 1;
  private gap = 9;
  private resizeRaf = 0;
  private readonly onResize = () => {
    if (this.resizeRaf) return;
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = 0;
      this.layout();
    });
  };

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    // Redraw whenever the per-system canvases (re)appear after a layout change.
    this.canvases?.changes.subscribe(() => queueMicrotask(() => this.renderAll()));
    window.addEventListener('resize', this.onResize, { passive: true });

    fetch('swiatlo.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || !d.notes) return;
        this.notes = d.notes;
        if (d.bpm) this.beatMs = 60000 / d.bpm;
        this.layout();
        setTimeout(() => this.renderAll(), 0); // first paint (in case canvases already existed)
      })
      .catch(() => {});
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.onResize);
    if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
  }

  /** Decide measures-per-system from the available width, then publish the systems list. */
  private layout(): void {
    const host = this.wrap?.nativeElement;
    if (!host || !this.notes.length) return;
    const w = host.clientWidth || 900;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.gap = Math.max(7, Math.min(10, w / 110));

    const barMs = this.beatMs * this.beatsPerBar;
    let end = 0;
    for (const n of this.notes) end = Math.max(end, n[0] + n[1]);
    const totalBars = Math.max(1, Math.ceil(end / barMs));

    const clefW = this.clefWidth();
    const target = this.gap * 22; // desired measure width
    this.measuresPerSystem = Math.max(2, Math.floor((w - this.pad() * 2 - clefW) / target));

    const sys: Sys[] = [];
    for (let i = 0, m = 0; m < totalBars; i++, m += this.measuresPerSystem) {
      sys.push({ i, from: m, to: Math.min(totalBars, m + this.measuresPerSystem) });
    }
    this.systems.set(sys);
  }

  private pad(): number {
    return 4;
  }
  private clefWidth(): number {
    const glyphScale = this.gap / 250;
    return 684 * glyphScale + this.gap * 4.5; // clef advance + room for the time signature
  }

  private renderAll(): void {
    const list = this.canvases?.toArray() ?? [];
    const sys = this.systems();
    if (list.length !== sys.length) return; // wait until the @for has caught up
    for (let i = 0; i < list.length; i++) this.renderSystem(list[i].nativeElement, sys[i]);
  }

  private renderSystem(canvas: HTMLCanvasElement, sys: Sys): void {
    const host = this.wrap?.nativeElement;
    if (!host) return;
    const gap = this.gap;
    const half = gap / 2;
    const pad = this.pad();
    const cssW = host.clientWidth || 900;
    const cssH = gap * 20; // staff span (10 gaps) + ledger headroom both sides
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * this.dpr);
    canvas.height = Math.round(cssH * this.dpr);
    const g = canvas.getContext('2d');
    if (!g) return;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, cssW, cssH);
    g.lineCap = 'round';

    const centerY = cssH / 2;
    const yOf = (s: number) => centerY - (s - C4_STEP) * half;
    const glyphScale = gap / 250;
    const clefW = this.clefWidth();
    const measureW = (cssW - pad * 2 - clefW) / this.measuresPerSystem;
    const contentLeft = pad + clefW;
    const lineRight = contentLeft + (sys.to - sys.from) * measureW;

    const trebleLines = [30, 32, 34, 36, 38];
    const bassLines = [18, 20, 22, 24, 26];
    const sysTop = yOf(38);
    const sysBot = yOf(18);
    const struct = 'rgba(56,189,248,0.34)';

    // five-line staves
    g.strokeStyle = struct;
    g.lineWidth = 0.85;
    for (const lines of [trebleLines, bassLines]) {
      for (const st of lines) {
        const y = yOf(st);
        g.beginPath(); g.moveTo(pad, y); g.lineTo(lineRight, y); g.stroke();
      }
    }
    // left brace + barlines (one per measure boundary, both staves)
    g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(pad, sysTop); g.lineTo(pad, sysBot); g.stroke();
    g.lineWidth = 0.85;
    for (let k = 0; k <= this.measuresPerSystem && sys.from + k <= sys.to; k++) {
      const x = contentLeft + k * measureW;
      if (x > lineRight + 0.5) break;
      g.beginPath(); g.moveTo(x, sysTop); g.lineTo(x, sysBot); g.stroke();
    }

    // clefs every system; the 4/4 only on the very first
    g.fillStyle = struct;
    g.save(); g.translate(pad + gap * 0.4, yOf(32)); g.scale(glyphScale, glyphScale); g.fill(new Path2D(GCLEF_PATH)); g.restore();
    g.save(); g.translate(pad + gap * 0.4, yOf(24)); g.scale(glyphScale, -glyphScale); g.fill(new Path2D(FCLEF_PATH)); g.restore();
    if (sys.i === 0) {
      const tsx = pad + gap * 0.4 + 684 * glyphScale + gap * 1.0;
      for (const mid of [TREB_MID, BASS_MID]) {
        for (const cy of [yOf(mid) - gap, yOf(mid) + gap]) {
          g.save(); g.translate(tsx, cy); g.scale(glyphScale, glyphScale); g.fill(new Path2D(TS4_PATH)); g.restore();
        }
      }
    }

    // notes, measure by measure, with within-bar accidental memory
    const barMs = this.beatMs * this.beatsPerBar;
    for (let mi = sys.from; mi < sys.to; mi++) {
      const mStart = mi * barMs;
      const mInSys = mi - sys.from;
      const mLeft = contentLeft + mInSys * measureW;
      const acc = new Map<number, 'sharp' | 'natural'>(); // step → current accidental this bar
      const inBar = this.notes
        .filter((n) => n[0] >= mStart - 1 && n[0] < mStart + barMs - 1)
        .sort((a, b) => a[0] - b[0] || a[2] - b[2]);

      for (const n of inBar) {
        const midi = n[2];
        const s = diat(midi);
        const beatFrac = Math.max(0, Math.min(0.999, (n[0] - mStart) / barMs));
        const x = mLeft + gap * 0.9 + beatFrac * (measureW - gap * 1.8);
        const y = yOf(s);
        const treble = midi >= 60;
        const staffMid = treble ? TREB_MID : BASS_MID;
        const sTop = treble ? yOf(38) : yOf(26);
        const sBot = treble ? yOf(30) : yOf(18);
        const gl = glyph(n[1] / this.beatMs);
        const col = ink(n[3], 1);

        // accidental (sharp on black keys; natural to cancel a same-bar sharp on the line)
        const want: 'sharp' | 'natural' = isBlack(midi) ? 'sharp' : 'natural';
        const cur = acc.get(s);
        const ax = x - gap * 1.5;
        if (want === 'sharp' && cur !== 'sharp') {
          drawSharp(g, ax, y, gap, col); acc.set(s, 'sharp');
        } else if (want === 'natural' && cur === 'sharp') {
          drawNatural(g, ax, y, gap, col); acc.set(s, 'natural');
        }

        drawNote(g, x, y, s, gl, s >= staffMid, col, gap, half, sTop, sBot);
      }
    }

    // attribution baked into every system, low and quiet — bottom-right
    g.fillStyle = 'rgba(56,189,248,0.28)';
    g.font = `${Math.round(gap * 1.05)}px ui-sans-serif, system-ui, sans-serif`;
    g.textAlign = 'right';
    g.textBaseline = 'bottom';
    g.fillText(CREDIT, lineRight, cssH - 1);
  }
}
