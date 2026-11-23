'use strict';

// Run with: node --test "4lapy5/tools/*.test.cjs"
// No browser or network is used. These checks exercise the exported production code.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  HOURS, AXIS, parseDate, atWarsaw, atWarsawNine, easterSunday, isHoliday, clinicStatus, todayLabel, previewInstant,
  maskDate, typedDate, monthGrid,
  buildReminder, reminderPreview, googleUrl, calendarFile, calendarFilename, mapEmbedSrc
} = require('../site.js');

const NBSP = ' ';
const plain = text => text.replace(/ /g, ' ');
// A Warsaw wall-clock time, so the cases below read like the clinic's own clock.
const warsaw = (date, time) => {
  const [hour, minute] = time.split(':').map(Number);
  return atWarsaw(parseDate(date), hour, minute);
};
const headline = (date, time, language) => plain(clinicStatus(warsaw(date, time), language).headline);

test('the hero sentence follows opening hours in Warsaw time, in both languages', () => {
  const cases = [
    ['2026-11-19', '09:59', 'closed', 'Dziś przyjmujemy od 10:00.', 'Open today from 10:00.'],
    ['2026-11-19', '10:00', 'open', 'Dziś przyjmujemy do 18:00.', 'Open today until 18:00.'],
    ['2026-11-19', '17:59', 'open', 'Dziś przyjmujemy do 18:00.', 'Open today until 18:00.'],
    ['2026-11-19', '18:00', 'closed', 'Jutro przyjmujemy od 10:00.', 'Open tomorrow from 10:00.'],
    ['2026-11-21', '10:00', 'open', 'Dziś przyjmujemy do 12:00.', 'Open today until 12:00.'],
    ['2026-11-21', '12:00', 'closed', 'Wracamy w poniedziałek o 10:00.', 'Back on Monday at 10:00.'],
    ['2026-11-22', '11:00', 'closed', 'Jutro przyjmujemy od 10:00.', 'Open tomorrow from 10:00.'],
    ['2026-11-23', '00:15', 'closed', 'Dziś przyjmujemy od 10:00.', 'Open today from 10:00.']
  ];
  for (const [date, time, state, pl, en] of cases) {
    for (const language of ['pl', 'en']) {
      const status = clinicStatus(warsaw(date, time), language);
      assert.equal(status.state, state, `${date} ${time} ${language}`);
      assert.equal(plain(status.headline), language === 'pl' ? pl : en);
    }
  }
  assert.equal(clinicStatus(new Date('2026-11-22T23:15:00Z'), 'en').day, 1, 'the weekday is the Warsaw one');
  assert.equal(clinicStatus(new Date('2026-11-19T10:00:00Z')).label, 'Otwarte teraz', 'Polish is the default');
  assert.equal(clinicStatus(new Date('2026-11-19T10:00:00Z'), 'en-GB').label, 'Open now');
  assert.equal(clinicStatus(new Date('2026-11-19T10:00:00Z'), 'fr').label, 'Otwarte teraz');
});

test('times and day names stay unbroken; only long sentences use the compact size', () => {
  const monday = clinicStatus(warsaw('2026-11-21', '12:00'), 'pl');
  assert.ok(monday.headline.includes(`w${NBSP}poniedziałek`), 'no orphaned preposition at a line end');
  assert.ok(monday.headline.includes(`o${NBSP}10:00`));
  assert.equal(monday.compact, true);
  assert.equal(clinicStatus(warsaw('2026-11-21', '12:00'), 'en').compact, false);
  for (const language of ['pl', 'en']) {
    assert.equal(clinicStatus(warsaw('2026-11-19', '11:00'), language).compact, false);
    assert.equal(clinicStatus(warsaw('2026-11-19', '19:00'), language).compact, false);
    assert.equal(clinicStatus(warsaw('2026-11-11', '11:00'), language).compact, true);
  }
});

test('Polish public holidays are known, including the Easter-based ones', () => {
  assert.equal(easterSunday(2025).toISOString().slice(0, 10), '2025-04-20');
  assert.equal(easterSunday(2026).toISOString().slice(0, 10), '2026-04-05');
  assert.equal(easterSunday(2027).toISOString().slice(0, 10), '2027-03-28');
  assert.equal(easterSunday(2038).toISOString().slice(0, 10), '2038-04-25');
  for (const day of ['2026-01-01', '2026-01-06', '2026-04-05', '2026-04-06', '2026-05-01', '2026-05-03',
    '2026-05-24', '2026-06-04', '2026-08-15', '2026-11-01', '2026-11-11', '2026-12-24', '2026-12-25',
    '2026-12-26', '2027-03-29', '2028-04-17', '2025-12-24']) {
    assert.equal(isHoliday(day), true, day);
  }
  for (const day of ['2026-04-03', '2026-04-07', '2026-11-12', '2026-12-27', '2026-12-31', '2024-12-24']) {
    assert.equal(isHoliday(day), false, day);
  }
});

