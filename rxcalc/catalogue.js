/**
 * RxCalc product metadata, version 2026.11.12.
 * Sources are linked on every formulation. This is a limited calculation
 * catalogue, not a clinical guideline, reimbursement database or complete ChPL.
 * No regimen is inferred from a diagnosis. Prescriber enters and confirms it.
 */

export const CATALOGUE_META = Object.freeze({
  version: '2026.11.12',
  sourceCheckedAt: '2026-11-12',
  status: 'Wersja do weryfikacji',
  scope: 'Dane wybranych postaci i opakowań do przeliczeń. Dawka, wskazanie, interakcje i przeciwwskazania wymagają oceny lekarza na podstawie aktualnej ChPL.',
  availabilityNote: 'Wielkości opakowań pochodzą z dokumentów rejestracyjnych. Dostępność w sprzedaży i refundacja nie są sprawdzane.',
});

export const CATEGORIES = Object.freeze({
  dental: [
    { id: 'antibiotics', label: 'Antybiotyki' },
    { id: 'pain', label: 'Przeciwbólowe' },
    { id: 'mucosa', label: 'Jama ustna' },
  ],
  cardio: [
    { id: 'anticoagulants', label: 'Antykoagulanty' },
    { id: 'beta', label: 'Beta-blokery' },
    { id: 'bloodpressure', label: 'ACE-I / ARB' },
    { id: 'diuretic', label: 'Diuretyki' },
    { id: 'lipid', label: 'Lipidy' },
  ],
});

const rpl = id => `https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/${id}/characteristic`;
const ema = name => `https://www.ema.europa.eu/en/documents/product-information/${name}-epar-product-information_en.pdf`;
const packages = (sizes, unit = 'tabl.') => sizes.map(quantity => ({
  id: String(quantity), label: `${String(quantity).replace('.', ',')} ${unit}`, quantity,
}));
const baseForm = {
  strengthMg: null, concentrationMg: null, concentrationMl: null,
  maxDailyMg: null, maxSingleMg: null, minAge: null, shelfLifeDays: null,
  defaultDose: null, defaultFrequency: null, defaultDays: null,
  defaultMode: 'fixed', allowedFractions: [1],
  sourceCheckedAt: CATALOGUE_META.sourceCheckedAt,
  clinicalReviewStatus: 'not-clinically-validated',
};
const tablet = (id, label, strengthMg, sizes, sourceUrl, options = {}) => ({
  ...baseForm, id, label, form: 'tablet', unitLabel: 'tabl.', strengthMg,
  packOptions: packages(sizes), sourceUrl, sourceLabel: 'ChPL · skład, postać i opakowania',
  routeLabel: 'doustnie', notes: [], ...options,
});
const liquid = (id, label, form, concentrationMg, concentrationMl, sizes, sourceUrl, options = {}) => ({
  ...baseForm, id, label, form, unitLabel: 'ml', concentrationMg, concentrationMl,
  packOptions: packages(sizes, 'ml'), sourceUrl,
  sourceLabel: 'ChPL · skład, postać i opakowania', routeLabel: 'doustnie', notes: [], ...options,
});

