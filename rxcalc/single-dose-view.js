const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const amount = value => !finite(value) ? '—' : new Intl.NumberFormat('pl-PL', {
  useGrouping:false, maximumSignificantDigits:14,
  ...(value !== 0 && Math.abs(value) < 1e-6 ? { notation:'scientific' } : {}),
}).format(value);

export function singleDoseRegimenMarkup({ form, source, choices, state, patientMarkup,
  conditionsMarkup, icon, field, sourceDetailsOpen = false } = {}) {
  const reference = source?.referenceDoseMicrograms;
  const bound = source?.maxMicrograms;
  const referenceLabel = finite(reference) ? `${amount(reference)} µg`
    : `${amount(source?.minMicrograms)}–${amount(bound)} µg`;
  const picker = `<div class="field"><label for="regimenId">Etap pojedynczego podania · tabela ChPL</label><select id="regimenId" data-field="regimenId"><option value="">Wybierz etap…</option>${choices.map(item => `<option value="${esc(item.id)}" ${source?.id === item.id ? 'selected' : ''}>${esc(item.label)}</option>`).join('')}</select></div>`;
  const sources = source ? `<details class="source-details" data-disclosure="sourceDetailsOpen" ${sourceDetailsOpen ? 'open' : ''}><summary>${icon('book')}Źródło i zakres przeliczenia</summary><ul>${(source.notes || []).map(note => `<li>${esc(note)}</li>`).join('')}</ul>${source.administration ? `<p>${esc(source.administration)}</p>` : ''}<a href="${esc(source.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(source.sourceLabel)} · ${esc(source.sourceSection)} ↗</a>${(source.additionalSources || []).map(item => `<p><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.label)} ↗</a></p>`).join('')}<p class="small-help">Sprawdzenie źródeł: ${esc(source.sourceCheckedAt)}.</p></details>` : '';
  return `<section class="panel regimen-panel single-dose-panel" aria-labelledby="regimen-title">
    <div class="section-heading"><span class="step-number">02</span><h2 id="regimen-title">Pojedyncze podanie dożylne</h2><span class="trailing">µg → ml</span></div>
    <p class="single-dose-scope">Dorośli oddychający spontanicznie. Podanie przez doświadczony personel, w warunkach monitorowania i wspomagania oddychania.</p>
    ${choices.length ? picker : '<p class="alert neutral">Ten widok obejmuje wyłącznie dorosłych. Dawkowanie pediatryczne wymaga odrębnego schematu i oceny.</p>'}
    ${patientMarkup}
    ${source ? `
      <div class="single-dose-input">${field('doseMicrograms', 'Dawka ustalona przez lekarza', state.doseMicrograms, 'Wpisz dawkę', 'µg', 'aria-describedby="single-dose-unit-help"')}<p class="small-help" id="single-dose-unit-help">µg = mikrogramy. Stężenie preparatu: ${amount(form.concentrationMicrogramsPerMl)} µg/ml. Obliczamy objętość roztworu z ampułki; przygotowanie rozcieńczenia wymaga osobnego zlecenia.</p></div>
      <section class="single-dose-comparison" aria-labelledby="single-dose-comparison-title">
        <div class="section-heading"><h3 id="single-dose-comparison-title">Jedno podanie na tle tabeli ChPL</h3></div>
        <div class="single-dose-reference"><span>${finite(reference) ? 'Dawka dodatkowa w tabeli' : 'Zakres dawki początkowej w tabeli'}</span><strong>${referenceLabel}</strong></div>
        <div class="single-dose-entered"><span>Wpisana dawka</span><strong id="single-dose-current">— µg</strong></div>
        <div class="single-dose-meter" id="single-dose-meter" role="meter" aria-label="Wpisana dawka na tle tabeli ChPL" aria-valuemin="0" aria-valuemax="${bound * 1.25}" aria-valuenow="0" aria-valuetext="Wpisz dawkę">
          ${finite(source.minMicrograms) ? `<span class="single-dose-source-band" style="left:${source.minMicrograms / bound * 80}%;width:${(bound - source.minMicrograms) / bound * 80}%" aria-hidden="true"></span><span class="single-dose-marker" style="left:${source.minMicrograms / bound * 80}%" aria-hidden="true"></span>` : ''}
          <span class="single-dose-fill" style="width:0%" aria-hidden="true"></span><span class="single-dose-marker" style="left:80%" aria-hidden="true"></span>
        </div>
        <div class="single-dose-axis"><span>0 µg</span><span>${amount(bound * 1.25)} µg · koniec skali</span></div>
        <p id="single-dose-comparison-status" class="single-dose-comparison-status">Wpisz dawkę do porównania.</p>
        <p class="small-help">Ogólna tabela ChPL dla dorosłych ze spontanicznym oddechem. Nie stanowi osobnego protokołu OZW ani oceny bezpieczeństwa dawki.</p>
      </section>
      ${conditionsMarkup}${sources}` : choices.length ? '<p class="small-help">Wybierz etap. Dawkę wpiszesz samodzielnie po ocenie pacjenta.</p>' : ''}
  </section>`;
}

