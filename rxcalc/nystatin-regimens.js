/** Exact formulation: RPL 20512, 100,000 IU in 1 ml after reconstitution.
 * IU are not mg. Numeric doses use ml, with separate activity metadata for the
 * comparison. Source ranges are indication-specific, never a universal ceiling.
 */
const sourceUrl = 'https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/20512/characteristic';
const base = {
  formIds: ['nystatyna-teva'], specialties: ['dental'],
  doseMode: 'units', lockSourceValues: true,
  sourceUrl, sourceLabel: 'ChPL Nystatyna Teva · RPL', sourceSection: '2, 4.1–4.4, 6.3–6.6',
  sourceCheckedAt: '2026-11-19', clinicalReviewStatus: 'not-clinically-validated',
  screening: 'Nie obejmuje grzybic układowych. Sprawdź nadwrażliwość i substancje pomocnicze; u noworodków uwzględnij ostrzeżenie o kwasie benzoesowym.',
  notes: [
    '1 ml gotowej zawiesiny odpowiada 100 000 j.m. Wykres dotyczy wybranego wskazania, bez przeliczania j.m. na mg.',
    'Czas stosowania ustala lekarz. Siedem dni to trwałość przygotowanej zawiesiny, nie automatyczny czas terapii.',
  ],
};
const adult = { patientTypes: ['adult'], minAgeMonths: 216 };
const child = { patientTypes: ['child'], minAgeMonths: 0, maxAgeMonths: 216, maxAgeExclusive: true };
const oralAdministration = 'Wstrząsnąć zawiesinę. Przed połknięciem utrzymać ją możliwie długo w kontakcie ze zmianami w jamie ustnej.';
const gutAdministration = 'Podawać doustnie po wstrząśnięciu zawiesiny.';

export const NYSTATIN_REGIMENS = [
  { ...base, ...adult, id: 'nystatin-adult-oral', label: 'Grzybica jamy ustnej · dorośli',
    indication: 'Grzybica jamy ustnej u dorosłych', dose: 1, frequency: 4,
    administration: oralAdministration },
  { ...base, ...child, id: 'nystatin-child-oral', label: 'Pleśniawki jamy ustnej · niemowlęta, dzieci i młodzież',
    indication: 'Pleśniawki jamy ustnej u niemowląt, dzieci i młodzieży', dose: 1, frequency: 4,
    administration: oralAdministration },
  { ...base, ...adult, id: 'nystatin-adult-gastrointestinal', label: 'Grzybica przewodu pokarmowego · dorośli',
    indication: 'Grzybica przewodu pokarmowego u dorosłych', doseRange: { min: 5, max: 10 }, frequency: 4,
    administration: `${gutAdministration} Zachować odstęp 6 godzin.` },
  { ...base, ...child, id: 'nystatin-child-gastrointestinal', label: 'Grzybica przewodu pokarmowego · niemowlęta, dzieci i młodzież',
    indication: 'Grzybica przewodu pokarmowego u niemowląt, dzieci i młodzieży', doseRange: { min: 0.5, max: 5 }, frequency: 4,
    administration: `${gutAdministration} Dobową ilość podzielić na 4 równe podania.`,
    notes: [...base.notes, 'Zakres 200 000–2 000 000 j.m./dobę z ChPL po podziale na 4 podania daje 0,5–5 ml na podanie. Dawkę w zakresie wybiera lekarz.'] },
  { ...base, ...adult, id: 'nystatin-adult-antibiotic-prophylaxis', label: 'Profilaktyka podczas antybiotykoterapii · dorośli',
    indication: 'Profilaktyka grzybicy podczas leczenia dużymi dawkami antybiotyków u dorosłych', dose: 5, frequency: 3,
    administration: `${gutAdministration} Zachować odstęp 8 godzin.`,
    notes: [...base.notes, 'Dawkowanie dotyczy profilaktyki podczas antybiotykoterapii. Nie rozszerzono go automatycznie na kortykosteroidy ani na dzieci.'] },
  { ...base, ...child, id: 'nystatin-oral-brushing', label: 'Pędzlowanie jamy ustnej · niemowlęta, dzieci i młodzież',
    doseMode: 'instruction',
    indication: 'Miejscowe pędzlowanie zmian grzybiczych jamy ustnej u niemowląt, dzieci i młodzieży', frequencyOptions: [2, 3],
    instructionText: 'Nanosić zawiesinę miejscowo podczas pędzlowania jamy ustnej. ChPL nie określa objętości pojedynczej aplikacji.',
    administration: 'Wstrząsnąć zawiesinę przed użyciem.',
    notes: [...base.notes, 'Liczby aplikacji nie zamieniamy na ml ani j.m.; opakowania ustala lekarz.'] },
];

export const NYSTATIN_FORM_PATCHES = [{ drugId: 'nystatin', formId: 'nystatyna-teva', changes: {
  productKind: 'medicine', sourceCheckedAt: '2026-11-19',
  activityIngredients: [{ name: 'Nystatyna', amount: 100000, perMl: 1, unit: 'j.m.' }],
  notes: [
    'Wybierz wskazanie. Dawki ilościowe przeliczane są w ml gotowej zawiesiny; ilość substancji wyrażamy w j.m.',
    'Po przygotowaniu opakowanie zawiera 28 ml. Zawiesinę należy wstrząsnąć; przechowywać w 2–8°C i zużyć w ciągu 7 dni od przygotowania.',
  ],
} }];
