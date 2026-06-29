import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';

/**
 * The score, alive — a faint grand staff at the foot of the page where the
 * notes of "Lux in tenebris" flow past a playhead while the bell rings.
 * Real engraving, not a piano roll: a treble staff (G-clef) over a bass staff
 * (F-clef), bound into one system, each with its own 4/4. The piece spans five
 * octaves (E1–F6), so notes route to a staff at middle C and sit on their true
 * lines/spaces with ledger lines as needed; each wears the right body for its
 * value — open or filled head, stem, flags, dot. Measures are ruled by barlines
 * across both staves; notes scroll right→left and dissolve just before the clefs.
 * Canvas + requestAnimationFrame, driven by the player's live position(). Shows
 * only while playing.
 */

// The grand staff rides one continuous diatonic axis. C4 (middle C) is its centre —
// the ledger line floating between the two staves; the treble staff is centred on
// B4, the bass staff on D3. Vertical position is by diatonic step (line→adjacent
// space = one step = half a staff gap), so notes read at their real pitch height.
const C4_STEP = 28; // middle C — centre of the system
const TREB_MID = 34; // B4 — middle line of the treble staff
const BASS_MID = 22; // D3 — middle line of the bass staff
// chromatic pitch-class → natural letter step (C D E F G A B = 0..6)
const PCMAP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const ACC = '56,189,248'; // accent rgb (the notes — cold, warming to gold by velocity)
const PARCH = ACC; // structure stays cold & quiet — the cathedral doesn't shout; only the notes warm to gold

// Clefs and time-signature "4" — baked Bravura (SMuFL) outlines, so they sit exactly
// where real engraving puts them and look identical on every device. No font is
// shipped — just these vector paths. Coordinates are in font units (em = 1000,
// 1 staff space = 250 units, y-DOWN, baseline at y = 0): the G-clef's baseline is the
// G line (2nd from the bottom); each "4" is centred on its own baseline.
const GCLEF_PATH =
  'M376-415C374-427 376-428 382-434C490-535 572-662 572-815C572-902 548-988 507-1048C492-1070 466-1098 455-1098C441-1098 410-1072 390-1050C316-968 292-843 292-739C292-681 299-616 306-575C308-563 309-561 297-551C153-432 0-289 0-87C0 87 119 252 364 252C387 252 413 250 433 246C444 244 446 243 448 255C460 322 475 409 475 456C475 604 375 622 316 622C262 622 236 606 236 593C236 586 245 583 268 576C299 567 335 540 335 482C335 427 300 380 239 380C172 380 132 433 132 495C132 560 171 658 322 658C389 658 519 628 519 458C519 401 501 306 490 244C488 232 489 233 503 227C604 187 671 102 671-11C671-139 577-252 430-252C404-252 404-252 401-270M470-943C503-943 530-916 530-861C530-750 435-660 356-591C349-585 345-586 343-599C339-625 337-659 337-691C337-847 409-943 470-943M361-262C364-243 364-244 346-238C258-208 201-129 201-44C201 46 248 110 316 133C324 136 336 139 343 139C351 139 355 134 355 128C355 121 347 118 340 115C298 97 268 54 268 8C268-49 307-92 368-109C384-113 386-112 388-101L438 197C440 208 439 208 424 211C408 214 388 216 368 216C193 216 80 119 80-20C80-79 90-158 173-252C233-319 279-356 326-394C336-402 338-401 340-390M430-103C428-115 429-118 441-117C522-110 589-42 589 46C589 109 551 160 495 188C483 194 481 194 479 182';
const TS4_PATH =
  'M362 74L362-140C362-148 361-157 350-157C341-157 336-155 330-148L235-33C231-28 226-22 226-10L226 74L91 74C171 6 331-221 334-233L335-236C335-245 328-251 320-251C311-251 270-249 252-249C234-249 189-251 181-251C172-251 158-248 158-232C158-108 60 31 30 73L24 81C24 81 24 82 24 82L23 83C21 88 20 92 20 95C20 105 28 112 40 112L226 112L226 175C226 202 204 210 186 210C170 210 163 219 163 229C163 239 167 250 182 250L395 250C405 250 415 243 415 229C415 215 403 209 393 209C383 209 362 203 362 171L362 112L435 112C445 112 450 105 450 93C450 81 446 74 435 74';