test('a holiday never claims to be open and the next opening skips holidays', () => {
  for (const [date, time] of [['2026-11-11', '12:00'], ['2026-12-24', '12:00'], ['2026-12-25', '12:00'],
    ['2026-12-26', '11:00'], ['2027-01-01', '12:00'], ['2027-01-06', '12:00'], ['2026-04-06', '12:00'],
    ['2026-06-04', '09:00'], ['2026-08-15', '11:00']]) {
    const status = clinicStatus(warsaw(date, time), 'pl');
    assert.equal(status.state, 'holiday', `${date} ${time}`);
    assert.equal(status.headline, 'Dziś święto. Zadzwoń przed wizytą.');
    assert.equal(clinicStatus(warsaw(date, time), 'en').headline, 'Public holiday today. Call before you visit.');
  }
  // Good Friday is an ordinary working day in Poland.
  assert.equal(clinicStatus(warsaw('2026-04-03', '12:00')).state, 'open');
  // After the usual closing time a holiday reads like any other evening.
  assert.equal(headline('2026-11-11', '18:30', 'pl'), 'Jutro przyjmujemy od 10:00.');
  // The evening before a holiday points past it.
  assert.equal(headline('2026-11-10', '19:00', 'pl'), 'Wracamy w czwartek o 10:00.');
  assert.equal(headline('2026-11-10', '19:00', 'en'), 'Back on Thursday at 10:00.');
  // Christmas 2026: Thursday to Saturday are holidays, then Sunday.
  assert.equal(headline('2026-12-23', '19:00', 'pl'), 'Wracamy w poniedziałek o 10:00.');
  assert.equal(headline('2026-12-26', '12:30', 'pl'), 'Wracamy w poniedziałek o 10:00.');
  // Easter Sunday is closed anyway; Easter Monday is skipped.
  assert.equal(clinicStatus(warsaw('2026-04-05', '12:00')).state, 'closed');
  assert.equal(headline('2026-04-05', '12:00', 'pl'), 'Wracamy we wtorek o 10:00.');
  // A holiday on a Sunday changes nothing.
  assert.equal(headline('2026-05-03', '12:00', 'pl'), 'Jutro przyjmujemy od 10:00.');
});

test('the stamp carries one neutral word per state and the entry is dated in Warsaw', () => {
  const moments = [['2026-11-23', '11:30'], ['2026-11-21', '14:00'], ['2026-12-25', '11:00']];
  assert.deepEqual(moments.map(([date, time]) => clinicStatus(warsaw(date, time), 'pl').stamp), ['Otwarte', 'Zamknięte', 'Święto']);
  assert.deepEqual(moments.map(([date, time]) => clinicStatus(warsaw(date, time), 'en').stamp), ['Open', 'Closed', 'Holiday']);
  assert.match(todayLabel(warsaw('2026-11-23', '11:30'), 'pl'), /^Dziś · poniedziałek.*23\.11$/);
  assert.match(todayLabel(warsaw('2026-11-23', '11:30'), 'en'), /^Today · Monday.*23\/11$/);
  // Half past midnight in Warsaw on the 23rd is still the 22nd in UTC.
  assert.match(todayLabel(new Date('2026-11-22T23:30:00Z'), 'pl'), /poniedziałek.*23\.11/);
});

test('the status preview parameter is a Warsaw wall-clock time', () => {
  assert.equal(previewInstant('?czas=2026-11-23T11:30').toISOString(), '2026-11-23T10:30:00.000Z');
  assert.equal(previewInstant('?lang=pl&czas=2026-07-01T09:00').toISOString(), '2026-07-01T07:00:00.000Z');
  for (const search of ['', '?czas=', '?czas=abc', '?czas=2026-02-30T10:00', '?czas=2026-11-23T24:00',
    '?czas=2026-11-23T10:60', '?czas=2026-11-23', '?other=2026-11-23T11:30']) {
    assert.equal(previewInstant(search), null, search);
  }
});

test('the week strip axis contains every opening interval', () => {
  assert.equal(HOURS.length, 7);
  assert.equal(HOURS[0], null);
  for (const hours of HOURS.filter(Boolean)) {
    assert.ok(AXIS[0] <= hours[0] && hours[0] < hours[1] && hours[1] <= AXIS[1]);
  }
});

