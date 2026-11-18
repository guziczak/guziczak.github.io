/** Informational source review for explicitly identified dental regimens.
 * These notes do not provide executable duration bounds, select a treatment,
 * or establish clinical eligibility. The caller first checks the source audit
 * and patient eligibility; unfamiliar regimen IDs have no inherited review.
 */
const checkedAt = '2026-11-18';
const review = (...entries) => Object.freeze({
  checkedAt,
  entries: Object.freeze(entries.map(entry => Object.freeze({ ...entry }))),
});
const rpl = id => `https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/${id}/characteristic`;
const sdcepAmoxicillin = 'https://www.sdcepdentalprescribing.nhs.scot/guidance/bacterial-infections/dental-abscess/first-line-antibiotics/amoxicillin/';
const sdcepClindamycin = 'https://www.sdcepdentalprescribing.nhs.scot/guidance/bacterial-infections/dental-abscess/second-line-antibiotics/clindamycin/';
const queensland = 'https://www.health.qld.gov.au/__data/assets/pdf_file/0022/1447051/PCCM_full.pdf';

const augmentinPrimaryNote = 'ChPL wiąże czas leczenia z odpowiedzią pacjenta i wymaga ponownej oceny przed przedłużeniem ponad 14 dni. Nie podaje liczbowego zakresu dni dla tego wskazania stomatologicznego.';
const augmentin500Primary = {
  label: 'ChPL Augmentin 500 mg + 125 mg · §4.1–4.2',
  url: rpl(830), note: augmentinPrimaryNote,
};
const augmentin875Primary = {
  label: 'ChPL Augmentin 875 mg + 125 mg · §4.1–4.2',
  url: rpl(7496), note: augmentinPrimaryNote,
};
const adaAugmentin500 = {
  label: 'ADA · warunkowy wariant 500/125 mg 3 razy/dobę · 2019',
  url: 'https://www.ada.org/-/media/project/ada-organization/ada/ada-org/files/resources/research/ada_chairside_guide_antibiotics_ta.pdf?rev=d23ac4651660443a9ba33d925f97ecd7',
  note: 'ADA opisuje 500/125 mg 3 razy/dobę przez 7 dni po niepowodzeniu pierwszej linii u immunokompetentnych dorosłych w określonych zakażeniach miazgowych i okołowierzchołkowych, z leczeniem przyczynowym. Kontrola w ciągu 3 dni i zakończenie 24 godziny po ustąpieniu objawów oznaczają, że 7 dni nie jest automatycznym minimum; formularz nie ocenia tych warunków.',
};
const sdcepAugmentinWithdrawal = {
  label: 'SDCEP · aktualizacja z 8 maja 2026',
  url: 'https://www.sdcepdentalprescribing.nhs.scot/guidance/updates/',
  note: 'SDCEP usunęło amoksycylinę z klawulanianem z zaleceń drugiej linii 8 maja 2026; wcześniejszy zapis czasu nie jest aktualną podstawą przypisania kuracji temu schematowi.',
};
const queenslandAugmentin875 = {
  label: 'Queensland Health / RFDS · PCCM · ropień zęba, s. 252–253',
  url: queensland,
  note: 'PCCM opisuje u dorosłych 875/125 mg 2 razy/dobę przez 5 dni, w algorytmie bez ciężkich lub ogólnoustrojowych objawów. Ten zakres zastosowania nie pasuje bezwarunkowo do wybranego schematu ciężkiego ropnia; nie przypisano mu automatycznie 5 dni.',
};
const queenslandAugmentinSuspension = {
  label: 'Queensland Health / RFDS · PCCM · zawiesina w tabeli leczenia ropnia, s. 253',
  url: queensland,
  note: 'PCCM wymienia zawiesinę 400 mg + 57 mg/5 ml w tabeli z 5-dniowym leczeniem ropnia bez ciężkich lub ogólnoustrojowych objawów. Nie potwierdza to automatycznie czasu wybranego przeliczenia 875 mg na zawiesinę w schemacie ciężkiego ropnia.',
};