// Bass clef (F-clef) — the RAW Bravura outline, still in font space (y-UP, origin on
// the F line, its two dots straddling it ±½ space). Unlike the two above it isn't
// pre-flipped to y-DOWN, so it's drawn with a negated y-scale. SMuFL advance = 684.
const FCLEF_PATH =
  'M252 262c173 0 279 -116 279 -290c0 -304 -260 -482 -506 -602c-6 -3 -12 -5 -17 -5c-9 0 -13 6 -13 12c0 8 6 13 15 18c233 133 371 289 371 568c0 157 -46 261 -152 261c-102 0 -162 -73 -162 -113c0 -10 3 -18 16 -18s23 7 50 7c49 0 96 -40 96 -104c0 -62 -43 -106 -106 -106c-81 0 -123 69 -123 149c0 96 78 223 252 223zM629 180c31 0 55 -24 55 -55s-24 -55 -55 -55s-55 24 -55 55s24 55 55 55zM630 -71c31 0 54 -23 54 -54s-23 -54 -54 -54s-54 23 -54 54s23 54 54 54z';

interface Glyph {
  fill: boolean;
  stem: boolean;
  flags: number;
  dot: boolean;
  whole: boolean;
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
        /* Sits BEHIND the manifesto text (z-index 2) but above the section background — the
           score shows through the type instead of overprinting the CTA. Over the other
           (non-positioned) sections it still floats at the foot as before. */
        z-index: 1;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.7s ease;
        /* both ends dissolve into the dark of the nave — soft, like a burnt manuscript. */
        -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 7%, #000 88%, transparent 100%);
        mask-image: linear-gradient(90deg, transparent 0%, #000 7%, #000 88%, transparent 100%);
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
          height: 125px;
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
  /** note(ref) -> beam-group info, precomputed from the score (engraved beams, not flags). */
  private beamOf = new Map<
    number[],
    { stemDown: boolean; firstRef: number[]; lastRef: number[]; nextRef: number[] | null; flags: number }
  >();
  @Input() set notes(v: number[][]) {
    this._notes = v || [];
    this.computeBeams();
  }

  /** Quarter-note length in ms, from the score's tempo. Drives note values & barlines. */
  @Input() beatMs = 582.5;
  /** Beats per measure (4/4). */
  @Input() beatsPerBar = 4;
  /** Visual count-in length (s) — how long notes roll in from the right edge before sounding. */
  @Input() leadInSec = 2.33;

  _active = false;
  @Input() set active(v: boolean) {
    this._active = v;
    this.sync();
  }

  @ViewChild('cv') private cvRef?: ElementRef<HTMLCanvasElement>;
  private g: CanvasRenderingContext2D | null = null;
  private gClef?: Path2D; // baked clef / time-sig outlines, built once on first paint
  private fClef?: Path2D;
  private ts4?: Path2D;
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
    if (b >= 3.5) return { fill: false, stem: false, flags: 0, dot: false, whole: true }; // whole
    if (b >= 2.5) return { fill: false, stem: true, flags: 0, dot: true, whole: false }; //  dotted half
    if (b >= 1.75) return { fill: false, stem: true, flags: 0, dot: false, whole: false }; // half
    if (b >= 1.25) return { fill: true, stem: true, flags: 0, dot: true, whole: false }; //   dotted quarter
    if (b >= 0.875) return { fill: true, stem: true, flags: 0, dot: false, whole: false }; // quarter
    if (b >= 0.625) return { fill: true, stem: true, flags: 1, dot: true, whole: false }; //  dotted eighth
    if (b >= 0.375) return { fill: true, stem: true, flags: 1, dot: false, whole: false }; // eighth
    return { fill: true, stem: true, flags: 2, dot: false, whole: false }; //                 sixteenth
  }

