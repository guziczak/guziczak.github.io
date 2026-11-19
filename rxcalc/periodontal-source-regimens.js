/**
 * Professional periodontal instructions transcribed from the official RPL.
 * Retrieval date is not a document revision date or a clinical validation.
 * A procedure has no invented daily frequency, gel dose or cartridge yield.
 */
const CHECKED = '2026-11-19';
const LIGOSAN_SMPC = 'https://rejestry.ezdrowie.gov.pl/api/rpl/medicinal-products/32531/characteristic';
const LIGOSAN_LEAFLET = 'https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/32531/leaflet';
const LIGOSAN_PACKAGE = 'https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/32531/package';

export const PERIODONTAL_FORM_PATCHES = [
  { drugId: 'ligosan', formId: 'ligosan-periodontal-gel', changes: {
    referenceOnly: false,
    professionalUse: true,
    minAge: 18,
    sourceUrl: LIGOSAN_SMPC,
    sourceLabel: 'ChPL · oficjalny dokument RPL',
    sourceCheckedAt: CHECKED,
    // Section 10 in the retrieved RPL PDF has no printed revision date.
    sourceDocumentDate: null,
    marketStatusLabel: 'Polska dokumentacja RPL · dostępność w sprzedaży niezweryfikowana',
    amountText: 'Ilość zależna od wielkości, kształtu i głębokości kieszonki',
    notes: [
      'Wkład zawiera 260 mg żelu, czyli 36,4 mg doksycykliny. Te ilości nie oznaczają dawki na kieszonkę.',
      'Stosowanie wyłącznie przez stomatologa u dorosłych; wybierz wskazanie i sprawdź pełną ChPL.',
      'Wkład jest jednorazowy. Opakowania: 2, 4, 8, 10 lub 16 wkładów; nie wszystkie muszą być w sprzedaży.',
      'Po otwarciu torebki użyć natychmiast. Przechowywać w lodówce 2–8°C; przygotowanie aplikatora opisuje punkt 6.6 ChPL.',
    ],
  } },
];

export const PERIODONTAL_SOURCE_REGIMENS = [
  {
    id: 'ligosan-adult-periodontal-procedure',
    formIds: ['ligosan-periodontal-gel'],
    specialties: ['dental'],
    patientTypes: ['adult'],
    minAgeMonths: 216,
    professionalUse: true,
    label: 'Kieszonki przyzębne ≥5 mm · uzupełnienie leczenia niechirurgicznego',
    indication: 'Przewlekłe lub agresywne zapalenie przyzębia u dorosłych; kieszonki ≥5 mm',
    doseMode: 'instruction',
    instructionText: 'Stomatolog aplikuje żel przeznaczonym do tego urządzeniem do kieszonki przyzębnej, aż pojawi się nadmiar na brzegu dziąsła. Nadmiar usuwa wilgotnym wacikiem lub sączkiem. Ilość zależy od rozmiaru i kształtu kieszonki.',
    administration: 'Przez 7 dni po aplikacji nie czyścić mechanicznie leczonych zębów; dozwolone jest szczotkowanie powierzchni żujących i języka. Wkład do jednorazowego użytku.',
    screening: 'Sprawdź przeciwwskazania: uczulenie na składniki lub tetracykliny, niedawna albo trwająca antybiotykoterapia ogólnoustrojowa, ciąża, karmienie piersią, ryzyko ostrej porfirii, ostra niewydolność wątroby.',
    limitLabel: 'Instrukcja zabiegu: wypełnienie kieszonki. Brak ilości żelu na kieszonkę i dobowego progu porównania.',
    notes: [
      'Schemat uzupełnia konwencjonalne leczenie niechirurgiczne. Sam wybór schematu nie potwierdza wskazania.',
      'Siedem dni dotyczy higieny po aplikacji, a nie siedmiu dni podawania. Nie ustalono automatycznej liczby wizyt ani wkładów.',
    ],
    sourceUrl: LIGOSAN_SMPC,
    sourceLabel: 'ChPL · RPL, Ligosan',
    sourceSection: '4.1–4.4, 6.3–6.6',
    sourceCheckedAt: CHECKED,
    additionalSources: [
      { url: LIGOSAN_LEAFLET, label: 'RPL · ulotka: sposób stosowania i jednorazowy użytek' },
      { url: LIGOSAN_PACKAGE, label: 'RPL · oznakowanie i wielkości opakowań' },
    ],
    clinicalReviewStatus: 'not-clinically-validated',
  },
];