test('typing shapes the date as DD.MM.YYYY and tolerates the usual ways of writing it', () => {
  const typed = [
    ['', ''], ['1', '1'], ['15', '15'], ['150', '15.0'], ['1503', '15.03'], ['15032', '15.03.2'],
    ['15032027', '15.03.2027'], ['150320279', '15.03.2027'], ['15.03.2027', '15.03.2027'],
    ['15.', '15.'], ['15.03.', '15.03.'], ['1.', '01.'], ['01.3.', '01.03.'], ['1.3.2027', '01.03.2027'],
    ['15/03/2027', '15.03.2027'], ['15-03-2027', '15.03.2027'], ['15 03 2027', '15.03.2027'],
    ['2027-03-15', '15.03.2027'], [' 2027-03-15 ', '15.03.2027'], ['abc', ''], ['.5', '5']
  ];
  for (const [raw, shaped] of typed) assert.equal(maskDate(raw), shaped, JSON.stringify(raw));
  // The mask is stable: shaping its own output changes nothing, and backspace over a dot works.
  for (const [, shaped] of typed) assert.equal(maskDate(shaped), shaped);
  assert.equal(maskDate('15.0'.slice(0, -1)), '15.');
  assert.equal(maskDate('15.'.slice(0, -1)), '15');
});

test('a typed date becomes an ISO day only when it is complete and exists', () => {
  assert.deepEqual(typedDate('15.03.2027'), { iso: '2027-03-15', complete: true });
  assert.deepEqual(typedDate('15032027'), { iso: '2027-03-15', complete: true });
  assert.deepEqual(typedDate('1.3.2027'), { iso: '2027-03-01', complete: true });
  assert.deepEqual(typedDate('29.02.2028'), { iso: '2028-02-29', complete: true });
  assert.deepEqual(typedDate('29.02.2027'), { iso: '', complete: true });
  assert.deepEqual(typedDate('31.04.2027'), { iso: '', complete: true });
  assert.deepEqual(typedDate('00.00.0000'), { iso: '', complete: true });
  for (const partial of ['', '15', '15.03', '15.03.202']) assert.deepEqual(typedDate(partial), { iso: '', complete: false });
});

