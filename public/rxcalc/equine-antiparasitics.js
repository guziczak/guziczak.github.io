/**
 * Source-bound Polish equine antiparasitic formulations and selected regimens.
 * Product mass is expressed in grams; strengthMg means active mg per product g.
 * A selected regimen is not an automatically chosen deworming programme.
 */
const checked = '2026-11-13';
const paramectinUrl = 'https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/18731/characteristic';
const iverprazUrl = 'https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/31634/characteristic';
const equimoxinUrl = 'https://rejestry.ezdrowie.gov.pl/api/rpl/medicinal-products/47141/characteristic';
const pyrantelUrl = 'https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/16565/characteristic';

const baseForm = {
  form: 'oralPaste', unitLabel: 'g', targetSpecies: ['horse'],
  routeCode: 'oral', routeLabel: 'doustnie',
  strengthMg: null, concentrationMg: null, concentrationMl: null,
  maxDailyMg: null, maxSingleMg: null, minAge: null, shelfLifeDays: null,
  defaultDose: null, defaultFrequency: null, defaultDays: null,
  defaultMode: 'perKgDose', allowedFractions: [1],
  sourceLabel: 'Polska ChPL · RPL', sourceCheckedAt: checked,
  clinicalReviewStatus: 'not-clinically-validated',
};
const baseRegimen = {
  species: ['horse'], frequency: 1, fixedDays: 1,
  phaseLabel: 'Podanie jednorazowe',
  sourceLabel: 'Polska ChPL · RPL', sourceCheckedAt: checked,
};

