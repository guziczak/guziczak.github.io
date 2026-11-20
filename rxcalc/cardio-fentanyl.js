/**
 * Fentanyl WZF: clinician-selected, single intravenous administration only.
 * Values are in micrograms and ml; do not route this formulation through the
 * generic mg/day or treatment-supply calculator. No dose is selected by default.
 *
 * The adult/spontaneous-breathing table in ChPL 4.2 is not a separate ACS
 * protocol. minMicrograms/referenceDoseMicrograms are source references:
 * individual reductions can be needed. maxMicrograms bounds this selected
 * source phase, not a universal safe maximum or a cumulative/daily limit.
 *
 * The RPL PDF read on CHECKED_AT had a blank section 10. The document date below
 * is explicitly attributed to the manufacturer's matching ChPL, section 10.
 */
const CHECKED_AT = '2026-11-20';
const FORM_ID = 'fentanyl-wzf-50';
const RPL_URL = 'https://rejestry.ezdrowie.gov.pl/api/rpl/medicinal-products/2404/characteristic';
const MANUFACTURER_URL = 'https://polpharma.pl/wp-content/uploads/2024/05/253770_.pdf';
const EMA_P2Y12_URL = 'https://www.ema.europa.eu/en/documents/product-information/brilique-epar-product-information_en.pdf';
const provenance = {
  sourceUrl: RPL_URL,
  sourceLabel: 'Polska ChPL Fentanyl WZF · RPL',
  sourceCheckedAt: CHECKED_AT,
  sourceDocumentDate: '2024-04-25',
  sourceDocumentDateUrl: MANUFACTURER_URL,
  sourceDocumentDateNote: 'Data z punktu 10 ChPL producenta. Punkt 10 odczytanego PDF RPL nie zawierał daty; porównano istotne dla tego widoku punkty dokumentów.',
  clinicalReviewStatus: 'not-clinically-validated',
};
const manufacturerSource = () => ({
  url: MANUFACTURER_URL,
  label: 'ChPL producenta · rewizja 25.04.2024 (punkt 10)',
  section: '2–3, 4.1–4.5, 6.5–6.6, 10',
  checkedAt: CHECKED_AT,
  documentDate: '2024-04-25',
});
const p2y12Source = () => ({
  url: EMA_P2Y12_URL,
  label: 'Odrębne źródło interakcji: ChPL Brilique · EMA (EN)',
  section: '4.5: Others — opioids and oral P2Y12 inhibitors',
  checkedAt: CHECKED_AT,
});
const requirement = (id, label, detail, sourceSection, scope = 'source') => ({
  id, label, detail, scope,
  sourceUrl: RPL_URL, sourceSection, sourceCheckedAt: CHECKED_AT,
});
const commonRequirements = () => [
  requirement('fentanyl-monitored-setting',
    'Zapewniono personel doświadczony w utrzymaniu oddychania, monitorowanie i możliwość resuscytacji.',
    'Podanie w oddziale wyposażonym do monitorowania i wspomagania oddychania; dostępne wyposażenie do resuscytacji oraz antagonista opioidowy.',
    '4.2: Sposób podawania; 4.4: Depresja oddechowa, Środki ostrożności'),
  requirement('fentanyl-spontaneous-breathing',
    'Wybrano pojedyncze podanie dorosłemu pacjentowi oddychającemu spontanicznie, poza schematem znieczulenia.',
    'Źródłem odniesienia jest ogólna tabela dorosłych ze spontanicznym oddechem. Ten widok nie stanowi osobnego protokołu ostrego zespołu wieńcowego ani znieczulenia.',
    '4.1; 4.2: Dorośli — tabela dawkowania', 'calculator-scope'),
  requirement('fentanyl-individual-assessment',
    'Lekarz ustalił dawkę po ocenie stanu pacjenta, przeciwwskazań i jednocześnie stosowanych leków.',
    'Uwzględniono wiek, osłabienie, oddychanie, krążenie, czynność nerek i wątroby oraz interakcje. W razie potrzeby dawka jest indywidualnie zmniejszana; kalkulator nie wyznacza redukcji.',
    '4.2: Dawkowanie, szczególne grupy pacjentów; 4.3–4.5'),
  requirement('fentanyl-undiluted-iv',
    'Wybrano drogę dożylną i nierozcieńczony roztwór Fentanyl WZF 50 mikrogramów/ml.',
    'Przelicznik obejmuje wyłącznie to stężenie i drogę. ChPL opisuje także rozcieńczanie i inne drogi podania; nie są one obliczane w tym widoku.',
    '2; 4.2: Sposób podawania; 6.6', 'calculator-scope'),
];
const monitoringText = 'Podanie przez personel doświadczony w utrzymaniu czynności oddechowej, w oddziale z monitorowaniem i możliwością wspomagania oddychania. Zapewnić sprzęt do resuscytacji i antagonistę opioidowego.';
const administration = 'Dożylnie, wolno. Objętość dotyczy nierozcieńczonego roztworu 50 mikrogramów/ml. Szybkość podania, potrzebę kolejnej dawki i odstęp ustala lekarz po ocenie pacjenta.';
const commonNotes = () => [
  'ChPL 4.1 obejmuje leczenie silnego bólu, w tym bólu towarzyszącego zawałowi mięśnia sercowego. Ogólna tabela dawkowania z punktu 4.2 nie jest osobnym protokołem OZW.',
  'ChPL dopuszcza dawki powyżej 200 mikrogramów wyłącznie w znieczuleniach. Ten widok nie oblicza znieczulenia, wlewu, PCA, innych dróg podania ani dawkowania pediatrycznego.',
  'Brak źródłowego odstępu powtarzania i maksimum dobowego dla wybranego wariantu. Obliczenie jednej dawki nie upoważnia do jej automatycznego powtarzania.',
  'U osób starszych lub osłabionych ChPL zaleca mniejszą dawkę początkową; przy niewydolności nerek należy rozważyć redukcję. Nie podano uniwersalnego liczbowego algorytmu.',
  'Oceń przeciwwskazania z ChPL 4.3, w tym depresję oddychania, choroby zaporowe płuc oraz IMAO obecnie lub w ciągu ostatnich 2 tygodni. Leki hamujące OUN, serotoninergiczne i inhibitory CYP3A4 wymagają osobnej oceny interakcji (4.4–4.5).',
  'Odrębne źródło, EMA Brilique 4.5: opioidy mogą opóźniać i zmniejszać ekspozycję na doustne inhibitory P2Y12; znaczenie kliniczne pozostaje niepewne. Uwzględnij tę interakcję przy OZW. To nie jest zapis ChPL Fentanyl WZF.',
];
const pack = (containersPerPack, containerMl) => ({
  id: `${containersPerPack}x${containerMl}ml`,
  label: `${containersPerPack} amp. × ${containerMl} ml`,
  quantity: containersPerPack * containerMl,
  containerMl,
  containersPerPack,
});

