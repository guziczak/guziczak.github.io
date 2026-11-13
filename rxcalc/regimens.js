/** Explicit, source-bound reference regimens. No diagnosis or phase is inferred. */
import { EQUINE_NSAID_REGIMENS } from './equine-nsaids.js';
import { EQUINE_ANTIPARASITIC_REGIMENS } from './equine-antiparasitics.js';
const checked = '2026-11-12';
const source = (sourceUrl, sourceLabel, sourceSection) => ({ sourceUrl, sourceLabel, sourceSection, sourceCheckedAt: checked });
const metacamDogSource = source('https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2177020.PDF', 'SPC VMD (EN, kwiecień 2026)', '3.3–3.9');
const metacamCatSource = source('https://www.vmd.defra.gov.uk/ProductInformationDatabase/files/SPC_Documents/SPC_2177046.PDF', 'SPC VMD (EN, kwiecień 2026)', '3.3–3.9');
const metacamHorseSource = source('https://vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2177034.PDF', 'SPC VMD (EN, kwiecień 2026)', '3.3–3.9');
const nsaidReview = 'Sprawdź przeciwwskazania, nawodnienie, przewód pokarmowy, nerki, wątrobę, serce, zaburzenia krwotoczne, nadwrażliwość i ciążę/laktację. Nie stosować jednocześnie z innymi NLPZ ani glikokortykosteroidami. To nie jest pełna kontrola interakcji.';
const firstDay = 'Pierwszy dzień: jedna dawka. Kontynuacja ma osobny schemat i wymaga osobnego przeliczenia. Nie wybieraj dawki początkowej po wcześniejszym meloksykamie bez oceny podanych dawek.';
const meloxicam = (id, formId, species, label, indication, phaseLabel, dose, document, options = {}) => ({
  id, formIds: [formId], species: [species], label, indication, phaseLabel,
  doseMode: 'perKgDose', dose, frequency: 1, minimumAge: { value: 6, unit: 'weeks' },
  screening: nsaidReview, administration: 'Wstrząsnąć przed użyciem. Objętość podano w ml; podziałka strzykawki w kg nie jest podziałką w ml.', ...document, ...options,
});
const cereniaSource = source('https://www.zoetis.com.pl/_locale-assets/charakterystyki-produktow/cerenia_qrd_2024.10_vnra.pdf', 'Polska ChPL · Zoetis (10/2024)', '3.2–3.9, tabela na s. 5');
const horseSource = (url, label, sections) => ({ ...source(url, label, sections), sourceCheckedAt: '2026-11-13' });
const panacurPasteSource = horseSource('https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/18365/characteristic', 'Polska ChPL · RPL', '3.2–3.9, 3.12 i 5.4');
const gastazoleSource = horseSource('https://rejestry.ezdrowie.gov.pl/api/rpl/medicinal-products/46637/characteristic', 'Polska ChPL · RPL', '3.2–3.9 i 5.2–5.4');
const ventipulminSource = horseSource('https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/16870/characteristic', 'Polska ChPL · RPL', '3.2–3.9 i 5.2–5.4');
const parasiteReview = 'Potwierdź rozpoznanie i wrażliwość pasożytów; uwzględnij lokalną oporność na benzimidazole. Dokładnie określ masę, sprawdź dozownik, nadwrażliwość i karencję. Aplikacja nie ustala programu odrobaczania.';
const gastricReview = 'Potwierdź rozpoznanie i etap leczenia. Oceń nadwrażliwość, ciążę/laktację oraz interakcje, w tym z warfaryną, benzodiazepinami, sukralfatem i cyjanokobalaminą. Uwzględnij żywienie, utrzymanie i trening.';
const respiratoryReview = 'Nie stosować przy stwierdzonej chorobie serca, nadwrażliwości, w ciągu 2 dni przed spodziewanym porodem ani w pierwszych tygodniach karmienia. Sprawdź interakcje, zwłaszcza glikokortykosteroidy, oksytocynę, prostaglandyny, alkaloidy ergotaminy i atropinę.';