const ospamoxPrimaryNote = 'ChPL uzależnia czas od rodzaju zakażenia i odpowiedzi na leczenie, bez liczbowego przedziału dni dla ropnia z szerzącym się zapaleniem. Schemat dla masy co najmniej 40 kg obejmuje również część młodszych pacjentów; nie oznacza automatycznie populacji dorosłych.';
const ospamoxTabletPrimary = {
  label: 'ChPL Ospamox · tabletki · §4.1–4.2',
  url: rpl(22646), note: ospamoxPrimaryNote,
};
const ospamoxSuspensionPrimary = {
  label: 'ChPL Ospamox · zawiesina · §4.1–4.2',
  url: rpl(22744), note: ospamoxPrimaryNote,
};
const sdcepAmoxicillinQ8 = {
  label: 'SDCEP · amoksycylina u dorosłych · 500 mg 3 razy/dobę',
  url: sdcepAmoxicillin,
  note: 'SDCEP opisuje 500 mg 3 razy/dobę i 3–5 dni z kontrolą najlepiej po 3 dniach; liczbowo odpowiada temu 500 mg, nie cały wybrany zakres 250–500 mg. Jest to osobne odniesienie opisujące kapsułki i określone warunki zastosowania, bez potwierdzenia całego schematu Ospamoxu.',
};
const sdcepAmoxicillinSevere = {
  label: 'SDCEP · ciężkie zakażenie u dorosłych · 1000 mg 3 razy/dobę',
  url: sdcepAmoxicillin,
  note: 'SDCEP podwaja dawkę dorosłych do 1000 mg 3 razy/dobę w ciężkim zakażeniu, przy odniesieniu czasu 3–5 dni i kontroli najlepiej po 3 dniach. Nie obejmuje to całego wybranego zakresu 750–1000 mg ani nie potwierdza dopasowania postaci i warunków leczenia.',
};
const sdcepAmoxicillinQ12 = {
  label: 'SDCEP · porównanie z inną częstością podawania',
  url: sdcepAmoxicillin,
  note: 'SDCEP opisuje u dorosłych 500 mg 3 razy/dobę, a w ciężkim zakażeniu 1000 mg 3 razy/dobę, z odniesieniem czasu 3–5 dni. Wybrany wariant 750–1000 mg 2 razy/dobę ma inną częstość; sam zakres dni nie potwierdza zgodności całego schematu.',
};

const dalacinPrimaryNote = 'ChPL podaje 600–1800 mg/dobę w 3 lub 4 dawkach, bez jednego czasu dla wszystkich zakażeń jamy ustnej. Co najmniej 10 dni dotyczy zakażeń paciorkowcami beta-hemolizującymi, nie każdej kuracji stomatologicznej.';
const dalacin150Primary = {
  label: 'ChPL Dalacin C 150 mg · §4.1–4.2',
  url: rpl(1692), note: dalacinPrimaryNote,
};
const dalacin300Primary = {
  label: 'ChPL Dalacin C 300 mg · §4.1–4.2',
  url: rpl(1693), note: dalacinPrimaryNote,
};
const sdcepClindamycinQid = {
  label: 'SDCEP · klindamycyna · 300 mg 4 razy/dobę',
  url: sdcepClindamycin,
  note: 'SDCEP opisuje 300 mg 4 razy/dobę przez 5 dni w określonych przypadkach ropnia zębowego wymagających drugiej linii, nie cały wybrany zakres 150–450 mg. Kontrola najlepiej po 3 dniach i ocena zakończenia po ustąpieniu objawów oznaczają, że 5 dni nie jest automatycznym minimum.',
};
const sdcepClindamycinTid = {
  label: 'SDCEP · inna częstość podawania klindamycyny',
  url: sdcepClindamycin,
  note: 'Pięciodniowy wariant SDCEP opisuje 300 mg 4 razy/dobę, podczas gdy wybrany schemat ma 3 podania. Nie przeniesiono tego czasu na cały zakres dawki i inną częstość.',
};
const queenslandClindamycinTid = {
  label: 'Queensland Health / RFDS · PCCM · klindamycyna, s. 253–254',
  url: queensland,
  note: 'PCCM opisuje 300 mg 3 razy/dobę przez 5 dni przy alergii na penicyliny, w algorytmie ropnia bez ciężkich lub ogólnoustrojowych objawów. Nie jest to bezwarunkowe przypisanie 5 dni do obecnego schematu ciężkiego zakażenia ani całego jego zakresu dawki.',
};

