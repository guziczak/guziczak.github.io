/** Optional external reference, never a replacement dosing regimen.
 * Entered dose, frequency, duration and primary-source constraints stay intact.
 * This does not establish prior treatment failure or clinical suitability.
 */
import { durationDosePreview } from './duration-regimen.js';
const SOURCE_ID = 'dental-augmentin-400-57-child';
const UCSF_URL = 'https://idmp.ucsf.edu/content/dental-infection';
const positive = v => typeof v === 'number' && Number.isFinite(v) && v > 0;
const near = (a, b) => Math.abs(a - b) <= Number.EPSILON * 256 * Math.max(1, Math.abs(a), Math.abs(b));

export function supplementaryDurationReference({ source, form, context = {}, guidance } = {}) {
  if (!guidance?.applicable || guidance.coverage !== 'reviewed'
      || source?.id !== SOURCE_ID || form?.id !== 'augmentin-400-57'
      || context.specialty !== 'dental' || context.patientType !== 'child'
      || context.custom || context.calculationBlocked || form.referenceOnly || form.calculationBlocked) return null;
  // Only the reviewed oral 400/57 formulation; no matching by medicine name.
  if (form.form !== 'suspension' || form.unitLabel !== 'ml' || form.routeLabel !== 'doustnie'
      || form.concentrationMg !== 400 || form.concentrationMl !== 5
      || form.ingredients?.length !== 2
      || form.ingredients[0].amountMg !== 400 || form.ingredients[0].perMl !== 5
      || form.ingredients[1].amountMg !== 57 || form.ingredients[1].perMl !== 5) return null;
  const age = context.age;
  const ageUpperMonths = typeof age === 'number' && Number.isFinite(age) && age >= 0
    ? context.ageUnit === 'years' ? age * 12
      : context.ageUnit === 'months' ? age : context.ageUnit === 'days' ? age / 28 : null : null;
  // Existing resolver enforces the catalogue's lower age and <40 kg scope.
  // Restrict this pediatric comparison to under-18s; this is an app scope,
  // not a numeric age boundary stated by the UCSF dental page.
  if (ageUpperMonths === null || ageUpperMonths >= 216 || !positive(context.weight)) return null;
  const sourceSingleMg = Math.min(22.5 * context.weight, 875);
  const enteredSingleMg = durationDosePreview({source,form,context})?.singleMg ?? null;
  const doseComparison = enteredSingleMg === null || !positive(context.frequency) ? 'unknown'
    : near(enteredSingleMg, sourceSingleMg) && context.frequency === 2 ? 'same' : 'different';
  return {
    id: 'ucsf-pediatric-dental-duration-comparison', kind: 'range', origin: 'external',
    organization: 'UCSF', originLabel: 'Porównanie czasu: UCSF (dzieci)',
    minimum: 3, maximum: 7, fixed: false, hardMaximum: false,
    reviewAfterDays: null, reviewMode: null, reviewText: '',
    choices: [3, 5, 7, 10], checkedAt: '2026-11-17',
    label: 'UCSF IDMP · Dental Infection · dzieci', url: UCSF_URL,
    section: 'Alternative Therapy; Comments: Duration',
    indication: 'Zakażenia zębopochodne u dzieci; amoksycylina z klawulanianem po niewystarczającej odpowiedzi na leczenie pierwszego wyboru.',
    note: 'Osobne zagraniczne odniesienie wyłącznie do czasu, nie nowy schemat z polskiej ChPL. UCSF podaje 22,5 mg amoksycyliny/kg na jedno podanie (maks. 875 mg na podanie), 2 razy na dobę, po niewystarczającej odpowiedzi na leczenie pierwszego wyboru. Wskazuje konsultację stomatologiczną; 3–7 dni, z indywidualizacją w zakażeniach bardziej powikłanych. Nie dopisano obowiązkowej kontroli po 3 dniach. Różne dawkowanie, wskazanie i postać nie są uznawane za równoważne przez zgodność liczby dni.',
    conditionText: 'UCSF: po niewystarczającej odpowiedzi na leczenie pierwszego wyboru. Przy powikłaniach czas ustala się indywidualnie.',
    doseComparison,
    contextNotice: doseComparison === 'different'
      ? 'Dawka lub częstość różni się od UCSF — czas wymaga oceny w kontekście całego schematu.'
      : doseComparison === 'unknown' ? 'Uzupełnij dawkowanie, aby porównać je z UCSF.'
        : 'Dawkowanie liczbowe odpowiada UCSF.',
    comparisonSingleMg: sourceSingleMg, comparisonFrequency: 2,
    primarySourceUrl: source.sourceUrl, primarySourceLabel: source.sourceLabel,
    additionalSources: [{
      url: 'https://idmp.ucsf.edu/content/maximum-dosing-for-amoxicillin-and-amoxicillin-clavulanate-0',
      label: 'UCSF · osobne zasady doboru postaci i dawek',
    }],
  };
}
