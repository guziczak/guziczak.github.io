import { calculate, calculateCrCl, formatNumber as n } from './engine.js';
import { DRUGS, CATEGORIES, CATALOGUE_META } from './catalogue.js';
import { availableDrugs } from './catalogue-selection.js';
import { REGIMENS } from './regimens.js';
import { availableRegimens, resolveRegimen } from './regimen-engine.js';
import { patientFieldsFor } from './workflow.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { availableHumanRegimens, resolveHumanRegimen } from './human-regimen-engine.js';
import { catalogueProducts, searchProducts } from './product-search.js';
import { humanDosingText, instructionDosingText } from './dental-output.js';
import { createSelectMenus } from './select-menu.js';

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
const selectMenus = createSelectMenus({ icon });
const forms = { tablet: ['Tabletki', 'tabl.'], capsule: ['Kapsułki', 'kaps.'], suspension: ['Zawiesina doustna', 'ml'], oralPaste: ['Pasta doustna', 'g'], oralGel: ['Żel doustny', 'g'], oralPowder: ['Granulat / proszek doustny', 'g'], spray: ['Aerozol', 'rozp.'], gel: ['Żel / maść', 'g'], drops: ['Krople', 'kropli'], solution: ['Roztwór', 'ml'], injection: ['Iniekcja · pojemniki jednorazowe', 'ml'] };
const SPECIALTIES = [{id:'dental',label:'Stomatologia',icon:'tooth'},{id:'cardio',label:'Kardiologia',icon:'heart'},{id:'veterinary',label:'Weterynaria',icon:'paw'}];
const ANIMALS = [{id:'dog',label:'Pies',weight:'np. 12'},{id:'cat',label:'Kot',weight:'np. 4'},{id:'horse',label:'Koń',weight:'np. 550'},{id:'hamster',label:'Chomik',weight:'np. 0,08'},{id:'rat',label:'Szczur',weight:'np. 0,3'}];
const VET_SOURCE = 'https://medicines.health.europa.eu/veterinary/en/search-medicines';
let specialty = readPreference('specialty', 'dental');
if (!['dental', 'cardio', 'veterinary'].includes(specialty)) specialty = 'dental';
let favoriteIds = readPreference('favorites', []);
if (!Array.isArray(favoriteIds)) favoriteIds = [];
favoriteIds = favoriteIds.filter(id => DRUGS.some(d => d.id === id));
const state = {
  specialty, category: 'all', routeFilter: 'all', search: '', drugId: '', formId: '', packageId: '',
  patientType: 'adult', age: '', weight: '', sex: '', creatinine: '', species: '', vetAgeUnit: 'years', vetRoute: '', foodChainStatus: 'unknown',
  humanAgeUnit: 'years', renalStatus: 'unknown', humanCrCl: '', instructionPacks: '',
  doseMode: 'fixed', dose: '', frequency: '', days: '', roundingStep: '', manualMax: '', regimenId: '',
  extraInstructions: '', confirmed: false, rxMode: 'full', custom: false,
  customName: '', customForm: 'tablet', customStrength: '', customConcentration: '', customVolume: '5', customPack: '', customFractions: '1', customDrops: '', customContainers: '1',
  demo: false,
};
// Presentation state stays in memory, separate from patient values and preferences.
const ui = {
  productChosen: false, formChosen: false, productExpanded: true,
  filtersOpen: false, showAll: false, manualRegimen: false, regimenExpanded: false,
  sourceDetailsOpen: false, patientDetailsOpen: false, advancedOpen: false,
};
const productReady = () => ui.productChosen && ui.formChosen && (!isVeterinary() || !!state.species);
function resetProductView() {
  Object.assign(ui, { productChosen:false, formChosen:false, productExpanded:true, filtersOpen:false,
    showAll:false, manualRegimen:false, regimenExpanded:false, sourceDetailsOpen:false,
    patientDetailsOpen:false, advancedOpen:false });
  state.confirmed = false;
  latest = null; latestText = '';
}
let theme = readPreference('theme', 'light');
document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
let latest = null, latestText = '', deferredInstall = null, swRegistration = null, toastTimer = null, copyObserver = null;
let offlineReady = false, requestedUpdate = false;
const field = (id, label, value, placeholder, unit = '', extra = '') => `<div class="field"><label for="${id}">${label}</label><div class="input-unit"><input id="${id}" data-field="${id}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="${esc(value)}" placeholder="${esc(placeholder)}" ${extra}>${unit ? `<span>${unit}</span>` : ''}</div></div>`;
const isVeterinary = () => state.specialty === 'veterinary';
const getAnimal = () => ANIMALS.find(a => a.id === state.species);
const getSpeciesCatalogue = () => availableDrugs(DRUGS, state.specialty, state.species);
const getCatalogue = () => availableDrugs(DRUGS, state.specialty, state.species, state.routeFilter);
const ROUTES = { oral: 'Doustnie', iv: 'Dożylnie', im: 'Domięśniowo', sc: 'Podskórnie', topical: 'Miejscowo' };
const getDrug = () => getSpeciesCatalogue().find(d => d.id === state.drugId);
const visibleFavorites = () => getSpeciesCatalogue().filter(d => favoriteIds.includes(d.id));
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
  Object.assign(ui, { productChosen:true, formChosen:state.specialty === 'dental' ? catalogueProducts([d]).length === 1 : d.forms.length === 1, productExpanded:false,
    manualRegimen:false, regimenExpanded:false, sourceDetailsOpen:false, advancedOpen:false });
  return true;
}
function resetRegimen() {
  if (state.demo) Object.assign(state, { age: '', weight: '', sex: '', creatinine: '' });
  Object.assign(state, { dose: '', frequency: '', days: '', manualMax: '', extraInstructions: '', instructionPacks: '', confirmed: false, demo: false, regimenId: '' });
  ui.manualRegimen = false; ui.regimenExpanded = false; ui.sourceDetailsOpen = false;
}
const getSourceRegimen = () => (isVeterinary() ? REGIMENS : HUMAN_REGIMENS).find(r => r.id === state.regimenId);
const isReference = f => !!(f?.referenceOnly || f?.calculationBlocked);
const isInstruction = f => !isVeterinary() && (f?.calculationMode === 'instruction' || getSourceRegimen()?.doseMode === 'instruction');
const currentPackage = f => f.packOptions.find(p => p.id === state.packageId) || f.packOptions[0];
const sourceLabel = source => source?.label || source?.indication || '';
const productKindLabel = f => ({medicine:'Produkt leczniczy',device:'Wyrób medyczny',cosmetic:'Kosmetyk'})[f?.productKind] || '';
function chooseProduct(key) {
  const product = catalogueProducts(getCatalogue()).find(row => row.key === key);
  if (!product || !chooseDrug(product.drug.id) || !selectForm(product.form.id)) return false;
  state.packageId = product.pack.id;
  Object.assign(ui, { productChosen:true, formChosen:true, productExpanded:false });
  return true;
}
function durationHint(source) {
  if (!source || source.fixedDays) return '';
  if (source.minDays && source.maxDays) return `Wybierz czas leczenia od ${source.minDays} do ${source.maxDays} dni dla tego schematu.`;
  if (source.minDays) return `Wybierz czas leczenia: co najmniej ${source.minDays} dni dla tego schematu.`;
  return source.maxDays ? `Wybierz czas leczenia, maksymalnie ${source.maxDays} dni dla tego schematu.` : '';
}
function quickDays(source, cardio) {
  const choices = source?.minDays ? [source.minDays, source.maxDays, 14, 28, 30, 60] : cardio ? [30, 90, 120] : [3, 5, 7, 10];
  return [...new Set(choices)].filter(d => Number.isInteger(d) && (!source?.minDays || d >= source.minDays) && (!source?.maxDays || d <= source.maxDays)).sort((a,b) => a-b).slice(0,4);
}
const deviceDivisions = (r, f) => r.valid && f.doseStepUnits > 0 ? Math.round(r.singleUnits / f.doseStepUnits) : null;
const divisionUnit = count => count === 1 ? 'działka' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'działki' : 'działek';
const variantUnit = count => count === 1 ? 'wariant' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'warianty' : 'wariantów';
const regimenContext = () => ({ formId: getForm()?.id, species: state.species, weight: num(state.weight), age: num(state.age), ageUnit: state.vetAgeUnit, foodChainStatus: state.foodChainStatus, days: num(state.days), calculationBlocked: getForm()?.calculationBlocked === true });
const humanContext = () => {
  const source=getSourceRegimen();
  const renalRelevant=source?.renalPolicy || source?.minCrCl != null || source?.requireCrCl;
  return { formId:getForm()?.id, specialty:state.specialty, patientType:state.patientType,
    age:num(state.age), ageUnit:state.humanAgeUnit, weight:num(state.weight), days:num(state.days),
    dose:num(state.dose), frequency:num(state.frequency), renalStatus:state.renalStatus,
    crcl:renalRelevant ? num(state.humanCrCl) : null };
};
const getAvailableRegimens = () => state.custom || isReference(getForm()) ? [] : isVeterinary()
  ? availableRegimens(REGIMENS, regimenContext()) : availableHumanRegimens(HUMAN_REGIMENS, humanContext());
const humanAgeYears = () => num(state.age) === null ? null : num(state.age) * ({years:1,months:1/12,days:1/365.25}[state.humanAgeUnit] || 1);
const ageUnitLabel = () => ({ years: 'lat', months: 'mies.', weeks: 'tyg.', days: 'dni' })[state.vetAgeUnit] || '';
function syncSourceRegimen() {
  if (!state.regimenId) return null;
  const source = getSourceRegimen();
  const result = isVeterinary() ? resolveRegimen(source, regimenContext()) : resolveHumanRegimen(source, humanContext());
  state.doseMode = result.doseMode || getForm()?.defaultMode || 'perKgDose';
  if (isVeterinary() || source?.dose != null || !source?.doseRange) state.dose = result.dose == null ? '' : String(result.dose);
  if (isVeterinary() || source?.frequency != null || !source?.frequencyOptions) state.frequency = result.frequency == null ? '' : String(result.frequency);
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
  ui.regimenExpanded = false;
}
function selectForm(id) {
  const f = getDrug()?.forms.find(form => form.id === id);
  if (!f) return false;
  state.formId = id;
  state.packageId = f.packOptions[0].id;
  state.doseMode = f.defaultMode || (['spray', 'gel', 'drops'].includes(f.form) ? 'units' : 'fixed');
  state.roundingStep = !isVeterinary() && ['suspension', 'solution', 'injection'].includes(f.form) && !f.unitOnly ? '0.1' : '';
  resetRegimen();
  ui.formChosen = true;
  return true;
}
function foodChainField() {
  if (state.species !== 'horse') return '';
  return `<div class="field food-chain-field"><label for="foodChainStatus">Status w paszporcie konia · wymagany</label><select id="foodChainStatus" data-field="foodChainStatus" required><option value="unknown" ${state.foodChainStatus === 'unknown' ? 'selected' : ''}>Sprawdź i wybierz</option><option value="excluded" ${state.foodChainStatus === 'excluded' ? 'selected' : ''}>Wykluczony z uboju</option><option value="notExcluded" ${state.foodChainStatus === 'notExcluded' ? 'selected' : ''}>Niewykluczony z uboju</option></select><small>Dotyczy uboju do spożycia przez ludzi. Sprawdź wpis w paszporcie.</small></div>`;
}
function supplyNote(r, f) {
  const notes = [];
  if (f.injectionContainerUse === 'multiDose') {
    notes.push(`Zapas z nowych fiolek; jedno nakłucie na podanie. Cała dawka z jednej fiolki; resztek z różnych fiolek nie łączymy. Trwałość po otwarciu: ${n(f.shelfLifeDays)} dni${f.maxWithdrawalsPerVial ? `; najwyżej ${n(f.maxWithdrawalsPerVial)} pobrań z fiolki w tym modelu` : ''}.`);
  }
  if (r.singleUseContainers !== null && r.singleUseContainers > 0) {
    notes.push(`Pojemniki jednorazowe do otwarcia: ${n(r.singleUseContainers)} × ${n(f.singleUseUnitSize,6)} ${f.unitLabel}.`);
    if (r.unusedSingleUseUnits > 0) notes.push(`Pozostałości do odrzucenia po podaniach: ${n(r.unusedSingleUseUnits,6)} ${f.unitLabel}.`);
  }
  if (f.packageCalculationNote) notes.push(f.packageCalculationNote);
  return notes.join(' ');
}
function clearCustomProduct() {
  Object.assign(state,{customName:'',customForm:'tablet',customStrength:'',customConcentration:'',customVolume:'5',customPack:'',customFractions:'1',customDrops:'',customContainers:'1',vetRoute:''});
}
function clearPatientContext() {
  Object.assign(state,{age:'',weight:'',sex:'',creatinine:'',patientType:'adult',species:'',vetAgeUnit:'years',foodChainStatus:'unknown',humanAgeUnit:'years',renalStatus:'unknown',humanCrCl:''});
  resetRegimen();
}
function startVeterinary() {
  clearCustomProduct();
  Object.assign(state,{custom:true,drugId:'',formId:'custom',packageId:'custom',doseMode:'perKgDose',roundingStep:'',rxMode:'full',search:'',category:'all',routeFilter:'all'});
  resetRegimen();
  const first = getCatalogue()[0];
  if (first) chooseDrug(first.id);
  resetProductView();
}
function switchSpecialty(value) {
  if(!['dental','cardio','veterinary'].includes(value))return;
  if(state.specialty===value){savePreference('specialty',value);return;}
  const animalTransition=isVeterinary() || value==='veterinary';
  if(animalTransition){clearPatientContext();clearCustomProduct();}
  state.specialty=value;state.search='';state.category='all';state.routeFilter='all';savePreference('specialty',value);
  if(isVeterinary())startVeterinary();else chooseDrug(DRUGS.find(d=>d.specialties.includes(value)).id);
  resetProductView();
}
if(isVeterinary())startVeterinary();else chooseDrug(DRUGS.find(d => d.specialties.includes(state.specialty)).id);
resetProductView();

