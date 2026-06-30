/* Shared engraving primitives — lifted from the live staff-visualizer so the static
   full-score page renders the SAME notation (identical clefs, note bodies, pitch axis),
   plus the two things a read score needs that the scrolling visualizer skips: accidentals
   and a stable per-measure accidental memory. Pure drawing helpers; no component state. */

// Clefs + time-signature "4" — baked Bravura (SMuFL) outlines (em = 1000, 1 staff space =
// 250 units, y-DOWN, baseline at y = 0), so they register like real engraving on every device.
export const GCLEF_PATH =
  'M376-415C374-427 376-428 382-434C490-535 572-662 572-815C572-902 548-988 507-1048C492-1070 466-1098 455-1098C441-1098 410-1072 390-1050C316-968 292-843 292-739C292-681 299-616 306-575C308-563 309-561 297-551C153-432 0-289 0-87C0 87 119 252 364 252C387 252 413 250 433 246C444 244 446 243 448 255C460 322 475 409 475 456C475 604 375 622 316 622C262 622 236 606 236 593C236 586 245 583 268 576C299 567 335 540 335 482C335 427 300 380 239 380C172 380 132 433 132 495C132 560 171 658 322 658C389 658 519 628 519 458C519 401 501 306 490 244C488 232 489 233 503 227C604 187 671 102 671-11C671-139 577-252 430-252C404-252 404-252 401-270M470-943C503-943 530-916 530-861C530-750 435-660 356-591C349-585 345-586 343-599C339-625 337-659 337-691C337-847 409-943 470-943M361-262C364-243 364-244 346-238C258-208 201-129 201-44C201 46 248 110 316 133C324 136 336 139 343 139C351 139 355 134 355 128C355 121 347 118 340 115C298 97 268 54 268 8C268-49 307-92 368-109C384-113 386-112 388-101L438 197C440 208 439 208 424 211C408 214 388 216 368 216C193 216 80 119 80-20C80-79 90-158 173-252C233-319 279-356 326-394C336-402 338-401 340-390M430-103C428-115 429-118 441-117C522-110 589-42 589 46C589 109 551 160 495 188C483 194 481 194 479 182';
export const TS4_PATH =
  'M362 74L362-140C362-148 361-157 350-157C341-157 336-155 330-148L235-33C231-28 226-22 226-10L226 74L91 74C171 6 331-221 334-233L335-236C335-245 328-251 320-251C311-251 270-249 252-249C234-249 189-251 181-251C172-251 158-248 158-232C158-108 60 31 30 73L24 81C24 81 24 82 24 82L23 83C21 88 20 92 20 95C20 105 28 112 40 112L226 112L226 175C226 202 204 210 186 210C170 210 163 219 163 229C163 239 167 250 182 250L395 250C405 250 415 243 415 229C415 215 403 209 393 209C383 209 362 203 362 171L362 112L435 112C445 112 450 105 450 93C450 81 446 74 435 74';
// Bass clef — RAW Bravura outline still in font space (y-UP, origin on the F line); draw with
// a negated y-scale.
export const FCLEF_PATH =
  'M252 262c173 0 279 -116 279 -290c0 -304 -260 -482 -506 -602c-6 -3 -12 -5 -17 -5c-9 0 -13 6 -13 12c0 8 6 13 15 18c233 133 371 289 371 568c0 157 -46 261 -152 261c-102 0 -162 -73 -162 -113c0 -10 3 -18 16 -18s23 7 50 7c49 0 96 -40 96 -104c0 -62 -43 -106 -106 -106c-81 0 -123 69 -123 149c0 96 78 223 252 223zM629 180c31 0 55 -24 55 -55s-24 -55 -55 -55s-55 24 -55 55s24 55 55 55zM630 -71c31 0 54 -23 54 -54s-23 -54 -54 -54s-54 23 -54 54s23 54 54 54z';

export const C4_STEP = 28; // middle C — centre of the grand-staff pitch axis
export const TREB_MID = 34; // B4 — middle line of the treble staff
export const BASS_MID = 22; // D3 — middle line of the bass staff
// chromatic pitch-class → natural letter step (C D E F G A B = 0..6)
const PCMAP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
// which pitch classes are black keys (spelled as a sharp of the letter below)
const BLACK = [false, true, false, true, false, false, true, false, true, false, true, false];

export interface Glyph {
  fill: boolean;
  stem: boolean;
  flags: number;
  dot: boolean;
  whole: boolean;
}

// midi → diatonic step (line→space = +1). Accidentals fold onto their natural letter line.
export function diat(m: number): number {
  const pc = ((m % 12) + 12) % 12;
  return (Math.floor(m / 12) - 1) * 7 + PCMAP[pc];
}

/** Does this midi pitch sit on a black key (→ wants a sharp before it)? */
export function isBlack(m: number): boolean {
  return BLACK[((m % 12) + 12) % 12];
}

// note value (in beats) → engraved body
export function glyph(b: number): Glyph {
  if (b >= 3.5) return { fill: false, stem: false, flags: 0, dot: false, whole: true };
  if (b >= 2.5) return { fill: false, stem: true, flags: 0, dot: true, whole: false };
  if (b >= 1.75) return { fill: false, stem: true, flags: 0, dot: false, whole: false };
  if (b >= 1.25) return { fill: true, stem: true, flags: 0, dot: true, whole: false };
  if (b >= 0.875) return { fill: true, stem: true, flags: 0, dot: false, whole: false };
  if (b >= 0.625) return { fill: true, stem: true, flags: 1, dot: true, whole: false };
  if (b >= 0.375) return { fill: true, stem: true, flags: 1, dot: false, whole: false };
  return { fill: true, stem: true, flags: 2, dot: false, whole: false };
}

