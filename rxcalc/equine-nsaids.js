/**
 * Selected equine NSAID products and explicit phases from Polish product SPCs.
 * Standalone data: do not import catalogue.js or regimens.js from this module.
 * No indication, phase, dose or duration is selected on the clinician's behalf.
 */
const checked = '2026-11-13';
const flunivisUrl = 'https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/50492/characteristic';
const butagranUrl = 'https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/30160/characteristic';
const sportNote = 'Przed startem sprawdź aktualne przepisy organizatora i wymagany okres wycofania leku. Kalkulator nie wyznacza terminu dopuszczenia do zawodów; karencja żywnościowa nie jest terminem sportowym.';

const formBase = {
  strengthMg: null, concentrationMg: null, concentrationMl: null,
  maxDailyMg: null, maxSingleMg: null, minAge: null, shelfLifeDays: null,
  defaultDose: null, defaultFrequency: null, defaultDays: null,
  defaultMode: 'perKgDose', allowedFractions: [1], targetSpecies: ['horse'],
  sourceCheckedAt: checked, clinicalReviewStatus: 'not-clinically-validated',
};

const flunivisScreening = 'Wyklucz nadwrażliwość, choroby serca, wątroby lub nerek, owrzodzenie/krwawienie z przewodu pokarmowego oraz zaburzenia hematopoezy lub hemostazy. Nie stosować u ciężarnych klaczy ani ogierów przeznaczonych do rozrodu. Oceń nawodnienie, hipowolemię i wstrząs. Nie łącz z kortykosteroidami ani innymi NLPZ; sprawdź co najmniej 24-godzinny odstęp od innych NLPZ oraz leki nefrotoksyczne.';
const butagranScreening = 'Potwierdź wykluczenie konia z produkcji żywności. Wyklucz nadwrażliwość, choroby serca, wątroby lub nerek, ryzyko owrzodzeń/krwawienia z przewodu pokarmowego i dyskrazję krwi. Unikaj stosowania przy odwodnieniu, hipowolemii lub niedociśnieniu. Nie podawaj innych NLPZ jednocześnie ani w odstępie krótszym niż 24 godziny; sprawdź leki nefrotoksyczne i interakcje, m.in. z warfaryną, sulfonamidami, barbituranami, penicyliną i gentamycyną.';
const butagranAdministration = 'Podawać doustnie; można wymieszać z niewielką ilością otrąb lub owsa. Unikać siana bezpośrednio przed podaniem i podczas podawania. Odmierzyć gramy całego proszku, zapewnić wodę. Otwartą saszetkę zużyć natychmiast; reszty nie przechowywać do kolejnej dawki.';
const butagranReviewNote = 'Bez widocznej odpowiedzi po 4–5 dniach od początku całej terapii przerwać leczenie. Każdy etap wymaga oceny odpowiedzi; wyliczenie obejmuje wyłącznie wybrany etap.';