  /** Group consecutive single-onset eighths/sixteenths within one beat & staff so they can be
   *  beamed (as real engraving does) instead of each wearing a flag. Chords (notes sharing an
   *  onset) and quarter-or-longer values break the run. Precomputed once when the score loads. */
  private computeBeams(): void {
    this.beamOf.clear();
    const ns = this._notes;
    if (!ns.length) return;
    const beat = this.beatMs;
    const order = ns
      .map((_, i) => i)
      .sort((a, b) => ns[a][0] - ns[b][0] || ns[a][2] - ns[b][2]);
    let group: number[] = [];
    let curKey = '';
    let prevStart = -1e9;
    const flush = () => {
      if (group.length >= 2) {
        let sum = 0;
        for (const i of group) sum += this.diat(ns[i][2]);
        const treble = ns[group[0]][2] >= 60;
        const staffMid = treble ? TREB_MID : BASS_MID;
        const stemDown = sum / group.length >= staffMid;
        const firstRef = ns[group[0]];
        const lastRef = ns[group[group.length - 1]];
        for (let k = 0; k < group.length; k++) {
          const i = group[k];
          this.beamOf.set(ns[i], {
            stemDown,
            firstRef,
            lastRef,
            nextRef: k < group.length - 1 ? ns[group[k + 1]] : null,
            flags: this.glyph(ns[i][1] / beat).flags,
          });
        }
      }
      group = [];
    };
    for (const i of order) {
      const n = ns[i];
      const flags = this.glyph(n[1] / beat).flags;
      const chord = Math.abs(n[0] - prevStart) < 25; // same onset = chord member, never beamed
      const key = (n[2] >= 60 ? 'T' : 'B') + Math.floor(n[0] / beat);
      if (flags < 1 || chord || key !== curKey) flush();
      if (flags >= 1 && !chord) {
        curKey = key;
        group.push(i);
        prevStart = n[0];
      } else if (!chord) {
        curKey = '';
      }
    }
    flush();
  }

  // small, stable per-note pseudo-random in [-1,1) — the "hand" that keeps
  // nothing looking machine-stamped (seeded by the note, so it never jitters per frame).
  private jit(s: number): number {
    const v = Math.sin(s) * 43758.5453;
    return (v - Math.floor(v)) * 2 - 1;
  }

  // Note ink: cyan when soft, warming toward bronze the harder it's struck — so the loud
  // finale glows gold, echoing the apse light. (Velocity 40→120 maps cyan→bronze.)
  private ink(vel: number, alpha: number): string {
    const t = Math.max(0, Math.min(1, (vel - 40) / 80));
    const r = Math.round(56 + (245 - 56) * t);
    const g = Math.round(189 + (206 - 189) * t);
    const b = Math.round(248 + (140 - 248) * t);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha.toFixed(3) + ')';
  }

  private draw(): void {
    const g = this.g;
    if (!g) return;
    const W = this.W;
    const H = this.H;
    const clamp = (v: number, a: number, z: number) => (v < a ? a : v > z ? z : v);
    g.clearRect(0, 0, W, H);
    g.lineCap = 'round'; // softer, inked stroke ends

    // soft dark backing so notes read against the drifting-code backdrop
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, 'rgba(9,13,23,0)');
    bg.addColorStop(0.5, 'rgba(9,13,23,0.55)');
    bg.addColorStop(1, 'rgba(9,13,23,0)');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    const gap = clamp(H / 16.5, 6.5, 10);
    const half = gap / 2;
    // One continuous pitch axis carries both staves; middle C (C4) is its centre —
    // the ledger line floating in the gap between the treble and bass staves.
    const sysMidY = Math.round(H * 0.5);
    const yOf = (s: number) => sysMidY - (s - C4_STEP) * half;
    const glyphScale = gap / 250; // SMuFL: 1 staff space = 250 font units
    const trebleLines = [30, 32, 34, 36, 38]; // E4 G4 B4 D5 F5
    const bassLines = [18, 20, 22, 24, 26]; //   G2 B2 D3 F3 A3
    const trebleTop = yOf(38);
    const trebleBot = yOf(30);
    const bassTop = yOf(26);
    const bassBot = yOf(18);
    const sysTop = trebleTop; // the system's full vertical span
    const sysBot = bassBot;
    const gLineY = yOf(32); // G4 line — treble clef's baseline anchor
    const fLineY = yOf(24); // F3 line — bass clef's origin (its dots straddle it)
    const clefRight = 4 + 684 * glyphScale; // widest clef advance width
    const sigCx = clefRight + gap * 1.3; // time-signature centre x
    const sigRight = sigCx + 235 * glyphScale + 3;
    const headX = Math.max(W * 0.3, sigRight + 70);
    const pps = 90; // scroll: pixels per second
    const fadeStart = sigRight + 2;
    const fadeLen = gap * 3.2;
    const barMs = this.beatMs * this.beatsPerBar;
    const lead = this.leadInSec + 0.3; // count-in window: notes roll in from the right edge during it

