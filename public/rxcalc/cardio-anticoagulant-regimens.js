/**
 * Explicit adult apixaban/rivaroxaban source candidates for the current catalogue.
 * This is a transcription of EMA product information, not an automatic treatment
 * selector. Resolve the ordinary human-regimen checks AND the extra eligibility
 * checks below; require each selectionRequirements confirmation in the UI.
 * CrCl is an assessed value in ml/min, not an inferred eGFR. Serum creatinine is
 * supplied separately in mg/dl and is used only for the apixaban NVAF rule.
 * Regimen phases are separate: no automatic transition or addition of courses.
 */
const CHECKED_AT = '2026-11-19';
const SOURCES = {
  apixaban: {
    sourceUrl: 'https://www.ema.europa.eu/en/documents/product-information/eliquis-epar-product-information_en.pdf',
    sourceLabel: 'ChPL Eliquis 2,5 mg / 5 mg · EMA (EN)',
    sourceDocumentDate: '2026-04-10',
  },
  rivaroxaban: {
    sourceUrl: 'https://www.ema.europa.eu/en/documents/product-information/xarelto-epar-product-information_en.pdf',
    sourceLabel: 'ChPL Xarelto 15 mg / 20 mg · EMA (EN)',
    sourceDocumentDate: '2026-09-22',
  },
};
const selection = (id, label, detail, sourceSection = '4.1–4.2') =>
  ({ id, label, detail, sourceSection });
const apiRenalScope = selection('apixaban-renal-scope',
  'Pacjent nie jest dializowany; oceniono nerkowy zakres zastosowania apiksabanu.',
  'CrCl <15 ml/min i dializoterapia są poza zakresem tych schematów. Przy CrCl 15–<30 ml/min należy uwzględnić zwiększoną ekspozycję i ryzyko krwawienia; w ŻChZZ i profilaktyce pooperacyjnej ChPL wymaga ostrożności.',
  '4.2: Renal impairment; 4.4: Patients with renal impairment');
const nvaf = selection('anticoagulant-nvaf-indication',
  'Potwierdzono niezastawkowe AF i co najmniej jeden czynnik ryzyka udaru lub zatorowości.',
  'ChPL wymienia m.in. przebyty udar/TIA, wiek ≥75 lat, nadciśnienie, cukrzycę lub niewydolność serca. Wybrano zwykły schemat długotrwały; nie jest to protokół kardiowersji, leczenia po PCI ani zmiany antykoagulantu.');
const sixMonths = selection('anticoagulant-vte-six-months',
  'Ukończono co najmniej 6 miesięcy leczenia ZŻG/ZP i podjęto decyzję o zapobieganiu nawrotom.',
  'Dotyczy przebytego leczenia, nie liczby dni planowanego zapasu. Sześciu miesięcy nie przeliczamy automatycznie na 180 dni.');
const vteDuration = 'Łączny czas leczenia ZŻG/ZP zależy od przyczyny zdarzenia, nawrotów i ryzyka krwawienia. ChPL opisuje co najmniej 3 miesiące przy określonych przemijających czynnikach ryzyka; nie jest to automatyczne minimum nowego zapasu ani 90 dni dopisywanych do każdego etapu.';
const apiScreening = 'Zakres automatycznej kontroli: wiek, wpisany CrCl i wybrane kryteria dawki. ChPL wymaga także oceny krwawienia, czynności wątroby i interakcji. Nie obejmuje to osobnego protokołu zmiany antykoagulantu, kardiowersji ani leczenia niestabilnej ZP.';
const rivScreening = 'Tabletki 15 mg i 20 mg podawać z posiłkiem. Oceń krwawienie, interakcje i przeciwwskazania z ChPL, w tym chorobę wątroby z koagulopatią oraz marskość Child-Pugh B/C. Te schematy nie opisują kardiowersji, leczenia po PCI ani zmiany antykoagulantu.';

function regimen(agent, data) {
  const source = SOURCES[agent];
  const apixaban = agent === 'apixaban';
  return {
    specialties: ['cardio'], patientTypes: ['adult'], minAgeMonths: 216,
    doseMode: 'fixed', requireCrCl: true, minCrCl: 15, lockSourceValues: true,
    patientFields: ['crcl'],
    ...source, sourceSection: '4.1–4.4', sourceCheckedAt: CHECKED_AT,
    clinicalReviewStatus: 'not-clinically-validated',
    administration: apixaban ? 'Doustnie, popijając wodą; niezależnie od posiłku.'
      : 'Doustnie, z posiłkiem.',
    screening: apixaban ? apiScreening : rivScreening,
    ...data,
    selectionRequirements: [
      ...(apixaban ? [apiRenalScope] : []), ...(data.selectionRequirements || []),
    ].map(requirement => ({ ...requirement, sourceUrl: source.sourceUrl, sourceCheckedAt: CHECKED_AT })),
  };
}