export const EQUINE_NSAID_DRUGS = [
  {
    id: 'vet-flunivis', name: 'Flunivis', substance: 'Flunixinum', substanceLabel: 'Fluniksyna',
    category: 'pain', specialties: ['veterinary'],
    searchTerms: ['fluniksyna', 'flunixin', 'nlpz', 'ból', 'zapalenie', 'gorączka', 'narząd ruchu', 'dożylnie'],
    forms: [{
      ...formBase,
      id: 'flunivis-horse-50-iv', label: 'Flunivis · 50 mg/ml · koń · dożylnie',
      form: 'injection', unitLabel: 'ml', concentrationMg: 50, concentrationMl: 1,
      doseBasisIngredient: 'fluniksyny', routeCode: 'iv', routeLabel: 'dożylnie',
      injectionContainerUse: 'multiDose', shelfLifeDays: 28, maxWithdrawalsPerVial: 25,
      packOptions: [
        { id: '50', label: '1 fiolka × 50 ml', quantity: 50 },
        { id: '100', label: '1 fiolka × 100 ml', quantity: 100 },
        { id: '250', label: '1 fiolka × 250 ml', quantity: 250 },
      ],
      sourceUrl: flunivisUrl, sourceLabel: 'Polska ChPL · RPL',
      sourceSection: '2, 3.2–3.9, 3.12 i 5.2–5.4',
      measurementNote: 'Stężenie to 50 mg fluniksyny/ml, nie 82,9 mg soli z megluminą. U koni wyłącznie podanie dożylne. Obliczenie opiera się na dawce w mg/kg; nie zaokrągla jej do uproszczonego przelicznika ml z ChPL.',
      notes: [
        'Fiolka wielodawkowa: po otwarciu 28 dni. ChPL dopuszcza 25 nakłuć igłą 18 G lub 100 igłą 21 G; kalkulator zachowawczo przyjmuje najwyżej 25 pobrań z nowej fiolki. Potwierdź urządzenie, datę otwarcia i wcześniejsze nakłucia.',
        'Powolne podanie dożylne, roztwór o temperaturze zbliżonej do temperatury ciała; natychmiast przerwać wstrzykiwanie przy objawach wstrząsu. Nie mieszać z innymi lekami.',
        'U źrebiąt poniżej 6 tygodni i koni starszych wymagane jest szczególnie uważne monitorowanie; nie jest to w ChPL bezwzględna granica wieku.',
        'Nie stosować w ciąży ani u ogierów rozpłodowych. W pierwszych 36 godzinach po porodzie konieczna jest ocena korzyści/ryzyka i kontrola zatrzymania łożyska.',
        'Konie, podanie dożylne: karencja tkanek jadalnych 5 dni. Nie stosować u klaczy produkujących mleko dla ludzi.',
        sportNote,
      ],
    }],
  },
  {
    id: 'vet-butagran-equi', name: 'Butagran Equi', substance: 'Phenylbutazonum', substanceLabel: 'Fenylbutazon',
    category: 'pain', specialties: ['veterinary'],
    searchTerms: ['fenylbutazon', 'phenylbutazone', 'nlpz', 'ból', 'ochwat', 'kulawizna', 'narząd ruchu', 'saszetka'],
    forms: [{
      ...formBase,
      id: 'butagran-equi-horse-200', label: 'Butagran Equi · 200 mg/g · saszetki 5 g',
      form: 'oralPowder', shortFormLabel: 'proszek doustny', unitLabel: 'g', strengthMg: 200,
      doseBasisIngredient: 'fenylbutazonu', routeCode: 'oral', routeLabel: 'doustnie',
      requiresFoodChainExclusion: true,
      singleUseUnitSize: 5,
      packOptions: [
        { id: '20x5', label: '20 saszetek × 5 g (100 g proszku)', quantity: 100 },
        { id: '100x5', label: '100 saszetek × 5 g (500 g proszku)', quantity: 500 },
      ],
      sourceUrl: butagranUrl, sourceLabel: 'Polska ChPL · RPL (04/2026)',
      sourceSection: '2, 3.1–3.9, 3.12 i 5.2–5.4',
      measurementNote: 'Jedna saszetka zawiera 5 g całego proszku, czyli 1000 mg fenylbutazonu. Obliczenie stosuje podane w ChPL dawki 4,4 lub 2,2 mg/kg; skróty 10 g lub 5 g na 450 kg są przybliżeniem. Nie zaokrąglamy dawki do pełnych saszetek; dokładność odważenia potwierdza lekarz.',
      notes: [
        'Wyłącznie konie wykluczone z produkcji żywności. Nie stosować u koni przeznaczonych do spożycia ani u klaczy produkujących mleko dla ludzi. Nie jest to lek z liczbową karencją umożliwiającą późniejszy ubój.',
        'Każda saszetka 5 g jest jednorazowa. Pozostałość po odmierzeniu dawki nie przechodzi na kolejne podanie; zapas musi uwzględniać całe otwierane saszetki, a nie tylko sumę podanych gramów.',
        'Niski wskaźnik terapeutyczny; nie przekraczać schematu. Kuce są szczególnie wrażliwe. Wiek poniżej 6 tygodni i starszy wiek wymagają zwiększonej ostrożności i uważnej obserwacji klinicznej.',
        'W ciąży i laktacji stosowanie wymaga oceny korzyści/ryzyka; unikać okresu okołoporodowego. Bezpieczeństwo laktacji nie zostało ustalone. Przy działaniach niepożądanych przerwać leczenie.',
        butagranReviewNote,
        'Wpływ kliniczny może utrzymywać się co najmniej 3 dni po zakończeniu leczenia; uwzględnij to przy ponownym badaniu. Nie jest to podany w ChPL termin wycofania ze sportu.',
        sportNote,
      ],
    }],
  },
];

