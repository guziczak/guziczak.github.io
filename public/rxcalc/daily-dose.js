import { calculate } from './engine.js';

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

function ingredientList(form,drug,override) {
  const definitions=Array.isArray(override)?override
    :Array.isArray(form.ingredients)&&form.ingredients.length
      ?form.ingredients.map(ingredient=>({...ingredient,amount:ingredient.amountMg,unit:'mg'}))
      :[{name:drug?.substanceLabel||drug?.name||'Substancja czynna',
        amount:form.concentrationMg,perMl:form.concentrationMl,unit:'mg'}];
  return definitions.map((ingredient,index)=>({
    index,name:typeof ingredient?.name==='string'?ingredient.name.trim():'',
    unit:typeof ingredient?.unit==='string'?ingredient.unit.trim():'',
    amount:positive(ingredient?.amount),perMl:positive(ingredient?.perMl),
  })).filter(ingredient=>ingredient.name&&ingredient.unit&&ingredient.amount!==null&&ingredient.perMl!==null);
}

/**
 * A daily arithmetic preview, independent of treatment duration. The caller's
 * source/limits define its scope; this module never supplies a universal limit
 * or decides whether a source regimen is appropriate for the patient.
 */
export function suspensionDailyDose({form,drug,input={},source=null,sourceCheck=null,limit=null,ingredientOverride=null}={}) {
  if(form?.form!=='suspension'||form.calculationBlocked===true||input.calculationBlocked===true)return null;
  const preview=calculate({...input,days:1});
  // A later validation error can retain useful arithmetic; absent inputs cannot.
  const dailyUnits=positive(preview.dailyUnits);
  const ingredients=ingredientList(form,drug,ingredientOverride);
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
      perKg:daily!==null&&weight!==null?positive(daily/weight):null,
      ceiling:rowCeiling,ceilingPerKg:rowPerKgCeiling,
      derivedCeiling:ingredient.index>0&&(rowCeiling!==null||rowPerKgCeiling!==null),
    };
  });
  return {
    rows,dailyUnits,ceilingKind,
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
