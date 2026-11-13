/**
 * Dental mucosal products: source transcription, not clinical validation.
 * Checked 2026-11-13. Package metadata does not establish current pharmacy stock.
 * An instruction-only package has quantity: 1 (one labelled package), never a
 * fictitious mass/volume capacity. No FTU, drop-density or tube-yield assumptions.
 * Foreign and historical records are references without executable regimens.
 */
const CHECKED = '2026-11-13';
const rpl = id => `https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/${id}/characteristic`;
const SOURCE = Object.freeze({
  dentinox: rpl(1765),
  baikadent: rpl(10297),
  baikadentPack: 'https://herbapol.pl/produkty/baikadent/',
  tantumSpray: rpl(6561),
  tantumRinse: rpl(6560),
  eludril: 'https://www.pierrefabre-oralcare.com/pl-pl/p/eludril-care-przeciwplytkowy-plyn-do-plukania-jamy-ustnej-3577056021695-808759b4',
  eludrilUse: 'https://www.pierrefabre-oralcare.com/pl-pl/rutyna-przeciwprochnicowa',
  metronidazole: rpl(11440),
  ligosan: 'https://kulzer.pl/media/product-downloads/pl/ligosan/kulzer-ulotka-ligosan-pl.pdf',
  chlosite: 'https://www.ghimas.com/en/chlosite1',
  triamcinolone: 'https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=b353c8b1-9088-4969-8199-37876f2461cc',
  arestin: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8515df41-1936-4f3b-86ba-d2bb2a8441fb',
  atridox: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=2550dbc0-8bdd-4bca-81d5-eec77ee6fbd5',
  dentomycin: 'https://www.hpra.ie/find-a-medicine/for-human-use/withdrawn-medicines/details/25737',
  dentomycinSmPC: 'https://assets.hpra.ie/products/Human/25737/Licence_PA1321-001-001_04122018114740.pdf',
  actisite: 'https://www.accessdata.fda.gov/drugsatfda_docs/nda/2014/205931Orig1s000NameR.pdf',
});

const baseForm = {
  strengthMg: null, concentrationMg: null, concentrationMl: null,
  maxDailyMg: null, maxSingleMg: null, minAge: null, shelfLifeDays: null,
  defaultDose: null, defaultFrequency: null, defaultDays: null,
  defaultMode: 'units', allowedFractions: [1], unitOnly: true,
  sourceCheckedAt: CHECKED, clinicalReviewStatus: 'not-clinically-validated',
  notes: [], marketStatusLabel: 'Dokumentacja polska · dostępność w sprzedaży niezweryfikowana',
};
const pack = (id, label, options = {}) => ({ id, label, quantity: 1, ...options });
const instructionForm = (id, label, productKind, sourceUrl, packOptions, options = {}) => ({
  ...baseForm, id, label, form: 'gel', unitLabel: 'aplikacja', productKind,
  calculationMode: 'instruction', packOptions, sourceUrl,
  sourceLabel: productKind === 'medicine' ? 'ChPL · postać, skład i stosowanie' : 'Instrukcja producenta',
  routeLabel: 'miejscowo w jamie ustnej', ...options,
});
const rinseForm = (id, label, productKind, sourceUrl, size, options = {}) => ({
  ...baseForm, id, label, form: 'solution', unitLabel: 'ml', productKind,
  packOptions: [{ id: String(size), label: `${size} ml`, quantity: size }],
  sourceUrl, sourceLabel: 'Instrukcja producenta · stosowanie i opakowanie',
  routeLabel: 'do płukania jamy ustnej, następnie wypluć', ...options,
});
const drug = (id, name, substance, forms, searchTerms = [], options = {}) => ({
  id, name, substance, category: 'mucosa', specialties: ['dental'],
  searchTerms, forms, ...options,
});
const foreign = {
  referenceOnly: true,
  marketStatusLabel: 'Dokumentacja zagraniczna · status i dostępność w Polsce niepotwierdzone',
};

