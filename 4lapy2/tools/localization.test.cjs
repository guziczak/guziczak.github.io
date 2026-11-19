'use strict';

// Run with: node --test 4lapy2/tools/localization.test.cjs
// No browser or network is used. These checks exercise the exported production code.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseDate, atWarsawNine, openingStatus, buildReminder, googleUrl, calendarFile, calendarFilename
} = require('../site.js');

const now = new Date('2026-01-01T00:00:00Z');
const values = { name: 'Łatek', date: '2026-02-10', days: 7 };
const create = language => buildReminder(values, now, language);

test('language defaults remain Polish; regional English tags are accepted', () => {
  const date = new Date('2026-11-19T10:00:00Z');
  assert.equal(openingStatus(date).label, 'Otwarte teraz');
  assert.equal(openingStatus(date, 'en-GB').label, 'Open now');
  assert.equal(openingStatus(date, 'EN').label, 'Open now');
  assert.equal(openingStatus(date, 'fr').label, 'Otwarte teraz');
  assert.equal(create().language, 'pl');
  assert.equal(create('en-GB').language, 'en');
});

test('opening boundaries and day names use Warsaw time in both languages', () => {
  const cases = [
    ['2026-11-19T08:59:00Z', 'closed', 'Otwieramy dziś o 10:00', 'We open today at 10:00'],
    ['2026-11-19T09:00:00Z', 'open', 'Zapraszamy dziś do 18:00', 'Open today until 18:00'],
    ['2026-11-19T16:59:00Z', 'open', 'Zapraszamy dziś do 18:00', 'Open today until 18:00'],
    ['2026-11-19T17:00:00Z', 'closed', 'Otwieramy jutro o 10:00', 'We open tomorrow at 10:00'],
    ['2026-11-21T09:00:00Z', 'open', 'Zapraszamy dziś do 12:00', 'Open today until 12:00'],
    ['2026-11-21T11:00:00Z', 'closed', 'Otwieramy w poniedziałek o 10:00', 'We open on Monday at 10:00'],
    ['2026-11-22T10:00:00Z', 'closed', 'Otwieramy jutro o 10:00', 'We open tomorrow at 10:00'],
    ['2026-11-22T23:15:00Z', 'closed', 'Otwieramy dziś o 10:00', 'We open today at 10:00']
  ];
  for (const [instant, state, pl, en] of cases) {
    for (const language of ['pl', 'en']) {
      const result = openingStatus(new Date(instant), language);
      assert.equal(result.state, state, `${instant} ${language}`);
      assert.equal(result.detail, language === 'pl' ? pl : en);
    }
  }
  assert.equal(openingStatus(new Date('2026-11-22T23:15:00Z'), 'en').day, 1);
});

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
  for (const language of ['pl', 'en']) {
    for (const days of [1, 7, 14]) {
      assert.equal(buildReminder({ ...values, days }, now, language).days, days);
    }
  }
  assert.equal(buildReminder({ ...values, name: '' }, now, 'en').title, 'Book your pet’s vaccination');
});

test('validation rejects invalid dates and past alarms with localized messages', () => {
  assert.equal(parseDate('2026-02-29'), null);
  assert.equal(parseDate('2026-04-31'), null);
  assert.equal(parseDate('2028-02-29').toISOString(), '2028-02-29T00:00:00.000Z');
  for (const language of ['pl', 'en']) {
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
    const spring = buildReminder({ ...values, date: '2026-04-05' }, now, language);
    const autumn = buildReminder({ ...values, date: '2026-11-01' }, now, language);
    assert.equal(spring.start.toISOString(), '2026-03-29T07:00:00.000Z');
    assert.equal(autumn.start.toISOString(), '2026-10-25T08:00:00.000Z');
    const leap = buildReminder({ ...values, date: '2028-03-01', days: 1 }, now, language);
    assert.equal(leap.start.toISOString(), '2028-02-29T08:00:00.000Z');
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

test('ICS preserves localized content, escaping, UTF-8 folding and zero-offset alarm', () => {
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
    assert.ok(unfolded.includes(language === 'en' ? '10 February 2026.\\nCall' : '10 lutego 2026.\\nZadzwoń'));
    assert.ok(unfolded.includes(language === 'en' ? 'LOCATION:Cztery Łapy i Ty Veterinary Clinic' : 'LOCATION:Przychodnia Weterynaryjna'));
  }
});

test('download filenames are localized and sanitized; legacy reminders remain Polish', () => {
  assert.equal(calendarFilename(create('pl')), 'przypomnienie-szczepienie-latek.ics');
  assert.equal(calendarFilename(create('en')), 'vaccination-reminder-latek.ics');
  assert.equal(calendarFilename({ language: 'en', name: '  Łąka / Figa; 🐈  ' }), 'vaccination-reminder-laka-figa.ics');
  assert.equal(calendarFilename({ language: 'en', name: '' }), 'vaccination-reminder.ics');
  const legacy = { ...create() };
  delete legacy.language;
  delete legacy.location;
  assert.equal(new URL(googleUrl(legacy)).searchParams.get('hl'), 'pl');
  assert.match(calendarFile(legacy, now), /PRODID:-\/\/Cztery Lapy i Ty\/\/Przypomnienie\/\/PL/);
  assert.match(calendarFile(legacy, now).replace(/\r\n /g, ''), /LOCATION:Przychodnia Weterynaryjna/);
});
