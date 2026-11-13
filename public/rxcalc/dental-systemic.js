/**
 * Product-specific dental systemic schemes, checked against Polish RPL documents
 * on 2026-11-13. Numeric ranges are choices for the clinician, never defaults.
 * Regimen ceilings are scoped to the selected indication and population; they
 * are not universal maximum doses of an active substance.
 *
 * Registered package sizes describe documentation, not live pharmacy stock.
 * No antibiotic duration is inferred from pack size or assigned automatically.
 */
const CHECKED_AT = '2026-11-13';
const rpl = id => `https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/${id}/characteristic`;
const SOURCE = Object.freeze({
  augmentin: rpl(8695),
  ospamoxSuspension: rpl(22744),
  ospamoxTablet: rpl(22646),
  ibuprom: rpl(19798),
  paracetamol: rpl(44355),
});
const packageOptions = (sizes, unit = 'tabl.') => sizes.map(quantity => ({
  id: String(quantity), label: `${quantity} ${unit}`, quantity,
  availabilityStatus: 'documented-not-stock-verified',
}));
const commonSource = (sourceUrl, sourceLabel) => ({
  sourceUrl, sourceLabel, sourceSection: '4.1–4.4', sourceCheckedAt: CHECKED_AT,
  clinicalReviewStatus: 'not-clinically-validated',
});
const renalNormal = {
  renalPolicy: 'normal-only', minCrCl: 30, minCrClExclusive: true,
};

const tabletForm = (strengthMg, sizes) => ({
  id: `ospamox-tablet-${strengthMg}`,
  label: `Ospamox ${strengthMg} mg · tabletki powlekane`,
  form: 'tablet', unitLabel: 'tabl.', strengthMg,
  concentrationMg: null, concentrationMl: null,
  maxDailyMg: null, maxSingleMg: null, minAge: null, shelfLifeDays: null,
  defaultDose: null, defaultFrequency: null, defaultDays: null,
  defaultMode: 'fixed', allowedFractions: [0.5, 1],
  doseBasisIngredient: 'amoksycyliny', routeLabel: 'doustnie',
  packOptions: packageOptions(sizes),
  ...commonSource(SOURCE.ospamoxTablet, 'ChPL Ospamox 500/750/1000 mg · RPL'),
  sourceSection: '2–3, 4.1–4.4, 6.5',
  packageScope: 'Wybrane wielkości z ChPL; dostępność w sprzedaży nie została sprawdzona.',
  notes: [
    'Tabletka może być dzielona na równe połowy. Inne ułamki tabletki nie są podstawą automatycznego przeliczenia.',
    'Schemat źródłowy dotyczy ropnia okołozębowego z szerzącym się zapaleniem tkanki łącznej. Sama nazwa leku nie określa wskazania.',
    'Zakres dawki, wariant częstości i czas terapii wybiera lekarz. Opakowanie nie wyznacza długości leczenia.',
    'Tabletki połykać bez żucia, popijając wodą. Pokarm nie zmienia wchłaniania amoksycyliny.',
  ],
});

export const DENTAL_SYSTEMIC_FORM_ADDITIONS = [
  { drugId: 'amoxicillin', form: tabletForm(500, [14, 16, 20]) },
  { drugId: 'amoxicillin', form: tabletForm(1000, [14, 16, 20]) },
];