function sourceRegimenPicker() {
  if ((isVeterinary() && !state.species) || isReference(getForm())) return '';
  const choices = getAvailableRegimens(), source = getSourceRegimen();
  if (!choices.length) return `<p class="small-help">${isInstruction(getForm()) ? 'Brak schematu źródłowego dla tej grupy pacjenta. Sprawdź grupę i dokumentację preparatu.' : `Schemat ręczny · parametry ustala ${isVeterinary() ? 'lekarz weterynarii' : 'lekarz'}.`}</p>`;
  if (ui.manualRegimen && !source) return `<div class="regimen-summary"><div class="selection-copy"><strong>Schemat ręczny</strong><small>Wartości ustala ${isVeterinary() ? 'lekarz weterynarii' : 'lekarz'}.</small></div><button class="text-button" data-action="source-mode">Wybierz ze źródła</button></div>`;
  if (source && !ui.regimenExpanded) return `<div class="regimen-summary"><div class="selection-copy"><strong>${esc(sourceLabel(source))}</strong>${source.phaseLabel ? `<small>${esc(source.phaseLabel)}</small>` : ''}</div><button class="text-button" data-action="edit-regimen">Zmień schemat</button></div>`;
  return `<div class="source-regimen-picker"><div class="field"><label for="regimenId">${isVeterinary() ? 'Wskazanie i etap leczenia' : 'Wskazanie i schemat ze źródła'}</label><select id="regimenId" data-field="regimenId"><option value="">Wybierz właściwy schemat…</option>${choices.map(r => `<option value="${esc(r.id)}" ${r.id === state.regimenId ? 'selected' : ''}>${esc(sourceLabel(r))}</option>`).join('')}</select></div>${!source ? `<p class="small-help">${isVeterinary() ? 'Wybór uzupełni dawkę i częstość dla wskazanego etapu.' : 'Wybór uzupełni wartości określone w źródle. Gdy podano zakres, dawkę wybiera lekarz.'}</p>${!isInstruction(getForm()) ? '<button class="text-button" data-action="manual-regimen">Wprowadź własny schemat</button>' : ''}` : ''}</div>`;
}

