/** Keep clipboard writes in the initiating click. Never read the user's clipboard. */
export function selectCopyText(field) {
  if (!field) return;
  try { field.focus({preventScroll:true}); } catch { /* Selection can still work. */ }
  try { field.select(); } catch { /* Some webviews only support a range. */ }
  try { field.setSelectionRange(0, field.value.length); } catch { /* Native selection remains available. */ }
}

function copySelection(text, doc, container) {
  if (!doc || typeof doc.execCommand !== 'function') return false;
  // A modal makes the rest of the document inert, including a field in body.
  const parent = container || doc.querySelector('dialog[open]') || doc.body;
  if (!parent || parent.isConnected === false) return false;
  const previous = doc.activeElement;
  const start = previous?.selectionStart, end = previous?.selectionEnd;
  const direction = previous?.selectionDirection;
  const selection = doc.getSelection?.();
  const ranges = selection ? Array.from({length:selection.rangeCount}, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
  const field = doc.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.tabIndex = -1;
  field.setAttribute('aria-label', 'Tekst do skopiowania');
  field.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;font-size:16px;pointer-events:none;';
  try {
    parent.appendChild(field);
    selectCopyText(field);
    // A successful command is only meaningful if this exact text was selected.
    if (doc.activeElement !== field || field.selectionStart !== 0 || field.selectionEnd !== text.length) return false;
    return doc.execCommand('copy') === true;
  } catch {
    return false;
  } finally {
    field.remove();
    if (previous?.isConnected !== false) {
      try { previous?.focus({preventScroll:true}); } catch { /* Focus may have moved. */ }
      if (typeof start === 'number' && typeof end === 'number') {
        try { previous.setSelectionRange(start, end, direction); } catch { /* Not all inputs support ranges. */ }
      }
    }
    if (selection && ranges.length) {
      try { selection.removeAllRanges(); for (const range of ranges) selection.addRange(range); } catch { /* The old selection may no longer exist. */ }
    }
  }
}

/** Modern API first, with a checked compatibility fallback. A deliberate retry
 * can try selection first while it still has the new click's user activation.
 * False means copying failed; selecting text alone is never reported as success.
 */
export async function copyText(text, {
  document:doc = globalThis.document, navigator:nav = globalThis.navigator,
  container, preferSelection = false, isCurrent = () => true,
} = {}) {
  if (typeof text !== 'string' || !text.length || !isCurrent()) return false;
  const fallback = () => {
    try { return copySelection(text, doc, container); } catch { return false; }
  };
  if (preferSelection && fallback()) return true;
  try {
    if (typeof nav?.clipboard?.writeText === 'function') {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch { /* A browser may deny or omit the async clipboard API. */ }
  // Do not revive a closed dialog or copy an old snapshot after a late rejection.
  return !preferSelection && isCurrent() ? fallback() : false;
}