export const DENTAL_SYSTEMIC_FORM_PATCHES = [
  {
    drugId: 'amoxicillin-clavulanate', formId: 'augmentin-400-57',
    changes: {
      packOptions: packageOptions([35, 70, 140], 'ml'),
      sourceCheckedAt: CHECKED_AT,
      notes: [
        'Wynik w mg oraz mg/kg/dobę dotyczy amoksycyliny. Każde 5 ml zawiera także 57 mg kwasu klawulanowego; obydwa składniki są pokazywane w wyniku.',
        'Źródłowy zakres stomatologiczny: 25–45 mg amoksycyliny/kg/dobę w 2 dawkach, dla dzieci od 2 miesięcy o masie poniżej 40 kg. Lekarz wybiera dawkę z zakresu i czas leczenia.',
        'Zakres do 70 mg/kg/dobę opisany w ChPL dotyczy wymienionych tam zakażeń ucha, zatok i dolnych dróg oddechowych. Nie jest automatyczną opcją dla zakażenia stomatologicznego.',
        'Przy masie co najmniej 40 kg ChPL odsyła do postaci lub mocy przeznaczonych dla dorosłych. Przy CrCl poniżej 30 ml/min postać 7:1 nie jest zalecana.',
        'Powyżej 14 dni leczenia potrzebna jest ponowna ocena pacjenta. Nie jest to domyślny czas kuracji.',
        'Przygotowana zawiesina: 7 dni w lodówce 2–8°C; nie zamrażać. Wstrząsać przed dawką, podawać z posiłkiem.',
        'Wielkości 35, 70 i 140 ml pochodzą z ChPL; bieżąca dostępność handlowa nie została potwierdzona.',
      ],
    },
  },
  ...[250, 500].map(amount => ({
    drugId: 'amoxicillin', formId: `ospamox-${amount}`,
    changes: {
      packOptions: packageOptions([60, 100], 'ml'),
      sourceCheckedAt: CHECKED_AT,
      notes: [
        'Schemat stomatologiczny obejmuje ropień okołozębowy z szerzącym się zapaleniem tkanki łącznej; rozpoznanie i zasadność antybiotyku ustala lekarz.',
        'U dzieci poniżej 40 kg ChPL podaje 20–90 mg/kg/dobę w dawkach podzielonych. W aplikacji dostępny jest wariant 3 podań; wariant 2 podań wymaga dawki z górnego zakresu i osobnej decyzji lekarza.',
        'Źródłowe podpowiedzi dla tej zawiesiny zaczynają się od 1. miesiąca życia jako zakres aplikacji. Noworodki wymagają osobnego schematu; w pierwszym tygodniu życia ChPL ogranicza częstość do 2 podań na dobę.',
        'Przy masie co najmniej 40 kg stosuje się schematy jak u dorosłych. Zaburzenia czynności nerek wymagają dostosowania dawki; standardowa podpowiedź ich nie obejmuje.',
        'Czas leczenia dobiera lekarz do zakażenia i odpowiedzi pacjenta. Nie ma automatycznej kuracji 7-dniowej.',
        'Sporządzona zawiesina: do 14 dni w lodówce 2–8°C. Wstrząsać przed dawką; sprawdzić możliwość dokładnego odmierzenia obliczonej objętości.',
      ],
    },
  })),
  {
    drugId: 'ibuprofen', formId: 'ibuprom-200',
    changes: {
      packOptions: packageOptions([20, 24, 50]),
      sourceCheckedAt: CHECKED_AT,
      packageScope: 'Wybrane wielkości z ChPL; dostępność w sprzedaży nie została sprawdzona.',
      notes: [
        'Limity Ibuprom 200 mg zależą łącznie od wieku i, u dzieci, masy ciała. Nie zastępuje ich ogólny limit ibuprofenu 2400 mg/dobę.',
        'Dorośli i młodzież powyżej 12 lat: jednorazowo 200–400 mg, maksymalnie 1200 mg/dobę; odstęp co najmniej 4 godziny. Częstość i dawka nie mogą razem przekroczyć limitu dobowego.',
        'Wiek 6–9 lat i masa 20–29 kg: 200 mg, nie więcej niż 600 mg/dobę. Wiek 10–12 lat i masa 30–39 kg: 200 mg, nie więcej niż 800 mg/dobę. Niedopasowany wiek lub masa wymagają osobnego ustalenia postaci i dawkowania.',
        'Stosować doraźnie, w najmniejszej skutecznej dawce przez możliwie krótki czas, po posiłku. Utrzymywanie się objawów, pogorszenie albo potrzeba stosowania ponad 3 dni wymagają oceny lekarza.',
        'Przed wyborem schematu ocenić m.in. czynność nerek, odwodnienie, chorobę wrzodową lub krwawienie, niewydolność serca lub wątroby, ciążę i interakcje. Nie łączyć z innymi NLPZ.',
      ],
    },
  },
  {
    drugId: 'paracetamol', formId: 'metafen-paracetamol-500',
    changes: {
      packOptions: packageOptions([10, 20, 60]),
      sourceCheckedAt: CHECKED_AT,
      notes: [
        'Źródłowa podpowiedź 500–1000 mg dotyczy wieku powyżej 12 lat i masy powyżej 50 kg: doraźnie, do 4 podań/dobę, nie częściej niż co 4 godziny, maksymalnie 4000 mg/dobę.',
        'Przy masie 50 kg lub mniejszej nie stosuj automatycznie limitu 4000 mg. Dawkowanie i wybór postaci wymagają osobnej oceny; ta tabletka nie może być dzielona.',
        'Poniżej 12 lat nie stosować tego produktu. Dla 12-latków ChPL zawiera odrębne zasady zależne od masy; aplikacja nie rozszerza ich na wszystkie inne grupy o małej masie.',
        'Uwzględnić wszystkie preparaty z paracetamolem oraz czynność wątroby i nerek, alkohol i niedożywienie. Choroba alkoholowa oraz ciężka niewydolność wątroby lub nerek są przeciwwskazaniami.',
        'Stosować najmniejszą skuteczną dawkę przez możliwie krótki czas. Regularne stosowanie ponad 3 dni bez konsultacji z lekarzem nie jest zalecane.',
      ],
    },
  },
];