export function singleDoseResultMarkup({ form, state, icon } = {}) {
  return `<aside class="result-column single-dose-result" id="result" aria-label="Wynik pojedynczego podania"><div class="result-card">
    <div class="result-top"><div class="result-title">Objętość jednego podania <span class="live-tag">Na żywo</span></div><div class="dose-output"><span class="number" id="single-dose-value">—</span><span class="unit">ml</span></div><p class="frequency-output" id="single-dose-equivalent">Wybierz etap i wpisz dawkę.</p><div class="dose-equivalent">${amount(form.concentrationMicrogramsPerMl)} µg/ml · dożylnie</div></div>
    <div class="result-body"><div class="safety-heading"><span>Kontrola przeliczenia</span><span class="status-badge" id="single-dose-badge">Oczekuje na dane</span></div><div class="result-alerts" id="single-dose-alerts" aria-live="polite"></div>
      <div class="supply-box"><div class="supply-head">${icon('box')}<span>Ampułki do jednego podania</span></div><div class="field single-dose-pack-field"><label for="packageId">Opakowanie i rozmiar ampułki</label><select class="package-select" id="packageId" data-field="packageId">${form.packOptions.map(pack => `<option value="${esc(pack.id)}" ${pack.id === state.packageId ? 'selected' : ''}>${esc(pack.label)}</option>`).join('')}</select></div><div class="package-result" id="single-dose-containers">— amp.</div><div class="package-description" id="single-dose-waste">Liczba ampułek wynika z objętości jednego podania.</div></div>
      <div class="result-review" id="single-dose-review"></div>
      <div class="rx-section"><div class="rx-heading"><h3>Zapis pojedynczego podania</h3></div><div class="rx-output"><pre class="rx-preview placeholder" id="rx-preview">Wybierz etap, wpisz dawkę i sprawdź warunki.</pre></div></div>
      <label class="confirm-row"><input id="confirmed" type="checkbox" ${state.confirmed ? 'checked' : ''}><span>Potwierdzam dawkę, drogę podania, stężenie i możliwość dokładnego odmierzenia dla tego pacjenta.</span></label>
      <div class="result-actions"><button class="copy-button" id="copy-button" data-action="copy" disabled>${icon('copy')}Kopiuj zapis</button></div><p class="copy-caption" id="result-requirements">Uzupełnij dane i potwierdź pojedyncze podanie.</p>
    </div></div><p class="result-footnote">${icon('info')}Przeliczenie jednego podania. Kolejna dawka wymaga ponownej oceny; widok nie ustala odstępu ani sumy dawek.</p></aside>`;
}

