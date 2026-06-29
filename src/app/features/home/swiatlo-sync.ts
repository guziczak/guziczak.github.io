/* Cross-tab handoff for the bell ("Lux in tenebris"). Opening the full CV in a new tab should
   carry the music with it: localStorage passes the live piece-position (a timestamp), and a
   BroadcastChannel makes sure only the ACTIVE tab sounds — when one tab starts, the others yield.
   Note: a freshly opened tab can't auto-play audio (browser policy), so the /cv tab resumes from
   the handed-off position on its FIRST user gesture. */

const KEY = 'swiatlo.handoff';

/** Stable id for THIS tab, so a tab ignores its own broadcasts. */
export const SWIATLO_TAB =
  't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Persist the live position so another tab can continue from here. */
export function saveHandoff(offset: number, playing: boolean): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ offset: offset < 0 ? 0 : offset, at: Date.now(), playing }),
    );
  } catch {}
}

/** The position to continue from NOW — adds the time elapsed since it was saved, so a handoff
 *  feels continuous. Returns null if there's nothing to continue. */
export function loadHandoff(): { offset: number; playing: boolean } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d.offset !== 'number') return null;
    const elapsed = d.playing ? (Date.now() - d.at) / 1000 : 0;
    return { offset: Math.max(0, d.offset + elapsed), playing: !!d.playing };
  } catch {
    return null;
  }
}

/** Yield-the-floor channel: call claim() when this tab starts playing; onOther() fires when
 *  ANOTHER tab claims, so this tab can pause. Safe no-op where BroadcastChannel is unavailable. */
export function swiatloBus(onOther: () => void): { claim: () => void; close: () => void } {
  let ch: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel('swiatlo');
      ch.onmessage = (e: MessageEvent) => {
        if (e?.data?.type === 'play' && e.data.from !== SWIATLO_TAB) onOther();
      };
    }
  } catch {}
  return {
    claim: () => {
      try {
        ch?.postMessage({ type: 'play', from: SWIATLO_TAB });
      } catch {}
    },
    close: () => {
      try {
        ch?.close();
      } catch {}
    },
  };
}
