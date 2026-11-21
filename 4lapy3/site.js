/* Cztery Łapy i Ty — browser-only interactions, no analytics or stored form data. */
(function () {
  'use strict';

  const TIME_ZONE = 'Europe/Warsaw';
  const CLINIC = 'Przychodnia Weterynaryjna Cztery Łapy i Ty';
  const ADDRESS = 'ul. Chabrowa 2D, 52-200 Wysoka';
  const PHONE = '71 786 78 84';
  const HOURS = [null, [600, 1080], [600, 1080], [600, 1080], [600, 1080], [600, 1080], [600, 720]];
  const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const LEAD_DAYS = [1, 7, 14];
  const MESSAGES = {
    pl: {
      locale: 'pl-PL', clinic: CLINIC, address: ADDRESS,
      dayNames: ['w niedzielę', 'w poniedziałek', 'we wtorek', 'w środę', 'w czwartek', 'w piątek', 'w sobotę'],
      leads: { 1: 'dzień wcześniej', 7: 'tydzień wcześniej', 14: 'dwa tygodnie wcześniej' },
      open: 'Otwarte teraz', closed: 'Zamknięte', tomorrow: 'jutro',
      openUntil: time => `Zapraszamy dziś do ${time}`,
      opensToday: time => `Otwieramy dziś o ${time}`,
      opensOn: (day, time) => `Otwieramy ${day} o ${time}`,
      callToBook: 'Zadzwoń, aby umówić wizytę',
      dateRequired: 'Wybierz datę szczepienia z książeczki zdrowia.',
      datePast: 'Ta data już minęła. Wpisz datę kolejnego szczepienia.',
      leadRequired: 'Wybierz termin przypomnienia z listy.',
      reminderPast: 'Wybrany termin przypomnienia już minął. Wybierz krótsze wyprzedzenie.',
      reminderTooSoon: 'Dla tej daty jest już za późno na przypomnienie z wyprzedzeniem. Zadzwoń, aby umówić wizytę.',
      reminderTitle: name => name ? `Umów szczepienie — ${name}` : 'Umów szczepienie zwierzaka',
      vaccinationDate: date => `Data szczepienia z książeczki zdrowia: ${date}.`,
      bookingPhone: `Zadzwoń, żeby umówić wizytę: ${PHONE}.`,
      appointmentByPhone: 'Termin wizyty ustal telefonicznie.',
      alarmDescription: title => `${title}. Zadzwoń: ${PHONE}.`,
      selectDate: 'Wybierz datę szczepienia',
      previewNote: dateOrLead => `Przypomnienie: ${dateOrLead}, o 9:00`,
      previewDateInvalid: 'Sprawdź datę szczepienia.',
      previewReminderInvalid: 'Termin przypomnienia już minął.',
      googleSuccess: 'W Kalendarzu Google zapisz przygotowane wydarzenie. Termin wizyty ustal telefonicznie.',
      icsSuccess: 'Otwórz pobrany plik i zatwierdź wydarzenie w swoim kalendarzu. Termin wizyty ustal telefonicznie.',
      filenamePrefix: 'przypomnienie-szczepienie', calendarProduct: 'Przypomnienie//PL',
      menuOpen: 'Otwórz menu', menuClose: 'Zamknij menu',
      mapTitle: 'Dojazd do przychodni Cztery Łapy i Ty, Chabrowa 2D, Wysoka',
      mapLoading: 'Ładowanie mapy Google…', mapLoaded: 'Mapa Google jest włączona.'
    },
    en: {
      locale: 'en-GB', clinic: 'Cztery Łapy i Ty Veterinary Clinic', address: 'Chabrowa 2D, 52-200 Wysoka',
      dayNames: ['on Sunday', 'on Monday', 'on Tuesday', 'on Wednesday', 'on Thursday', 'on Friday', 'on Saturday'],
      leads: { 1: 'one day before', 7: 'one week before', 14: 'two weeks before' },
      open: 'Open now', closed: 'Closed', tomorrow: 'tomorrow',
      openUntil: time => `Open today until ${time}`,
      opensToday: time => `We open today at ${time}`,
      opensOn: (day, time) => `We open ${day} at ${time}`,
      callToBook: 'Call to book an appointment',
      dateRequired: 'Choose the vaccination date from your pet’s health record.',
      datePast: 'That date has passed. Enter the date of the next vaccination.',
      leadRequired: 'Choose a reminder time from the list.',
      reminderPast: 'The selected reminder time has passed. Choose a shorter lead time.',
      reminderTooSoon: 'It is too late to set an advance reminder for this date. Call to book an appointment.',
      reminderTitle: name => name ? `Book a vaccination — ${name}` : 'Book your pet’s vaccination',
      vaccinationDate: date => `Vaccination date from your pet’s health record: ${date}.`,
      bookingPhone: `Call to book an appointment: +48 ${PHONE}.`,
      appointmentByPhone: 'Arrange the appointment by phone.',
      alarmDescription: title => `${title}. Call: +48 ${PHONE}.`,
      selectDate: 'Choose the vaccination date',
      previewNote: dateOrLead => `Reminder: ${dateOrLead} at 09:00 (Poland time)`,
      previewDateInvalid: 'Check the vaccination date.',
      previewReminderInvalid: 'The reminder time has passed.',
      googleSuccess: 'Save the prepared event in Google Calendar. Arrange the appointment by phone.',
      icsSuccess: 'Open the downloaded file and add the event to your calendar. Arrange the appointment by phone.',
      filenamePrefix: 'vaccination-reminder', calendarProduct: 'Vaccination reminder//EN',
      menuOpen: 'Open menu', menuClose: 'Close menu',
      mapTitle: 'Directions to Cztery Łapy i Ty Veterinary Clinic, Chabrowa 2D, Wysoka',
      mapLoading: 'Loading Google Maps…', mapLoaded: 'Google Maps is enabled.'
    }
  };
  const normalizeLanguage = language => /^en(?:-|$)/i.test(String(language || '')) ? 'en' : 'pl';
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  const dateFormats = Object.fromEntries(Object.entries(MESSAGES).map(([language, copy]) => [language, {
    full: new Intl.DateTimeFormat(copy.locale, { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }),
    short: new Intl.DateTimeFormat(copy.locale, { timeZone: 'UTC', day: 'numeric', month: 'long' })
  }]));
  const pad = value => String(value).padStart(2, '0');
  const dateKey = date => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  const utcStamp = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

  function warsawParts(date) {
    return Object.fromEntries(clock.formatToParts(date).map(part => [part.type, part.value]));
  }

  function warsawDateKey(date) {
    const parts = warsawParts(date);
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function parseDate(value) {
    const match = /^([1-9]\d{3})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!match) return null;
    const result = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return dateKey(result) === value ? result : null;
  }

  // A calendar day is represented in UTC; the reminder itself is always 09:00 in Poland.
  // Resolving the IANA zone per date handles both winter and summer time.
  function atWarsawNine(day) {
    const target = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 9);
    let instant = target;
    for (let i = 0; i < 3; i += 1) {
      const parts = warsawParts(new Date(instant));
      const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
        Number(parts.hour), Number(parts.minute), Number(parts.second));
      instant += target - represented;
    }
    return new Date(instant);
  }

  function openingStatus(date, language = 'pl') {
    const copy = MESSAGES[normalizeLanguage(language)];
    const parts = warsawParts(date);
    const day = WEEKDAYS[parts.weekday];
    const minutes = Number(parts.hour) * 60 + Number(parts.minute);
    const schedule = HOURS[day];
    const format = value => `${Math.floor(value / 60)}:${pad(value % 60)}`;
    if (schedule && minutes >= schedule[0] && minutes < schedule[1]) {
      return { day, state: 'open', label: copy.open, detail: copy.openUntil(format(schedule[1])) };
    }
    if (schedule && minutes < schedule[0]) {
      return { day, state: 'closed', label: copy.closed, detail: copy.opensToday(format(schedule[0])) };
    }
    for (let ahead = 1; ahead <= 7; ahead += 1) {
      const next = (day + ahead) % 7;
      if (HOURS[next]) {
        return { day, state: 'closed', label: copy.closed,
          detail: copy.opensOn(ahead === 1 ? copy.tomorrow : copy.dayNames[next], format(HOURS[next][0])) };
      }
    }
    return { day, state: 'closed', label: copy.closed, detail: copy.callToBook };
  }

  function cleanName(value) {
    return Array.from(String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 30).join('');
  }

  function buildReminder(values, now, language = 'pl') {
    language = normalizeLanguage(language);
    const copy = MESSAGES[language];
    const current = now || new Date();
    const vaccination = parseDate(values.date);
    if (!vaccination) return { error: copy.dateRequired, field: 'date' };
    if (values.date < warsawDateKey(current)) {
      return { error: copy.datePast, field: 'date' };
    }
    const days = Number(values.days);
    if (!LEAD_DAYS.includes(days)) {
      return { error: copy.leadRequired, field: 'alarm' };
    }
    const reminderDay = addDays(vaccination, -days);
    const start = atWarsawNine(reminderDay);
    if (start.getTime() <= current.getTime()) {
      const shorterLeadAvailable = LEAD_DAYS.some(lead => lead < days &&
        atWarsawNine(addDays(vaccination, -lead)).getTime() > current.getTime());
      return { error: shorterLeadAvailable ? copy.reminderPast : copy.reminderTooSoon, field: 'alarm' };
    }
    const name = cleanName(values.name);
    const title = copy.reminderTitle(name);
    const description = `${copy.vaccinationDate(dateFormats[language].full.format(vaccination))}\n` +
      `${copy.bookingPhone}\n${copy.clinic}\n${copy.address}\n${copy.appointmentByPhone}`;
    return { vaccination, reminderDay, start, end: new Date(start.getTime() + 15 * 60000),
      name, title, description, days, language, location: `${copy.clinic}, ${copy.address}` };
  }

  // The preview and exports use the same validation. A past reminder must never
  // appear as a ready calendar event while the user is filling in the form.
  function reminderPreview(values, now, language = 'pl') {
    language = normalizeLanguage(language);
    const copy = MESSAGES[language];
    const formats = dateFormats[language];
    const vaccination = parseDate(values.date);
    const preview = {
      title: copy.reminderTitle(cleanName(values.name)),
      date: vaccination ? formats.full.format(vaccination) : copy.selectDate,
      note: copy.previewNote(copy.leads[Number(values.days)] || copy.leads[7]),
      error: '', field: ''
    };
    // Keep an untouched or cleared date field neutral; submit still requires it.
    if (!values.date) return preview;
    const reminder = buildReminder(values, now, language);
    if (reminder.error) {
      preview.error = reminder.error;
      preview.field = reminder.field;
      preview.note = reminder.field === 'date' ? copy.previewDateInvalid
        : LEAD_DAYS.includes(Number(values.days)) ? copy.previewReminderInvalid : copy.leadRequired;
    } else {
      preview.note = copy.previewNote(formats.short.format(reminder.reminderDay));
    }
    return preview;
  }

  function googleUrl(reminder) {
    const language = normalizeLanguage(reminder.language);
    const copy = MESSAGES[language];
    const params = new URLSearchParams({
      action: 'TEMPLATE', text: reminder.title,
      dates: `${utcStamp(reminder.start)}/${utcStamp(reminder.end)}`,
      ctz: TIME_ZONE, hl: language, details: reminder.description,
      location: reminder.location || `${copy.clinic}, ${copy.address}`
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function icsEscape(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  }

  function foldLine(line) {
    const encoder = new TextEncoder();
    let result = '', bytes = 0;
    for (const character of line) {
      const size = encoder.encode(character).length;
      if (bytes + size > 75) { result += '\r\n '; bytes = 1; }
      result += character;
      bytes += size;
    }
    return result;
  }

  function calendarFile(reminder, now) {
    const copy = MESSAGES[normalizeLanguage(reminder.language)];
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//Cztery Lapy i Ty//${copy.calendarProduct}`,
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      `UID:${id}@cztery-lapy-i-ty`, `DTSTAMP:${utcStamp(now || new Date())}`,
      `DTSTART:${utcStamp(reminder.start)}`, `DTEND:${utcStamp(reminder.end)}`,
      `SUMMARY:${icsEscape(reminder.title)}`, `DESCRIPTION:${icsEscape(reminder.description)}`,
      `LOCATION:${icsEscape(reminder.location || `${copy.clinic}, ${copy.address}`)}`, 'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0S',
      `DESCRIPTION:${icsEscape(copy.alarmDescription(reminder.title))}`,
      'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'
    ].map(foldLine).join('\r\n') + '\r\n';
  }

  function calendarFilename(reminder) {
    const copy = MESSAGES[normalizeLanguage(reminder.language)];
    const safeName = String(reminder.name || '').toLowerCase().replace(/ł/g, 'l').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${copy.filenamePrefix}${safeName ? `-${safeName}` : ''}.ics`;
  }

  function initializeAnchorNavigation(doc, page, motionPreference) {
    const root = doc.documentElement;
    const reset = () => { root.style.scrollBehavior = 'auto'; };
    reset();

    // Let the browser keep its native fragment, focus and history behavior.
    // Only a deliberate link within this document opts into animated scrolling.
    doc.addEventListener('click', event => {
      reset();
      if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.shiftKey || event.altKey || motionPreference.matches) return;
      const link = event.target.closest && event.target.closest('a[href]');
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      let target, current, id;
      try {
        current = new URL(page.location.href);
        target = new URL(link.href, current);
        id = decodeURIComponent(target.hash.slice(1));
      } catch (_) { return; }
      if (target.origin !== current.origin || target.pathname !== current.pathname ||
        target.search !== current.search || !id || !doc.getElementById(id)) return;
      root.style.scrollBehavior = 'smooth';
    });

    // Keep the opt-in through native fragment events: clearing it on hashchange
    // or popstate can turn the requested animation into a jump before it starts.
    // Reset after the scroll, before the next interaction, or on page lifecycle.
    ['pagehide', 'pageshow'].forEach(type => page.addEventListener(type, reset));
    ['scrollend', 'pointerdown', 'keydown'].forEach(type => doc.addEventListener(type, reset));
    if (motionPreference.addEventListener) motionPreference.addEventListener('change', reset);
    else if (motionPreference.addListener) motionPreference.addListener(reset);
  }

  function initializeManualTop(doc, page) {
    let manualIntent = false;
    let touchStart = null;
    const passive = { passive: true };
    const reset = () => { manualIntent = false; touchStart = null; };
    const entryPending = () => {
      if (!doc.documentElement.dataset.entryPending) return false;
      reset();
      return true;
    };
    const isEditing = target => target && (target.isContentEditable ||
      (target.closest && target.closest('input, textarea, select, [contenteditable], [role="textbox"]')));
    const isManualInput = event => !entryPending() && !event.defaultPrevented && event.isTrusted !== false && !isEditing(event.target);

    const clearAtTop = () => {
      if (entryPending() || !manualIntent || !Number.isFinite(page.scrollY) || page.scrollY > 1) return;
      let current;
      try {
        current = new URL(page.location.href);
        if (!current.hash) return;
        current.hash = '';
        page.history.replaceState(page.history.state, '', current.href);
      } catch (_) { return; }
      page.dispatchEvent(new page.Event('site:fragmentchange'));
    };
    const confirmManualIntent = () => {
      manualIntent = true;
      // A pull at the top may refresh without another scroll event or touchend.
      clearAtTop();
    };

    doc.addEventListener('wheel', event => {
      if (!isManualInput(event) || event.ctrlKey || event.shiftKey ||
        Math.abs(event.deltaY) <= Math.abs(event.deltaX || 0)) return;
      if (event.deltaY) confirmManualIntent();
    }, passive);

    doc.addEventListener('touchstart', event => {
      touchStart = null;
      if (!isManualInput(event) || event.touches.length !== 1) return;
      const touch = event.touches[0];
      touchStart = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
    }, passive);
    doc.addEventListener('touchmove', event => {
      if (!touchStart) return;
      if (!isManualInput(event) || event.touches.length !== 1) { touchStart = null; return; }
      const touch = event.touches[0];
      if (touch.identifier !== touchStart.id) { touchStart = null; return; }
      const x = Math.abs(touch.clientX - touchStart.x);
      const y = Math.abs(touch.clientY - touchStart.y);
      if (y > 6 && y > x) confirmManualIntent();
    }, passive);
    ['touchend', 'touchcancel'].forEach(type => doc.addEventListener(type, () => { touchStart = null; }, passive));

    const scrollKeys = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar']);
    doc.addEventListener('keydown', event => {
      if (!isManualInput(event) || !scrollKeys.has(event.key) || event.altKey ||
        ((event.ctrlKey || event.metaKey) && event.key !== 'Home' && event.key !== 'End')) return;
      if ((event.key === ' ' || event.key === 'Spacebar') && event.target.closest &&
        event.target.closest('button, summary, [role="button"]')) return;
      confirmManualIntent();
    }, passive);

    page.addEventListener('scroll', clearAtTop, passive);
    // Navigation owns the next scroll, including same-hash links and BFCache.
    // Neither startup nor a reset checks the initial top frame.
    doc.addEventListener('click', event => {
      if (event.target.closest && event.target.closest('a[href]')) reset();
    }, { passive: true, capture: true });
    ['popstate', 'hashchange', 'pagehide', 'pageshow'].forEach(type => page.addEventListener(type, reset, passive));
  }

  // Offline checks exercise these functions directly; none is exposed on window.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseDate, atWarsawNine, openingStatus, buildReminder, reminderPreview, googleUrl, calendarFile, calendarFilename, initializeAnchorNavigation, initializeManualTop };
  }
  if (typeof document === 'undefined') return;

  const pageLanguage = normalizeLanguage(document.documentElement.lang);
  const copy = MESSAGES[pageLanguage];

  const all = selector => Array.from(document.querySelectorAll(selector));
  const write = (selector, value) => all(selector).forEach(element => {
    if (element.textContent !== value) element.textContent = value;
  });
  document.documentElement.classList.add('js');

  // Enhance native details only where WAAPI is available. Summary keeps its native
  // Enter/Space activation; without JavaScript the original disclosure still works.
  function initializeServiceAccordions() {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const controllers = [];
    const numeric = value => parseFloat(value) || 0;

    document.querySelectorAll('details.service').forEach(details => {
      const summary = details.querySelector('summary');
      const content = details.querySelector('.service-content');
      if (!summary || !content || typeof details.animate !== 'function') return;

      let animation = null;
      let targetOpen = details.open;
      let targetHeight = 0;
      const originalStyles = ['height', 'overflow'].map(name => ({
        name, value: details.style.getPropertyValue(name),
        priority: details.style.getPropertyPriority(name)
      }));

      // Child boxes retain their natural height while the details box is clipped.
      // Observing these children, rather than the animated box, avoids resize loops.
      const measure = () => {
        const box = window.getComputedStyle(details);
        const chrome = numeric(box.borderTopWidth) + numeric(box.borderBottomWidth) +
          numeric(box.paddingTop) + numeric(box.paddingBottom);
        const outerHeight = element => {
          const style = window.getComputedStyle(element);
          return element.getBoundingClientRect().height + numeric(style.marginTop) + numeric(style.marginBottom);
        };
        const offset = box.boxSizing === 'border-box' ? 0 : chrome;
        const closed = chrome + outerHeight(summary) - offset;
        return { closed, expanded: closed + outerHeight(content), offset };
      };

      const cancelAnimation = () => {
        if (!animation) return;
        const previous = animation;
        animation = null;
        previous.onfinish = previous.oncancel = null;
        previous.cancel();
      };

      const settle = open => {
        cancelAnimation();
        targetOpen = open;
        details.open = open;
        originalStyles.forEach(({ name, value, priority }) => {
          if (value) details.style.setProperty(name, value, priority);
          else details.style.removeProperty(name);
        });
        details.removeAttribute('data-accordion-state');
      };

      const animateTo = open => {
        targetOpen = open;
        const box = measure();
        const startHeight = details.getBoundingClientRect().height - box.offset;
        // Pin the currently painted height before cancelling an interrupted run.
        details.style.height = `${startHeight}px`;
        cancelAnimation();
        details.open = true; // Keep the content rendered until a closing run ends.
        details.style.overflow = 'hidden';
        details.setAttribute('data-accordion-state', open ? 'opening' : 'closing');
        const size = measure();
        targetHeight = open ? size.expanded : size.closed;
        const distance = Math.abs(targetHeight - startHeight);
        if (preference.matches || distance < 0.5) { settle(open); return; }

        const duration = Math.max(100, Math.min(340,
          340 * distance / Math.max(size.expanded - size.closed, 1)));
        const current = details.animate([
          { height: `${startHeight}px` },
          { height: `${targetHeight}px` }
        ], { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' });
        animation = current;
        // A stale callback from a cancelled run cannot overwrite the latest intent.
        current.onfinish = () => { if (animation === current) settle(targetOpen); };
        current.oncancel = () => { if (animation === current) settle(targetOpen); };
      };

      const onClick = event => {
        if (event.defaultPrevented || (event.button !== undefined && event.button !== 0)) return;
        const interactive = event.target.closest && event.target.closest('a, button, input, select, textarea, label, [contenteditable="true"]');
        if (interactive && interactive !== summary) return;
        // Dragging to select a heading must not activate the disclosure on release.
        // Keyboard activation (detail === 0) still toggles it normally.
        const selection = window.getSelection ? window.getSelection() : null;
        if (event.detail > 0 && selection && !selection.isCollapsed && selection.rangeCount > 0 &&
          selection.getRangeAt(0).intersectsNode(summary)) {
          event.preventDefault();
          return;
        }
        if (preference.matches) {
          if (animation) settle(targetOpen);
          return; // Native immediate toggling, including keyboard activation.
        }
        event.preventDefault();
        animateTo(animation ? !targetOpen : !details.open);
      };

      const onResize = () => {
        if (!animation) return;
        const size = measure();
        const end = targetOpen ? size.expanded : size.closed;
        if (Math.abs(end - targetHeight) > 0.5) animateTo(targetOpen);
      };
      const onToggle = () => {
        // Honor an external/native close (for example find-in-page or another script).
        if (animation && !details.open) settle(false);
      };
      const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(onResize) : null;
      if (observer) { observer.observe(summary); observer.observe(content); }
      else window.addEventListener('resize', onResize, { passive: true });
      summary.addEventListener('click', onClick);
      details.addEventListener('toggle', onToggle);
      controllers.push({
        finish: () => { if (animation) settle(targetOpen); },
        destroy: () => {
          if (animation) settle(targetOpen);
          summary.removeEventListener('click', onClick);
          details.removeEventListener('toggle', onToggle);
          if (observer) observer.disconnect();
          else window.removeEventListener('resize', onResize);
        }
      });
    });

    const finishAll = () => controllers.forEach(controller => controller.finish());
    const onPreferenceChange = () => { if (preference.matches) finishAll(); };
    if (preference.addEventListener) preference.addEventListener('change', onPreferenceChange);
    else if (preference.addListener) preference.addListener(onPreferenceChange);
    window.addEventListener('beforeprint', finishAll);

    return () => {
      controllers.forEach(controller => controller.destroy());
      if (preference.removeEventListener) preference.removeEventListener('change', onPreferenceChange);
      else if (preference.removeListener) preference.removeListener(onPreferenceChange);
      window.removeEventListener('beforeprint', finishAll);
    };
  }

  initializeServiceAccordions();

  function updateOpening() {
    const status = openingStatus(new Date(), pageLanguage);
    write('[data-opening-status]', status.label);
    write('[data-opening-detail]', status.detail);
    all('[data-opening-state]').forEach(element => { element.dataset.state = status.state; });
    all('[data-hours-row]').forEach(row => {
      const key = status.day === 0 ? 'sunday' : status.day === 6 ? 'saturday' : 'weekday';
      row.classList.toggle('is-today', row.dataset.hoursRow === key);
    });
  }
  updateOpening();
  window.setInterval(updateOpening, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateOpening(); });

  const menuToggle = document.querySelector('[data-menu-toggle]');
  const menuPanel = document.querySelector('[data-menu-panel]');
  const menuScrim = document.querySelector('[data-menu-scrim]');
  if (menuToggle && menuPanel && menuScrim) {
    const header = menuToggle.closest('.site-header');
    const root = document.documentElement;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const isCompact = () => window.getComputedStyle(menuToggle).display !== 'none';
    let expanded = false;
    let animations = [];
    let operation = 0;

    const setMenu = (open, { immediate = false, returnFocus = false } = {}) => {
      const compact = isCompact();
      const next = compact && open;
      if (next === expanded && !immediate) return;
      const version = ++operation;
      // Read a running animation before cancelling, so a second tap reverses smoothly.
      const panelStyle = window.getComputedStyle(menuPanel);
      const scrimStyle = window.getComputedStyle(menuScrim);
      const start = {
        opacity: menuPanel.hidden ? 0 : panelStyle.opacity,
        transform: menuPanel.hidden ? 'translateY(-12px)' : panelStyle.transform,
        scrimOpacity: menuScrim.hidden ? 0 : scrimStyle.opacity
      };
      animations.forEach(animation => animation.cancel());
      animations = [];
      expanded = next;
      menuToggle.setAttribute('aria-expanded', String(expanded));
      menuToggle.setAttribute('aria-label', expanded ? copy.menuClose : copy.menuOpen);
      menuToggle.classList.toggle('is-active', expanded);
      root.classList.toggle('menu-open', expanded);
      if (returnFocus) menuToggle.focus({ preventScroll: true });
      // This remains a disclosure. Tab can leave the header and close it naturally.
      menuPanel.inert = compact && !expanded;

      const finish = () => {
        if (version !== operation) return;
        menuPanel.hidden = compact && !expanded;
        menuScrim.hidden = !expanded;
        animations.forEach(animation => animation.cancel());
        animations = [];
      };
      if (immediate || !compact || motion.matches || typeof menuPanel.animate !== 'function') {
        finish();
        return;
      }
      menuPanel.hidden = false;
      menuScrim.hidden = false;
      const timing = { duration: expanded ? 360 : 240, easing: 'cubic-bezier(.22,.68,0,1)', fill: 'both' };
      animations = [
        menuPanel.animate([
          { opacity: start.opacity, transform: start.transform },
          { opacity: expanded ? 1 : 0, transform: expanded ? 'translateY(0)' : 'translateY(-8px)' }
        ], timing),
        menuScrim.animate([{ opacity: start.scrimOpacity }, { opacity: expanded ? 1 : 0 }], timing)
      ];
      Promise.all(animations.map(animation => animation.finished)).then(finish, () => {});
    };

    setMenu(false, { immediate: true });
    menuToggle.addEventListener('click', event => {
      setMenu(!expanded);
      if (expanded && event.detail === 0) menuPanel.querySelector('a').focus({ preventScroll: true });
    });
    menuPanel.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
    menuScrim.addEventListener('click', () => setMenu(false, { returnFocus: true }));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && expanded) {
        event.preventDefault();
        setMenu(false, { returnFocus: true });
      }
    });
    document.addEventListener('focusin', event => {
      if (expanded && !header.contains(event.target)) setMenu(false);
    });
    document.addEventListener('click', event => {
      if (!expanded) return;
      const link = event.target.closest('a');
      if (link && link.hasAttribute('data-language-switch') && event.button === 0 &&
        !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        // The destination starts closed: do not capture an old-only menu snapshot.
        setMenu(false, { immediate: true });
      } else if (link && link.closest('.brand')) setMenu(false);
    });
    let compact = isCompact();
    window.addEventListener('resize', () => {
      if (isCompact() !== compact) { compact = isCompact(); setMenu(false, { immediate: true }); }
    }, { passive: true });
    const resetMenu = () => setMenu(false, { immediate: true });
    window.addEventListener('pageswap', resetMenu);
    window.addEventListener('pagehide', resetMenu);
    window.addEventListener('pageshow', event => { if (event.persisted) resetMenu(); });
    const onMotion = () => { if (motion.matches) setMenu(expanded, { immediate: true }); };
    if (motion.addEventListener) motion.addEventListener('change', onMotion);
    else if (motion.addListener) motion.addListener(onMotion);
  }

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  initializeAnchorNavigation(document, window, motionPreference);
  initializeManualTop(document, window);
  const openingSign = document.querySelector('[data-opening-sign]');
  if (openingSign && 'IntersectionObserver' in window &&
    typeof openingSign.animate === 'function' && typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' && CSS.supports('rotate', '1deg')) {
    const pageRoot = document.documentElement;
    const swingTrigger = openingSign.querySelector('[data-swing-trigger]');
    let signAnimation = null;
    let introHandled = motionPreference.matches || pageRoot.dataset.languageTransition === 'incoming';
    let inView = false;
    let pageLeaving = false;
    const signObserver = new IntersectionObserver(entries => {
      inView = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5);
      if (!introHandled && inView) swingSign();
    }, { threshold: 0.5 });

    function skipSignIntro() {
      introHandled = true;
      signObserver.disconnect();
    }
    function cancelSignMotion() {
      if (!signAnimation) return;
      const current = signAnimation;
      signAnimation = null;
      current.onfinish = current.oncancel = null;
      current.cancel();
    }
    function swingSign() {
      if (signAnimation || motionPreference.matches || document.hidden || pageLeaving ||
        pageRoot.dataset.languageTransition) return;
      skipSignIntro();
      // The cords and plaque rotate together around the existing suspension point.
      const current = openingSign.animate([
        { rotate: '0deg', offset: 0, easing: 'ease-in-out' },
        { rotate: '-3.5deg', offset: 0.18, easing: 'ease-in-out' },
        { rotate: '2.3deg', offset: 0.43, easing: 'ease-in-out' },
        { rotate: '-1.2deg', offset: 0.67, easing: 'ease-in-out' },
        { rotate: '0.45deg', offset: 0.86, easing: 'ease-in-out' },
        { rotate: '0deg', offset: 1 }
      ], { duration: 2400, fill: 'none' });
      signAnimation = current;
      const finish = () => {
        if (signAnimation === current) signAnimation = null;
        current.onfinish = current.oncancel = null;
      };
      current.onfinish = finish;
      current.oncancel = finish;
    }
    function onSignMotionChange() {
      if (motionPreference.matches) {
        skipSignIntro();
        cancelSignMotion();
      }
      if (swingTrigger) swingTrigger.hidden = motionPreference.matches;
    }
    function onLanguageChoice(event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest && event.target.closest('a[data-language-switch]');
      if (!link || link.hasAttribute('download') ||
        (link.target && link.target.toLowerCase() !== '_self')) return;
      // Capture the sign at rest; choosing a language does not replay its intro.
      skipSignIntro();
      cancelSignMotion();
    }
    function onLanguageEntry() {
      if (pageRoot.dataset.languageTransition !== 'incoming') return;
      skipSignIntro();
      cancelSignMotion();
    }
    function onSignPageHide() {
      pageLeaving = true;
      skipSignIntro();
      cancelSignMotion();
    }
    function onSignPageShow(event) {
      pageLeaving = false;
      if (event.persisted) skipSignIntro();
      onSignMotionChange();
    }
    function onSignVisibilityChange() {
      if (document.hidden) cancelSignMotion();
      else if (!introHandled && inView) swingSign();
    }

    if (motionPreference.addEventListener) motionPreference.addEventListener('change', onSignMotionChange);
    else if (motionPreference.addListener) motionPreference.addListener(onSignMotionChange);
    if (swingTrigger) swingTrigger.addEventListener('click', swingSign);
    document.addEventListener('click', onLanguageChoice);
    window.addEventListener('pagereveal', onLanguageEntry);
    window.addEventListener('pagehide', onSignPageHide);
    window.addEventListener('pageshow', onSignPageShow);
    document.addEventListener('visibilitychange', onSignVisibilityChange);
    onSignMotionChange();
    if (!introHandled) signObserver.observe(openingSign);
  }

  const reveals = all('[data-reveal]');
  if ('IntersectionObserver' in window && !motionPreference.matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
    reveals.forEach(element => { element.classList.add('will-reveal'); observer.observe(element); });
    const reduce = () => {
      if (motionPreference.matches) { observer.disconnect(); reveals.forEach(element => element.classList.add('is-visible')); }
    };
    if (motionPreference.addEventListener) motionPreference.addEventListener('change', reduce);
  } else {
    reveals.forEach(element => element.classList.add('is-visible'));
  }

  const mapButton = document.querySelector('[data-load-map]');
  const mapContainer = document.querySelector('[data-map-container]');
  const mapPreview = document.querySelector('[data-map-preview]');
  const mapInteractive = document.querySelector('[data-map-interactive]');
  const mapEmbed = document.querySelector('[data-map-embed]');
  const mapStatus = document.querySelector('[data-map-status]');
  const mapClose = document.querySelector('[data-unload-map]');
  if (mapButton && mapContainer && mapPreview && mapInteractive && mapEmbed && mapStatus && mapClose) {
    // The preview is a local image. No Google element or request exists before consent.
    // Consent lasts for this page view; reloading starts with the static map again.
    mapButton.addEventListener('click', () => {
      if (mapEmbed.firstChild) return;
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.google.com/maps?q=${encodeURIComponent(ADDRESS)}&z=15&hl=${pageLanguage}&output=embed`;
      iframe.title = copy.mapTitle;
      iframe.referrerPolicy = 'no-referrer';
      iframe.setAttribute('allowfullscreen', '');
      iframe.addEventListener('load', () => {
        if (iframe.isConnected) mapStatus.textContent = copy.mapLoaded;
      }, { once: true });
      mapStatus.textContent = copy.mapLoading;
      mapContainer.style.setProperty('--map-height', `${mapPreview.getBoundingClientRect().height}px`);
      mapEmbed.appendChild(iframe);
      mapPreview.hidden = true;
      mapInteractive.hidden = false;
      mapButton.setAttribute('aria-expanded', 'true');
      mapClose.focus({ preventScroll: true });
    });
    mapClose.addEventListener('click', () => {
      mapEmbed.replaceChildren();
      mapInteractive.hidden = true;
      mapContainer.style.removeProperty('--map-height');
      mapPreview.hidden = false;
      mapButton.setAttribute('aria-expanded', 'false');
      mapStatus.textContent = '';
      mapButton.focus({ preventScroll: true });
    });
  }

  const form = document.getElementById('reminder-form');
  if (!form) return;
  const nameInput = form.querySelector('#pet-name');
  const dateInput = form.querySelector('#vacc-date');
  const alarmInput = form.querySelector('#vacc-alarm');
  const message = form.querySelector('#reminder-message');
  const previewNote = document.querySelector('[data-reminder-note]');
  if (!nameInput || !dateInput || !alarmInput || !message) return;
  const readValues = () => ({ name: nameInput.value, date: dateInput.value, days: alarmInput.value });
  const setMessage = (text, isError) => {
    if (message.textContent !== text) message.textContent = text;
    message.dataset.state = isError ? 'error' : 'success';
  };
  const updateMinimum = () => { dateInput.min = warsawDateKey(new Date()); };
  const renderReminder = () => {
    const preview = reminderPreview(readValues(), undefined, pageLanguage);
    dateInput.removeAttribute('aria-invalid');
    alarmInput.removeAttribute('aria-invalid');
    write('[data-reminder-title]', preview.title);
    write('[data-reminder-date]', preview.date);
    write('[data-reminder-note]', preview.note);
    if (previewNote) previewNote.dataset.state = preview.error ? 'error' : 'ready';
    if (preview.error) {
      const field = preview.field === 'date' ? dateInput : alarmInput;
      field.setAttribute('aria-invalid', 'true');
    }
    setMessage(preview.error, Boolean(preview.error));
    updateMinimum();
  };
  updateMinimum();
  dateInput.addEventListener('focus', updateMinimum);
  [nameInput, dateInput, alarmInput].forEach(input => {
    input.addEventListener('input', renderReminder);
    input.addEventListener('change', renderReminder);
  });
  // Re-check dates restored by the browser or after returning to an open tab.
  window.addEventListener('pageshow', renderReminder);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderReminder(); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    renderReminder();
    const reminder = buildReminder(readValues(), undefined, pageLanguage);
    if (reminder.error) {
      const field = reminder.field === 'date' ? dateInput : alarmInput;
      field.setAttribute('aria-invalid', 'true');
      setMessage(reminder.error, true);
      field.focus();
      return;
    }
    const destination = event.submitter && event.submitter.value === 'ics' ? 'ics' : 'google';
    if (destination === 'google') {
      const link = document.createElement('a');
      link.href = googleUrl(reminder);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMessage(copy.googleSuccess, false);
    } else {
      const blobUrl = URL.createObjectURL(new Blob([calendarFile(reminder)], { type: 'text/calendar;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = calendarFilename(reminder);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      setMessage(copy.icsSuccess, false);
    }
  });
  renderReminder();
}());
