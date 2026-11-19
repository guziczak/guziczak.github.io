/**
 * Explicit adult choices for the exact products already present in the catalogue.
 * Dose ranges remain clinician choices. A named titration phase never advances
 * itself, and a source ceiling is not a proposed maintenance dose.
 *
 * Betaloc ZOK source doses use the product's tartrate-equivalent naming convention;
 * calculator mg always means the actual metoprolol succinate amount (factor 0.95).
 * These records deliberately do not cover every clinical or paediatric situation.
 */
const CHECKED_AT = '2026-11-19';
const rpl = id => `https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/${id}/characteristic`;
const SOURCES = {
  betaloc: { sourceUrl: rpl(7778), sourceLabel: 'ChPL Betaloc ZOK 25/50/100 · RPL', sourceDocumentDate: '2026-07' },
  ramipril: { sourceUrl: rpl(30040), sourceLabel: 'ChPL Ramipril Krka 5/10 mg · RPL', sourceDocumentDate: '2019-09-13' },
  toramide: { sourceUrl: rpl(14012), sourceLabel: 'ChPL Toramide 2,5/5/10 mg · RPL' },
  atoris: { sourceUrl: rpl(11340), sourceLabel: 'ChPL Atoris 10/20/40 mg · RPL', sourceDocumentDate: '2025-01-15' },
};
const n = value => String(value).replace('.', ',');
const adultSource = key => ({
  ...SOURCES[key], sourceSection: '2–3, 4.1–4.5', sourceCheckedAt: CHECKED_AT,
  specialties: ['cardio'], patientTypes: ['adult'], minAgeMonths: 216,
  doseMode: 'fixed', frequency: 1, lockSourceValues: true,
  clinicalReviewStatus: 'not-clinically-validated',
});
const requirement = (id, label, detail) => ({ id, label, ...(detail ? { detail } : {}) });

const BETALOC_FORMS = ['betaloc-zok-25', 'betaloc-zok-50', 'betaloc-zok-100'];
const betalocRequirements = [
  requirement('betaloc-cardiac-eligibility', 'Oceniono tętno, przewodzenie i stabilność krążenia; nie ma przeciwwskazań do tego schematu.',
    'Schemat nie obejmuje m.in. wstrząsu, niewyrównanej niewydolności serca, istotnej bradykardii ani bloku przedsionkowo-komorowego II–III stopnia.'),
  requirement('betaloc-standard-hepatic-scope', 'Nie występuje ciężka niewydolność wątroby wymagająca indywidualnego ustalenia mniejszej dawki.'),
];
const betalocNotes = [
  'Wartości mg w kalkulatorze oznaczają bursztynian metoprololu. Nazwy dawek ZOK 25/50/100/200 odpowiadają kolejno 23,75/47,5/95/190 mg bursztynianu; nie wpisuj liczby z nazwy ZOK jako mg bursztynianu.',
  'Równe połowy są dopuszczone tylko dla tabletki ZOK 25. ZOK 50 i ZOK 100 nie są dzielone na równe dawki.',
  'ChPL nie wymaga rutynowej zmiany dawki z powodu zaburzeń nerek. Ciężka niewydolność wątroby wymaga osobnej oceny zmniejszenia dawki.',
];
const betalocBase = () => ({
  ...adultSource('betaloc'), selectionRequirements: [...betalocRequirements],
  screening: 'Sprawdź przeciwwskazania, interakcje, ciśnienie, tętno i tolerancję. Wybór etapu nie uruchamia kolejnego zwiększenia dawki.',
  administration: 'Doustnie raz na dobę; z posiłkiem lub niezależnie od niego. Popić płynem; nie żuć ani nie kruszyć tabletek lub dopuszczonej połowy ZOK 25.',
  notes: [...betalocNotes],
});
const succinate = zok => Number((zok * 0.95).toPrecision(12));
const betalocFixed = ({ id, zok, formIds, label, indication, phaseLabel, requirements = [], notes = [], ...extra }) => ({
  ...betalocBase(), id: `cardio-betaloc-${id}`, formIds, label, indication, phaseLabel,
  dose: succinate(zok),
  selectionRequirements: [...betalocRequirements, ...requirements],
  notes: [...betalocNotes, ...notes], ...extra,
});
const betalocRange = ({ id, label, indication, requirements = [], notes = [] }) => ({
  ...betalocBase(), id: `cardio-betaloc-${id}`, formIds: [...BETALOC_FORMS], label, indication,
  phaseLabel: '100–200 mg w nazewnictwie ZOK = 95–190 mg bursztynianu, raz na dobę; dawkę wybiera lekarz',
  doseRange: { min: 95, max: 190 }, maxDailyMg: 190,
  limitLabel: 'Górna granica zakresu wybranego wskazania: ZOK 200 = 190 mg bursztynianu/dobę',
  selectionRequirements: [...betalocRequirements, ...requirements], notes: [...betalocNotes, ...notes],
});
const hfStable = requirement('betaloc-hf-stable', 'Przewlekła niewydolność serca jest ustabilizowana standardowym leczeniem.');
const hfTitration = requirement('betaloc-hf-titration-reviewed', 'Oceniono tolerancję poprzedniej dawki i właściwy odstęp przed wybranym etapem miareczkowania.',
  'ChPL opisuje podwajanie dawki co dwa tygodnie; szczególny początek w NYHA III–IV to połowa ZOK 25 w pierwszym tygodniu.');