/** Update existing meter nodes so edits animate from their current position. */
export function updateSingleDoseView(root, { form, source, context, result, confirmed, demo, text } = {}) {
  const $ = selector => root.querySelector(selector);
  const setText = (selector, value) => { const node = $(selector); if (node) node.textContent = value; };
  const hasVolume = finite(result.volumeMl) && result.volumeMl > 0;
  const dose = result.doseMicrograms;
  const pack = form.packOptions.find(item => item.id === context.packId);
  setText('#single-dose-value', hasVolume ? amount(result.volumeMl) : '—');
  setText('#single-dose-equivalent', finite(dose) ? `${amount(dose)} µg · pojedyncze podanie` : 'Wybierz etap i wpisz dawkę.');
  setText('#single-dose-current', finite(dose) ? `${amount(dose)} µg` : '— µg');
  const badge = $('#single-dose-badge');
  badge.className = `status-badge ${result.status === 'critical' ? 'critical' : result.status === 'warning' ? 'warning' : ''}`;
  badge.textContent = result.status === 'critical' ? 'Poza zakresem widoku'
    : result.valid ? result.warnings.length ? 'Sprawdź uwagi' : 'Przeliczono'
      : source ? 'Uzupełnij warunki' : 'Wybierz etap';
  $('#single-dose-alerts').innerHTML = [...new Set(result.errors)].map(message => `<div class="alert ${result.status === 'critical' ? 'critical' : 'neutral'}"><span>${esc(message)}</span></div>`).join('')
    + [...new Set(result.warnings)].map(message => `<div class="alert warning"><span>${esc(message)}</span></div>`).join('');
  setText('#single-dose-containers', finite(result.containersNeeded) ? `${amount(result.containersNeeded)} amp. × ${amount(result.containerMl)} ml` : '— amp.');
  setText('#single-dose-waste', finite(result.volumeWasteMl)
    ? `Do pobrania: ${amount(result.volumeMl)} ml. Pozostałość z otwartych ampułek: ${amount(result.volumeWasteMl)} ml — do usunięcia. Ampułki są jednorazowe.`
    : 'Liczba ampułek wynika z objętości jednego podania.');
  if (pack) setText('#selected-package', pack.label);
  const rows = [['Preparat', form.label], ['Droga podania', 'dożylnie'], ['Stężenie', `${amount(form.concentrationMicrogramsPerMl)} µg/ml`], ['Etap', source?.label || 'Wybierz etap']];
  $('#single-dose-review').innerHTML = `<h3>Sprawdź przed skopiowaniem</h3><dl>${rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
  setText('#rx-preview', result.valid ? text : 'Uzupełnij dane i warunki dotyczące pacjenta. Zapis będzie dostępny po ich sprawdzeniu.');
  $('#rx-preview').classList.toggle('placeholder', !result.valid);
  const control = $('#confirmed');
  control.checked = confirmed;
  control.disabled = !result.valid || demo;
  const canCopy = result.valid && confirmed && !demo && !!text;
  $('#copy-button').disabled = !canCopy;
  if ($('#mobile-copy')) $('#mobile-copy').disabled = !canCopy;
  setText('#result-requirements', !result.valid ? 'Uzupełnij wskazane dane i warunki.' : !confirmed ? 'Sprawdź i potwierdź pojedyncze podanie przed skopiowaniem.' : 'Zapis gotowy do skopiowania.');
  setText('#mobile-action-value', hasVolume ? `${amount(result.volumeMl)} ml` : 'Uzupełnij dane');
  setText('#mobile-action-label', 'Pojedyncze podanie');
  const meter = $('#single-dose-meter');
  if (!meter || !source) return;
  const bound = source.maxMicrograms;
  const low = source.minMicrograms ?? source.referenceDoseMicrograms;
  const scale = bound * 1.25;
  const current = finite(dose) && dose > 0 ? dose : 0;
  const below = current > 0 && current < low;
  const above = current > bound;
  meter.classList.toggle('below', below);
  meter.classList.toggle('above', above);
  meter.querySelector('.single-dose-fill').style.width = `${Math.max(0, Math.min(100, current / scale * 100))}%`;
  meter.setAttribute('aria-valuenow', String(Math.min(scale, current)));
  meter.setAttribute('aria-valuetext', current ? `${amount(current)} mikrogramów. Odniesienie z ChPL: ${finite(source.referenceDoseMicrograms) ? amount(bound) : `${amount(low)}–${amount(bound)}`} mikrogramów.` : 'Wpisz dawkę');
  const status = $('#single-dose-comparison-status');
  status.className = `single-dose-comparison-status${above ? ' above' : below ? ' below' : ''}`;
  status.textContent = !current ? 'Wpisz dawkę do porównania.'
    : above ? 'Powyżej zakresu wybranego etapu — sprawdź schemat.'
      : below ? 'Poniżej wartości z tabeli — indywidualne zmniejszenie wymaga oceny lekarza.'
        : finite(source.referenceDoseMicrograms) ? 'Dawka odpowiada wartości w tabeli dla tego etapu.' : 'Dawka mieści się w liczbowym zakresie tabeli.';
}
