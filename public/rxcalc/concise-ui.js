/** Presentation-only progressive disclosure. No imports from dosing/state,
 * no input/change events, no storage, and no changes to numbers or validation.
 * Unknown text and all patient-specific alerts remain visible by default.
 */
const openSections = new Set();
const plain = node => node?.textContent?.trim() || '';
const direct = (node, selector) => [...node.children].filter(child => child.matches(selector));
const shortLabels = new Map([
  ['Poniżej zakresu schematu', 'Poniżej zakresu'],
  ['Powyżej zakresu schematu', 'Powyżej zakresu'],
  ['Poniżej dawki ze źródła', 'Poniżej dawki źródłowej'],
  ['Powyżej dawki ze źródła', 'Powyżej dawki źródłowej'],
  ['Zaokrąglenie wymaga indywidualnej oceny', 'Zaokrąglenie do oceny'],
  ['Zaokrąglenie ocenione indywidualnie', 'Zaokrąglenie ocenione'],
  ['Taka sama ilość dobowa jak w schemacie', 'Jak w schemacie'],
  ['Dobowo w zakresie wybranego schematu', 'W zakresie schematu'],
  ['Z proporcji składników preparatu — nie jest to niezależne maksimum tej substancji.', 'Z proporcji preparatu — nie osobne maksimum.'],
  ['Wybierz czas; żadna liczba dni nie jest ustawiana automatycznie.', 'Wybierz czas.'],
  ['Źródło sprawdzone: nie określa pełnego zakresu dni dla tego wskazania. Czas ustala lekarz.', 'Brak określonego zakresu dni — czas ustala lekarz.'],
  ['Źródło sprawdzone: określa warunek kontroli, nie pełny zalecany zakres dni.', 'Źródło określa warunek kontroli, nie zakres dni.'],
  ['Wybierz schemat, aby ocenić czas. W trybie ręcznym przyciski są tylko skrótami wpisywania.', 'Bez schematu dni są skrótami, nie zaleceniem.'],
]);

export function conciseLabel(text) { return shortLabels.get(text) || text; }

function paragraph(doc, text, className = '') {
  const node = doc.createElement('p'); node.textContent = text;
  if (className) node.className = className;
  return node;
}
function section(root, key, label, existing = null) {
  let box = existing || direct(root, `details[data-ui-section="${key}"]`)[0];
  if (!box) {
    box = root.ownerDocument.createElement('details');
    box.append(root.ownerDocument.createElement('summary'));
    root.append(box);
  }
  box.classList.add('ui-details'); box.dataset.uiSection = key;
  const summary = box.querySelector(':scope > summary');
  if (summary && summary.textContent !== label) summary.textContent = label;
  if (openSections.has(key) && !box.open) box.open = true;
  return box;
}
function archive(box, text) {
  if (!text || [...box.querySelectorAll('[data-ui-archived]')].some(n => plain(n) === text)) return;
  const p = paragraph(box.ownerDocument, text); p.dataset.uiArchived = '';
  box.append(p);
}
function shorten(node, box = null) {
  if (!node || node.dataset.uiOriginal) return;
  const original = plain(node), text = conciseLabel(original);
  if (text === original) return;
  // A full accessible description remains available even for compact tile labels.
  node.dataset.uiOriginal = original; node.setAttribute('aria-label', original);
  const icon = node.querySelector(':scope > [aria-hidden="true"]');
  if (icon) node.replaceChildren(icon, node.ownerDocument.createTextNode(text));
  else node.textContent = text;
  if (box) archive(box, original);
}
function moveHelp(root, selector, key, label, existing = null) {
  const nodes = direct(root, selector);
  if (!nodes.length) return existing || direct(root, `details[data-ui-section="${key}"]`)[0] || null;
  const box = section(root, key, label, existing);
  for (const node of nodes) if (node !== box) box.append(node);
  return box;
}