const BETALOC_REGIMENS = [
  betalocFixed({ id: 'hypertension-initial', zok: 50, formIds: BETALOC_FORMS.slice(0, 2),
    label: 'Nadciśnienie łagodne lub umiarkowane · dawka początkowa ZOK 50', indication: 'Łagodne lub umiarkowane nadciśnienie tętnicze',
    phaseLabel: '47,5 mg bursztynianu (ZOK 50) raz na dobę' }),
  betalocRange({ id: 'hypertension-increased', label: 'Nadciśnienie · zwiększenie po niewystarczającej odpowiedzi na ZOK 50', indication: 'Nadciśnienie tętnicze z niewystarczającą odpowiedzią na ZOK 50 raz na dobę',
    requirements: [requirement('betaloc-hypertension-increase', 'Odpowiedź na ZOK 50 była niewystarczająca; lekarz zdecydował o zwiększeniu dawki.')] }),
  betalocRange({ id: 'angina', label: 'Dławica piersiowa · dawka ustalana w zakresie', indication: 'Dławica piersiowa' }),
  betalocRange({ id: 'arrhythmia', label: 'Zaburzenia rytmu · dawka ustalana w zakresie', indication: 'Zaburzenia rytmu serca opisane w ChPL, w tym częstoskurcz nadkomorowy i zwalnianie czynności komór w migotaniu przedsionków' }),
  betalocFixed({ id: 'post-infarction-maintenance', zok: 200, formIds: [...BETALOC_FORMS],
    label: 'Po ostrej fazie zawału · dawka podtrzymująca ZOK 200', indication: 'Zapobieganie nagłemu zgonowi sercowemu lub ponownemu zawałowi po przebyciu ostrej fazy zawału',
    phaseLabel: '190 mg bursztynianu (ZOK 200) raz na dobę',
    requirements: [requirement('betaloc-post-infarction-maintenance', 'Ostra faza zawału minęła; wybrano właściwy etap leczenia podtrzymującego.')] }),
  betalocFixed({ id: 'palpitations-standard', zok: 100, formIds: [...BETALOC_FORMS],
    label: 'Czynnościowe kołatania serca · ZOK 100', indication: 'Czynnościowe zaburzenia serca z kołataniem serca',
    phaseLabel: '95 mg bursztynianu (ZOK 100) raz na dobę' }),
  betalocFixed({ id: 'palpitations-increased', zok: 200, formIds: [...BETALOC_FORMS],
    label: 'Czynnościowe kołatania serca · zwiększenie do ZOK 200', indication: 'Czynnościowe zaburzenia serca z kołataniem serca wymagające zwiększenia dawki',
    phaseLabel: '190 mg bursztynianu (ZOK 200) raz na dobę',
    requirements: [requirement('betaloc-palpitations-increase', 'Lekarz stwierdził potrzebę zwiększenia dawki z ZOK 100 do ZOK 200.')] }),
  betalocRange({ id: 'migraine-prophylaxis', label: 'Profilaktyka migreny · dawka ustalana w zakresie', indication: 'Profilaktyka migreny' }),
  betalocFixed({ id: 'hf-initial-standard', zok: 25, formIds: ['betaloc-zok-25'],
    label: 'Stabilna przewlekła HF · początek ZOK 25 · pierwsze 2 tygodnie', indication: 'Ustabilizowana przewlekła niewydolność serca; standardowy etap początkowy',
    phaseLabel: '23,75 mg bursztynianu (ZOK 25) raz na dobę przez 14 dni', fixedDays: 14,
    requirements: [hfStable, requirement('betaloc-hf-standard-start', 'Pacjent nie wymaga niższego początku przewidzianego dla NYHA III–IV.')],
    notes: ['Dawka 200 mg w nazewnictwie ZOK nie jest dawką początkową. Następny etap wymaga ponownej decyzji po ocenie tolerancji.'] }),
  betalocFixed({ id: 'hf-initial-nyha3to4', zok: 12.5, formIds: ['betaloc-zok-25'],
    label: 'Stabilna przewlekła HF NYHA III–IV · połowa ZOK 25 · pierwszy tydzień', indication: 'Ustabilizowana przewlekła niewydolność serca klasy III–IV NYHA; etap początkowy',
    phaseLabel: '11,875 mg bursztynianu = pół tabletki ZOK 25 raz na dobę przez 7 dni', fixedDays: 7,
    requirements: [hfStable, requirement('betaloc-hf-nyha3to4', 'Potwierdzono NYHA III–IV i wybór szczególnego pierwszego tygodnia leczenia.')] }),
  ...[25, 50, 100].map(zok => betalocFixed({ id: `hf-titration-zok${zok}`, zok,
    formIds: zok === 25 ? ['betaloc-zok-25'] : zok === 50 ? BETALOC_FORMS.slice(0, 2) : [...BETALOC_FORMS],
    label: `Stabilna przewlekła HF · wybrany etap miareczkowania ZOK ${zok}`,
    indication: 'Ustabilizowana przewlekła niewydolność serca; indywidualnie wybrany etap miareczkowania',
    phaseLabel: `${n(succinate(zok))} mg bursztynianu (ZOK ${zok}) raz na dobę`, requirements: [hfStable, hfTitration],
    notes: ['Po ocenie tolerancji dawkę można podwajać co dwa tygodnie do ZOK 200 lub dawki maksymalnie tolerowanej. Ten wybór obejmuje tylko stałą dawkę bieżącego etapu.'] })),
  betalocFixed({ id: 'hf-maintenance-zok200', zok: 200, formIds: [...BETALOC_FORMS],
    label: 'Stabilna przewlekła HF · docelowa dawka podtrzymująca ZOK 200', indication: 'Ustabilizowana przewlekła niewydolność serca; leczenie podtrzymujące po miareczkowaniu',
    phaseLabel: '190 mg bursztynianu (ZOK 200) raz na dobę po potwierdzeniu tolerancji', maxDailyMg: 190,
    limitLabel: 'Maksymalna dawka docelowa wybranego schematu HF: ZOK 200 = 190 mg bursztynianu/dobę',
    requirements: [hfStable, requirement('betaloc-hf-target-tolerated', 'Zakończono odpowiednie miareczkowanie i potwierdzono tolerancję ZOK 200.')],
    notes: ['ChPL dopuszcza mniejszą maksymalnie tolerowaną dawkę. Nie należy zwiększać dawki do 200 mg ZOK tylko po to, by osiągnąć oznaczony punkt odniesienia.'] }),
];