const dentalAbscess = 'Ropień okołozębowy z szerzącym się zapaleniem tkanki łącznej';
const antibioticScreening = 'Lekarz potwierdza wskazanie, wrażliwość przewidywanych patogenów, brak przeciwwskazań i interakcji oraz prawidłową czynność nerek. Zakresy nie obejmują schematów dla niewydolności nerek.';

const adultAmoxicillin = (family, formIds, sourceUrl) => [
  {
    id: `dental-ospamox-${family}-ge40-q8`, formIds,
    label: 'Ropień z szerzącym się zapaleniem · ≥40 kg · co 8 h',
    indication: dentalAbscess, phaseLabel: '250–500 mg na podanie, 3 razy/dobę',
    doseMode: 'fixed', doseRange: { min: 250, max: 500 }, frequency: 3,
    minWeight: 40, maxSingleMg: 500, maxDailyMg: 1500,
  },
  {
    id: `dental-ospamox-${family}-ge40-q12`, formIds,
    label: 'Ropień z szerzącym się zapaleniem · ≥40 kg · co 12 h',
    indication: dentalAbscess, phaseLabel: '750–1000 mg na podanie, 2 razy/dobę',
    doseMode: 'fixed', doseRange: { min: 750, max: 1000 }, frequency: 2,
    minWeight: 40, maxSingleMg: 1000, maxDailyMg: 2000,
  },
  {
    id: `dental-ospamox-${family}-ge40-severe`, formIds,
    label: 'Ciężkie zakażenie · ≥40 kg · co 8 h',
    indication: `${dentalAbscess} — ciężkie zakażenie`,
    phaseLabel: '750–1000 mg na podanie, 3 razy/dobę',
    doseMode: 'fixed', doseRange: { min: 750, max: 1000 }, frequency: 3,
    minWeight: 40, maxSingleMg: 1000, maxDailyMg: 3000,
  },
].map(regimen => ({
  ...regimen, specialties: ['dental'], ...renalNormal,
  ...(family === 'suspension' ? { minAgeMonths: 1 } : {}),
  ...commonSource(sourceUrl, family === 'tablet' ? 'ChPL Ospamox 500/750/1000 mg · RPL' : 'ChPL Ospamox 250/500 mg/5 ml · RPL'),
  sourceSection: '4.1–4.4 (wskazanie stomatologiczne; masa ≥40 kg)',
  limitLabel: 'Górna granica wybranego schematu z ChPL; nie jest uniwersalną dawką maksymalną amoksycyliny',
  screening: antibioticScreening,
  administration: family === 'tablet'
    ? 'Doustnie; tabletki połykać bez żucia, popijając wodą.'
    : 'Doustnie; wstrząsnąć zawiesinę przed każdym podaniem.',
  notes: [
    'Wybierz konkretną dawkę z zakresu i czas leczenia zgodnie ze stanem pacjenta. Nie wyznaczono automatycznie długości kuracji.',
    'Dla czynności nerek wymagającej korekty dawki, dializ lub innych szczególnych warunków stosowania użyj odrębnego schematu po weryfikacji ChPL.',
    'Granica dobowa wynika z górnej dawki i częstości tego wariantu; inne wskazania mają inne zakresy.',
    ...(family === 'suspension' ? ['Podpowiedź aplikacji nie obejmuje noworodków.'] : []),
  ],
}));

const analgesicSource = (sourceUrl, sourceLabel) => ({
  specialties: ['dental'], indication: 'Ból zęba', doseMode: 'fixed', asNeeded: true,
  renalPolicy: 'normal-only', ...commonSource(sourceUrl, sourceLabel),
  screening: 'Lekarz potwierdza zasadność leczenia, czynność nerek, brak przeciwwskazań i istotnych interakcji. W razie czynników ryzyka dawkę i postać ustala indywidualnie.',
  limitLabel: 'Maksymalna dawka dobowa według ChPL tego produktu, dla wskazanej populacji',
});