export const EQUINE_ANTIPARASITIC_DRUGS = [
  {
    id: 'vet-paramectin', name: 'Paramectin Pasta', substance: 'Ivermectinum', substanceLabel: 'Iwermektyna',
    category: 'antiparasitic', specialties: ['veterinary'],
    searchTerms: ['iwermektyna', 'ivermectin', 'słupkowce', 'glisty', 'owsiki', 'gzy', 'gasterophilus'],
    forms: [{
      ...baseForm,
      id: 'paramectin-horse-paste-18-7', label: 'Paramectin Pasta · 18,7 mg/g · koń',
      substanceLabel: 'Iwermektyna', strengthMg: 18.7, doseBasisIngredient: 'iwermektyny',
      activeIngredients: [{ substanceLabel: 'Iwermektyna', strengthMg: 18.7 }],
      packOptions: [{ id: '7.49', label: '1 strzykawka doustna × 7,49 g', quantity: 7.49 }],
      sourceUrl: paramectinUrl, sourceSection: '2; 3.2–3.9; 3.12; 5.2–5.4',
      registrationUrl: 'https://medicines.health.europa.eu/veterinary/pl/600000060088',
      doseStepUnits: 20 / 18.7, doseStepLabel: 'jedna działka = 100 kg na podziałce przy dawce 0,2 mg/kg',
      discardRemainderAfterUse: true, singleUseUnitSize: 7.49,
      measurementNote: 'Podziałka co 100 kg; gramy obliczono z 0,2 mg/kg i 18,7 mg/g. ChPL określa masę jednej działki jako około 1 g. Nie zaokrąglamy masy konia do kreski.',
      packageCalculationNote: 'Po podaniu niewykorzystaną pastę należy usunąć; otwartej strzykawki nie przechowuje się do kolejnego podania.',
      notes: [
        'Jedna strzykawka 7,49 g; podziałka obejmuje do 700 kg. Wynik w gramach dotyczy całej pasty.',
        'Karencja tkanek jadalnych: 21 dni. Nie stosować u zwierząt produkujących mleko dla ludzi.',
      ],
    }],
  },
  {
    id: 'vet-iverpraz', name: 'Iverpraz', substance: 'Ivermectinum + Praziquantelum', substanceLabel: 'Iwermektyna + prazykwantel',
    category: 'antiparasitic', specialties: ['veterinary'],
    searchTerms: ['iwermektyna', 'prazykwantel', 'prazikwantel', 'tasiemce', 'anoplocephala', 'nicienie', 'gzy'],
    forms: [{
      ...baseForm,
      id: 'iverpraz-horse-paste-18-7-140-3', label: 'Iverpraz · 18,7 + 140,3 mg/g · koń',
      substanceLabel: 'Iwermektyna + prazykwantel', strengthMg: 18.7, doseBasisIngredient: 'iwermektyny',
      activeIngredients: [
        { substanceLabel: 'Iwermektyna', strengthMg: 18.7 },
        { substanceLabel: 'Prazykwantel', strengthMg: 140.3 },
      ],
      defaultMode: 'units',
      packOptions: [{ id: '7.49', label: '1 strzykawka doustna × 7,49 g', quantity: 7.49 }],
      sourceUrl: iverprazUrl, sourceSection: '2; 4.2–4.9; 4.11; 6.3–6.5',
      doseStepUnits: 0.535, doseStepLabel: 'jedna działka = 50 kg na podziałce; ilość według tabeli ChPL',
      unmodelledShelfLifeMonths: 6,
      measurementNote: 'Schemat korzysta z literalnej tabeli gramów pasty w ChPL. Działka odpowiada 0,535 g; zakresów pomiędzy wydrukowanymi przedziałami nie uzupełniamy przez zaokrąglenie masy.',
      combinationNote: 'Nominalne dawki w ChPL: 0,2 mg iwermektyny/kg i 1,5 mg prazykwantelu/kg. Podane moce i tabela gramów nie dają dokładnie tego samego ilorazu. Wynik pochodzi z tabeli, a wartość mg dotyczy iwermektyny.',
      notes: [
        'Preparat złożony do mieszanych inwazji obejmujących tasiemce; rozpoznanie wybiera lekarz.',
        'Po otwarciu: 6 miesięcy; nie przeliczono tego terminu na stałą liczbę dni.',
        'Karencja tkanek jadalnych: 35 dni. Nie stosować przy mleku przeznaczonym dla ludzi.',
      ],
    }],
  },
  {
    id: 'vet-equimoxin', name: 'Equimoxin', substance: 'Moxidectinum', substanceLabel: 'Moksydektyna',
    category: 'antiparasitic', specialties: ['veterinary'],
    searchTerms: ['moksydektyna', 'moxidectin', 'słupkowce', 'cyathostomum', 'gzy', 'gasterophilus'],
    forms: [{
      ...baseForm,
      id: 'equimoxin-horse-gel-18-92', label: 'Equimoxin · 18,92 mg/g · żel doustny',
      form: 'oralGel', substanceLabel: 'Moksydektyna', strengthMg: 18.92, doseBasisIngredient: 'moksydektyny',
      activeIngredients: [{ substanceLabel: 'Moksydektyna', strengthMg: 18.92 }],
      packOptions: [{ id: '14.8', label: '1 aplikator doustny × 14,8 g', quantity: 14.8 }],
      sourceUrl: equimoxinUrl, sourceSection: '2; 4.1–4.9; 4.11; 6.3–6.5',
      doseStepUnits: 20 / 18.92, doseStepLabel: 'jedna działka = 50 kg na podziałce przy dawce 0,4 mg/kg',
      unmodelledShelfLifeMonths: 6, requiresFoodChainExclusion: true,
      measurementNote: 'Aplikator: 14 działek po 50 kg. Z dawki 0,4 mg/kg i mocy 18,92 mg/g wynika około 1,05708 g/działkę; ChPL podaje także 1,056 g/50 kg. Nastawę potwierdź na aplikatorze. Niewykonalnych części działki nie zaokrąglamy.',
      notes: [
        'Koń musi być wyłączony z produkcji żywności zgodnie z dokumentacją identyfikacyjną. Zakaz dotyczy tkanek i mleka.',
        'Po otwarciu: 6 miesięcy; termin kalendarzowy wymaga sprawdzenia daty otwarcia.',
        'Źródło opisuje jednorazowe podanie. Długotrwałego efektu przeciwpasożytniczego nie traktujemy jako codziennego schematu.',
      ],
    }],
  },
  {
    id: 'vet-pyrantel-vet-planet', name: 'Pyrantel Vet Planet', substance: 'Pyranteli embonas', substanceLabel: 'Embonian pyrantelu',
    category: 'antiparasitic', specialties: ['veterinary'],
    searchTerms: ['pyrantel', 'embonian', 'vetos farma', 'nicienie', 'tasiemce', 'anoplocephala', 'glisty', 'owsiki'],
    forms: [{
      ...baseForm,
      id: 'pyrantel-vet-planet-horse-paste-350', label: 'Pyrantel Vet Planet · 350 mg/g · koń',
      substanceLabel: 'Embonian pyrantelu', strengthMg: 350, doseBasisIngredient: 'embonianu pyrantelu',
      activeIngredients: [{ substanceLabel: 'Embonian pyrantelu', strengthMg: 350 }],
      packOptions: [{ id: '30', label: '1 strzykawka doustna × 30 g', quantity: 30 }],
      sourceUrl: pyrantelUrl, sourceSection: '2; 4.2; 4.6–4.11; 6.3–6.5',
      registrationUrl: 'https://medicines.health.europa.eu/veterinary/en/600000074287',
      requiresFoodChainExclusion: true,
      measurementNote: '35 g/100 g = 350 mg embonianu pyrantelu/g pasty. Wynik to gramy pasty, nie wolnego pyrantelu. ChPL nie podaje liczbowego kroku dozownika; potwierdź odmierzenie według opakowania.',
      notes: [
        'Tubostrzykawka opisana jako 50 ml zawiera 30 g produktu; zapotrzebowanie obliczamy w gramach.',
        'Nie stosować u koni przeznaczonych do spożycia przez ludzi.',
        'Polska ChPL nazywa produkt Pyrantel Vet Planet; część metadanych rejestru zachowuje dawną nazwę Vetos-Farma.',
      ],
    }],
  },
];