export const CARDIO_ANTICOAGULANT_REGIMENS = [
  regimen('apixaban', {
    id: 'cardio-eliquis-nvaf-standard', formIds: ['eliquis-5'],
    label: 'NVAF · 5 mg 2 razy/dobę · bez kryteriów redukcji',
    indication: 'Zapobieganie udarowi i zatorowości systemowej w niezastawkowym AF',
    phaseLabel: 'Leczenie długotrwałe', dose: 5, frequency: 2, minCrCl: 30,
    anticoagulantRule: 'apixaban-nvaf-standard',
    patientFields: ['crcl', 'weight', 'serumCreatinine'],
    selectionRequirements: [nvaf],
    notes: [
      'ChPL 4.2, NVAF: 5 mg na podanie, 2 razy na dobę. Ta dawka nie jest uniwersalnym maksimum apiksabanu.',
      'Wybrany wariant wymaga CrCl ≥30 ml/min i mniej niż 2 kryteriów: wiek ≥80 lat, masa ≤60 kg, kreatynina w surowicy ≥1,5 mg/dl. CrCl ocenia się niezależnie. Przy znanym wieku i masie kreatynina jest potrzebna do zliczenia kryteriów, gdy spełniono dokładnie jedno z dwóch pierwszych.',
      'Przy co najmniej 2 kryteriach albo CrCl 15–<30 ml/min należy osobno wybrać odpowiedni wariant 2,5 mg; dawka nie zmienia się automatycznie.',
      'ChPL opisuje terapię długotrwałą. Liczba dni w kalkulatorze planuje zapas, nie termin odstawienia.',
    ],
  }),
  regimen('apixaban', {
    id: 'cardio-eliquis-nvaf-two-criteria', formIds: ['eliquis-2.5'],
    label: 'NVAF · 2,5 mg 2 razy/dobę · co najmniej 2 z 3 kryteriów',
    indication: 'Zapobieganie udarowi i zatorowości systemowej w NVAF przy kryteriach redukcji',
    phaseLabel: 'Leczenie długotrwałe', dose: 2.5, frequency: 2, minCrCl: 30,
    anticoagulantRule: 'apixaban-nvaf-two-criteria',
    patientFields: ['crcl', 'weight', 'serumCreatinine'],
    selectionRequirements: [nvaf],
    notes: [
      'ChPL 4.2, Dose reduction: 2,5 mg 2 razy na dobę przy co najmniej 2 z 3 kryteriów: wiek ≥80 lat, masa ≤60 kg, kreatynina w surowicy ≥1,5 mg/dl (w ChPL również zaokrąglone 133 µmol/l). Formularz przyjmuje mg/dl lub µmol/l i normalizuje jednostki przed oceną kryterium.',
      'Reguła dotyczy NVAF; nie przenosi się jej na leczenie ZŻG/ZP ani na profilaktykę po endoprotezoplastyce.',
      'Ten wariant obejmuje CrCl ≥30 ml/min. Dla CrCl 15–<30 ml/min istnieje odrębny schemat, niezależny od liczby powyższych kryteriów.',
      'Leczenie jest długotrwałe; podana liczba dni oznacza okres zapasu.',
    ],
  }),
  regimen('apixaban', {
    id: 'cardio-eliquis-nvaf-severe-renal', formIds: ['eliquis-2.5'],
    label: 'NVAF · 2,5 mg 2 razy/dobę · CrCl 15–<30 ml/min',
    indication: 'Zapobieganie udarowi i zatorowości systemowej w NVAF przy ciężkim zaburzeniu czynności nerek',
    phaseLabel: 'Leczenie długotrwałe', dose: 2.5, frequency: 2,
    anticoagulantRule: 'apixaban-nvaf-severe-renal',
    selectionRequirements: [nvaf],
    notes: [
      'ChPL 4.2, Renal impairment: w NVAF przy CrCl 15–29 ml/min zaleca 2,5 mg 2 razy na dobę. W walidacji przedział jest ciągły: 15 ≤ CrCl <30 ml/min.',
      'Ten nerkowy warunek redukcji działa niezależnie od reguły 2 z 3 kryteriów. Nie wymaga dopisywania brakującego kryterium masy lub kreatyniny.',
      'Nie obejmuje dializoterapii ani CrCl <15 ml/min. Liczba dni planuje zapas leczenia długotrwałego.',
    ],
  }),
  regimen('apixaban', {
    id: 'cardio-eliquis-vte-initial', formIds: ['eliquis-5'],
    label: 'Ostra ZŻG/ZP · 10 mg 2 razy/dobę · pierwsze 7 dni',
    indication: 'Początkowe leczenie ostrej zakrzepicy żył głębokich lub zatorowości płucnej',
    phaseLabel: 'Dni 1–7', dose: 10, frequency: 2, fixedDays: 7,
    anticoagulantRule: 'apixaban-vte', maxDailyMg: 20,
    limitLabel: 'Maksimum w tabeli ChPL dla pierwszych 7 dni leczenia ZŻG/ZP',
    selectionRequirements: [selection('apixaban-vte-initial-phase',
      'Rozpoczynam pełny pierwszy 7-dniowy etap leczenia ostrej ZŻG lub stabilnej hemodynamicznie ZP.',
      'Nie rozpoczynaj kolejnych 7 dni u pacjenta będącego już w trakcie tego etapu. Schemat nie zastępuje heparyny w niestabilnej ZP ani przy planowanej trombolizie lub embolektomii.', '4.2: VTEt, Table 1; 4.4: Haemodynamically unstable PE')],
    notes: [
      'ChPL 4.2, tabela 1: przez pierwsze 7 dni 10 mg 2 razy na dobę; maksimum dobowe tej fazy wynosi 20 mg. Dla tabletki 5 mg oznacza to 2 całe tabletki na podanie.',
      'Po tym etapie ChPL przewiduje 5 mg 2 razy na dobę; kolejny etap wybiera się osobno. Nie przedłużamy dawki początkowej przez wpisanie większej liczby dni.',
      vteDuration,
    ],
  }),
  regimen('apixaban', {
    id: 'cardio-eliquis-vte-continuation', formIds: ['eliquis-5'],
    label: 'ZŻG/ZP · 5 mg 2 razy/dobę · od dnia 8',
    indication: 'Kontynuacja leczenia ZŻG/ZP po początkowym etapie apiksabanu',
    phaseLabel: 'Od dnia 8', dose: 5, frequency: 2,
    anticoagulantRule: 'apixaban-vte', maxDailyMg: 10,
    limitLabel: 'Maksimum w tabeli ChPL dla kontynuacji leczenia ZŻG/ZP',
    selectionRequirements: [selection('apixaban-vte-continuation-phase',
      'Ukończono pierwszy 7-dniowy etap 10 mg 2 razy/dobę i wybrano kontynuację leczenia ZŻG/ZP.',
      'To nie dawka początkowa ani zmniejszona dawka po ukończeniu 6 miesięcy. Łączny czas leczenia i długość bieżącego zapasu ustala lekarz.')],
    notes: [
      'ChPL 4.2, tabela 1: po początkowych 7 dniach 5 mg 2 razy na dobę; maksimum dobowe tego etapu wynosi 10 mg.',
      'Redukcji NVAF według wieku, masy i kreatyniny nie przenosimy na tę fazę leczenia ZŻG/ZP. Przy CrCl 15–<30 ml/min ChPL wymaga ostrożności.',
      vteDuration,
    ],
  }),
  regimen('apixaban', {
    id: 'cardio-eliquis-vte-extended', formIds: ['eliquis-2.5'],
    label: 'Nawroty ZŻG/ZP · 2,5 mg 2 razy/dobę · po 6 miesiącach leczenia',
    indication: 'Zapobieganie nawrotom ZŻG/ZP po ukończeniu wcześniejszego leczenia',
    phaseLabel: 'Po ukończeniu 6 miesięcy', dose: 2.5, frequency: 2,
    anticoagulantRule: 'apixaban-vte', maxDailyMg: 5,
    limitLabel: 'Maksimum w tabeli ChPL dla zapobiegania nawrotom po 6 miesiącach',
    selectionRequirements: [sixMonths],
    notes: [
      'ChPL 4.2, tabela 1: 2,5 mg 2 razy na dobę po ukończeniu 6 miesięcy leczenia apiksabanem 5 mg 2 razy/dobę lub innym antykoagulantem; maksimum tego schematu wynosi 5 mg/dobę.',
      'To odrębna faza leczenia, nie automatyczna redukcja ze względu na wiek lub masę. Kolejny okres leczenia wynika z indywidualnej oceny korzyści i krwawienia.',
    ],
  }),
  ...[
    { joint: 'hip', label: 'biodrowego', minDays: 32, maxDays: 38 },
    { joint: 'knee', label: 'kolanowego', minDays: 10, maxDays: 14 },
  ].map(({ joint, label, minDays, maxDays }) => regimen('apixaban', {
    id: `cardio-eliquis-post-${joint}`, formIds: ['eliquis-2.5'],
    label: `Po endoprotezoplastyce stawu ${label} · 2,5 mg 2 razy/dobę · ${minDays}–${maxDays} dni`,
    indication: `Profilaktyka ŻChZZ po planowej endoprotezoplastyce stawu ${label}`,
    phaseLabel: 'Profilaktyka pooperacyjna', dose: 2.5, frequency: 2, minDays, maxDays,
    anticoagulantRule: 'apixaban-postoperative',
    selectionRequirements: [selection(`apixaban-elective-${joint}-replacement`,
      `Potwierdzono planową endoprotezoplastykę stawu ${label} i ustalono rozpoczęcie 12–24 godziny po zabiegu.`,
      `Wybór dotyczy pełnego planowanego okresu ${minDays}–${maxDays} dni; nie służy ponownemu rozpoczynaniu profilaktyki przy wystawianiu zapasu w trakcie jej trwania. Uwzględniono ryzyko krwawienia po zabiegu.`)],
    notes: [
      `ChPL 4.2, VTEp: po planowej wymianie stawu ${label} 2,5 mg 2 razy na dobę; początek 12–24 godziny po operacji, czas ${minDays}–${maxDays} dni. Konkretnej długości z zakresu nie wybieramy automatycznie.`,
      'Reguła 2 z 3 kryteriów NVAF nie dotyczy tego wskazania. Przy CrCl 15–<30 ml/min należy zachować ostrożność; przy <15 ml/min lub dializoterapii apiksaban nie jest zalecany.',
    ],
  })),
  regimen('rivaroxaban', {
    id: 'cardio-xarelto-nvaf-standard', formIds: ['xarelto-20'],
    label: 'NVAF · 20 mg raz/dobę · CrCl ≥50 ml/min',
    indication: 'Zapobieganie udarowi i zatorowości systemowej w niezastawkowym AF',
    phaseLabel: 'Leczenie długotrwałe', dose: 20, frequency: 1, minCrCl: 50,
    anticoagulantRule: 'rivaroxaban-nvaf-standard', maxDailyMg: 20,
    limitLabel: 'Zalecana dawka maksymalna wyłącznie w tym schemacie NVAF',
    selectionRequirements: [nvaf],
    notes: [
      'ChPL Xarelto 15/20 mg, 4.2: w NVAF 20 mg raz na dobę jest dawką zalecaną i zalecaną maksymalną. Przy CrCl <50 ml/min należy wybrać odrębny wariant 15 mg, nie zmieniać dawki automatycznie.',
      'Długotrwale, dopóki korzyść z zapobiegania zatorowości przewyższa ryzyko krwawienia. Dni służą planowaniu zapasu.',
    ],
  }),
  regimen('rivaroxaban', {
    id: 'cardio-xarelto-nvaf-renal', formIds: ['xarelto-15'],
    label: 'NVAF · 15 mg raz/dobę · CrCl 15–<50 ml/min',
    indication: 'Zapobieganie udarowi i zatorowości systemowej w NVAF przy zaburzonej czynności nerek',
    phaseLabel: 'Leczenie długotrwałe', dose: 15, frequency: 1,
    anticoagulantRule: 'rivaroxaban-nvaf-renal',
    selectionRequirements: [nvaf, selection('rivaroxaban-renal-nvaf-review',
      'Wybrano nerkowy schemat NVAF; przy CrCl 15–<30 ml/min uwzględniono szczególną ostrożność.',
      'Nie jest to schemat po PCI ani dawka początkowa leczenia ZŻG/ZP.', '4.2: Renal impairment; 4.4: Renal impairment')],
    notes: [
      'ChPL 4.2: w NVAF przy CrCl 30–49 lub 15–29 ml/min zaleca 15 mg raz na dobę. Przedział walidacji: 15 ≤ CrCl <50 ml/min; przy <30 ml/min obowiązuje ostrożność.',
      'Wiek lub masa ciała same nie uruchamiają redukcji takiej jak reguła NVAF dla apiksabanu. Liczba dni określa zapas terapii długotrwałej.',
    ],
  }),
  regimen('rivaroxaban', {
    id: 'cardio-xarelto-vte-initial', formIds: ['xarelto-15'],
    label: 'Ostra ZŻG/ZP · 15 mg 2 razy/dobę · pierwsze 21 dni',
    indication: 'Początkowe leczenie ostrej zakrzepicy żył głębokich lub zatorowości płucnej',
    phaseLabel: 'Dni 1–21', dose: 15, frequency: 2, fixedDays: 21,
    anticoagulantRule: 'rivaroxaban-vte',
    selectionRequirements: [selection('rivaroxaban-vte-initial-phase',
      'Rozpoczynam pełny pierwszy 21-dniowy etap leczenia ostrej ZŻG lub stabilnej hemodynamicznie ZP.',
      'Przy CrCl 15–<30 ml/min oceniono ostrożne stosowanie. Nie rozpoczynaj kolejnych 21 dni w środku fazy. To nie zastępstwo heparyny przy niestabilnej ZP, planowanej trombolizie lub embolektomii.', '4.2: DVT/PE; 4.4: Haemodynamically unstable PE')],
    notes: [
      'ChPL 4.2: przez pierwsze 3 tygodnie 15 mg 2 razy na dobę, łącznie 30 mg/dobę. Tabela opisuje łączną dawkę fazy, nie uniwersalne maksimum rywaroksabanu.',
      'W CrCl 15–<50 ml/min początkowy schemat nadal wynosi 15 mg 2 razy/dobę; dawka NVAF 15 mg raz/dobę nie jest jego zamiennikiem.',
      'Od dnia 22 stosuje się odrębny schemat. Nie dodajemy go automatycznie do wyniku ani nie przedłużamy fazy początkowej.',
      vteDuration,
    ],
  }),
  regimen('rivaroxaban', {
    id: 'cardio-xarelto-vte-continuation', formIds: ['xarelto-20'],
    label: 'ZŻG/ZP · 20 mg raz/dobę · od dnia 22',
    indication: 'Kontynuacja leczenia i zapobieganie nawrotom ZŻG/ZP po początkowej fazie rywaroksabanu',
    phaseLabel: 'Od dnia 22', dose: 20, frequency: 1,
    anticoagulantRule: 'rivaroxaban-vte',
    selectionRequirements: [selection('rivaroxaban-vte-continuation-phase',
      'Ukończono początkowe 21 dni 15 mg 2 razy/dobę i wybrano kontynuację 20 mg raz/dobę.',
      'Przy CrCl 15–<50 ml/min oceniono, czy ryzyko krwawienia uzasadnia odrębny wariant 15 mg; redukcja nie jest automatyczna. Przy CrCl <30 ml/min obowiązuje ostrożność.')],
    notes: [
      'ChPL 4.2: od dnia 22 dawka wynosi 20 mg raz na dobę. Nie jest to początkowy schemat ostrej ZŻG/ZP.',
      'Przy CrCl 15–<50 ml/min można rozważyć odrębne 15 mg raz/dobę, wyłącznie gdy ryzyko krwawienia przeważa nad ryzykiem nawrotu; ChPL podaje ograniczenia dowodów dla tej redukcji.',
      vteDuration,
    ],
  }),
  regimen('rivaroxaban', {
    id: 'cardio-xarelto-vte-renal-reduced', formIds: ['xarelto-15'],
    label: 'ZŻG/ZP · rozważona redukcja 15 mg raz/dobę · po dniu 21, CrCl 15–<50',
    indication: 'Kontynuacja leczenia ZŻG/ZP z indywidualnie rozważoną redukcją nerkową',
    phaseLabel: 'Po początkowych 21 dniach', dose: 15, frequency: 1,
    anticoagulantRule: 'rivaroxaban-vte-reduced',
    selectionRequirements: [selection('rivaroxaban-vte-reduced-phase',
      'Ukończono początkowe 21 dni, a dalszy standardowy schemat w tym wskazaniu wynosiłby 20 mg raz/dobę.',
      'Nie dotyczy fazy 15 mg 2 razy/dobę ani sytuacji, w której zalecanym schematem profilaktyki nawrotów jest 10 mg raz/dobę.'),
    selection('rivaroxaban-vte-bleeding-over-recurrence',
      'Ocenione ryzyko krwawienia przeważa nad ryzykiem nawrotu ZŻG/ZP; zdecydowano o 15 mg raz/dobę.',
      'ChPL opiera tę redukcję na modelowaniu farmakokinetycznym; nie została zbadana klinicznie w tym zastosowaniu. CrCl 15–<30 ml/min wymaga dodatkowej ostrożności.', '4.2: Renal impairment')],
    notes: [
      'ChPL 4.2, Renal impairment: przy CrCl 15–49 ml/min, po pierwszych 3 tygodniach, można rozważyć 15 zamiast 20 mg raz/dobę, jeżeli ocenione ryzyko krwawienia jest większe niż ryzyko nawrotu ZŻG/ZP.',
      'To warunkowa możliwość oparta na modelowaniu farmakokinetycznym, bez badania klinicznego tej redukcji w tym zastosowaniu. Nie jest automatycznym następstwem CrCl <50 ml/min.',
      vteDuration,
    ],
  }),
  regimen('rivaroxaban', {
    id: 'cardio-xarelto-vte-extended-high-risk', formIds: ['xarelto-20'],
    label: 'Nawroty ZŻG/ZP · 20 mg raz/dobę · po ≥6 miesiącach, wysokie ryzyko',
    indication: 'Przedłużone zapobieganie nawrotom ZŻG/ZP przy ocenionym wysokim ryzyku nawrotu',
    phaseLabel: 'Po co najmniej 6 miesiącach', dose: 20, frequency: 1,
    anticoagulantRule: 'rivaroxaban-vte',
    selectionRequirements: [sixMonths, selection('rivaroxaban-vte-high-recurrence-risk',
      'Oceniono wysokie ryzyko nawrotu lub nawrót mimo profilaktyki 10 mg/dobę i wybrano wariant 20 mg/dobę.',
      'ChPL jako ogólną dawkę przedłużonej profilaktyki podaje 10 mg/dobę. 20 mg jest wariantem do rozważenia np. przy powikłanych chorobach współistniejących; wybór uwzględnia ryzyko krwawienia i czynność nerek.')],
    notes: [
      'ChPL 4.2: po co najmniej 6 miesiącach leczenia zalecaną dawką przedłużonej profilaktyki jest 10 mg raz/dobę. Przy wysokim ryzyku nawrotu lub nawrocie podczas 10 mg należy rozważyć 20 mg raz/dobę.',
      'Katalog tej aplikacji zawiera tylko Xarelto 15 mg i 20 mg. Nie zastępuj brakującej tabletki 10 mg połową 20 mg ani dawką 15 mg.',
      'Jeżeli przy CrCl 15–<50 ml/min wybrano schemat 20 mg/dobę, ChPL pozwala rozważyć 15 mg/dobę wyłącznie po ocenie przewagi ryzyka krwawienia nad ryzykiem nawrotu; nie redukuj dawki automatycznie.',
      'Dalszy czas leczenia i wybór dawki wymagają indywidualnej oceny. CrCl <15 ml/min wyklucza ten zakres; przy 15–<30 ml/min należy zachować ostrożność.',
    ],
  }),
];