export const DENTAL_SYSTEMIC_REGIMENS = [
  ...adultAmoxicillin('suspension', ['ospamox-250', 'ospamox-500'], SOURCE.ospamoxSuspension),
  ...adultAmoxicillin('tablet', ['ospamox-tablet-500', 'ospamox-tablet-1000'], SOURCE.ospamoxTablet),
  {
    id: 'dental-ospamox-child-tid', formIds: ['ospamox-250', 'ospamox-500'],
    specialties: ['dental'], patientTypes: ['child'],
    label: 'Ropień z szerzącym się zapaleniem · dziecko <40 kg · 3 podania',
    indication: dentalAbscess,
    phaseLabel: '20–90 mg/kg/dobę w 3 dawkach podzielonych',
    doseMode: 'perKgDay', doseRange: { min: 20, max: 90 }, frequency: 3,
    minAgeMonths: 1, maxWeight: 40, maxWeightExclusive: true,
    maxDailyMgPerKg: 90, ...renalNormal,
    ...commonSource(SOURCE.ospamoxSuspension, 'ChPL Ospamox 250/500 mg/5 ml · RPL'),
    sourceSection: '4.2, 5.2; ulotka §3 (liczba podań)',
    additionalSources: [{
      url: 'https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/22744/leaflet',
      label: 'Ulotka Ospamox · §3: 2 lub 3 dawki podzielone',
    }],
    limitLabel: 'Górna granica zakresu dla wskazania stomatologicznego u dziecka <40 kg: 90 mg/kg/dobę',
    screening: antibioticScreening,
    administration: 'Doustnie, w 3 podaniach na dobę. Wstrząsnąć zawiesinę przed każdym podaniem.',
    notes: [
      '20–90 mg/kg oznacza całą dobę, nie dawkę jednorazową. Konkretną wartość z zakresu i czas leczenia wybiera lekarz.',
      'Wariant aplikacji obejmuje dzieci od 1 miesiąca i 3 podania na dobę. ChPL ogranicza częstość w pierwszym tygodniu życia do 2 podań; schematy noworodkowe nie są tutaj modelowane.',
      'ChPL dopuszcza 2 podania tylko przy dawkach z górnej części zakresu, bez określenia liczbowej granicy. Aplikacja nie wybiera automatycznie tego wariantu.',
      'U dzieci poniżej 3 lat zawiesina zawierająca alkohol benzylowy wymaga uwagi przy stosowaniu ponad tydzień; sprawdź ostrzeżenia ChPL.',
    ],
  },
  {
    id: 'dental-augmentin-400-57-child', formIds: ['augmentin-400-57'],
    specialties: ['dental'], patientTypes: ['child'],
    label: 'Ciężki ropień z szerzącym się zapaleniem · dziecko <40 kg',
    indication: 'Ciężki ropień okołozębowy z szerzącym się zapaleniem tkanki łącznej',
    phaseLabel: '25–45 mg amoksycyliny/kg/dobę w 2 dawkach',
    doseMode: 'perKgDay', doseRange: { min: 25, max: 45 }, frequency: 2,
    minAgeMonths: 2, maxWeight: 40, maxWeightExclusive: true,
    maxDailyMgPerKg: 45, ...renalNormal,
    ...commonSource(SOURCE.augmentin, 'ChPL Augmentin (400 mg + 57 mg)/5 ml · RPL'),
    limitLabel: 'Górna granica wybranego zakresu stomatologicznego: 45 mg amoksycyliny/kg/dobę',
    screening: `${antibioticScreening} Wyklucz także wcześniejszą żółtaczkę lub zaburzenia wątroby związane z amoksycyliną/klawulanianem.`,
    administration: 'Doustnie, z posiłkiem. Wstrząsnąć przed każdym podaniem.',
    notes: [
      'Dawkę wyrażono jako dobową ilość amoksycyliny. Kwas klawulanowy jest obliczany z proporcji 57 mg/400 mg w wybranej zawiesinie.',
      'Źródłowy zakres 25–45 mg/kg/dobę nie jest uniwersalnym limitem dla innych wskazań lub proporcji składników. Większe dawki wymagają oceny właściwej postaci i wskazania.',
      'Nie ustalono zaleceń dla tej postaci poniżej 2 miesięcy. Przy masie co najmniej 40 kg ChPL wskazuje stosowanie postaci lub mocy dla dorosłych.',
      'Przy CrCl <30 ml/min postać 7:1 nie jest zalecana; przy granicy 30 ml/min wymagany jest osobny dobór. Podpowiedź obejmuje ocenioną prawidłową czynność nerek.',
      'Czas kuracji ustala lekarz. Powyżej 14 dni potrzebna jest ponowna ocena pacjenta; aplikacja nie wpisuje 14 dni jako dawki ani czasu domyślnego.',
    ],
  },
  {
    ...analgesicSource(SOURCE.ibuprom, 'ChPL Ibuprom 200 mg · RPL'),
    id: 'dental-ibuprom-200-over12', formIds: ['ibuprom-200'],
    label: 'Ból zęba · dorośli i młodzież >12 lat · doraźnie',
    phaseLabel: '200–400 mg na podanie; łącznie do 1200 mg/dobę',
    doseRange: { min: 200, max: 400 }, frequencyOptions: [1, 2, 3, 4, 5, 6],
    minAgeMonths: 144, minAgeExclusive: true, minIntervalHours: 4,
    maxSingleMg: 400, maxDailyMg: 1200,
    administration: 'Doraźnie w razie bólu, po posiłku; pomiędzy podaniami co najmniej 4 godziny.',
    notes: [
      'Wybierz dawkę i maksymalną liczbę podań na dobę. Jednocześnie musi być zachowany limit 1200 mg: 6 podań nie dopuszcza dawki 400 mg na każde podanie.',
      'Obliczone opakowania odpowiadają maksymalnemu zaplanowanemu zużyciu doraźnemu, nie obowiązkowi przyjęcia wszystkich dawek.',
      'Potrzeba stosowania dłużej niż 3 dni lub pogorszenie objawów wymagają oceny lekarza. Czasu leczenia nie uzupełniono automatycznie.',
    ],
  },
  {
    ...analgesicSource(SOURCE.ibuprom, 'ChPL Ibuprom 200 mg · RPL'),
    id: 'dental-ibuprom-200-child6to9', formIds: ['ibuprom-200'], patientTypes: ['child'],
    label: 'Ból zęba · 6–9 lat i 20–29 kg · doraźnie',
    phaseLabel: '200 mg na podanie; nie więcej niż 3 podania/dobę',
    dose: 200, frequencyOptions: [1, 2, 3],
    minAgeMonths: 72, maxAgeMonths: 120, maxAgeExclusive: true,
    minWeight: 20, maxWeight: 29, minIntervalHours: 6,
    maxSingleMg: 200, maxDailyMg: 600,
    administration: 'Doraźnie po posiłku; odstęp między podaniami 6–8 godzin, najwyżej 3 podania w ciągu doby.',
    notes: [
      'Wymagane jest jednoczesne spełnienie zakresu wieku i masy. Nie przenoś limitu z tego wiersza na inne dzieci.',
      'ChPL podaje odstęp 6–8 godzin i ograniczenie do 3 tabletek/dobę; odstęp 6 godzin nie oznacza zgody na 4 dawki w ciągu doby.',
      'Po 3 dniach stosowania, przy utrzymywaniu się dolegliwości lub pogorszeniu konieczna jest ocena lekarza.',
    ],
  },
  {
    ...analgesicSource(SOURCE.ibuprom, 'ChPL Ibuprom 200 mg · RPL'),
    id: 'dental-ibuprom-200-child10to12', formIds: ['ibuprom-200'], patientTypes: ['child'],
    label: 'Ból zęba · 10–12 lat i 30–39 kg · doraźnie',
    phaseLabel: '200 mg na podanie; nie więcej niż 4 podania/dobę',
    dose: 200, frequencyOptions: [1, 2, 3, 4],
    minAgeMonths: 120, maxAgeMonths: 144, minWeight: 30, maxWeight: 39,
    minIntervalHours: 6, maxSingleMg: 200, maxDailyMg: 800,
    administration: 'Doraźnie po posiłku; odstęp co najmniej 6 godzin, najwyżej 4 podania w ciągu doby.',
    notes: [
      'Wymagane jest jednoczesne spełnienie zakresu wieku i masy. Wybór innej postaci lub dawki wymaga oceny lekarza.',
      'Po 3 dniach stosowania, przy utrzymywaniu się dolegliwości lub pogorszeniu konieczna jest ocena lekarza.',
    ],
  },
  {
    ...analgesicSource(SOURCE.paracetamol, 'ChPL Metafen Paracetamol 500 mg · RPL'),
    id: 'dental-metafen-paracetamol-over12-over50', formIds: ['metafen-paracetamol-500'],
    label: 'Ból zęba · >12 lat i >50 kg · doraźnie',
    phaseLabel: '500–1000 mg na podanie; do 4 podań/dobę',
    doseRange: { min: 500, max: 1000 }, frequencyOptions: [1, 2, 3, 4],
    minAgeMonths: 144, minAgeExclusive: true,
    minWeight: 50, minWeightExclusive: true,
    minIntervalHours: 4, maxSingleMg: 1000, maxDailyMg: 4000,
    administration: 'Doustnie, doraźnie w razie bólu; pomiędzy podaniami co najmniej 4 godziny, do 4 podań na dobę.',
    notes: [
      'Tabletki nie wolno dzielić. Zakres 500–1000 mg wymaga wybrania dawki możliwej do podania w całych tabletkach.',
      'Limit dotyczy łącznej ilości paracetamolu ze wszystkich preparatów. Choroby wątroby lub nerek, alkohol i niedożywienie wymagają osobnej oceny; nie potwierdzaj automatycznie limitu 4000 mg.',
      'Dla pacjentów o masie 50 kg lub mniejszej oraz wieku 12 lat lub mniej ten schemat nie jest dostępny. Sprawdź odrębne zasady ChPL i odpowiednią postać.',
      'Regularne stosowanie ponad 3 dni wymaga konsultacji z lekarzem. Obliczane zapotrzebowanie doraźne jest maksymalnym planowanym zużyciem.',
    ],
  },
];

