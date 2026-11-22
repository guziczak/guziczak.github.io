/**
 * An in-memory collection of reviewed calculation snapshots for one patient.
 * This module neither persists patient data nor validates combinations of drugs.
 * The calculator supplies its already validated text in both output modes.
 */
import { RENAL_STATE_DEFAULTS, RENAL_STATE_FIELDS, renalAssessmentForState, isCrClIgnored } from './renal-state.js';

export const PATIENT_CONTEXT_FIELDS = Object.freeze([
  'specialty', 'patientType', 'age', 'weight', 'species', 'vetAgeUnit',
  'humanAgeUnit', 'renalStatus', 'humanCrCl', 'humanSerumCreatinine', 'foodChainStatus',
  ...RENAL_STATE_FIELDS,
]);

const plainObject = value => value !== null && typeof value === 'object'
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const numeric = value => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const text = String(value).trim().replace(',', '.');
  const number = Number(text);
  return Number.isFinite(number) ? number : text;
};
const text = value => typeof value === 'string' ? value.trim() : '';

/** Preserve raw patient inputs when loading an item for editing. */
export function pickPatientContext(state = {}) {
  return freeze(Object.fromEntries(PATIENT_CONTEXT_FIELDS
    .filter(key => Object.hasOwn(state, key)).map(key => [key, state[key]])));
}

/** Compare meaningful values, so e.g. 70 and "70,0" describe the same context. */
export function normalizePatientContext(state = {}) {
  const animal = state.specialty === 'veterinary';
  const renal = animal ? null : renalAssessmentForState(state);
  const calculated = state.renalInputMode === 'calculate';
  return freeze({
    patientKind: animal ? 'animal' : 'human',
    patientType: animal ? null : state.patientType || 'adult',
    species: animal ? state.species || '' : null,
    weight: numeric(state.weight),
    age: numeric(state.age),
    ageUnit: (animal ? state.vetAgeUnit : state.humanAgeUnit) || 'years',
    renalStatus: animal ? null : state.renalStatus || 'unknown',
    ignoreCrCl: animal ? null : isCrClIgnored(state),
    crcl: animal ? null : calculated ? renal.crcl : renal.crcl ?? numeric(state.humanCrCl),
    serumCreatinine: animal ? null : renal.serumCreatinineMgDl ?? numeric(state.humanSerumCreatinine),
    renalInputMode: animal ? null : state.renalInputMode ?? 'manual',
    renalCreatinineUnit: animal ? null : renal.serumCreatinineMgDl !== null ? 'mg/dl' : state.renalCreatinineUnit ?? 'mg/dl',
    renalSex: animal || !calculated ? null : state.renalSex || '',
    renalCalculationWeight: animal || !calculated ? null : numeric(state.renalCalculationWeight),
    renalCalculationReviewed: animal || !calculated ? null : state.renalCalculationReviewed === true,
    foodChainStatus: animal ? state.foodChainStatus || 'unknown' : null,
  });
}

export function patientContextKey(state = {}) {
  return JSON.stringify(normalizePatientContext(state));
}

const patientGroupKey = state => state.specialty === 'veterinary'
  ? `animal:${state.species || ''}` : 'human';

/** Package size is intentionally excluded: a second pack does not add a drug. */
export function prescriptionProductKey(state = {}) {
  if (state.custom) {
    const name = text(state.customName).replace(/\s+/g, ' ').toLocaleLowerCase('pl');
    if (!name || !state.customForm) return '';
    return JSON.stringify(['custom', name, state.customForm,
      numeric(state.customStrength), numeric(state.customConcentration), numeric(state.customVolume),
      numeric(state.customDrops), text(state.vetRoute)]);
  }
  return state.drugId && state.formId
    ? JSON.stringify(['catalogue', state.drugId, state.formId]) : '';
}

function cloneData(value, seen = new Set()) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!Array.isArray(value) && !plainObject(value)) throw new TypeError('Snapshot must contain plain data.');
  if (seen.has(value)) throw new TypeError('Snapshot cannot be cyclic.');
  seen.add(value);
  const result = Array.isArray(value) ? value.map(entry => cloneData(entry, seen))
    : Object.fromEntries(Object.entries(value)
      .filter(([key, entry]) => !['__proto__', 'constructor', 'prototype'].includes(key) && entry !== undefined)
      .map(([key, entry]) => [key, cloneData(entry, seen)]));
  seen.delete(value);
  return result;
}

export function createPrescriptionCart() {
  return freeze({ items: [], nextId: 1 });
}

const failure = (cart, code, message, extra = {}) => ({ ok: false, cart, code, message, ...extra });

/**
 * Add a reviewed calculation, or replace a specific edited item in place.
 * A duplicate reports existingId; quantities are never silently added together.
 */