const RULES = new Set([
  'apixaban-nvaf-standard', 'apixaban-nvaf-two-criteria', 'apixaban-nvaf-severe-renal',
  'apixaban-vte', 'apixaban-postoperative',
  'rivaroxaban-nvaf-standard', 'rivaroxaban-nvaf-renal', 'rivaroxaban-vte', 'rivaroxaban-vte-reduced',
]);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const positive = value => finite(value) && value > 0;
const absent = value => value === null || value === undefined || value === '';
const same = (a, b) => finite(a) && finite(b)
  && Math.abs(a - b) <= Number.EPSILON * 32 * Math.max(1, Math.abs(a), Math.abs(b));

/** Partial evaluation of the NVAF 2-of-3 rule only; renal eligibility is separate.
 * EMA Eliquis 4.2, checked 2026-11-21. Unknown is never treated as false.
 * Both age and actual body weight remain required. An entered invalid creatinine
 * is rejected by the assessor even when the count is already decided.
 */
export function apixabanReductionCriteria(record, context = {}) {
  if (!['apixaban-nvaf-standard', 'apixaban-nvaf-two-criteria'].includes(record?.anticoagulantRule)) return null;
  if (!context || typeof context !== 'object' || Array.isArray(context)) context = {};
  let age = null;
  if (finite(context.age) && context.age >= 0 && ['years', 'months', 'days'].includes(context.ageUnit)) {
    const low = context.ageUnit === 'years' ? context.age * 12 : context.ageUnit === 'months' ? context.age : context.age / 31;
    const high = context.ageUnit === 'years' ? context.age * 12 : context.ageUnit === 'months' ? context.age : context.age / 28;
    if (low >= 960) age = true;
    else if (high < 960) age = false;
  }
  const weight = positive(context.weight) && context.weight <= 500 ? context.weight <= 60 : null;
  const creatinine = positive(context.serumCreatinine) ? context.serumCreatinine >= 1.5 : null;
  const known = age !== null && weight !== null;
  const firstTwo = Number(age === true) + Number(weight === true);
  const requiresCreatinine = !known || firstTwo === 1;
  const decided = known && (creatinine !== null || !requiresCreatinine);
  const minimumCount = firstTwo + Number(creatinine === true);
  return { age, weight, creatinine, requiresCreatinine,
    minimumCount, maximumCount: minimumCount + Number(age === null) + Number(weight === null) + Number(creatinine === null),
    reduction: decided ? minimumCount >= 2 : null };
}