export const EQUINE_ANTIPARASITIC_REGIMENS = [
  {
    ...baseRegimen,
    id: 'paramectin-horse-susceptible-parasites', formIds: ['paramectin-horse-paste-18-7'],
    label: 'Nicienie i gzy wymienione w ChPL · jedno podanie',
    indication: 'Inwazje wrażliwych nicieni oraz larw Gasterophilus spp. w gatunkach i stadiach wymienionych w ChPL',
    doseMode: 'perKgDose', dose: 0.2, minimumAge: { value: 6, unit: 'weeks' },
    sourceUrl: paramectinUrl, sourceSection: '3.2–3.9; 3.12; 5.3–5.4',
    screening: 'Potwierdź pasożyta i stadium, masę oraz nadwrażliwość. Zabezpiecz pastę i aplikator przed psami, kotami i innymi gatunkami.',
    administration: 'Podać na nasadę języka; nastawić podziałkę według masy. Pozostałości nie przechowywać.',
    notes: [
      'ChPL opisuje pierwszą dawkę u źrebiąt w wieku 6–8 tygodni. Ten schemat obejmuje wiek od 6 tygodni; nie jest automatycznym harmonogramem dla źrebiąt.',
      'Nie obejmuje tasiemców. Termin ewentualnego kolejnego podania ustala lekarz na podstawie sytuacji epidemiologicznej.',
    ],
  },
  {
    ...baseRegimen,
    id: 'iverpraz-horse-mixed-infestation-table', formIds: ['iverpraz-horse-paste-18-7-140-3'],
    label: 'Mieszane inwazje z tasiemcami · tabela ChPL',
    indication: 'Mieszane inwazje tasiemców oraz nicieni lub stawonogów wymienionych w ChPL',
    doseMode: 'units', minimumAge: { value: 2, unit: 'weeks' },
    // Literal source ranges, including the printed first row and 1 kg gaps.
    // Units are grams of the combination paste, not mg of either ingredient.
    weightBands: [
      { min: 0, minInclusive: false, max: 100, maxInclusive: true, units: 1.070 },
      { min: 101, minInclusive: true, max: 150, maxInclusive: true, units: 1.605 },
      { min: 151, minInclusive: true, max: 200, maxInclusive: true, units: 2.140 },
      { min: 201, minInclusive: true, max: 250, maxInclusive: true, units: 2.675 },
      { min: 251, minInclusive: true, max: 300, maxInclusive: true, units: 3.210 },
      { min: 301, minInclusive: true, max: 350, maxInclusive: true, units: 3.745 },
      { min: 351, minInclusive: true, max: 400, maxInclusive: true, units: 4.280 },
      { min: 401, minInclusive: true, max: 450, maxInclusive: true, units: 4.815 },
      { min: 451, minInclusive: true, max: 500, maxInclusive: true, units: 5.350 },
      { min: 501, minInclusive: true, max: 550, maxInclusive: true, units: 5.885 },
      { min: 551, minInclusive: true, max: 600, maxInclusive: true, units: 6.420 },
      { min: 601, minInclusive: true, max: 650, maxInclusive: true, units: 6.955 },
      { min: 651, minInclusive: true, max: 700, maxInclusive: true, units: 7.490 },
    ],
    sourceUrl: iverprazUrl, sourceSection: '4.2–4.9, tabela dawkowania; 4.11; 6.3–6.5',
    screening: 'Potwierdź mieszaną inwazję i miejscową wrażliwość pasożytów. Oceń nadwrażliwość i ryzyko przy masywnej inwazji; zabezpiecz preparat przed psami i kotami.',
    administration: 'Ustawić pierścień według wybranego wiersza tabeli; podać na tylną część języka bez resztek pokarmu i sprawdzić połknięcie.',
    notes: [
      'Tabela określa gramy gotowej pasty; dawki składników nie są oddzielnie dobierane.',
      'Poniżej 2 miesięcy źródło nie uznaje leczenia za konieczne ze względu na małe prawdopodobieństwo tasiemców. Próg przeciwwskazania wynosi 2 tygodnie.',
      'Poza literalną tabelą nie dobieramy sąsiedniej masy ani nie przedłużamy podania na codzienną kurację.',
    ],
  },
  {
    ...baseRegimen,
    id: 'equimoxin-horse-susceptible-parasites', formIds: ['equimoxin-horse-gel-18-92'],
    label: 'Wrażliwe nicienie i gzy z ChPL · jedno podanie',
    indication: 'Inwazje pasożytów wrażliwych na moksydektynę, w tym słupkowców oraz Gasterophilus intestinalis i G. nasalis, w stadiach wymienionych w ChPL',
    doseMode: 'perKgDose', dose: 0.4, minimumAge: { value: 4, unit: 'months' },
    requiresFoodChainExclusion: true,
    sourceUrl: equimoxinUrl, sourceSection: '4.1–4.9; 4.11; 6.3–6.5',
    screening: 'Sprawdź wyłączenie konia z produkcji żywności, wiek, dokładną masę i nadwrażliwość. Oceń wskazanie z uwzględnieniem badań kału lub ryzyka inwazji.',
    administration: 'Odmierzyć pełne działki aplikatora według masy; podać na tylną część języka i sprawdzić połknięcie.',
    notes: [
      'Nie wyznaczamy schematu powtórzeń ani leczenia tasiemców.',
      'Nie dopuszczać konia do cieków wodnych przez pierwszy tydzień po leczeniu. Chronić psy i koty przed resztkami żelu.',
    ],
  },
  {
    ...baseRegimen,
    id: 'pyrantel-vet-planet-horse-nematodes', formIds: ['pyrantel-vet-planet-horse-paste-350'],
    label: 'Wrażliwe nicienie jelitowe · jedno podanie',
    indication: 'Inwazje nicieni jelitowych wymienionych w ChPL: Parascaris equorum, Strongylus vulgaris, S. equinus, S. edentatus, Probstmayria vivipara i Oxyuris equi',
    doseMode: 'perKgDose', dose: 19, requiresFoodChainExclusion: true,
    sourceUrl: pyrantelUrl, sourceSection: '4.2; 4.6–4.11; 6.3–6.5',
    screening: 'Sprawdź wyłączenie konia z produkcji żywności. Oceń masywność inwazji glist i ryzyko niedrożności; sprawdź piperazynę oraz środki fosforoorganiczne i dietylokarbaminiany.',
    administration: 'Odmierzoną pastę podać na nasadę języka.',
    notes: ['19 mg/kg odnosi się do embonianu pyrantelu. Nie podstawiaj dawki wolnego pyrantelu.'],
  },
  {
    ...baseRegimen,
    id: 'pyrantel-vet-planet-horse-anoplocephala', formIds: ['pyrantel-vet-planet-horse-paste-350'],
    label: 'Anoplocephala perfoliata · jedno podanie',
    indication: 'Inwazja tasiemca jelitowego Anoplocephala perfoliata',
    doseMode: 'perKgDose', dose: 38, requiresFoodChainExclusion: true,
    sourceUrl: pyrantelUrl, sourceSection: '4.2; 4.6–4.11; 6.3–6.5',
    screening: 'Potwierdź Anoplocephala perfoliata i wyłączenie konia z produkcji żywności; sprawdź interakcje, w szczególności piperazynę.',
    administration: 'Odmierzoną pastę podać na nasadę języka.',
    notes: ['38 mg embonianu pyrantelu/kg to odrębny jednorazowy schemat dla tego tasiemca; nie jest przedłużeniem schematu przeciw nicieniom.'],
  },
];