const RAMIPRIL_FORMS = ['ramipril-krka-5', 'ramipril-krka-10'];
const ramiprilRequirements = [
  requirement('ramipril-no-hepatic-impairment', 'Nie stwierdzono zaburzeń czynności wątroby ograniczających dawkę do 2,5 mg/dobę.',
    'Przy zaburzeniach wątroby dostępne tutaj całe tabletki 5 i 10 mg nie odpowiadają źródłowemu limitowi; potrzebna jest inna moc lub postać.'),
  requirement('ramipril-maintenance-reviewed', 'Dawka została już dobrana po miareczkowaniu i ocenie ciśnienia, potasu oraz czynności nerek.',
    'Te opcje 5/10 mg nie zastępują źródłowych dawek początkowych 1,25/2,5 mg. Oceniono także przeciwwskazania i interakcje, w tym odstęp od sakubitrylu/walsartanu.'),
];
const ramiprilNotes = [
  'Katalog obsługuje całe tabletki 5 i 10 mg. ChPL nie potwierdza ich podziału na równe dawki; początek 1,25/2,5 mg oraz 2,5 mg na podanie wymagają odpowiedniej innej mocy lub postaci.',
  'Przy CrCl ≥60 ml/min limit źródłowy wynosi 10 mg/dobę; przy CrCl 10–<60 ml/min wynosi 5 mg/dobę. Wartość 60 przypisano do jawnego przedziału ≥60 z ChPL. Nie podstawiaj eGFR na 1,73 m² za CrCl.',
  'Przy zaburzeniach wątroby limit to 2,5 mg/dobę i leczenie rozpoczyna się pod ścisłą kontrolą. Osoby starsze lub osłabione mogą wymagać mniejszego początku i wolniejszego miareczkowania.',
];
const ramiprilBase = () => ({
  ...adultSource('ramipril'), selectionRequirements: [...ramiprilRequirements],
  screening: 'Oceń ciśnienie, nawodnienie, potas, nerki, wątrobę i interakcje. Wyklucz m.in. niedociśnienie, niestabilność hemodynamiczną i przeciwwskazania do ACE-I. Schemat nie rozpoczyna ani nie zwiększa leczenia automatycznie.',
  administration: 'Doustnie, codziennie o stałej porze, niezależnie od posiłku. Połknąć całą tabletkę, popijając płynem; nie kruszyć ani nie żuć.',
  notes: [...ramiprilNotes],
});
const renalNormalRange = { requireCrCl: true, minCrCl: 60, maxDailyMg: 10,
  limitLabel: 'Źródłowy limit dla ramiprylu przy CrCl ≥60 ml/min: 10 mg/dobę; nie jest dawką początkową' };
