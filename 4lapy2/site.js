/* Cztery Łapy i Ty — browser-only interactions, no analytics or stored form data. */
(function () {
  'use strict';

  const TIME_ZONE = 'Europe/Warsaw';
  const CLINIC = 'Przychodnia Weterynaryjna Cztery Łapy i Ty';
  const ADDRESS = 'ul. Chabrowa 2D, 52-200 Wysoka';
  const PHONE = '71 786 78 84';
  const HOURS = [null, [600, 1080], [600, 1080], [600, 1080], [600, 1080], [600, 1080], [600, 720]];
  const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const DAY_NAMES = ['w niedzielę', 'w poniedziałek', 'we wtorek', 'w środę', 'w czwartek', 'w piątek', 'w sobotę'];
  const LEADS = { 1: 'dzień wcześniej', 7: 'tydzień wcześniej', 14: 'dwa tygodnie wcześniej' };
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  const fullDate = new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric'
  });
  const shortDate = new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'UTC', day: 'numeric', month: 'long'
  });
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

  function openingStatus(date) {
    const parts = warsawParts(date);
    const day = WEEKDAYS[parts.weekday];
    const minutes = Number(parts.hour) * 60 + Number(parts.minute);
    const schedule = HOURS[day];
    const format = value => `${Math.floor(value / 60)}:${pad(value % 60)}`;
    if (schedule && minutes >= schedule[0] && minutes < schedule[1]) {
      return { day, state: 'open', label: 'Otwarte teraz', detail: `Zapraszamy dziś do ${format(schedule[1])}` };
    }
    if (schedule && minutes < schedule[0]) {
      return { day, state: 'closed', label: 'Zamknięte', detail: `Otwieramy dziś o ${format(schedule[0])}` };
    }
    for (let ahead = 1; ahead <= 7; ahead += 1) {
      const next = (day + ahead) % 7;
      if (HOURS[next]) {
        return { day, state: 'closed', label: 'Zamknięte',
          detail: `Otwieramy ${ahead === 1 ? 'jutro' : DAY_NAMES[next]} o ${format(HOURS[next][0])}` };
      }
    }
    return { day, state: 'closed', label: 'Zamknięte', detail: 'Zadzwoń, aby umówić wizytę' };
  }

  function cleanName(value) {
    return Array.from(String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 30).join('');
  }

  function buildReminder(values, now) {
    const current = now || new Date();
    const vaccination = parseDate(values.date);
    if (!vaccination) return { error: 'Wybierz datę szczepienia z książeczki zdrowia.', field: 'date' };
    if (values.date < warsawDateKey(current)) {
      return { error: 'Ta data już minęła. Wpisz datę kolejnego szczepienia.', field: 'date' };
    }
    const days = Number(values.days);
    if (!Object.prototype.hasOwnProperty.call(LEADS, days)) {
      return { error: 'Wybierz termin przypomnienia z listy.', field: 'alarm' };
    }
    const reminderDay = addDays(vaccination, -days);
    const start = atWarsawNine(reminderDay);
    if (start.getTime() <= current.getTime()) {
      return { error: 'Wybrany termin przypomnienia już minął. Wybierz krótsze wyprzedzenie lub późniejszą datę szczepienia.', field: 'alarm' };
    }
    const name = cleanName(values.name);
    const title = name ? `Umów szczepienie — ${name}` : 'Umów szczepienie zwierzaka';
    const description = `Data szczepienia z książeczki zdrowia: ${fullDate.format(vaccination)}.\n` +
      `Zadzwoń, żeby umówić wizytę: ${PHONE}.\n${CLINIC}\n${ADDRESS}\nTermin wizyty ustal telefonicznie.`;
    return { vaccination, reminderDay, start, end: new Date(start.getTime() + 15 * 60000), name, title, description, days };
  }

  function googleUrl(reminder) {
    const params = new URLSearchParams({
      action: 'TEMPLATE', text: reminder.title,
      dates: `${utcStamp(reminder.start)}/${utcStamp(reminder.end)}`,
      ctz: TIME_ZONE, details: reminder.description, location: `${CLINIC}, ${ADDRESS}`
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
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cztery Lapy i Ty//Przypomnienie//PL',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      `UID:${id}@cztery-lapy-i-ty`, `DTSTAMP:${utcStamp(now || new Date())}`,
      `DTSTART:${utcStamp(reminder.start)}`, `DTEND:${utcStamp(reminder.end)}`,
      `SUMMARY:${icsEscape(reminder.title)}`, `DESCRIPTION:${icsEscape(reminder.description)}`,
      `LOCATION:${icsEscape(`${CLINIC}, ${ADDRESS}`)}`, 'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0S',
      `DESCRIPTION:${icsEscape(`${reminder.title}. Zadzwoń: ${PHONE}.`)}`,
      'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'
    ].map(foldLine).join('\r\n') + '\r\n';
  }

  // Pure functions are available to offline boundary checks, never exposed on window.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseDate, atWarsawNine, openingStatus, buildReminder, googleUrl, calendarFile };
  }
  if (typeof document === 'undefined') return;

  const all = selector => Array.from(document.querySelectorAll(selector));
  const write = (selector, value) => all(selector).forEach(element => {
    if (element.textContent !== value) element.textContent = value;
  });
  document.documentElement.classList.add('js');

  function updateOpening() {
    const status = openingStatus(new Date());
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
  if (menuToggle && menuPanel) {
    const isCompact = () => window.getComputedStyle(menuToggle).display !== 'none';
    const setMenu = expanded => {
      const compact = isCompact();
      menuToggle.setAttribute('aria-expanded', String(compact && expanded));
      menuToggle.setAttribute('aria-label', expanded ? 'Zamknij menu' : 'Otwórz menu');
      menuPanel.hidden = compact && !expanded;
      menuToggle.classList.toggle('is-active', compact && expanded);
      document.documentElement.classList.toggle('menu-open', compact && expanded);
    };
    setMenu(false);
    menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
    menuPanel.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        menuToggle.focus();
      }
    });
    document.addEventListener('click', event => {
      if (!menuPanel.contains(event.target) && !menuToggle.contains(event.target)) setMenu(false);
    });
    let compact = isCompact();
    window.addEventListener('resize', () => {
      if (isCompact() !== compact) { compact = isCompact(); setMenu(false); }
    }, { passive: true });
  }

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
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
  if (mapButton && mapContainer) {
    mapButton.addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.google.com/maps?q=${encodeURIComponent(ADDRESS)}&z=15&output=embed`;
      iframe.title = 'Dojazd do przychodni Cztery Łapy i Ty, Chabrowa 2D, Wysoka';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.setAttribute('allowfullscreen', '');
      iframe.style.cssText = 'display:block;width:100%;height:100%;min-height:360px;border:0;';
      mapContainer.replaceChildren(iframe);
      iframe.focus();
    }, { once: true });
  }

  const form = document.getElementById('reminder-form');
  if (!form) return;
  const nameInput = form.querySelector('#pet-name');
  const dateInput = form.querySelector('#vacc-date');
  const alarmInput = form.querySelector('#vacc-alarm');
  const message = form.querySelector('#reminder-message');
  if (!nameInput || !dateInput || !alarmInput || !message) return;
  const readValues = () => ({ name: nameInput.value, date: dateInput.value, days: alarmInput.value });
  const setMessage = (text, isError) => {
    message.textContent = text;
    message.dataset.state = isError ? 'error' : 'success';
  };
  const updateMinimum = () => { dateInput.min = warsawDateKey(new Date()); };
  const clearErrors = () => {
    dateInput.removeAttribute('aria-invalid');
    alarmInput.removeAttribute('aria-invalid');
    setMessage('', false);
  };
  const renderReminder = () => {
    const name = cleanName(nameInput.value);
    const date = parseDate(dateInput.value);
    const days = Number(alarmInput.value);
    write('[data-reminder-title]', name ? `Umów szczepienie — ${name}` : 'Umów szczepienie zwierzaka');
    write('[data-reminder-date]', date ? fullDate.format(date) : 'Wybierz datę szczepienia');
    write('[data-reminder-note]', date && LEADS[days]
      ? `Przypomnienie: ${shortDate.format(addDays(date, -days))}, o 9:00`
      : `Przypomnienie: ${LEADS[days] || LEADS[7]}, o 9:00`);
    updateMinimum();
  };
  updateMinimum();
  dateInput.addEventListener('focus', updateMinimum);
  [nameInput, dateInput, alarmInput].forEach(input => {
    input.addEventListener('input', () => { clearErrors(); renderReminder(); });
    input.addEventListener('change', () => { clearErrors(); renderReminder(); });
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    clearErrors();
    updateMinimum();
    const reminder = buildReminder(readValues());
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
      setMessage('W Kalendarzu Google zapisz przygotowane wydarzenie. Termin wizyty ustal telefonicznie.', false);
    } else {
      const blobUrl = URL.createObjectURL(new Blob([calendarFile(reminder)], { type: 'text/calendar;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      const safeName = reminder.name.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      link.download = `przypomnienie-szczepienie${safeName ? `-${safeName}` : ''}.ics`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      setMessage('Otwórz pobrany plik i zatwierdź wydarzenie w swoim kalendarzu. Termin wizyty ustal telefonicznie.', false);
    }
  });
  renderReminder();
}());