function ageFields(required = false) {
  const label = required ? 'Wiek pacjenta' : 'Wiek (opcjonalnie)';
  if (!isVeterinary()) return `<div class="field age-field"><label for="age">${label}</label><div class="age-input-group"><input id="age" data-field="age" type="text" inputmode="decimal" autocomplete="off" value="${esc(state.age)}" placeholder="${state.patientType === 'child' ? 'Wiek dziecka' : 'np. 35'}" ${required ? 'required' : ''}><select id="humanAgeUnit" data-field="humanAgeUnit" aria-label="Jednostka wieku">${[['years','lat'],['months','mies.'],['days','dni']].map(([v,l]) => `<option value="${v}" ${state.humanAgeUnit === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>`;
  return `<div class="field age-field"><label for="age">${label}</label><div class="age-input-group"><input id="age" data-field="age" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="${esc(state.age)}" placeholder="Wiek" ${required ? 'required' : ''}><select id="vetAgeUnit" data-field="vetAgeUnit" aria-label="Jednostka wieku">${[['years','lat'],['months','mies.'],['weeks','tyg.'],['days','dni']].map(([v,l]) => `<option value="${v}" ${state.vetAgeUnit === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>`;
}
function patientPanel(f) {
  if (!productReady() || isReference(f)) return '';
  const source = getSourceRegimen();
  const needs = patientFieldsFor({ ...state, form:f, source });
  const cardio = state.specialty === 'cardio';
  const weight = required => field('weight', required ? 'Masa ciała' : 'Masa (opcjonalnie)', state.weight, isVeterinary() ? getAnimal()?.weight || 'kg' : state.patientType === 'child' ? 'np. 24' : 'np. 70', 'kg', required ? 'required' : '');
  const renal = !isVeterinary() && source?.renalPolicy ? `<div class="field renal-status-field"><label for="renalStatus">Czynność nerek · warunek schematu</label><select id="renalStatus" data-field="renalStatus"><option value="unknown" ${state.renalStatus === 'unknown' ? 'selected' : ''}>Wymaga oceny lekarza</option><option value="normal" ${state.renalStatus === 'normal' ? 'selected' : ''}>Oceniona · bez wskazań do redukcji</option><option value="impaired" ${state.renalStatus === 'impaired' ? 'selected' : ''}>Zaburzona · potrzebna modyfikacja</option></select><small>Potwierdź, że czynność nerek pozwala zastosować wybrany schemat.</small><details class="context-details"><summary>Znany CrCl (opcjonalnie)</summary>${field('humanCrCl','CrCl ustalony klinicznie',state.humanCrCl,'Wartość CrCl','ml/min')}<p class="small-help">To nie jest eGFR przeliczony na 1,73 m². Nie stosujemy wzoru dla dorosłych u dzieci.</p></details></div>` : '';
  const essential = `${needs.weight ? weight(true) : ''}${needs.age ? ageFields(true) : ''}${needs.foodChain ? foodChainField() : ''}${renal}`;
  const additional = `${!needs.age ? ageFields() : ''}${!needs.weight ? weight(false) : ''}${cardio ? `<div class="field"><label for="sex">Płeć do wzoru CrCl</label><select id="sex" data-field="sex"><option value="">Wybierz</option><option value="female" ${state.sex === 'female' ? 'selected' : ''}>Kobieta</option><option value="male" ${state.sex === 'male' ? 'selected' : ''}>Mężczyzna</option></select></div>${field('creatinine','Kreatynina',state.creatinine,'np. 1,0','mg/dl')}` : ''}`;
  return `<section class="patient-card embedded-context" aria-labelledby="patient-title"><div class="section-heading"><h3 id="patient-title">Dane pacjenta</h3><span class="trailing">${icon('lock')} Tylko na ten czas</span></div>${essential ? `<div class="patient-fields ${isVeterinary() ? 'vet-patient-fields' : ''}">${essential}</div>` : '<p class="small-help">Wybrane przeliczenie nie wymaga dodatkowych parametrów pacjenta.</p>'}${isVeterinary() ? '<p class="small-help">Masę wpisz w kg: 100 g = 0,1 kg.</p>' : ''}${additional ? `<details class="context-details" data-disclosure="patientDetailsOpen" ${ui.patientDetailsOpen ? 'open' : ''}><summary>${cardio ? 'Czynność nerek · pomocniczy CrCl' : 'Dodatkowe parametry pacjenta'}</summary><div class="patient-fields ${isVeterinary() ? 'vet-patient-fields' : ''}">${additional}</div>${cardio ? '<div id="renal-inline" class="renal-output"></div><p class="small-help">CrCl jest pomocniczym oszacowaniem. Nie dobiera dawki leku.</p>' : ''}</details>` : ''}</section>`;
}

function humanRegimenPanel(f) {
  const source = getSourceRegimen();
  const instruction = isInstruction(f);
  const doseControl = source?.doseRange ? `<div>${field('dose',doseLabel(),state.dose,'Wybierz dawkę z zakresu',doseUnit())}<p class="small-help">Zakres tego schematu: ${n(source.doseRange.min)}–${n(source.doseRange.max)} ${esc(doseUnit())}. Wartość wybiera lekarz.</p></div>` : !instruction && source ? `<div class="source-fact"><small>${esc(doseLabel())}</small><strong id="source-dose-value">${state.dose !== '' ? `${n(num(state.dose),6)} ${esc(doseUnit())}` : 'Po uzupełnieniu danych'}</strong></div>` : '';
  const frequencyControl = source?.frequencyOptions ? `<div class="field"><label for="frequency">${source.asNeeded ? 'Maks. liczba podań na dobę' : 'Częstotliwość'}</label><select id="frequency" data-field="frequency"><option value="">Wybierz</option>${source.frequencyOptions.map(v => `<option value="${v}" ${state.frequency === String(v) ? 'selected' : ''}>${source.asNeeded ? 'Do ' : ''}${v} × na dobę</option>`).join('')}</select></div>` : source?.frequency ? `<div class="source-fact"><small>Częstotliwość</small><strong id="source-frequency-value">${n(source.frequency)} × na dobę</strong></div>` : '';
  const duration = source?.fixedDays ? `<p class="source-duration">Czas tego schematu: <strong>${n(source.fixedDays)} ${source.fixedDays === 1 ? 'dzień' : 'dni'}</strong></p>` : `<div class="duration-field">${field('days',instruction && !source?.minDays && !source?.maxDays ? 'Czas stosowania (jeśli ustalony)' : 'Czas stosowania',state.days,'Ustala lekarz','dni')}${durationHint(source) ? `<p class="small-help">${esc(durationHint(source))}</p>` : ''}${!instruction ? `<div class="quick-days"><span>Szybki wybór:</span>${quickDays(source,false).map(d => `<button class="${state.days === String(d) ? 'active' : ''}" data-action="days" data-value="${d}" aria-pressed="${state.days === String(d)}">${d} dni</button>`).join('')}</div>` : ''}</div>`;
  return `<section class="panel regimen-panel human-regimen" aria-labelledby="regimen-title"><div class="section-heading"><span class="step-number">02</span><h2 id="regimen-title">${instruction ? 'Sposób stosowania' : 'Schemat podawania'}</h2><span class="trailing">${source ? 'Ze źródła' : ''}</span></div>${sourceRegimenPicker()}${source ? `${patientPanel(f)}<div class="human-source-body">${instruction ? `<div class="instruction-summary">${icon('book')}<p>${esc(source.instructionText || source.administration || '')}</p></div>` : ''}<div class="regimen-fields human-regimen-fields">${doseControl}${frequencyControl}</div>${source.asNeeded ? `<p class="small-help">W razie potrzeby. ${source.minIntervalHours ? `Odstęp między podaniami: co najmniej ${n(source.minIntervalHours)} godz.` : ''} Zapas pokazuje maksymalne planowane zużycie.</p>` : ''}${duration}${instruction ? `<div class="instruction-supply">${field('instructionPacks','Liczba opakowań (jeśli ustalona)',state.instructionPacks,'Ustala lekarz','op.')}<p class="small-help">Ilości preparatu i liczby opakowań nie wyliczamy z umownej porcji. Wpisana liczba opakowań jest decyzją lekarza.</p></div>` : ''}${source.screening ? `<p class="source-screening">${icon('shield')}<span>${esc(source.screening)}</span></p>` : ''}<details class="advanced" data-disclosure="advancedOpen" ${ui.advancedOpen ? 'open' : ''}><summary>${icon('settings')}Dodatkowe zalecenia${instruction ? '' : ' i limit'}</summary><div class="advanced-grid">${!instruction ? field('manualMax','Własny niższy limit dobowy',state.manualMax,'Opcjonalnie','mg') : ''}<div class="field full"><label for="extraInstructions">Dodatkowe zalecenia</label><input id="extraInstructions" data-field="extraInstructions" value="${esc(state.extraInstructions)}" maxlength="500" placeholder="Ustalone przez lekarza" autocomplete="off"></div></div></details><details class="source-details" data-disclosure="sourceDetailsOpen" ${ui.sourceDetailsOpen ? 'open' : ''}><summary>${icon('book')}Źródło i zakres schematu</summary><ul>${(source.notes || []).map(note => `<li>${esc(note)}</li>`).join('')}</ul><a href="${esc(source.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(source.sourceLabel)}${source.sourceSection ? ` · ${esc(source.sourceSection)}` : ''} ↗</a><p class="small-help">Źródło sprawdzone: ${esc(source.sourceCheckedAt)}. Schemat obejmuje opisane warunki, nie pełną ocenę kliniczną.</p>${!instruction ? '<button class="text-button" data-action="manual-regimen">Edytuj jako schemat ręczny</button>' : ''}</details></div>` : ''}</section>`;
}

function regimenPanel(f) {
  if (!productReady() || isReference(f)) return '';
  if (!isVeterinary() && !state.custom && (getAvailableRegimens().length || isInstruction(f)) && (!ui.manualRegimen || isInstruction(f))) return humanRegimenPanel(f);
  const source = getSourceRegimen(), sourceLocked = !!state.regimenId;
  const manual = !isVeterinary() || ui.manualRegimen || !getAvailableRegimens().length;
  const instructions = `<div class="field" style="grid-column:1/-1"><label for="extraInstructions">${!isVeterinary() && f.form === 'injection' ? 'Droga i sposób podania (wymagane)' : 'Dodatkowe zalecenia do D.S.'}</label><input id="extraInstructions" data-field="extraInstructions" value="${esc(state.extraInstructions)}" placeholder="Np. wstrząsnąć przed użyciem" maxlength="500" autocomplete="off" ${!isVeterinary() && f.form === 'injection' ? 'required' : ''}></div>`;
  const requiredInstructions = !isVeterinary() && f.form === 'injection';
  return `<section class="panel regimen-panel" aria-labelledby="regimen-title"><div class="section-heading"><span class="step-number">02</span><h2 id="regimen-title">Schemat podawania</h2><span class="trailing">${sourceLocked ? 'Ze źródła' : manual ? 'Wg decyzji lekarza' : ''}</span></div>${sourceRegimenPicker()}${patientPanel(f)}${sourceLocked || manual ? `<fieldset class="regimen-body">${sourceLocked ? `<div class="regimen-facts"><div><small>${esc(doseLabel())}</small><strong id="source-dose-value">${state.dose !== '' ? `${n(num(state.dose),10)} ${esc(doseUnit())}` : 'Po uzupełnieniu danych'}</strong></div><div><small>Częstotliwość</small><strong id="source-frequency-value">${state.frequency !== '' ? `${n(num(state.frequency))} × na dobę` : '—'}</strong></div>${source?.fixedDays ? `<div><small>Czas tego etapu</small><strong>${n(source.fixedDays)} ${source.fixedDays === 1 ? 'dzień' : 'dni'}</strong></div>` : ''}</div>` : `<div class="field mode-field"><label for="doseMode">Sposób przeliczenia</label><select id="doseMode" data-field="doseMode">${modeOptions(f)}</select></div><div class="regimen-fields">${field('dose',doseLabel(),state.dose,'Wpisz dawkę',doseUnit())}<div class="field"><label for="frequency">Częstotliwość</label><select id="frequency" data-field="frequency"><option value="">Wybierz</option>${[1,2,3,4,5,6,8,12].map(v => `<option value="${v}" ${state.frequency === String(v) ? 'selected' : ''}>${v} × na dobę</option>`).join('')}</select></div></div>`}${!source?.fixedDays ? `<div class="duration-field">${field('days','Czas stosowania',state.days,'Wpisz czas','dni')}${durationHint(source) ? `<p class="small-help">${esc(durationHint(source))}</p>` : ''}<div class="quick-days"><span>Szybki wybór:</span>${quickDays(source,state.specialty === 'cardio').map(d => `<button class="${state.days === String(d) ? 'active' : ''}" data-action="days" data-value="${d}" aria-pressed="${state.days === String(d)}">${d} dni</button>`).join('')}</div></div>` : ''}${f.measurementNote ? `<p class="measurement-note">${icon('info')}<span>${esc(f.measurementNote)}</span></p>` : ''}${f.combinationNote ? `<p class="small-help">${esc(f.combinationNote)}</p>` : ''}${source?.screening ? `<p class="source-screening">${icon('shield')}<span>${esc(source.screening)}</span></p>` : ''}${requiredInstructions ? instructions : ''}<details class="advanced" data-disclosure="advancedOpen" ${ui.advancedOpen ? 'open' : ''}><summary>${icon('settings')}Szczegóły przeliczenia i zalecenia</summary><div class="advanced-grid">${field('manualMax','Limit dobowy z ChPL (opcjonalnie)',state.manualMax,'Ustalony przez lekarza','mg')}<div class="field"><label for="roundingStep">Krok zaokrąglenia (${esc(f.unitLabel)})</label><select id="roundingStep" data-field="roundingStep" ${sourceLocked ? 'disabled' : ''}>${[['','Bez zaokrąglania'],['0.01','0,01'],['0.05','0,05'],['0.1','0,1'],['0.5','0,5'],['1','1']].map(([v,l]) => `<option value="${v}" ${state.roundingStep === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>${!requiredInstructions ? instructions : ''}</div><p class="small-help">Limit ręczny może zaostrzyć limit katalogowy. Uwzględnienie innych leków z tą samą substancją wymaga oceny lekarza.</p></details>${source ? `<details class="source-details" data-disclosure="sourceDetailsOpen" ${ui.sourceDetailsOpen ? 'open' : ''}><summary>${icon('book')}Źródło i objaśnienia schematu</summary><ul>${(source.notes || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul><a href="${esc(source.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(source.sourceLabel)} · sekcje ${esc(source.sourceSection)} ↗</a><p class="small-help">Sprawdzenie źródła: ${esc(source.sourceCheckedAt)}. Potwierdź aktualność dla preparatu.</p><button class="text-button" data-action="manual-regimen">Edytuj schemat ręcznie</button></details>` : ''}</fieldset>` : ''}</section>`;
}

function resultPanel(f) {
  if (!productReady()) return `<aside class="result-column" id="result" aria-label="Wynik obliczenia"><div class="empty-workflow">${icon('calc')}<h2>Od wyboru do wyniku</h2><p>${isVeterinary() && !state.species ? 'Wybierz gatunek, a następnie preparat.' : ui.productChosen ? 'Wybierz postać i moc preparatu.' : 'Wybierz preparat z katalogu lub ulubionych.'}</p><small>Obliczenie i zapis pojawią się tutaj.</small></div></aside>`;
  if (isReference(f)) return `<aside class="result-column" id="result"><div class="empty-workflow reference-result">${icon('book')}<h2>Karta informacyjna</h2><p>${esc(f.marketStatusLabel || f.calculationNote || 'Dokumentacja tej postaci wymaga osobnej weryfikacji przed zastosowaniem.')}</p><small>Ta pozycja nie uzupełnia dawki ani recepty.</small></div></aside>`;
  return `<aside class="result-column" id="result" aria-label="Wynik obliczenia"><div class="result-card"><div class="result-top"><div class="result-title">Twoje wyliczenie <span class="live-tag">Na żywo</span></div><div class="dose-output"><span class="number" id="dose-value">—</span><span class="unit" id="dose-unit">${esc(f.unitLabel)}</span></div><p class="frequency-output" id="frequency-output">Uzupełnij schemat podawania</p><div class="dose-equivalent" id="dose-equivalent">Wynik pojawi się automatycznie.</div></div><div class="result-body"><div class="safety-heading"><span>Kontrola dawki</span><span class="status-badge" id="status-badge">${icon('info')} Oczekuje na dane</span></div><div class="dose-meter" id="dose-meter"><span style="width:0%"></span></div><div class="limit-text" id="limit-text"><span>Dawka dobowa</span><span>—</span></div><div class="result-alerts" id="result-alerts"></div><div class="result-review" id="result-review"></div><div class="supply-box"><div class="supply-head">${icon('box')}<span>${state.regimenId ? 'Na wybrany etap' : 'Na całą kurację'}</span><span id="total-units">—</span></div><div class="package-result" id="package-result">— opakowań</div><div class="package-description" id="package-description">Wybierz opakowanie preparatu</div>${!state.custom && f.packOptions.length > 1 ? `<select class="package-select" id="packageId" data-field="packageId" aria-label="Wielkość opakowania">${f.packOptions.map(p => `<option value="${p.id}" ${p.id === state.packageId ? 'selected' : ''}>Opakowanie: ${esc(p.label)}</option>`).join('')}</select>` : ''}<div id="best-package"></div></div><div class="rx-section"><div class="rx-heading"><h3>${isVeterinary() ? 'Zalecenia do dokumentacji' : 'Zapis do dokumentacji'}</h3><div class="rx-tabs"><button data-action="rx-mode" data-value="full" class="${state.rxMode === 'full' ? 'active' : ''}" aria-pressed="${state.rxMode === 'full'}">${isVeterinary() || isInstruction(f) || ['device','cosmetic'].includes(f.productKind) ? 'Preparat + D.S.' : 'Rp. + D.S.'}</button><button data-action="rx-mode" data-value="ds" class="${state.rxMode === 'ds' ? 'active' : ''}" aria-pressed="${state.rxMode === 'ds'}">Tylko D.S.</button></div></div><pre class="rx-preview placeholder" id="rx-preview">Wprowadź schemat i wymagane dane, aby przygotować zapis.</pre></div><label class="confirm-row"><input id="confirmed" type="checkbox" ${state.confirmed ? 'checked' : ''}><span>${isVeterinary() ? 'Potwierdzam jako lekarz weterynarii wskazanie, etap, drogę podania i schemat dla tego pacjenta. Sprawdziłem przeciwwskazania, inne leki i aktualną dokumentację preparatu.' : 'Potwierdzam dobór preparatu i schemat w aktualnej dokumentacji dla tego pacjenta.'}</span></label><button class="copy-button" id="copy-button" data-action="copy" disabled>${icon('copy')}Kopiuj dawkowanie</button><p class="copy-caption" id="result-requirements">Uzupełnij dane i potwierdź schemat.</p></div></div><p class="result-footnote">${icon('shield')}Kalkulator wspiera przeliczenie i odczyt instrukcji. Nie ocenia wszystkich przeciwwskazań ani interakcji.</p></aside>`;
}

function specialtyPicker() {
  return `<div class="field specialty-field"><label for="specialty">Specjalizacja</label><select id="specialty" data-field="specialty">${SPECIALTIES.map(item => `<option value="${item.id}" data-icon="${item.icon}" ${item.id === state.specialty ? 'selected' : ''}>${item.label}</option>`).join('')}</select></div>`;
}

function render() {
  const previousFocus = document.activeElement;
  const focusId = previousFocus?.id;
  const focusField = previousFocus?.dataset?.selectId || focusId;
  selectMenus.close();
  const focusAction = previousFocus?.dataset?.action, focusValue = previousFocus?.dataset?.value;
  const vet = isVeterinary(), f = getForm();
  syncSourceRegimen();
  $('#app').innerHTML = `
    <aside class="sidebar" aria-label="Nawigacja główna"><a class="brand" href="./" aria-label="RxCalc — strona główna"><span class="brand-mark">Rx</span><span class="brand-word">RxCalc<span class="pro">BETA</span></span></a><p class="nav-label">TWÓJ GABINET</p><nav class="nav"><button class="active" data-action="calculator">${icon('calc')}<span>Kalkulator</span></button><button data-action="favorites">${icon('star')}<span>Ulubione</span><span class="nav-count">${visibleFavorites().length}</span></button><button data-action="tools">${icon('tools')}<span>Narzędzia</span></button></nav><div class="sidebar-bottom"><div class="install-card"><span class="icon-holder">${icon('phone')}</span><h3>Pod ręką.<br>Także offline.</h3><p>Dodaj RxCalc do ekranu głównego telefonu.</p><button data-action="install">Dodaj aplikację ${icon('arrow')}</button></div><div class="sidebar-meta"><span class="dot"></span>RxCalc <span style="margin-left:auto">v1.0 beta</span></div></div></aside>
    <div class="workspace"><header class="topbar"><div class="topbar-title">Twój gabinet ${icon('arrow')} <strong>Kalkulator dawkowania</strong></div><a href="./" class="brand mobile-brand" aria-label="RxCalc — strona główna"><span class="brand-mark">Rx</span><span class="brand-word">RxCalc</span></a><div class="topbar-actions"><span class="online-status" id="online-status"><span class="dot"></span><span id="connection-text">Obliczenia na urządzeniu</span></span><button class="icon-button mobile-tools" data-action="tools" aria-label="Narzędzia" title="Narzędzia">${icon('tools')}</button><button class="icon-button" data-action="theme" aria-label="Zmień motyw" title="Zmień motyw">${icon(theme === 'dark' ? 'sun' : 'moon')}</button><button class="new-patient" data-action="reset" aria-label="Nowy pacjent — wyczyść parametry i schemat" title="Nowy pacjent — wyczyść parametry i schemat">${icon('plus')}<span>Nowy pacjent</span></button></div></header>
      <main id="main"><div id="update-slot"></div><section class="context-bar" aria-label="Profil pracy"><div class="context-heading"><h1>Kalkulator dawkowania</h1><span>${icon('lock')} Dane pacjenta pozostają w tej karcie</span></div><div class="context-selectors">${specialtyPicker()}${vet ? `<div class="field"><label for="species">Gatunek zwierzęcia</label><select id="species" data-field="species" required><option value="">Wybierz gatunek</option>${ANIMALS.map(a => `<option value="${a.id}" ${state.species === a.id ? 'selected' : ''}>${a.label}</option>`).join('')}</select></div>` : state.specialty === 'dental' ? `<div class="patient-type"><div class="field-label">Grupa pacjenta</div><div class="segmented patient-segmented" data-patient-type="${state.patientType}" role="group" aria-label="Grupa pacjenta"><span class="patient-type-thumb" aria-hidden="true"></span><button data-action="patient-type" data-value="adult" class="${state.patientType === 'adult' ? 'active' : ''}" aria-pressed="${state.patientType === 'adult'}">Dorosły</button><button data-action="patient-type" data-value="child" class="${state.patientType === 'child' ? 'active' : ''}" aria-pressed="${state.patientType === 'child'}">Dziecko</button></div></div>` : ''}</div></section><div class="clinical-note">${icon('info')}<span>${state.demo ? '<strong>Przykład arytmetyczny.</strong> Dane demonstracyjne; kopiowanie wyłączone.' : vet ? 'Wskazanie i schemat potwierdza lekarz weterynarii w aktualnej dokumentacji.' : 'Schemat ustala lekarz. Potwierdź go w aktualnej ChPL.'}</span><button data-action="about">Zakres kalkulatora</button></div>
      <div class="calculator-grid"><div class="left-stack"><section class="panel product-panel" aria-labelledby="drug-title"><div class="section-heading"><span class="step-number">01</span><h2 id="drug-title">${ui.productChosen ? 'Wybrany preparat' : 'Wybierz preparat'}</h2><span class="trailing">${vet && !state.species ? '' : `${getSpeciesCatalogue().length} w katalogu`}</span></div>${productPicker(f)}</section>${regimenPanel(f)}${productReady() ? `<div class="source-row">${icon('book')}<span>${f.sourceUrl ? `<a href="${esc(f.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(f.sourceLabel)} ↗</a> · ` : ''}<button data-action="source" class="text-button">Uwagi do preparatu</button><br>${state.custom ? 'Dane preparatu wprowadzone ręcznie.' : `Dane katalogowe: ${esc(f.sourceCheckedAt || CATALOGUE_META.sourceCheckedAt)}.`}</span></div>` : ''}</div>${resultPanel(f)}</div><footer class="page-footer"><span>RxCalc · podręczny kalkulator dawkowania</span><div class="footer-links">${!vet ? '<button data-action="example">Przykład obliczenia</button>' : ''}<button data-action="favorites">Ulubione</button><button data-action="install">Zainstaluj</button><button data-action="about">O aplikacji</button></div></footer></main></div><div class="mobile-action-bar" id="mobile-action-bar" ${!productReady() || isReference(f) ? 'hidden' : ''}><button class="mobile-action-summary" data-action="result" aria-label="Przejdź do podsumowania obliczenia"><small id="mobile-action-label">Sprawdź wynik</small><strong id="mobile-action-value">Uzupełnij dane</strong></button><button class="copy-button" id="mobile-copy" data-action="copy" disabled>${icon('copy')}Kopiuj</button></div>`;
  selectMenus.enhance($('#app'));
  renderDrugs(); updateResult(); updateConnection(); showUpdate();
  copyObserver?.disconnect();
  if ('IntersectionObserver' in window && $('#copy-button')) {
    copyObserver = new IntersectionObserver(entries => {
      $('#mobile-action-bar')?.classList.toggle('inline-copy-visible', entries[0].intersectionRatio >= 0.95);
    }, { threshold:[0,0.95,1] });
    copyObserver.observe($('#copy-button'));
  }
  $('#app').querySelectorAll('details[data-disclosure]').forEach(el => el.addEventListener('toggle', () => { if(el.isConnected) ui[el.dataset.disclosure] = el.open; }));
  let nextFocus = focusId ? document.getElementById(focusId) : null;
  if(!nextFocus && focusAction) nextFocus = [...$('#app').querySelectorAll('[data-action]')].find(el => el.dataset.action === focusAction && el.dataset.value === focusValue);
  if(!nextFocus && ['drug','form','product','favorite-select'].includes(focusAction)) nextFocus = $('[data-action="edit-product"]');
  if(!nextFocus && ['formId','productVariant'].includes(focusField)) nextFocus = $('[data-action="edit-product"]');
  if(!nextFocus && focusField === 'regimenId') nextFocus = $('[data-action="edit-regimen"]');
  if(nextFocus && previousFocus !== document.body) {
    if(nextFocus.tagName === 'SELECT') selectMenus.focus(nextFocus.id);
    else nextFocus.focus({preventScroll:true});
  }
}

function productPicker(f) {
  const vet = isVeterinary(), catalogue = getCatalogue();
  if (vet && !state.species) return `<div class="empty-search">${icon('paw')}<p>Wybierz gatunek zwierzęcia powyżej.<br>Pokażemy preparaty przypisane do tego gatunku.</p></div>`;
  if (state.custom && ui.productChosen) return `${customFields()}<button class="custom-trigger" data-action="custom">${icon('book')}Wróć do katalogu preparatów</button>`;
  const drug = getDrug(), routes = [...new Set(getSpeciesCatalogue().flatMap(d => d.forms.map(x => x.routeCode)))].filter(code => ROUTES[code]);
  const categories = (CATEGORIES[state.specialty] || []).filter(c => catalogue.some(d => d.category === c.id));
  const expanded = ui.productExpanded || !ui.productChosen;
  const summary = ui.productChosen && drug ? `<div class="product-summary"><div class="selection-copy"><strong>${esc(ui.formChosen ? f.label : drug.name)}</strong><small>${ui.formChosen ? `${esc(shortForm(f))}${f.routeLabel ? ` · ${esc(f.routeLabel)}` : ''} · <span id="selected-package">${esc(currentPackage(f).label)}</span>` : 'Wybierz konkretny preparat i opakowanie poniżej'}</small>${ui.formChosen && (productKindLabel(f) || f.marketStatusLabel) ? `<span class="product-classification">${esc([productKindLabel(f),f.marketStatusLabel].filter(Boolean).join(' · '))}</span>` : ''}</div><button class="text-button" data-action="edit-product" aria-expanded="${expanded}">${expanded ? 'Zamknij wybór' : 'Zmień'}</button><button class="favorite-button ${favoriteIds.includes(state.drugId) ? 'saved' : ''}" data-action="favorite" aria-pressed="${favoriteIds.includes(state.drugId)}" aria-label="${favoriteIds.includes(state.drugId) ? 'Usuń preparat z ulubionych' : 'Dodaj preparat do ulubionych'}">${icon('star')}<span>${favoriteIds.includes(state.drugId) ? 'Zapisany' : 'Zapisz'}</span></button></div>` : '';
  const picker = expanded ? `<div class="picker-toolbar"><div class="search-wrap">${icon('search')}<input id="search" type="search" value="${esc(state.search)}" placeholder="Substancja, nazwa lub moc…" aria-label="Szukaj preparatu" autocomplete="off"></div><button class="filter-toggle" data-action="filters" aria-expanded="${ui.filtersOpen}" aria-controls="picker-filters">${icon('settings')}Filtry${state.category !== 'all' || state.routeFilter !== 'all' ? ' •' : ''}</button></div><div class="picker-filters" id="picker-filters" ${ui.filtersOpen ? '' : 'hidden'}><div class="categories" aria-label="Kategorie"><button class="${state.category === 'all' ? 'active' : ''}" data-action="category" data-value="all" aria-pressed="${state.category === 'all'}">Wszystkie</button>${categories.map(c => `<button class="${state.category === c.id ? 'active' : ''}" data-action="category" data-value="${c.id}" aria-pressed="${state.category === c.id}">${c.label}</button>`).join('')}</div>${vet && routes.length > 1 ? `<div class="route-filters" role="group" aria-label="Droga podania"><span>Podanie</span><button data-action="route" data-value="all" class="${state.routeFilter === 'all' ? 'active' : ''}">Każda droga</button>${routes.map(code => `<button data-action="route" data-value="${code}" class="${state.routeFilter === code ? 'active' : ''}">${ROUTES[code]}</button>`).join('')}</div>` : ''}</div><div id="favorites-inline"></div><div class="catalogue-heading" id="catalogue-heading"></div><div class="drug-list" id="drug-list"></div><div id="catalogue-more"></div>` : '';
  let variants = '';
  if (ui.productChosen && drug && (!ui.formChosen || expanded)) {
    if (state.specialty === 'dental') {
      const options = catalogueProducts([drug]);
      variants = `<div class="form-selection"><div class="field"><label for="productVariant">Preparat, moc i opakowanie</label><select id="productVariant" data-field="productVariant"><option value="">Wybierz konkretny wariant…</option>${options.map(row => `<option value="${esc(row.key)}" ${ui.formChosen && row.form.id === state.formId && row.pack.id === state.packageId ? 'selected' : ''}>${esc(row.form.label)} · ${esc(row.pack.label)}</option>`).join('')}</select></div><p class="small-help">Wielkości opakowań według dokumentacji. Dostępność w aptece nie jest sprawdzana.</p></div>`;
    } else if (drug.forms.length > 1) {
      variants = `<div class="form-selection"><div class="selected-label"><span>Postać i moc preparatu</span></div>${drug.forms.length <= 3 ? `<div class="form-chips">${drug.forms.map(x => `<button class="${ui.formChosen && x.id === f.id ? 'active' : ''}" data-action="form" data-value="${x.id}">${esc(x.label)}</button>`).join('')}</div>` : `<div class="field variant-select"><label for="formId">Wybierz wariant</label><select id="formId" data-field="formId"><option value="">Wybierz postać i moc…</option>${drug.forms.map(x => `<option value="${esc(x.id)}" ${ui.formChosen && x.id === f.id ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>`}</div>`;
    }
  }
  const reference = productReady() && isReference(f) ? `<div class="catalogue-notice reference-only">${icon('info')}<div><strong>Karta informacyjna · bez dawkowania</strong><p>${esc(f.calculationNote || f.marketStatusLabel)}</p><a href="${esc(f.sourceUrl)}" target="_blank" rel="noopener noreferrer">Otwórz źródło preparatu ↗</a></div></div>` : '';
  const custom = expanded || vet && f?.calculationBlocked && ui.productChosen ? `<button class="custom-trigger" data-action="custom">${icon('plus')}${vet && f?.calculationBlocked && ui.productChosen ? 'Wprowadź przygotowany roztwór ręcznie' : 'Nie ma preparatu? Wprowadź własny'}</button>` : '';
  return summary + picker + variants + reference + custom;
}

function customFields() {
  const liquid = ['suspension','solution','injection','drops'].includes(state.customForm);
  const oralMass = ['oralPaste','oralPowder','oralGel'].includes(state.customForm);
  return `<div class="custom-fields"><div class="field full"><label for="customName">Nazwa i moc preparatu</label><input id="customName" data-field="customName" value="${esc(state.customName)}" placeholder="Pełna nazwa, moc i postać" maxlength="160" autocomplete="off"></div><div class="field full"><label for="customForm">Postać leku</label><select id="customForm" data-field="customForm">${Object.entries(forms).filter(([id]) => isVeterinary() || !['oralPaste','oralPowder','oralGel'].includes(id)).map(([id,[label]]) => `<option value="${id}" ${id === state.customForm ? 'selected' : ''}>${label}</option>`).join('')}</select></div>${liquid ? `${field('customConcentration', 'Substancja w stężeniu', state.customConcentration, 'np. 400', 'mg')}${field('customVolume', 'W objętości', state.customVolume, 'np. 5', 'ml')}` : field('customStrength', oralMass ? 'Substancja w 1 g preparatu' : ['tablet','capsule'].includes(state.customForm) ? 'Moc 1 tabletki / kapsułki' : 'Substancja w 1 jednostce (opcjonalnie)', state.customStrength, oralMass ? 'Z dokumentacji produktu' : 'np. 500', oralMass ? 'mg/g' : 'mg')}${field('customPack', state.customForm === 'injection' ? 'Objętość 1 ampułki / strzykawki' : 'Wielkość opakowania', state.customPack, state.customForm === 'injection' ? 'np. 1' : 'np. 20', forms[state.customForm][1])}${state.customForm === 'injection' ? field('customContainers','Ampułek w opakowaniu',state.customContainers,'np. 10','szt.') : ''}${state.customForm === 'drops' ? field('customDrops','Kalibracja preparatu',state.customDrops,'Z ChPL','kropli/ml') : ''}${state.customForm === 'tablet' ? `<div class="field full"><label for="customFractions">Podzielność potwierdzona w ChPL</label><select id="customFractions" data-field="customFractions"><option value="1" ${state.customFractions==='1'?'selected':''}>Tylko cała tabletka / kapsułka</option><option value="1,0.5" ${state.customFractions==='1,0.5'?'selected':''}>Cała tabletka lub połowa</option><option value="1,0.25,0.5,0.75" ${state.customFractions==='1,0.25,0.5,0.75'?'selected':''}>Podział na ćwiartki</option></select></div>` : ''}${isVeterinary() ? `<div class="field full"><label for="vetRoute">Droga podania (wymagana)</label><input id="vetRoute" data-field="vetRoute" value="${esc(state.vetRoute)}" placeholder="Np. doustnie" maxlength="100" autocomplete="off" required></div>` : ''}</div><p class="small-help">${isVeterinary() ? 'Wprowadź dane z odpowiedniego źródła weterynaryjnego. Schemat i stężenie nie są dobierane automatycznie.' : 'Wprowadź dane dokładnie z ChPL.'} Dla pasty, żelu i granulatu doustnego podaj mg substancji w 1 g całego preparatu, a opakowanie w gramach preparatu. Dla kropli opakowanie podaj w liczbie kropli. Dla aerozolu — w liczbie dozowanych rozpyleń. Dla postaci „Iniekcja” ampułki / ampułkostrzykawki są jednorazowe; pozostałość po podaniu jest odrzucana.</p>`;
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
  node.classList.toggle('exact-products', !!query);
  if (query) {
    const products = searchProducts(getCatalogue().filter(d => state.category === 'all' || d.category === state.category), state.search);
    const shown = products.slice(0,ui.showAll ? products.length : 8);
    node.hidden = false;
    $('#favorites-inline').innerHTML = '';
    $('#catalogue-heading').textContent = `${products.length} ${variantUnit(products.length)} · preparat, moc i opakowanie`;
    node.innerHTML = shown.length ? shown.map(row => `<button class="drug-card product-hit" data-action="product" data-value="${esc(row.key)}"><span class="drug-icon">${icon(row.form.form === 'tablet' ? 'pill' : 'bottle')}</span><span class="product-hit-copy"><span class="drug-name">${esc(row.form.label)}</span><span class="product-pack">${esc(row.pack.label)}</span><span class="drug-description">${esc(row.drug.substanceLabel || row.drug.substance)}${isReference(row.form) ? ' · karta informacyjna' : productKindLabel(row.form) ? ` · ${esc(productKindLabel(row.form))}` : ''}</span></span><span class="product-hit-arrow">${icon(isReference(row.form) ? 'book' : 'arrow')}</span></button>`).join('') : '<div class="empty-search">Nie znaleziono takiego wariantu.<br>Wpisz nazwę, substancję lub moc.</div>';
    $('#catalogue-more').innerHTML = products.length > 8 ? `<button class="show-more" data-action="browse-catalogue" aria-expanded="${ui.showAll}">${ui.showAll ? 'Pokaż mniej' : `Pozostałe warianty (${products.length - 8})`} ${icon('down')}</button>` : '';
    return;
  }
  const filtering = !!query || state.category !== 'all' || state.routeFilter !== 'all';
  const list = getCatalogue().filter(d => (state.category === 'all' || d.category === state.category) && normalize([d.name,d.substance,d.substanceLabel,...d.searchTerms,...d.forms.flatMap(f => [f.label,f.routeLabel])].join(' ')).includes(query));
  const favorites = !filtering && !ui.showAll ? visibleFavorites() : [];
  $('#favorites-inline').innerHTML = favorites.length ? `<div class="catalogue-heading"><span>${icon('star')} Twoje ulubione</span>${favorites.length > 4 ? '<button class="text-button" data-action="favorites">Wszystkie ulubione</button>' : ''}</div><div class="favorite-shortcuts">${favorites.slice(0,4).map(d => `<button data-action="favorite-select" data-value="${esc(d.id)}"><strong>${esc(d.name)}</strong><small>${d.forms.length === 1 ? esc(d.forms[0].label) : `${d.forms.length} warianty`}</small></button>`).join('')}</div>` : '';
  const shown = favorites.length ? [] : list.slice(0, filtering || ui.showAll ? list.length : 6);
  node.hidden = favorites.length > 0;
  $('#catalogue-heading').textContent = favorites.length ? '' : filtering ? `${list.length} ${list.length === 1 ? 'wynik' : list.length % 10 >= 2 && list.length % 10 <= 4 && (list.length % 100 < 12 || list.length % 100 > 14) ? 'wyniki' : 'wyników'}` : list.length && list.every(d => d.forms.every(f => f.calculationBlocked)) ? 'Karty informacyjne' : 'Katalog preparatów';
  node.innerHTML = shown.length ? shown.map(d => `<button class="drug-card ${ui.productChosen && d.id === state.drugId ? 'selected' : ''}" data-action="drug" data-value="${esc(d.id)}" aria-pressed="${ui.productChosen && d.id === state.drugId}"><span class="drug-icon">${icon(d.forms[0].form === 'tablet' ? 'pill' : 'bottle')}</span><span><span class="drug-name">${esc(d.name)}</span><span class="drug-description">${esc(isVeterinary() ? d.substanceLabel || d.substance : d.forms[0].label.split(' · ')[0])} · ${isReference(d.forms[0]) ? 'karta informacyjna' : d.forms.length === 1 ? shortForm(d.forms[0]) : `${d.forms.length} warianty`}${isVeterinary() && d.forms[0].routeCode === 'iv' ? ' · dożylnie' : ''}</span></span><span class="drug-check">${ui.productChosen && d.id === state.drugId ? icon('check') : ''}</span></button>`).join('') : favorites.length ? '' : '<div class="empty-search">Nie znaleziono preparatu.<br>Zmień wyszukiwanie lub filtry.</div>';
  $('#catalogue-more').innerHTML = !filtering && (favorites.length || list.length > 6 || ui.showAll && visibleFavorites().length) ? `<button class="show-more" data-action="browse-catalogue" aria-expanded="${ui.showAll}">${ui.showAll ? 'Zwiń katalog' : favorites.length ? `Pokaż cały katalog (${list.length})` : `Pokaż wszystkie (${list.length})`} ${icon('down')}</button>` : '';
}
function shortForm(f) { return f.shortFormLabel || ({tablet:'tabletki',suspension:'zawiesina',oralPaste:'pasta doustna',oralGel:'żel doustny',oralPowder:'granulat doustny',spray:'aerozol',solution:'roztwór',gel:'żel',drops:'krople',injection:'iniekcja'})[f.form] || f.form; }
function applicableLimit(f) {
  const age=isVeterinary()?num(state.age):humanAgeYears(),weight=num(state.weight);
  let rule=(f.conditionalLimits||[]).find(r => {
    const tests=[['minAge','age',v=>age>=v],['minAgeExclusive','age',v=>age>v],['maxAge','age',v=>age<=v],['minWeight','weight',v=>weight>=v],['minWeightExclusive','weight',v=>weight>v],['maxWeight','weight',v=>weight<=v]];
    return tests.every(([key,param,test]) => r[key] == null || (Number.isFinite(param==='age'?age:weight) && test(r[key])));
  });
  const humanSource = !isVeterinary() && getSourceRegimen() ? resolveHumanRegimen(getSourceRegimen(),humanContext()) : null;
  const strictest = values => values.filter(v => Number.isFinite(v) && v > 0).length ? Math.min(...values.filter(v => Number.isFinite(v) && v > 0)) : null;
  const fromSource=strictest([rule?.maxDailyMg,f.maxDailyMg,humanSource?.maxDailyMg]);
  const manual=num(state.manualMax);
  return { daily: manual===null ? fromSource : fromSource===null ? manual : Math.min(manual,fromSource), single:strictest([rule?.maxSingleMg,f.maxSingleMg,humanSource?.maxSingleMg]), label:manual!==null ? 'Limit wprowadzony przez lekarza (nie wyższy od dostępnego limitu źródłowego)' : humanSource?.limitLabel || rule?.label || 'Limit z danych preparatu' };
}
function makeInput(packageOverride) {
  const f=getForm(), limit=applicableLimit(f), pack=packageOverride||f.packOptions.find(p=>p.id===state.packageId)||f.packOptions[0];
  return { patientKind:isVeterinary()?'animal':'human',calculationBlocked:isReference(f),species:isVeterinary()?state.species:undefined,form:f.form,doseMode:state.doseMode,dose:num(state.dose),weight:num(state.weight),age:isVeterinary()&&num(state.age)!==null?num(state.age)*({years:1,months:1/12,weeks:7/365,days:1/365}[state.vetAgeUnit]||1):humanAgeYears(),frequency:num(state.frequency),days:num(state.days),strengthMg:f.strengthMg??null,concentrationMg:f.concentrationMg??null,concentrationMl:f.concentrationMl??null,unitLabel:f.unitLabel,packageSize:pack.quantity,roundingStep:num(state.roundingStep),allowedFractions:f.allowedFractions??null,maxDailyMg:limit.daily,maxSingleMg:limit.single,minAge:f.minAge??null,shelfLifeDays:f.shelfLifeDays??null,dropsPerMl:f.dropsPerMl??null,singleUseUnitSize:f.singleUseUnitSize??null,doseBasisIngredient:f.doseBasisIngredient,doseStepUnits:f.doseStepUnits??null,foodChainStatus:state.foodChainStatus,injectionContainerUse:f.injectionContainerUse,maxWithdrawalsPerVial:f.maxWithdrawalsPerVial,discardRemainderAfterUse:f.discardRemainderAfterUse,...(Object.hasOwn(f,'requiresFoodChainExclusion')?{requiresFoodChainExclusion:f.requiresFoodChainExclusion}:{}) };
}
function updateInstructionResult(check) {
  const f=getForm(),source=getSourceRegimen(),pack=currentPackage(f),count=num(state.instructionPacks);
  const r={valid:!!source&&!!check?.valid,errors:[...(check?.errors||[])],warnings:[...(check?.warnings||[])],status:'incomplete'};
  if(count!==null && (!Number.isInteger(count)||count<=0||count>10000)) {r.valid=false;r.errors.push('Liczba opakowań musi być dodatnią liczbą całkowitą.');}
  r.status=r.valid?'warning':'incomplete';
  latest=r;
  const ds=source?instructionDosingText({source,frequency:num(state.frequency),days:num(state.days),extraInstructions:state.extraInstructions}):'';
  const context=source?`Wskazanie: ${source.indication}.\n`:'';
  latestText=r.valid?(state.rxMode==='ds'?context+ds:`${context}Preparat: ${f.label}\n${productKindLabel(f)}\nOpakowanie: ${pack.label}${count!==null?`\nIlość: ${n(count)} op. — ustalona przez lekarza`:''}\n${ds}`):'';
  $('#dose-value').textContent=source?'Instrukcja':'—';
  $('#dose-value').classList.add('instruction-number');
  $('#dose-unit').textContent='';
  $('#frequency-output').textContent=source?(state.frequency!==''?`${source.asNeeded?'W razie potrzeby, do ':''}${n(num(state.frequency))} × na dobę${state.days!==''?` · ${n(num(state.days))} dni`:''}`:source.professionalUse?'Procedura stomatologiczna':'Stosowanie według instrukcji źródłowej'):'Wybierz właściwy schemat';
  $('#dose-equivalent').textContent=source?.instructionText||'Instrukcja pojawi się po wyborze wskazania.';
  $('#dose-equivalent').classList.add('instruction-equivalent');
  $('#dose-meter').hidden=true;
  const badge=$('#status-badge');badge.className='status-badge';badge.innerHTML=icon('info')+(r.valid?'Instrukcja ze źródła':source?'Uzupełnij kontekst':'Wybierz schemat');
  $('#limit-text').innerHTML=`<span class="instruction-limit">${esc(source?.limitLabel||'Dla tej postaci nie wyliczamy dawki z umownej masy porcji.')}</span>`;
  $('#result-alerts').innerHTML=[...new Set(r.errors)].map(message=>`<div class="alert neutral">${icon('info')}<span>${esc(message)}</span></div>`).join('')+r.warnings.map(message=>`<div class="alert warning">${icon('info')}<span>${esc(message)}</span></div>`).join('');
  const review=[['Preparat',f.label],['Rodzaj',productKindLabel(f)||'Preparat miejscowy'],['Wskazanie',source?.indication||'Wybierz schemat'],['Sposób podania',f.routeLabel||'Według instrukcji']];
  if(source?.professionalUse||f.professionalUse)review.push(['Aplikacja','Procedura gabinetowa · wykonuje stomatolog']);
  $('#result-review').innerHTML=`<h3>Sprawdź przed skopiowaniem</h3><dl>${review.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
  $('#total-units').textContent='Bez szacowania zużycia';
  $('#package-result').textContent=count!==null&&Number.isInteger(count)&&count>0?`${n(count)} op. × ${pack.label}`:pack.label;
  $('#package-description').textContent=count!==null?'Liczba opakowań wpisana przez lekarza.':'Liczbę opakowań można wpisać przy instrukcji. Nie obliczamy jej z długości paska, kropli ani liczby kieszonek.';
  $('#best-package').innerHTML='';
  if($('#selected-package'))$('#selected-package').textContent=pack.label;
  $('#rx-preview').textContent=r.valid?latestText:source?'Uzupełnij wskazane dane, aby przygotować instrukcję.':'Wybierz schemat źródłowy, aby przygotować instrukcję.';
  $('#rx-preview').classList.toggle('placeholder',!r.valid);
  const confirmed=$('#confirmed');confirmed.checked=state.confirmed;confirmed.disabled=!r.valid||state.demo;
  $('#copy-button').disabled=!r.valid||!state.confirmed||state.demo;
  $('#copy-button').innerHTML=`${icon('copy')}Kopiuj zalecenia`;
  $('#result-requirements').textContent=!r.valid?'Uzupełnij kontekst i sprawdź ograniczenia.':!state.confirmed?'Potwierdź zgodność instrukcji z pacjentem i dokumentacją.':'Gotowe do skopiowania.';
  if($('#mobile-copy'))$('#mobile-copy').disabled=!r.valid||!state.confirmed||state.demo;
  if($('#mobile-action-value'))$('#mobile-action-value').textContent=r.valid?'Instrukcja gotowa':'Sprawdź instrukcję';
  if($('#mobile-action-label'))$('#mobile-action-label').textContent='Zalecenia do dokumentacji';
}

function updateResult() {
  try { updateResultContent(); } finally { selectMenus.refresh(); }
}
function updateResultContent() {
  if(!productReady() || !$('#dose-value')) {
    latest=null;latestText='';state.confirmed=false;
    if($('#mobile-copy')) $('#mobile-copy').disabled=true;
    return;
  }
  const sourceCheck=syncSourceRegimen();
  if(isInstruction(getForm())) { updateInstructionResult(sourceCheck); return; }
  const f=getForm(),input=makeInput(),r=calculate(input),limit=applicableLimit(f);
  if(sourceCheck){r.errors.push(...sourceCheck.errors);r.warnings.push(...sourceCheck.warnings);if(!sourceCheck.valid){r.valid=false;if(r.status!=='critical')r.status='incomplete';}}
  if(sourceCheck && !isVeterinary()) {
    if(sourceCheck.maxUnitsPerDose != null && r.singleUnits > sourceCheck.maxUnitsPerDose + 1e-9) { r.errors.push('Ilość na podanie przekracza limit tego schematu.');r.valid=false;r.status='critical'; }
    if(sourceCheck.maxDailyUnits != null && r.dailyUnits > sourceCheck.maxDailyUnits + 1e-9) { r.errors.push('Dobowa ilość preparatu przekracza limit tego schematu.');r.valid=false;r.status='critical'; }
  }
  const sourceApplicable=!sourceCheck||sourceCheck.valid;
  if(state.custom && !state.customName.trim() && r.valid){r.valid=false;r.status='incomplete';r.errors.push('Wprowadź pełną nazwę, moc i postać preparatu.');}
  if(isVeterinary() && r.valid && !f.routeLabel?.trim()){r.valid=false;r.status='incomplete';r.errors.push('Uzupełnij drogę podania preparatu.');}
  if(!isVeterinary() && f.form==='injection' && r.valid && !state.extraInstructions.trim()){r.valid=false;r.status='incomplete';r.errors.push('Uzupełnij drogę i sposób podania w szczegółach schematu.');}
  latest=r;
  if($('#source-dose-value')) $('#source-dose-value').textContent=state.dose !== '' ? `${n(num(state.dose),10)} ${doseUnit()}` : 'Po uzupełnieniu danych';
  if($('#source-frequency-value')) $('#source-frequency-value').textContent=state.frequency !== '' ? `${n(num(state.frequency))} × na dobę` : '—';
  const quantitiesAvailable=sourceApplicable&&!(f.doseStepUnits>0&&!r.valid);
  const hasResult=r.singleUnits!==null&&quantitiesAvailable;
  const divisions=deviceDivisions(r,f);
  $('#dose-value').textContent=hasResult?n(divisions??r.singleUnits,isVeterinary()?10:6):'—';
  $('#dose-value').classList.toggle('compact-number', $('#dose-value').textContent.length > 9);
  $('#dose-unit').textContent=divisions!==null?divisionUnit(divisions):f.unitLabel;
  $('#frequency-output').textContent=hasResult?`${getSourceRegimen()?.asNeeded ? 'Doraźnie, do ' : ''}${n(input.frequency)} × na dobę · przez ${n(input.days)} ${input.days===1?'dzień':'dni'}`:'Uzupełnij schemat podawania';
  let equivalent=hasResult?(r.singleMg!==null?`${n(r.singleMg,4)} mg${f.doseBasisIngredient?' '+f.doseBasisIngredient:''} na podanie`:`Ilość preparatu na jedno podanie`):'Dawka, częstotliwość i czas stosowania.';
  if(f.ingredients && hasResult) equivalent+=` · ${n(r.singleUnits*f.ingredients[1].amountMg/f.ingredients[1].perMl,3)} mg kw. klawulanowego`;
  if(hasResult && f.activeIngredients?.length>1) equivalent+=' · '+f.activeIngredients.slice(1).map(i=>`${n(r.singleUnits*i.strengthMg,4)} mg (${i.substanceLabel})`).join(' · ');
  if(divisions!==null) equivalent+=` · około ${n(r.singleUnits,6)} ${f.unitLabel} preparatu · ${f.doseStepLabel || 'podziałka przyrządu'}`;
  if(hasResult && input.weight > 0 && r.dailyMg !== null && !isVeterinary()) equivalent+=` · ${n(r.dailyMg/input.weight,3)} mg/kg/dobę${f.doseBasisIngredient ? ` ${f.doseBasisIngredient}` : ''}`;
  $('#dose-equivalent').textContent=equivalent;
  const showStatus=!!state.regimenId||hasResult||r.status==='critical';
  const badge=$('#status-badge'); badge.className=`status-badge ${showStatus?r.status:''}`;
  badge.innerHTML=icon(r.status==='critical'?'alert':r.status==='ok'?'check':'info')+(showStatus?({ok:'Brak przekroczeń limitów',warning:'Wymaga sprawdzenia',critical:'Sprawdź schemat',incomplete:'Niepełna ocena'})[r.status]:'Oczekuje na dane');
  const meter=$('#dose-meter');meter.className=`dose-meter ${r.status}`;
  meter.firstElementChild.style.width=r.maxRatio!==null?`${Math.min(100,Math.max(0,r.maxRatio*100))}%`:'0%';
  $('#limit-text').innerHTML=`<span>${quantitiesAvailable&&r.dailyMg!==null?`${n(r.dailyMg,3)} mg / dobę`:quantitiesAvailable&&r.dailyUnits!==null?`${n(r.dailyUnits,3)} ${esc(f.unitLabel)} / dobę`:'Dawka dobowa'}</span><span>${limit.daily!==null?`limit ${n(limit.daily)} mg/dobę${sourceCheck?.maxDailyMgPerKg ? ` · ${n(sourceCheck.maxDailyMgPerKg)} mg/kg/dobę` : ''}`:sourceCheck?.maxDailyUnits ? `limit ${n(sourceCheck.maxDailyUnits)} ${esc(f.unitLabel)}/dobę`:'Brak liczbowego limitu'}</span>`;
  $('#limit-text').title=limit.daily!==null?limit.label:'Brak limitu nie oznacza potwierdzenia bezpieczeństwa.';
  const started=!!state.regimenId||f.calculationBlocked||r.status==='critical'||state.dose!==''||state.frequency!==''||state.days!=='';
  let messages=[...r.errors.map(t=>[t,r.status==='critical'?'critical':'neutral']),...r.warnings.map(t=>[t,'warning'])];
  if(hasResult && f.unmodelledShelfLifeMonths && input.days>180)messages.push([`Po otwarciu preparat zachowuje trwałość przez ${f.unmodelledShelfLifeMonths} miesięcy. Wyliczenie opakowań opiera się na pojemności; przy tej długości terapii trzeba je sprawdzić z datami otwarcia i ważności.`, 'warning']);
  const pack=f.packOptions.find(p=>p.id===state.packageId)||f.packOptions[0];
  if($('#selected-package')) $('#selected-package').textContent=pack.label;
  if(hasResult && pack.estimated)messages.push(['Wydajność opakowania jest szacunkowa. Uwzględnij przygotowanie pompki.','warning']);
  if(state.demo)messages.unshift(['Przykład arytmetyczny. Kopiowanie wyłączone — rozpocznij od „Nowy pacjent”.','neutral']);
  if(sourceCheck?.limitLabel) messages.push([sourceCheck.limitLabel,'neutral']);
  $('#result-alerts').innerHTML=started?messages.map(([m,c])=>`<div class="alert ${c}">${icon(c==='critical'?'alert':'info')}<span>${esc(m)}</span></div>`).join(''):'';
  $('#total-units').textContent=quantitiesAvailable&&r.totalUnits!==null?`${n(r.totalUnits,4)} ${f.unitLabel}`:'—';
  $('#package-result').textContent=quantitiesAvailable&&r.packages!==null?`${getSourceRegimen()?.asNeeded ? 'Do ' : ''}${n(r.packages)} op. × ${pack.label}`:'— opakowań';
  $('#package-description').textContent=quantitiesAvailable&&r.leftoverUnits!==null?`${n(r.leftoverUnits,4)} ${f.unitLabel} nadmiaru${r.expiryWasteUnits>0?` · w tym ${n(r.expiryWasteUnits,3)} ${f.unitLabel} po terminie przydatności`:''}`:'Wybierz opakowanie preparatu';
  if(quantitiesAvailable&&r.packages!==null) $('#package-description').textContent+=' '+supplyNote(r,f);
  const alternatives=(quantitiesAvailable?f.packOptions:[]).map(p=>({p,r:calculate(makeInput(p))})).filter(x=>x.r.valid).sort((a,b)=>a.r.leftoverUnits-b.r.leftoverUnits||a.r.packages-b.r.packages);
  const best=alternatives[0];
  $('#best-package').innerHTML=best && best.p.id!==state.packageId && !state.custom?`<button class="best-package" data-action="best-package" data-value="${esc(best.p.id)}">${icon('arrow')}Mniej nadmiaru / opakowań: ${n(best.r.packages)} × ${esc(best.p.label)}</button>`:'';
  latestText=r.valid?prescription(r,f,input):'';
  const preview=$('#rx-preview'); preview.classList.toggle('placeholder',!r.valid);
  preview.textContent=f.calculationBlocked?'Koncentrat wymaga przygotowania. Ta karta nie generuje dawkowania do podania.':r.valid?latestText:(hasResult||(sourceCheck&&!sourceCheck.valid)||r.status==='critical'?'Zapis będzie dostępny po usunięciu wskazanych niezgodności.':'Wprowadź dawkę, częstotliwość i czas stosowania, aby przygotować zapis.');
  $('#copy-button').disabled=!r.valid||!state.confirmed||state.demo;
  const confirmed=$('#confirmed');confirmed.checked=state.confirmed;confirmed.disabled=!r.valid||state.demo;
  const source=getSourceRegimen();
  const review=[['Preparat',state.custom?state.customName||'Uzupełnij nazwę':f.label],['Droga podania',f.routeLabel||(!isVeterinary()&&f.form==='injection'?state.extraInstructions:'Według schematu lekarza')]];
  if(isVeterinary())review.unshift(['Pacjent',`${getAnimal()?.label||'—'} · ${state.weight!==''?`${n(num(state.weight),6)} kg`:'uzupełnij masę'}`]);
  else if(state.age!==''||state.weight!=='')review.push(['Pacjent',[state.age!==''?`${n(num(state.age))} ${({years:'lat',months:'mies.',days:'dni'})[state.humanAgeUnit]}`:'',state.weight!==''?`${n(num(state.weight),6)} kg`:''].filter(Boolean).join(' · ')]);
  if(isVeterinary()&&state.age!=='')review.push(['Wiek',`${n(num(state.age),6)} ${ageUnitLabel()}`]);
  if(source)review.push(['Wskazanie i schemat',[source.indication,source.phaseLabel].filter(Boolean).join(' · ')]);
  else review.push(['Schemat',!ui.manualRegimen&&getAvailableRegimens().length?(isVeterinary()?'Wybierz wskazanie i etap':'Wybierz wskazanie i schemat'):'Wprowadzony ręcznie']);
  if(f.requiresFoodChainExclusion||source?.requiresFoodChainExclusion)review.push(['Paszport',({excluded:'Wykluczony z uboju',notExcluded:'Niewykluczony z uboju',unknown:'Do sprawdzenia'})[state.foodChainStatus]]);
  $('#result-review').innerHTML=`<h3>Sprawdź przed skopiowaniem</h3><dl>${review.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
  $('#result-requirements').textContent=state.demo?'Przykład · kopiowanie wyłączone.':!r.valid?'Uzupełnij dane i usuń wskazane niezgodności.':!state.confirmed?'Potwierdź schemat powyżej, aby skopiować.':'Gotowe do wklejenia w systemie gabinetowym.';
  if($('#mobile-copy'))$('#mobile-copy').disabled=!r.valid||!state.confirmed||state.demo;
  if($('#mobile-action-value'))$('#mobile-action-value').textContent=hasResult?`${n(divisions??r.singleUnits,isVeterinary()?10:6)} ${divisions!==null?divisionUnit(divisions):f.unitLabel}`:r.status==='critical'?'Sprawdź schemat':'Uzupełnij dane';
  if($('#mobile-action-label'))$('#mobile-action-label').textContent=r.valid&&!state.confirmed?'Sprawdź i potwierdź':r.valid?'Zobacz podsumowanie':'Przejdź do wyniku';
  if($('#renal-inline')) {
    const crcl=calculateCrCl({age:humanAgeYears(),sex:state.sex,weight:num(state.weight),creatinine:num(state.creatinine)});
    $('#renal-inline').innerHTML=crcl===null?`${icon('info')}Uzupełnij parametry dorosłego pacjenta, aby oszacować CrCl.`:`${icon('tools')}CrCl (Cockcroft–Gault): <strong>${n(crcl,1)} ml/min</strong><span>· nie dobiera dawki leku</span>`;
  }
}
function prescription(r,f,input) {
  const unit=f.unitLabel==='rozp.'?'rozpyleń':f.unitLabel;
  const source=getSourceRegimen();
  const divisions=deviceDivisions(r,f);
  const amount=divisions!==null?`${n(divisions)} ${divisions===1?'działkę':divisionUnit(divisions)} strzykawki (około ${n(r.singleUnits,6)} ${unit} preparatu)`:`${n(r.singleUnits,isVeterinary()?10:6)} ${unit}`;
  let ds=isVeterinary()?`D.S. Stosować ${amount}${f.routeLabel?' '+f.routeLabel:''}, ${n(input.frequency)} ${input.frequency===1?'raz':'razy'} na dobę przez ${n(input.days)} ${input.days===1?'dzień':'dni'}.`:humanDosingText({source,amount,route:f.routeLabel,frequency:input.frequency,days:input.days,effectiveDailyLimit:input.maxDailyMg,extraInstructions:state.extraInstructions});
  if(divisions!==null && f.doseStepLabel) ds+=` Kalibracja: ${f.doseStepLabel}.`;
  if(isVeterinary()&&source?.administration) ds+=' '+source.administration;
  if(isVeterinary()&&state.extraInstructions.trim()) ds+=' '+state.extraInstructions.trim();
  const context=(isVeterinary()?`Gatunek: ${getAnimal()?.label || '—'}. Masa ciała: ${n(input.weight,6)} kg.${f.requiresFoodChainExclusion?' Status w paszporcie: wykluczony z uboju do spożycia przez ludzi.':''}\n`:'')+(source?`Wskazanie: ${source.indication}.\n${source.phaseLabel?`Schemat: ${source.phaseLabel}.\n`:''}`:'');
  if(state.rxMode==='ds')return context+ds;
  const name=state.custom?state.customName.trim():`${getDrug().substance}\n${f.label}`;
  const pack=f.packOptions.find(p=>p.id===state.packageId)||f.packOptions[0];
  return `${context}${isVeterinary()||['device','cosmetic'].includes(f.productKind)?'Preparat:':'Rp.'} ${name}\n${n(r.packages)} op. po ${pack.label}${source?.asNeeded?'\nZapas odpowiada maksymalnemu planowanemu zużyciu doraźnemu.':''}${supplyNote(r,f)?'\nZapas: '+supplyNote(r,f):''}\n${ds}`;
}
function dirty() { state.confirmed=false; }
function toast(message) { clearTimeout(toastTimer); const el=$('#toast');el.textContent=message;el.classList.add('show');toastTimer=setTimeout(()=>el.classList.remove('show'),3500); }
function openDialog(title,content) {
  selectMenus.close();
  const dialog=$('#dialog');dialog.innerHTML=`<div class="dialog-inner"><div class="dialog-header"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close-dialog" aria-label="Zamknij">${icon('close')}</button></div><div class="dialog-content">${content}</div></div>`;
  selectMenus.enhance(dialog);
  if(!dialog.open)dialog.showModal();
}
function aboutDialog() {
  openDialog('RxCalc. Prosto do wyniku.',`<p>Podręczny kalkulator dla lekarzy, lekarzy dentystów i lekarzy weterynarii. Przelicza <strong>wybrany lub wprowadzony schemat</strong> na ilość preparatu, opakowania i tekst dawkowania. Dla niemierzalnych porcji miejscowych zachowuje instrukcję źródłową bez szacowania gramów.</p><p><strong>Wersja 1.0 beta — do weryfikacji.</strong> Ta wersja nie przeszła pełnej walidacji klinicznej. Nie wybiera leczenia, nie wystawia e-recept w P1 i nie zastępuje oceny lekarza.</p><ul><li>Weterynaria: pies, kot, koń, chomik i szczur. Katalog wybranych preparatów filtruje postaci według gatunku, a lekarz wybiera wskazanie i etap z udokumentowanych schematów lub wprowadza własny schemat. Dane źródłowe nie obejmują wszystkich wskazań i gatunków. Koncentraty wymagające przygotowania są oznaczone jako karty informacyjne, bez obliczeń i kopiowania dawki. Wersja nie ma pełnej bazy schematów, przeciwwskazań ani kompletnego formularza recepty weterynaryjnej.</li><li>Katalog leków dla ludzi: ${DRUGS.filter(d=>!d.specialties.includes('veterinary')).length} preparatów, ${DRUGS.filter(d=>!d.specialties.includes('veterinary')).reduce((a,d)=>a+d.forms.length,0)} warianty. Źródła i daty ich sprawdzenia znajdują się przy konkretnych postaciach.</li><li>Kontrola obejmuje tylko dostępne lub wprowadzone limity i dane o podzielności. Nie obejmuje pełnych przeciwwskazań, interakcji, niewydolności narządów ani sumy leków z tą samą substancją.</li><li>Weterynaryjne dane katalogowe: ${DRUGS.filter(d=>d.specialties.includes('veterinary')).length} marek, ${DRUGS.filter(d=>d.specialties.includes('veterinary')).reduce((a,d)=>a+d.forms.length,0)} postaci/mocy, w tym karty informacyjne. Źródła: polski RPL, unijna baza UPD oraz urzędowa dokumentacja VMD/HPRA w języku angielskim; odnośniki przy produkcie.</li><li>Wielkości opakowań są rejestracyjne. Dostępność handlowa i refundacja nie są sprawdzane.</li><li>Dane pacjenta i dawkowanie pozostają w pamięci tej karty; nie są wysyłane ani zapisywane przez RxCalc. Przycisk „Nowy pacjent” je usuwa. Po skopiowaniu tekst trafia do schowka urządzenia.</li><li>Zapamiętujemy wyłącznie motyw, specjalizację i listę ulubionych. Pliki aplikacji są przechowywane lokalnie do pracy offline. Hosting może prowadzić własne logi techniczne.</li></ul><p>Decyzję kliniczną, aktualność źródła i końcowy zapis na recepcie potwierdza osoba wystawiająca receptę.</p>`);
}
function sourceDialog() {
  const f=getForm();
  openDialog('Źródło i uwagi',`<p><strong>${esc(f.label)}</strong></p>${f.sourceUrl?`<p><a href="${esc(f.sourceUrl)}" target="_blank" rel="noopener noreferrer">${state.custom && isVeterinary()?'Wyszukaj produkt w bazie weterynaryjnej':esc(f.sourceLabel || 'Dokumentacja produktu')} ↗</a></p>`:''}${f.registrationUrl?`<p><a href="${esc(f.registrationUrl)}" target="_blank" rel="noopener noreferrer">Wpis produktu w unijnej bazie UPD ↗</a></p>`:''}<ul>${(f.notes||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ul><p>${isVeterinary()?'Katalog przypisuje postać do gatunku. Wybrany schemat ze źródła sprawdza zapisane warunki wieku, masy i czasu. Wskazanie, przeciwwskazania, interakcje i pozostałe warunki ocenia lekarz weterynarii.':esc(CATALOGUE_META.scope)}</p>`);
}
function favoritesDialog() {
  if(isVeterinary()&&!state.species){openDialog('Ulubione w weterynarii','<p>Najpierw wybierz gatunek zwierzęcia. Pokażemy ulubione preparaty przypisane do tego gatunku.</p>');return;}
  const list=visibleFavorites();
  openDialog('Twoje ulubione',list.length?`<p>${isVeterinary()?`Preparaty przypisane do gatunku: <strong>${esc(getAnimal()?.label)}</strong>. `:''}Parametry pacjentów i schematy nie są zapamiętywane.</p><div class="dialog-drug-list">${list.map(d=>`<button data-action="favorite-select" data-value="${d.id}">${esc(d.name)}<small>${esc(d.forms[0].label)}</small></button>`).join('')}</div>`:`<p>${isVeterinary()?'Brak ulubionych preparatów dla tego gatunku. ':''}Dodaj preparat przyciskiem <strong>☆ Zapisz</strong> przy wybranym preparacie. Będzie dostępny na głównym ekranie dla tej specjalizacji i gatunku.</p>`);
}
function toolsDialog() {
  if(isVeterinary()){openDialog('Narzędzia weterynaryjne',`<p>Wybierz gatunek, wpisz masę w kg i wybierz preparat. W sekcji schematu wybierz wskazanie i etap ze źródła albo wprowadź własny schemat.</p><p><strong>Jednostki masy:</strong> 100 g = 0,1 kg; 500 g = 0,5 kg.</p><p>Przeliczenia mg/kg na podanie i mg/kg na dobę są dostępne w polu „Sposób przeliczenia”.</p><p><a href="${VET_SOURCE}" target="_blank" rel="noopener noreferrer">Baza produktów weterynaryjnych UPD ↗</a></p>`);return;}
  openDialog('Klirens kreatyniny',`<p><strong>Cockcroft–Gault · CrCl, ml/min</strong><br>Oszacowanie dla dorosłych. Wynik nie jest eGFR i nie ustala dawki leku.</p><div class="tools-grid">${field('toolAge','Wiek',humanAgeYears() ?? '','np. 65','lat')}${field('toolWeight','Masa do wzoru',state.weight,'np. 70','kg')}<div class="field"><label for="toolSex">Płeć uwzględniana we wzorze</label><select id="toolSex"><option value="">Wybierz</option><option value="female" ${state.sex==='female'?'selected':''}>Kobieta</option><option value="male" ${state.sex==='male'?'selected':''}>Mężczyzna</option></select></div>${field('toolCreatinine','Kreatynina',state.creatinine,'np. 1,0')}<div class="field"><label for="toolUnit">Jednostka kreatyniny</label><select id="toolUnit"><option value="mg/dl">mg/dl</option><option value="µmol/l">µmol/l</option></select></div></div><div id="tool-result" class="tool-result">— ml/min</div><p>Użyj masy właściwej dla tego pacjenta i wzoru. Skrajna budowa ciała oraz niestabilna czynność nerek wymagają odrębnej oceny. Nie stosuj automatycznie do doboru dawek.</p><p><a href="https://www.gov.uk/drug-safety-update/prescribing-medicines-in-renal-impairment-using-the-appropriate-estimate-of-renal-function-to-avoid-the-risk-of-adverse-drug-reactions" target="_blank" rel="noopener noreferrer">Źródło: MHRA — ocena czynności nerek ↗</a></p>`);
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
  if(!productReady()||!latest?.valid||!state.confirmed||state.demo||!latestText)return;
  try { await navigator.clipboard.writeText(latestText);toast('Dawkowanie skopiowane. Możesz wkleić je do dokumentacji.'); }
  catch { openDialog('Skopiuj dawkowanie',`<p>Przeglądarka nie udostępniła schowka. Zaznacz tekst poniżej i skopiuj go ręcznie.</p><textarea id="manual-copy" style="width:100%;height:220px;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--ink)" readonly>${esc(latestText)}</textarea>`);$('#manual-copy').focus();$('#manual-copy').select(); }
}
function resetPatient() {
  $('#dialog').close(); $('#dialog').replaceChildren();
  clearPatientContext();
  clearCustomProduct();state.search='';state.category='all';state.routeFilter='all';
  if(isVeterinary())startVeterinary();else{state.custom=false;chooseDrug(getSpeciesCatalogue()[0].id);resetProductView();}
  render();toast('Nowy pacjent — parametry i schemat wyczyszczone.');
}
function example() {
  if(isVeterinary())return;
  state.specialty='dental';state.category='all';state.search='';chooseDrug('amoxicillin-clavulanate');
  selectForm('augmentin-400-57');
  Object.assign(ui,{productChosen:true,formChosen:true,productExpanded:false,manualRegimen:true});
  Object.assign(state,{patientType:'child',age:'8',weight:'24',doseMode:'perKgDay',dose:'45',frequency:'2',days:'7',roundingStep:'0.1',demo:true});render();toast('Przykład działania. Rozpocznij własne obliczenie przyciskiem „Nowy pacjent”.');
}

document.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b)return;
  const {action,value}=b.dataset;
  switch(action){
    case 'patient-type':{
      // Keep the thumb's current visual position when a fast tap reverses a slide.
      const thumb=$('.patient-type-thumb');
      const from=thumb?.getBoundingClientRect(), fromTrack=thumb?.parentElement.getBoundingClientRect();
      state.patientType=value;state.age='';state.weight='';state.humanAgeUnit='years';state.renalStatus='unknown';state.humanCrCl='';resetRegimen();render();
      const next=$('.patient-type-thumb');
      if(from&&fromTrack?.width&&next?.animate&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
        const to=next.getBoundingClientRect(), toTrack=next.parentElement.getBoundingClientRect();
        const offset=(from.left-fromTrack.left)/fromTrack.width*toTrack.width-(to.left-toTrack.left);
        if(Math.abs(offset)>0.5) next.animate([{transform:`translateX(${offset}px)`},{transform:'translateX(0)'}],{duration:220,easing:'cubic-bezier(.22,1,.36,1)'});
      }
      break;
    }
    case 'drug':if(chooseDrug(value))render();break;
    case 'product':if(chooseProduct(value))render();break;
    case 'form':if(selectForm(value)){ui.productExpanded=false;render();}break;
    case 'edit-product':ui.productExpanded=!ui.productExpanded;render();break;
    case 'filters':ui.filtersOpen=!ui.filtersOpen;render();break;
    case 'browse-catalogue':ui.showAll=!ui.showAll;renderDrugs();break;
    case 'route':{
      const routes=new Set(getSpeciesCatalogue().flatMap(d=>d.forms.map(f=>f.routeCode)));
      if(value!=='all'&&!routes.has(value))break;
      state.routeFilter=value;state.category='all';state.search='';ui.showAll=false;
      render();break;
    }
    case 'category':state.category=value;ui.showAll=false;render();break;
    case 'edit-regimen':ui.regimenExpanded=true;render();selectMenus.focus('regimenId');break;
    case 'source-mode':resetRegimen();ui.regimenExpanded=true;render();selectMenus.focus('regimenId');break;
    case 'manual-regimen':if(isInstruction(getForm()))break;state.regimenId='';ui.manualRegimen=true;ui.regimenExpanded=false;ui.sourceDetailsOpen=false;dirty();render();toast('Tryb ręczny — wartości wymagają własnej weryfikacji.');break;
    case 'days':if(getSourceRegimen()?.fixedDays)break;state.days=value;dirty();if($('#days'))$('#days').value=value;document.querySelectorAll('[data-action=days]').forEach(x=>{x.classList.toggle('active',x.dataset.value===value);x.setAttribute('aria-pressed',String(x.dataset.value===value));});updateResult();break;
    case 'custom':{
      if(state.custom && ui.productChosen){clearCustomProduct();state.custom=false;const d=getSpeciesCatalogue()[0];state.routeFilter='all';state.category='all';state.search='';if(d)chooseDrug(d.id);resetProductView();}
      else{const preparedSolution=ui.productChosen&&getForm()?.calculationBlocked;clearCustomProduct();if(preparedSolution){state.customForm='solution';state.customVolume='';}state.custom=true;state.doseMode=isVeterinary()?'perKgDose':'units';state.roundingStep='';state.packageId='custom';resetRegimen();Object.assign(ui,{productChosen:true,formChosen:true,productExpanded:false,manualRegimen:true});}
      render();break;
    }
    case 'favorite':if(!getDrug())break;favoriteIds=favoriteIds.includes(state.drugId)?favoriteIds.filter(x=>x!==state.drugId):[...favoriteIds,state.drugId];savePreference('favorites',favoriteIds);render();break;
    case 'favorites':favoritesDialog();break;
    case 'favorite-select':{
      const d=visibleFavorites().find(x=>x.id===value);if(!d)break;
      state.category='all';state.search='';state.routeFilter='all';chooseDrug(value);$('#dialog').close();render();break;
    }
    case 'rx-mode':state.rxMode=value;document.querySelectorAll('[data-action=rx-mode]').forEach(x=>{x.classList.toggle('active',x.dataset.value===value);x.setAttribute('aria-pressed',String(x.dataset.value===value));});updateResult();break;
    case 'best-package':state.packageId=value;dirty();if($('#packageId'))$('#packageId').value=value;updateResult();break;
    case 'copy':copyPrescription();break;
    case 'reset':resetPatient();break;
    case 'theme':theme=theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;savePreference('theme',theme);b.innerHTML=icon(theme==='dark'?'sun':'moon');break;
    case 'install':installApp();break;
    case 'about':aboutDialog();break;
    case 'source':if(productReady())sourceDialog();break;
    case 'tools':toolsDialog();break;
    case 'close-dialog':$('#dialog').close();break;
    case 'calculator':window.scrollTo({top:0,behavior:'smooth'});break;
    case 'result':$('#result')?.scrollIntoView({behavior:'smooth',block:'start'});break;
    case 'example':example();break;
    case 'update':if(swRegistration?.waiting){requestedUpdate=true;swRegistration.waiting.postMessage({type:'SKIP_WAITING'});}break;
  }
});
$('#app').addEventListener('input',e=>{
  if(e.target.id==='search'){state.search=e.target.value;ui.showAll=false;renderDrugs();return;}
  const key=e.target.dataset.field;if(!key || e.target.tagName==='SELECT')return;
  if(state.regimenId&&((key==='dose'&&(isVeterinary()||!getSourceRegimen()?.doseRange))||(key==='days'&&getSourceRegimen()?.fixedDays))){e.target.value=state[key];return;}
  if(Object.hasOwn(state,key)){state[key]=e.target.value;dirty();updateResult();}
});
$('#app').addEventListener('change',e=>{
  if(e.target.id==='confirmed'){state.confirmed=e.target.checked&&!!latest?.valid&&productReady()&&!state.demo;updateResult();return;}
  const key=e.target.dataset.field;if(!key||e.target.tagName!=='SELECT')return;
  if(key==='productVariant'){if(e.target.value)chooseProduct(e.target.value);else{resetRegimen();ui.formChosen=false;}render();return;}
  if(!Object.hasOwn(state,key))return;
  if(key==='specialty'){switchSpecialty(e.target.value);render();return;}
  if(key==='formId'){if(e.target.value){selectForm(e.target.value);ui.productExpanded=false;}else{resetRegimen();ui.formChosen=false;}render();return;}
  if(key==='regimenId'){chooseSourceRegimen(e.target.value);render();return;}
  if(state.regimenId&&(['doseMode','roundingStep'].includes(key)||(key==='frequency'&&(isVeterinary()||!getSourceRegimen()?.frequencyOptions)))){e.target.value=state[key];return;}
  state[key]=e.target.value;dirty();
  if(key==='species'){state.age='';state.weight='';state.foodChainStatus='unknown';state.vetAgeUnit=['hamster','rat'].includes(state.species)?'months':'years';startVeterinary();render();}
  else if(key==='vetAgeUnit'){state.age='';render();}
  else if(key==='humanAgeUnit'){state.age='';render();}
  else if(key==='doseMode'){state.dose='';render();}
  else if(key==='customForm'){state.customStrength='';state.customConcentration='';state.customPack='';state.customDrops='';state.customFractions='1';state.customContainers='1';state.vetRoute='';state.roundingStep='';state.doseMode=isVeterinary()&&!['spray','gel'].includes(state.customForm)?'perKgDose':'units';resetRegimen();render();}
  else updateResult();
});
function updateKeyboardState(){
  const el=document.activeElement;
  const editing=el?.tagName==='TEXTAREA'||el?.tagName==='INPUT'&&!['checkbox','radio','button','submit'].includes(el.type);
  const keyboardViewport=window.visualViewport&&window.innerHeight-window.visualViewport.height>150;
  document.body.classList.toggle('keyboard-open',!!editing||!!keyboardViewport);
}
document.addEventListener('focusin',updateKeyboardState);
document.addEventListener('focusout',()=>requestAnimationFrame(updateKeyboardState));
window.visualViewport?.addEventListener('resize',updateKeyboardState);
$('#dialog').addEventListener('input',updateTool);$('#dialog').addEventListener('change',updateTool);
$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog'))$('#dialog').close();});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();ui.productExpanded=true;render();if($('#search'))$('#search').focus();else selectMenus.focus('species');}if(e.key==='Escape' && $('#search')===document.activeElement){state.search='';$('#search').value='';renderDrugs();}});
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