const renalReducedRange = { requireCrCl: true, minCrCl: 10, maxCrCl: 60, maxCrClExclusive: true, maxDailyMg: 5,
  limitLabel: 'Źródłowy limit dla ramiprylu przy CrCl 10–<60 ml/min: 5 mg/dobę' };
const ramiprilFixed = ({ id, dose, label, indication, phaseLabel, renal = 'standard', requirements = [], notes = [], ...extra }) => ({
  ...ramiprilBase(), id: `cardio-ramipril-${id}`, formIds: dose === 5 ? ['ramipril-krka-5'] : [...RAMIPRIL_FORMS],
  label, indication, phaseLabel, dose, ...(renal === 'reduced' ? renalReducedRange : renalNormalRange),
  selectionRequirements: [...ramiprilRequirements, ...requirements], notes: [...ramiprilNotes, ...notes], ...extra,
});
const notDialysis = requirement('ramipril-not-dialysis', 'Pacjent nie jest hemodializowany; wybrano wariant oparty na ocenionym CrCl.');
const RAMIPRIL_REGIMENS = [
  ...[5, 10].map(dose => ramiprilFixed({ id: `hypertension-${dose}-crcl-ge60`, dose,
    label: `Nadciśnienie · po miareczkowaniu ${dose} mg · CrCl ≥60`, indication: 'Nadciśnienie tętnicze; etap po miareczkowaniu',
    phaseLabel: `${dose} mg raz na dobę po ocenie odpowiedzi i tolerancji`, requirements: [notDialysis],
    notes: ['Standardowy początek w ChPL to 2,5 mg/dobę, w grupach szczególnego ryzyka 1,25 mg. Dawkę w nadciśnieniu można podwajać co 2–4 tygodnie, zależnie od ciśnienia.'] })),
  ramiprilFixed({ id: 'hypertension-5-crcl10to60', dose: 5, renal: 'reduced',
    label: 'Nadciśnienie · ustalona dawka 5 mg · CrCl 10–<60', indication: 'Nadciśnienie tętnicze z zaburzeniami nerek; dawka ustalona po miareczkowaniu',
    phaseLabel: '5 mg raz na dobę; osiągnięty limit dla tego przedziału CrCl', requirements: [notDialysis],
    notes: ['Przy CrCl 30–<60 ChPL rozpoczyna od 2,5 mg/dobę; przy CrCl 10–<30 od 1,25 mg/dobę. Wybrana dawka 5 mg dotyczy późniejszego, ocenionego etapu.'] }),
  ...[5, 10].map(dose => ramiprilFixed({ id: `cv-prevention-${dose}`, dose,
    label: `Profilaktyka sercowo-naczyniowa · ${dose === 5 ? 'etap 5 mg' : 'docelowo 10 mg'} · CrCl ≥60`,
    indication: 'Profilaktyka sercowo-naczyniowa przy jawnej miażdżycowej chorobie układu krążenia lub cukrzycy z dodatkowym czynnikiem ryzyka',
    phaseLabel: `${dose} mg raz na dobę po odpowiednim miareczkowaniu`, requirements: [notDialysis],
    notes: ['ChPL zaczyna od 2,5 mg raz na dobę; dawkę podwaja się po 1–2 tygodniach, a po kolejnych 2–3 tygodniach przechodzi do docelowych 10 mg, zależnie od tolerancji.'] })),
  ...['microalbuminuria', 'nondiabetic-proteinuria'].flatMap(kind => ['standard', 'reduced'].map(renal => ramiprilFixed({
    id: `nephropathy-${kind}-5-${renal}`, dose: 5, renal,
    label: `${kind === 'microalbuminuria' ? 'Cukrzyca z mikroalbuminurią' : 'Nefropatia niecukrzycowa ≥3 g białka/dobę'} · etap 5 mg · ${renal === 'standard' ? 'CrCl ≥60' : 'CrCl 10–<60'}`,
    indication: kind === 'microalbuminuria' ? 'Początkowa glomerulopatia cukrzycowa z mikroalbuminurią' : 'Jawna glomerulopatia niecukrzycowa z białkomoczem ≥3 g/dobę',
    phaseLabel: '5 mg raz na dobę po stopniowym zwiększaniu dawki', requirements: [notDialysis],
    notes: ['Źródłowe etapy: początek 1,25 mg raz na dobę, po 2 tygodniach 2,5 mg, po kolejnych 2 tygodniach 5 mg. Katalogowe tabletki nie obsługują dwóch niższych etapów.'],
  }))),
  ...[5, 10].map(dose => ramiprilFixed({ id: `diabetic-nephropathy-cv-risk-${dose}`, dose,
    label: `Jawna nefropatia cukrzycowa z ryzykiem sercowo-naczyniowym · etap ${dose} mg · CrCl ≥60`,
    indication: 'Jawna glomerulopatia cukrzycowa z białkomoczem i przynajmniej jednym czynnikiem ryzyka sercowo-naczyniowego',
    phaseLabel: `${dose} mg raz na dobę po miareczkowaniu`, requirements: [notDialysis],
    notes: ['ChPL opisuje początek 2,5 mg raz na dobę, 5 mg po 1–2 tygodniach i docelowe 10 mg po kolejnych 2–3 tygodniach, zależnie od tolerancji.'] })),
  ramiprilFixed({ id: 'hf-maintenance-5-bid', dose: 5, frequency: 2,
    label: 'Objawowa HF · ustalona dawka 5 mg 2 razy/dobę · CrCl ≥60', indication: 'Objawowa niewydolność serca; dawka podtrzymująca po miareczkowaniu',
    phaseLabel: '5 mg na podanie, 2 razy na dobę = 10 mg/dobę',
    requirements: [notDialysis, requirement('ramipril-hf-stable', 'Stan ustabilizowano lekiem moczopędnym; potwierdzono tolerancję wybranego etapu HF.')],
    notes: ['ChPL rozpoczyna od 1,25 mg/dobę i podwaja dawkę co 1–2 tygodnie do maksymalnie 10 mg/dobę, zalecając 2 dawki podzielone. Opcja 5 mg 2 razy/dobę jest późniejszym etapem, dostępnym tylko z całych tabletek 5 mg.'] }),
  ramiprilFixed({ id: 'post-infarction-hf-maintenance-5-bid', dose: 5, frequency: 2,
    label: 'Po zawale z HF · docelowo 5 mg 2 razy/dobę · CrCl ≥60', indication: 'Profilaktyka wtórna po ostrym zawale z klinicznymi objawami niewydolności serca; etap podtrzymujący',
    phaseLabel: '5 mg na podanie, 2 razy na dobę po zakończeniu właściwego miareczkowania',
    requirements: [notDialysis, requirement('ramipril-post-infarction-stable', 'Minęło ponad 48 godzin od zawału; pacjent jest stabilny klinicznie i hemodynamicznie oraz toleruje docelową dawkę.',
      'Opcja nie obejmuje odrębnego ostrożnego początku u pacjentów z ciężką HF NYHA IV bezpośrednio po zawale.')],
    notes: ['Początek i zwiększanie co 1–3 dni są odrębnymi etapami ChPL. Nie zastępuj 2,5 mg 2 razy/dobę tabletką 10 mg raz na dobę ani nie rozpoczynaj od tej dawki podtrzymującej.'] }),
  ramiprilFixed({ id: 'hypertension-haemodialysis-maintenance-5', dose: 5,
    label: 'Nadciśnienie · hemodializa · ustalona dawka 5 mg po dializie', indication: 'Nadciśnienie tętnicze u pacjenta hemodializowanego; późniejsza dawka ustalona indywidualnie',
    phaseLabel: '5 mg raz na dobę; w dniu hemodializy kilka godzin po jej zakończeniu',
    requireCrCl: false, minCrCl: undefined, maxDailyMg: 5,
    limitLabel: 'Źródłowy limit u hemodializowanego pacjenta z nadciśnieniem: 5 mg/dobę',
    requirements: [requirement('ramipril-haemodialysis', 'Pacjent jest hemodializowany z nadciśnieniem; wybrano już tolerowaną dawkę 5 mg i odpowiednią porę po dializie.')],
    administration: 'Doustnie raz na dobę; w dniu hemodializy kilka godzin po jej zakończeniu. Połknąć całą tabletkę, popijając płynem.',
    notes: ['Źródłowa dawka początkowa podczas hemodializy to 1,25 mg/dobę, a 5 mg jest górnym limitem. Ta opcja dotyczy wyłącznie wcześniej ustalonej dawki podtrzymującej.'] }),
];