function shortcuts(root) {
  // Only explanatory paragraphs, not tiles, warnings or navigation controls.
  const box = moveHelp(root, '.liquid-dose-help, .liquid-rounded-note', 'shortcuts', 'Szczegóły przeliczenia');
  if (box) {
    // One disclosure opens the source links; avoid nested disclosures here.
    for (const nested of box.querySelectorAll('.liquid-rounded-details')) {
      nested.querySelector(':scope > summary')?.remove();
      nested.replaceWith(...nested.childNodes);
    }
    for (const reason of root.querySelectorAll('.liquid-dose-reason')) {
      // The icon is not part of the clinical wording.
      const original = [...reason.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
      const short = conciseLabel(original);
      if (short !== original && !reason.dataset.uiOriginal) {
        const icon = reason.querySelector(':scope > [aria-hidden="true"]');
        reason.dataset.uiOriginal = original; reason.setAttribute('aria-label', original);
        reason.replaceChildren(...(icon ? [icon] : []), reason.ownerDocument.createTextNode(short));
        archive(box, original);
      }
    }
  }
}
function daily(root) {
  const box = moveHelp(root, '.daily-dose-scope, .dose-safety-caution, .daily-dose-source, .dose-scheme-caption, .dose-reference-footnote, .dose-reference-details', 'daily-dose', 'Objaśnienia i źródła');
  if (!box) return;
  for (const nested of box.querySelectorAll('.dose-reference-details')) {
    nested.querySelector(':scope > summary')?.remove(); nested.replaceWith(...nested.childNodes);
  }
  const caption = box.querySelector('.dose-scheme-caption');
  if (caption && !root.querySelector(':scope > .ui-dose-context')) {
    const full = plain(caption), frequency = full.match(/Częstość ze źródła: ([^.]+)\./)?.[1];
    const text = `${frequency ? `Źródło: ${frequency}. ` : ''}Porównanie, nie ocena bezpieczeństwa.${full.includes('Nie wyznaczono osobnego maksimum') ? ' Brak osobnego maksimum.' : ''}`;
    const context = paragraph(root.ownerDocument, text, 'ui-dose-context');
    (root.querySelector(':scope > .dose-scheme-legend') || root.firstElementChild).after(context);
  } else if (!caption && !root.querySelector(':scope > .ui-dose-context') && !root.querySelector('.dose-reference-badge')) {
    root.firstElementChild?.after(paragraph(root.ownerDocument, 'Porównanie, nie ocena bezpieczeństwa.', 'ui-dose-context'));
  }
  for (const node of root.querySelectorAll('.dose-safety-derived, .dose-scheme-status.same, .dose-scheme-status.within')) shorten(node, box);
}
function duration(root) {
  const sources = root.querySelector(':scope > .duration-sources');
  const feedback = root.querySelector(':scope > .duration-feedback');
  let box = sources ? section(root, 'duration', 'Szczegóły czasu i źródło', sources) : null;
  const origin = root.querySelector(':scope > .duration-origin');
  // Keep numerical ranges and external source provenance next to the choices.
  if (origin && !origin.querySelector('strong') && !plain(origin).includes('SDCEP')) {
    box ||= section(root, 'duration', 'Szczegóły czasu i źródło'); box.append(origin);
  }
  if (feedback && !feedback.matches('.duration-warning, .duration-critical') && conciseLabel(plain(feedback)) !== plain(feedback)) {
    box ||= section(root, 'duration', 'Szczegóły czasu i źródło'); shorten(feedback, box);
  }
  // Review timing and conditional review instructions always remain visible.
  // Unknown neutral states (missing age/scope, changed sources) are not shortened.
}
function regimen(root) {
  const source = root.querySelector('details.source-details');
  const help = root.querySelector('.human-source-body > .source-screening, .regimen-body > .source-screening');
  if (source && help) {
    const summary = source.querySelector(':scope > summary');
    if (summary) summary.textContent = 'Warunki stosowania i źródło';
    const previous = source.querySelector('[data-ui-screening]');
    if (previous) previous.remove();
    help.dataset.uiScreening = ''; summary?.after(help);
    // Keep the single existing disclosure and all source notes/links/actions.
    source.classList.add('ui-details');
  }
  const edit = root.querySelector('#source-edit-note');
  if (!edit) return;
  const status = edit.querySelector('.source-edit-status'), modified = status?.classList.contains('modified');
  edit.classList.toggle('ui-edit-compact', true);
  const generic = direct(edit, 'p.small-help');
  if (source && generic.length) {
    for (const old of source.querySelectorAll('[data-ui-edit-help]')) old.remove();
    for (const p of generic) { p.dataset.uiEditHelp = ''; source.append(p); }
  } else if (!source) moveHelp(edit, 'p.small-help', 'source-edit', 'O edycji schematu');
  // Suppress only the redundant unmodified status; the source card above already
  // presents the original values. Keep a modified status and the restore action.
  if (status && !modified && !status.hidden) status.hidden = true;
}
function rounding(root) {
  let box = root.querySelector(':scope > details');
  const scope = root.querySelector(':scope > .rounding-scope');
  if (box) box = section(root, 'rounding', 'Szczegóły zaokrąglenia i źródła', box);
  if (scope && box) box.append(scope);
  if (!root.querySelector(':scope > .ui-rounding-context')) {
    root.querySelector('h3')?.after(paragraph(root.ownerDocument, 'Indywidualna decyzja — nie automatycznie zatwierdzona reguła.', 'ui-rounding-context'));
  }
  // Never collapse rationale fields, attestations, blocking errors, or actions.
}

export function compactInterface(root) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll('.liquid-dose-slot').forEach(shortcuts);
  root.querySelectorAll('.daily-dose-note').forEach(daily);
  root.querySelectorAll('.duration-guidance').forEach(duration);
  root.querySelectorAll('.regimen-panel').forEach(regimen);
  root.querySelectorAll('.rounding-review').forEach(rounding);
}

export function installConciseUI(doc) {
  const root = doc.querySelector('#app');
  if (!root || root.dataset.conciseUi === 'ready') return;
  root.dataset.conciseUi = 'ready';
  const observer = new doc.defaultView.MutationObserver(() => {
    observer.disconnect();
    try { compactInterface(root); } finally { observe(); }
  });
  const observe = () => observer.observe(root, {childList:true, subtree:true, characterData:true});
  doc.addEventListener('toggle', event => {
    const target = event.target, key = target?.dataset?.uiSection;
    if (key && target.isConnected) target.open ? openSections.add(key) : openSections.delete(key);
  }, true);
  doc.addEventListener('click', event => {
    const action = event.target.closest?.('[data-action]')?.dataset.action;
    if (['reset', 'patient-type', 'drug', 'favorite-select', 'liquid-source'].includes(action)) openSections.clear();
  }, true);
  doc.addEventListener('change', event => {
    if (['regimenId', 'formId', 'productVariant', 'species', 'specialty'].includes(event.target.dataset?.field)) openSections.clear();
  }, true);
  compactInterface(root); observe();
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installConciseUI(document), {once:true});
  else installConciseUI(document);
}
