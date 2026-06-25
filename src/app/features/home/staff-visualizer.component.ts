import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';

/**
 * The score, alive — a faint treble staff at the foot of the page where the
 * notes of "Lux in tenebris" flow past a playhead while the bell rings.
 * Real engraving, not a piano roll: a G-clef and 4/4 anchor the left, noteheads
 * sit on their true treble-clef lines/spaces (B4 = middle line) with ledger
 * lines as needed, and each note wears the right body for its value — open or
 * filled head, stem, flags, dot. Measures are ruled by barlines; notes scroll
 * right→left and dissolve just before the clef. Canvas + requestAnimationFrame,
 * driven by the player's live position(). Shows only while playing.
 */

// Treble staff is anchored on B4 (the middle line). Vertical position is by
// diatonic step (line→adjacent space = one step = half a staff gap), so notes
// read at their real pitch height under a G-clef.
const MID_STEP = 34; // B4
// chromatic pitch-class → natural letter step (C D E F G A B = 0..6)
const PCMAP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const ACC = '56,189,248'; // accent rgb

interface Glyph {
  fill: boolean;
  stem: boolean;
  flags: number;
  dot: boolean;
}

@Component({
  selector: 'app-staff-visualizer',
  standalone: true,
  template: `<div class="staff" [class.on]="_active"><canvas #cv></canvas></div>`,
  styles: [
    `
      .staff {
        position: fixed;
        left: 50%;
        bottom: clamp(1rem, 4vh, 2.75rem);
        transform: translateX(-50%);
        width: min(820px, 92vw);
        height: 150px;
        z-index: 40;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.7s ease;
        /* fade only the right edge so notes drift in gently; the left stays
           crisp for the clef (notes dissolve into it via canvas alpha). */
        -webkit-mask-image: linear-gradient(90deg, #000 0%, #000 85%, transparent 100%);
        mask-image: linear-gradient(90deg, #000 0%, #000 85%, transparent 100%);
      }
      .staff.on {
        opacity: 1;
      }
      canvas {
        width: 100%;
        height: 100%;
        display: block;
      }
      @media (max-width: 640px) {
        .staff {
          height: 118px;
          bottom: 0.75rem;
          width: 94vw;
        }
      }
    `,
  ],
})
export class StaffVisualizerComponent implements AfterViewInit, OnDestroy {
  @Input() player: { position(): number } | null = null;

  private _notes: number[][] = [];
  @Input() set notes(v: number[][]) {
    this._notes = v || [];
  }

  /** Quarter-note length in ms, from the score's tempo. Drives note values & barlines. */
  @Input() beatMs = 582.5;
  /** Beats per measure (4/4). */
  @Input() beatsPerBar = 4;

  _active = false;
  @Input() set active(v: boolean) {
    this._active = v;
    this.sync();
  }

  @ViewChild('cv') private cvRef?: ElementRef<HTMLCanvasElement>;
  private g: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private ready = false;
  private dpr = 1;
  private W = 0;
  private H = 0;
  private readonly onResize = () => this.resize();

  ngAfterViewInit(): void {
    if (typeof window === 'undefined' || !this.cvRef) return;
    this.g = this.cvRef.nativeElement.getContext('2d');
    this.ready = true;
    this.resize();
    window.addEventListener('resize', this.onResize, { passive: true });
    this.sync();
  }