export const CARDIO_FENTANYL_DRUGS = [
  {
    id: 'fentanyl',
    name: 'Fentanyl WZF',
    substance: 'Fentanylum',
    substanceLabel: 'Fentanyl',
    category: 'cardio-analgesia',
    specialties: ['cardio'],
    searchTerms: ['fentanyl', 'fentanylum', 'opioid', 'silny ból', 'zawał', 'OZW', 'ampułka', 'dożylnie'],
    forms: [
      {
        ...provenance,
        id: FORM_ID,
        label: 'Fentanyl WZF · 50 mikrogramów/ml · roztwór do wstrzykiwań',
        form: 'injection',
        shortFormLabel: 'roztwór do wstrzykiwań',
        productKind: 'medicine',
        calculationMode: 'single-dose',
        doseUnit: 'microgram',
        unitLabel: 'ml',
        routeCode: 'iv',
        routeLabel: 'dożylnie',
        concentrationMicrogramsPerMl: 50,
        singleUseContainer: true,
        availabilityCategory: 'Lz',
        sourceSection: '2–3; 4.2; 6.5–6.6',
        packOptions: [pack(10, 2), pack(50, 2), pack(10, 10), pack(50, 10)],
        additionalSources: [
          manufacturerSource(),
          {
            url: 'https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/2404/package',
            label: 'Oznakowanie opakowań · RPL',
            section: '2, 4, 14',
            checkedAt: CHECKED_AT,
          },
        ],
        measurementNote: 'Wprowadź dawkę w mikrogramach. Wynik w ml dotyczy nierozcieńczonego roztworu 50 mikrogramów/ml; sprawdź możliwość dokładnego odmierzenia.',
        notes: [
          'Jedna ampułka 2 ml zawiera 100 mikrogramów; jedna ampułka 10 ml zawiera 500 mikrogramów. Karton zawiera 10 albo 50 ampułek.',
          'Ampułki są jednorazowe. Otworzyć bezpośrednio przed użyciem; niewykorzystanej zawartości nie zaliczać do zapasu na kolejne podanie.',
          'Wyłącznie lecznictwo zamknięte (Lz). Widok służy do pojedynczego podania IV wybranego przez lekarza, a nie do ustalania terapii domowej.',
          'Wynik obejmuje jedno podanie. Decyzje o kolejnym podaniu i jego dawce wymagają ponownej oceny pacjenta.',
        ],
      },
    ],
  },
];