const toramideRequirements = [
  requirement('toramide-renal-hepatic-cardiac-scope', 'Wykluczono bezmocz, śpiączkę lub stan przedśpiączkowy wątroby, niskie ciśnienie i przeciwwskazane zaburzenia rytmu.',
    'Samo rozpoznanie choroby nerek lub wątroby nie jest automatycznym wykluczeniem: ChPL obejmuje obrzęki nerkowe i wątrobowe.'),
  requirement('toramide-volume-electrolytes', 'Przed tym etapem oceniono i wyrównano zaburzenia wolemii, sodu, potasu oraz mikcji.'),
];
const toramideNotes = [
  'Dawkowanie zależy od wskazania. Przy nadciśnieniu ponad 5 mg/dobę nie wykazano dodatkowego obniżenia ciśnienia; nie przenoś na to wskazanie większych dawek z leczenia obrzęków.',
  'Monitoruj odpowiednio elektrolity, wolemię, kreatyninę, glikemię i kwas moczowy. Wyklucz przeciwwskazania i interakcje z ChPL; nie stosuj automatycznej redukcji według samego CrCl.',
  'Katalog nie uznaje nacięcia za potwierdzenie równych części. Dawka musi być możliwa do podania jako całe tabletki wybranej mocy.',
];
const toramideBase = () => ({
  ...adultSource('toramide'), selectionRequirements: [...toramideRequirements],
  screening: 'Oceń przyczynę obrzęków lub wskazanie nadciśnieniowe, nawodnienie, elektrolity, nerki, wątrobę i interakcje. Schemat nie zastępuje oceny ostrego obrzęku płuc.',
  administration: 'Doustnie raz na dobę, w dawce ustalonej przez lekarza.', notes: [...toramideNotes],
});
const TORAMIDE_REGIMENS = [
  { ...toramideBase(), id: 'cardio-toramide-hypertension-initial', formIds: ['toramide-2.5'],
    label: 'Nadciśnienie pierwotne · dawka początkowa 2,5 mg', indication: 'Nadciśnienie tętnicze pierwotne',
    phaseLabel: '2,5 mg raz na dobę', dose: 2.5, maxDailyMg: 5,
    limitLabel: 'Górna dawka w źródłowym schemacie nadciśnienia: 5 mg/dobę; nie jest dawką początkową' },
  { ...toramideBase(), id: 'cardio-toramide-hypertension-increased', formIds: ['toramide-2.5', 'toramide-5'],
    label: 'Nadciśnienie pierwotne · zwiększenie do 5 mg', indication: 'Nadciśnienie tętnicze pierwotne wymagające zwiększenia dawki',
    phaseLabel: '5 mg raz na dobę po ocenie potrzeby zwiększenia', dose: 5, maxDailyMg: 5,
    limitLabel: 'Górna dawka w źródłowym schemacie nadciśnienia: 5 mg/dobę',
    selectionRequirements: [...toramideRequirements, requirement('toramide-hypertension-increase', 'Lekarz stwierdził potrzebę zwiększenia dawki z 2,5 do 5 mg.')],
    notes: [...toramideNotes, 'Maksymalny efekt hipotensyjny w ChPL opisano po około 12 tygodniach ciągłego leczenia. Nie oznacza to automatycznego ustawienia czasu ani zwiększania dawki.'] },
  { ...toramideBase(), id: 'cardio-toramide-oedema-initial', formIds: ['toramide-2.5', 'toramide-5'],
    label: 'Obrzęki · zwykle stosowana dawka 5 mg', indication: 'Obrzęki nerkowe, wątrobowe lub związane z zastoinową niewydolnością serca',
    phaseLabel: '5 mg raz na dobę', dose: 5 },
  ...[2.5, 5, 10].map(strength => ({
    ...toramideBase(), id: `cardio-toramide-oedema-adjusted-${String(strength).replace('.', '-')}`, formIds: [`toramide-${strength}`],
    label: 'Obrzęki · indywidualnie wybrany etap zwiększania do 20 mg', indication: 'Obrzęki nerkowe, wątrobowe lub związane z zastoinową niewydolnością serca wymagające dostosowania dawki',
    phaseLabel: `Zakres źródłowy 5–20 mg raz na dobę; dla całej tabletki ${n(strength)} mg dostępny zakres ${Math.max(5, strength)}–20 mg`,
    doseRange: { min: Math.max(5, strength), max: 20 }, maxDailyMg: 20,
    limitLabel: 'Górna granica zwykłego zakresu leczenia obrzęków w ChPL: 20 mg/dobę; nie jest uniwersalnym maksimum torasemidu',
    selectionRequirements: [...toramideRequirements, requirement('toramide-oedema-titration', 'Oceniono odpowiedź na wcześniejszą dawkę i zasadność stopniowego zwiększania w tym wskazaniu.')],
    notes: [...toramideNotes,
      'Punkt początkowy źródła to zwykle 5 mg; dawkę można zwiększać stopniowo do 20 mg/dobę. Dla mocy 10 mg dolna wykonalna dawka wynosi 10 mg wyłącznie z powodu całej tabletki, a nie nowego minimum klinicznego.',
      'ChPL wspomina indywidualne przypadki dawek do 40 mg/dobę. Nie stanowią one standardowego zakresu tej opcji ani automatycznego celu leczenia.'],
  })),
];

