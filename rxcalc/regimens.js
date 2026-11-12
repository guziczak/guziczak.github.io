/** Explicit, source-bound reference regimens. No diagnosis or phase is inferred. */
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

export const REGIMENS = [
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
];