const singleDoseSource = data => ({
  ...provenance,
  formIds: [FORM_ID],
  specialties: ['cardio'],
  patientTypes: ['adult'],
  minAgeMonths: 216,
  calculationMode: 'single-dose',
  doseUnit: 'microgram',
  routeCode: 'iv',
  routeLabel: 'dożylnie',
  sourceSection: '4.1; 4.2: Dorośli — spontaniczne oddychanie; 4.3–4.5',
  scopeNote: 'Zakres aplikacji: dorośli od 18 lat, pojedyncze podanie IV nierozcieńczonego roztworu, spontaniczne oddychanie. To nie jest osobny protokół OZW; próg 18 lat określa zakres tego widoku, nie całe wskazania ChPL.',
  administration,
  monitoringText,
  additionalSources: [manufacturerSource(), p2y12Source()],
  ...data,
});

export const FENTANYL_SINGLE_DOSE_SOURCES = [
  singleDoseSource({
    id: 'cardio-fentanyl-initial',
    label: 'Dawka początkowa · dorośli ze spontanicznym oddechem',
    indication: 'Silny ból; odniesienie do ogólnej tabeli dorosłych oddychających spontanicznie',
    phase: 'initial',
    phaseLabel: 'Dawka początkowa',
    minMicrograms: 50,
    maxMicrograms: 200,
    selectionRequirements: commonRequirements(),
    notes: [
      'ChPL 4.2: zwykle początkowo 50–200 mikrogramów u dorosłych oddychających spontanicznie. Dawka pozostaje niewybrana do czasu decyzji lekarza.',
      'Wartość poniżej dolnej granicy odniesienia wymaga indywidualnej oceny; zakres źródłowy nie jest automatyczną kwalifikacją ani gwarancją bezpieczeństwa.',
      ...commonNotes(),
    ],
  }),
  singleDoseSource({
    id: 'cardio-fentanyl-additional',
    label: 'Dawka dodatkowa · po ponownej ocenie pacjenta',
    indication: 'Silny ból; indywidualnie wybrana dodatkowa dawka przy spontanicznym oddychaniu',
    phase: 'additional',
    phaseLabel: 'Dawka dodatkowa',
    referenceDoseMicrograms: 50,
    maxMicrograms: 50,
    selectionRequirements: [
      ...commonRequirements(),
      requirement('fentanyl-additional-reassessment',
        'Po poprzednim podaniu lekarz ponownie ocenił pacjenta i zdecydował o dawce dodatkowej.',
        'Oceniono efekt przeciwbólowy, oddychanie, krążenie, wcześniejsze dawki i czas ich podania. ChPL podaje dodatkowo 50 mikrogramów, ale nie określa tu odstępu ani harmonogramu powtarzania.',
        '4.2: Dorośli — dawka dodatkowa, indywidualizacja; 4.4'),
    ],
    notes: [
      'ChPL 4.2: dawka dodatkowa w tabeli dorosłych ze spontanicznym oddechem wynosi 50 mikrogramów. To wartość odniesienia, nie domyślne zlecenie.',
      'Próg 50 mikrogramów ogranicza ten wybrany wariant dodatkowej dawki. Nie jest uniwersalnym maksimum pojedynczej dawki fentanylu ani limitem sumy dawek.',
      ...commonNotes(),
    ],
  }),
];