  ngOnDestroy(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.onResize);
  }

  private resize(): void {
    const c = this.cvRef?.nativeElement;
    if (!c) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = c.clientWidth;
    this.H = c.clientHeight;
    c.width = Math.round(this.W * this.dpr);
    c.height = Math.round(this.H * this.dpr);
    this.g?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private sync(): void {
    if (!this.ready) return;
    if (this._active) {
      if (!this.raf) this.raf = requestAnimationFrame(this.loop);
    } else if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.g?.clearRect(0, 0, this.W, this.H);
    }
  }

  private readonly loop = (): void => {
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  // midi → diatonic step (line→space = +1). Accidentals fold onto their natural line.
  private diat(m: number): number {
    const pc = ((m % 12) + 12) % 12;
    return (Math.floor(m / 12) - 1) * 7 + PCMAP[pc];
  }

  // note value (in beats) → engraved body
  private glyph(b: number): Glyph {
    if (b >= 3.5) return { fill: false, stem: false, flags: 0, dot: false }; // whole
    if (b >= 2.5) return { fill: false, stem: true, flags: 0, dot: true }; //  dotted half
    if (b >= 1.75) return { fill: false, stem: true, flags: 0, dot: false }; // half
    if (b >= 1.25) return { fill: true, stem: true, flags: 0, dot: true }; //   dotted quarter
    if (b >= 0.875) return { fill: true, stem: true, flags: 0, dot: false }; // quarter
    if (b >= 0.625) return { fill: true, stem: true, flags: 1, dot: true }; //  dotted eighth
    if (b >= 0.375) return { fill: true, stem: true, flags: 1, dot: false }; // eighth
    return { fill: true, stem: true, flags: 2, dot: false }; //                 sixteenth
  }

  private draw(): void {
    const g = this.g;
    if (!g) return;
    const W = this.W;
    const H = this.H;
    const clamp = (v: number, a: number, z: number) => (v < a ? a : v > z ? z : v);
    g.clearRect(0, 0, W, H);

    // soft dark backing so notes read against the drifting-code backdrop
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, 'rgba(9,13,23,0)');
    bg.addColorStop(0.5, 'rgba(9,13,23,0.55)');
    bg.addColorStop(1, 'rgba(9,13,23,0)');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    const gap = clamp(H / 15, 7.5, 10.5);
    const half = gap / 2;
    const midY = Math.round(H * 0.42);
    const staffTop = midY - 2 * gap; // F5 line
    const staffBot = midY + 2 * gap; // E4 line
    const yOf = (s: number) => midY - (s - MID_STEP) * half;
    const clefRight = gap * 4.2;
    const sigRight = clefRight + gap * 1.8;
    const headX = Math.max(W * 0.3, sigRight + 70);
    const pps = 90; // scroll: pixels per second
    const fadeStart = sigRight + 2;
    const fadeLen = gap * 3.2;
    const barMs = this.beatMs * this.beatsPerBar;

    // five-line staff
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(' + ACC + ',0.2)';
    for (let i = 0; i < 5; i++) {
      const y = staffTop + i * gap;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }

    const pos = this.player ? this.player.position() : -1;

    // barlines — ruled per measure, scrolling with the music
    if (pos >= 0 && barMs > 0) {
      for (let k = 0; ; k++) {
        const x = headX + (k * (barMs / 1000) - pos) * pps;
        if (x > W + 2) break;
        if (x < fadeStart - 2) continue;
        const a = clamp((x - fadeStart) / fadeLen, 0, 1) * 0.15;
        g.strokeStyle = 'rgba(' + ACC + ',' + a.toFixed(3) + ')';
        g.beginPath();
        g.moveTo(x, staffTop);
        g.lineTo(x, staffBot);
        g.stroke();
      }
    }

    // playhead — "now"
    g.strokeStyle = 'rgba(' + ACC + ',0.26)';
    g.lineWidth = 1.25;
    g.beginPath();
    g.moveTo(headX, staffTop - half);
    g.lineTo(headX, staffBot + half);
    g.stroke();
    g.fillStyle = 'rgba(' + ACC + ',0.5)';
    g.beginPath();
    g.arc(headX, staffTop - half, 1.8, 0, Math.PI * 2);
    g.fill();

    // treble clef (G-clef), curl on the G4 line; then the 4/4
    g.save();
    g.fillStyle = 'rgba(' + ACC + ',0.46)';
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.font = gap * 7 + 'px "Bravura","Segoe UI Symbol","Apple Symbols","Noto Music",serif';
    g.fillText('𝄞', 6, staffBot + gap * 1.15);
    g.fillStyle = 'rgba(' + ACC + ',0.4)';
    g.textAlign = 'center';
    g.font = 'bold ' + gap * 1.85 + 'px Georgia,serif';
    g.fillText('4', clefRight + gap * 0.9, midY - half + 1);
    g.fillText('4', clefRight + gap * 0.9, staffBot - 1);
    g.restore();

    if (pos < 0) return;

    for (const n of this._notes) {
      const t = n[0] / 1000;
      const x = headX + (t - pos) * pps;
      if (x < fadeStart - 14 || x > W + 16) continue;
      const dur = n[1] / 1000;
      const b = n[1] / this.beatMs;
      const on = pos >= t && pos <= t + dur;
      const past = pos > t + dur;
      if (past && pos - (t + dur) > 1.8) continue; // drop the old trail
      const gl = this.glyph(b);
      let base = on ? 1 : past ? 0.24 : 0.6;
      if (!gl.fill) base *= 0.85; // sustained pads whisper; the melody sings
      const a =
        base * clamp((x - fadeStart) / fadeLen, 0, 1) * clamp((W - x) / 46, 0, 1);
      if (a <= 0.015) continue;

      const s = this.diat(n[2]);
      const y = clamp(yOf(s), 10, H - 12);
      this.note(g, x, y, s, gl, s >= MID_STEP, a, gap, half, staffTop, staffBot, on);
    }
  }

  private note(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    s: number,
    gl: Glyph,
    stemDown: boolean,
    a: number,
    gap: number,
    half: number,
    staffTop: number,
    staffBot: number,
    on: boolean,
  ): void {
    const nrx = 4.6;
    const nry = 3.4;

    // ledger lines above / below (capped so extremes never sprawl)
    g.strokeStyle = 'rgba(' + ACC + ',' + (a * 0.5).toFixed(3) + ')';
    g.lineWidth = 1;
    let c = 0;
    for (let ly = staffTop - gap; ly >= y - 0.5 && c < 5; ly -= gap, c++) {
      g.beginPath();
      g.moveTo(x - 8.5, ly);
      g.lineTo(x + 8.5, ly);
      g.stroke();
    }
    c = 0;
    for (let ly = staffBot + gap; ly <= y + 0.5 && c < 5; ly += gap, c++) {
      g.beginPath();
      g.moveTo(x - 8.5, ly);
      g.lineTo(x + 8.5, ly);
      g.stroke();
    }

    // stem (up for low notes, down for high) + flags
    if (gl.stem) {
      const sx = stemDown ? x - nrx + 0.4 : x + nrx - 0.4;
      const len = gap * 3.25 + (gl.flags ? gap * 0.5 : 0);
      const tip = stemDown ? y + len : y - len;
      g.strokeStyle = 'rgba(' + ACC + ',' + (a * 0.9).toFixed(3) + ')';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(sx, y);
      g.lineTo(sx, tip);
      g.stroke();
      if (gl.flags) {
        g.lineWidth = 1.5;
        for (let f = 0; f < gl.flags; f++) {
          const fy = tip + (stemDown ? -1 : 1) * f * gap * 0.85;
          g.beginPath();
          g.moveTo(sx, fy);
          if (stemDown) {
            g.quadraticCurveTo(sx + gap * 1.05, fy + gap * 0.45, sx + gap * 0.5, fy + gap * 1.45);
          } else {
            g.quadraticCurveTo(sx + gap * 1.05, fy - gap * 0.45, sx + gap * 0.5, fy - gap * 1.45);
          }
          g.stroke();
        }
      }
    }

    // notehead — glows while it sounds
    const col = 'rgba(' + ACC + ',' + a.toFixed(3) + ')';
    g.save();
    if (on) {
      g.strokeStyle = 'rgba(' + ACC + ',' + (a * 0.28).toFixed(3) + ')';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(x, y, 9, 0, Math.PI * 2);
      g.stroke();
      g.shadowBlur = 14;
      g.shadowColor = 'rgba(' + ACC + ',0.9)';
    }
    g.translate(x, y);
    g.rotate(-0.34);
    g.beginPath();
    g.ellipse(0, 0, nrx, nry, 0, 0, Math.PI * 2);
    if (gl.fill) {
      g.fillStyle = col;
      g.fill();
    } else {
      g.lineWidth = 1.7;
      g.strokeStyle = col;
      g.stroke();
    }
    g.restore();

    // augmentation dot — raised into the space when the head sits on a line
    if (gl.dot) {
      const dy = s % 2 === 0 ? y - half : y;
      g.fillStyle = col;
      g.beginPath();
      g.arc(x + nrx + 4.5, dy, 1.5, 0, Math.PI * 2);
      g.fill();
    }
  }
}