export const DENTAL_TOPICAL_DRUGS = [
  drug('dentinox-n', 'Dentinox N', 'Nalewka z rumianku + lidokainy chlorowodorek + lauromakrogol 400', [
    instructionForm('dentinox-n-gel', 'Dentinox N · 15% + 0,34% + 0,32%, żel', 'medicine', SOURCE.dentinox,
      [pack('10g', 'tuba 10 g')], {
        routeLabel: 'na dziąsła', minAge: 0.25, amountText: 'Niewielka ilość wielkości ziarnka grochu',
        notes: [
          'Wskazanie: objawy bolesnego wyrzynania zębów mlecznych. Nie jest uniwersalnym żelem na afty.',
          'Nie stosować poniżej 3 miesięcy ani poniżej 12 miesięcy przy równoczesnym leczeniu środkami wywołującymi methemoglobinemię.',
          'Aplikacja udostępnia schemat dopiero od 12 miesięcy; młodsze niemowlę wymaga odrębnej oceny klinicznej i sprawdzenia leków.',
          'Nie przeliczamy „ziarnka grochu” na gramy; sprawdzić nadwrażliwość na rumianek i amidowe środki znieczulające.',
        ],
      }),
  ], ['dentinox', 'lidokaina', 'rumianek', 'lauromakrogol', 'ząbkowanie']),

  drug('baikadent', 'Baikadent', 'Zespół flawonów korzenia tarczycy bajkalskiej', [
    instructionForm('baikadent-gel', 'Baikadent · 5,77 mg/g, żel', 'medicine', SOURCE.baikadent,
      [pack('15g', 'tuba 15 g', { sourceUrl: SOURCE.baikadentPack })], {
        minAge: 18, amountText: 'Pasek około 2 cm',
        notes: [
          'Moc 5,77 mg/g dotyczy zespołu flawonów, nie samej bajkaliny.',
          'ChPL nie zaleca stosowania poniżej 18 lat. Sprawdzić ograniczenia w ciąży i podczas karmienia.',
          'ChPL podaje średnią zawartość bajkaliny w dawce, lecz nie kalibrowaną masę wydawanego paska. Nie wyliczamy liczby tub.',
        ],
      }),
  ], ['baikadent', 'tarczyca bajkalska', 'bajkalina', 'scutellaria', 'żel', 'dziąsła']),

  drug('eludril-care', 'Eludril Care', 'Diglukonian chlorheksydyny 0,05% + chlorek cetylopirydyniowy 0,05%', [
    rinseForm('eludril-care-rinse', 'Eludril Care · CHX 0,05% + CPC 0,05%, płyn', 'cosmetic', SOURCE.eludril, 500, {
      minAge: 6,
      notes: [
        'Kosmetyk do higieny jamy ustnej; nie utożsamiać z Eludril Classic lub Extra.',
        'Przeznaczony od 6 lat, dla osób umiejących płukać i wypluwać; płynu nie połykać.',
        'Wielkość butelki i skład z polskiej karty producenta; instrukcja ilościowa z jego strony o codziennej higienie.',
      ],
    }),
  ], ['chlorheksydyna', 'chloroheksydyna', 'chlorhexidine', 'chx', 'cetylopirydyna', 'cetylopirydyniowy', 'cpc', 'eludril', 'płukanka']),

  drug('metronidazole-dental', 'Metronidazol Chema', 'Metronidazol', [
    instructionForm('metronidazol-chema-ointment', 'Metronidazol Chema · 100 mg/g, maść', 'medicine', SOURCE.metronidazole,
      [pack('5g', 'tuba z kaniulą 5 g')], {
        professionalUse: true, routeLabel: 'na dziąsła i zęby; aplikacja zależna od zabiegu',
        notes: [
          'Schemat zależy od rozpoznania i procedury. Brak źródłowej ilości gramów na kieszonkę lub kanał.',
          'W chorobach przyzębia przeciwwskazany w ciąży, podczas karmienia i w kacheksji; sprawdzić pełną ChPL.',
          'ChPL zaleca krótki okres leczenia, 7–10 dni, z powodu narastania oporności. Przechowywać w 2–8°C.',
        ],
      }),
  ], ['metronidazol', 'metronidazole', 'chema', 'maść', 'kieszonki', 'przyzębie', 'ropień', 'endodoncja']),

  drug('ligosan', 'Ligosan', 'Doksycyklina', [
    instructionForm('ligosan-periodontal-gel', 'Ligosan · 140 mg/g, żel okołozębowy', 'medicine', SOURCE.ligosan,
      [2, 4, 8, 10, 16].map(count => pack(`${count}x260mg`, `${count} wkładów × 260 mg żelu`)), {
        referenceOnly: true, professionalUse: true, minAge: 18, sourceDocumentDate: '2017-09-18',
        sourceLabel: 'Polska ChPL w materiale producenta · wersja 2017-09-18',
        marketStatusLabel: 'Polska dokumentacja producenta z 2017 r. · aktualność i dostępność do potwierdzenia',
        routeLabel: 'profesjonalnie do kieszonek przyzębnych',
        notes: [
          'Wkład zawiera 260 mg żelu, czyli 36,4 mg doksycykliny — 260 mg nie jest dawką antybiotyku.',
          'Ilość zależy od kształtu i głębokości kieszonek; ChPL opisuje leczenie uzupełniające u dorosłych przy kieszonkach ≥5 mm.',
          'Wkład jednorazowy. Nie wszystkie zarejestrowane wielkości opakowań muszą być w obrocie.',
          'Karta referencyjna: przed zastosowaniem potwierdzić aktualną ChPL, przeciwwskazania i procedurę aplikacji.',
        ],
      }),
  ], ['ligosan', 'doksycyklina', 'doxycycline', 'żel', 'kieszonki', 'przyzębie']),

  drug('chlosite', 'Chlo-Site', 'Żel ksantanowy z diglukonianem i dichlorowodorkiem chlorheksydyny', [
    ...[
      ['chlosite-025', 'Chlo-Site · żel, strzykawki 0,25 ml', '6x025ml', '6 strzykawek × 0,25 ml'],
      ['chlosite-1', 'Chlo-Site · żel, strzykawka 1 ml', '1x1ml', '1 strzykawka × 1 ml'],
    ].map(([id, label, packageId, packageLabel]) => instructionForm(id, label, 'device', SOURCE.chlosite,
      [pack(packageId, packageLabel)], {
        referenceOnly: true, professionalUse: true,
        sourceLabel: 'Ghimas · karta producenta',
        marketStatusLabel: 'Karta producenta zagranicznego · polska instrukcja i dostępność do potwierdzenia',
        routeLabel: 'profesjonalnie do kieszonek przyzębnych',
        notes: [
          'Wyrób medyczny do zastosowania zabiegowego, nie antybiotyk dobowy.',
          'Rozmiary opakowań z aktualnej karty producenta. Nie przeliczamy orientacyjnej liczby kieszonek na dokładne zużycie.',
          'Brak zweryfikowanej polskiej instrukcji w tym module; przed zabiegiem sprawdzić instrukcję konkretnego wariantu.',
        ],
      })),
  ], ['chlosite', 'chlo-site', 'chlorheksydyna', 'ksantan', 'kieszonki', 'przyzębie']),

  drug('triamcinolone-dental-reference', 'Triamcynolon · pasta stomatologiczna', 'Triamcynolonu acetonid', [
    instructionForm('triamcinolone-dental-paste-us', 'Triamcinolone Acetonide Dental Paste · 0,1%', 'medicine', SOURCE.triamcinolone,
      [pack('5g', 'tuba 5 g · dokumentacja USA'), pack('75g', 'tuba 7,5 g · dokumentacja USA')], {
        ...foreign, sourceDocumentDate: '2025-09', sourceLabel: 'DailyMed · amerykańska dokumentacja produktu Sun Pharma',
        routeLabel: 'na zmiany w jamie ustnej',
        notes: [
          'Karta zagranicznej pasty adhezyjnej: 0,1% = 1 mg/g. Nie oznacza potwierdzenia rejestracji lub sprzedaży w Polsce.',
          'Nie zastępować pasty stomatologicznej zwykłą maścią steroidową do stosowania na skórę.',
          'Bez automatycznego dawkowania; należy zweryfikować konkretny produkt i przeciwwskazania, w tym zakażenia jamy ustnej.',
        ],
      }),
  ], ['triamcynolon', 'triamcinolone', 'tramcynolon', 'steroid', 'pasta', 'adhezyjna', 'oral paste']),

  drug('arestin-reference', 'Arestin', 'Minocyklina', [
    instructionForm('arestin-microspheres-us', 'Arestin · 1 mg, mikrosfery', 'medicine', SOURCE.arestin,
      [pack('1', '1 wkład jednodawkowy · USA'), pack('24', '24 wkłady (2 saszetki × 12) · USA')], {
        ...foreign, professionalUse: true, sourceDocumentDate: '2024-05', sourceLabel: 'DailyMed · dokumentacja USA',
        routeLabel: 'profesjonalnie poddziąsłowo',
        notes: ['1 mg oznacza minocyklinę w jednym wkładzie. Dobór ilości zależy od leczonych kieszonek; brak automatycznego schematu dla polskiego rynku.'],
      }),
  ], ['arestin', 'minocyklina', 'minocycline', 'mikrosfery', 'kieszonki']),

  drug('atridox-reference', 'Atridox', 'Hyklan doksycykliny', [
    instructionForm('atridox-system-us', 'Atridox · hyklan doksycykliny 10%, system do mieszania', 'medicine', SOURCE.atridox,
      [pack('2kits', '2 zestawy · próbka profesjonalna USA'), pack('6kits', '6 zestawów · dokumentacja USA')], {
        ...foreign, professionalUse: true, sourceDocumentDate: '2016-10', sourceLabel: 'DailyMed · archiwalny rekord USA',
        marketStatusLabel: 'USA: rekord opakowań zakończony 2021-12-31 · status w Polsce niepotwierdzony',
        routeLabel: 'profesjonalnie poddziąsłowo po przygotowaniu',
        notes: [
          'Zestaw: strzykawka 450 mg nośnika i 50 mg hyklanu doksycykliny; po zmieszaniu 500 mg formulacji, 10% hyklanu.',
          'Nie utożsamiać 10% hyklanu z 10% doksycykliny. Ta etykieta opisuje 42,5 mg doksycykliny w 50 mg hyklanu.',
          'Data zakończenia obrotu dotyczy wskazanego rekordu USA i nie przesądza o statusie na innych rynkach.',
        ],
      }),
  ], ['atridox', 'doksycyklina', 'doxycycline', 'hyklan', 'kieszonki']),

  drug('dentomycin-reference', 'Dentomycin', 'Minocyklina', [
    instructionForm('dentomycin-gel-ie', 'Dentomycin · 2% m/m, żel okołozębowy', 'medicine', SOURCE.dentomycin,
      [pack('5x05g', '5 aplikatorów × 0,5 g · dokumentacja irlandzka', { sourceUrl: SOURCE.dentomycinSmPC })], {
        ...foreign, professionalUse: true, sourceLabel: 'HPRA · status rejestracyjny w Irlandii',
        marketStatusLabel: 'Irlandia: pozwolenie wycofane 2022-12-07 · status w Polsce niepotwierdzony',
        routeLabel: 'profesjonalnie do kieszonek przyzębnych',
        notes: ['HPRA oznacza ten irlandzki produkt jako niebędący w obrocie. Informacja nie jest oceną dostępności we wszystkich krajach. Opakowanie z archiwalnej ChPL 2018.'],
      }),
  ], ['dentomycin', 'minocyklina', 'minocycline', 'przyzębie', 'kieszonki']),

  drug('actisite-reference', 'Actisite', 'Tetracyklina', [
    instructionForm('actisite-fibre-reference', 'Actisite · 12,7 mg, włókno okołozębowe', 'medicine', SOURCE.actisite,
      [pack('unverified', 'Opakowanie handlowe niepotwierdzone', { packageUnverified: true })], {
        ...foreign, professionalUse: true, sourceLabel: 'FDA · historyczny dokument przeglądu nazw, 2014',
        marketStatusLabel: 'Produkt historyczny USA · brak potwierdzonego aktualnego opakowania i statusu w Polsce',
        routeLabel: 'profesjonalnie okołozębowo',
        notes: ['Historyczny dokument FDA wymienia włókno z tetracykliną 12,7 mg jako produkt już nieobecny na rynku. Nie jest aktualną ChPL ani instrukcją terapii.'],
      }),
  ], ['actisite', 'tetracyklina', 'tetracycline', 'włókno', 'przyzębie']),
];