test('the calendar sheet lays a month out in weeks that start on Monday', () => {
  const november = monthGrid(2026, 11); // 1 November 2026 is a Sunday
  assert.equal(november.length, 6);
  assert.deepEqual(november[0], [null, null, null, null, null, null, '2026-11-01']);
  assert.deepEqual(november[1], ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  assert.deepEqual(november[5], ['2026-11-30', null, null, null, null, null, null]);
  const february = monthGrid(2027, 2); // starts on a Monday and has exactly four weeks
  assert.equal(february.length, 4);
  assert.equal(february[0][0], '2027-02-01');
  assert.equal(february[3][6], '2027-02-28');
  assert.equal(monthGrid(2028, 2).flat().filter(Boolean).length, 29);
  for (let month = 1; month <= 12; month += 1) {
    const weeks = monthGrid(2027, month);
    assert.ok(weeks.every(week => week.length === 7));
    const days = weeks.flat().filter(Boolean);
    assert.deepEqual(days, [...days].sort());
    days.forEach(day => assert.ok(parseDate(day), day));
    // Sundays sit in the last column, where the sheet prints them in red.
    weeks.forEach(week => { if (week[6]) assert.equal(parseDate(week[6]).getUTCDay(), 0); });
  }
});

const now = new Date('2026-01-01T00:00:00Z');
const values = { name: 'Łatek', date: '2026-02-10', days: 7 };
const create = language => buildReminder(values, now, language);

test('localized reminder content has identical dates and times', () => {
  const pl = create('pl');
  const en = create('en');
  assert.equal(pl.title, 'Umów szczepienie — Łatek');
  assert.equal(en.title, 'Book a vaccination — Łatek');
  assert.match(pl.description, /10 lutego 2026/);
  assert.match(en.description, /10 February 2026/);
  assert.match(en.description, /Call to book an appointment: \+48 71 786 78 84\./);
  assert.match(pl.location, /^Przychodnia Weterynaryjna/);
  assert.match(en.location, /^Cztery Łapy i Ty Veterinary Clinic, Chabrowa 2D/);
  assert.equal(pl.start.toISOString(), '2026-02-03T08:00:00.000Z');
  assert.equal(en.start.toISOString(), pl.start.toISOString());
  assert.equal(en.end - en.start, 15 * 60000);
  assert.equal(create().language, 'pl');
  assert.equal(create('en-GB').language, 'en');
  for (const language of ['pl', 'en']) {
    for (const days of [1, 7, 14]) assert.equal(buildReminder({ ...values, days }, now, language).days, days);
  }
  assert.equal(buildReminder({ ...values, name: '' }, now, 'en').title, 'Book your pet’s vaccination');
});

test('validation rejects invalid dates and past alarms with localized messages', () => {
  assert.equal(parseDate('2026-02-29'), null);
  assert.equal(parseDate('2026-04-31'), null);
  assert.equal(parseDate('2028-02-29').toISOString(), '2028-02-29T00:00:00.000Z');
  for (const language of ['pl', 'en']) {
    // A fully typed date that does not exist has its own message; a half-typed one stays quiet.
    const impossible = buildReminder({ ...values, date: '', invalidDate: true }, now, language);
    assert.equal(impossible.field, 'date');
    assert.match(impossible.error, language === 'pl' ? /^Takiej daty nie ma/ : /^There is no such date/);
    const impossiblePreview = reminderPreview({ ...values, date: '', invalidDate: true }, now, language);
    assert.equal(impossiblePreview.error, impossible.error);
    assert.equal(impossiblePreview.note, language === 'pl' ? 'Sprawdź datę szczepienia.' : 'Check the vaccination date.');
    assert.equal(reminderPreview({ ...values, date: '' }, now, language).error, '');
    const invalid = buildReminder({ ...values, date: '2026-02-29' }, now, language);
    assert.equal(invalid.field, 'date');
    assert.match(invalid.error, language === 'pl' ? /^Wybierz datę/ : /^Choose the vaccination date/);
    const pastDate = buildReminder({ ...values, date: '2026-11-19' }, new Date('2026-11-19T23:30:00Z'), language);
    assert.equal(pastDate.field, 'date');
    assert.match(pastDate.error, language === 'pl' ? /^Ta data już minęła/ : /^That date has passed/);
    for (const days of [0, 2, 8, -1, 'invalid']) {
      const invalidLead = buildReminder({ ...values, days }, now, language);
      assert.equal(invalidLead.field, 'alarm');
      assert.match(invalidLead.error, language === 'pl' ? /^Wybierz termin/ : /^Choose a reminder time/);
    }
    assert.equal(buildReminder(values, new Date('2026-02-03T07:59:59.999Z'), language).error, undefined);
    const pastAlarm = buildReminder(values, new Date('2026-02-03T08:00:00Z'), language);
    assert.equal(pastAlarm.field, 'alarm');
    assert.match(pastAlarm.error, language === 'pl' ? /^Wybrany termin/ : /^The selected reminder time has passed/);
  }
});

test('09:00 remains in Europe/Warsaw across both daylight-saving changes', () => {
  for (const [day, expected] of [
    ['2026-03-28', '2026-03-28T08:00:00.000Z'],
    ['2026-03-29', '2026-03-29T07:00:00.000Z'],
    ['2026-10-24', '2026-10-24T07:00:00.000Z'],
    ['2026-10-25', '2026-10-25T08:00:00.000Z']
  ]) assert.equal(atWarsawNine(parseDate(day)).toISOString(), expected);
  for (const language of ['pl', 'en']) {
    assert.equal(buildReminder({ ...values, date: '2026-04-05' }, now, language).start.toISOString(), '2026-03-29T07:00:00.000Z');
    assert.equal(buildReminder({ ...values, date: '2026-11-01' }, now, language).start.toISOString(), '2026-10-25T08:00:00.000Z');
    assert.equal(buildReminder({ ...values, date: '2028-03-01', days: 1 }, now, language).start.toISOString(), '2028-02-29T08:00:00.000Z');
  }
});

test('the preview warns at once, recovers, and stays neutral when cleared', () => {
  const current = new Date('2026-11-20T10:00:00Z');
  for (const language of ['pl', 'en']) {
    const late = { name: '', date: '2026-11-20', days: 7 };
    const tooLate = reminderPreview(late, new Date('2026-11-20T04:50:00Z'), language);
    assert.equal(tooLate.error, buildReminder(late, new Date('2026-11-20T04:50:00Z'), language).error);
    assert.equal(tooLate.field, 'alarm');
    assert.equal(tooLate.note, language === 'pl' ? 'Termin przypomnienia już minął.' : 'The reminder time has passed.');
    assert.match(tooLate.error, language === 'pl' ? /Zadzwoń/ : /Call to book/);

    const selected = { name: 'Luna', date: '2026-11-25', days: 7 };
    assert.match(reminderPreview(selected, current, language).error, language === 'pl' ? /krótsze wyprzedzenie/ : /shorter lead/);
    const shorter = reminderPreview({ ...selected, days: 1 }, current, language);
    assert.equal(shorter.error, '');
    assert.match(shorter.note, language === 'pl' ? /24 listopada, o 9:00/ : /24 November at 09:00/);
    assert.equal(shorter.title, language === 'pl' ? 'Umów szczepienie — Luna' : 'Book a vaccination — Luna');
    assert.match(reminderPreview({ ...selected, date: '2026-12-10' }, current, language).note, language === 'pl' ? /3 grudnia/ : /3 December/);

    const cleared = reminderPreview({ ...selected, date: '' }, current, language);
    assert.equal(cleared.error, '');
    assert.equal(cleared.date, language === 'pl' ? 'Wybierz datę szczepienia' : 'Choose the vaccination date');
    assert.match(cleared.note, language === 'pl' ? /tydzień wcześniej/ : /one week before/);

    const yesterday = reminderPreview({ name: '', date: '2026-11-19', days: 1 }, new Date('2026-11-20T04:50:00Z'), language);
    assert.equal(yesterday.field, 'date');
    assert.equal(yesterday.note, language === 'pl' ? 'Sprawdź datę szczepienia.' : 'Check the vaccination date.');
  }
});

test('Google Calendar exports localized content and fixed Warsaw time', () => {
  for (const language of ['pl', 'en']) {
    const reminder = create(language);
    const url = new URL(googleUrl(reminder));
    assert.equal(url.origin + url.pathname, 'https://calendar.google.com/calendar/render');
    assert.equal(url.searchParams.get('hl'), language);
    assert.equal(url.searchParams.get('ctz'), 'Europe/Warsaw');
    assert.equal(url.searchParams.get('dates'), '20260203T080000Z/20260203T081500Z');
    assert.equal(url.searchParams.get('text'), reminder.title);
    assert.equal(url.searchParams.get('details'), reminder.description);
    assert.equal(url.searchParams.get('location'), reminder.location);
  }
});

test('ICS preserves localized content, escaping, UTF-8 folding and a zero-offset alarm', () => {
  for (const language of ['pl', 'en']) {
    const reminder = buildReminder({ ...values, name: 'Łatek, Figa; \\ 🐈' }, now, language);
    const file = calendarFile(reminder, now);
    assert.equal(file.replace(/\r\n/g, '').includes('\n'), false);
    for (const line of file.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
    const unfolded = file.replace(/\r\n /g, '');
    assert.ok(unfolded.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
    assert.ok(unfolded.endsWith('END:VALARM\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'));
    assert.match(unfolded, /DTSTART:20260203T080000Z\r\nDTEND:20260203T081500Z/);
    assert.match(unfolded, /TRIGGER:PT0S/);
    assert.ok(unfolded.includes('Łatek\\, Figa\\; \\\\ 🐈'));
    assert.ok(unfolded.includes(language === 'en' ? 'SUMMARY:Book a vaccination' : 'SUMMARY:Umów szczepienie'));
    assert.ok(unfolded.includes(language === 'en' ? '. Call: +48 71 786 78 84.' : '. Zadzwoń: 71 786 78 84.'));
    assert.ok(unfolded.includes(language === 'en' ? 'LOCATION:Cztery Łapy i Ty Veterinary Clinic' : 'LOCATION:Przychodnia Weterynaryjna'));
  }
});

test('download filenames are localized and sanitized', () => {
  assert.equal(calendarFilename(create('pl')), 'przypomnienie-szczepienie-latek.ics');
  assert.equal(calendarFilename(create('en')), 'vaccination-reminder-latek.ics');
  assert.equal(calendarFilename({ language: 'en', name: '  Łąka / Figa; 🐈  ' }), 'vaccination-reminder-laka-figa.ics');
  assert.equal(calendarFilename({ language: 'en', name: '' }), 'vaccination-reminder.ics');
});

test('the Google map frame is requested in the language of the page', () => {
  const base = 'https://www.google.com/maps?q=ul.+Chabrowa+2D%2C+52-200+Wysoka&z=16&output=embed';
  assert.equal(mapEmbedSrc(base, 'pl'), `${base}&hl=pl`);
  assert.equal(mapEmbedSrc(base, 'en'), `${base}&hl=en`);
  assert.equal(mapEmbedSrc(base, 'de'), `${base}&hl=pl`);
});