export const DENTAL_SYSTEMIC_RESEARCH_NOTES = {
  checkedAt: CHECKED_AT,
  packageEvidence: [
    { formIds: ['augmentin-400-57'], sizes: [35, 70, 140], unit: 'ml', sourceUrl: SOURCE.augmentin, section: '6.5' },
    { formIds: ['ospamox-250', 'ospamox-500'], sizes: [60, 100], unit: 'ml', sourceUrl: SOURCE.ospamoxSuspension, section: '6.5' },
    { formIds: ['ospamox-tablet-500'], sizes: [7, 10, 14, 16, 20, 28, 100, 500, 1000], selectedSizes: [14, 16, 20], unit: 'tabl.', sourceUrl: SOURCE.ospamoxTablet, section: '6.5' },
    { formIds: ['ospamox-tablet-1000'], sizes: [7, 10, 12, 14, 16, 20, 28, 30, 50], selectedSizes: [14, 16, 20], unit: 'tabl.', sourceUrl: SOURCE.ospamoxTablet, section: '6.5' },
    { formIds: ['ibuprom-200'], sizes: [2, 4, 6, 10, 12, 20, 24, 30, 50, 96], selectedSizes: [20, 24, 50], unit: 'tabl.', sourceUrl: SOURCE.ibuprom, section: '6.5' },
    { formIds: ['metafen-paracetamol-500'], sizes: [10, 20, 60], unit: 'tabl.', sourceUrl: SOURCE.paracetamol, section: '6.5' },
  ],
  scope: [
    'Ospamox tablet data uses the family with permits 16801/16802/16687; the legacy Ospamox permit family has different pack metadata and was not merged.',
    'No 4000 mg/day universal amoxicillin maximum, no antibiotic dose or duration default, no automatic higher-dose dental Augmentin regimen.',
    'Amoxicillin dental regimen maxima are computed upper bounds of the selected source range and frequency. Labels must retain that scope.',
    'Normal renal function requires clinician review. A known CrCl at or below 30 ml/min rejects standard antibiotic suggestions; renal impairment/dialysis regimens are outside this module.',
    'Pediatric Ospamox suggestions deliberately exclude newborns and the conditional BID option. This is application coverage, not a new drug contraindication.',
    'Metafen low-weight wording requires separate clinical interpretation. No broad low-weight numerical suggestion was created from the narrow 12-year-old passage.',
    'PRN frequency represents a clinician-selected daily administration ceiling. Export must retain as-needed wording, minimum intervals and the daily limit.',
    'All records need independent clinical review; retrieval of a source is not validation of the complete prescribing workflow.',
  ],
};