export const DENTAL_TOPICAL_FORM_PATCHES = [
  { drugId: 'benzydamine', formId: 'tantum-verde-spray', changes: {
    productKind: 'medicine', sourceCheckedAt: CHECKED,
    marketStatusLabel: 'Polska ChPL · dostępność w sprzedaży niezweryfikowana',
  } },
  { drugId: 'benzydamine', formId: 'tantum-verde-rinse', changes: {
    productKind: 'medicine', sourceCheckedAt: CHECKED,
    marketStatusLabel: 'Polska ChPL · dostępność w sprzedaży niezweryfikowana',
  } },
];

const source = (sourceUrl, sourceLabel = 'ChPL', sourceSection = '4.1–4.4') => ({
  sourceUrl, sourceLabel, sourceSection, sourceCheckedAt: CHECKED,
});
const scheme = (id, formIds, label, options) => ({
  id, formIds, label, specialties: ['dental'],
  clinicalReviewStatus: 'not-clinically-validated', ...options,
});
const instruction = (id, formId, label, options) => scheme(id, [formId], label, {
  doseMode: 'instruction', ...options,
});

export const DENTAL_TOPICAL_REGIMENS = [
  instruction('dentinox-teething', 'dentinox-n-gel', 'Objawy ząbkowania · od 12 miesięcy w aplikacji', {
    patientTypes: ['child'], minAgeMonths: 12, maxAgeMonths: 216, maxAgeExclusive: true,
    indication: 'Bolesne wyrzynanie zębów mlecznych', frequencyOptions: [2, 3], reviewAfterDays: 7, asNeeded: true,
    instructionText: 'Niewielką ilość wielkości ziarnka grochu nanieść na dziąsło czystym palcem lub bawełnianym patyczkiem, lekko wmasować.',
    administration: 'Stosować krótkotrwale przy ostrych objawach, zwłaszcza po jedzeniu i po higienie jamy ustnej przed snem.',
    notes: ['Źródłowy dolny próg to 3 miesiące, lecz dla 3–11 miesięcy potrzebna jest dodatkowa kontrola równoczesnych leków; tej grupy nie obejmuje ten schemat.'],
    limitLabel: 'ChPL: 2–3 aplikacje/dobę; brak źródłowej dawki w gramach lub mg/dobę. Brak poprawy po 7 dniach wymaga konsultacji.',
    ...source(SOURCE.dentinox),
  }),
  instruction('baikadent-chronic-mucosa', 'baikadent-gel', 'Przewlekły stan zapalny błony śluzowej · dorośli', {
    patientTypes: ['adult'], minAgeMonths: 216, indication: 'Przewlekłe stany zapalne błony śluzowej jamy ustnej',
    frequencyOptions: [2, 3, 4], fixedDays: 14, reviewAfterDays: 14,
    instructionText: 'Po szczotkowaniu zębów wcierać w zmienione miejsce pasek żelu około 2 cm.',
    administration: 'Nie spożywać posiłków przez co najmniej 30 minut po aplikacji.',
    limitLabel: 'ChPL: 2–4 aplikacje/dobę przez 2 tygodnie dla tego wskazania; brak uniwersalnego maksimum mg/dobę.',
    ...source(SOURCE.baikadent),
  }),
  scheme('eludril-care-adult', ['eludril-care-rinse'], 'Higiena jamy ustnej · powyżej 12 lat', {
    minAgeMonths: 144, minAgeExclusive: true, indication: 'Uzupełnienie codziennej higieny jamy ustnej',
    doseMode: 'units', dose: 15, frequency: 2, requiresDuration: true,
    administration: 'Rano i wieczorem po szczotkowaniu płukać przez 30 sekund bez rozcieńczania, następnie wypluć. Nie przepłukiwać wodą.',
    screening: 'Potwierdź umiejętność płukania i wypluwania; nie połykać.',
    limitLabel: 'Instrukcja higieniczna: 15 ml, 2 razy/dobę. To kosmetyk; nie jest to limit dawki leczniczej w mg/kg.',
    ...source(SOURCE.eludrilUse, 'Pierre Fabre · polska instrukcja stosowania Eludril Care', 'Kiedy i jak stosować płyn'),
  }),
  scheme('eludril-care-child', ['eludril-care-rinse'], 'Higiena jamy ustnej · dzieci 6–12 lat', {
    patientTypes: ['child'], minAgeMonths: 72, maxAgeMonths: 144,
    indication: 'Uzupełnienie codziennej higieny jamy ustnej', doseMode: 'units', dose: 10, frequency: 2, requiresDuration: true,
    administration: 'Rano i wieczorem po szczotkowaniu płukać przez 30 sekund bez rozcieńczania i wypluć. Nie przepłukiwać wodą.',
    screening: 'Dziecko musi umieć prawidłowo płukać i wypluwać; nie połykać.',
    limitLabel: 'Instrukcja higieniczna dla 6–12 lat: 10 ml, 2 razy/dobę. Brak maksymalnej dawki leczniczej w mg/kg.',
    ...source(SOURCE.eludrilUse, 'Pierre Fabre · polska instrukcja stosowania Eludril Care', 'Kiedy i jak stosować płyn'),
  }),
  scheme('tantum-spray-over12', ['tantum-verde-spray'], 'Aerozol · dorośli i młodzież powyżej 12 lat', {
    minAgeMonths: 144, minAgeExclusive: true,
    indication: 'Objawy stanu zapalnego jamy ustnej i gardła', doseMode: 'units', doseRange: { min: 4, max: 8 },
    frequencyOptions: [2, 3, 4, 5, 6], maxUnitsPerDose: 8, maxDailyUnits: 48, maxDays: 7, reviewAfterDays: 7,
    administration: 'Rozpylać na błonę śluzową jamy ustnej i gardła.',
    limitLabel: 'Granice tego schematu ChPL: do 8 rozpyleń na podanie i do 6 podań/dobę; przedłużenie ponad 7 dni wymaga decyzji lekarza.',
    ...source(SOURCE.tantumSpray),
  }),
  scheme('tantum-spray-6to12', ['tantum-verde-spray'], 'Aerozol · dzieci 6–12 lat', {
    patientTypes: ['child'], minAgeMonths: 72, maxAgeMonths: 144,
    indication: 'Objawy stanu zapalnego jamy ustnej i gardła', doseMode: 'units', dose: 4,
    frequencyOptions: [2, 3, 4, 5, 6], maxUnitsPerDose: 4, maxDailyUnits: 24, maxDays: 7, reviewAfterDays: 7,
    administration: 'Rozpylać na błonę śluzową jamy ustnej i gardła.',
    limitLabel: 'ChPL dla 6–12 lat: 4 rozpylenia na podanie, 2–6 podań/dobę. Przedłużenie ponad 7 dni wymaga decyzji lekarza.',
    ...source(SOURCE.tantumSpray),
  }),
  instruction('tantum-spray-under6', 'tantum-verde-spray', 'Aerozol · dzieci poniżej 6 lat, instrukcja wg masy', {
    patientTypes: ['child'], maxAgeMonths: 72, maxAgeExclusive: true,
    indication: 'Objawy stanu zapalnego jamy ustnej i gardła', frequencyOptions: [2, 3, 4, 5, 6], maxDays: 7, reviewAfterDays: 7,
    instructionText: 'ChPL: 1 rozpylenie na 4 kg masy ciała, najwyżej 4 rozpylenia jednorazowo. Lekarz potwierdza całkowitą liczbę rozpyleń dla masy pacjenta.',
    administration: 'Stosować miejscowo na błonę śluzową jamy ustnej i gardła.',
    notes: ['Źródło nie podaje reguły zaokrąglania ułamka rozpylenia; aplikacja nie tworzy takiej reguły.'],
    limitLabel: 'Maks. 4 rozpylenia jednorazowo, do 6 podań/dobę; nie jest to doustna dawka mg/kg.',
    ...source(SOURCE.tantumSpray),
  }),
  scheme('tantum-rinse-use', ['tantum-verde-rinse'], 'Roztwór · płukanie jamy ustnej i gardła', {
    indication: 'Objawy stanu zapalnego jamy ustnej i gardła', doseMode: 'units', dose: 15,
    frequencyOptions: [2, 3], maxUnitsPerDose: 15, maxDailyUnits: 45, maxDays: 7, reviewAfterDays: 7,
    administration: 'Płukać przez 20–30 sekund; można użyć nierozcieńczonego produktu lub niewielkiej ilości wody. Wypluć.',
    screening: 'Nie stosować u osób, które nie umieją prawidłowo płukać i wypluwać; nie połykać.',
    limitLabel: 'ChPL: około 15 ml na płukanie, 2–3 razy/dobę. To ilość do płukania, nie do połknięcia.',
    ...source(SOURCE.tantumRinse),
  }),
  instruction('metronidazole-periodontal', 'metronidazol-chema-ointment', 'Zaawansowane zapalenie przyzębia · uzupełnienie skalingu', {
    patientTypes: ['adult'], minAgeMonths: 216, professionalUse: true,
    indication: 'Zaawansowane zapalenie przyzębia niepoddające się rutynowemu leczeniu', frequency: 2, minDays: 7, maxDays: 10,
    instructionText: 'Delikatnie smarować dziąsła maścią jako uzupełnienie leczenia podstawowego (skalingu).',
    administration: 'Ilość i obszar aplikacji określa stomatolog. Ten schemat nie opisuje wypełniania ropnia ani kanału.',
    limitLabel: 'ChPL: 2 aplikacje/dobę, krótki okres 7–10 dni. Nie określa gramów na podanie ani maksimum mg/dobę.',
    ...source(SOURCE.metronidazole),
  }),
  instruction('metronidazole-abscess', 'metronidazol-chema-ointment', 'Ropień przyzębny · aplikacja po odbarczeniu', {
    patientTypes: ['adult'], minAgeMonths: 216, professionalUse: true, indication: 'Ropień przyzębny',
    instructionText: 'Po odbarczeniu ropnia stomatolog wprowadza maść do patologicznej kieszonki i wdraża leczenie przyczynowe.',
    administration: 'Procedura gabinetowa; liczba kieszonek nie określa automatycznie dawki ani liczby tub.',
    limitLabel: 'Źródło nie podaje stałej ilości na kieszonkę ani częstotliwości dobowej tej procedury.',
    ...source(SOURCE.metronidazole),
  }),
  instruction('metronidazole-endo', 'metronidazol-chema-ointment', 'Zgorzel miazgi · wkładka czasowa między wizytami', {
    patientTypes: ['adult'], minAgeMonths: 216, professionalUse: true, indication: 'Endodontyczne leczenie zgorzeli miazgi',
    instructionText: 'Stomatolog wprowadza maść igłą Lentulo do oczyszczonego, osuszonego kanału. W ostrym stanie opatrunek zmienia codziennie; w przewlekłym pozostawia 2–3 dni, nie dłużej niż 5–7 dni.',
    administration: 'Plan wizyt i długość pozostawienia wkładki wymagają decyzji stomatologa; nie są dobowym schematem samodzielnego podania.',
    limitLabel: 'Brak źródłowej masy dawki na kanał; nie wyliczamy mg/kg/dobę ani dokładnego zużycia tuby.',
    ...source(SOURCE.metronidazole),
  }),
  instruction('metronidazole-ulcerative-gingivitis', 'metronidazol-chema-ointment', 'Wrzodziejące zapalenie dziąseł', {
    patientTypes: ['adult'], minAgeMonths: 216, professionalUse: true,
    indication: 'Wrzodziejące zapalenie dziąseł', frequencyOptions: [2, 3], reviewAfterDays: 3, minDays: 7, maxDays: 10,
    instructionText: 'Delikatnie smarować dziąsła maścią; po 3–5 dniach przeprowadzić sanację jamy ustnej.',
    administration: 'Połączone z zaplanowanym leczeniem stomatologicznym. ChPL zaleca krótki łączny okres stosowania, 7–10 dni.',
    limitLabel: 'ChPL: 2–3 aplikacje/dobę. Nie określa gramów na podanie ani maksimum mg/dobę.',
    ...source(SOURCE.metronidazole),
  }),
];