/** Extra patient/phase-dose checks only. The caller still runs the ordinary
 * human resolver for identity, adult age, duration, limits and sourceConfirmations.
 * Does not choose a record, fill a field, calculate CrCl or assert full clinical
 * suitability. Unknown rules fail closed; unrelated records receive no checks.
 */
export function assessAnticoagulantEligibility(record, context = {}) {
  const result = { errors: [], warnings: [], requirements: [], issues: [] };
  const issue = (code, field, kind, message) => {
    result.errors.push(message);
    result.issues.push({ code, field, kind, message });
  };
  if (!record?.anticoagulantRule) return result;
  const rule = record.anticoagulantRule;
  if (!RULES.has(rule)) {
    result.errors.push('Nieznana reguła kwalifikacji schematu przeciwkrzepliwego.');
    return result;
  }
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    result.errors.push('Brak poprawnego kontekstu dla schematu przeciwkrzepliwego.');
    return result;
  }
  // The caller presents one explicit bypass notice. Other criteria and fixed
  // phase doses remain checked below, including the separate NVAF 2-of-3 rule.
  result.crclIgnored = context.ignoreCrCl === true;
  if (!result.crclIgnored) {
    result.requirements.push('crcl');
    const crcl = context.crcl;
    if (!positive(crcl)) issue(absent(crcl) ? 'missing-crcl' : 'invalid-crcl', 'crcl', absent(crcl) ? 'missing' : 'invalid', absent(crcl) ? 'Uzupełnij oceniony klirens kreatyniny CrCl w ml/min.' : 'Podaj poprawny klirens kreatyniny CrCl w ml/min.');
    else if (crcl < 15) issue('crcl-out-of-scope', 'crcl', 'out-of-scope', 'CrCl <15 ml/min jest poza zakresem tego schematu z ChPL.');
    else {
      if (['apixaban-nvaf-standard', 'apixaban-nvaf-two-criteria'].includes(rule) && crcl < 30)
        issue('crcl-out-of-scope', 'crcl', 'out-of-scope', 'Ten wariant NVAF wymaga CrCl ≥30 ml/min; dla 15–<30 ml/min wybierz odrębny wariant.');
      if (rule === 'apixaban-nvaf-severe-renal' && crcl >= 30)
        issue('crcl-out-of-scope', 'crcl', 'out-of-scope', 'Nerkowy wariant apiksabanu 2,5 mg dotyczy wyłącznie CrCl 15–<30 ml/min.');
      if (rule === 'rivaroxaban-nvaf-standard' && crcl < 50)
        issue('crcl-out-of-scope', 'crcl', 'out-of-scope', 'Wariant rywaroksabanu 20 mg w NVAF wymaga CrCl ≥50 ml/min.');
      if (['rivaroxaban-nvaf-renal', 'rivaroxaban-vte-reduced'].includes(rule) && crcl >= 50)
        issue('crcl-out-of-scope', 'crcl', 'out-of-scope', 'Wybrany nerkowy wariant rywaroksabanu dotyczy wyłącznie CrCl 15–<50 ml/min.');
      if (crcl < 30) result.warnings.push('CrCl 15–<30 ml/min: zwiększona ekspozycja i ryzyko krwawienia wymagają ostrożności według ChPL.');
      if (rule === 'rivaroxaban-vte' && crcl < 50 && record.dose === 20)
        result.warnings.push('Przy CrCl 15–<50 ml/min ChPL pozwala rozważyć 15 zamiast 20 mg raz/dobę tylko po porównaniu ryzyka krwawienia i nawrotu. Nie zastosowano redukcji automatycznie.');
    }
  }

  if (['apixaban-nvaf-standard', 'apixaban-nvaf-two-criteria'].includes(rule)) {
    result.requirements.push('age', 'weight');
    const criteria = apixabanReductionCriteria(record, context);
    if (criteria.requiresCreatinine) result.requirements.push('serumCreatinine');
    let ageCriterion = null;
    if (!finite(context.age) || context.age < 0 || !['years', 'months', 'days'].includes(context.ageUnit)) {
      issue(absent(context.age) ? 'missing-age' : 'invalid-age', 'age', absent(context.age) ? 'missing' : 'invalid', 'Podaj wiek i jego jednostkę, aby sprawdzić kryterium ≥80 lat w NVAF.');
    } else {
      const lowMonths = context.ageUnit === 'years' ? context.age * 12
        : context.ageUnit === 'months' ? context.age : context.age / 31;
      const highMonths = context.ageUnit === 'years' ? context.age * 12
        : context.ageUnit === 'months' ? context.age : context.age / 28;
      if (lowMonths >= 960) ageCriterion = true;
      else if (highMonths < 960) ageCriterion = false;
      else issue('ambiguous-age', 'age', 'invalid', 'Wiek w dniach jest niejednoznaczny przy progu 80 lat. Podaj wiek w latach lub ukończonych miesiącach.');
    }
    if (!positive(context.weight) || context.weight > 500)
      issue(absent(context.weight) ? 'missing-weight' : 'invalid-weight', 'weight', absent(context.weight) ? 'missing' : 'invalid', 'Podaj prawidłową masę w kg, aby sprawdzić kryterium ≤60 kg w NVAF.');
    if (!positive(context.serumCreatinine) && (criteria.requiresCreatinine || !absent(context.serumCreatinine)))
      issue(absent(context.serumCreatinine) ? 'missing-serum-creatinine' : 'invalid-serum-creatinine', 'serumCreatinine', absent(context.serumCreatinine) ? 'missing' : 'invalid', 'Podaj kreatyninę w surowicy w mg/dl, aby sprawdzić kryterium ≥1,5 mg/dl w NVAF.');
    if (criteria.reduction !== null) {
      if (rule === 'apixaban-nvaf-standard' && criteria.reduction)
        issue('nvaf-reduction-mismatch', 'source', 'out-of-scope', 'Spełniono co najmniej 2 z 3 kryteriów redukcji NVAF. Wybrany wariant 5 mg nie odpowiada tej regule ChPL.');
      if (rule === 'apixaban-nvaf-two-criteria' && !criteria.reduction)
        issue('nvaf-reduction-mismatch', 'source', 'out-of-scope', 'Nie potwierdzono co najmniej 2 z 3 kryteriów wymaganych dla tego wariantu 2,5 mg w NVAF.');
    }
  }
  if (rule === 'rivaroxaban-vte-reduced') result.warnings.push('Redukcja do 15 mg w tym zastosowaniu opiera się na modelowaniu farmakokinetycznym i nie została zbadana klinicznie.');

  // Fixed source phases must not silently become a different anticoagulant
  // schedule through the generic source-edit override. An empty value can still
  // be filled by explicit source selection; the ordinary resolver handles it.
  if (record.lockSourceValues === true) {
    if (!absent(context.dose) && !same(context.dose, record.dose))
      result.errors.push('Dawka różni się od stałej dawki tego schematu przeciwkrzepliwego; wybierz właściwe wskazanie i etap.');
    if (!absent(context.frequency) && !same(context.frequency, record.frequency))
      result.errors.push('Częstotliwość różni się od stałej częstości tego schematu przeciwkrzepliwego.');
  }
  result.requirements = [...new Set(result.requirements)];
  return result;
}