export const EQUINE_NSAID_REGIMENS = [
  {
    id: 'flunivis-horse-msk-pyrexia', formIds: ['flunivis-horse-50-iv'], species: ['horse'],
    label: 'Ostry ból i zapalenie narządu ruchu / gorączka · IV',
    indication: 'Łagodzenie ostrego bólu i zapalenia układu mięśniowo-szkieletowego lub zmniejszenie gorączki',
    phaseLabel: 'Podanie dożylne · raz dziennie, do 5 dni',
    doseMode: 'perKgDose', dose: 1.1, frequency: 1, maxDays: 5,
    routeCode: 'iv', routeLabel: 'dożylnie',
    sourceUrl: flunivisUrl, sourceLabel: 'Polska ChPL · RPL',
    sourceSection: '3.2–3.9 i 3.12; dawkowanie koni w 3.9', sourceCheckedAt: checked,
    screening: flunivisScreening,
    administration: 'Wyłącznie powoli dożylnie. Roztwór powinien mieć temperaturę zbliżoną do temperatury ciała. Przy objawach wstrząsu natychmiast przerwać podanie i podjąć właściwe postępowanie.',
    notes: [
      'Czas ustala lekarz według odpowiedzi klinicznej, maksymalnie 5 dni. Ten schemat nie obejmuje nawrotowej kolki ani odrębnych wariantów leczenia endotoksemii.',
      'ChPL zabrania stosowania przy kolce z niedrożnością jelit i odwodnieniem. Samo złagodzenie bólu nie zastępuje rozpoznania przyczyny.',
      'Dawka dotyczy fluniksyny, nie masy soli. Nie przenoś domięśniowej drogi podania innych gatunków na konia.',
      sportNote,
    ],
  },
  ...[
    {
      id: 'butagran-horse-day-one', label: 'Narząd ruchu · dzień 1',
      phaseLabel: 'Etap początkowy · tylko pierwszy dzień', dose: 4.4, frequency: 2, fixedDays: 1,
      phaseNote: 'Nie powtarzaj dawki początkowej w kolejnych dniach; dalszy etap ma odrębny schemat.',
    },
    {
      id: 'butagran-horse-days-two-four', label: 'Narząd ruchu · dni 2–4',
      phaseLabel: 'Etap po pierwszym dniu · trzy kolejne dni', dose: 2.2, frequency: 2, fixedDays: 3,
      phaseNote: 'Ten zapis obejmuje dni 2–4, po etapie początkowym. Nie przedłuża dawki dwa razy dziennie na dalsze dni.',
    },
    {
      id: 'butagran-horse-daily-continuation', label: 'Narząd ruchu · po dniu 4 · wariant codzienny',
      phaseLabel: 'Kontynuacja po ocenie odpowiedzi · raz dziennie', dose: 2.2, frequency: 1,
      phaseNote: 'Modelowany jest wyłącznie wariant codzienny z ChPL. Wariant co drugi dzień wymaga osobnego planu i nie jest przeliczany jako codzienna kuracja. Czas tej fazy ustala lekarz.',
    },
  ].map(({ phaseNote, ...phase }) => ({
    ...phase,
    formIds: ['butagran-equi-horse-200'], species: ['horse'],
    indication: 'Schorzenia układu mięśniowo-szkieletowego wymagające złagodzenia bólu i zapalenia, w tym wskazane w ChPL kulawizny i ochwat',
    doseMode: 'perKgDose', routeCode: 'oral', routeLabel: 'doustnie',
    requiresFoodChainExclusion: true,
    sourceUrl: butagranUrl, sourceLabel: 'Polska ChPL · RPL (04/2026)',
    sourceSection: '3.1–3.9 i 3.12; fazy dawkowania w 3.9', sourceCheckedAt: checked,
    screening: butagranScreening, administration: butagranAdministration,
    notes: [phaseNote, butagranReviewNote, sportNote],
  })),
];
