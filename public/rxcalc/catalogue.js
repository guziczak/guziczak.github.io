/**
 * RxCalc product metadata, version 2026.11.14.
 * Sources are linked on every formulation. This is a limited calculation
 * catalogue, not a clinical guideline, reimbursement database or complete ChPL.
 * No regimen is inferred from a diagnosis. Prescriber enters and confirms it.
 */

import { EQUINE_NSAID_DRUGS } from './equine-nsaids.js';
import { EQUINE_ANTIPARASITIC_DRUGS } from './equine-antiparasitics.js';
import { DENTAL_SYSTEMIC_FORM_ADDITIONS, DENTAL_SYSTEMIC_FORM_PATCHES, DENTAL_SYSTEMIC_DRUG_ADDITIONS } from './dental-systemic.js';
import { DENTAL_TOPICAL_DRUGS, DENTAL_TOPICAL_FORM_PATCHES } from './dental-topicals.js';

export const CATALOGUE_META = Object.freeze({
  version: '2026.11.14.dental.3',
  updatedAt: '2026-11-14',
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
  veterinary: [
    { id: 'pain', label: 'Przeciwbólowe' },
    { id: 'antiparasitic', label: 'Przeciwpasożytnicze' },
    { id: 'gastric', label: 'Żołądek' },
    { id: 'respiratory', label: 'Oddechowe' },
    { id: 'vet-cardio', label: 'Serce' },
    { id: 'antiemetic', label: 'Przeciwwymiotne' },
    { id: 'antibiotics', label: 'Antybiotyki' },
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

// Species belong to the exact formulation, never to the substance alone.
// Product metadata never silently selects a regimen; explicit source records live in regimens.js.
const upd = id => `https://medicines.health.europa.eu/veterinary/en/${id}`;
const vet = (targetSpecies, options = {}) => ({ targetSpecies, routeCode: 'oral', defaultMode: 'perKgDose', ...options });
const horse = (options = {}) => vet(['horse'], { sourceCheckedAt: '2026-11-13', ...options });
const oralMass = (id, label, form, strengthMg, packOptions, sourceUrl, options = {}) => ({
  ...baseForm, id, label, form, unitLabel: 'g', strengthMg,
  packOptions, sourceUrl, sourceLabel: 'Polska ChPL · RPL',
  routeLabel: 'doustnie', notes: [], ...horse(options),
});
const VETERINARY_DRUGS = [
  {
    id: 'vet-metacam', name: 'Metacam', substance: 'Meloxicamum', substanceLabel: 'Meloksykam',
    category: 'pain', specialties: ['veterinary'],
    searchTerms: ['meloksykam', 'meloxicam', 'nlpz', 'ból', 'zawiesina'],
    forms: [
      liquid('metacam-dog-1-5', 'Metacam · 1,5 mg/ml · pies', 'suspension', 1.5, 1, [10, 32, 100, 180], 'https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2177020.PDF', vet(['dog'], {
        sourceLabel: 'SPC · VMD (EN)', registrationUrl: upd('600000001530'), doseBasisIngredient: 'meloksykamu',
        unmodelledShelfLifeMonths: 6,
        notes: [
          'Zawiesina doustna dla psów. Wstrząsnąć przed użyciem. Objętość w ml; podziałka strzykawki w kg nie jest podziałką w ml.',
          'Dawkowanie zależy od etapu leczenia. Każdy etap z inną dawką przelicz osobno.',
          'Po otwarciu: 6 miesięcy. Kalkulator nie wyznacza daty ważności według kalendarza; przy długiej terapii sprawdź zapotrzebowanie z datą otwarcia.',
          'Metadane UE: UPD. Szczegółowa dokumentacja: brytyjski urząd VMD, w języku angielskim. Potwierdź aktualne warunki stosowania w Polsce.',
        ],
      })),
      liquid('metacam-cat-0-5', 'Metacam · 0,5 mg/ml · kot', 'suspension', 0.5, 1, [3], 'https://www.vmd.defra.gov.uk/productinformationdatabase/files/QRD_Documents/QRD-Auth_2177231.PDF', vet(['cat'], {
        sourceLabel: 'Dokumentacja produktu · VMD (EN)', registrationUrl: upd('600000001701'), doseBasisIngredient: 'meloksykamu', shelfLifeDays: 14,
        notes: [
          'Zawiesina doustna. Wstrząsnąć przed użyciem. Dawka i etap leczenia wymagają decyzji lekarza weterynarii.',
          'W katalogu ujęto butelkę 3 ml: trwałość po otwarciu 14 dni, uwzględniona w opakowaniach. Większe butelki mają inną trwałość i nie są tu modelowane.',
          'Produkt obejmuje także świnki morskie; nie oznacza to przypisania go chomikom ani szczurom.',
          'Metadane UE: UPD. Szczegóły produktu: VMD (EN). Sprawdź aktualne warunki stosowania w Polsce.',
        ],
      })),
      liquid('metacam-horse-15', 'Metacam · 15 mg/ml · koń', 'suspension', 15, 1, [100, 250], 'https://vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2177034.PDF', vet(['horse'], {
        sourceLabel: 'SPC · VMD (EN)', registrationUrl: upd('600000001534'), doseBasisIngredient: 'meloksykamu',
        unmodelledShelfLifeMonths: 6,
        notes: [
          'Zawiesina doustna dla koni. Wstrząsnąć przed użyciem. Podziałka strzykawki w kg nie jest podziałką w ml.',
          'Po otwarciu: 6 miesięcy. Przy długiej terapii sprawdź opakowania z uwzględnieniem daty otwarcia; kalkulator nie modeluje kalendarzowej trwałości.',
          'Schemat, przeciwwskazania i karencję ocenia lekarz weterynarii; zapis kalkulatora nie jest pełną receptą weterynaryjną.',
          'Metadane UE: UPD. Szczegółowa dokumentacja: VMD (EN). Potwierdź aktualne warunki stosowania w Polsce.',
        ],
      })),
    ],
  },
  {
    id: 'vet-panacur', name: 'Panacur', substance: 'Fenbendazolum', substanceLabel: 'Fenbendazol',
    category: 'antiparasitic', specialties: ['veterinary'],
    searchTerms: ['fenbendazol', 'pasożyty', 'nicienie', 'słupkowce', 'owsiki', 'glisty', 'parascaris'],
    forms: [
      oralMass('panacur-horse-paste-187-5', 'Panacur Pasta · 187,5 mg/g · koń', 'oralPaste', 187.5,
        [{ id: '24', label: '1 strzykawka doustna × 24 g', quantity: 24 }], rpl(18365), {
          doseBasisIngredient: 'fenbendazolu',
          measurementNote: 'Wynik podajemy w gramach pasty. Przed podaniem sprawdź nastawę pierścienia dozującego i dokładność odmierzenia. ChPL nie podaje liczbowego kroku podziałki; aplikacja nie wyznacza kliknięć.',
          notes: ['Dwa odrębne schematy jednorazowe: wybrane nicienie z ChPL oraz Parascaris equorum. Nie przenosić do pasty schematu zawiesiny dla innych stadiów pasożyta.', 'Opakowanie zawiera jedną strzykawkę 24 g. Nie dodano schematu dla Strongyloides westeri u źrebiąt ssących.', 'Karencja tkanek jadalnych według źródła: konie 20 dni, źrebięta ssące 60 dni. Potwierdź właściwy okres i status zwierzęcia.'],
        }),
      liquid('panacur-horse-susp-100', 'Panacur · 100 mg/ml · zawiesina (IE)', 'suspension', 100, 1, [250, 1000, 2500], 'https://assets.hpra.ie/products/Animal/2272/VPA10996_111_001_CRN00FDZT_04_10_2024_Nationalspc_14102024155757.pdf', horse({
        sourceLabel: 'SPC HPRA · EN, Irlandia (10/2024)', registrationUrl: upd('600000064144'), doseBasisIngredient: 'fenbendazolu',
        notes: ['Gotowa zawiesina: wstrząsnąć, nie rozcieńczać. Dokładnie określ masę i sprawdź urządzenie dozujące.', 'Dostępny schemat pięciodniowy dotyczy określonych stadiów larwalnych słupkowców; nie jest uniwersalnym schematem dla każdej inwazji.', 'Źródło dotyczy produktu zarejestrowanego w Irlandii. Nie potwierdzamy jego dostępności ani warunków stosowania w Polsce.', 'Karencja według tego źródła: tkanki jadalne konia 14 dni. Nie stosować u klaczy produkujących mleko dla ludzi.'],
      })),
    ],
  },
  {
    id: 'vet-gastazole', name: 'Gastazole', substance: 'Omeprazolum', substanceLabel: 'Omeprazol',
    category: 'gastric', specialties: ['veterinary'], searchTerms: ['omeprazol', 'wrzody', 'żołądek', 'nawroty'],
    forms: [oralMass('gastazole-horse-paste-370', 'Gastazole · 370 mg/g · koń', 'oralPaste', 370,
      [{ id: '7.57', label: '1 strzykawka doustna × 7,57 g', quantity: 7.57 }], 'https://rejestry.ezdrowie.gov.pl/api/rpl/medicinal-products/46637/characteristic', {
        doseBasisIngredient: 'omeprazolu', shelfLifeDays: 28, registrationUrl: upd('600000047142'),
        doseStepUnits: 400 / 370, doseStepLabel: 'jedna działka = 100 kg na podziałce dla dawki 4 mg/kg',
        packageCalculationNote: 'Zapas zakłada wykorzystanie pozostałych pełnych działek; pojedyncza dawka może wymagać dwóch kolejnych strzykawek. Każda otwarta strzykawka ma trwałość 28 dni.',
        measurementNote: 'Podziałka strzykawki: co 100 kg przy dawce 4 mg/kg. W fazie 1 mg/kg nastawa odpowiada ¼ masy konia. Niewykonalne ustawienie blokuje kopiowanie; aplikacja nie zaokrągla dawki do kreski.',
        notes: ['Modelowane opakowanie: jedna strzykawka 7,57 g, z trwałością 28 dni po otwarciu. Kartony z wieloma strzykawkami nie są tu modelowane.', 'Przeliczenie pokazuje gramy pasty i liczbę działek; kilogramy na podziałce nie są gramami preparatu. Pełna strzykawka odpowiada siedmiu działkom.', 'Leczenie i następujące po nim ograniczanie nawrotów to osobne etapy. Każdy wymaga osobnego wyliczenia zapasu.', 'Karencja według ChPL: tkanki jadalne 1 dzień; nie stosować u zwierząt produkujących mleko dla ludzi.'],
      })],
  },
  {
    id: 'vet-ventipulmin', name: 'Ventipulmin granulat', substance: 'Clenbuteroli hydrochloridum', substanceLabel: 'Chlorowodorek klenbuterolu',
    category: 'respiratory', specialties: ['veterinary'], searchTerms: ['klenbuterol', 'oskrzela', 'oddechowe', 'rao', 'kaszel', 'duszność'],
    forms: [oralMass('ventipulmin-horse-granules', 'Ventipulmin · 0,016 mg/g · granulat', 'oralPowder', 0.016,
      [{ id: '500', label: '1 pojemnik × 500 g', quantity: 500 }], rpl(16870), {
        doseBasisIngredient: 'chlorowodorku klenbuterolu', shelfLifeDays: 21,
        routeLabel: 'doustnie po wymieszaniu z karmą',
        measurementNote: 'Miarka z opakowania mieści 10 g granulatu. Wynik wyrażamy w gramach; potwierdź dokładność odmierzenia wymaganej części miarki.',
        notes: ['Stężenie i dawka odnoszą się do chlorowodorku klenbuterolu: 0,016 mg/g. Nie zastępować ich mocą wolnej zasady ani zaokrąglonym wpisem rejestru.', 'Pojemnik 500 g; po otwarciu 21 dni. Trwałość jest uwzględniona w obliczeniu liczby opakowań.', 'Wybierz odrębny wariant dla ostrego lub przewlekłego przebiegu choroby. Okresu obserwacji bezpieczeństwa nie traktujemy jako uniwersalnego limitu terapii.', 'Karencja tkanek jadalnych 28 dni. Nie stosować u klaczy produkujących mleko dla ludzi.'],
      })],
  },
  {
    id: 'vet-equioxx', name: 'Equioxx', substance: 'Firocoxibum', substanceLabel: 'Firokoksyb',
    category: 'pain', specialties: ['veterinary'], searchTerms: ['firokoksyb', 'firocoxib', 'stawy', 'osteoarthritis', 'kulawizna'],
    forms: [tablet('equioxx-horse-57', 'Equioxx · 57 mg · tabletki dla koni', 57, [10, 30, 60, 180], 'https://vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2285817.PDF', horse({
      sourceLabel: 'SPC VMD · EN (08/2023)', registrationUrl: upd('600000000067'), doseBasisIngredient: 'firokoksybu', defaultMode: 'units', allowedFractions: [1],
      notes: ['Ta postać jest przeznaczona dla koni o masie 450–600 kg. Poza tym zakresem nie przeliczamy dawki na części lub wielokrotność tabletki.', 'Schemat obejmuje całe tabletki. Linia na tabletce nie jest tu traktowana jako potwierdzenie podziału na równe dawki.', 'Podawać z małą ilością pokarmu i sprawdzić połknięcie. Czas leczenia do 14 dni, zależnie od odpowiedzi.', 'Karencja tkanek jadalnych 26 dni; zakaz przy mleku dla ludzi. Szczegółowe źródło: VMD (EN); wpis rejestracyjny UE: UPD.'],
    }))],
  },
  {
    id: 'vet-cardisure', name: 'Cardisure Flavoured', substance: 'Pimobendanum', substanceLabel: 'Pimobendan',
    category: 'vet-cardio', specialties: ['veterinary'],
    searchTerms: ['pimobendan', 'serce', 'niewydolność serca'],
    forms: [1.25, 2.5, 5, 10].map(strength => tablet(`cardisure-${strength}`, `Cardisure Flavoured · ${String(strength).replace('.', ',')} mg`, strength, [20, 50, 100, 250], 'https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/25271/leaflet', vet(['dog'], {
      sourceLabel: 'Ulotka urzędowa · RPL (PL)', doseBasisIngredient: 'pimobendanu',
      allowedFractions: strength === 1.25 ? [1, 0.5] : [1, 0.25, 0.5, 0.75],
      routeLabel: 'doustnie, na czczo, co najmniej godzinę przed posiłkiem',
      notes: [
        'Dla psów. Moc 1,25 mg: równe połowy; pozostałe moce: równe ćwiartki.',
        'Fragment przechowuj w blistrze, do 3 dni. Ten termin nie dotyczy całego opakowania.',
      ],
    }))),
  },
  {
    id: 'vet-onsior', name: 'Onsior', substance: 'Robenacoxibum', substanceLabel: 'Robenakoksyb',
    category: 'pain', specialties: ['veterinary'],
    searchTerms: ['robenakoksyb', 'robenacoxib', 'nlpz', 'ból'],
    forms: [tablet('onsior-cat-6', 'Onsior · 6 mg · kot', 6, [6, 12, 30, 60], 'https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2652572.PDF', vet(['cat'], {
      sourceLabel: 'SPC · VMD (EN)', registrationUrl: upd('600000004134'), doseBasisIngredient: 'robenakoksybu', allowedFractions: [1],
      notes: [
        'Postać dla kotów. Tabletek nie dzielić ani nie łamać. Katalog uwzględnia wyłącznie całe tabletki.',
        'Dawkowanie zależy od wskazania, masy i czasu leczenia; ustala je lekarz weterynarii.',
        'Metadane UE: UPD. Szczegółowa dokumentacja: VMD (EN). Sprawdź aktualne warunki stosowania w Polsce.',
      ],
    }))],
  },
  {
    id: 'vet-cerenia', name: 'Cerenia', substance: 'Maropitantum', substanceLabel: 'Maropitant',
    category: 'antiemetic', specialties: ['veterinary'],
    searchTerms: ['maropitant', 'wymioty', 'nudności'],
    forms: [16, 24, 60].map(strength => tablet(`cerenia-dog-${strength}`, `Cerenia · ${strength} mg · pies`, strength, [4], 'https://www.zoetis.com.pl/_locale-assets/charakterystyki-produktow/cerenia_qrd_2024.10_vnra.pdf', vet(['dog'], {
      sourceLabel: 'Polska ChPL · Zoetis (10/2024)', ...(strength === 16 ? { registrationUrl: upd('600000001524') } : {}), doseBasisIngredient: 'maropitantu', allowedFractions: [1, 0.5],
      notes: [
        `Tabletka zawiera ${strength} mg maropitantu w postaci soli. Przeliczenie odnosi się do maropitantu, nie masy cytrynianu.`,
        'Tabletki można dzielić na połowy. Niewykorzystaną połówkę zużyć w ciągu 2 dni; termin nie dotyczy całego opakowania.',
        'Postać doustna dla psów. Schemat zależy od wskazania. Dostępne schematy z tabeli nie obejmują choroby lokomocyjnej.',
      ],
    }))),
  },
  {
    id: 'vet-enrobactin', name: 'Enrobactin', substance: 'Enrofloxacinum', substanceLabel: 'Enrofloksacyna',
    category: 'antibiotics', specialties: ['veterinary'],
    searchTerms: ['enrofloksacyna', 'enrofloxacin', 'koncentrat', 'antybiotyk'],
    forms: [liquid('enrobactin-rodents-25', 'Enrobactin · 25 mg/ml · koncentrat', 'solution', null, null, [10, 30, 50], 'https://assets.hpra.ie/products/Animal/905/ie-spc-nlv0315001a004-mr-vpa10475-020-001-en_30042026111356.pdf', vet(['hamster', 'rat'], {
      sourceLabel: 'SPC · HPRA (EN)', registrationUrl: upd('600000034874'),
      calculationBlocked: true, defaultMode: 'units', unitOnly: true,
      referenceConcentrationMg: 25, referenceConcentrationMl: 1,
      calculationNote: 'Nie podawać nierozcieńczonego koncentratu. Ta karta pokazuje dane produktu; obliczenia i kopiowanie dawki są wyłączone. Lekarz weterynarii ustala przygotowanie i stężenie gotowego roztworu.',
      notes: [
        'Koncentrat do sporządzania roztworu doustnego. Stężenie 25 mg/ml dotyczy koncentratu; nie jest automatycznie przenoszone do objętości podania.',
        'Docelowe gatunki obejmują gryzonie. HPRA wymienia chomika i szczura; polski wpis UPD potwierdza gryzonie.',
        'Otwarty koncentrat: 28 dni. Przygotowany roztwór: zużyć bezpośrednio po przygotowaniu.',
        'Polski wpis rejestracyjny: UPD. Szczegóły: HPRA (EN). Nie określamy automatycznie rozcieńczenia ani dawkowania.',
      ],
    }))],
  },
];

const BASE_DRUGS = [
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
  ...VETERINARY_DRUGS,
  ...EQUINE_NSAID_DRUGS,
  ...EQUINE_ANTIPARASITIC_DRUGS,
  ...DENTAL_SYSTEMIC_DRUG_ADDITIONS,
  ...DENTAL_TOPICAL_DRUGS,
];

const dentalPatches = [...DENTAL_SYSTEMIC_FORM_PATCHES, ...DENTAL_TOPICAL_FORM_PATCHES];
export const DRUGS = BASE_DRUGS.map(drug => ({
  ...drug,
  forms: [
    ...drug.forms.map(form => ({
      ...form,
      ...(dentalPatches.find(patch => patch.drugId === drug.id && patch.formId === form.id)?.changes || {}),
    })),
    ...DENTAL_SYSTEMIC_FORM_ADDITIONS.filter(addition => addition.drugId === drug.id).map(addition => addition.form),
  ],
}));
