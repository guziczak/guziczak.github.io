import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';

/**
 * The score, alive — a faint five-line staff at the foot of the page where the
 * notes and chords of "Lux in tenebris" flow past a playhead while the bell rings.
 * Canvas + requestAnimationFrame, driven by the player's live position(). Shows
 * only while playing; near-invisible otherwise.
 */
@Component({
  selector: 'app-staff-visualizer',
  standalone: true,
  template: `<div class="staff" [class.on]="_active"><canvas #cv></canvas></div>`,
  styles: [
    `
      .staff {
        position: fixed;
        left: 50%;
        bottom: clamp(1.25rem, 5vh, 3.25rem);
        transform: translateX(-50%);
        width: min(760px, 88vw);
        height: 104px;
        z-index: 40;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.7s ease;
        -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
        mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
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
          height: 82px;
          bottom: 0.75rem;
          width: 92vw;
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
    this.computeRange();
  }

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
  private loMidi = 60;
  private hiMidi = 72;
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

  private computeRange(): void {
    let lo = Infinity;
    let hi = -Infinity;
    for (const n of this._notes) {
      if (n[2] < lo) lo = n[2];
      if (n[2] > hi) hi = n[2];
    }
    if (!isFinite(lo)) {
      lo = 60;
      hi = 72;
    }
    this.loMidi = lo - 3;
    this.hiMidi = hi + 3;
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

  private draw(): void {
    const g = this.g;
    if (!g) return;
    const W = this.W;
    const H = this.H;
    g.clearRect(0, 0, W, H);

    // soft dark backing (vertical fade) so notes read against the drifting-code backdrop
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, 'rgba(9,13,23,0)');
    bg.addColorStop(0.5, 'rgba(9,13,23,0.5)');
    bg.addColorStop(1, 'rgba(9,13,23,0)');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    const A = '56,189,248'; // accent rgb
    const top = 30;
    const gap = (H - 60) / 4;
    const half = gap / 2;
    const midY = top + 2 * gap;
    const headX = W * 0.27;
    const pps = 90; // pixels per second of scroll

    // five-line staff
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(' + A + ',0.22)';
    for (let i = 0; i < 5; i++) {
      const y = top + i * gap;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }

    // playhead
    g.strokeStyle = 'rgba(' + A + ',0.3)';
    g.lineWidth = 1.25;
    g.beginPath();
    g.moveTo(headX, top - half);
    g.lineTo(headX, top + 4 * gap + half);
    g.stroke();

    const pos = this.player ? this.player.position() : -1;
    if (pos < 0) return;

    const refMidi = (this.loMidi + this.hiMidi) / 2;
    const semi = gap * 0.3; // vertical spacing per semitone (~an octave over ~3.3 gaps)

    for (const n of this._notes) {
      const t = n[0] / 1000;
      const x = headX + (t - pos) * pps;
      if (x < -18 || x > W + 18) continue;
      const dur = n[1] / 1000;
      const on = pos >= t && pos <= t + dur;
      const past = pos > t + dur;
      if (past && pos - (t + dur) > 1.6) continue; // drop the old trail
      const a = on ? 1 : past ? 0.18 : 0.5;

      // snap to lines & spaces so it reads as notation, not a piano roll
      let y = midY - (n[2] - refMidi) * semi;
      y = Math.round(y / half) * half;

      // ledger lines above / below the staff
      g.strokeStyle = 'rgba(' + A + ',' + (a * 0.5).toFixed(3) + ')';
      g.lineWidth = 1;
      for (let ly = top - gap; ly >= y - 0.5; ly -= gap) {
        g.beginPath();
        g.moveTo(x - 9, ly);
        g.lineTo(x + 9, ly);
        g.stroke();
      }
      for (let ly = top + 5 * gap; ly <= y + 0.5; ly += gap) {
        g.beginPath();
        g.moveTo(x - 9, ly);
        g.lineTo(x + 9, ly);
        g.stroke();
      }

      // stem — up for low notes, down for high (classic notation)
      const stemUp = y >= midY;
      const stemLen = gap * 2.6;
      g.strokeStyle = 'rgba(' + A + ',' + (a * 0.85).toFixed(3) + ')';
      g.lineWidth = 1.4;
      g.beginPath();
      if (stemUp) {
        g.moveTo(x + 5, y);
        g.lineTo(x + 5, y - stemLen);
      } else {
        g.moveTo(x - 5, y);
        g.lineTo(x - 5, y + stemLen);
      }
      g.stroke();

      // notehead — glows while it sounds
      g.shadowBlur = on ? 16 : 0;
      g.shadowColor = 'rgba(' + A + ',0.9)';
      g.fillStyle = 'rgba(' + A + ',' + a.toFixed(3) + ')';
      g.beginPath();
      g.ellipse(x, y, 5.6, 4.1, -0.35, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
    }
  }
}