export function savePrescriptionItem(cart, draft = {}, { replaceId = null } = {}) {
  if (draft.valid !== true || draft.confirmed !== true || draft.demo || draft.snapshot?.demo) {
    return failure(cart, 'unreviewed', 'Uzupełnij i potwierdź bieżące obliczenie przed dodaniem do koszyka.');
  }
  if (!plainObject(draft.snapshot))
    return failure(cart, 'invalid-snapshot', 'Brak danych obliczenia do zapisania w koszyku.');
  const label = text(draft.label), full = text(draft.texts?.full), ds = text(draft.texts?.ds);
  const productKey = text(draft.productKey) || prescriptionProductKey(draft.snapshot);
  if (!productKey || !label || !full || !ds)
    return failure(cart, 'incomplete-item', 'Pozycja wymaga preparatu oraz kompletnego zapisu dawkowania.');
  const replacing = replaceId !== null;
  const index = replacing ? cart.items.findIndex(item => item.id === replaceId) : -1;
  if (replacing && index === -1)
    return failure(cart, 'missing-item', 'Tej pozycji nie ma już w koszyku. Dodaj ją ponownie.');
  const others = cart.items.filter(item => item.id !== replaceId);
  const groupKey = patientGroupKey(draft.snapshot);
  if (others.some(item => item.groupKey !== groupKey))
    return failure(cart, 'patient-group-mismatch', 'Koszyk dotyczy jednego pacjenta. Rozpocznij nowy koszyk przyciskiem „Nowy pacjent”.');
  const duplicate = others.find(item => item.productKey === productKey);
  if (duplicate)
    return failure(cart, 'duplicate', 'Ten preparat jest już w koszyku. Edytuj zapisaną pozycję.', { existingId: duplicate.id });
  let snapshot;
  try { snapshot = cloneData(draft.snapshot); }
  catch { return failure(cart, 'invalid-snapshot', 'Nie można zapisać danych tego obliczenia.'); }
  const item = freeze({
    id: replacing ? replaceId : `rx-${cart.nextId}`,
    productKey, label, summary: text(draft.summary), snapshot,
    patientContext: normalizePatientContext(snapshot), patientKey: patientContextKey(snapshot), groupKey,
    texts: { full, ds },
  });
  const items = [...cart.items];
  if (replacing) items[index] = item;
  else items.push(item);
  const updated = freeze({ items, nextId: cart.nextId + (replacing ? 0 : 1) });
  return { ok: true, cart: updated, item, updated: replacing };
}

export function removePrescriptionItem(cart, id) {
  if (!cart.items.some(item => item.id === id)) return cart;
  return freeze({ items: cart.items.filter(item => item.id !== id), nextId: cart.nextId });
}

/** Restore medication settings while keeping the current patient's inputs. */
export function preparePrescriptionEdit(item, currentState = {}) {
  if (!plainObject(item?.snapshot) || !plainObject(currentState))
    return { ok: false, message: 'Brak danych zapisanej pozycji do edycji.' };
  if (patientGroupKey(item.snapshot) !== patientGroupKey(currentState))
    return { ok: false, message: 'Ta pozycja dotyczy innej grupy pacjenta lub innego gatunku. Rozpocznij nowy koszyk przyciskiem „Nowy pacjent”.' };
  let snapshot;
  try { snapshot = cloneData(item.snapshot); }
  catch { return { ok: false, message: 'Nie można przywrócić danych tej pozycji.' }; }
  const patient = pickPatientContext({
    patientType: 'adult', age: '', weight: '', species: '', vetAgeUnit: 'years',
    humanAgeUnit: 'years', renalStatus: 'unknown', humanCrCl: '', humanSerumCreatinine: '', foodChainStatus: 'unknown',
    ...RENAL_STATE_DEFAULTS,
    ...currentState,
  });
  return { ok: true, state: {
    ...snapshot, ...patient, specialty: snapshot.specialty, confirmed: false, demo: false,
    sourceConfirmations: item.patientKey === patientContextKey(currentState) ? (snapshot.sourceConfirmations || []) : [],
  } };
}

/** Old values remain visible, but are not exported for changed patient inputs. */
export function assessPrescriptionCart(cart, currentState = {}) {
  const key = patientContextKey(currentState);
  const staleIds = cart.items.filter(item => item.patientKey !== key).map(item => item.id);
  const reasons = [];
  if (!cart.items.length) reasons.push('Koszyk jest pusty.');
  if (staleIds.length) reasons.push('Dane pacjenta zmieniły się. Przelicz i potwierdź oznaczone pozycje.');
  if (currentState.demo) reasons.push('Przykład demonstracyjny nie służy do kopiowania recepty.');
  return freeze({ canCopy: cart.items.length > 0 && staleIds.length === 0 && !currentState.demo,
    staleIds, reasons });
}

/** Keep each drug's saved dispensing/dosing instructions separate and intact. */
export function prescriptionCartText(cart, currentState = {}, { mode = 'full' } = {}) {
  if (!['full', 'ds'].includes(mode))
    return { ok: false, text: '', code: 'invalid-mode', message: 'Nieznany format zapisu koszyka.' };
  const assessment = assessPrescriptionCart(cart, currentState);
  if (!assessment.canCopy)
    return { ok: false, text: '', code: 'not-ready', message: assessment.reasons.join(' '), ...assessment };
  const output = cart.items.map(item => mode === 'ds'
    ? `${item.label}\n${item.texts.ds}` : item.texts.full).join('\n\n');
  return { ok: true, text: output, ...assessment };
}