export const DRUGS = [
  {
    id: 'amoxicillin-clavulanate',
    name: 'Amoksycylina + klawulanian',
    substance: 'Amoxicillinum + Acidum clavulanicum',
    category: 'antibiotics', specialties: ['dental'],
    searchTerms: ['augmentin', 'amoksycylina', 'klawulanowy', 'antybiotyk', 'ropień', 'zakażenie'],
    forms: [liquid('augmentin-400-57', 'Augmentin · 400 + 57 mg/5 ml', 'suspension', 400, 5, [70, 140], rpl(8695), {
      doseBasisIngredient: 'amoksycyliny', shelfLifeDays: 7,
      ingredients: [
        { name: 'amoksycylina', amountMg: 400, perMl: 5 },
        { name: 'kwas klawulanowy', amountMg: 57, perMl: 5 },
      ],
      notes: [
        'Wynik w mg odnosi się do amoksycyliny. Każde 5 ml zawiera również 57 mg kwasu klawulanowego.',
        'Schemat zależy od wskazania, wieku, masy i czynności nerek. Dla tej proporcji 7:1 nie ustawiono automatycznej dawki wysokiej.',
        'Przy CrCl poniżej 30 ml/min ta postać 7:1 nie jest zalecana; wymagany jest wybór odpowiedniej postaci i schematu według ChPL.',
        'Po sporządzeniu: do 7 dni w lodówce 2–8°C. Wstrząsnąć przed użyciem; podawać na początku posiłku.',
      ],
    })],
  },
  {
    id: 'amoxicillin', name: 'Amoksycylina', substance: 'Amoxicillinum',
    category: 'antibiotics', specialties: ['dental'],
    searchTerms: ['ospamox', 'amoksycylina', 'antybiotyk', 'ropień', 'zakażenie'],
    forms: [250, 500].map(amount => liquid(`ospamox-${amount}`, `Ospamox · ${amount} mg/5 ml`, 'suspension', amount, 5, [60, 100], rpl(22744), {
      doseBasisIngredient: 'amoksycyliny', shelfLifeDays: 14,
      notes: [
        'Dawkę i liczbę podań dobiera lekarz do wskazania, masy, wieku i czynności nerek. Katalog nie wybiera schematu antybiotykoterapii.',
        'Sporządzoną zawiesinę przechowywać w lodówce 2–8°C, do 14 dni. Wstrząsnąć przed podaniem.',
      ],
    })),
  },
  {
    id: 'ibuprofen', name: 'Ibuprofen', substance: 'Ibuprofenum',
    category: 'pain', specialties: ['dental'],
    searchTerms: ['ibuprom', 'ibuprofen', 'ból', 'ból zęba', 'nlpz', 'gorączka'],
    forms: [tablet('ibuprom-200', 'Ibuprom · 200 mg', 200, [20, 24, 50], rpl(19798), {
      minAge: 6,
      conditionalLimits: [
        { minAgeExclusive: 12, maxDailyMg: 1200, maxSingleMg: 400, label: 'ChPL Ibuprom 200 mg: dorośli i młodzież powyżej 12 lat' },
      ],
      notes: [
        'Zakres automatycznego limitu obejmuje wyłącznie wiek powyżej 12 lat. U młodszych dzieci dawka maksymalna zależy również od masy — sprawdź ChPL.',
        'Nie łączyć z innymi NLPZ. Przed ordynacją sprawdź m.in. ryzyko krwawienia, czynność nerek, ciążę i inne leki.',
        'Dla tego produktu ChPL określa maksymalnie 1200 mg/dobę u dorosłych i młodzieży powyżej 12 lat; nie należy zastępować tego limitu ogólnym limitem dla substancji.',
      ],
    })],
  },
  {
    id: 'paracetamol', name: 'Paracetamol', substance: 'Paracetamolum',
    category: 'pain', specialties: ['dental'],
    searchTerms: ['metafen paracetamol', 'paracetamol', 'ból', 'ból zęba', 'gorączka'],
    forms: [tablet('metafen-paracetamol-500', 'Metafen Paracetamol · 500 mg', 500, [20, 60], rpl(44355), {
      minAge: 12,
      conditionalLimits: [
        { minAgeExclusive: 12, minWeightExclusive: 50, maxDailyMg: 4000, maxSingleMg: 1000, label: 'ChPL: wiek powyżej 12 lat i masa powyżej 50 kg; oceniane wyłącznie limity dawki' },
      ],
      notes: [
        'Tej tabletki nie można dzielić. Produkt nie jest przeznaczony dla dzieci poniżej 12 lat.',
        'Limit 4000 mg/dobę dotyczy określonej populacji z ChPL; nie stanowi indywidualnej rekomendacji. Uwzględnij wątrobę, alkohol, niedożywienie i inne preparaty z paracetamolem.',
        'Przy masie 50 kg lub mniejszej wymagane jest osobne ustalenie limitu według ChPL. Uwzględnij odstępy między podaniami.',
      ],
    })],
  },
  {
    id: 'benzydamine', name: 'Benzydamina', substance: 'Benzydamini hydrochloridum',
    category: 'mucosa', specialties: ['dental'],
    searchTerms: ['tantum verde', 'benzydamina', 'afta', 'jama ustna', 'gardło', 'płukanka', 'spray'],
    forms: [
      {
        ...baseForm, id: 'tantum-verde-spray', label: 'Tantum Verde · 1,5 mg/ml, aerozol',
        form: 'spray', unitLabel: 'rozp.', strengthMg: 0.255, defaultMode: 'units', unitOnly: true,
        packOptions: [{ id: '176', label: '30 ml · ok. 176 rozp.', quantity: 176, estimated: true }],
        sourceUrl: rpl(6561), sourceLabel: 'ChPL · 0,17 ml na rozpylenie, opakowanie 30 ml',
        routeLabel: 'na błonę śluzową jamy ustnej i gardła',
        notes: [
          'Jedno rozpylenie to 0,17 ml. Liczbę rozpyleń na podanie należy ustalić dla wieku i masy zgodnie z ChPL.',
          'Około 176 rozpyleń to szacunek 30 ml ÷ 0,17 ml, bez strat na przygotowanie pompki. Potwierdź wydajność opakowania przed ordynacją.',
          'Leczenie ciągłe powyżej 7 dni wymaga decyzji lekarza.',
        ],
      },
      liquid('tantum-verde-rinse', 'Tantum Verde · 1,5 mg/ml, płukanka', 'solution', 1.5, 1, [120, 240], rpl(6560), {
        defaultMode: 'units', unitOnly: true, routeLabel: 'do płukania jamy ustnej i gardła',
        notes: [
          'Roztwór miejscowy do płukania; nie jest to dawka do połknięcia. Sposób użycia i czas płukania określa ChPL.',
          'Sprawdź zdolność pacjenta do prawidłowego płukania. Leczenie ciągłe powyżej 7 dni wymaga decyzji lekarza.',
        ],
      }),
    ],
  },
  {
    id: 'nystatin', name: 'Nystatyna', substance: 'Nystatinum',
    category: 'mucosa', specialties: ['dental'],
    searchTerms: ['nystatyna teva', 'nystatyna', 'grzybica', 'candida', 'pleśniawki', 'jama ustna'],
    forms: [liquid('nystatyna-teva', 'Nystatyna Teva · 100 000 j.m./ml', 'suspension', null, null, [28], rpl(20512), {
      defaultMode: 'units', unitOnly: true, routeLabel: '', shelfLifeDays: 7,
      notes: [
        'Wprowadź przepisaną objętość w ml. Stężenie wynosi 100 000 j.m./ml; ta postać nie obsługuje przeliczenia z mg.',
        'Sposób stosowania w jamie ustnej lub doustnie zależy od wskazania i wymaga uzupełnienia w zaleceniach.',
        'Po sporządzeniu uzyskuje się 28 ml zawiesiny. Trwałość 7 dni, przechowywanie w lodówce 2–8°C; wstrząsnąć przed podaniem.',
      ],
    })],
  },
  {
    id: 'apixaban', name: 'Apiksaban', substance: 'Apixabanum',
    category: 'anticoagulants', specialties: ['cardio'],
    searchTerms: ['eliquis', 'apiksaban', 'apixaban', 'noac', 'doac', 'migotanie przedsionków', 'zakrzepica'],
    forms: [2.5, 5].map(strength => tablet(`eliquis-${strength}`, `Eliquis · ${String(strength).replace('.', ',')} mg`, strength, [60], ema('eliquis'), {
      notes: [
        'Dawkę ustal dla konkretnego wskazania i fazy leczenia. Katalog nie stosuje automatycznej redukcji dawki.',
        'Reguła dwóch z trzech kryteriów wieku, masy i kreatyniny dotyczy określonego zastosowania w NVAF; nie można jej przenosić na wszystkie wskazania.',
        'Przed ordynacją oceń m.in. CrCl, ryzyko krwawienia, interakcje i czynność wątroby zgodnie z ChPL.',
      ],
    })),
  },
  {
    id: 'rivaroxaban', name: 'Rywaroksaban', substance: 'Rivaroxabanum',
    category: 'anticoagulants', specialties: ['cardio'],
    searchTerms: ['xarelto', 'rywaroksaban', 'rivaroxaban', 'noac', 'doac', 'migotanie przedsionków', 'zakrzepica'],
    forms: [15, 20].map(strength => tablet(`xarelto-${strength}`, `Xarelto · ${strength} mg`, strength, [28, 98], ema('xarelto'), {
      routeLabel: 'doustnie, z posiłkiem',
      notes: [
        'Tabletki 15 mg i 20 mg przyjmować z posiłkiem. Nie dzielić tabletki w celu uzyskania części dawki.',
        'Schemat i korekta nerkowa zależą od wskazania oraz fazy leczenia; wymagają oceny według ChPL. Nie wprowadzono automatycznego wyboru dawki.',
      ],
    })),
  },
  {
    id: 'metoprolol', name: 'Metoprolol', substance: 'Metoprololi succinas',
    category: 'beta', specialties: ['cardio'],
    searchTerms: ['betaloc', 'zok', 'metoprolol', 'beta bloker', 'niewydolność serca', 'nadciśnienie'],
    forms: [
      { trade: 25, actual: 23.75, fractions: [1, 0.5] },
      { trade: 50, actual: 47.5, fractions: [1] },
      { trade: 100, actual: 95, fractions: [1] },
    ].map(({trade, actual, fractions}) => tablet(`betaloc-zok-${trade}`, `Betaloc ZOK ${trade} · ${String(actual).replace('.', ',')} mg`, actual, [28], rpl(7778), {
      defaultMode: 'units', doseBasisIngredient: 'metoprololu bursztynianu', allowedFractions: fractions,
      notes: [
        `Jedna tabletka zawiera ${String(actual).replace('.', ',')} mg bursztynianu metoprololu, równoważne ${trade} mg winianu. Tryb mg odnosi się do bursztynianu; dla dawek opisanych nazwą ZOK wybierz liczbę tabletek.`,
        trade === 25 ? 'Tabletka ZOK 25 może być dzielona na równe połowy; nie żuć ani nie kruszyć.' : 'Nacięcie służy ułatwieniu połykania, nie podziałowi na równe dawki. Nie żuć ani nie kruszyć.',
        'Schemat oraz miareczkowanie ustala lekarz. Wynik nie ocenia tolerancji, tętna ani ciśnienia.',
      ],
    })),
  },
  {
    id: 'ramipril', name: 'Ramipryl', substance: 'Ramiprilum',
    category: 'bloodpressure', specialties: ['cardio'],
    searchTerms: ['ramipril krka', 'ramipryl', 'ramipril', 'ace', 'nadciśnienie', 'niewydolność serca'],
    forms: [5, 10].map(strength => tablet(`ramipril-krka-${strength}`, `Ramipril Krka · ${strength} mg`, strength, [30, 90], rpl(30040), {
      notes: [
        'Dawka i miareczkowanie zależą od wskazania i tolerancji. Sprawdź ciśnienie, potas, czynność nerek oraz jednocześnie stosowane leki.',
        'Dla wybranej postaci katalog nie potwierdza podziału na równe dawki; dostępne są wyłącznie całe tabletki.',
      ],
    })),
  },
  {
    id: 'torasemide', name: 'Torasemid', substance: 'Torasemidum',
    category: 'diuretic', specialties: ['cardio'],
    searchTerms: ['toramide', 'torasemid', 'torasemide', 'diuretyk', 'obrzęki', 'niewydolność serca'],
    forms: [2.5, 5, 10].map(strength => tablet(`toramide-${strength}`, `Toramide · ${String(strength).replace('.', ',')} mg`, strength, [30], rpl(14012), {
      notes: [
        'Schemat zależy od wskazania. Kontroluj bilans płynów, elektrolity i czynność nerek według sytuacji klinicznej.',
        'Samo nacięcie nie jest tu traktowane jako potwierdzenie równych części dawki. Kalkulator obsługuje całe tabletki wybranego produktu.',
      ],
    })),
  },
  {
    id: 'atorvastatin', name: 'Atorwastatyna', substance: 'Atorvastatinum',
    category: 'lipid', specialties: ['cardio'],
    searchTerms: ['atoris', 'atorwastatyna', 'atorvastatin', 'statyna', 'cholesterol', 'lipidy'],
    forms: [10, 20, 40].map(strength => tablet(`atoris-${strength}`, `Atoris · ${strength} mg`, strength, [30, 60, 90], rpl(11340), {
      notes: [
        'Dawkę ustala się indywidualnie. Przed ordynacją sprawdź wskazanie, interakcje, przeciwwskazania i wymagane monitorowanie zgodnie z ChPL.',
        'Wyliczenie liczby opakowań zakłada stałą, wprowadzoną przez lekarza dawkę przez cały wskazany okres.',
      ],
    })),
  },
];
