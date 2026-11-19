/** Evidence for one narrowly scoped conversion, not a general rounding tolerance.
 * The shortcut itself does not change the selected source, patient or regimen.
 * Automatic application is resolved separately by rounding-assessment.js.
 * HSE describes an off-label substitution in a residential-care pneumonia guide;
 * Cleveland Clinic documents an adult formulary conversion (2020). Neither is
 * a Polish dental-suspension regimen. The UI must keep that scope visible.
 */
export const ADULT_AUGMENTIN_ROUNDED_SHORTCUT = Object.freeze({
  id:'augmentin-adult-875-to-11ml',
  policyRevision:'scoped-auto-2026-11-19-v1',
  evidenceKind:'documented-formulation-conversion',
  formId:'augmentin-400-57',
  sourceId:'dental-augmentin-suspension-adult-substitution',
  referenceMg:875, referenceMl:10.9375,
  ml:11, amoxicillinMg:880, clavulanicMg:125.4,
  deltaPercent:(880/875-1)*100,
  checkedAt:'2026-11-19',
  references:Object.freeze([
    Object.freeze({label:'HSE · zamiana postaci, off-label · s. 5',url:'https://assets.hse.ie/media/documents/Pneumonia_in_residential_care_facilities_guideline.pdf'}),
    Object.freeze({label:'Cleveland Clinic · zamiana w formularzu leków dla dorosłych · 2020, s. 7',url:'https://www.clevelandclinicmeded.com/medicalpubs/pharmacy/September%20October%202020%20Clinical%20Rx%20Forum.pdf'}),
  ]),
});

/** Only the identified adult source, exact formulation and confirmed eligibility.
 * An explicitly selected rounding grid always takes precedence (0.1 ml still
 * produces 10.9 ml via the generic grid logic). No substitution for children,
 * manual schemes, other strengths/routes or unknown patient conditions.
 */
export function roundedVolumeShortcut(form, options={}) {
  const {source,weight,frequency,doseMode='fixed',roundingStep,eligibility,veterinary}=options;
  const p=ADULT_AUGMENTIN_ROUNDED_SHORTCUT;
  if(veterinary || form?.id!==p.formId || form.form!=='suspension' || form.unitLabel!=='ml'
    || form.calculationBlocked || form.referenceOnly || form.calculationMode==='instruction'
    || form.concentrationMg!==400 || form.concentrationMl!==5
    || source?.id!==p.sourceId || source.doseMode!=='fixed' || doseMode!=='fixed'
    || source.dose!==p.referenceMg || source.doseRange || source.frequency!==2 || frequency!==2
    || !source.formIds?.includes(p.formId) || source.patientTypes?.length!==1 || source.patientTypes[0]!=='adult'
    || typeof weight!=='number' || !Number.isFinite(weight) || weight<40 || weight>500
    || eligibility?.valid!==true
    || roundingStep!==null && roundingStep!==undefined && roundingStep!=='')return null;
  const ingredients=form.ingredients;
  if(!Array.isArray(ingredients) || ingredients.length!==2
    || ingredients[0].amountMg!==400 || ingredients[0].perMl!==5
    || ingredients[1].amountMg!==57 || ingredients[1].perMl!==5)return null;
  return p;
}