    // the grand staff — two five-line staves drawn as candlelit parchment: hair-thin lines
    // that dissolve into the dark at BOTH ends (fade points jittered per line, so the edge
    // frays softly like a burnt manuscript) and glow brightest through the centre pool.
    g.lineWidth = 0.75;
    for (const lines of [trebleLines, bassLines]) {
      for (const st of lines) {
        const y = yOf(st);
        const xIn = Math.max(0.02, 0.055 + this.jit(st * 1.7 + 2.3) * 0.025);
        const xOut = Math.min(0.985, 0.83 + this.jit(st * 2.9 + 5.1) * 0.05);
        const grad = g.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, 'rgba(' + PARCH + ',0)');
        grad.addColorStop(xIn, 'rgba(' + PARCH + ',0.15)');
        grad.addColorStop(0.5, 'rgba(' + PARCH + ',0.22)'); // candlelight pool
        grad.addColorStop(xOut, 'rgba(' + PARCH + ',0.12)');
        grad.addColorStop(1, 'rgba(' + PARCH + ',0)');
        g.strokeStyle = grad;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(W, y);
        g.stroke();
      }
    }
    // (no hard binding bar — the dissolve keeps both ends of the system soft)

    const pos = this.player ? this.player.position() : -1;

    // barlines — ruled per measure, scrolling with the music, spanning both staves
    if (pos >= -lead && barMs > 0) {
      for (let k = 0; ; k++) {
        const x = headX + (k * (barMs / 1000) - pos) * pps;
        if (x > W + 2) break;
        if (x < fadeStart - 2) continue;
        const a = clamp((x - fadeStart) / fadeLen, 0, 1) * 0.15;
        g.strokeStyle = 'rgba(' + PARCH + ',' + a.toFixed(3) + ')';
        g.beginPath();
        g.moveTo(x, sysTop);
        g.lineTo(x, sysBot);
        g.stroke();
      }
    }

    // playhead — "now"
    g.strokeStyle = 'rgba(' + PARCH + ',0.26)';
    g.lineWidth = 1.25;
    g.beginPath();
    g.moveTo(headX, sysTop - half);
    g.lineTo(headX, sysBot + half);
    g.stroke();
    g.fillStyle = 'rgba(' + PARCH + ',0.5)';
    g.beginPath();
    g.arc(headX, sysTop - half, 1.8, 0, Math.PI * 2);
    g.fill();

    // clefs + 4/4 — baked Bravura outlines, registered like real engraving. The
    // treble clef's baseline rides the G line; the bass clef's origin sits on the F
    // line (drawn from the raw y-up font path, hence the flipped y-scale); each "4"
    // is centred in its staff.
    if (!this.gClef) this.gClef = new Path2D(GCLEF_PATH);
    if (!this.fClef) this.fClef = new Path2D(FCLEF_PATH);
    if (!this.ts4) this.ts4 = new Path2D(TS4_PATH);
    g.fillStyle = 'rgba(' + PARCH + ',0.5)';
    g.save();
    g.translate(4, gLineY);
    g.scale(glyphScale, glyphScale);
    g.fill(this.gClef);
    g.restore();
    g.save();
    g.translate(4, fLineY);
    g.scale(glyphScale, -glyphScale); // raw font path is y-up; flip it onto the canvas
    g.fill(this.fClef);
    g.restore();
    g.fillStyle = 'rgba(' + PARCH + ',0.46)';
    for (const midStep of [TREB_MID, BASS_MID]) {
      for (const cy of [yOf(midStep) - gap, yOf(midStep) + gap]) {
        g.save();
        g.translate(sigCx - 235 * glyphScale, cy);
        g.scale(glyphScale, glyphScale);
        g.fill(this.ts4);
        g.restore();
      }
    }

    if (pos < -lead) return;

    for (const n of this._notes) {
      const t = n[0] / 1000;
      const x0 = headX + (t - pos) * pps;
      if (x0 < fadeStart - 14 || x0 > W + 16) continue;
      const dur = n[1] / 1000;
      const b = n[1] / this.beatMs;
      const on = pos >= t && pos <= t + dur;
      const past = pos > t + dur;
      if (past && pos - (t + dur) > 1.8) continue; // drop the old trail
      const gl = this.glyph(b);
      let base = on ? 1 : past ? 0.24 : 0.6;
      if (!gl.fill) base *= 0.85; // sustained pads whisper; the melody sings
      const a =
        base * clamp((x0 - fadeStart) / fadeLen, 0, 1) * clamp((W - x0) / 46, 0, 1);
      if (a <= 0.015) continue;

      // route each note to its staff at middle C, then place it on the shared axis
      const treble = n[2] >= 60;
      const staffMid = treble ? TREB_MID : BASS_MID;
      const sTop = treble ? trebleTop : bassTop;
      const sBot = treble ? trebleBot : bassBot;

      // a little stable hand-wobble per note, so nothing looks machine-stamped
      const seed = n[0] * 0.0173 + n[2] * 0.911;
      const vel = n[3]; // velocity → warmth: soft notes stay cyan, struck notes glow gold
      const s = this.diat(n[2]);
      const bi = this.beamOf.get(n);
      // Beamed notes are drawn crisp (no hand-wobble) so the beam reads as a straight rule.
      const x = bi ? x0 : x0 + this.jit(seed + 1.7) * 0.7;
      const y = clamp(yOf(s) + (bi ? 0 : this.jit(seed + 3.1) * 0.7), 10, H - 12);

      // Beamed run: one shared (possibly sloped) beam through the group's stem ends, the
      // stem reaching up/down to it, no flag — real engraving. Sixteenths get a 2nd beam.
      let beamTipY: number | null = null;
      if (bi) {
        const nrx = 4.6;
        const sd = bi.stemDown ? 1 : -1;
        const stemLen = gap * 3.25;
        const sxOf = (xx: number) => (bi.stemDown ? xx - nrx + 0.4 : xx + nrx - 0.4);
        const tipAt = (ref: number[]) => clamp(yOf(this.diat(ref[2])), 10, H - 12) + sd * stemLen;
        const sxf = sxOf(headX + (bi.firstRef[0] / 1000 - pos) * pps);
        const sxl = sxOf(headX + (bi.lastRef[0] / 1000 - pos) * pps);
        const tf = tipAt(bi.firstRef);
        const slope = sxl === sxf ? 0 : (tipAt(bi.lastRef) - tf) / (sxl - sxf);
        const beamYat = (xx: number) => tf + slope * (sxOf(xx) - sxf);
        beamTipY = beamYat(x);
        if (bi.nextRef) {
          const xn = headX + (bi.nextRef[0] / 1000 - pos) * pps;
          const bw = Math.max(2, gap * 0.55);
          g.lineCap = 'butt';
          g.strokeStyle = this.ink(vel, a * 0.9);
          g.lineWidth = bw;
          g.beginPath();
          g.moveTo(sxOf(x), beamTipY);
          g.lineTo(sxOf(xn), beamYat(xn));
          g.stroke();
          const nb = this.beamOf.get(bi.nextRef);
          if (bi.flags >= 2 && nb && nb.flags >= 2) {
            const off = sd * (bw + 1.5);
            g.lineWidth = Math.max(1.6, gap * 0.42);
            g.beginPath();
            g.moveTo(sxOf(x), beamTipY + off);
            g.lineTo(sxOf(xn), beamYat(xn) + off);
            g.stroke();
          }
          g.lineCap = 'round';
        }
      }

      this.note(g, x, y, s, gl, bi ? bi.stemDown : s >= staffMid, a, gap, half, sTop, sBot, on, seed, vel, beamTipY);
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
    seed: number,
    vel: number,
    beamStemTipY: number | null = null,
  ): void {
    const nrx = 4.6;

    // ledger lines above / below (capped so extremes never sprawl)
    g.strokeStyle = 'rgba(' + PARCH + ',' + (a * 0.5).toFixed(3) + ')';
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
      const beamed = beamStemTipY != null;
      const len = gap * 3.25 + (gl.flags && !beamed ? gap * 0.5 : 0);
      const tip = beamed ? beamStemTipY! : stemDown ? y + len : y - len;
      g.strokeStyle = this.ink(vel, a * 0.9);
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(sx, y);
      g.lineTo(sx, tip);
      g.stroke();
      if (gl.flags && !beamed) {
        // Filled flags that curl back toward the head — so they hang down off an
        // up-stem and rise off a down-stem (the same banner, vertically mirrored,
        // as real engraving draws it). They stack from the stem's free end inward.
        const d = stemDown ? -1 : 1;
        g.fillStyle = this.ink(vel, a * 0.9);
        for (let f = 0; f < gl.flags; f++) {
          const fy = tip + d * f * gap * 0.92;
          g.beginPath();
          g.moveTo(sx, fy);
          g.bezierCurveTo(
            sx + gap * 1.5, fy + d * gap * 0.4,
            sx + gap * 1.25, fy + d * gap * 1.25,
            sx + gap * 0.45, fy + d * gap * 1.8,
          );
          g.bezierCurveTo(
            sx + gap * 0.95, fy + d * gap * 1.05,
            sx + gap * 1.0, fy + d * gap * 0.45,
            sx, fy,
          );
          g.closePath();
          g.fill();
        }
      }
    }

    // notehead — broad-nib calligraphy with a soft inked bloom; brighter while sounding
    const col = this.ink(vel, a);
    const whole = gl.whole;
    const js = 1 + this.jit(seed + 5.3) * 0.05; // size wobble
    const rx = (whole ? 6.2 : 4.7) * js;
    const ry = (whole ? 3.9 : 3.5) * js;
    const rot = (whole ? -0.12 : -0.34) + this.jit(seed) * 0.06; // tilt wobble
    g.save();
    // cheap bloom behind every head — luminous ink, no per-note blur
    g.fillStyle = this.ink(vel, a * 0.12);
    g.beginPath();
    g.ellipse(x, y, rx * 1.7, ry * 1.7, rot, 0, Math.PI * 2);
    g.fill();
    if (on) {
      // the sounding note simply breathes — a whisper of glow, no ring. Flat and quiet.
      g.shadowBlur = 7;
      g.shadowColor = this.ink(vel, 0.7);
    }
    g.fillStyle = col;
    if (gl.fill) {
      g.beginPath();
      g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      g.fill();
    } else {
      // hollow: outer ellipse minus a tilted inner counter (even-odd) — the
      // broad-nib ring, thick on one diagonal and thin on the other.
      const p = new Path2D();
      p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      p.ellipse(
        x, y,
        rx * (whole ? 0.62 : 0.73),
        ry * (whole ? 0.6 : 0.58),
        rot + (whole ? 1.35 : 0.52),
        0, Math.PI * 2,
      );
      g.fill(p, 'evenodd');
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
