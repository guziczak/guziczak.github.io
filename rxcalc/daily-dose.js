import { regimenComparisonRows } from './dose-regimen.js';
import { calculate } from './engine.js';
import { resolveRegimen } from './regimen-engine.js';

const NUMERIC_FORMS = new Set(['tablet','suspension','solution','spray','gel','drops','injection','oralPaste','oralPowder','oralGel']);
const UNIT_STRENGTH_FORMS = new Set(['tablet','spray','gel','oralPaste','oralPowder','oralGel']);

const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0?value:null;
const minimum=values=>{
  const numbers=values.filter(value=>positive(value)!==null);
  return numbers.length?Math.min(...numbers):null;
};
const above=(value,ceiling)=>positive(value)!==null&&positive(ceiling)!==null
  &&value-ceiling>Number.EPSILON*64*Math.max(1,Math.abs(value),Math.abs(ceiling));
const inVolume=(volume,ingredient)=>positive(volume)===null?null
  :positive(volume*ingredient.amount/ingredient.perMl);
// Keep original amounts and volumes in this ratio; displayed/rounded ingredient
// quantities (e.g. 6.4 instead of 6.4125) are never used as independent limits.
const proportional=(value,from,to)=>positive(value)===null||!from?null
  :from.index===to.index?value
  :positive(value*to.amount*from.perMl/(from.amount*to.perMl));

/** One slot policy for the app and the arithmetic preview. Qualitative topical
 * instructions and reference concentrates cannot become numeric calculations. */
export function supportsDailyDose(form) {
  return !!form && NUMERIC_FORMS.has(form.form) && form.calculationMode!=='instruction'
    && form.referenceOnly!==true && form.calculationBlocked!==true;
}

function ingredientList(form,drug,override,input) {
  const unitStrength=UNIT_STRENGTH_FORMS.has(form.form);
  const definitions=Array.isArray(override)?override
    :Array.isArray(form.activityIngredients)&&form.activityIngredients.length?form.activityIngredients
    :Array.isArray(form.ingredients)&&form.ingredients.length
      ?form.ingredients.map(ingredient=>({...ingredient,amount:ingredient.amountMg,unit:'mg'}))
      :unitStrength&&Array.isArray(form.activeIngredients)&&form.activeIngredients.length
        ?form.activeIngredients.map(ingredient=>({name:ingredient.substanceLabel,amount:ingredient.strengthMg,perMl:1,unit:'mg'}))
        :[{name:form.substanceLabel||drug?.substanceLabel||drug?.name||'Substancja czynna',
          amount:unitStrength?form.strengthMg:form.concentrationMg,
          perMl:unitStrength?1:form.concentrationMl,unit:'mg'}];
  // Internally perMl is the legacy denominator per ENGINE UNIT: ml for liquid,
  // g for oral mass, one tablet/actuation for discrete forms, one calibrated drop
  // for drops. A drop is never treated as one ml.
  const drops=form.form==='drops'?positive(form.dropsPerMl??input.dropsPerMl):1;
  const ingredients=definitions.map((ingredient,index)=>({
    index,name:typeof ingredient?.name==='string'?ingredient.name.trim():'',
    unit:typeof ingredient?.unit==='string'?ingredient.unit.trim():'',
    amount:positive(ingredient?.amount),
    perMl:drops===null?null:positive(ingredient?.perMl*drops),
  })).filter(ingredient=>ingredient.name&&ingredient.unit&&ingredient.amount!==null&&ingredient.perMl!==null);
  if(ingredients.length)return ingredients;
  // Measured rinses and uncalibrated unit-only products may still have an exact
  // source amount. Compare their real physical units without claiming mg or IU.
  const unit=typeof form.unitLabel==='string'&&form.unitLabel.trim()
    ?form.unitLabel.trim():typeof input.unitLabel==='string'?input.unitLabel.trim():'';
  return unit?[{index:0,name:'Ilość preparatu',unit,amount:1,perMl:1,physicalAmount:true}]:[];
}

function veterinarySource(source,form,input,sourceContext) {
  if(!source||input.patientKind!=='animal')return {source,eligibility:null};
  // Do not borrow a band from the entered quantity or round the patient's mass.
  // The existing resolver validates the complete table, species, exact boundary
  // inclusivity, age and any food-chain exclusion before a comparison is used.
  // Duration does not change a daily reference and is deliberately omitted.
  const context={
    ...sourceContext,formId:form.id,species:input.species,weight:input.weight,
    age:sourceContext&&Object.hasOwn(sourceContext,'age')?sourceContext.age:input.age,
    ageUnit:sourceContext?.ageUnit||input.ageUnit||'years',foodChainStatus:input.foodChainStatus,
    days:null,
    calculationBlocked:form.calculationBlocked===true||input.calculationBlocked===true,
  };
  const eligibility=resolveRegimen(source,context);
  if(positive(eligibility.dose)===null||positive(eligibility.frequency)===null)
    return {source:null,eligibility};
  return {source:{...source,dose:eligibility.dose},eligibility};
}

/**
 * A daily arithmetic preview, independent of treatment duration. The caller's
 * source/limits define its scope; this module never supplies a universal limit
 * or decides whether a source regimen is appropriate for the patient.
 */