const metronidazolePeriodontal = {
  label: 'ChPL Metronidazol Chema · maść 100 mg/g · §4.2 i §4.4',
  url: rpl(11440),
  note: 'ChPL opisuje smarowanie dziąseł 2 razy/dobę jako uzupełnienie skalingu oraz krótki okres stosowania 7–10 dni. Dotyczy to leczenia miejscowego maścią, nie doustnego metronidazolu.',
};
const metronidazoleUlcerative = {
  label: 'ChPL Metronidazol Chema · wrzodziejące zapalenie dziąseł · §4.2 i §4.4',
  url: rpl(11440),
  note: 'ChPL maści opisuje 2–3 aplikacje/dobę, sanację jamy ustnej po 3–5 dniach oraz krótki okres stosowania 7–10 dni. Termin sanacji nie jest automatycznym końcem kuracji.',
};
const metronidazoleAbscess = {
  label: 'ChPL Metronidazol Chema · ropień przyzębny · §4.2 i §4.4',
  url: rpl(11440),
  note: 'ChPL opisuje miejscowe wprowadzenie maści po odbarczeniu ropnia i dalsze leczenie przyczynowe, bez stałej częstości tej procedury. Ogólna wzmianka o 7–10 dniach nie wyznacza automatycznej kuracji po pojedynczym zabiegu.',
};
const metronidazoleEndo = {
  label: 'ChPL Metronidazol Chema · wkładka endodontyczna · §4.2 i §4.4',
  url: rpl(11440),
  note: 'ChPL określa czas pojedynczego opatrunku: w stanie ostrym wymiana codziennie do ustąpienia zaostrzenia, w przewlekłym pozostawienie 2–3 dni, nie dłużej niż 5–7 dni. To nie długość całego leczenia; uwzględnia się także ogólne ograniczenie krótkiego stosowania maści do 7–10 dni.',
};

const reviews = Object.freeze({
  'dental-augmentin-tablet-500-125-ge40': review(augmentin500Primary, adaAugmentin500, sdcepAugmentinWithdrawal),
  'dental-augmentin-tablet-875-125-ge40': review(augmentin875Primary, queenslandAugmentin875, sdcepAugmentinWithdrawal),
  'dental-augmentin-suspension-adult-substitution': review(augmentin875Primary, queenslandAugmentinSuspension, sdcepAugmentinWithdrawal),
  'dental-ospamox-suspension-ge40-q8': review(ospamoxSuspensionPrimary, sdcepAmoxicillinQ8),
  'dental-ospamox-suspension-ge40-q12': review(ospamoxSuspensionPrimary, sdcepAmoxicillinQ12),
  'dental-ospamox-suspension-ge40-severe': review(ospamoxSuspensionPrimary, sdcepAmoxicillinSevere),
  'dental-ospamox-tablet-ge40-q8': review(ospamoxTabletPrimary, sdcepAmoxicillinQ8),
  'dental-ospamox-tablet-ge40-q12': review(ospamoxTabletPrimary, sdcepAmoxicillinQ12),
  'dental-ospamox-tablet-ge40-severe': review(ospamoxTabletPrimary, sdcepAmoxicillinSevere),
  'dental-dalacin-c-150-over14-tid': review(dalacin150Primary, sdcepClindamycinTid, queenslandClindamycinTid),
  'dental-dalacin-c-150-over14-qid': review(dalacin150Primary, sdcepClindamycinQid),
  'dental-dalacin-c-300-over14-tid': review(dalacin300Primary, sdcepClindamycinTid, queenslandClindamycinTid),
  'dental-dalacin-c-300-over14-qid': review(dalacin300Primary, sdcepClindamycinQid),
  'metronidazole-periodontal': review(metronidazolePeriodontal),
  'metronidazole-abscess': review(metronidazoleAbscess),
  'metronidazole-endo': review(metronidazoleEndo),
  'metronidazole-ulcerative-gingivitis': review(metronidazoleUlcerative),
});

export function reviewedDurationSources(sourceId) {
  return typeof sourceId === 'string' && Object.prototype.hasOwnProperty.call(reviews, sourceId)
    ? reviews[sourceId] : null;
}