const atorisLiver = requirement('atoris-hepatic-scope', 'Wykluczono czynną chorobę wątroby i niewyjaśnione, utrwalone zwiększenie aminotransferaz >3 × GGN.',
  'Oceniono czynność wątroby; inne jej zaburzenia wymagają ostrożności i indywidualnej oceny.');
const atorisNoDoseInteraction = requirement('atoris-standard-interaction-scope', 'Oceniono leki towarzyszące; brak interakcji wymagającej niższego limitu lub unikania atorwastatyny.',
  'Standardowy zakres nie obejmuje m.in. limitu 20 mg z elbaswirem/grazoprewirem lub letermowirem. Glekaprewir/pibrentaswir jest przeciwwskazany; letermowir z cyklosporyną nie jest zalecanym skojarzeniem.');
const atorisNotes = [
  'Maksimum 80 mg/dobę jest ograniczeniem źródłowym, nie automatycznie zalecaną dawką. Dawkę wybiera się według LDL-C, celu leczenia, odpowiedzi i tolerancji; zmiany co 4 tygodnie lub rzadziej.',
  'ChPL nie wymaga korekty z powodu samego upośledzenia nerek. Wyklucz przeciwwskazania wątrobowe, ciążę/karmienie i przeciwwskazane skojarzenia; oceń ryzyko miopatii i interakcje.',
  'Przeliczenie obejmuje całe tabletki 10/20/40 mg. Dolna dawka dostępna dla danej mocy wynika z możliwości jej podania; nie zmienia źródłowej dawki początkowej 10 mg.',
];
const atorisBase = () => ({
  ...adultSource('atoris'), maxDailyMg: 80,
  limitLabel: 'Maksymalna dawka atorwastatyny z ChPL: 80 mg/dobę; dawkę docelową ustala się indywidualnie',
  selectionRequirements: [atorisLiver, atorisNoDoseInteraction],
  screening: 'Wybierz wskazanie i etap po ocenie LDL-C, ryzyka sercowo-naczyniowego, wątroby, tolerancji i interakcji. Samo zmieszczenie się w zakresie nie potwierdza właściwości leczenia.',
  administration: 'Doustnie, cała dawka dobowa jednorazowo, o wybranej porze, niezależnie od posiłków.', notes: [...atorisNotes],
});
const atorisTitration = requirement('atoris-dose-established', 'Dawkę ustalono indywidualnie; oceniono odpowiedź i zachowano właściwy odstęp między zmianami.',
  'Zmiany dawki powinny następować nie częściej niż co 4 tygodnie. Katalog nie planuje ani nie wykonuje kolejnych zwiększeń.');