export function ingredientDailyDose({form,drug,input={},source=null,sourceCheck=null,sourceContext=null,limit=null,ingredientOverride=null}={}) {
  if(!supportsDailyDose(form)||input.calculationBlocked===true||source?.doseMode==='instruction')return null;
  const preview=calculate({...input,days:1});
  // A later validation error can retain useful arithmetic; absent inputs cannot.
  const dailyUnits=positive(preview.dailyUnits);
  const ingredients=ingredientList(form,drug,ingredientOverride,input);
  const primary=ingredients.find(ingredient=>ingredient.index===0)||null;
  const validWeight=positive(input.weight);
  const weight=validWeight!==null&&validWeight<=(input.patientKind==='animal'?2000:500)?validWeight:null;
  const primaryMg=primary?.unit==='mg';
  const sourceDailyMg=source&&primaryMg?positive(sourceCheck?.maxDailyMg):null;
  const sourcePerKg=source&&primaryMg?positive(sourceCheck?.maxDailyMgPerKg):null;
  const sourceDailyUnits=source?(positive(source?.maxDailyUnits)??positive(sourceCheck?.maxDailyUnits)):null;
  const suppliedDailyMg=primaryMg?positive(limit?.daily):null;

  let ceiling=source?minimum([
    sourceDailyMg,
    sourcePerKg!==null&&weight!==null?sourcePerKg*weight:null,
    primary?inVolume(sourceDailyUnits,primary):null,
  ]):suppliedDailyMg;
  let ceilingKind=source
    ?(ceiling!==null||sourcePerKg!==null||sourceDailyUnits!==null?'source':null)
    :ceiling===null?null:limit?.kind==='manual'||(limit?.kind!=='catalogue'&&positive(input.manualMax)!==null)?'manual':'catalogue';

  // A genuinely tighter physician-entered limit can also narrow a source range.
  if(source&&limit?.kind==='manual'&&suppliedDailyMg!==null
    &&(ceiling===null||suppliedDailyMg<=ceiling)) {
    ceiling=suppliedDailyMg;
    ceilingKind='manual';
  }
  // Without weight a manual absolute limit cannot be labelled with the source's
  // separate mg/kg boundary. With weight show the effective, tighter boundary.
  const ceilingPerKg=ceilingKind==='manual'&&weight===null?null:minimum([
    sourcePerKg,ceiling!==null&&weight!==null?ceiling/weight:null,
  ]);
  const primaryDaily=dailyUnits===null||!primary?null
    :primaryMg&&positive(preview.dailyMg)!==null?preview.dailyMg:inVolume(dailyUnits,primary);
  const rows=ingredients.map(ingredient=>{
    const daily=primary?proportional(primaryDaily,primary,ingredient):inVolume(dailyUnits,ingredient);
    const rowCeiling=primary?proportional(ceiling,primary,ingredient):inVolume(sourceDailyUnits,ingredient);
    const rowPerKgCeiling=primary?proportional(ceilingPerKg,primary,ingredient)
      :rowCeiling!==null&&weight!==null?positive(rowCeiling/weight):null;
    return {
      name:ingredient.name,unit:ingredient.unit,daily,
      perKg:!ingredient.physicalAmount&&daily!==null&&weight!==null?positive(daily/weight):null,
      ceiling:rowCeiling,ceilingPerKg:ingredient.physicalAmount?null:rowPerKgCeiling,
      derivedCeiling:ingredient.index>0&&(rowCeiling!==null||rowPerKgCeiling!==null),
    };
  });
  const comparison=veterinarySource(source,form,input,sourceContext);
  return {
    rows,dailyUnits,ceilingKind,unitLabel:input.unitLabel||form.unitLabel||'',
    schemeRows:regimenComparisonRows({source:comparison.source,input,ingredients,weight,limit}),
    comparisonEligibility:comparison.eligibility,
    sourceSelected:!!source,
    physicalAmount:ingredients.length===1&&ingredients[0].physicalAmount===true,
    // Arithmetic can remain useful after e.g. a tablet-division or device-step
    // error. Keep the problem visible beside its numeric comparison.
    calculationErrors:dailyUnits===null?[]:[...preview.errors],
    rounding:positive(preview.theoreticalUnits)!==null&&positive(preview.singleUnits)!==null
      &&Math.abs(preview.roundingDifferencePercent)>1e-7
      ?{from:preview.theoreticalUnits,to:preview.singleUnits}:null,
    sourceLabel:source?.sourceLabel||form.sourceLabel||'',
    sourceUrl:source?.sourceUrl||form.sourceUrl||'',
    sourceScope:source?.label||'',
    // Secondary ingredient ceilings express the same boundary proportionally;
    // compare against its original basis, never a formatted secondary number.
    exceeded:above(primaryDaily,ceiling)
      ||above(primaryDaily!==null&&weight!==null?primaryDaily/weight:null,ceilingPerKg)
      ||above(dailyUnits,sourceDailyUnits),
  };
}

/** Existing suspension-only API retained for callers and regression tests. */
export function suspensionDailyDose(options={}) {
  return options.form?.form==='suspension'?ingredientDailyDose(options):null;
}
