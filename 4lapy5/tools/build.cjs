'use strict';

// Builds index.html (PL) and en/index.html (EN) from src/page.html and src/content.json.
// Usage: node 4lapy5/tools/build.cjs
// No dependencies. Opening hours come from site.js, so the page, the status logic and the
// structured data cannot drift apart. Asset versions are content hashes: no manual bumps.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const site = require('../site.js');

const root = path.join(__dirname, '..');
const OUTPUTS = { pl: 'index.html', en: 'en/index.html' };
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];
const SCHEMA_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const escapeHtml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const version = file => crypto.createHash('sha256').update(read(file)).digest('hex').slice(0, 10);
const time = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// Consecutive days with the same hours share one row: Monday–Friday, Saturday, Sunday.
function hourGroups() {
  const groups = [];
  MONDAY_FIRST.forEach((day, index) => {
    const key = JSON.stringify(site.HOURS[day]);
    const last = groups[groups.length - 1];
    if (last && last.key === key) { last.days.push(day); last.to = index; }
    else groups.push({ key, hours: site.HOURS[day], days: [day], from: index, to: index });
  });
  return groups;
}

function weekStrip(copy) {
  const [start, end] = site.AXIS;
  const percent = minutes => `${(((minutes - start) / (end - start)) * 100).toFixed(2)}%`;
  // Each day carries the text of its hover label: the day and its hours on two lines,
  // and a variant for a day that turns out to be a public holiday.
  const label = (dayName, text) => escapeHtml(`${dayName}\n${text}`).replace(/\n/g, '&#10;');
  return MONDAY_FIRST.map((day, index) => {
    const hours = site.HOURS[day];
    const bar = hours ? `<span class="week-open" style="--from:${percent(hours[0])};--to:${percent(hours[1])}"></span>` : '';
    const tip = label(copy.daysFull[index], hours ? `${time(hours[0])}–${time(hours[1])}` : copy.closedWord);
    const holidayTip = label(copy.daysFull[index], copy.holidayTip);
    return `<li data-week-day="${day}" data-tip="${tip}" data-tip-holiday="${holidayTip}"><span class="week-track">${bar}<span class="week-now"></span></span><span class="week-name">${escapeHtml(copy.weekdays[index])}</span></li>`;
  }).join('\n          ');
}

function hoursList(copy) {
  return hourGroups().map(group => {
    const last = copy.rangeLowercase ? copy.daysFull[group.to].toLowerCase() : copy.daysFull[group.to];
    const label = group.from === group.to ? copy.daysFull[group.from] : `${copy.daysFull[group.from]}–${last}`;
    const value = group.hours ? `${time(group.hours[0])}–${time(group.hours[1])}` : copy.closedWord;
    return `<div data-hours-days="${group.days.join(' ')}"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
  }).join('\n          ');
}

function services(copy) {
  return copy.services.map((service, index) => {
    const items = service.items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
    const link = service.link ? `<a class="text-link" href="${escapeHtml(service.link.href)}">${escapeHtml(service.link.text)}</a>` : '';
    return `<details class="service" name="uslugi"${index === 0 ? ' open' : ''}>
            <summary><svg class="icon service-icon" aria-hidden="true"><use href="#i-${escapeHtml(service.icon)}"/></svg><h3>${escapeHtml(service.title)}</h3><span class="service-desc">${escapeHtml(service.desc)}</span><span class="service-toggle" aria-hidden="true"></span></summary>
            <div class="service-body"><ul>${items}</ul>${link}</div>
          </details>`;
  }).join('\n          ');
}

// The reminder date as form boxes: two for the day, two for the month, four for the year.
function comb(copy) {
  const boxes = Array.from(copy.combPlaceholder, letter => `<b data-placeholder="${escapeHtml(letter)}">${escapeHtml(letter)}</b>`);
  if (boxes.length !== 8) throw new Error('combPlaceholder needs eight characters');
  return [...boxes.slice(0, 2), '<i>.</i>', ...boxes.slice(2, 4), '<i>.</i>', ...boxes.slice(4)].join('');
}

// The header row of the calendar sheet: Monday first, with the full day name for screen readers.
function calendarWeekdays(copy) {
  return copy.weekdays.map((short, index) => `<th scope="col" abbr="${escapeHtml(copy.daysFull[index])}">${escapeHtml(short)}</th>`).join('');
}

function jsonLd(shared, pageUrl) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'VeterinaryCare',
    name: 'Przychodnia Weterynaryjna Cztery Łapy i Ty',
    url: pageUrl,
    telephone: shared.phoneHref.replace('tel:', ''),
    address: { '@type': 'PostalAddress', streetAddress: 'ul. Chabrowa 2D', postalCode: '52-200', addressLocality: 'Wysoka', addressCountry: 'PL' },
    geo: { '@type': 'GeoCoordinates', latitude: shared.geo[0], longitude: shared.geo[1] },
    openingHoursSpecification: hourGroups().filter(group => group.hours).map(group => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: group.days.map(day => SCHEMA_DAYS[day]),
      opens: time(group.hours[0]),
      closes: time(group.hours[1])
    }))
  }).replace(/</g, '\\u003c');
}

function render(language) {
  const content = JSON.parse(read('src/content.json'));
  const copy = content[language];
  if (!copy) throw new Error(`Unknown language "${language}"`);
  const english = language === 'en';
  const pageUrl = content.shared.siteUrl + (english ? 'en/' : '');
  const values = {
    ...content.shared, ...copy,
    lang: language,
    root: english ? '../' : '',
    pageUrl,
    otherLang: english ? 'pl' : 'en',
    otherHref: english ? '../' : 'en/',
    cssVersion: version('styles.css'),
    jsVersion: version('site.js'),
    weekStrip: weekStrip(copy),
    hoursList: hoursList(copy),
    servicesHtml: services(copy),
    combHtml: comb(copy),
    calendarWeekdays: calendarWeekdays(copy),
    jsonLd: jsonLd(content.shared, pageUrl)
  };
  // {{key}} is escaped text; {{{key}}} is markup produced by the helpers above.
  return read('src/page.html').replace(/\{\{\{(\w+)\}\}\}|\{\{(\w+)\}\}/g, (match, markup, text) => {
    const key = markup || text;
    if (typeof values[key] !== 'string') throw new Error(`Missing text "${key}" for "${language}"`);
    return markup ? values[key] : escapeHtml(values[key]);
  });
}

function build() {
  return Object.fromEntries(Object.entries(OUTPUTS).map(([language, file]) => [file, render(language)]));
}

if (require.main === module) {
  for (const [file, html] of Object.entries(build())) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), html);
    console.log(`${file}  ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
  }
}

module.exports = { build, render, hourGroups };