export const REGIMENS = [
  {
    id: 'panacur-paste-nematodes', formIds: ['panacur-horse-paste-187-5'], species: ['horse'],
    label: 'Dorosłe słupkowce i owsiki · jedno podanie',
    indication: 'Inwazje dorosłych dużych i małych słupkowców wymienionych w ChPL oraz dorosłych i jelitowych larwalnych postaci Oxyuris equi',
    phaseLabel: 'Podanie jednorazowe', doseMode: 'perKgDose', dose: 7.5, frequency: 1, fixedDays: 1,
    ...panacurPasteSource, screening: parasiteReview,
    administration: 'Podać pastę na tylną część języka. Nastawę pierścienia dozującego potwierdzić według opakowania i ChPL.',
    notes: ['Schemat nie obejmuje inwazji Parascaris equorum ani Strongyloides westeri u źrebiąt ssących.', 'Nie przedłużaj jednorazowego podania na codzienną kurację. Ewentualne ponowne leczenie wymaga odrębnej decyzji lekarza.'],
  },
  {
    id: 'panacur-paste-parascaris', formIds: ['panacur-horse-paste-187-5'], species: ['horse'],
    label: 'Parascaris equorum · jedno podanie', indication: 'Inwazja Parascaris equorum',
    phaseLabel: 'Podanie jednorazowe', doseMode: 'perKgDose', dose: 10, frequency: 1, fixedDays: 1,
    ...panacurPasteSource, screening: parasiteReview,
    administration: 'Podać pastę na tylną część języka. Nastawę pierścienia dozującego potwierdzić według opakowania i ChPL.',
    notes: ['Przy tej dawce cała strzykawka 24 g odpowiada masie 450 kg. Nie używaj ustawienia dla dawki rutynowej bez przeliczenia.', 'Nie obejmuje odrębnego schematu dla Strongyloides westeri u źrebiąt ssących.'],
  },
  {
    id: 'panacur-susp-larvae-five-days', formIds: ['panacur-horse-susp-100'], species: ['horse'],
    label: 'Stadia larwalne słupkowców · 5 dni',
    indication: 'Wędrujące stadia larwalne dużych słupkowców i otorbione stadia śluzówkowe małych słupkowców',
    phaseLabel: 'Schemat pięciodniowy', doseMode: 'perKgDose', dose: 7.5, frequency: 1, fixedDays: 5,
    ...horseSource('https://assets.hpra.ie/products/Animal/2272/VPA10996_111_001_CRN00FDZT_04_10_2024_Nationalspc_14102024155757.pdf', 'SPC HPRA · EN, Irlandia (10/2024)', '3.2–3.9 i 5.4'),
    screening: parasiteReview, administration: 'Wstrząsnąć przed użyciem. Zawiesina gotowa do podania, bez rozcieńczania.',
    notes: ['Schemat dotyczy wskazanych stadiów pasożytów. Nie przenosi się automatycznie na inne inwazje ani na pastę Panacur.', 'Dokument opisuje produkt irlandzki; lekarz potwierdza właściwe warunki zastosowania preparatu w Polsce.'],
  },
  ...[
    { id: 'gastazole-treatment', label: 'Wrzody żołądka · pierwsze 28 dni', dose: 4, phaseLabel: 'Leczenie wrzodów · etap 1 (28 dni)' },
    { id: 'gastazole-followup', label: 'Po leczeniu wrzodów · kolejne 28 dni', dose: 1, phaseLabel: 'Ograniczanie nawrotów bezpośrednio po etapie 1 · etap 2 (28 dni)' },
  ].map(phase => ({
    ...phase, formIds: ['gastazole-horse-paste-370'], species: ['horse'],
    indication: 'Leczenie wrzodów żołądka i zmniejszenie ryzyka ich nawrotu po leczeniu',
    doseMode: 'perKgDose', frequency: 1, fixedDays: 28, minimumAge: { value: 4, unit: 'weeks' }, minWeight: 70,
    ...gastazoleSource, screening: gastricReview,
    administration: 'Odmierzyć według podziałki strzykawki właściwej dla wybranej fazy. Podziałka w kg nie jest ilością pasty w g.',
    notes: ['Etapy mają różne dawki. Zapas i zapis dotyczą tylko wybranego etapu, a nie obu faz łącznie.', 'Aplikator ma kreski co 100 kg przy dawce 4 mg/kg. W fazie 1 mg/kg nastawa odpowiada ¼ masy. Aplikacja blokuje niewykonalne ustawienie i nie zaokrągla go.'],
  })),
  ...[
    { id: 'ventipulmin-acute', label: 'Ostre zapalenie oskrzeli / oskrzelików', phaseLabel: 'Przebieg ostry · 10–14 dni', minDays: 10, maxDays: 14 },
    { id: 'ventipulmin-chronic', label: 'Przewlekła choroba dróg oddechowych', phaseLabel: 'Przebieg przewlekły · co najmniej 4 tygodnie', minDays: 28 },
  ].map(variant => ({
    ...variant, formIds: ['ventipulmin-horse-granules'], species: ['horse'],
    indication: 'Choroba układu oddechowego ze zwężeniem dróg oddechowych wskutek skurczu oskrzeli/oskrzelików lub nadmiaru śluzu',
    doseMode: 'perKgDose', dose: 0.0008, frequency: 2, ...ventipulminSource, screening: respiratoryReview,
    administration: 'Podawać po wymieszaniu z karmą, najlepiej rano i wieczorem.',
    notes: ['Podstawa dawki: 0,8 µg chlorowodorku klenbuterolu/kg na podanie = 0,0008 mg/kg. Wynik to gramy rzeczywistego granulatu.', 'Czas wybiera lekarz w granicach wybranego schematu. Nie ustawiamy domyślnie ani najkrótszej, ani najdłuższej kuracji.'],
  })),
  {
    id: 'equioxx-horse-osteoarthritis', formIds: ['equioxx-horse-57'], species: ['horse'],
    label: 'Choroba zwyrodnieniowa stawów · 450–600 kg',
    indication: 'Ból i zapalenie w chorobie zwyrodnieniowej stawów oraz związana z nimi kulawizna',
    phaseLabel: 'Leczenie doustne · do 14 dni', doseMode: 'units', dose: 1, frequency: 1,
    minWeight: 450, maxWeight: 600, maxDays: 14,
    ...horseSource('https://vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2285817.PDF', 'SPC VMD · EN (08/2023)', '4.1–4.9 i 6.5'),
    screening: 'Sprawdź choroby przewodu pokarmowego, krwawienia, nerki, wątrobę, serce, nadwrażliwość i nawodnienie. Nie stosować u zwierząt przeznaczonych do rozrodu, ciężarnych lub karmiących ani łącznie z innymi NLPZ lub kortykosteroidami.',
    administration: 'Podać z małą ilością pokarmu i sprawdzić, czy tabletka została połknięta.',
    notes: ['Ta tabletka jest przeznaczona wyłącznie dla koni 450–600 kg. Poza tym zakresem należy wybrać odpowiednią postać, nie część ani wielokrotność tej tabletki.', 'Czas zależy od odpowiedzi; maksymalnie 14 dni według źródła.'],
  },
  meloxicam('metacam-dog-initial', 'metacam-dog-1-5', 'dog', 'Narząd ruchu · pierwszy dzień',
    'Ból i zapalenie w ostrych lub przewlekłych schorzeniach narządu ruchu', 'Dawka początkowa · dzień 1', 0.2, metacamDogSource,
    { fixedDays: 1, notes: [firstDay] }),
  meloxicam('metacam-dog-maintenance', 'metacam-dog-1-5', 'dog', 'Narząd ruchu · kolejne dni',
    'Ból i zapalenie w ostrych lub przewlekłych schorzeniach narządu ruchu', 'Faza podtrzymująca · od drugiego dnia', 0.1, metacamDogSource,
    { notes: ['Czas tej fazy ustala lekarz. Bez poprawy przerwać najpóźniej po 10 dniach od rozpoczęcia całego leczenia; nie jest to limit dla każdego odpowiadającego pacjenta.', 'Zmniejszanie dawki w długim leczeniu wymaga indywidualnej decyzji.'] }),
  meloxicam('metacam-cat-acute-initial', 'metacam-cat-0-5', 'cat', 'Ostre schorzenia narządu ruchu · pierwszy dzień',
    'Ból i zapalenie w ostrych schorzeniach narządu ruchu', 'Dawka początkowa · dzień 1', 0.2, metacamCatSource,
    { fixedDays: 1, notes: [firstDay] }),
  meloxicam('metacam-cat-acute-maintenance', 'metacam-cat-0-5', 'cat', 'Ostre schorzenia narządu ruchu · kolejne dni',
    'Ból i zapalenie w ostrych schorzeniach narządu ruchu', 'Kontynuacja · od drugiego dnia', 0.05, metacamCatSource,
    { notes: ['Czas zależy od utrzymywania się bólu i zapalenia; ustala go lekarz.'] }),
  meloxicam('metacam-cat-chronic-initial', 'metacam-cat-0-5', 'cat', 'Przewlekłe schorzenia narządu ruchu · pierwszy dzień',
    'Ból i zapalenie w przewlekłych schorzeniach narządu ruchu', 'Dawka początkowa · dzień 1', 0.1, metacamCatSource,
    { fixedDays: 1, notes: [firstDay] }),
  meloxicam('metacam-cat-chronic-maintenance', 'metacam-cat-0-5', 'cat', 'Przewlekłe schorzenia narządu ruchu · kolejne dni',
    'Ból i zapalenie w przewlekłych schorzeniach narządu ruchu', 'Faza podtrzymująca · od drugiego dnia', 0.05, metacamCatSource,
    { notes: ['Czas ustala lekarz. Bez poprawy przerwać najpóźniej po 14 dniach od rozpoczęcia całego leczenia; długie leczenie wymaga kontroli odpowiedzi.'] }),
  meloxicam('metacam-horse-msk', 'metacam-horse-15', 'horse', 'Ostre lub przewlekłe schorzenia narządu ruchu',
    'Ból i zapalenie w ostrych lub przewlekłych schorzeniach narządu ruchu', 'Leczenie doustne', 0.6, metacamHorseSource,
    { maxDays: 14, notes: ['Konkretny czas wybiera lekarz, maksymalnie 14 dni według źródła.', 'Nie stosować jednocześnie z antykoagulantami, innymi NLPZ ani glikokortykosteroidami. Sprawdź karencję. Ten tekst nie jest pełną receptą weterynaryjną.'] }),
  {
    id: 'cardisure-preferred', formIds: ['cardisure-1.25', 'cardisure-2.5', 'cardisure-5', 'cardisure-10'], species: ['dog'],
    label: 'Zastoinowa niewydolność serca · dawka preferowana w źródle',
    indication: 'Zastoinowa niewydolność serca z niedomykalności zastawki mitralnej lub trójdzielnej albo kardiomiopatii rozstrzeniowej',
    phaseLabel: 'Schemat preferowany w źródle; dalsze dostosowanie indywidualne',
    doseMode: 'perKgDose', dose: 0.25, frequency: 2,
    ...source('https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/25271/leaflet', 'Ulotka urzędowa RPL (PL)', '4–8; wszystkie moce'),
    screening: 'Sprawdź m.in. kardiomiopatię przerostową, przeszkody w odpływie, wątrobę, cukrzycę, ciążę/laktację oraz inne leki.',
    notes: ['0,25 mg/kg na podanie, dwa razy na dobę = 0,5 mg/kg na dobę. Źródło opisuje dobowe 0,2–0,6 mg/kg; dobór indywidualny należy do lekarza.', 'Wybierz moc pozwalającą uzyskać potwierdzony podział tabletki. Nie zaokrąglamy dawki do przypadkowej części. Czas leczenia ustala lekarz.'],
  },
  {
    id: 'onsior-cat-acute', formIds: ['onsior-cat-6'], species: ['cat'],
    label: 'Ostre schorzenia narządu ruchu · tabela masy ciała',
    indication: 'Ból i zapalenie w ostrych schorzeniach narządu ruchu', phaseLabel: 'Leczenie doustne',
    doseMode: 'units', frequency: 1, maxDays: 6, minimumAge: { value: 4, unit: 'months' },
    administration: 'Podawać bez pokarmu lub z niewielką ilością pokarmu. Tabletek nie dzielić.',
    weightBands: [
      { min: 2.5, minInclusive: true, max: 6, maxInclusive: false, units: 1 },
      { min: 6, minInclusive: true, max: 12, maxInclusive: true, units: 2 },
    ],
    ...source('https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2652572.PDF', 'SPC VMD (EN, 10/2023)', '4.5 i 4.9'),
    screening: 'Sprawdź owrzodzenia przewodu pokarmowego, inne NLPZ/steroidy, ciążę/laktację, nawodnienie oraz czynność nerek, wątroby i serca.',
    notes: ['2,5–<6 kg: 1 tabletka; 6–12 kg: 2 tabletki. Całe tabletki, raz na dobę, maksymalnie 6 dni.', 'Bez jedzenia lub z niewielką ilością pokarmu. Schemat obejmuje wiek od 4 miesięcy; nie stosuje się automatycznie do bólu pooperacyjnego ani leczenia przewlekłego.'],
  },
  ...[
    { strength: 16, bands: [{ min: 3, max: 4, units: 0.5 }, { min: 4.1, max: 8, units: 1 }] },
    { strength: 24, bands: [{ min: 8.1, max: 12, units: 1 }, { min: 12.1, max: 24, units: 2 }] },
    { strength: 60, bands: [{ min: 24.1, max: 30, units: 1 }, { min: 30.1, max: 60, units: 2 }] },
  ].map(({ strength, bands }) => ({
    id: `cerenia-vomiting-${strength}`, formIds: [`cerenia-dog-${strength}`], species: ['dog'],
    label: 'Wymioty poza chorobą lokomocyjną · tabela masy ciała',
    indication: 'Leczenie i zapobieganie wymiotom innym niż w chorobie lokomocyjnej', phaseLabel: 'Leczenie doustne',
    doseMode: 'units', frequency: 1, maxDays: 14, minimumAge: { value: 8, unit: 'weeks' },
    weightBands: bands.map(b => ({ ...b, minInclusive: true, maxInclusive: true })),
    ...cereniaSource,
    screening: 'Potwierdź przyczynę wymiotów i możliwość leczenia doustnego, wyklucz niedrożność. Oceń wątrobę, serce, ciążę/laktację i inne leki. Nie łączyć z antagonistami kanałów wapniowych.',
    notes: ['Tabela dotyczy konkretnej mocy. Poza jej przedziałami wybierz odpowiednią moc lub ustal schemat indywidualnie.', 'Zapobiegawczo podać ponad godzinę przed czynnikiem wywołującym wymioty.', 'Nie obejmuje choroby lokomocyjnej. U młodych psów z wirusowym zapaleniem jelit bezpieczeństwo stosowania ponad 5 dni nie zostało określone.'],
  })),
  ...EQUINE_NSAID_REGIMENS,
  ...EQUINE_ANTIPARASITIC_REGIMENS,
];