const atorisRanges = ({ id, label, indication, max = 80, requirements = [], notes = [], interaction = false }) => [10, 20, 40]
  .filter(strength => strength <= max).map(strength => ({
    ...atorisBase(), id: `cardio-atoris-${id}-${strength}`, formIds: [`atoris-${strength}`], label, indication,
    phaseLabel: `${Math.max(10, strength)}–${max} mg raz na dobę, jako całe tabletki ${strength} mg; dawkę wybiera lekarz`,
    doseRange: { min: Math.max(10, strength), max }, maxDailyMg: max,
    ...(interaction ? { limitLabel: 'Limit przy jednoczesnym elbaswirze/grazoprewirze lub letermowirze: 20 mg atorwastatyny/dobę' } : {}),
    selectionRequirements: [atorisLiver, ...(interaction ? [] : [atorisNoDoseInteraction]), atorisTitration, ...requirements],
    notes: [...atorisNotes, ...notes],
  }));
const ATORIS_REGIMENS = [
  { ...atorisBase(), id: 'cardio-atoris-hypercholesterolaemia-initial', formIds: ['atoris-10'],
    label: 'Hipercholesterolemia lub hiperlipidemia mieszana · początek 10 mg',
    indication: 'Hipercholesterolemia pierwotna, w tym heterozygotyczna rodzinna, lub hiperlipidemia mieszana; początek leczenia',
    phaseLabel: '10 mg raz na dobę jako uzupełnienie leczenia dietetycznego', dose: 10 },
  ...atorisRanges({ id: 'hypercholesterolaemia-maintenance', label: 'Hipercholesterolemia lub hiperlipidemia mieszana · dawka indywidualna',
    indication: 'Hipercholesterolemia pierwotna, w tym heterozygotyczna rodzinna, lub hiperlipidemia mieszana; dawka ustalona indywidualnie',
    notes: ['W heterozygotycznej postaci rodzinnej ChPL opisuje zwiększanie od 10 do 40 mg, następnie do 80 mg lub 40 mg z lekiem wiążącym kwasy żółciowe. Wybór tej opcji nie wybiera terapii skojarzonej.'] }),
  ...atorisRanges({ id: 'homozygous-familial', label: 'Homozygotyczna hipercholesterolemia rodzinna · leczenie wspomagające',
    indication: 'Homozygotyczna hipercholesterolemia rodzinna u dorosłych',
    requirements: [requirement('atoris-homozygous-family-scope', 'Potwierdzono homozygotyczną postać rodzinną i rolę atorwastatyny jako uzupełnienia innego leczenia lub jego niedostępność.')],
    notes: ['Dla tego wskazania ChPL podaje zakres 10–80 mg/dobę oraz ograniczone dane. Dobór dawki wymaga indywidualnej oceny.'] }),
  { ...atorisBase(), id: 'cardio-atoris-cv-prevention-10', formIds: ['atoris-10'],
    label: 'Prewencja sercowo-naczyniowa · wariant 10 mg', indication: 'Prewencja zdarzeń sercowo-naczyniowych u dorosłego z ocenionym dużym ryzykiem',
    phaseLabel: '10 mg raz na dobę; dawka stosowana w przywołanych badaniach prewencji pierwotnej', dose: 10,
    notes: [...atorisNotes, 'ChPL odróżnia dawkę 10 mg z badań prewencji pierwotnej od dawek potrzebnych do indywidualnego celu LDL-C. Ta opcja nie ustala ryzyka ani celu leczenia.'] },
  ...atorisRanges({ id: 'cv-prevention-adjusted', label: 'Prewencja sercowo-naczyniowa · dawka dostosowana do celu LDL-C',
    indication: 'Prewencja zdarzeń sercowo-naczyniowych u dorosłego z ocenionym dużym ryzykiem; dawka indywidualna',
    requirements: [requirement('atoris-cv-risk-target', 'Oceniono duże ryzyko sercowo-naczyniowe i indywidualny cel LDL-C; lekarz wybrał dawkę.')],
    notes: ['W badaniach prewencji pierwotnej cytowanych w ChPL stosowano 10 mg/dobę; większa dawka może być potrzebna do osiągnięcia odpowiedniego LDL-C. Nie jest wybierana automatycznie.'] }),
  ...atorisRanges({ id: 'interaction-cap20', label: 'Hipercholesterolemia · wskazana interakcja z limitem 20 mg',
    indication: 'Hipercholesterolemia lub hiperlipidemia mieszana przy jednoczesnym stosowaniu elbaswiru/grazoprewiru lub letermowiru', max: 20, interaction: true,
    requirements: [requirement('atoris-interaction-cap20-confirmed', 'Pacjent otrzymuje elbaswir/grazoprewir lub letermowir; nie ma innych interakcji nakazujących unikanie leku lub dalszą redukcję.',
      'Nie dotyczy przeciwwskazanego glekaprewiru/pibrentaswiru ani niezalecanego połączenia letermowiru z cyklosporyną.')],
    notes: ['Sekcja 4.2 nakazuje nie przekraczać 20 mg/dobę przy tych konkretnych skojarzeniach. Moc 40 mg nie jest oferowana w tym wariancie; pozostałe interakcje wymagają odrębnej oceny.'] }),
];

export const CARDIO_MAINTENANCE_REGIMENS = [
  ...BETALOC_REGIMENS, ...RAMIPRIL_REGIMENS, ...TORAMIDE_REGIMENS, ...ATORIS_REGIMENS,
];

export const CARDIO_MAINTENANCE_RESEARCH = {
  checkedAt: CHECKED_AT, sources: Object.values(SOURCES),
  scope: 'Wybrane, jawnie wybierane schematy dla dorosłych i wszystkich 11 obecnych postaci czterech preparatów; nie pełny katalog wszystkich wskazań, grup wieku ani indywidualnych korekt.',
  exclusions: [
    'Nie modeluje pediatrycznego dawkowania Betaloc ZOK ani Atoris.',
    'Nie realizuje początkowych 1,25/2,5 mg ramiprylu z niedzielonych tabletek 5/10 mg ani standardowych dawek przy zaburzeniach wątroby.',
    'Nie oferuje torasemidu 40 mg/dobę jako standardowej opcji; ChPL opisuje takie dawki tylko w indywidualnych przypadkach.',
    'Nie ustala automatycznie wskazania, tolerancji, docelowego LDL-C, miareczkowania ani czasu przewlekłego leczenia.',
  ],
};
