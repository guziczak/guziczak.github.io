/* One themed, select-only combobox for every application dropdown.
 * Native selects remain the value source for the existing calculation handlers.
 */
export function createSelectMenus({ icon }) {
  const records = new WeakMap();
  let active = null, serial = 0;
  const normalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/gi, 'l').toLowerCase();
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const symbol = (name, className) => {
    const node = element('span', className);
    node.innerHTML = icon(name);
    return node;
  };
  const enabledIndexes = record => [...record.native.options].flatMap((option, index) => option.matches(':disabled') ? [] : [index]);

  function refreshOne(record) {
    const { native, trigger, value, leading } = record;
    const selected = native.selectedOptions[0];
    value.textContent = selected?.label || 'Wybierz…';
    trigger.title = selected?.label || '';
    trigger.disabled = native.matches(':disabled');
    trigger.setAttribute('aria-required', String(native.required));
    for (const attribute of ['aria-invalid', 'aria-describedby']) {
      if (native.hasAttribute(attribute)) trigger.setAttribute(attribute, native.getAttribute(attribute));
      else trigger.removeAttribute(attribute);
    }
    leading.replaceChildren();
    leading.hidden = !selected?.dataset.icon;
    if (!leading.hidden) leading.innerHTML = icon(selected.dataset.icon);
    if (active === record) {
      if (trigger.disabled) { close(); return; }
      record.rows.forEach((row, index) => {
        row.setAttribute('aria-selected', String(index === native.selectedIndex));
        row.setAttribute('aria-disabled', String(native.options[index].matches(':disabled')));
      });
    }
  }

  function close() {
    if (!active) return;
    const record = active;
    active = null;
    record.trigger.setAttribute('aria-expanded', 'false');
    record.trigger.removeAttribute('aria-activedescendant');
    record.trigger.removeAttribute('aria-controls');
    if (record.topLayer && record.menu.isConnected && record.menu.matches(':popover-open')) record.menu.hidePopover();
    record.menu.remove();
    record.menu = null;
    record.search = '';
  }

  function position() {
    if (!active) return;
    const { trigger, menu } = active;
    if (!trigger.isConnected || !trigger.getClientRects().length) { close(); return; }
    const rect = trigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const width = viewport?.width || document.documentElement.clientWidth;
    const height = viewport?.height || window.innerHeight;
    const inset = 10, gap = 7;
    if (rect.bottom < top || rect.top > top + height) { close(); return; }
    const menuWidth = Math.min(Math.max(rect.width, 150), width - inset * 2);
    menu.style.width = `${menuWidth}px`;
    menu.style.left = `${Math.max(left + inset, Math.min(rect.left, left + width - menuWidth - inset))}px`;
    const below = top + height - rect.bottom - gap - inset;
    const above = rect.top - top - gap - inset;
    const wanted = Math.min(menu.scrollHeight, 320);
    const up = below < wanted && above > below;
    const available = Math.max(0, up ? above : below);
    menu.style.maxHeight = `${Math.min(320, available)}px`;
    menu.classList.toggle('opens-up', up);
    const actualHeight = menu.getBoundingClientRect().height;
    menu.style.top = `${Math.max(top + inset, up ? rect.top - gap - actualHeight : rect.bottom + gap)}px`;
  }

  function highlight(record, index) {
    if (active !== record || record.native.options[index]?.matches(':disabled')) return;
    const row = record.rows[index];
    if (!row) return;
    record.index = index;
    record.rows.forEach((item, i) => item.classList.toggle('is-active', i === index));
    record.trigger.setAttribute('aria-activedescendant', row.id);
    // Only the list scrolls; selecting a distant option must not move the page.
    if (row.offsetTop < record.menu.scrollTop) record.menu.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > record.menu.scrollTop + record.menu.clientHeight) {
      record.menu.scrollTop = row.offsetTop + row.offsetHeight - record.menu.clientHeight;
    }
  }

  function commit(record, index = record.index) {
    const option = record.native.options[index];
    if (!option || option.matches(':disabled') || record.trigger.disabled) return;
    const changed = record.native.selectedIndex !== index;
    close();
    // Touch selection can move focus away; render must capture this field.
    record.trigger.focus({ preventScroll: true });
    if (changed) {
      record.native.selectedIndex = index;
      // Exactly one change, through the original field's existing handler.
      record.native.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (record.native.isConnected) {
      refreshOne(record); // Also reflects a rejected change restored by the handler.
      record.trigger.focus({ preventScroll: true });
    }
    // A full render restores focus, including when the chosen field disappears.
  }

  function open(record, initialIndex = record.native.selectedIndex) {
    if (record.trigger.disabled || !record.native.isConnected) return;
    close();
    const menu = element('div', 'rx-select-menu');
    menu.id = `${record.native.id}-options`;
    menu.setAttribute('role', 'listbox');
    if (record.trigger.hasAttribute('aria-labelledby')) menu.setAttribute('aria-labelledby', record.trigger.getAttribute('aria-labelledby'));
    else menu.setAttribute('aria-label', record.trigger.getAttribute('aria-label') || 'Opcje');
    record.rows = [...record.native.options].map((option, index) => {
      const row = element('div', 'rx-select-option');
      row.id = `${record.native.id}-option-${index}`;
      row.setAttribute('role', 'option');
      row.dataset.index = String(index);
      row.setAttribute('aria-selected', String(index === record.native.selectedIndex));
      row.setAttribute('aria-disabled', String(option.matches(':disabled')));
      if (option.dataset.icon) row.append(symbol(option.dataset.icon, 'rx-select-option-icon'));
      row.append(element('span', 'rx-select-option-label', option.label), symbol('check', 'rx-select-check'));
      menu.append(row);
      return row;
    });
    record.menu = menu;
    record.search = '';
    record.searchAt = 0;
    active = record;
    // A modal's controls must stay inside its top-layer subtree.
    (record.native.closest('dialog[open]') || document.body).append(menu);
    record.topLayer = typeof menu.showPopover === 'function';
    if (record.topLayer) {
      menu.setAttribute('popover', 'manual');
      menu.showPopover();
    }
    record.trigger.setAttribute('aria-controls', menu.id);
    record.trigger.setAttribute('aria-expanded', 'true');
    record.trigger.focus({ preventScroll: true });
    position();
    const indexes = enabledIndexes(record);
    highlight(record, indexes.includes(initialIndex) ? initialIndex : indexes[0]);
    menu.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse') event.preventDefault();
    });
    menu.addEventListener('pointermove', event => {
      const row = event.target.closest('.rx-select-option');
      if (row && event.pointerType !== 'touch') highlight(record, Number(row.dataset.index));
    });
    menu.addEventListener('click', event => {
      const row = event.target.closest('.rx-select-option');
      if (row) commit(record, Number(row.dataset.index));
    });
  }

  function keydown(record, event) {
    if (event.ctrlKey || event.metaKey || record.trigger.disabled) return;
    const key = event.key, isOpen = active === record;
    const indexes = enabledIndexes(record);
    if (!indexes.length) return;
    if (key === 'Escape' && isOpen) {
      event.preventDefault(); event.stopPropagation(); close(); return;
    }
    if (key === 'Tab') { if (isOpen) commit(record); return; }
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (isOpen) commit(record); else open(record);
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(key)) {
      event.preventDefault();
      if (isOpen && event.altKey && key === 'ArrowUp') { commit(record); return; }
      let index = isOpen ? record.index : record.native.selectedIndex;
      if (key === 'Home') index = indexes[0];
      else if (key === 'End') index = indexes.at(-1);
      else if (isOpen && !event.altKey) {
        const step = key.startsWith('Page') ? 5 : 1;
        const direction = ['ArrowDown', 'PageDown'].includes(key) ? 1 : -1;
        const next = Math.max(0, Math.min(indexes.length - 1, indexes.indexOf(index) + direction * step));
        index = indexes[next];
      }
      if (isOpen) highlight(record, index); else open(record, index);
      return;
    }
    if (key.length === 1 && !event.altKey) {
      event.preventDefault();
      if (!isOpen) open(record);
      const now = Date.now(), letter = normalize(key);
      record.search = now - record.searchAt < 700 ? record.search + letter : letter;
      record.searchAt = now;
      const labels = [...record.native.options].map(option => normalize(option.label));
      let index = indexes.find(i => labels[i].startsWith(record.search));
      if (index === undefined) {
        record.search = letter;
        const start = indexes.indexOf(record.index) + 1;
        index = [...indexes.slice(start), ...indexes.slice(0, start)].find(i => labels[i].startsWith(letter));
      }
      if (index !== undefined) highlight(record, index);
    }
  }

  function enhance(root = document) {
    if (active && !active.native.isConnected) close();
    root.querySelectorAll('select').forEach(native => {
      if (records.has(native) || native.multiple || native.size > 1) return;
      if (!native.id) native.id = `rx-select-${++serial}`;
      const wrapper = element('div', 'rx-select');
      const trigger = element('button', 'rx-select-trigger');
      const leading = element('span', 'rx-select-symbol');
      const value = element('span', 'rx-select-value');
      trigger.type = 'button';
      trigger.id = `${native.id}-trigger`;
      trigger.dataset.selectId = native.id;
      trigger.setAttribute('role', 'combobox');
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false');
      const labels = [...native.labels];
      labels.forEach((label, index) => {
        if (!label.id) label.id = `${native.id}-label-${index}`;
        label.htmlFor = trigger.id;
      });
      const labelledBy = native.getAttribute('aria-labelledby') || labels.map(label => label.id).join(' ');
      if (labelledBy) trigger.setAttribute('aria-labelledby', labelledBy);
      else trigger.setAttribute('aria-label', native.getAttribute('aria-label') || 'Wybierz opcję');
      if (native.classList.contains('package-select')) wrapper.classList.add('rx-select-package');
      trigger.append(leading, value, symbol('down', 'rx-select-chevron'));
      native.before(wrapper);
      wrapper.append(native, trigger);
      native.hidden = true;
      native.tabIndex = -1;
      native.setAttribute('aria-hidden', 'true');
      native.dataset.selectEnhanced = 'true';
      const record = { native, wrapper, trigger, value, leading, rows: [], index: 0 };
      records.set(native, record);
      refreshOne(record);
      trigger.addEventListener('click', () => active === record ? close() : open(record));
      trigger.addEventListener('keydown', event => keydown(record, event));
    });
  }

  function refresh(root = document) {
    if (active && !active.native.isConnected) close();
    root.querySelectorAll('select[data-select-enhanced]').forEach(native => {
      const record = records.get(native);
      if (record) refreshOne(record);
    });
  }

  function focus(id) {
    const native = document.getElementById(id);
    (records.get(native)?.trigger || native)?.focus({ preventScroll: true });
  }

  document.addEventListener('pointerdown', event => {
    if (active && !active.wrapper.contains(event.target) && !active.menu.contains(event.target)) close();
  }, true);
  document.addEventListener('focusin', event => {
    if (active && !active.wrapper.contains(event.target) && !active.menu.contains(event.target)) close();
  });
  document.addEventListener('scroll', event => {
    if (active && !active.menu.contains(event.target)) position();
  }, true);
  document.addEventListener('close', event => {
    if (active && event.target.contains(active.native)) close();
  }, true);
  document.addEventListener('toggle', event => {
    if (active && event.target.tagName === 'DETAILS' && !event.target.open && event.target.contains(active.native)) close();
  }, true);
  window.addEventListener('resize', position);
  window.visualViewport?.addEventListener('resize', position);
  window.visualViewport?.addEventListener('scroll', position);
  return { enhance, refresh, close, focus };
}
