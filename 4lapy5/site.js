/* Cztery Łapy i Ty (4lapy5, "książeczka zdrowia"): live opening status, the status stamp
 * and a local vaccination reminder. No analytics and no stored form data.
 * The same functions run in the page and in tests. */
(function () {
  'use strict';

  const TIME_ZONE = 'Europe/Warsaw';
  const PHONE = '71 786 78 84';
  // Opening minutes from midnight by day of week (0 = Sunday); null = closed.
  // tools/build.cjs renders the week strip, the hours list and JSON-LD from this table.
  const HOURS = [null, [600, 1080], [600, 1080], [600, 1080], [600, 1080], [600, 1080], [600, 720]];
  const AXIS = [480, 1200]; // The week strip covers 08:00–20:00.
  const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const LEAD_DAYS = [1, 7, 14];
  // Polish public holidays with fixed dates. Easter-based days are computed per year.
  const FIXED_HOLIDAYS = ['01-01', '01-06', '05-01', '05-03', '08-15', '11-01', '11-11', '12-25', '12-26'];
  const THEME_COLORS = { light: '#efe8d6', dark: '#0d1020' };

  const MESSAGES = {
    pl: {
      locale: 'pl-PL', clinic: 'Przychodnia Weterynaryjna Cztery Łapy i Ty', address: 'ul. Chabrowa 2D, 52-200 Wysoka',
      dayNames: ['w\u00a0niedzielę', 'w\u00a0poniedziałek', 'we\u00a0wtorek', 'w\u00a0środę', 'w\u00a0czwartek', 'w\u00a0piątek', 'w\u00a0sobotę'],
      leads: { 1: 'dzień wcześniej', 7: 'tydzień wcześniej', 14: 'dwa tygodnie wcześniej' },
      openLabel: 'Otwarte teraz', closedLabel: 'Teraz zamknięte', holidayLabel: 'Dzień świąteczny',
      // One word for the rubber stamp; it never carries a person's name.
      stamps: { open: 'Otwarte', closed: 'Zamknięte', holiday: 'Święto' }, todayPrefix: 'Dziś',
      openUntil: time => `Dziś przyjmujemy do\u00a0${time}.`,
      opensToday: time => `Dziś przyjmujemy od\u00a0${time}.`,
      opensTomorrow: time => `Jutro przyjmujemy od\u00a0${time}.`,
      opensOn: (day, time) => `Wracamy ${day} o\u00a0${time}.`,
      holidayHeadline: 'Dziś święto. Zadzwoń przed wizytą.',
      callToBook: 'Zadzwoń, aby umówić wizytę.',
      previewTime: label => `Podgląd statusu dla: ${label}`,
      themeToDark: 'Włącz ciemny motyw', themeToLight: 'Włącz jasny motyw',
      dateRequired: 'Wybierz datę szczepienia z książeczki zdrowia.',
      dateInvalid: 'Takiej daty nie ma w kalendarzu. Sprawdź dzień i miesiąc.',
      calendarToday: 'dziś', calendarHoliday: 'święto',
      mapLoading: 'Wczytuję mapę Google…', mapFrame: 'Mapa Google: ul. Chabrowa 2D, Wysoka',
      mapOn: 'Mapa Google jest włączona. Odznacz, żeby wrócić do mapy poglądowej.',
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
      exportError: 'Nie udało się przygotować przypomnienia. Spróbuj ponownie.',
      filenamePrefix: 'przypomnienie-szczepienie', calendarProduct: 'Przypomnienie//PL'
    },
    en: {
      locale: 'en-GB', clinic: 'Cztery Łapy i Ty Veterinary Clinic', address: 'Chabrowa 2D, 52-200 Wysoka',
      dayNames: ['on\u00a0Sunday', 'on\u00a0Monday', 'on\u00a0Tuesday', 'on\u00a0Wednesday', 'on\u00a0Thursday', 'on\u00a0Friday', 'on\u00a0Saturday'],
      leads: { 1: 'one day before', 7: 'one week before', 14: 'two weeks before' },
      openLabel: 'Open now', closedLabel: 'Closed now', holidayLabel: 'Public holiday',
      stamps: { open: 'Open', closed: 'Closed', holiday: 'Holiday' }, todayPrefix: 'Today',
      openUntil: time => `Open today until\u00a0${time}.`,
      opensToday: time => `Open today from\u00a0${time}.`,
      opensTomorrow: time => `Open tomorrow from\u00a0${time}.`,
      opensOn: (day, time) => `Back ${day} at\u00a0${time}.`,
      holidayHeadline: 'Public holiday today. Call before you visit.',
      callToBook: 'Call to book an appointment.',
      previewTime: label => `Status preview for: ${label}`,
      themeToDark: 'Switch to dark theme', themeToLight: 'Switch to light theme',
      dateRequired: 'Choose the vaccination date from your pet’s health record.',
      dateInvalid: 'There is no such date. Check the day and the month.',
      calendarToday: 'today', calendarHoliday: 'public holiday',
      mapLoading: 'Loading the Google map…', mapFrame: 'Google map: ul. Chabrowa 2D, Wysoka',
      mapOn: 'The Google map is on. Untick the box to return to the static map.',
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
      exportError: 'The reminder could not be prepared. Please try again.',
      filenamePrefix: 'vaccination-reminder', calendarProduct: 'Vaccination reminder//EN'
    }
  };

  const normalizeLanguage = language => /^en(?:-|$)/i.test(String(language || '')) ? 'en' : 'pl';
  const warsawClock = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  const dateFormats = Object.fromEntries(Object.entries(MESSAGES).map(([language, copy]) => [language, {
    full: new Intl.DateTimeFormat(copy.locale, { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }),
    short: new Intl.DateTimeFormat(copy.locale, { timeZone: 'UTC', day: 'numeric', month: 'long' })
  }]));
  const pad = value => String(value).padStart(2, '0');
  const hhmm = minutes => `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
  const dateKey = date => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  const utcStamp = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const addDays = (date, days) => new Date(date.getTime() + days * 86400000);
  const warsawParts = date => Object.fromEntries(warsawClock.formatToParts(date).map(part => [part.type, part.value]));

  function warsawDateKey(date) {
    const parts = warsawParts(date);
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  // Calendar days are represented at UTC midnight; wall-clock times are resolved in Warsaw.
  function parseDate(value) {
    const match = /^([1-9]\d{3})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!match) return null;
    const result = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return dateKey(result) === value ? result : null;
  }

  // Resolving the IANA zone per date handles both winter and summer time.
  function atWarsaw(day, hour, minute) {
    const target = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute || 0);
    let instant = target;
    for (let i = 0; i < 3; i += 1) {
      const parts = warsawParts(new Date(instant));
      const shown = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
        Number(parts.hour), Number(parts.minute), Number(parts.second));
      instant += target - shown;
    }
    return new Date(instant);
  }
  const atWarsawNine = day => atWarsaw(day, 9, 0);

  // Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
  function easterSunday(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const sum = h + l - 7 * m + 114;
    return new Date(Date.UTC(year, Math.floor(sum / 31) - 1, (sum % 31) + 1));
  }

  const holidayYears = new Map();
  function isHoliday(key) {
    const year = Number(key.slice(0, 4));
    if (!holidayYears.has(year)) {
      const days = new Set(FIXED_HOLIDAYS.map(day => `${year}-${day}`));
      if (year >= 2025) days.add(`${year}-12-24`); // Christmas Eve is a public holiday since 2025.
      // Easter Sunday, Easter Monday, Pentecost and Corpus Christi.
      [0, 1, 49, 60].forEach(offset => days.add(dateKey(addDays(easterSunday(year), offset))));
      holidayYears.set(year, days);
    }
    return holidayYears.get(year).has(key);
  }

  // The hero sentence. Holiday hours are unknown, so a holiday never claims "open":
  // it asks the visitor to call, and the next opening skips holidays.
  function clinicStatus(date, language = 'pl') {
    const copy = MESSAGES[normalizeLanguage(language)];
    const parts = warsawParts(date);
    const today = parseDate(`${parts.year}-${parts.month}-${parts.day}`);
    const day = WEEKDAYS[parts.weekday];
    const minutes = Number(parts.hour) * 60 + Number(parts.minute);
    const holiday = isHoliday(dateKey(today));
    const schedule = HOURS[day];
    const result = (state, label, headline) => ({
      state, label, headline, day, minutes, holiday, stamp: copy.stamps[state],
      // A long unbreakable chunk ("w poniedziałek") needs the smaller display size.
      compact: state === 'holiday' || headline.split(' ').some(chunk => chunk.length > 12)
    });
    if (schedule && minutes < schedule[1]) {
      if (holiday) return result('holiday', copy.holidayLabel, copy.holidayHeadline);
      if (minutes >= schedule[0]) return result('open', copy.openLabel, copy.openUntil(hhmm(schedule[1])));
      return result('closed', copy.closedLabel, copy.opensToday(hhmm(schedule[0])));
    }
    for (let ahead = 1; ahead <= 10; ahead += 1) {
      const next = addDays(today, ahead);
      const hours = HOURS[next.getUTCDay()];
      if (!hours || isHoliday(dateKey(next))) continue;
      const time = hhmm(hours[0]);
      return result('closed', copy.closedLabel,
        ahead === 1 ? copy.opensTomorrow(time) : copy.opensOn(copy.dayNames[next.getUTCDay()], time));
    }
    return result('closed', copy.closedLabel, copy.callToBook);
  }

  // The dated heading of today's entry, e.g. "Dziś · poniedziałek, 23.11" (Warsaw calendar).
  function todayLabel(date, language = 'pl') {
    const copy = MESSAGES[normalizeLanguage(language)];
    const day = new Intl.DateTimeFormat(copy.locale, { timeZone: TIME_ZONE, weekday: 'long', day: '2-digit', month: '2-digit' }).format(date);
    return `${copy.todayPrefix} · ${day}`;
  }

  // ?czas=2026-11-23T11:30 previews the status for a Warsaw wall-clock time (demo and QA).
  function previewInstant(search) {
    let value = '';
    try { value = new URLSearchParams(String(search || '')).get('czas') || ''; } catch (_) { return null; }
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
    const day = match && parseDate(match[1]);
    if (!day || Number(match[2]) > 23 || Number(match[3]) > 59) return null;
    return atWarsaw(day, Number(match[2]), Number(match[3]));
  }

  // The date field is plain text shaped as DD.MM.YYYY, the way the booklet prints dates.
  // "15032027", "15.03.2027" and "1.3.2027" all end up as the same text.
  function maskDate(raw) {
    const text = String(raw || '');
    const iso = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(text);
    if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`; // a pasted ISO date
    const groups = text.split(/[^0-9]+/);
    let digits = '';
    groups.forEach((group, index) => {
      const closed = index < groups.length - 1; // a separator was typed after this group
      // "1." means the first: a closed single digit of a day or month gets its zero.
      digits += closed && group.length === 1 && (digits.length === 0 || digits.length === 2) ? `0${group}` : group;
    });
    digits = digits.slice(0, 8);
    const masked = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('.');
    // Keep a dot the visitor has just typed after a complete day or month.
    return /[^0-9]$/.test(text) && (digits.length === 2 || digits.length === 4) ? `${masked}.` : masked;
  }

  // The typed text as an ISO day. complete: day, month and year are all there;
  // iso stays empty when no such day exists.
  function typedDate(text) {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(maskDate(text));
    if (!match) return { iso: '', complete: false };
    const iso = `${match[3]}-${match[2]}-${match[1]}`;
    return { iso: parseDate(iso) ? iso : '', complete: true };
  }

  // The digits typed so far, at most eight: what the boxes of the entry show, one per box.
  function dateDigits(text) {
    return maskDate(text).replace(/\D/g, '');
  }

  // What typing in the boxes makes of the date. The boxes hold digits only, so one more
  // character at the end is read where the field has it: "01.3" and "." make "01.03.",
  // as they would when typed in the field. Anything else (a digit taken away) is plain digits.
  function typedInBoxes(fieldText, boxText) {
    const digits = dateDigits(fieldText);
    const added = boxText.length === digits.length + 1 && boxText.startsWith(digits);
    return maskDate(added ? fieldText + boxText.slice(-1) : boxText);
  }

  // One month as weeks that start on Monday. Days outside the month are null.
  function monthGrid(year, month) {
    const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
    const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const cells = Array.from({ length: lead }, () => null);
    for (let day = 1; day <= length; day += 1) cells.push(`${year}-${pad(month)}-${pad(day)}`);
    while (cells.length % 7) cells.push(null);
    return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
  }

  // The pointers that bring an on-screen keyboard with them. An unknown pointer counts as a mouse.
  const isFinger = pointerType => pointerType === 'touch' || pointerType === 'pen';

  // What a press on the date field does to the calendar sheet.
  //   open:  a mouse click brings the sheet up; the field keeps the focus, so typing goes on.
  //   keep:  the sheet is already up; the click only places the caret.
  //   pick:  a finger gets the sheet without the on-screen keyboard.
  //   type:  a second tap swaps the sheet for the keyboard.
  //   caret: the field is being typed in with the keyboard up; taps stay with the text.
  function fieldPress(pointerType, sheetOpen, fieldFocused) {
    const finger = isFinger(pointerType);
    if (sheetOpen) return finger ? 'type' : 'keep';
    if (!finger) return 'open';
    return fieldFocused ? 'caret' : 'pick';
  }

  function cleanName(value) {
    return Array.from(String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 30).join('');
  }

  function buildReminder(values, now, language = 'pl') {
    language = normalizeLanguage(language);
    const copy = MESSAGES[language];
    const current = now || new Date();
    // A fully typed date that does not exist (31.02) gets its own message.
    if (values.invalidDate) return { error: copy.dateInvalid, field: 'date' };
    const vaccination = parseDate(values.date);
    if (!vaccination) return { error: copy.dateRequired, field: 'date' };
    if (values.date < warsawDateKey(current)) return { error: copy.datePast, field: 'date' };
    const days = Number(values.days);
    if (!LEAD_DAYS.includes(days)) return { error: copy.leadRequired, field: 'alarm' };
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

  // The preview and the exports share one validation: a past reminder never looks ready.
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
    // An untouched or half-typed date stays neutral; submit still requires it.
    if (!values.date && !values.invalidDate) return preview;
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

  // RFC 5545 folds lines at 75 octets, not characters.
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

  // The address of the Google map frame: the one written in the page, in the page's language.
  function mapEmbedSrc(base, language) {
    return `${base}&hl=${language === 'en' ? 'en' : 'pl'}`;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HOURS, AXIS, parseDate, atWarsaw, atWarsawNine, easterSunday, isHoliday, clinicStatus,
      todayLabel, previewInstant, maskDate, typedDate, dateDigits, typedInBoxes, monthGrid, fieldPress, buildReminder,
      reminderPreview,
      googleUrl, calendarFile, calendarFilename, mapEmbedSrc };
  }
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.classList.add('js'); // Lets the stylesheet show controls that need this script.
  const language = normalizeLanguage(root.lang);
  const copy = MESSAGES[language];
  const preview = previewInstant(window.location.search);
  const now = () => preview || new Date();
  const each = (selector, action) => document.querySelectorAll(selector).forEach(action);
  // Unchanged text is not rewritten, so live regions announce real changes only.
  const setText = (selector, value) => each(selector, element => {
    if (element.textContent !== value) element.textContent = value;
  });

  // Colours follow the system through CSS light-dark(). Only a manual choice is stored.
  const THEME_KEY = '4lapy5-theme';
  const themeSupported = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' &&
    CSS.supports('color', 'light-dark(#000, #fff)');
  const systemDark = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const activeTheme = () => root.dataset.theme || (systemDark && systemDark.matches ? 'dark' : 'light');

  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
    else delete root.dataset.theme;
    each('meta[name="theme-color"]', meta => {
      meta.setAttribute('content', THEME_COLORS[root.dataset.theme || (/dark/.test(meta.media) ? 'dark' : 'light')]);
    });
  }

  // This script is loaded in <head>, so a stored choice applies before the first paint.
  if (themeSupported) {
    try { applyTheme(window.localStorage.getItem(THEME_KEY)); } catch (_) { /* The system theme still applies. */ }
  }

  function initTheme() {
    const button = document.querySelector('[data-theme-toggle]');
    if (!button || !themeSupported) return;
    const describe = () => {
      const text = activeTheme() === 'dark' ? copy.themeToLight : copy.themeToDark;
      button.setAttribute('aria-label', text);
      button.title = text;
      button.dataset.shows = activeTheme();
    };
    button.addEventListener('click', () => {
      const next = activeTheme() === 'dark' ? 'light' : 'dark';
      try { window.localStorage.setItem(THEME_KEY, next); } catch (_) { /* The choice lasts for this visit. */ }
      applyTheme(next);
      describe();
    });
    if (systemDark && systemDark.addEventListener) systemDark.addEventListener('change', describe);
    window.addEventListener('storage', event => {
      if (event.key === THEME_KEY) { applyTheme(event.newValue); describe(); }
    });
    describe();
    button.hidden = false;
  }

  // The sentence is rebuilt only when it changes; the time gets its own element so the
  // stylesheet can underline it like a pen stroke.
  function writeHeadline(element, sentence) {
    if (element.dataset.sentence === sentence) return;
    element.dataset.sentence = sentence;
    element.replaceChildren(...sentence.split(/(\d{1,2}:\d{2})/).filter(Boolean).map(part => {
      if (!/^\d{1,2}:\d{2}$/.test(part)) return document.createTextNode(part);
      const time = document.createElement('span');
      time.className = 'time';
      time.textContent = part;
      return time;
    }));
  }

  function paintStatus() {
    const status = clinicStatus(now(), language);
    each('[data-status]', element => { element.dataset.state = status.state; });
    setText('[data-status-label]', status.label);
    setText('[data-status-stamp]', status.stamp);
    setText('[data-status-date]', todayLabel(now(), language));
    each('[data-status-headline]', element => {
      writeHeadline(element, status.headline);
      element.toggleAttribute('data-compact', status.compact);
    });
    const position = (status.minutes - AXIS[0]) / (AXIS[1] - AXIS[0]);
    each('[data-week-day]', element => {
      const today = Number(element.dataset.weekDay) === status.day;
      element.toggleAttribute('data-today', today);
      element.toggleAttribute('data-holiday', today && status.holiday);
      element.toggleAttribute('data-now', today && position >= 0 && position <= 1);
      if (today) element.style.setProperty('--now', `${(position * 100).toFixed(2)}%`);
    });
    each('[data-hours-days]', row => {
      row.toggleAttribute('data-today', row.dataset.hoursDays.split(' ').includes(String(status.day)));
    });
    if (preview) {
      const label = new Intl.DateTimeFormat(copy.locale, { timeZone: TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' }).format(preview);
      setText('[data-preview-note]', copy.previewTime(label));
      each('[data-preview-note]', element => { element.hidden = false; });
    }
  }

  // The booklet's own calendar sheet replaces the browser's date popup, which cannot be
  // styled. The field stays an ordinary text input, so the date can always be typed.
  // The sheet comes up from its button and from a press on the field itself (see fieldPress).
  // While the field has the focus the sheet follows what is typed, and Down steps into it.
  // Keys follow the usual date-grid pattern: arrows move by day and week, Home and End go to
  // the ends of the week, PageUp and PageDown change the month (with Shift, the year).
  function initCalendar(dateInput) {
    const panel = document.querySelector('[data-calendar]');
    const opener = document.querySelector('[data-calendar-open]');
    if (!panel || !opener) return;
    const wrap = panel.parentElement; // the field, its button and the sheet
    const sheet = panel.closest('.tile');
    const title = panel.querySelector('[data-calendar-title]');
    const body = panel.querySelector('[data-calendar-days]');
    const monthName = new Intl.DateTimeFormat(copy.locale, { timeZone: 'UTC', month: 'long', year: 'numeric' });
    const dayName = new Intl.DateTimeFormat(copy.locale, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const today = () => warsawDateKey(new Date());
    let cursor = today(); // the day that holds keyboard focus; never in the past
    let origin = opener;  // the control that gets the focus back when the sheet is put away
    let press = '';       // what the press that has just begun on the field will do
    let finger = false;   // the visitor's last move was made with a finger, not a mouse or a key

    function draw(focus) {
      const day = parseDate(cursor);
      const now = today();
      const selected = typedDate(dateInput.value).iso;
      const month = monthName.format(day);
      // Redrawn on every keystroke in the field: the month is announced only when it changes.
      if (title.textContent !== month) title.textContent = month;
      body.replaceChildren(...monthGrid(day.getUTCFullYear(), day.getUTCMonth() + 1).map(week => {
        const row = document.createElement('tr');
        week.forEach((key, column) => {
          const cell = row.appendChild(document.createElement('td'));
          if (!key) return;
          const button = cell.appendChild(document.createElement('button'));
          const notes = [dayName.format(parseDate(key))];
          button.type = 'button';
          button.textContent = String(Number(key.slice(8)));
          button.dataset.day = key;
          button.tabIndex = key === cursor ? 0 : -1;
          if (key === now) { button.dataset.today = ''; notes.push(copy.calendarToday); }
          // Sundays and public holidays are printed in red, as on a Polish wall calendar.
          if (column === 6 || isHoliday(key)) button.dataset.red = '';
          if (isHoliday(key)) notes.push(copy.calendarHoliday);
          if (key === selected) { button.dataset.selected = ''; button.setAttribute('aria-pressed', 'true'); }
          if (key < now) button.setAttribute('aria-disabled', 'true');
          button.setAttribute('aria-label', notes.join(', '));
        });
        return row;
      }));
      if (focus) focusDay();
    }

    // Left to itself the browser centres a focused day that was out of view, which pushes
    // the field off a small screen. The shortest scroll that shows the day is enough.
    function focusDay() {
      const target = body.querySelector(`[data-day="${cursor}"]`);
      if (!target) return;
      target.focus({ preventScroll: true });
      if (target.scrollIntoView) target.scrollIntoView({ block: 'nearest' });
    }

    function show(key, focus) {
      cursor = key < today() ? today() : key;
      draw(focus);
    }

    // Moving by months keeps the day where the new month has it (the 31st becomes the 30th).
    function step(months, focus) {
      const day = parseDate(cursor);
      const target = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + months, 1));
      const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
      target.setUTCDate(Math.min(day.getUTCDate(), last));
      show(dateKey(target), focus);
    }

    function close(returnFocus) {
      if (panel.hidden) return;
      // The focus goes back only if the sheet holds it (or nothing does): a field that is
      // being typed in keeps it.
      const active = document.activeElement;
      const held = !active || active === document.body || panel.contains(active);
      panel.hidden = true;
      opener.setAttribute('aria-expanded', 'false');
      if (sheet) sheet.removeAttribute('data-calendar-open');
      if (returnFocus && held) origin.focus();
    }

    // from: the control that gets the focus back. intoDays: move the focus to the days.
    function open(from, intoDays) {
      origin = from;
      // A finger needs no focus ring on the day; the first key pressed brings the ring back.
      panel.toggleAttribute('data-quiet', finger);
      panel.hidden = false;
      opener.setAttribute('aria-expanded', 'true');
      // The sheet rises above its neighbours while the calendar hangs over its edge.
      if (sheet) sheet.setAttribute('data-calendar-open', '');
      show(typedDate(dateInput.value).iso || today(), false);
      // The whole sheet first, then the day: on a screen too short for the sheet the day wins.
      if (panel.scrollIntoView) panel.scrollIntoView({ block: 'nearest' });
      if (intoDays) focusDay();
    }

    opener.addEventListener('click', () => {
      if (panel.hidden) { open(opener, true); return; }
      close(false);
      opener.focus();
    });
    dateInput.addEventListener('pointerdown', event => {
      press = fieldPress(event.pointerType, !panel.hidden, document.activeElement === dateInput);
      if (press === 'type') close(false);
    });
    // A finger asking for the sheet must not bring the keyboard up as well: the field is not
    // focused, and the focus goes to the days, as it does from the button.
    dateInput.addEventListener('mousedown', event => { if (press === 'pick') event.preventDefault(); });
    dateInput.addEventListener('click', () => {
      const action = press;
      press = '';
      if (action === 'pick') open(opener, true);
      else if (action === 'open' && panel.hidden) open(dateInput, false);
    });
    dateInput.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (event.key === 'ArrowDown' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        if (panel.hidden) open(dateInput, true);
        else { origin = dateInput; draw(true); }
      } else if (event.key === 'Escape' || event.key === 'Tab') {
        close(false); // Tab moves on without a walk through the sheet
      } else if (event.key === 'Enter' && !panel.hidden) {
        // The first Enter accepts the typed date and puts the sheet away; it does not send the form.
        event.preventDefault();
        close(false);
      }
    });
    dateInput.addEventListener('input', () => {
      if (!panel.hidden) show(typedDate(dateInput.value).iso || cursor, false);
    });
    panel.querySelectorAll('[data-calendar-step]').forEach(button => {
      button.addEventListener('click', () => step(Number(button.dataset.calendarStep), false));
    });
    // Pressing the sheet with a mouse leaves the focus in a field that is being typed in.
    panel.addEventListener('mousedown', event => {
      if (document.activeElement === dateInput) event.preventDefault();
    });
    body.addEventListener('click', event => {
      const button = event.target.closest ? event.target.closest('[data-day]') : null;
      if (!button || button.getAttribute('aria-disabled') === 'true') return;
      dateInput.value = maskDate(button.dataset.day);
      close(true);
      dateInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    body.addEventListener('keydown', event => {
      const day = parseDate(cursor);
      const weekday = (day.getUTCDay() + 6) % 7;
      const days = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday }[event.key];
      if (days !== undefined) show(dateKey(addDays(day, days)), true);
      else if (event.key === 'PageUp' || event.key === 'PageDown') step((event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1), true);
      else return;
      event.preventDefault();
    });
    panel.addEventListener('keydown', event => { if (event.key === 'Escape') close(true); });
    // A press or a focus move outside the field and its calendar puts the sheet away.
    document.addEventListener('pointerdown', event => {
      finger = isFinger(event.pointerType);
      // Only a press on the field itself may open the sheet, not a click passed on by its label.
      if (event.target !== dateInput) press = '';
      if (!wrap.contains(event.target)) close(false);
    });
    document.addEventListener('keydown', () => {
      finger = false;
      panel.removeAttribute('data-quiet');
    }, true);
    wrap.addEventListener('focusout', event => {
      const next = event.relatedTarget;
      if (next && !wrap.contains(next)) close(false);
    });
  }

  function initReminder() {
    const form = document.getElementById('reminder-form');
    if (!form) return;
    const nameInput = form.querySelector('#pet-name');
    const dateInput = form.querySelector('#vacc-date');
    const alarmInput = form.querySelector('#vacc-alarm');
    const message = form.querySelector('#reminder-message');
    if (!nameInput || !dateInput || !alarmInput || !message) return;
    // The unseen field over the boxes of the entry. It lies next to the boxes, outside the form.
    const boxInput = document.querySelector('[data-comb-input]');
    const values = () => {
      const typed = typedDate(dateInput.value);
      return { name: nameInput.value, date: typed.iso, invalidDate: typed.complete && !typed.iso, days: alarmInput.value };
    };
    const say = (text, isError) => {
      if (message.textContent !== text) message.textContent = text;
      message.dataset.state = isError ? 'error' : 'ok';
    };
    const mark = field => [[dateInput, 'date'], [boxInput, 'date'], [alarmInput, 'alarm']].forEach(([input, name]) => {
      if (!input) return;
      if (field === name) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    });
    const render = () => {
      const view = reminderPreview(values(), undefined, language);
      setText('[data-reminder-title]', view.title);
      setText('[data-reminder-date]', view.date);
      // The same date in the entry, one digit per box as on a paper form, while it is typed.
      const digits = dateDigits(dateInput.value);
      each('[data-comb]', comb => {
        comb.toggleAttribute('data-error', view.field === 'date');
        comb.querySelectorAll('b').forEach((box, index) => {
          const value = digits[index] || box.dataset.placeholder;
          if (box.textContent !== value) box.textContent = value;
          box.toggleAttribute('data-filled', index < digits.length);
          // The box that takes the next digit; with all eight written, the last one.
          box.toggleAttribute('data-caret', index === Math.min(digits.length, 7));
        });
      });
      if (boxInput && boxInput.value !== digits) boxInput.value = digits;
      setText('[data-reminder-note]', view.note);
      each('[data-reminder-note]', element => { element.dataset.state = view.error ? 'error' : 'ready'; });
      mark(view.field);
      say(view.error, Boolean(view.error));
    };
    // Typing is shaped into DD.MM.YYYY as it happens. Text that a keyboard is still composing
    // is left alone and shaped when the composition ends: Chromium sends no input event then.
    const shape = () => {
      const masked = maskDate(dateInput.value);
      if (dateInput.value !== masked) dateInput.value = masked;
    };
    dateInput.addEventListener('input', event => { if (!event.isComposing) shape(); });
    dateInput.addEventListener('compositionend', shape);
    if (boxInput) {
      // The boxes of the entry are written in through the unseen field laid over them. It
      // hands every key to the date field, which stays the one holder of the date, and gets
      // the digits back from render(). Boxes can only show a caret at the end of what is
      // written, so the caret is kept there.
      const write = date => {
        dateInput.value = date;
        dateInput.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const toEnd = () => {
        const end = boxInput.value.length;
        if (boxInput.selectionStart !== end || boxInput.selectionEnd !== end) boxInput.setSelectionRange(end, end);
      };
      // Nothing to do when the boxes already show what the unseen field holds.
      const take = () => {
        if (boxInput.value !== dateDigits(dateInput.value)) write(typedInBoxes(dateInput.value, boxInput.value));
      };
      // Digits are taken as they come, also from a keyboard that composes them. Other composed
      // text waits for the end of its composition, when the unseen field may be rewritten.
      boxInput.addEventListener('input', event => {
        if (!event.isComposing || /^\d*$/.test(boxInput.value)) take();
      });
      boxInput.addEventListener('compositionend', take);
      // A pasted date replaces what is there, in any notation the field accepts.
      boxInput.addEventListener('paste', event => {
        const text = event.clipboardData ? event.clipboardData.getData('text') : '';
        if (!text) return;
        event.preventDefault();
        write(maskDate(text));
      });
      ['focus', 'click', 'keyup', 'select'].forEach(type => boxInput.addEventListener(type, toEnd));
      document.addEventListener('selectionchange', () => { if (document.activeElement === boxInput) toEnd(); });
      // Enter ends the writing and puts a phone's keyboard away; it does not send the form.
      boxInput.addEventListener('keydown', event => { if (event.key === 'Enter') boxInput.blur(); });
    }
    [nameInput, dateInput, alarmInput].forEach(input => {
      input.addEventListener('input', render);
      input.addEventListener('change', render);
    });
    // Re-check a date restored by the browser or left in an open tab overnight.
    window.addEventListener('pageshow', render);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

    form.addEventListener('submit', event => {
      event.preventDefault();
      render();
      const reminder = buildReminder(values(), undefined, language);
      if (reminder.error) {
        mark(reminder.field);
        say(reminder.error, true);
        (reminder.field === 'date' ? dateInput : alarmInput).focus();
        return;
      }
      const wantsFile = Boolean(event.submitter && event.submitter.value === 'ics');
      const link = document.createElement('a');
      let blobUrl = '';
      link.hidden = true;
      try {
        if (wantsFile) {
          blobUrl = URL.createObjectURL(new Blob([calendarFile(reminder)], { type: 'text/calendar;charset=utf-8' }));
          link.href = blobUrl;
          link.download = calendarFilename(reminder);
        } else {
          // Stays inside the submit gesture, so the new tab is not blocked.
          link.href = googleUrl(reminder);
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
        document.body.appendChild(link);
        link.click();
        // Neither path is a confirmed save: the calendar app still asks the user.
        say(wantsFile ? copy.icsSuccess : copy.googleSuccess, false);
      } catch (_) {
        say(copy.exportError, true);
      } finally {
        link.remove();
        if (blobUrl) window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      }
    });
    initCalendar(dateInput);
    render();
  }

  // The week strip shows a day's hours on hover (CSS). Touch has no hover, so a tap pins
  // the label and a second tap, or a tap elsewhere, removes it. Escape hides hover labels.
  function initWeekTips() {
    const strip = document.querySelector('.week');
    if (!strip) return;
    const days = Array.from(strip.querySelectorAll('[data-week-day]'));
    const unpin = () => days.forEach(day => day.removeAttribute('data-open'));
    document.addEventListener('pointerdown', event => {
      const day = event.target.closest ? event.target.closest('[data-week-day]') : null;
      const wasPinned = Boolean(day && day.hasAttribute('data-open'));
      unpin();
      if (day && !wasPinned && event.pointerType !== 'mouse') day.setAttribute('data-open', '');
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      unpin();
      strip.setAttribute('data-tips-off', '');
    });
    strip.addEventListener('pointerleave', () => strip.removeAttribute('data-tips-off'));
  }

  // The map tile shows a local picture. Ticking the box is the consent: only then does a Google
  // frame exist, and unticking removes it. Nothing is stored, so a reload starts with the
  // picture again.
  function initMap() {
    const consent = document.querySelector('[data-map-consent]');
    const figure = document.querySelector('[data-map-figure]');
    const holder = document.querySelector('[data-map-embed]');
    const note = document.querySelector('[data-map-note]');
    if (!consent || !figure || !holder || !note) return;
    const idleNote = note.textContent;
    consent.checked = false; // a tick restored by the browser must not load anything

    consent.addEventListener('change', () => {
      holder.replaceChildren();
      holder.hidden = !consent.checked;
      figure.toggleAttribute('data-google', consent.checked);
      if (!consent.checked) { note.textContent = idleNote; return; }
      const frame = document.createElement('iframe');
      frame.src = mapEmbedSrc(consent.dataset.mapSrc, language);
      frame.title = copy.mapFrame;
      frame.referrerPolicy = 'no-referrer';
      frame.setAttribute('allowfullscreen', '');
      frame.addEventListener('load', () => { if (frame.isConnected) note.textContent = copy.mapOn; }, { once: true });
      note.textContent = copy.mapLoading;
      holder.append(frame);
      // The interactive map is taller than the picture; keep it in view.
      const calm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      figure.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
    });
  }

  // Printing shows every service: exclusive <details name> groups are released for the print.
  function initPrint() {
    let saved = null;
    window.addEventListener('beforeprint', () => {
      saved = Array.from(document.querySelectorAll('details.service'), item => ({ item, open: item.open, name: item.getAttribute('name') }));
      saved.forEach(({ item }) => { item.removeAttribute('name'); item.open = true; });
    });
    window.addEventListener('afterprint', () => {
      (saved || []).forEach(({ item, open, name }) => {
        item.open = open;
        if (name) item.setAttribute('name', name);
      });
      saved = null;
    });
  }

  // The other language opens at the section the visitor is reading.
  function initLanguageLink() {
    const link = document.querySelector('[data-language-link]');
    if (!link) return;
    const base = link.getAttribute('href').split('#')[0];
    const sync = () => link.setAttribute('href', base + window.location.hash);
    window.addEventListener('hashchange', sync);
    sync();
  }

  function start() {
    initTheme();
    paintStatus();
    initReminder();
    initWeekTips();
    initMap();
    initPrint();
    initLanguageLink();
    window.setInterval(paintStatus, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) paintStatus(); });
  }

  // The page calls Clinic.paintStatus() right after the hero markup, before the first paint.
  window.Clinic = { paintStatus };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}());
