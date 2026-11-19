/** Presentational helpers. Calculation, review and clipboard state live in app.js. */
const esc = value => String(value ?? '').replace(/[&<>"']/g,
  character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

const precision = value => {
  if (value === null || value === undefined || String(value).trim() === '') return 1;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 3 ? number : 1;
};

export function decimalRoundingMarkup({ supported, customSupported = true, mode, enabled, places = 1, unit = 'ml' } = {}) {
  if (!supported) return '';
  const selected = precision(places);
  // Old calculation snapshots can still supply the previous boolean setting.
  const selectedMode = ['auto', 'custom', 'off'].includes(mode) ? mode
    : typeof enabled === 'boolean' ? enabled ? 'custom' : 'off' : 'auto';
  const custom = selectedMode === 'custom' && customSupported;
  return `<div class="decimal-rounding" id="decimal-rounding">
    <div class="decimal-rounding-row">
    <label class="decimal-rounding-label" for="roundingMode">Zaokrąglanie</label>
    <div class="decimal-rounding-mode">
      <select id="roundingMode" data-field="roundingMode" aria-label="Tryb zaokrąglania ${esc(unit)}" aria-describedby="rounding-help rounding-preview">${[['auto', 'Auto'], ['custom', 'Własne'], ['off', 'Wyłączone']].map(([value, label]) => `<option value="${value}"${value === 'custom' && !customSupported ? ' disabled' : ''}${selectedMode === value ? ' selected' : ''}>${label}</option>`).join('')}</select>
    </div>
    <div class="decimal-rounding-places" id="rounding-custom-controls"${custom ? '' : ' hidden'}>
      <label class="decimal-rounding-sr-only" for="roundingPlaces">Do ilu miejsc po przecinku</label>
      <span aria-hidden="true">do</span>
      <select id="roundingPlaces" data-field="roundingPlaces"${custom ? '' : ' disabled'}>${[0, 1, 2, 3].map(value => `<option value="${value}"${selected === value ? ' selected' : ''}>${value}</option>`).join('')}</select>
      <span id="rounding-places-label" aria-hidden="true">${selected === 1 ? 'miejsca' : 'miejsc'}</span>
    </div>
    <p class="decimal-rounding-preview" id="rounding-preview" aria-live="polite" aria-atomic="true"></p>
    </div>
    <details class="decimal-rounding-details" id="rounding-details" hidden>
      <summary>Szczegóły</summary>
      <div class="decimal-rounding-details-content" id="rounding-details-content"></div>
    </details>
    <p class="decimal-rounding-sr-only" id="rounding-help">Zaokrąglenie dotyczy ilości na podanie.</p>
  </div>`;
}

function cartItemMarkup(item, index, stale, editing) {
  const id = esc(item.id), label = esc(item.label);
  return `<li class="cart-item${stale ? ' is-stale' : ''}${editing ? ' is-editing' : ''}" data-cart-item-id="${id}">
    <span class="cart-item-number" aria-hidden="true">${index + 1}</span>
    <div class="cart-item-body">
      <h3>${label}</h3>
      ${item.summary ? `<p class="cart-item-summary">${esc(item.summary)}</p>` : ''}
      ${stale || editing ? `<div class="cart-item-badges">${stale ? '<span class="cart-item-stale">Dane pacjenta zmienione</span>' : ''}${editing ? '<span class="cart-item-editing">W trakcie edycji</span>' : ''}</div>` : ''}
      <div class="cart-item-actions">
        <button type="button" data-action="cart-edit" data-value="${id}" aria-label="Edytuj: ${label}">Edytuj</button>
        <button type="button" data-action="cart-remove" data-value="${id}" aria-label="Usuń z koszyka: ${label}">Usuń</button>
      </div>
    </div>
  </li>`;
}

export function prescriptionCartMarkup({
  items = [], patientLabel = '', staleIds = [], mode = 'full', text = '',
  canCopy = false, editingId = '', notice = '', demo = false,
} = {}) {
  const list = Array.isArray(items) ? items : [];
  const stale = new Set(staleIds.map(String));
  const selectedMode = mode === 'ds' ? 'ds' : 'full';
  const fullLabel = list.every(item => /^Rp\.(?:\s|$)/.test(item.texts?.full || ''))
    ? 'Rp. + D.S.' : 'Pełny zapis';
  const copyAllowed = canCopy === true && !demo && list.length > 0
    && !list.some(item => stale.has(String(item.id))) && String(text).trim().length > 0;
  const context = `<div class="cart-context">
    <span class="cart-context-label">Pacjent</span>
    <strong>${esc(patientLabel || 'Dane pacjenta nieuzupełnione')}</strong>
    <p class="cart-memory-note">Dane i koszyk pozostają w tej karcie.</p>
  </div>`;
  const feedback = notice ? `<p class="cart-notice" role="status">${esc(notice)}</p>` : '';
  if (!list.length) return `<section class="prescription-cart" aria-label="Koszyk preparatów">
    ${context}${feedback}
    <div class="cart-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m8 9 4-6 4 6M3 9h18l-2 11H5L3 9Z" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 13v3m6-3v3" stroke-linecap="round"/></svg>
      <h3>Koszyk jest pusty</h3>
      <p>Dodaj przygotowane obliczenie z podsumowania. Kolejne preparaty będą korzystać z tych samych danych pacjenta.</p>
      <button type="button" class="cart-button cart-button-primary" data-action="cart-next">Wybierz preparat</button>
    </div>
  </section>`;
  return `<section class="prescription-cart" aria-label="Koszyk preparatów">
    ${context}${feedback}
    <ol class="cart-items" aria-label="Preparaty w koszyku" role="list">${list.map((item, index) => cartItemMarkup(item, index, stale.has(String(item.id)), String(item.id) === String(editingId))).join('')}</ol>
    <section class="cart-export" aria-labelledby="cart-export-title">
      <div class="cart-export-heading">
        <h3 id="cart-export-title">Wspólny zapis</h3>
        <div class="cart-mode" role="group" aria-label="Format wspólnego zapisu">
          <button type="button" data-action="cart-mode" data-value="full" aria-pressed="${selectedMode === 'full'}"${selectedMode === 'full' ? ' class="active"' : ''}>${fullLabel}</button>
          <button type="button" data-action="cart-mode" data-value="ds" aria-pressed="${selectedMode === 'ds'}"${selectedMode === 'ds' ? ' class="active"' : ''}>Zalecenia</button>
        </div>
      </div>
      <pre class="rx-preview cart-preview" id="cart-preview" tabindex="0" aria-label="Podgląd wspólnego zapisu">${esc(text)}</pre>
      <div class="cart-dialog-actions">
        <button type="button" class="cart-button cart-button-secondary" data-action="cart-next">Dodaj kolejny preparat</button>
        <button type="button" class="cart-button cart-button-primary" data-action="cart-copy"${copyAllowed ? '' : ' disabled'}>Kopiuj całość</button>
      </div>
    </section>
  </section>`;
}
