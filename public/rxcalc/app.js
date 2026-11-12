import { calculate, calculateCrCl, formatNumber as n } from './engine.js';
import { DRUGS, CATEGORIES, CATALOGUE_META } from './catalogue.js';
import { availableDrugs } from './catalogue-selection.js';
import { REGIMENS } from './regimens.js';
import { availableRegimens, resolveRegimen } from './regimen-engine.js';

const $ = (q, root = document) => root.querySelector(q);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => v === '' || v === null || v === undefined ? null : Number(String(v).trim().replace(',', '.'));
const normalize = v => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').toLowerCase();
const readPreference = (key, fallback) => { try { return JSON.parse(localStorage.getItem(`rxcalc.${key}`)) ?? fallback; } catch { return fallback; } };
const savePreference = (key, value) => { try { localStorage.setItem(`rxcalc.${key}`, JSON.stringify(value)); } catch {} };
const paths = {
  calc: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8 7h8M8 11h1m3 0h1m3 0h.01M8 15h1m3 0h1m3 0h.01M8 18h1m3 0h1m3 0h.01"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>',
  tools: '<path d="M10 3v4l-5 9a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 16l-5-9V3M8 3h8M8 13h8"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4M11 18h2"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  down: '<path d="m7 10 5 5 5-5"/>',
  tooth: '<path d="M12 5c-2-2-7-3-8 1-1 3 1 6 2 9s1 6 3 5c1-1 1-6 3-6s2 5 3 6c2 1 2-2 3-5s3-6 2-9c-1-4-6-3-8-1Z"/><path d="M9 4c1 2 3 3 5 3"/>',
  paw: '<ellipse cx="7" cy="7" rx="2" ry="3"/><ellipse cx="17" cy="7" rx="2" ry="3"/><ellipse cx="3.5" cy="12" rx="1.5" ry="2.5"/><ellipse cx="20.5" cy="12" rx="1.5" ry="2.5"/><path d="M6 18c0-3 3-7 6-7s6 4 6 7c0 4-4 2-6 2s-6 2-6-2Z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/><path d="M4 12h4l2-4 3 8 2-4h5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  reset: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7"/>',
  moon: '<path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  pill: '<path d="m9 5-4 4a6 6 0 0 0 8.5 8.5l4-4A6 6 0 0 0 9 5Z"/><path d="m8 8 8 8"/>',
  drop: '<path d="M12 3s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12Z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
  bottle: '<path d="M9 3h6v4l3 4v9H6v-9l3-4ZM9 7h6M6 13h12M9 1h6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  alert: '<path d="m12 3 10 18H2Z"/><path d="M12 9v5m0 3h.01"/>',
  box: '<path d="m12 3 9 5v9l-9 5-9-5V8Zm0 10 9-5M12 13 3 8m9 5v9M8 5l9 5"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H4v13h4"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>',
  book: '<path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--surface)"/><circle cx="16" cy="17" r="3" fill="var(--surface)"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.pill}</svg>`;
const forms = { tablet: ['Tabletki', 'tabl.'], capsule: ['Kapsułki', 'kaps.'], suspension: ['Zawiesina doustna', 'ml'], spray: ['Aerozol', 'rozp.'], gel: ['Żel / maść', 'g'], drops: ['Krople', 'kropli'], solution: ['Roztwór', 'ml'], injection: ['Iniekcja · pojemniki jednorazowe', 'ml'] };
const ANIMALS = [{id:'dog',label:'Pies',weight:'np. 12'},{id:'cat',label:'Kot',weight:'np. 4'},{id:'horse',label:'Koń',weight:'np. 550'},{id:'hamster',label:'Chomik',weight:'np. 0,08'},{id:'rat',label:'Szczur',weight:'np. 0,3'}];
const VET_SOURCE = 'https://medicines.health.europa.eu/veterinary/en/search-medicines';
let specialty = readPreference('specialty', 'dental');
if (!['dental', 'cardio', 'veterinary'].includes(specialty)) specialty = 'dental';
let favoriteIds = readPreference('favorites', []);
if (!Array.isArray(favoriteIds)) favoriteIds = [];
favoriteIds = favoriteIds.filter(id => DRUGS.some(d => d.id === id));
const state = {
  specialty, category: 'all', search: '', drugId: '', formId: '', packageId: '',
  patientType: 'adult', age: '', weight: '', sex: '', creatinine: '', species: '', vetAgeUnit: 'years', vetRoute: '',
  doseMode: 'fixed', dose: '', frequency: '', days: '', roundingStep: '', manualMax: '', regimenId: '',
  extraInstructions: '', confirmed: false, rxMode: 'full', custom: false,
  customName: '', customForm: 'tablet', customStrength: '', customConcentration: '', customVolume: '5', customPack: '', customFractions: '1', customDrops: '', customContainers: '1',
  demo: false,
};
let theme = readPreference('theme', 'light');
document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
let latest = null, latestText = '', deferredInstall = null, swRegistration = null, toastTimer = null, observer = null;
let offlineReady = false, requestedUpdate = false;
const field = (id, label, value, placeholder, unit = '', extra = '') => `<div class="field"><label for="${id}">${label}</label><div class="input-unit"><input id="${id}" data-field="${id}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="${esc(value)}" placeholder="${esc(placeholder)}" ${extra}>${unit ? `<span>${unit}</span>` : ''}</div></div>`;
const isVeterinary = () => state.specialty === 'veterinary';
const getAnimal = () => ANIMALS.find(a => a.id === state.species);
const getCatalogue = () => availableDrugs(DRUGS, state.specialty, state.species);
const getDrug = () => getCatalogue().find(d => d.id === state.drugId);
const visibleFavorites = () => (isVeterinary() ? getCatalogue() : DRUGS.filter(d => !d.specialties.includes('veterinary'))).filter(d => favoriteIds.includes(d.id));
const getForm = () => {
  if (state.custom) return {
    id: 'custom', label: state.customName || 'Preparat własny', form: state.customForm === 'capsule' ? 'tablet' : state.customForm,
    unitLabel: forms[state.customForm][1], strengthMg: num(state.customStrength),
    concentrationMg: num(state.customConcentration), concentrationMl: num(state.customConcentration) === null ? null : num(state.customVolume),
    packOptions: [{ id: 'custom', label: state.customForm === 'injection' ? `${state.customContainers || '—'} amp. × ${state.customPack || '—'} ml` : `${state.customPack || '—'} ${forms[state.customForm][1]}`, quantity: state.customForm === 'injection' ? (num(state.customPack) === null || num(state.customContainers) === null ? null : num(state.customPack) * num(state.customContainers)) : num(state.customPack) }],
    singleUseUnitSize: state.customForm === 'injection' ? num(state.customPack) : null,
    allowedFractions: state.customForm === 'capsule' ? [1] : state.customFractions.split(',').map(Number), dropsPerMl: num(state.customDrops),
    sourceUrl: isVeterinary() ? VET_SOURCE : '', sourceLabel: 'Wyszukaj produkt w bazie weterynaryjnej UPD',
    notes: [isVeterinary() ? 'Preparat i schemat wprowadza lekarz weterynarii. Potwierdź zastosowanie dla wybranego gatunku, stężenie gotowej postaci, drogę podania, podzielność i opakowanie w odpowiednim źródle weterynaryjnym. Dla preparatu przygotowanego ręcznie podaj stężenie i objętość po przygotowaniu.' : 'Dane preparatu wprowadzone ręcznie. Potwierdź moc, jednostki, podzielność, wielkość opakowania i schemat w aktualnej ChPL.'],
    routeLabel: isVeterinary() ? state.vetRoute.trim() : '',
  };
  const d = getDrug();
  return d?.forms.find(f => f.id === state.formId);
};
function chooseDrug(id) {
  const d = getCatalogue().find(drug => drug.id === id);
  if (!d) return false;
  state.custom = false; state.drugId = id;
  state.vetRoute = ''; state.formId = d.forms[0].id;
  resetRegimen(); selectForm(state.formId);
  return true;
}
function resetRegimen() {
  if (state.demo) Object.assign(state, { age: '', weight: '', sex: '', creatinine: '' });
  Object.assign(state, { dose: '', frequency: '', days: '', manualMax: '', extraInstructions: '', confirmed: false, demo: false, regimenId: '' });
}
const getSourceRegimen = () => REGIMENS.find(r => r.id === state.regimenId);
const regimenContext = () => ({ formId: getForm()?.id, species: state.species, weight: num(state.weight), age: num(state.age), ageUnit: state.vetAgeUnit, days: num(state.days), calculationBlocked: getForm()?.calculationBlocked === true });
const getAvailableRegimens = () => isVeterinary() && !state.custom ? availableRegimens(REGIMENS, regimenContext()) : [];
const ageUnitLabel = () => ({ years: 'lat', months: 'mies.', weeks: 'tyg.', days: 'dni' })[state.vetAgeUnit] || '';
function syncSourceRegimen() {
  if (!state.regimenId) return null;
  const result = resolveRegimen(getSourceRegimen(), regimenContext());
  state.doseMode = result.doseMode || getForm()?.defaultMode || 'perKgDose';
  state.dose = result.dose === null ? '' : String(result.dose);
  state.frequency = result.frequency === null ? '' : String(result.frequency);
  state.roundingStep = '';
  for (const id of ['dose', 'frequency', 'doseMode', 'roundingStep']) if ($(`#${id}`)) $(`#${id}`).value = state[id];
  return result;
}
function chooseSourceRegimen(id) {
  const source = getAvailableRegimens().find(r => r.id === id);
  if (id && !source) return;
  resetRegimen();
  state.regimenId = source?.id || '';
  state.doseMode = getForm()?.defaultMode || 'perKgDose';
  state.roundingStep = '';
  if (source?.fixedDays) state.days = String(source.fixedDays);
  if (source?.minimumAge && state.age === '') state.vetAgeUnit = source.minimumAge.unit;
  syncSourceRegimen();
}
function sourceRegimenPicker() {
  if (!isVeterinary() || !state.species || getForm()?.calculationBlocked) return '';
  const choices = getAvailableRegimens(), source = getSourceRegimen();
  if (!choices.length) return '<p class="small-help">Tryb ręczny. Schemat dla tej postaci wprowadza lekarz weterynarii na podstawie właściwego źródła.</p>';
  return `<div class="source-regimen-picker"><div class="field"><label for="regimenId">Wskazanie i etap leczenia</label><select id="regimenId" data-field="regimenId"><option value="">Wybierz schemat ze źródła…</option>${choices.map(r => `<option value="${esc(r.id)}" ${r.id === state.regimenId ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</select></div>${source ? `<div class="source-regimen-card"><div class="source-regimen-heading">${icon('book')}<strong>Schemat z dokumentacji</strong><button class="text-button" data-action="manual-regimen">Edytuj ręcznie</button></div><p><strong>${esc(source.indication)}</strong><br>${esc(source.phaseLabel)}</p><ul>${(source.notes || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul><p class="source-screening">${esc(source.screening)}</p><a href="${esc(source.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(source.sourceLabel)} · sekcje ${esc(source.sourceSection)} ↗</a><small>Sprawdzenie źródła: ${esc(source.sourceCheckedAt)}. Potwierdź jego aktualność dla preparatu.</small></div>` : '<p class="small-help">Wybór uzupełni dawkę i częstość. Wskazanie oraz etap potwierdza lekarz. Poniżej możesz także wprowadzić własny schemat.</p>'}</div>`;
}
function selectForm(id) {
  const f = getDrug()?.forms.find(form => form.id === id);
  if (!f) return false;
  state.formId = id;
  state.packageId = f.packOptions[0].id;
  state.doseMode = f.defaultMode || (['spray', 'gel', 'drops'].includes(f.form) ? 'units' : 'fixed');
  state.roundingStep = !isVeterinary() && ['suspension', 'solution', 'injection'].includes(f.form) && !f.unitOnly ? '0.1' : '';
  resetRegimen();
  return true;
}
function clearCustomProduct() {
  Object.assign(state,{customName:'',customForm:'tablet',customStrength:'',customConcentration:'',customVolume:'5',customPack:'',customFractions:'1',customDrops:'',customContainers:'1',vetRoute:''});
}
function clearPatientContext() {
  Object.assign(state,{age:'',weight:'',sex:'',creatinine:'',patientType:'adult',species:'',vetAgeUnit:'years'});
  resetRegimen();
}
function startVeterinary() {
  clearCustomProduct();
  Object.assign(state,{custom:true,drugId:'',formId:'custom',packageId:'custom',doseMode:'perKgDose',roundingStep:'',rxMode:'full',search:'',category:'all'});
  resetRegimen();
  const first = getCatalogue()[0];
  if (first) chooseDrug(first.id);
}
function switchSpecialty(value) {
  if(!['dental','cardio','veterinary'].includes(value))return;
  if(state.specialty===value){savePreference('specialty',value);return;}
  const animalTransition=isVeterinary() || value==='veterinary';
  if(animalTransition){clearPatientContext();clearCustomProduct();}
  state.specialty=value;state.search='';state.category='all';savePreference('specialty',value);
  if(isVeterinary())startVeterinary();else chooseDrug(DRUGS.find(d=>d.specialties.includes(value)).id);
}
if(isVeterinary())startVeterinary();else chooseDrug(DRUGS.find(d => d.specialties.includes(state.specialty)).id);

function render() {
  const cardio = state.specialty === 'cardio', vet = isVeterinary();
  const f = getForm();
  syncSourceRegimen();
  const source = getSourceRegimen(), sourceLocked = !!state.regimenId;
  $('#app').innerHTML = `
    <aside class="sidebar" aria-label="Nawigacja główna">
      <a class="brand" href="./" aria-label="RxCalc — strona główna"><span class="brand-mark">Rx</span><span class="brand-word">RxCalc<span class="pro">BETA</span></span></a>
      <p class="nav-label">TWÓJ GABINET</p>
      <nav class="nav">
        <button class="active" data-action="calculator" title="Kalkulator">${icon('calc')}<span>Kalkulator</span></button>
        <button data-action="favorites" title="Ulubione">${icon('star')}<span>Ulubione</span><span class="nav-count">${visibleFavorites().length}</span></button>
        <button data-action="tools" title="Narzędzia">${icon('tools')}<span>Narzędzia</span></button>
      </nav>
      <div class="sidebar-bottom"><div class="install-card"><span class="icon-holder">${icon('phone')}</span><h3>Twój gabinet.<br>Także w telefonie.</h3><p>Dodaj RxCalc do ekranu głównego i miej go zawsze pod ręką.</p><button data-action="install">Dodaj aplikację ${icon('arrow')}</button></div><div class="sidebar-meta"><span class="dot"></span>RxCalc <span style="margin-left:auto">v1.0 beta</span></div></div>
    </aside>
    <div class="workspace">
      <header class="topbar"><div class="topbar-title">Twój gabinet ${icon('arrow')} <strong>Kalkulator dawkowania</strong></div><a href="./" class="brand mobile-brand"><span class="brand-mark">Rx</span><span class="brand-word">RxCalc</span></a><div class="topbar-actions"><span class="online-status" id="online-status"><span class="dot"></span><span id="connection-text">Obliczenia na urządzeniu</span></span><button class="icon-button" data-action="theme" aria-label="Zmień motyw" title="Zmień motyw">${icon(theme === 'dark' ? 'sun' : 'moon')}</button><button class="new-patient" data-action="reset" title="Wyczyść dane pacjenta i schemat">${icon('plus')}<span>Nowy pacjent</span></button></div></header>
      <main id="main">
        <div id="update-slot"></div>
        <div class="page-heading"><div><p class="eyebrow"><span class="tiny-line"></span>MNIEJ LICZENIA. WIĘCEJ CZASU.</p><h1>Dawkowanie, pod kontrolą.</h1><p class="page-subtitle">${vet ? 'Przelicz schemat i przygotuj zalecenia dla opiekuna.' : 'Od wybranego schematu do gotowego zapisu na receptę.'}</p></div><div class="specialty-switch" aria-label="Specjalizacja"><button data-action="specialty" data-value="dental" class="${state.specialty === 'dental' ? 'active' : ''}" aria-pressed="${state.specialty === 'dental'}">${icon('tooth')}Stomatologia</button><button data-action="specialty" data-value="cardio" class="${cardio ? 'active' : ''}" aria-pressed="${cardio}">${icon('heart')}Kardiologia</button><button data-action="specialty" data-value="veterinary" class="${vet ? 'active' : ''}" aria-pressed="${vet}">${icon('paw')}Weterynaria</button></div></div>
        <nav class="mobile-nav" aria-label="Narzędzia mobilne"><button data-action="calculator">${icon('calc')}Kalkulator</button><button data-action="favorites">${icon('star')}Ulubione</button><button data-action="tools">${icon('tools')}Narzędzia</button></nav>
        <div class="clinical-note">${icon('info')}<span>${state.demo ? '<strong>Przykład arytmetyczny.</strong> To dane demonstracyjne, nie schemat dla pacjenta.' : vet ? '<strong>Weterynaria · schematy ze źródeł.</strong> Wybierz wskazanie i etap leczenia, a następnie potwierdź je dla pacjenta.' : '<strong>Wersja do weryfikacji.</strong> Schemat ustala lekarz. Potwierdź go w aktualnej ChPL.'}</span><button data-action="about">Zakres kalkulatora</button></div>
        <section class="patient-card" aria-labelledby="patient-title"><div class="section-heading"><span class="step-number">01</span><h2 id="patient-title">Kontekst pacjenta</h2><span class="trailing">${icon('lock')} Bez zapisywania danych</span></div><div class="patient-fields ${vet ? 'vet-patient-fields' : ''}">
          ${vet ? `<div class="field"><label for="species">Gatunek zwierzęcia <span aria-hidden="true">*</span></label><select id="species" data-field="species" required><option value="">Wybierz gatunek</option>${ANIMALS.map(a=>`<option value="${a.id}" ${state.species===a.id?'selected':''}>${a.label}</option>`).join('')}</select></div>${field('weight','Masa ciała',state.weight,getAnimal()?.weight||'Masa w kilogramach','kg','required')}<div class="field"><label for="vetAgeUnit">Jednostka wieku</label><select id="vetAgeUnit" data-field="vetAgeUnit"><option value="years" ${state.vetAgeUnit==='years'?'selected':''}>Lata</option><option value="months" ${state.vetAgeUnit==='months'?'selected':''}>Miesiące</option><option value="weeks" ${state.vetAgeUnit==='weeks'?'selected':''}>Tygodnie</option><option value="days" ${state.vetAgeUnit==='days'?'selected':''}>Dni</option></select></div>${field('age',source?.minimumAge?'Wiek (do schematu)':'Wiek (opcjonalnie)',state.age,'—',ageUnitLabel(),source?.minimumAge?'required':'')}` : `
          ${!cardio ? `<div class="patient-type"><div class="field-label">Grupa pacjenta</div><div class="segmented" aria-label="Grupa pacjenta"><button data-action="patient-type" data-value="adult" class="${state.patientType === 'adult' ? 'active' : ''}" aria-pressed="${state.patientType === 'adult'}">Dorosły</button><button data-action="patient-type" data-value="child" class="${state.patientType === 'child' ? 'active' : ''}" aria-pressed="${state.patientType === 'child'}">Dziecko</button></div></div><div class="patient-divider"></div>` : ''}
          ${field('age', 'Wiek', state.age, state.patientType === 'child' ? 'np. 8' : 'np. 35', 'lat')}
          ${field('weight', 'Masa ciała', state.weight, state.patientType === 'child' ? 'np. 24' : 'np. 70', 'kg')}
          ${cardio ? `<div class="field"><label for="sex">Płeć do wzoru CrCl</label><select id="sex" data-field="sex"><option value="">Wybierz</option><option value="female" ${state.sex === 'female' ? 'selected' : ''}>Kobieta</option><option value="male" ${state.sex === 'male' ? 'selected' : ''}>Mężczyzna</option></select></div>${field('creatinine', 'Kreatynina', state.creatinine, 'np. 1,0', 'mg/dl')}` : `<div class="patient-hint">${icon('shield')}<span>Parametry służą wyłącznie<br>do bieżącego obliczenia.</span></div>`}`}
        </div>${vet ? '<p class="small-help">Masę wpisz w kg: 100 g = 0,1 kg. Gatunek i masa są wymagane do obliczenia.</p>' : ''}${cardio ? '<div id="renal-inline" class="renal-output"></div>' : ''}</section>
        <div class="calculator-grid"><div class="left-stack">
          <section class="panel" aria-labelledby="drug-title"><div class="section-heading"><span class="step-number">02</span><h2 id="drug-title">${vet ? 'Preparat weterynaryjny' : 'Wybierz preparat'}</h2><span class="trailing">${state.custom && (!vet || state.species) ? 'Dane ręczne' : `${getCatalogue().length} w katalogu`}</span></div>
            ${productPicker(f)}
          </section>
          <section class="panel" aria-labelledby="regimen-title"><div class="section-heading"><span class="step-number">03</span><h2 id="regimen-title">${vet ? 'Wybierz schemat podawania' : 'Ustal schemat podawania'}</h2><span class="trailing">${sourceLocked ? 'Ze źródła' : 'Wg decyzji lekarza'}</span></div>
            <fieldset class="regimen-body" ${vet && (!state.species || f.calculationBlocked) ? 'disabled' : ''}>
              ${sourceRegimenPicker()}
              <div class="field mode-field"><label for="doseMode">Sposób przeliczenia</label><select id="doseMode" data-field="doseMode" ${sourceLocked ? 'disabled' : ''}>${modeOptions(f)}</select></div>
              <div class="regimen-fields">${field('dose', doseLabel(), state.dose, '—', doseUnit(), sourceLocked ? 'readonly aria-readonly="true"' : '')}<div class="field"><label for="frequency">Częstotliwość</label><select id="frequency" data-field="frequency" ${sourceLocked ? 'disabled' : ''}><option value="">Wybierz</option>${[1,2,3,4,5,6,8,12].map(v => `<option value="${v}" ${state.frequency === String(v) ? 'selected' : ''}>${v} × na dobę</option>`).join('')}</select></div>${field('days', source?.fixedDays ? 'Czas tego etapu' : 'Czas stosowania', state.days, '—', 'dni', source?.fixedDays ? 'readonly aria-readonly="true"' : '')}</div>
              ${source?.maxDays ? `<p class="small-help">Wybierz czas leczenia, maksymalnie ${source.maxDays} dni dla tego schematu.</p>` : ''}
              ${source?.fixedDays ? '' : `<div class="quick-days"><span>Szybki wybór:</span>${(cardio ? [30,90,120] : [3,5,7,10]).filter(d => !source?.maxDays || d <= source.maxDays).map(d => `<button class="${state.days === String(d) ? 'active' : ''}" data-action="days" data-value="${d}">${d} dni</button>`).join('')}</div>`}
              <details class="advanced"><summary>${icon('settings')}Szczegóły przeliczenia i zalecenia</summary><div class="advanced-grid">${field('manualMax', 'Limit dobowy z ChPL (opcjonalnie)', state.manualMax, 'Ustalony przez lekarza', 'mg')}<div class="field"><label for="roundingStep">Krok zaokrąglenia (${esc(f.unitLabel)})</label><select id="roundingStep" data-field="roundingStep" ${sourceLocked ? 'disabled' : ''}>${[['','Bez zaokrąglania'],['0.01','0,01'],['0.05','0,05'],['0.1','0,1'],['0.5','0,5'],['1','1']].map(([v,l]) => `<option value="${v}" ${state.roundingStep === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="field" style="grid-column:1/-1"><label for="extraInstructions">${!vet && f.form === 'injection' ? 'Droga i sposób podania (wymagane)' : 'Dodatkowe zalecenia do D.S.'}</label><input id="extraInstructions" data-field="extraInstructions" value="${esc(state.extraInstructions)}" placeholder="Np. wstrząsnąć przed użyciem" maxlength="500" autocomplete="off"></div></div><p class="small-help">Limit ręczny może zaostrzyć limit katalogowy. Kontrole dotyczą wyłącznie wybranego preparatu. Sumowanie innych leków z tą samą substancją wymaga oceny lekarza.</p></details>
            </fieldset>
          </section>
          <div class="source-row">${icon('book')}<span>${f.sourceUrl ? `<a href="${esc(f.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(f.sourceLabel)} ↗</a> · ` : ''}<button data-action="source" class="text-button">Uwagi do preparatu</button><br>${state.custom ? 'Dane preparatu wprowadzone ręcznie.' : `Dane katalogowe: ${CATALOGUE_META.sourceCheckedAt}.`} ${f.doseBasisIngredient ? `Przeliczenie mg dotyczy ${esc(f.doseBasisIngredient)}.` : vet ? 'Sprawdź źródło weterynaryjne właściwe dla gatunku.' : 'Sprawdź aktualną ChPL przed ordynacją.'}</span></div>
        </div>
        <aside class="result-column" id="result" aria-label="Wynik obliczenia"><div class="result-card"><div class="result-top"><div class="result-title">Twoje wyliczenie <span class="live-tag">Na żywo</span></div><div class="dose-output"><span class="number" id="dose-value">—</span><span class="unit" id="dose-unit">${esc(f.unitLabel)}</span></div><p class="frequency-output" id="frequency-output">Uzupełnij schemat podawania</p><div class="dose-equivalent" id="dose-equivalent">Wynik pojawi się automatycznie.</div></div><div class="result-body"><div class="safety-heading"><span>Kontrola dawki</span><span class="status-badge" id="status-badge">${icon('info')} Oczekuje na dane</span></div><div class="dose-meter" id="dose-meter"><span style="width:0%"></span></div><div class="limit-text" id="limit-text"><span>Dawka dobowa</span><span>—</span></div><div class="result-alerts" id="result-alerts"></div><div class="supply-box"><div class="supply-head">${icon('box')}<span>${sourceLocked ? 'Na wybrany etap' : 'Na całą kurację'}</span><span id="total-units">—</span></div><div class="package-result" id="package-result">— opakowań</div><div class="package-description" id="package-description">Wybierz opakowanie preparatu</div>${!state.custom ? `<select class="package-select" id="packageId" data-field="packageId" aria-label="Wielkość opakowania">${f.packOptions.map(p => `<option value="${p.id}" ${p.id === state.packageId ? 'selected' : ''}>Opakowanie: ${esc(p.label)}</option>`).join('')}</select>` : ''}<div id="best-package"></div></div><div class="rx-section"><div class="rx-heading"><h3>${vet ? 'Zalecenia do dokumentacji' : 'Zapis do dokumentacji'}</h3><div class="rx-tabs"><button data-action="rx-mode" data-value="full" class="${state.rxMode === 'full' ? 'active' : ''}">${vet ? 'Preparat + D.S.' : 'Rp. + D.S.'}</button><button data-action="rx-mode" data-value="ds" class="${state.rxMode === 'ds' ? 'active' : ''}">Tylko D.S.</button></div></div><pre class="rx-preview placeholder" id="rx-preview">Wprowadź dawkę, częstotliwość i czas stosowania, aby przygotować zapis.</pre></div><label class="confirm-row"><input id="confirmed" type="checkbox" ${state.confirmed ? 'checked' : ''}><span>${vet ? 'Potwierdzam jako lekarz weterynarii wskazanie, etap, drogę podania i schemat dla tego pacjenta. Sprawdziłem przeciwwskazania, inne leki i aktualną dokumentację preparatu.' : 'Potwierdzam dobór preparatu i schemat w aktualnej ChPL dla tego pacjenta.'}</span></label><button class="copy-button" id="copy-button" data-action="copy" disabled>${icon('copy')}Kopiuj dawkowanie</button><p class="copy-caption">Tekst do wklejenia w systemie gabinetowym</p></div></div><p class="result-footnote">${icon('shield')}Kalkulator wspiera przeliczenie. Nie ocenia wszystkich przeciwwskazań, interakcji ani właściwości wskazania.</p></aside>
        </div>
        <footer class="page-footer"><span>RxCalc · Twój podręczny kalkulator dawkowania</span><div class="footer-links">${!vet ? '<button data-action="example">Przykład obliczenia</button>' : ''}<button data-action="install">Zainstaluj</button><button data-action="about">O aplikacji</button></div></footer>
      </main>
    </div><button class="mobile-result-link" id="mobile-result" data-action="result">Pokaż wynik ${icon('down')}</button>`;
  renderDrugs(); updateResult(); updateConnection(); showUpdate();
  observer?.disconnect();
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => { $('#mobile-result')?.classList.toggle('result-visible', entries[0].isIntersecting); }, { threshold: 0.1 });
    observer.observe($('#result'));
  }
}

function productPicker(f) {
  const vet = isVeterinary(), catalogue = getCatalogue();
  if (vet && !state.species) return `<div class="empty-search">${icon('paw')}<p>Wybierz gatunek zwierzęcia powyżej.<br>Pokażemy preparaty przypisane do tego gatunku.</p></div>`;
  const categories = (CATEGORIES[state.specialty] || []).filter(c => catalogue.some(d => d.category === c.id));
  const selector = state.custom ? customFields() : `
    <div class="search-wrap">${icon('search')}<input id="search" type="search" value="${esc(state.search)}" placeholder="Nazwa leku, substancja lub wskazanie…" aria-label="Szukaj preparatu" autocomplete="off"><span class="search-shortcut">⌘ K</span></div>
    <div class="categories" aria-label="Kategorie"><button class="${state.category === 'all' ? 'active' : ''}" data-action="category" data-value="all">Wszystkie</button>${categories.map(c => `<button class="${state.category === c.id ? 'active' : ''}" data-action="category" data-value="${c.id}">${c.label}</button>`).join('')}</div>
    <div class="drug-list" id="drug-list"></div>
    <div class="form-selection"><div class="selected-label"><span>Postać i moc preparatu</span><button class="favorite-button ${favoriteIds.includes(state.drugId) ? 'saved' : ''}" data-action="favorite">${icon('star')}${favoriteIds.includes(state.drugId) ? 'W ulubionych' : 'Zapisz'}</button></div><div class="form-chips">${getDrug().forms.map(x => `<button class="${x.id === f.id ? 'active' : ''}" data-action="form" data-value="${x.id}" aria-pressed="${x.id === f.id}">${esc(x.label)}</button>`).join('')}</div></div>
    ${vet ? `<div class="catalogue-notice ${f.calculationBlocked ? 'reference-only' : ''}">${icon(f.calculationBlocked ? 'info' : 'book')}<div>${f.calculationBlocked ? `<strong>Karta informacyjna · koncentrat do rozcieńczenia</strong><p>${esc(f.calculationNote)}</p>` : `<p>Postać przypisana do gatunku: <strong>${esc(getAnimal()?.label)}</strong>. ${getAvailableRegimens().length ? `Schematy ze źródła: ${getAvailableRegimens().length}. Wybierz wskazanie i etap w kroku 03.` : 'Schemat ustala lekarz weterynarii.'}</p>`}${f.calculationBlocked ? `<a href="${esc(f.sourceUrl)}" target="_blank" rel="noopener noreferrer">Otwórz źródło preparatu ↗</a>` : ''}</div></div>` : ''}`;
  const toggle = !state.custom || catalogue.length ? `<button class="custom-trigger" data-action="custom">${icon(state.custom ? 'book' : 'plus')}${state.custom ? 'Wróć do katalogu preparatów' : f.calculationBlocked ? 'Wprowadź przygotowany roztwór ręcznie' : 'Nie ma preparatu? Wprowadź własny'}</button>` : '';
  return `${vet && state.custom && !catalogue.length ? '<p class="small-help">Nie dodano jeszcze preparatów dla tego gatunku. Możesz wprowadzić preparat ręcznie.</p>' : ''}${selector}${toggle}`;
}

function customFields() {
  const liquid = ['suspension','solution','injection','drops'].includes(state.customForm);
  return `<div class="custom-fields"><div class="field full"><label for="customName">Nazwa i moc preparatu</label><input id="customName" data-field="customName" value="${esc(state.customName)}" placeholder="Pełna nazwa, moc i postać" maxlength="160" autocomplete="off"></div><div class="field full"><label for="customForm">Postać leku</label><select id="customForm" data-field="customForm">${Object.entries(forms).map(([id,[label]]) => `<option value="${id}" ${id === state.customForm ? 'selected' : ''}>${label}</option>`).join('')}</select></div>${liquid ? `${field('customConcentration', 'Substancja w stężeniu', state.customConcentration, 'np. 400', 'mg')}${field('customVolume', 'W objętości', state.customVolume, 'np. 5', 'ml')}` : field('customStrength', ['tablet','capsule'].includes(state.customForm) ? 'Moc 1 tabletki / kapsułki' : 'Substancja w 1 jednostce (opcjonalnie)', state.customStrength, 'np. 500', 'mg')}${field('customPack', state.customForm === 'injection' ? 'Objętość 1 ampułki / strzykawki' : 'Wielkość opakowania', state.customPack, state.customForm === 'injection' ? 'np. 1' : 'np. 20', forms[state.customForm][1])}${state.customForm === 'injection' ? field('customContainers','Ampułek w opakowaniu',state.customContainers,'np. 10','szt.') : ''}${state.customForm === 'drops' ? field('customDrops','Kalibracja preparatu',state.customDrops,'Z ChPL','kropli/ml') : ''}${state.customForm === 'tablet' ? `<div class="field full"><label for="customFractions">Podzielność potwierdzona w ChPL</label><select id="customFractions" data-field="customFractions"><option value="1" ${state.customFractions==='1'?'selected':''}>Tylko cała tabletka / kapsułka</option><option value="1,0.5" ${state.customFractions==='1,0.5'?'selected':''}>Cała tabletka lub połowa</option><option value="1,0.25,0.5,0.75" ${state.customFractions==='1,0.25,0.5,0.75'?'selected':''}>Podział na ćwiartki</option></select></div>` : ''}${isVeterinary() ? `<div class="field full"><label for="vetRoute">Droga podania (wymagana)</label><input id="vetRoute" data-field="vetRoute" value="${esc(state.vetRoute)}" placeholder="Np. doustnie" maxlength="100" autocomplete="off" required></div>` : ''}</div><p class="small-help">${isVeterinary() ? 'Wprowadź dane z odpowiedniego źródła weterynaryjnego. Schemat i stężenie nie są dobierane automatycznie.' : 'Wprowadź dane dokładnie z ChPL.'} Dla kropli opakowanie podaj w liczbie kropli. Dla aerozolu — w liczbie dozowanych rozpyleń. Ampułki / strzykawki traktowane są jako jednorazowe; pozostałość po podaniu jest odrzucana.</p>`;
}
function modeOptions(f) {
  const opts = [['fixed','Dawka jednorazowa · mg'],['perKgDay','Według masy · mg/kg/dobę'],['perKgDose','Według masy · mg/kg/podanie'],['units',`Ilość preparatu · ${f.unitLabel}/podanie`]];
  return opts.filter(([id]) => (!f.unitOnly && !['spray','gel'].includes(f.form)) || id === 'units').map(([id,label]) => `<option value="${id}" ${state.doseMode === id ? 'selected' : ''}>${esc(label)}</option>`).join('');
}
const doseLabel = () => ({ fixed:'Dawka jednorazowa', perKgDay:'Dawka na kg / dobę', perKgDose:'Dawka na kg / podanie', units:'Ilość na podanie' }[state.doseMode]);
const doseUnit = () => ({ fixed:'mg', perKgDay:'mg/kg/d', perKgDose:'mg/kg', units:getForm().unitLabel }[state.doseMode]);

function renderDrugs() {
  const node = $('#drug-list'); if (!node) return;
  const query = normalize(state.search);
  const list = getCatalogue().filter(d => (state.category === 'all' || d.category === state.category) && normalize([d.name,d.substance,...d.searchTerms,...d.forms.map(f => f.label)].join(' ')).includes(query));
  node.innerHTML = list.length ? list.map(d => `<button class="drug-card ${d.id === state.drugId ? 'selected' : ''}" data-action="drug" data-value="${d.id}" aria-pressed="${d.id === state.drugId}"><span class="drug-icon">${icon(d.forms[0].form === 'tablet' ? 'pill' : 'bottle')}</span><span><span class="drug-name">${esc(d.name)}</span><span class="drug-description">${esc(d.forms[0].label.split(' · ')[0])} · ${d.forms[0].calculationBlocked ? 'karta informacyjna' : d.forms.length === 1 ? shortForm(d.forms[0]) : `${d.forms.length} warianty`}</span></span><span class="drug-check">${d.id === state.drugId ? icon('check') : ''}</span></button>`).join('') : '<div class="empty-search">Nie znaleziono preparatu.<br>Zmień kategorię lub wprowadź własny poniżej.</div>';
}
function shortForm(f) { return ({tablet:'tabletki',suspension:'zawiesina',spray:'aerozol',solution:'roztwór',gel:'żel',drops:'krople',injection:'iniekcja'})[f.form] || f.form; }
function applicableLimit(f) {
  const age=num(state.age),weight=num(state.weight);
  let rule=(f.conditionalLimits||[]).find(r => {
    const tests=[['minAge','age',v=>age>=v],['minAgeExclusive','age',v=>age>v],['maxAge','age',v=>age<=v],['minWeight','weight',v=>weight>=v],['minWeightExclusive','weight',v=>weight>v],['maxWeight','weight',v=>weight<=v]];
    return tests.every(([key,param,test]) => r[key] == null || (Number.isFinite(param==='age'?age:weight) && test(r[key])));
  });
  const fromSource=rule?.maxDailyMg??f.maxDailyMg??null;
  const manual=num(state.manualMax);
  return { daily: manual===null ? fromSource : fromSource===null ? manual : Math.min(manual,fromSource), single:rule?.maxSingleMg??f.maxSingleMg??null, label:manual!==null ? 'Limit wprowadzony przez lekarza (nie wyższy od dostępnego limitu katalogowego)' : rule?.label || 'Limit z danych preparatu' };
}
function makeInput(packageOverride) {
  const f=getForm(), limit=applicableLimit(f), pack=packageOverride||f.packOptions.find(p=>p.id===state.packageId)||f.packOptions[0];
  return { patientKind:isVeterinary()?'animal':'human',calculationBlocked:f.calculationBlocked===true,species:isVeterinary()?state.species:undefined,form:f.form,doseMode:state.doseMode,dose:num(state.dose),weight:num(state.weight),age:isVeterinary()&&num(state.age)!==null?num(state.age)*({years:1,months:1/12,weeks:7/365,days:1/365}[state.vetAgeUnit]||1):num(state.age),frequency:num(state.frequency),days:num(state.days),strengthMg:f.strengthMg??null,concentrationMg:f.concentrationMg??null,concentrationMl:f.concentrationMl??null,unitLabel:f.unitLabel,packageSize:pack.quantity,roundingStep:num(state.roundingStep),allowedFractions:f.allowedFractions??null,maxDailyMg:limit.daily,maxSingleMg:limit.single,minAge:f.minAge??null,shelfLifeDays:f.shelfLifeDays??null,dropsPerMl:f.dropsPerMl??null,singleUseUnitSize:f.singleUseUnitSize??null,doseBasisIngredient:f.doseBasisIngredient };
}
function updateResult() {
  const sourceCheck=syncSourceRegimen();
  const f=getForm(),input=makeInput(),r=calculate(input),limit=applicableLimit(f);
  if(sourceCheck){r.errors.push(...sourceCheck.errors);r.warnings.push(...sourceCheck.warnings);if(!sourceCheck.valid){r.valid=false;if(r.status!=='critical')r.status='incomplete';}}
  const sourceApplicable=!sourceCheck||sourceCheck.valid;
  if(state.custom && !state.customName.trim() && r.valid){r.valid=false;r.status='incomplete';r.errors.push('Wprowadź pełną nazwę, moc i postać preparatu.');}
  if(isVeterinary() && r.valid && !f.routeLabel?.trim()){r.valid=false;r.status='incomplete';r.errors.push('Uzupełnij drogę podania preparatu.');}
  if(!isVeterinary() && f.form==='injection' && r.valid && !state.extraInstructions.trim()){r.valid=false;r.status='incomplete';r.errors.push('Uzupełnij drogę i sposób podania w szczegółach schematu.');}
  latest=r;
  const hasResult=r.singleUnits!==null&&sourceApplicable;
  $('#dose-value').textContent=hasResult?n(r.singleUnits,isVeterinary()?10:6):'—';
  $('#dose-unit').textContent=f.unitLabel;
  $('#frequency-output').textContent=hasResult?`${n(input.frequency)} × na dobę · przez ${n(input.days)} dni`:'Uzupełnij schemat podawania';
  let equivalent=hasResult?(r.singleMg!==null?`${n(r.singleMg,4)} mg${f.doseBasisIngredient?' '+f.doseBasisIngredient:''} na podanie`:`Ilość preparatu na jedno podanie`):'Dawka, częstotliwość i czas stosowania.';
  if(f.ingredients && hasResult) equivalent+=` · ${n(r.singleUnits*f.ingredients[1].amountMg/f.ingredients[1].perMl,3)} mg kw. klawulanowego`;
  $('#dose-equivalent').textContent=equivalent;
  const badge=$('#status-badge'); badge.className=`status-badge ${hasResult?r.status:''}`;
  badge.innerHTML=icon(r.status==='critical'?'alert':r.status==='ok'?'check':'info')+(hasResult?({ok:'Brak przekroczeń limitów',warning:'Wymaga sprawdzenia',critical:'Sprawdź schemat',incomplete:'Niepełna ocena'})[r.status]:'Oczekuje na dane');
  const meter=$('#dose-meter');meter.className=`dose-meter ${r.status}`;
  meter.firstElementChild.style.width=r.maxRatio!==null?`${Math.min(100,Math.max(0,r.maxRatio*100))}%`:'0%';
  $('#limit-text').innerHTML=`<span>${sourceApplicable&&r.dailyMg!==null?`${n(r.dailyMg,3)} mg / dobę`:'Dawka dobowa'}</span><span>${limit.daily!==null?`limit ${n(limit.daily)} mg`:'Brak ustalonego limitu'}</span>`;
  $('#limit-text').title=limit.daily!==null?limit.label:'Brak limitu nie oznacza potwierdzenia bezpieczeństwa.';
  const started=!!state.regimenId||f.calculationBlocked||state.dose!==''||state.frequency!==''||state.days!=='';
  let messages=[...r.errors.map(t=>[t,r.status==='critical'?'critical':'neutral']),...r.warnings.map(t=>[t,'warning'])];
  if(hasResult && f.unmodelledShelfLifeMonths && input.days>180)messages.push([`Po otwarciu preparat zachowuje trwałość przez ${f.unmodelledShelfLifeMonths} miesięcy. Wyliczenie opakowań opiera się na pojemności; przy tej długości terapii trzeba je sprawdzić z datami otwarcia i ważności.`, 'warning']);
  const pack=f.packOptions.find(p=>p.id===state.packageId)||f.packOptions[0];
  if(hasResult && pack.estimated)messages.push(['Wydajność opakowania jest szacunkowa. Uwzględnij przygotowanie pompki.','warning']);
  if(state.demo)messages.unshift(['Przykład arytmetyczny. Kopiowanie wyłączone — rozpocznij od „Nowy pacjent”.','neutral']);
  $('#result-alerts').innerHTML=started?messages.map(([m,c])=>`<div class="alert ${c}">${icon(c==='critical'?'alert':'info')}<span>${esc(m)}</span></div>`).join(''):'';
  $('#total-units').textContent=sourceApplicable&&r.totalUnits!==null?`${n(r.totalUnits,4)} ${f.unitLabel}`:'—';
  $('#package-result').textContent=sourceApplicable&&r.packages!==null?`${n(r.packages)} op. × ${f.form==='injection'?pack.label:`${n(input.packageSize,3)} ${f.unitLabel}`}`:'— opakowań';
  $('#package-description').textContent=sourceApplicable&&r.leftoverUnits!==null?`${n(r.leftoverUnits,4)} ${f.unitLabel} nadmiaru${r.expiryWasteUnits>0?` · w tym ${n(r.expiryWasteUnits,3)} ${f.unitLabel} po terminie przydatności`:''}`:'Wybierz opakowanie preparatu';
  const alternatives=(sourceApplicable?f.packOptions:[]).map(p=>({p,r:calculate(makeInput(p))})).filter(x=>x.r.valid).sort((a,b)=>a.r.leftoverUnits-b.r.leftoverUnits||a.r.packages-b.r.packages);
  const best=alternatives[0];
  $('#best-package').innerHTML=best && best.p.id!==state.packageId && !state.custom?`<button class="best-package" data-action="best-package" data-value="${esc(best.p.id)}">${icon('arrow')}Mniej nadmiaru / opakowań: ${n(best.r.packages)} × ${esc(best.p.label)}</button>`:'';
  latestText=r.valid?prescription(r,f,input):'';
  const preview=$('#rx-preview'); preview.classList.toggle('placeholder',!r.valid);
  preview.textContent=f.calculationBlocked?'Koncentrat wymaga przygotowania. Ta karta nie generuje dawkowania do podania.':r.valid?latestText:(hasResult?'Zapis będzie dostępny po usunięciu wskazanych niezgodności.':'Wprowadź dawkę, częstotliwość i czas stosowania, aby przygotować zapis.');
  $('#copy-button').disabled=!r.valid||!state.confirmed||state.demo;
  const confirmed=$('#confirmed');confirmed.checked=state.confirmed;confirmed.disabled=!r.valid||state.demo;
  if($('#renal-inline')) {
    const crcl=calculateCrCl({age:num(state.age),sex:state.sex,weight:num(state.weight),creatinine:num(state.creatinine)});
    $('#renal-inline').innerHTML=crcl===null?`${icon('info')}Uzupełnij parametry dorosłego pacjenta, aby oszacować CrCl.`:`${icon('tools')}CrCl (Cockcroft–Gault): <strong>${n(crcl,1)} ml/min</strong><span>· nie dobiera dawki leku</span>`;
  }
  if($('#mobile-result'))$('#mobile-result').innerHTML=hasResult?`${n(r.singleUnits,isVeterinary()?10:3)} ${esc(f.unitLabel)} · zobacz wynik ${icon('down')}`:`Pokaż wynik ${icon('down')}`;
}
function prescription(r,f,input) {
  const unit=f.unitLabel==='rozp.'?'rozpyleń':f.unitLabel;
  const source=getSourceRegimen();
  let ds=`D.S. Stosować ${n(r.singleUnits,isVeterinary()?10:6)} ${unit}${f.routeLabel?' '+f.routeLabel:''}, ${n(input.frequency)} ${input.frequency===1?'raz':'razy'} na dobę przez ${n(input.days)} ${input.days===1?'dzień':'dni'}.`;
  if(source?.administration) ds+=' '+source.administration;
  if(state.extraInstructions.trim()) ds+=' '+state.extraInstructions.trim();
  const context=(isVeterinary()?`Gatunek: ${getAnimal()?.label || '—'}. Masa ciała: ${n(input.weight,6)} kg.\n`:'')+(source?`Wskazanie: ${source.indication}.\nEtap: ${source.phaseLabel}.\n`:'');
  if(state.rxMode==='ds')return context+ds;
  const name=state.custom?state.customName.trim():`${getDrug().substance}\n${f.label}`;
  return `${context}${isVeterinary()?'Preparat:':'Rp.'} ${name}\n${n(r.packages)} op. po ${f.form==='injection'?f.packOptions[0].label:`${n(input.packageSize,3)} ${f.unitLabel}`}\n${ds}`;
}
function dirty() { state.confirmed=false; }
function toast(message) { clearTimeout(toastTimer); const el=$('#toast');el.textContent=message;el.classList.add('show');toastTimer=setTimeout(()=>el.classList.remove('show'),3500); }
function openDialog(title,content) {
  const dialog=$('#dialog');dialog.innerHTML=`<div class="dialog-inner"><div class="dialog-header"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close-dialog" aria-label="Zamknij">${icon('close')}</button></div><div class="dialog-content">${content}</div></div>`;
  if(!dialog.open)dialog.showModal();
}
function aboutDialog() {
  openDialog('RxCalc. Prosto do wyniku.',`<p>Podręczny kalkulator dla lekarzy, lekarzy dentystów i lekarzy weterynarii. Przelicza <strong>wprowadzony schemat</strong> na ilość preparatu, opakowania i tekst dawkowania.</p><p><strong>Wersja 1.0 beta — do weryfikacji.</strong> Ta wersja nie przeszła pełnej walidacji klinicznej. Nie wybiera leczenia, nie wystawia e-recept w P1 i nie zastępuje oceny lekarza.</p><ul><li>Weterynaria: pies, kot, koń, chomik i szczur. Katalog wybranych preparatów filtruje postaci według gatunku, a lekarz wybiera wskazanie i etap z udokumentowanych schematów lub wprowadza własny schemat. Dane źródłowe nie obejmują wszystkich wskazań i gatunków. Koncentraty wymagające przygotowania są oznaczone jako karty informacyjne, bez obliczeń i kopiowania dawki. Wersja nie ma pełnej bazy schematów, przeciwwskazań ani kompletnego formularza recepty weterynaryjnej.</li><li>Katalog leków dla ludzi: ${DRUGS.filter(d=>!d.specialties.includes('veterinary')).length} preparatów, ${DRUGS.filter(d=>!d.specialties.includes('veterinary')).reduce((a,d)=>a+d.forms.length,0)} warianty. Źródła ChPL przy każdym preparacie; sprawdzone ${CATALOGUE_META.sourceCheckedAt}.</li><li>Kontrola obejmuje tylko dostępne lub wprowadzone limity i dane o podzielności. Nie obejmuje pełnych przeciwwskazań, interakcji, niewydolności narządów ani sumy leków z tą samą substancją.</li><li>Weterynaryjne dane katalogowe: ${DRUGS.filter(d=>d.specialties.includes('veterinary')).length} marek, ${DRUGS.filter(d=>d.specialties.includes('veterinary')).reduce((a,d)=>a+d.forms.length,0)} postaci/mocy, w tym karty informacyjne. Źródła: polski RPL, unijna baza UPD oraz urzędowa dokumentacja VMD/HPRA w języku angielskim; odnośniki przy produkcie.</li><li>Wielkości opakowań są rejestracyjne. Dostępność handlowa i refundacja nie są sprawdzane.</li><li>Dane pacjenta i dawkowanie pozostają w pamięci tej karty; nie są wysyłane ani zapisywane przez RxCalc. Przycisk „Nowy pacjent” je usuwa. Po skopiowaniu tekst trafia do schowka urządzenia.</li><li>Zapamiętujemy wyłącznie motyw, specjalizację i listę ulubionych. Pliki aplikacji są przechowywane lokalnie do pracy offline. Hosting może prowadzić własne logi techniczne.</li></ul><p>Decyzję kliniczną, aktualność źródła i końcowy zapis na recepcie potwierdza osoba wystawiająca receptę.</p>`);
}
function sourceDialog() {
  const f=getForm();
  openDialog('Źródło i uwagi',`<p><strong>${esc(f.label)}</strong></p>${f.sourceUrl?`<p><a href="${esc(f.sourceUrl)}" target="_blank" rel="noopener noreferrer">${state.custom && isVeterinary()?'Wyszukaj produkt w bazie weterynaryjnej':esc(f.sourceLabel || 'Dokumentacja produktu')} ↗</a></p>`:''}${f.registrationUrl?`<p><a href="${esc(f.registrationUrl)}" target="_blank" rel="noopener noreferrer">Wpis produktu w unijnej bazie UPD ↗</a></p>`:''}<ul>${(f.notes||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ul><p>${isVeterinary()?'Katalog przypisuje postać do gatunku. Wybrany schemat ze źródła sprawdza zapisane warunki wieku, masy i czasu. Wskazanie, przeciwwskazania, interakcje i pozostałe warunki ocenia lekarz weterynarii.':esc(CATALOGUE_META.scope)}</p>`);
}
function favoritesDialog() {
  if(isVeterinary()&&!state.species){openDialog('Ulubione w weterynarii','<p>Najpierw wybierz gatunek zwierzęcia. Pokażemy ulubione preparaty przypisane do tego gatunku.</p>');return;}
  const list=visibleFavorites();
  openDialog('Twoje ulubione',list.length?`<p>${isVeterinary()?`Preparaty przypisane do gatunku: <strong>${esc(getAnimal()?.label)}</strong>. `:''}Parametry pacjentów i schematy nie są zapamiętywane.</p><div class="dialog-drug-list">${list.map(d=>`<button data-action="favorite-select" data-value="${d.id}">${esc(d.name)}<small>${esc(d.forms[0].label)}</small></button>`).join('')}</div>`:`<p>${isVeterinary()?'Brak ulubionych preparatów dla tego gatunku. ':''}Dodaj preparat przyciskiem <strong>☆ Zapisz</strong> nad wyborem postaci. Będzie dostępny tutaj przy kolejnej wizycie.</p>`);
}
function toolsDialog() {
  if(isVeterinary()){openDialog('Narzędzia weterynaryjne',`<p>Wybierz gatunek, wpisz masę w kg i wybierz preparat. W kroku 03 wybierz wskazanie i etap ze źródła albo wprowadź własny schemat.</p><p><strong>Jednostki masy:</strong> 100 g = 0,1 kg; 500 g = 0,5 kg.</p><p>Przeliczenia mg/kg na podanie i mg/kg na dobę są dostępne w polu „Sposób przeliczenia”.</p><p><a href="${VET_SOURCE}" target="_blank" rel="noopener noreferrer">Baza produktów weterynaryjnych UPD ↗</a></p>`);return;}
  openDialog('Klirens kreatyniny',`<p><strong>Cockcroft–Gault · CrCl, ml/min</strong><br>Oszacowanie dla dorosłych. Wynik nie jest eGFR i nie ustala dawki leku.</p><div class="tools-grid">${field('toolAge','Wiek',state.age,'np. 65','lat')}${field('toolWeight','Masa do wzoru',state.weight,'np. 70','kg')}<div class="field"><label for="toolSex">Płeć uwzględniana we wzorze</label><select id="toolSex"><option value="">Wybierz</option><option value="female" ${state.sex==='female'?'selected':''}>Kobieta</option><option value="male" ${state.sex==='male'?'selected':''}>Mężczyzna</option></select></div>${field('toolCreatinine','Kreatynina',state.creatinine,'np. 1,0')}<div class="field"><label for="toolUnit">Jednostka kreatyniny</label><select id="toolUnit"><option value="mg/dl">mg/dl</option><option value="µmol/l">µmol/l</option></select></div></div><div id="tool-result" class="tool-result">— ml/min</div><p>Użyj masy właściwej dla tego pacjenta i wzoru. Skrajna budowa ciała oraz niestabilna czynność nerek wymagają odrębnej oceny. Nie stosuj automatycznie do doboru dawek.</p><p><a href="https://www.gov.uk/drug-safety-update/prescribing-medicines-in-renal-impairment-using-the-appropriate-estimate-of-renal-function-to-avoid-the-risk-of-adverse-drug-reactions" target="_blank" rel="noopener noreferrer">Źródło: MHRA — ocena czynności nerek ↗</a></p>`);
  updateTool();
}
function updateTool() {
  if(!$('#tool-result'))return;
  const result=calculateCrCl({age:num($('#toolAge').value),weight:num($('#toolWeight').value),sex:$('#toolSex').value,creatinine:num($('#toolCreatinine').value),creatinineUnit:$('#toolUnit').value});
  $('#tool-result').textContent=result===null?'Uzupełnij poprawne dane dorosłego pacjenta':`${n(result,1)} ml/min`;
}
async function installApp() {
  if(window.matchMedia('(display-mode: standalone)').matches){toast('RxCalc jest już uruchomiony jako aplikacja.');return;}
  if(deferredInstall){await deferredInstall.prompt();const choice=await deferredInstall.userChoice;deferredInstall=null;if(choice.outcome==='accepted'){toast('Dodawanie RxCalc do urządzenia.');return;}}
  openDialog('RxCalc na Twoim telefonie',`<p>Na Androidzie otwórz stronę w <strong>Chrome</strong>.</p><ol><li>Dotknij menu <strong>⋮</strong> w prawym górnym rogu.</li><li>Wybierz <strong>„Dodaj do ekranu głównego”</strong> lub <strong>„Zainstaluj aplikację”</strong>.</li><li>Potwierdź przyciskiem <strong>„Zainstaluj”</strong> albo „Dodaj”.</li></ol><p>Ikona RxCalc pojawi się na ekranie głównym. Po zainstalowaniu aplikacja może otwierać się we własnym oknie.</p><p><strong>${offlineReady?'Pliki zapisane — tryb offline jest gotowy.':'Pozostań chwilę online, aby pobrać komplet plików do pracy offline.'}</strong> Przeglądarka może usunąć dane witryny przy czyszczeniu pamięci; wtedy otwórz ją ponownie z internetem.</p><p>Na iPhonie: Safari → Udostępnij → Do ekranu głównego.</p>`);
}
async function copyPrescription() {
  if(!latest?.valid||!state.confirmed||state.demo)return;
  try { await navigator.clipboard.writeText(latestText);toast('Dawkowanie skopiowane. Możesz wkleić je do dokumentacji.'); }
  catch { openDialog('Skopiuj dawkowanie',`<p>Przeglądarka nie udostępniła schowka. Zaznacz tekst poniżej i skopiuj go ręcznie.</p><textarea id="manual-copy" style="width:100%;height:220px;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--ink)" readonly>${esc(latestText)}</textarea>`);$('#manual-copy').focus();$('#manual-copy').select(); }
}
function resetPatient() {
  $('#dialog').close(); $('#dialog').replaceChildren();
  clearPatientContext();
  if(isVeterinary())startVeterinary();else if(state.custom){state.custom=false;chooseDrug(state.drugId);}
  render();toast('Nowy pacjent — parametry i schemat wyczyszczone.');
}
function example() {
  if(isVeterinary())return;
  state.specialty='dental';state.category='all';state.search='';chooseDrug('amoxicillin-clavulanate');
  Object.assign(state,{patientType:'child',age:'8',weight:'24',doseMode:'perKgDay',dose:'45',frequency:'2',days:'7',roundingStep:'0.1',demo:true});render();toast('Przykład działania. Rozpocznij własne obliczenie przyciskiem „Nowy pacjent”.');
}

document.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b)return;
  const {action,value}=b.dataset;
  switch(action){
    case 'specialty':switchSpecialty(value);render();break;
    case 'patient-type':state.patientType=value;state.age='';state.weight='';resetRegimen();render();break;
    case 'drug':chooseDrug(value);render();break;
    case 'form':selectForm(value);render();break;
    case 'category':state.category=value;render();$('#search').focus();break;
    case 'manual-regimen':state.regimenId='';dirty();render();toast('Tryb ręczny — wartości wymagają własnej weryfikacji.');break;
    case 'days':if(getSourceRegimen()?.fixedDays)break;state.days=value;dirty();$('#days').value=value;document.querySelectorAll('[data-action=days]').forEach(x=>x.classList.toggle('active',x.dataset.value===value));updateResult();break;
    case 'custom':{
      if(state.custom){const d=getCatalogue().find(x=>x.id===state.drugId)||getCatalogue()[0];if(d)chooseDrug(d.id);}
      else{const preparedSolution=getForm().calculationBlocked;clearCustomProduct();if(preparedSolution){state.customForm='solution';state.customVolume='';}state.custom=true;state.doseMode=isVeterinary()?'perKgDose':'units';state.roundingStep='';state.packageId='custom';resetRegimen();}
      render();break;
    }
    case 'favorite':if(!getDrug())break;favoriteIds=favoriteIds.includes(state.drugId)?favoriteIds.filter(x=>x!==state.drugId):[...favoriteIds,state.drugId];savePreference('favorites',favoriteIds);render();break;
    case 'favorites':favoritesDialog();break;
    case 'favorite-select':{
      const d=visibleFavorites().find(x=>x.id===value);if(!d)break;
      if(!isVeterinary())switchSpecialty(d.specialties[0]);
      state.category='all';state.search='';chooseDrug(value);$('#dialog').close();render();break;
    }
    case 'rx-mode':state.rxMode=value;document.querySelectorAll('[data-action=rx-mode]').forEach(x=>x.classList.toggle('active',x.dataset.value===value));updateResult();break;
    case 'best-package':state.packageId=value;dirty();$('#packageId').value=value;updateResult();break;
    case 'copy':copyPrescription();break;
    case 'reset':resetPatient();break;
    case 'theme':theme=theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;savePreference('theme',theme);b.innerHTML=icon(theme==='dark'?'sun':'moon');break;
    case 'install':installApp();break;
    case 'about':aboutDialog();break;
    case 'source':sourceDialog();break;
    case 'tools':toolsDialog();break;
    case 'close-dialog':$('#dialog').close();break;
    case 'calculator':window.scrollTo({top:0,behavior:'smooth'});break;
    case 'result':$('#result').scrollIntoView({behavior:'smooth',block:'start'});break;
    case 'example':example();break;
    case 'update':if(swRegistration?.waiting){requestedUpdate=true;swRegistration.waiting.postMessage({type:'SKIP_WAITING'});}break;
  }
});
$('#app').addEventListener('input',e=>{
  if(e.target.id==='search'){state.search=e.target.value;renderDrugs();return;}
  const key=e.target.dataset.field;if(!key || e.target.tagName==='SELECT')return;
  if(state.regimenId&&(key==='dose'||(key==='days'&&getSourceRegimen()?.fixedDays))){e.target.value=state[key];return;}
  if(Object.hasOwn(state,key)){state[key]=e.target.value;dirty();updateResult();}
});
$('#app').addEventListener('change',e=>{
  if(e.target.id==='confirmed'){state.confirmed=e.target.checked;updateResult();return;}
  const key=e.target.dataset.field;if(!key||e.target.tagName!=='SELECT'||!Object.hasOwn(state,key))return;
  if(key==='regimenId'){chooseSourceRegimen(e.target.value);render();return;}
  if(state.regimenId&&['doseMode','frequency','roundingStep'].includes(key)){e.target.value=state[key];return;}
  state[key]=e.target.value;dirty();
  if(key==='species'){state.age='';state.weight='';state.vetAgeUnit=['hamster','rat'].includes(state.species)?'months':'years';startVeterinary();render();$('#weight').focus();}
  else if(key==='vetAgeUnit'){state.age='';render();}
  else if(key==='doseMode'){state.dose='';render();$('#dose').focus();}
  else if(key==='customForm'){state.customStrength='';state.customConcentration='';state.customPack='';state.customDrops='';state.customFractions='1';state.customContainers='1';state.vetRoute='';state.roundingStep='';state.doseMode=isVeterinary()&&!['spray','gel'].includes(state.customForm)?'perKgDose':'units';resetRegimen();render();}
  else updateResult();
});
$('#dialog').addEventListener('input',updateTool);$('#dialog').addEventListener('change',updateTool);
$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog'))$('#dialog').close();});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#search')?.focus();}if(e.key==='Escape' && $('#search')===document.activeElement){state.search='';$('#search').value='';renderDrugs();}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;});
window.addEventListener('appinstalled',()=>{deferredInstall=null;toast('RxCalc dodany do aplikacji.');});
function updateConnection(){const el=$('#connection-text');if(el)el.textContent=!navigator.onLine?(offlineReady?'Tryb offline':'Brak połączenia'):(offlineReady?'Gotowy do pracy offline':'Obliczenia na urządzeniu');}
window.addEventListener('online',updateConnection);window.addEventListener('offline',updateConnection);
function showUpdate(){if($('#update-slot'))$('#update-slot').innerHTML=swRegistration?.waiting?'<div class="update-banner"><span>Dostępna nowa wersja. Aktualizacja wyczyści bieżące obliczenie.</span><button data-action="update">Zaktualizuj</button></div>':'';}
render();
if('serviceWorker' in navigator && window.isSecureContext){
  navigator.serviceWorker.register(new URL('./sw.js',import.meta.url),{scope:'./',updateViaCache:'none'}).then(reg=>{
    swRegistration=reg;showUpdate();
    reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'){if(navigator.serviceWorker.controller)showUpdate();else{offlineReady=true;updateConnection();}}});});
    navigator.serviceWorker.ready.then(()=>{offlineReady=true;updateConnection();});
  }).catch(()=>{offlineReady=false;updateConnection();});
  let reloading=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{offlineReady=true;updateConnection();if(requestedUpdate&&!reloading){reloading=true;window.location.reload();}});
}
