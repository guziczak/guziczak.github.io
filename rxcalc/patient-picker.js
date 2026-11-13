import { createPatientPickerModel, parsePickerValue, formatWheelValue } from './patient-picker-model.js';

/** Patient values are committed once, on Done. The wheels only edit an ephemeral draft. */
export function createPatientPickers({ icon, getContext, beforeOpen = () => {} }) {
  const records = new Set(), byInput = new WeakMap();
  const ROW = 44;
  let active = null;
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const button = (className, text, action) => {
    const node = element('button', className, text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  };
  const display = value => String(value).replace('.', ',');

  function refreshOne(record) {
    record.value.textContent = record.input.value ? display(record.input.value) : record.input.placeholder || 'Wybierz';
    record.value.classList.toggle('is-placeholder', !record.input.value);
    record.trigger.disabled = record.input.disabled;
  }

  function close(restoreFocus = true) {
    const session = active;
    if (!session) return;
    active = null;
    session.record.trigger.setAttribute('aria-expanded', 'false');
    session.record.trigger.removeAttribute('aria-controls');
    session.dialog.close();
    session.dialog.remove();
    document.documentElement.classList.remove('patient-picker-open');
    if (restoreFocus && session.record.trigger.isConnected) session.record.trigger.focus({ preventScroll:true });
  }

  function position() {
    const session = active;
    if (!session) return;
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight;
    const mobile = window.matchMedia('(max-width:780px)').matches;
    const dialog = session.dialog;
    dialog.style.width = `${mobile ? width : Math.min(370, width - 24)}px`;
    dialog.style.maxHeight = `${Math.max(160, height - (mobile ? 8 : 24))}px`;
    const rect = session.record.trigger.getBoundingClientRect();
    const size = dialog.getBoundingClientRect();
    const x = mobile ? left : Math.max(left + 12, Math.min(rect.left, left + width - size.width - 12));
    const y = mobile ? top + height - size.height
      : rect.bottom + 8 + size.height < top + height - 12 ? rect.bottom + 8
      : Math.max(top + 12, Math.min(rect.top - size.height - 8, top + height - size.height - 12));
    dialog.style.left = `${x}px`;
    dialog.style.top = `${y}px`;
  }

  function currentDisplay(session) {
    return session.mode === 'manual' ? session.manualInput.value
      : formatWheelValue(session.whole, session.fraction, session.model.precision);
  }

  function updatePreview(session) {
    if (active !== session) return;
    const raw = currentDisplay(session);
    const result = parsePickerValue(raw, session.model);
    session.error.textContent = result.error;
    session.done.disabled = !result.valid;
    session.preview.textContent = result.valid && result.value !== ''
      ? `${display(raw)} ${session.model.unit}${session.model.scale === 1000 ? ` · ${display(result.value)} kg` : ''}`
      : raw.trim() === '' ? 'Brak wartości' : '—';
    session.manualInput.setAttribute('aria-invalid', String(!result.valid));
  }

  function readWheel(session, part) {
    const wheel = session.wheels[part];
    const index = Math.max(0, Math.min(wheel.max, Math.round(wheel.node.scrollTop / ROW)));
    wheel.rows[wheel.index]?.classList.remove('is-selected');
    wheel.index = index;
    wheel.rows[index].classList.add('is-selected');
    wheel.node.setAttribute('aria-valuenow', String(index));
    wheel.node.setAttribute('aria-valuetext', part === 'fraction'
      ? `0,${String(index).padStart(session.model.precision, '0')} ${session.model.unit}`
      : `${index} ${session.model.unit}`);
    session[part] = index;
  }

  function chooseIndex(session, part, index) {
    const wheel = session.wheels[part];
    wheel.node.scrollTop = Math.max(0, Math.min(wheel.max, index)) * ROW;
    readWheel(session, part);
    updatePreview(session);
  }

  function makeWheel(session, part, max, initial, label) {
    const column = element('div', 'patient-picker-column');
    column.dataset.part = part;
    column.append(element('div', 'patient-picker-column-label', label));
    const node = element('div', 'patient-picker-wheel');
    node.tabIndex = 0;
    node.setAttribute('role', 'spinbutton');
    node.setAttribute('aria-label', part === 'fraction' ? 'Część dziesiętna masy' : session.model.title);
    node.setAttribute('aria-valuemin', '0');
    node.setAttribute('aria-valuemax', String(max));
    node.setAttribute('aria-valuenow', String(initial));
    const rows = Array.from({ length:max + 1 }, (_, index) => {
      const row = element('div', 'patient-picker-row', part === 'fraction' ? String(index).padStart(session.model.precision, '0') : index);
      row.dataset.index = String(index);
      row.setAttribute('aria-hidden', 'true');
      if (index === initial) row.classList.add('is-selected');
      node.append(row);
      return row;
    });
    session.wheels[part] = { node, rows, max, index:initial };
    node.addEventListener('scroll', () => {
      if (active !== session || session.mode !== 'wheels' || session.positioning) return;
      readWheel(session, part);
      updatePreview(session);
    }, { passive:true });
    node.addEventListener('click', event => {
      const row = event.target.closest('.patient-picker-row');
      if (row) chooseIndex(session, part, Number(row.dataset.index));
    });
    node.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); commit(session); return; }
      const steps = { ArrowUp:1, ArrowDown:-1, PageUp:10, PageDown:-10 };
      if (Object.hasOwn(steps, event.key) || ['Home','End'].includes(event.key)) {
        event.preventDefault();
        chooseIndex(session, part, event.key === 'Home' ? 0 : event.key === 'End' ? max : session[part] + steps[event.key]);
      }
      if (['ArrowLeft','ArrowRight'].includes(event.key)) {
        const other = session.wheels[part === 'whole' ? 'fraction' : 'whole'];
        if (other) { event.preventDefault(); other.node.focus({ preventScroll:true }); }
      }
    });
    column.append(node);
    return column;
  }

  function renderWheels(session) {
    session.wheels = {};
    session.wheelsBox.replaceChildren();
    const band = element('div', 'patient-picker-selection');
    band.setAttribute('aria-hidden', 'true');
    session.wheelsBox.append(band, makeWheel(session, 'whole', session.model.maxWhole, session.whole, session.model.precision ? 'Całe' : ''));
    if (session.model.precision) {
      const separator = element('span', 'patient-picker-separator', ',');
      separator.setAttribute('aria-hidden', 'true');
      session.wheelsBox.append(separator, makeWheel(session, 'fraction', 10 ** session.model.precision - 1, session.fraction, 'Po przecinku'));
    }
    session.wheelsBox.append(element('span', 'patient-picker-unit', session.model.unit));
  }

  function alignWheels(session) {
    session.positioning = true;
    for (const part of Object.keys(session.wheels)) {
      session.wheels[part].node.scrollTop = session[part] * ROW;
    }
    session.positioning = false;
  }

  function setMode(session, mode, focus = true) {
    if (mode === 'manual' && session.mode === 'wheels') {
      for (const part of Object.keys(session.wheels)) readWheel(session, part);
      session.manualInput.value = display(currentDisplay(session));
    }
    if (mode === 'wheels' && session.mode === 'manual') {
      const result = parsePickerValue(session.manualInput.value, session.model);
      if (!result.valid) { updatePreview(session); return; }
      const model = createPatientPickerModel(session.record.input.id, { ...session.context, value:result.value });
      if (model.manualRequired) {
        session.error.textContent = 'Tę dokładną wartość możesz zatwierdzić w trybie wpisywania.';
        return;
      }
      session.model = model;
      session.whole = model.whole; session.fraction = model.fraction;
      renderWheels(session);
    }
    session.mode = mode;
    session.wheelsBox.hidden = mode !== 'wheels';
    session.manualBox.hidden = mode !== 'manual';
    session.wheelsButton.setAttribute('aria-pressed', String(mode === 'wheels'));
    session.manualButton.setAttribute('aria-pressed', String(mode === 'manual'));
    if (mode === 'wheels') alignWheels(session);
    updatePreview(session); position();
    if (focus) {
      if (mode === 'manual') { session.manualInput.focus({ preventScroll:true }); session.manualInput.select(); }
      else session.wheels.whole.node.focus({ preventScroll:true });
    }
  }

  function commit(session) {
    if (active !== session) return;
    if (session.mode === 'wheels') for (const part of Object.keys(session.wheels)) readWheel(session, part);
    const result = parsePickerValue(currentDisplay(session), session.model);
    if (!result.valid) { updatePreview(session); return; }
    const { input, trigger } = session.record;
    const changed = input.value !== result.value;
    input.value = result.value;
    close(false);
    trigger.focus({ preventScroll:true });
    if (changed) input.dispatchEvent(new Event('input', { bubbles:true }));
    if (input.isConnected) refreshOne(session.record);
  }

  function open(record) {
    if (record.trigger.disabled || !record.input.isConnected) return;
    close(false); beforeOpen();
    const context = { ...getContext(record.input.id), value:record.input.value };
    const model = createPatientPickerModel(record.input.id, context);
    const dialog = element('dialog', 'patient-picker');
    dialog.id = `${record.input.id}-picker`;
    dialog.setAttribute('aria-labelledby', `${dialog.id}-title`);
    const panel = element('div', 'patient-picker-panel');
    const header = element('div', 'patient-picker-header');
    const heading = element('h2', '', model.title);
    heading.id = `${dialog.id}-title`;
    header.append(heading, button('patient-picker-cancel', 'Anuluj', () => close()));
    const modes = element('div', 'patient-picker-mode');
    const wheelsBox = element('div', 'patient-picker-wheels');
    const manualBox = element('div', 'patient-picker-manual');
    const manualInput = element('input');
    manualInput.id = `${dialog.id}-manual`;
    manualInput.type = 'text'; manualInput.inputMode = 'decimal';
    manualInput.autocomplete = 'off'; manualInput.spellcheck = false;
    manualInput.value = display(model.initialDisplay);
    const manualLabel = element('label', '', model.title);
    manualLabel.htmlFor = manualInput.id;
    const manualUnit = element('div', 'patient-picker-manual-unit');
    manualUnit.append(manualInput, element('span', '', model.unit));
    manualBox.append(manualLabel, manualUnit);
    const error = element('p', 'patient-picker-error');
    error.id = `${dialog.id}-error`; error.setAttribute('role', 'status');
    manualInput.setAttribute('aria-describedby', error.id);
    const preview = element('output', 'patient-picker-preview');
    preview.setAttribute('aria-live', 'polite'); preview.setAttribute('aria-atomic', 'true');
    const footer = element('div', 'patient-picker-footer');
    const session = { record, context, model, dialog, wheelsBox, manualBox, manualInput, error, preview,
      whole:model.whole, fraction:model.fraction, mode:null, wheels:{}, positioning:false };
    session.wheelsButton = button('', 'Przewijaj', () => setMode(session, 'wheels'));
    session.manualButton = button('', 'Wpisz', () => setMode(session, 'manual'));
    modes.append(session.wheelsButton, session.manualButton);
    session.done = button('patient-picker-done', 'Gotowe', () => commit(session));
    footer.append(button('patient-picker-clear', 'Wyczyść', () => {
      setMode(session, 'manual');
      session.manualInput.value = '';
      updatePreview(session);
    }), session.done);
    panel.append(header, modes, wheelsBox, manualBox, preview, error, footer);
    dialog.append(panel); document.body.append(dialog);
    active = session;
    record.trigger.setAttribute('aria-controls', dialog.id);
    record.trigger.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('patient-picker-open');
    renderWheels(session);
    manualInput.addEventListener('input', () => updatePreview(session));
    manualInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); commit(session); } });
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    let backdropStart = false;
    dialog.addEventListener('pointerdown', event => { backdropStart = event.target === dialog; });
    dialog.addEventListener('click', event => { if (backdropStart && event.target === dialog) close(); });
    // Give native dialog autofocus an on-screen position before showModal.
    // Its static position at the end of body would otherwise scroll the page.
    const viewport = window.visualViewport;
    dialog.style.left = `${(viewport?.offsetLeft || 0) + 12}px`;
    dialog.style.top = `${(viewport?.offsetTop || 0) + 12}px`;
    dialog.style.width = `${Math.min(370, (viewport?.width || window.innerWidth) - 24)}px`;
    dialog.style.maxHeight = `${Math.max(160, (viewport?.height || window.innerHeight) - 24)}px`;
    dialog.showModal();
    setMode(session, model.manualRequired ? 'manual' : 'wheels');
    requestAnimationFrame(() => { if (active === session) { alignWheels(session); position(); } });
  }

  function enhance(root) {
    for (const record of records) if (!record.input.isConnected) records.delete(record);
    root.querySelectorAll('input[data-patient-picker]').forEach(input => {
      if (byInput.has(input)) return;
      const trigger = element('button', 'patient-wheel-trigger');
      trigger.type = 'button'; trigger.id = `${input.id}-wheel-trigger`;
      trigger.dataset.pickerId = input.id;
      trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-expanded', 'false');
      const labels = [...input.labels];
      labels.forEach((label, index) => { label.id ||= `${input.id}-wheel-label-${index}`; label.htmlFor = trigger.id; });
      const value = element('span', 'patient-wheel-value');
      value.id = `${trigger.id}-value`;
      trigger.setAttribute('aria-labelledby', [...labels.map(label => label.id), value.id].join(' '));
      const chevron = element('span', 'patient-wheel-chevron');
      chevron.innerHTML = icon('down'); trigger.append(value, chevron);
      input.hidden = true; input.tabIndex = -1;
      input.after(trigger);
      const record = { input, trigger, value };
      records.add(record); byInput.set(input, record);
      trigger.addEventListener('click', () => open(record));
      trigger.addEventListener('keydown', event => {
        if (['ArrowDown','ArrowUp'].includes(event.key)) { event.preventDefault(); open(record); }
      });
      refreshOne(record);
    });
  }

  window.addEventListener('resize', position);
  window.visualViewport?.addEventListener('resize', position);
  window.visualViewport?.addEventListener('scroll', position);
  return { enhance, close, refresh:() => { for (const record of records) if (record.input.isConnected) refreshOne(record); } };
}
