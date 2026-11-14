import { formatNumber as n } from './engine.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const missing = value => value === null || value === undefined || value === '';
const close = (a,b) => Math.abs(a-b) <= Number.EPSILON * 64 * Math.max(1,Math.abs(a),Math.abs(b));

// Literal DAILY totals of the 875/125 mg TABLET regimens, not independently
// established substance maxima and not limits for the 400/57 mg suspension.
// Polish RPL 7496, section 4.2, p.2; checked 2026-11-14.
export const AUGMENTIN_TABLET_REFERENCES = Object.freeze({
  sourceUrl:'https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/7496/characteristic',
  productSourceUrl:'https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/8695/characteristic',
  checkedAt:'2026-11-14',
  rows:Object.freeze({
    amoksycylina:Object.freeze({a:1750,b:2625}),
    'kwas klawulanowy':Object.freeze({a:250,b:375}),
  }),
});

/** Presentation-only references. Never passed to calculate(), limits, regimen
 * selection, prescription generation or copy eligibility. Unknown weight in an
 * explicitly adult profile permits an arithmetic comparison, not qualification.
 */
export function adultAugmentinReference({formId,patientType,input={},source=null,renalStatus='unknown',crcl=null}={}) {
  if (formId !== 'augmentin-400-57' || input.patientKind !== 'human' || source) return null;
  if (patientType !== 'adult' && !(patientType === 'child' && positive(input.weight) && input.weight >= 40)) return null;
  const warnings=[];
  let compare=true;
  if (missing(input.weight)) warnings.push('Masa niepodana — zakres ≥40 kg niepotwierdzony.');
  else if (!positive(input.weight) || input.weight > 500) { compare=false;warnings.push('Nieprawidłowa masa — porównanie wstrzymane.'); }
  else if (input.weight < 40) { compare=false;warnings.push('Masa poniżej 40 kg — te odniesienia nie dotyczą tego zakresu masy.'); }
  if (!missing(input.age) && (typeof input.age !== 'number' || !Number.isFinite(input.age) || input.age < 0 || input.age > 120)) {
    compare=false;warnings.push('Nieprawidłowy wiek — porównanie wstrzymane.');
  }
  if (renalStatus === 'impaired' || !missing(crcl) && (!positive(crcl) || crcl <= 30)) {
    compare=false;warnings.push('Podane dane nerkowe wymagają odrębnej oceny. Pokazano tylko wartości źródłowe, bez porównania dawki.');
  }
  return {...AUGMENTIN_TABLET_REFERENCES,compare,warnings};
}

export function referenceMeterModel(row={},reference=null) {
  const values=reference?.rows?.[String(row.name||'').trim().toLocaleLowerCase('pl')];
  if (!values || row.unit !== 'mg' || !positive(values.a) || !positive(values.b) || values.a >= values.b) return null;
  const {a,b}=values;
  const base={a,b,markerA:a/b*80,markerB:80,scaleEnd:b*1.25,fill:null,ratioA:null,ratioB:null,clipped:false};
  if (!reference.compare) return {...base,state:'unconfirmed'};
  if (!positive(row.daily)) return {...base,state:'pending'};
  const ratioA=close(row.daily,a)?1:row.daily/a,ratioB=close(row.daily,b)?1:row.daily/b;
  if (!Number.isFinite(ratioA) || !Number.isFinite(ratioB)) return {...base,state:'unconfirmed'};
  return {...base,state:ratioB>1?'above-b':ratioA>1?'above-a':'compared',
    fill:Math.min(ratioB,1.25)*80,ratioA,ratioB,clipped:ratioB>1.25};
}

const percentage = ratio => ratio>1&&ratio*100<100.01?'>100':ratio<1&&ratio*100>99.99?'<100':ratio>0&&ratio*100<.01?'<0,01':n(ratio*100,2);

