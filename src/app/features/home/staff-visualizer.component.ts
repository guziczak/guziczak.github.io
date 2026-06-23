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

  private midiToY(midi: number): number {
    const top = 24;
    const bottom = this.H - 24;
    const t = (midi - this.loMidi) / Math.max(1, this.hiMidi - this.loMidi);
    return bottom - t * (bottom - top);
  }

  private draw(): void {
    const g = this.g;
    if (!g) return;
    g.clearRect(0, 0, this.W, this.H);

    const A = 'rgba(56,189,248,'; // accent (light blue)
    const F = 'rgba(125,211,252,'; // faint

    // five-line staff across the middle band
    const top = 28;
    const gap = (this.H - 56) / 4;
    g.lineWidth = 1;
    g.strokeStyle = F + '0.15)';
    for (let i = 0; i < 5; i++) {
      const y = top + i * gap;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(this.W, y);
      g.stroke();
    }

    const headX = this.W * 0.26;
    const pps = 92; // pixels per second of scroll

    // playhead
    g.strokeStyle = A + '0.32)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(headX, 6);
    g.lineTo(headX, this.H - 6);
    g.stroke();

    const pos = this.player ? this.player.position() : -1;
    if (pos < 0) return;

    for (const n of this._notes) {
      const t = n[0] / 1000;
      const dur = n[1] / 1000;
      const x = headX + (t - pos) * pps;
      const w = Math.max(dur * pps, 5);
      if (x > this.W + 24 || x + w < -24) continue;
      const y = this.midiToY(n[2]);
      const on = pos >= t && pos <= t + dur;
      const past = pos > t + dur;
      const a = on ? 0.95 : past ? 0.1 : 0.42;

      // held-duration bar
      g.strokeStyle = A + (a * 0.5).toFixed(3) + ')';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + w, y);
      g.stroke();

      // notehead — glows while it sounds
      g.shadowBlur = on ? 14 : 0;
      g.shadowColor = 'rgba(56,189,248,0.8)';
      g.fillStyle = A + a.toFixed(3) + ')';
      g.beginPath();
      g.ellipse(x, y, 4.6, 3.4, -0.32, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
    }
  }
}
