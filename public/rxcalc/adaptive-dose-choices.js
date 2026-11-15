import { roundedVolumeShortcut } from './rounded-volume-shortcuts.js';

/** Pure arithmetic shortcut windows. These are NOT dose recommendations.
 * Never takes the entered dose as its anchor, invents a measurement tolerance,
 * chooses a treatment, or modifies source limits / patient values.
 */
const positive = v => typeof v === 'number' && Number.isFinite(v) && v > 0;
const clean = v => Number(v.toPrecision(14));
const near = (a,b) => Math.abs(a-b) <= Number.EPSILON*64*Math.max(1,Math.abs(a),Math.abs(b));
const unique = values => values.filter(positive).sort((a,b)=>a-b).filter((v,i,a)=>!i||!near(v,a[i-1]));
const down = (value,step) => clean(Math.floor(value/step+1e-10)*step);
const up = (value,step) => clean(Math.ceil(value/step-1e-10)*step);
const readableStep = value => 2.5 * 10 ** Math.floor(Math.log10(value/10));

/** Return volumes only. Existing dose validation evaluates every candidate later.
 * An explicit calculator rounding step is a grid, not evidence about a device.
 * With no grid, exact source conversions are kept and must be checked for measurement.
 */
export function liquidShortcutWindow(form, options = {}) {
  const {source=null,doseMode='fixed',weight=null,frequency=null,roundingStep=null,eligibility=null}=options;
  const base=[2.5,5,10];
  const concentration=positive(form?.concentrationMg)&&positive(form?.concentrationMl)
    ?form.concentrationMg/form.concentrationMl:null;
  const weighted=['perKgDay','perKgDose'].includes(doseMode);
  const grid=positive(roundingStep)?roundingStep:null;
  const contextAllowed=!source || eligibility===null || eligibility?.valid===true;
  const low=source?.doseRange?.min??source?.dose,high=source?.doseRange?.max??source?.dose;
  const validSource=contextAllowed&&source&&source.doseMode===doseMode
    &&(!source.formIds||source.formIds.includes(form.id))&&positive(low)&&positive(high)&&low<=high
    &&(!weighted||positive(weight)&&weight<=500)
    &&(doseMode!=='perKgDay'||Number.isInteger(frequency)&&frequency>0&&frequency<=48)
    &&(doseMode==='units'||positive(concentration));
  const perUnit=doseMode==='units'?1:!positive(concentration)?null
    :doseMode==='fixed'?1/concentration:doseMode==='perKgDose'?weight/concentration
    :doseMode==='perKgDay'?weight/frequency/concentration:null;
  const min=validSource?clean(low*perUnit):null,max=validSource?clean(high*perUnit):null;
  const anchored=positive(min)&&positive(max)&&Number.isFinite(perUnit);
  const step=grid||readableStep(anchored?max:10);
  let values=grid?unique(base.map(v=>up(v,grid))):base;
  let exact=false,kind='volume',noGridValue=false;
  if(anchored) {
    kind=near(min,max)?'fixed':'range';
    if(kind==='range') {
      const first=grid?up(min,grid):min,last=grid?down(max,grid):max;
      if(first<=last||near(first,last)) {
        const middle=grid?down((first+last)/2,grid):clean((first+last)/2);
        values=unique([first,middle,last]);
        // Keep a useful lower neighbour when ALL original shortcuts were too low.
        if(base[2]<min && base[2]>=min/2 && (!grid||near(up(base[2],grid),base[2])))
          values=unique([base[2],first,last]);
        if(values.length<3)values=unique([first-step,...values,last+step]);
      } else {
        values=unique([down(min,step),up(min,step),up(min,step)+step]);
        noGridValue=true;
      }
      exact=!grid;
    } else if(grid&&!near(down(min,grid),min)) {
      const lower=down(min,grid),upper=up(min,grid);
      const previous=base[2]<lower&&base[2]>=min/2&&near(up(base[2],grid),base[2])?base[2]:lower-grid;
      values=unique([previous,lower,upper]);
      noGridValue=true;
    } else {
      const lower=near(down(min,step),min)?min-step:down(min,step);
      const upper=near(up(min,step),min)?min+step:up(min,step);
      values=unique([lower,min,upper]);exact=!grid;
    }
  }
  if(!values.length)values=[step,2*step,3*step];
  while(values.length<3)values=unique([...values,clean(values.at(-1)+step)]);
  values=values.slice(0,3);
  const rounded=anchored&&kind==='fixed'?roundedVolumeShortcut(form,options):null;
  if(rounded){values=unique(values.map(v=>near(v,min)?rounded.ml:v));exact=false;}
  const initial=values.slice();
  // Paging changes shortcuts only. Source and entered values never change here.
  const requested=Number.isSafeInteger(options.page)?options.page:0;
  const minPage=-Math.ceil(Math.max(0,initial[0]-step)/(2*step));
  const maxPage=Math.max(0,Math.floor((1e6-initial.at(-1))/step/2)); // technical input bound, not a clinical limit
  const page=Math.max(minPage,Math.min(maxPage,requested));
  if(page>0) {
    const start=up(initial.at(-1),step)+(page-1)*2*step;
    values=[start,start+step,start+2*step].map(clean);
  } else if(page<0) {
    const end=down(initial[0],step)+(page+1)*2*step;
    values=unique([end-2*step,end-step,end]);
    // A lower edge can legitimately have fewer than three positive values.
  }
  return {volumes:values,initial,kind,anchored,weighted,grid,exact:exact&&page===0,
    roundingShortcut:page===0?rounded:null,
    noGridValue:anchored&&noGridValue,page,canLower:values[0]>step&&!near(values[0],step),
    canHigher:values.at(-1)+2*step<=1e6,sourceMinimum:min,sourceMaximum:max};
}

/** Presentation identity excludes dose, duration and confirmation, so selecting
 * a tile never moves the window. Patient/source/strength changes reset browsing. */
export function liquidShortcutKey(form, options={}) {
  const s=options.source;
  return JSON.stringify([form?.id,form?.concentrationMg,form?.concentrationMl,form?.unitLabel,
    s?.id,s?.doseMode,s?.dose,s?.doseRange?.min,s?.doseRange?.max,s?.frequency,
    options.doseMode,options.weight,options.frequency,options.roundingStep,
    options.eligibility?.valid,options.eligibility?.errors]);
}