export function referenceMeterMarkup(row,reference) {
  const m=referenceMeterModel(row,reference);
  if (!m) return '';
  const numeric=m.ratioA!==null;
  const status=m.state==='unconfirmed'?'Tylko wartości źródłowe — bez porównania'
    :m.state==='pending'?'Uzupełnij dawkę i częstotliwość'
    :m.state==='above-b'?'Powyżej odniesienia B — sprawdź schemat'
    :m.state==='above-a'?'Powyżej A, nie powyżej B — to nie ocena dawki'
    :'';
  const description=`${row.name}. Odniesienie A: ${n(m.a)} mg/dobę. Odniesienie B: ${n(m.b)} mg/dobę. ${numeric?`Aktualnie ${n(row.daily,6)} mg/dobę; ${percentage(m.ratioA)}% A, ${percentage(m.ratioB)}% B.`:status} To nie limit dla pacjenta. ${m.clipped?'Wartość wykracza poza skalę paska.':''}`;
  return `<div class="dose-reference-row"><div class="dose-reference-values"><span><b>A</b> ${n(m.a)} <small>mg/dobę</small></span><span><b>B</b> ${n(m.b)} <small>mg/dobę</small></span></div><div class="dose-reference-meter ${m.state}" role="img" aria-label="${esc(description)}"><span class="dose-reference-track"></span>${numeric?`<span class="dose-reference-fill" style="width:${m.fill}%"></span>`:''}<span class="dose-reference-marker marker-a" style="left:${m.markerA}%" aria-hidden="true"></span><span class="dose-reference-marker marker-b" aria-hidden="true"></span>${m.clipped?'<span class="dose-reference-overflow" aria-hidden="true">›</span>':''}</div><div class="dose-reference-axis" aria-hidden="true"><span>0</span><span style="left:${m.markerA}%">A</span><span class="axis-b">B</span></div><div class="dose-reference-status ${m.state}">${status ? `<span>${esc(status)}</span>` : ''}${numeric?`<strong>${esc(percentage(m.ratioA))}% A · ${esc(percentage(m.ratioB))}% B</strong>`:''}</div>${m.clipped?'<p class="dose-reference-clipped">Pasek kończy się na 125% B; rzeczywiste wartości są podane liczbowo.</p>':''}</div>`;
}

export function referenceIntroMarkup(reference) {
  if (!reference) return '';
  return `<div class="dose-reference-intro"><strong>Odniesienia z ChPL tabletek 875/125 mg</strong><span class="dose-reference-badge">Porównanie · nie limit pacjenta</span><p><b>A</b> — 2 × na dobę · schemat standardowy<br><b>B</b> — 3 × na dobę · większy schemat</p><p>Dane źródłowe dla dorosłych i dzieci ≥40 kg.</p>${reference.warnings.map(w=>`<p class="dose-reference-warning">${esc(w)}</p>`).join('')}</div>`;
}

export function referenceDetailsMarkup(reference) {
  if (!reference) return '';
  return `<div class="dose-reference-footnote"><strong>To nie są limity tej zawiesiny.</strong> Kreski nie wyznaczają dawki docelowej ani nie potwierdzają bezpieczeństwa. Limit dla pacjenta wymaga odrębnego ustalenia.</div><details class="dose-reference-details"><summary>Źródła i znaczenie kresek A/B</summary><p>Wartości A/B pochodzą z punktu 4.2 polskiej ChPL tabletek Augmentin 875 mg + 125 mg. Nie są niezależnymi maksymalnymi dawkami substancji.</p><p>Większy schemat B dokument wymienia szczególnie przy zakażeniach ucha, zatok, dolnych dróg oddechowych i dróg moczowych. Nie wybieramy go automatycznie dla zakażenia stomatologicznego.</p><p>Wybrany preparat to zawiesina 400/57 mg/5 ml. Jej polska ChPL nie podaje analogicznego liczbowego schematu dla dorosłych. Bieżące ilości liczymy z proporcji 400:57, a kreski zachowują wartości tabletek — dlatego procenty składników mogą się nieznacznie różnić.</p><p>To wyłącznie porównanie ilości, nie zalecenie zamiany postaci. Dawka, częstość, masa, czynność nerek i wskazanie wymagają osobnej oceny. Uwzględnij inne leki z tymi samymi składnikami. Żaden punkt nie uzupełnia dawki ani nie zmienia kontroli i kopiowania.</p><a href="${reference.sourceUrl}" target="_blank" rel="noopener noreferrer">ChPL tabletek 875/125 mg · §4.2 ↗</a><a href="${reference.productSourceUrl}" target="_blank" rel="noopener noreferrer">ChPL wybranej zawiesiny 400/57 · §2, 4.2 ↗</a><small>Źródła sprawdzone: ${reference.checkedAt}. Testy programu nie są walidacją kliniczną.</small></details>`;
}