// Note ink: cyan when soft, warming toward bronze the harder it's struck — the loud finale
// glows gold, echoing the apse light. (Velocity 40→120 maps cyan→bronze.)
export function ink(vel: number, alpha: number): string {
  const t = Math.max(0, Math.min(1, (vel - 40) / 80));
  const r = Math.round(56 + (245 - 56) * t);
  const g = Math.round(189 + (206 - 189) * t);
  const b = Math.round(248 + (140 - 248) * t);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha.toFixed(3) + ')';
}

/** A sharp, drawn to the left of a notehead (cx, cy = its centre). Sized to the staff gap. */
export function drawSharp(g: CanvasRenderingContext2D, cx: number, cy: number, gap: number, color: string): void {
  const w = gap * 0.34;
  const h = gap * 1.05;
  g.save();
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineWidth = Math.max(0.9, gap * 0.11);
  g.beginPath(); g.moveTo(cx - w, cy - h * 0.62); g.lineTo(cx - w, cy + h * 0.5); g.stroke();
  g.beginPath(); g.moveTo(cx + w, cy - h * 0.5); g.lineTo(cx + w, cy + h * 0.62); g.stroke();
  g.lineWidth = Math.max(1.6, gap * 0.26);
  g.beginPath(); g.moveTo(cx - w * 1.9, cy - h * 0.12); g.lineTo(cx + w * 1.9, cy - h * 0.26); g.stroke();
  g.beginPath(); g.moveTo(cx - w * 1.9, cy + h * 0.26); g.lineTo(cx + w * 1.9, cy + h * 0.12); g.stroke();
  g.restore();
}

/** A natural sign (cancels a same-measure sharp on this line). */
export function drawNatural(g: CanvasRenderingContext2D, cx: number, cy: number, gap: number, color: string): void {
  const w = gap * 0.3;
  const h = gap * 1.05;
  g.save();
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineWidth = Math.max(0.9, gap * 0.12);
  g.beginPath(); g.moveTo(cx - w, cy - h * 0.62); g.lineTo(cx - w, cy + h * 0.32); g.stroke();
  g.beginPath(); g.moveTo(cx + w, cy - h * 0.32); g.lineTo(cx + w, cy + h * 0.62); g.stroke();
  g.lineWidth = Math.max(1.4, gap * 0.2);
  g.beginPath(); g.moveTo(cx - w, cy - h * 0.16); g.lineTo(cx + w, cy - h * 0.3); g.stroke();
  g.beginPath(); g.moveTo(cx - w, cy + h * 0.3); g.lineTo(cx + w, cy + h * 0.16); g.stroke();
  g.restore();
}

/** Draw one engraved note (ledger lines, stem, flags, head, dot) at (x, y). Ported from the
 *  live visualizer's note() — same calligraphic bodies, sans the playhead glow/beaming. */
export function drawNote(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  gl: Glyph,
  stemDown: boolean,
  color: string,
  gap: number,
  half: number,
  staffTop: number,
  staffBot: number,
): void {
  const nrx = gap * 0.52;

  // ledger lines above / below (capped so extremes never sprawl)
  g.strokeStyle = color;
  g.lineWidth = 1;
  let c = 0;
  for (let ly = staffTop - gap; ly >= y - 0.5 && c < 8; ly -= gap, c++) {
    g.beginPath(); g.moveTo(x - gap, ly); g.lineTo(x + gap, ly); g.stroke();
  }
  c = 0;
  for (let ly = staffBot + gap; ly <= y + 0.5 && c < 8; ly += gap, c++) {
    g.beginPath(); g.moveTo(x - gap, ly); g.lineTo(x + gap, ly); g.stroke();
  }

  // stem + flags
  if (gl.stem) {
    const sx = stemDown ? x - nrx + 0.4 : x + nrx - 0.4;
    const len = gap * 3.25 + (gl.flags ? gap * 0.5 : 0);
    const tip = stemDown ? y + len : y - len;
    g.strokeStyle = color;
    g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(sx, y); g.lineTo(sx, tip); g.stroke();
    if (gl.flags) {
      const d = stemDown ? -1 : 1;
      g.fillStyle = color;
      for (let f = 0; f < gl.flags; f++) {
        const fy = tip + d * f * gap * 0.92;
        g.beginPath();
        g.moveTo(sx, fy);
        g.bezierCurveTo(sx + gap * 1.5, fy + d * gap * 0.4, sx + gap * 1.25, fy + d * gap * 1.25, sx + gap * 0.45, fy + d * gap * 1.8);
        g.bezierCurveTo(sx + gap * 0.95, fy + d * gap * 1.05, sx + gap * 1.0, fy + d * gap * 0.45, sx, fy);
        g.closePath();
        g.fill();
      }
    }
  }

  // notehead — broad-nib calligraphy
  const whole = gl.whole;
  const rx = whole ? gap * 0.69 : gap * 0.52;
  const ry = whole ? gap * 0.43 : gap * 0.39;
  const rot = whole ? -0.12 : -0.34;
  g.fillStyle = color;
  if (gl.fill) {
    g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill();
  } else {
    const p = new Path2D();
    p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    p.ellipse(x, y, rx * (whole ? 0.62 : 0.73), ry * (whole ? 0.6 : 0.58), rot + (whole ? 1.35 : 0.52), 0, Math.PI * 2);
    g.fill(p, 'evenodd');
  }

  // augmentation dot — raised into the space when the head sits on a line
  if (gl.dot) {
    const dy = s % 2 === 0 ? y - half : y;
    g.fillStyle = color;
    g.beginPath(); g.arc(x + nrx + gap * 0.5, dy, gap * 0.17, 0, Math.PI * 2); g.fill();
  }
}
