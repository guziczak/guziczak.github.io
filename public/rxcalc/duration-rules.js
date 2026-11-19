/** Duration-source review, 2026-11-16. Not clinical validation or treatment approval.
 * Explicit mappings for every shipped regimen; no matching by medicine name.
 * A changed or new record stays unverified until its duration review is updated.
 */
export const DURATION_REVIEW_DATE='2026-11-16';
const AUDIT_KEYS=["formIds","sourceUrl","sourceSection","indication","doseMode","dose","doseRange","frequency","frequencyOptions","fixedDays","minDays","maxDays","reviewAfterDays","asNeeded","patientTypes","specialties","species","minAgeMonths","maxAgeMonths","minAgeExclusive","maxAgeExclusive","minWeight","maxWeight","maxWeightExclusive","renalPolicy","minCrCl","minCrClExclusive","minimumAge","requiresFoodChainExclusion","weightBands","phaseLabel","maxDailyMg","maxDailyMgPerKg","maxSingleMg","maxSingleMgPerKg","maxUnitsPerDose","maxDailyUnits","minIntervalHours","requireCrCl","requiresDuration","minWeightExclusive","instructionText","amountText","administration","professionalUse"];
// Only present new fields are appended: absence preserves the 60 earlier audit
// signatures, while changed renal/phase/confirmation rules invalidate new ones.
const ADDITIONAL_AUDIT_KEYS=['maxCrCl','maxCrClExclusive','anticoagulantRule','patientFields','selectionRequirements','lockSourceValues'];
export function durationSourceSignature(source) {
  // Change detector for an audited catalogue record, not a security credential.
  const extra=ADDITIONAL_AUDIT_KEYS.filter(k=>source?.[k]!==undefined).map(k=>[k,source[k]]);
  const text=JSON.stringify(AUDIT_KEYS.map(k=>source?.[k] ?? null))+(extra.length?JSON.stringify(extra):'');
  let a=2166136261,b=0x9e3779b9;
  for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b^text.charCodeAt(i),2246822519);}
  return (a>>>0).toString(16)+':'+(b>>>0).toString(16)+':'+text.length;
}
export const DURATION_POLICIES=Object.freeze({
  "amoxicillin": {
    "kind": "range",
    "origin": "external",
    "minimum": 3,
    "maximum": 5,
    "hardMaximum": false,
    "reviewAfterDays": 3,
    "reviewMode": "planned",
    "reviewText": "Ponowna ocena: najlepiej po 3 dniach, wcześniej przy pogorszeniu. To nie jest automatyczny koniec kuracji.",
    "url": "https://www.sdcepdentalprescribing.nhs.scot/guidance/bacterial-infections/dental-abscess/first-line-antibiotics/amoxicillin/",
    "label": "SDCEP (Szkocja) · amoksycylina, ropień zębowy",
    "reviewUrl": "https://www.sdcepdentalprescribing.nhs.scot/guidance/supporting-tools/bacterial-infections-review-tool/",
    "section": "Czas antybiotykoterapii i ponowna ocena",
    "note": "Osobne odniesienie wyłącznie do czasu z wytycznych SDCEP, nie zapis ChPL Ospamoxu ani potwierdzenie całego dawkowania. Antybiotyk tylko gdy wskazany, z leczeniem przyczynowym. Dzieci: zakres tabeli od 6 miesięcy. Decyzję o zakończeniu podejmuje lekarz po ocenie odpowiedzi.",
    "choices": [
      3,
      5,
      7,
      10
    ]
  },
  "augmentin": {
    "kind": "review-only",
    "reviewAfterDays": 14,
    "reviewMode": "extension",
    "reviewText": "Nie przedłużać leczenia ponad 14 dni bez ponownej oceny. To warunek przedłużenia, nie zalecenie czekania 14 dni na kontrolę.",
    "note": "Czas zależy od odpowiedzi pacjenta. Źródło nie podaje tu pełnego przedziału dni. Zasada kontroli przy przedłużaniu ponad 14 dni nie czyni krótszych kuracji automatycznie właściwymi. Nie przeniesiono zakresu 3–5 dni z amoksycyliny ani dawnych zaleceń SDCEP dla co-amoxiclav.",
    "choices": [
      3,
      5,
      7,
      10
    ]
  },
  "clindamycin": {
    "kind": "individual",
    "note": "Sprawdzona ChPL: brak jednego zakresu dni dla wszystkich zakażeń zębów i jamy ustnej. Co najmniej 10 dni dotyczy zakażeń paciorkowcami beta-hemolizującymi, nie każdej kuracji stomatologicznej. Nie zastosowano pięciodniowego wariantu SDCEP bez potwierdzenia jego wskazania i dawkowania.",
    "choices": [
      3,
      5,
      7,
      10
    ]
  },
  "analgesic": {
    "kind": "as-needed",
    "reviewAfterDays": 3,
    "reviewMode": "extension",
    "reviewText": "Potrzeba stosowania dłużej niż 3 dni wymaga konsultacji; przy pogorszeniu wcześniej. To próg oceny, nie obowiązkowa trzydniowa kuracja.",
    "note": "Doraźnie, najmniejsza skuteczna dawka przez możliwie krótki czas. Nie określono pełnego zalecanego przedziału dni; krótszy czas nie oznacza potwierdzenia całego leczenia.",
    "choices": [
      1,
      2,
      3,
      5
    ]
  },
  "dentinox": {
    "kind": "as-needed",
    "reviewAfterDays": 7,
    "reviewMode": "conditional",
    "reviewText": "Brak poprawy po 7 dniach lub pogorszenie wymaga konsultacji. Stosować krótkotrwale, tylko gdy potrzebne; nie jest to zalecenie ciągłej kuracji przez 7 dni.",
    "note": "Instrukcja dotyczy doraźnego łagodzenia ostrych objawów ząbkowania. Okres ząbkowania nie jest zaplanowaną długością nieprzerwanego leczenia.",
    "choices": [
      1,
      3,
      5,
      7
    ]
  },
  "baikadent": {
    "kind": "fixed",
    "minimum": 14,
    "maximum": 14,
    "hardMaximum": true,
    "note": "ChPL opisuje regularne stosowanie przez dwa tygodnie w przewlekłym zapaleniu błony śluzowej. Ocena dotyczy tego wskazania; termin 14 dni nie jest automatycznie osobnym terminem kontroli.",
    "choices": []
  },
  "eludril": {
    "kind": "routine",
    "note": "Instrukcja producenta dotyczy codziennej higieny jamy ustnej rano i wieczorem. Nie podaje skończonej kuracji w dniach. Wpisany okres służy planowaniu ilości preparatu, nie wyznacza dnia zakończenia higieny.",
    "choices": []
  },
  "tantum": {
    "kind": "review-only",
    "maximum": 7,
    "hardMaximum": false,
    "reviewAfterDays": 7,
    "reviewMode": "extension",
    "reviewText": "Stosowanie ciągłe do 7 dni. Przedłużenie wymaga decyzji lekarza; nie należy czekać do tego dnia przy pogorszeniu.",
    "note": "ChPL ogranicza samodzielne stosowanie ciągłe i dopuszcza przedłużenie po konsultacji. Nie podaje pełnego przedziału zalecanych dni.",
    "choices": [
      3,
      5,
      7,
      10
    ]
  },
  "metro-course": {
    "kind": "range",
    "minimum": 7,
    "maximum": 10,
    "hardMaximum": true,
    "note": "Krótki okres stosowania 7–10 dni według §4.4 ChPL. Dotyczy wybranego leczenia miejscowego; nie czasu pozostawienia pojedynczego opatrunku.",
    "choices": [
      7,
      8,
      9,
      10
    ]
  },
  "metro-ulcerative": {
    "kind": "range",
    "minimum": 7,
    "maximum": 10,
    "hardMaximum": true,
    "reviewText": "Źródło przewiduje sanację jamy ustnej po 3–5 dniach. To osobny element postępowania, nie koniec kuracji ani zgoda na przekroczenie jej czasu.",
    "note": "Okres 7–10 dni wynika z §4.4 ChPL; sanacja po 3–5 dniach z §4.2. Nie utożsamiamy terminu zabiegu z maksymalną długością terapii.",
    "choices": [
      7,
      8,
      9,
      10
    ]
  },
  "metro-abscess": {
    "kind": "procedural",
    "note": "Po nacięciu i opróżnieniu ropnia stosowanie miejscowe i dalsze leczenie przyczynowe. ChPL zawiera ogólne ostrzeżenie o krótkim stosowaniu 7–10 dni, ale nie jest ono obowiązkiem 7 dni po pojedynczym zabiegu. Nie ustalono automatycznej kuracji dla tego kroku.",
    "reviewText": "Przy planowaniu dalszego stosowania uwzględnij ogólne ostrzeżenie §4.4 o okresie 7–10 dni; plan zabiegów ustala lekarz.",
    "choices": []
  },
  "metro-endo": {
    "kind": "procedural",
    "note": "Częstość wymiany i czas pozostawienia opatrunku nie są łącznym czasem leczenia. W ostrym stanie wymiana codzienna; w przewlekłym pozostawienie 2–3 dni, nie dłużej niż 5–7 dni. Cały plan ustala lekarz; nie kolorujemy długości kuracji na podstawie czasu jednego opatrunku.",
    "reviewText": "Nie myl dni całego leczenia z czasem pozostawienia pojedynczego opatrunku. Uwzględnij także ogólne ostrzeżenie §4.4 o krótkim stosowaniu 7–10 dni.",
    "choices": []
  },
  "single": {
    "kind": "single",
    "minimum": 1,
    "maximum": 1,
    "hardMaximum": true,
    "note": "Jednorazowe podanie w tym wskazaniu. Jeden dzień w kalkulatorze oznacza jedno podanie, nie codzienne powtarzanie odrobaczania. Dalszy program ustala lekarz weterynarii.",
    "choices": []
  },
  "panacur5": {
    "kind": "fixed",
    "minimum": 5,
    "maximum": 5,
    "hardMaximum": true,
    "note": "Pięć kolejnych dni wyłącznie dla wybranego schematu larw. Nie przenosi się na jednorazowe schematy pasty ani inne wskazania.",
    "choices": []
  },
  "gastazole": {
    "kind": "stage",
    "minimum": 28,
    "maximum": 28,
    "hardMaximum": true,
    "note": "28 dni dotyczy wybranego etapu: leczenia albo następującego po nim zapobiegania nawrotom. Aplikacja nie łączy automatycznie etapów w jedną kurację ani nie zmienia ich dawek.",
    "choices": []
  },
  "vent-acute": {
    "kind": "range",
    "minimum": 10,
    "maximum": 14,
    "hardMaximum": true,
    "note": "Źródłowy przedział dla ostrych i podostrych przypadków. Nie stosować automatycznie do leczenia przewlekłego.",
    "choices": [
      10,
      12,
      14
    ]
  },
  "vent-chronic": {
    "kind": "chronic",
    "minimum": 28,
    "note": "W przewlekłych stanach źródło określa co najmniej cztery tygodnie, ale nie ogólną górną granicę. Dłuższy czas nie jest automatycznie zatwierdzany ani wyznaczany trwałością po otwarciu.",
    "choices": [
      28,
      30,
      60,
      90
    ]
  },
  "max14": {
    "kind": "maximum",
    "maximum": 14,
    "hardMaximum": true,
    "note": "Nie przekraczać 14 dni w tym konkretnym schemacie. Czas zależy od odpowiedzi; podany pułap nie jest zaleceniem leczenia każdego pacjenta przez 14 dni.",
    "choices": [
      3,
      5,
      7,
      14
    ]
  },
  "initial": {
    "kind": "stage",
    "minimum": 1,
    "maximum": 1,
    "hardMaximum": true,
    "note": "Pierwszy dzień / etap początkowy. Kontynuacja wymaga wyboru odrębnego etapu podtrzymującego; nie przedłużaj dawki początkowej przez wpisanie kolejnych dni.",
    "choices": []
  },
  "metacam-dog": {
    "kind": "response",
    "note": "Kontynuację ustala lekarz weterynarii. Zwykle odpowiedź w ciągu 3–4 dni; przy braku poprawy przerwać najpóźniej po 10 dniach całego leczenia. Nie jest to bezwarunkowy maksymalny czas dla zwierzęcia reagującego na leczenie.",
    "reviewText": "Oceń odpowiedź po 3–4 dniach; brak poprawy do 10. dnia całego leczenia wymaga przerwania według źródła. Dni tego etapu nie są całkowitym czasem od rozpoczęcia terapii.",
    "choices": [
      3,
      5,
      7,
      10
    ]
  },
  "metacam-cat-acute": {
    "kind": "response",
    "note": "Po etapie początkowym kontynuacja tak długo, jak utrzymują się ostry ból i stan zapalny, według oceny weterynarza. Nie przeniesiono czasu pooperacyjnego z innego wskazania.",
    "choices": [
      3,
      5,
      7,
      10
    ]
  },
  "metacam-cat-chronic": {
    "kind": "response",
    "note": "Zwykle odpowiedź w ciągu 7 dni; przy braku poprawy przerwać najpóźniej po 14 dniach całego leczenia. Nie stanowi to automatycznego maksymalnego czasu u zwierzęcia reagującego na leczenie.",
    "reviewText": "Oceń odpowiedź; brak poprawy do 14. dnia całego leczenia wymaga przerwania według źródła. Nie odliczaj tego progu od początku kolejnego etapu.",
    "choices": [
      7,
      14,
      28,
      30
    ]
  },
  "cardisure": {
    "kind": "chronic",
    "note": "Leczenie niewydolności serca ustalane indywidualnie. Źródło nie określa skończonej kuracji w dniach. Wpisana liczba dni oznacza okres planowania zapasu, a nie zalecenie odstawienia leku.",
    "choices": [
      30,
      60,
      90,
      120
    ]
  },
  "onsior": {
    "kind": "maximum",
    "maximum": 6,
    "hardMaximum": true,
    "note": "Wybrane ostre zaburzenia mięśniowo-szkieletowe: maksymalnie sześć dni. Nie przeniesiono długości leczenia z wariantów przewlekłych lub pooperacyjnych.",
    "choices": [
      1,
      3,
      5,
      6
    ]
  },
  "flunivis": {
    "kind": "maximum",
    "maximum": 5,
    "hardMaximum": true,
    "note": "Do pięciu dni zależnie od odpowiedzi, tylko dla wybranego końskiego schematu bólu mięśniowo-szkieletowego / gorączki. Nie dotyczy wariantów kolkowych ani innych gatunków.",
    "choices": [
      1,
      2,
      3,
      5
    ]
  },
  "butagran-three": {
    "kind": "stage",
    "minimum": 3,
    "maximum": 3,
    "hardMaximum": true,
    "note": "Trzy dni tego etapu odpowiadają dniom 2–4 całego leczenia. Nie są dodatkową trzydniową dawką początkową.",
    "choices": []
  },
  "butagran-follow": {
    "kind": "response",
    "note": "Kontynuacja po dniach 1–4 zależy od odpowiedzi. Brak widocznej odpowiedzi po 4–5 dniach całego leczenia wymaga jego przerwania. Nie ustalamy nowej granicy 5 dni liczonej od początku etapu kontynuacji.",
    "reviewText": "Sprawdź odpowiedź od początku całego leczenia; nie rozpoczynaj ponownie odliczania 4–5 dni przy zmianie etapu.",
    "choices": [
      3,
      5,
      7,
      10
    ]
  },
  "nystatin-individual": {
    "checkedAt": "2026-11-19", "kind": "individual",
    "note": "ChPL określa dawkę i częstość dla wybranego wskazania, bez liczbowego czasu kuracji. Siedem dni oznacza trwałość zawiesiny po przygotowaniu, nie zalecaną długość leczenia ani termin odstawienia. Dalszy czas ustala lekarz.",
    "choices": []
  },
  "nystatin-brushing": {
    "checkedAt": "2026-11-19", "kind": "individual",
    "note": "Źródło opisuje pędzlowanie jamy ustnej 2–3 razy na dobę, ale nie liczbę dni ani objętość aplikacji. Trwałość przygotowanej zawiesiny przez 7 dni nie wyznacza kuracji. Plan stosowania i liczbę opakowań ustala lekarz.",
    "choices": []
  },
  "ligosan-procedure": {
    "checkedAt": "2026-11-19", "kind": "procedural",
    "note": "ChPL opisuje aplikację żelu przez stomatologa do kieszonki. Siedem dni dotyczy ograniczeń mechanicznego czyszczenia po aplikacji, nie codziennego podawania przez tydzień. Jednorazowy wkład nie określa liczby zabiegów; plan ustala stomatolog.",
    "choices": []
  },
  "anticoagulant-nvaf": {
    "checkedAt": "2026-11-19", "kind": "chronic",
    "note": "W NVAF źródło przewiduje leczenie długotrwałe z oceną korzyści i ryzyka krwawienia, bez skończonej kuracji w dniach. Wpisana liczba dni jest okresem zapasu, nie zaleceniem odstawienia. Zapas nie wybiera ani nie zmienia wariantu dawkowania.",
    "choices": [30,60,90,120]
  },
  "apixaban-vte-initial7": {
    "checkedAt": "2026-11-19", "kind": "stage", "minimum": 7, "maximum": 7, "hardMaximum": true,
    "note": "Pierwsze 7 dni leczenia ostrej ZŻG/ZP apiksabanem 10 mg dwa razy na dobę. Następny etap ma inną dawkę i wymaga osobnego wyboru. Nie rozpoczynaj nowych 7 dni przy kolejnym zapasie w trakcie tej samej fazy.",
    "choices": []
  },
  "rivaroxaban-vte-initial21": {
    "checkedAt": "2026-11-19", "kind": "stage", "minimum": 21, "maximum": 21, "hardMaximum": true,
    "note": "Pierwsze 3 tygodnie, czyli 21 dni, leczenia ostrej ZŻG/ZP rywaroksabanem 15 mg dwa razy na dobę. Od dnia 22 wybiera się odrębny etap. Nie przedłużaj dawki początkowej ani nie rozpoczynaj fazy ponownie przez zmianę okresu zapasu.",
    "choices": []
  },
  "apixaban-hip32to38": {
    "checkedAt": "2026-11-19", "kind": "range", "minimum": 32, "maximum": 38, "hardMaximum": true,
    "note": "Profilaktyka po planowej endoprotezoplastyce biodra: pełny źródłowy okres 32–38 dni, z rozpoczęciem 12–24 godziny po zabiegu po ocenie ryzyka krwawienia. Nie jest to nowy okres dodawany przy wystawianiu kolejnego zapasu w trakcie profilaktyki.",
    "choices": [32,35,38]
  },
  "apixaban-knee10to14": {
    "checkedAt": "2026-11-19", "kind": "range", "minimum": 10, "maximum": 14, "hardMaximum": true,
    "note": "Profilaktyka po planowej endoprotezoplastyce kolana: pełny źródłowy okres 10–14 dni, z rozpoczęciem 12–24 godziny po zabiegu po ocenie ryzyka krwawienia. Nie przeniesiono tu zakresu 32–38 dni po zabiegu biodra ani nie rozpoczyna się odliczania ponownie przy kolejnym zapasie.",
    "choices": [10,12,14]
  },
  "anticoagulant-vte-continuation": {
    "checkedAt": "2026-11-19", "kind": "individual",
    "note": "Kontynuacja po odpowiednim początkowym etapie ZŻG/ZP; liczbę dni wpisuje się dla zapasu bieżącej dawki. Całkowity czas zależy od przyczyny, ryzyka nawrotu i krwawienia. Źródłowe co najmniej 3 miesiące w określonych sytuacjach dotyczą całej terapii, nie nowego minimum 90 dni dla tej recepty ani terminu odstawienia.",
    "choices": [30,60,90,120]
  },
  "anticoagulant-vte-extended": {
    "checkedAt": "2026-11-19", "kind": "chronic",
    "note": "Ten wariant wymaga wcześniejszego ukończenia odpowiedniej terapii przez co najmniej 6 miesięcy. Jest to warunek wyboru etapu, nie dodatkowe 180 dni ani automatyczny czas kolejnego zapasu. Dalszy okres i ewentualne zakończenie ustala lekarz według korzyści i ryzyka; liczba dni nie jest terminem odstawienia.",
    "choices": [30,60,90,120]
  },
  "betaloc-hf-initial14": {
    "checkedAt": "2026-11-19", "kind": "stage", "minimum": 14, "maximum": 14, "hardMaximum": true,
    "note": "Standardowy początkowy etap stabilnej przewlekłej HF: ZOK 25 raz na dobę przez pierwsze 2 tygodnie. To 14 dni wybranej fazy, nie czas całego leczenia. Kolejny etap wymaga osobnej oceny tolerancji i wyboru dawki.",
    "choices": []
  },
  "betaloc-hf-initial7": {
    "checkedAt": "2026-11-19", "kind": "stage", "minimum": 7, "maximum": 7, "hardMaximum": true,
    "note": "Szczególny pierwszy tydzień stabilnej HF NYHA III–IV: połowa ZOK 25 raz na dobę. Siedem dni dotyczy tego początku, nie całej terapii ani automatycznego odstawienia. Następny etap wybiera się po ocenie tolerancji.",
    "choices": []
  },
  "betaloc-hf-titration": {
    "checkedAt": "2026-11-19", "kind": "individual",
    "note": "ChPL opisuje ocenę tolerancji i podwajanie dawki co 2 tygodnie do dawki docelowej lub maksymalnie tolerowanej. Odstęp miareczkowania nie jest narzuconym końcem leczenia ani automatycznym okresem zapasu bieżącej dawki. Nie zaplanowano kolejnego zwiększenia ani odstawienia; dalszy etap ustala lekarz.",
    "choices": []
  },
  "betaloc-maintenance": {
    "checkedAt": "2026-11-19", "kind": "chronic",
    "note": "Dla tego wybranego wskazania lub etapu nie określono skończonej kuracji w dniach. Liczba dni oznacza zapas ustalonej dawki, nie termin odstawienia ani automatycznego zwiększenia. Kontynuacja i zmiany zależą od wskazania, odpowiedzi oraz tolerancji.",
    "choices": [30,60,90,120]
  },
  "ramipril-maintenance": {
    "checkedAt": "2026-11-19", "kind": "chronic",
    "note": "Wybrano późniejszą, ustaloną dawkę ramiprylu. Czas w dniach służy planowaniu zapasu, nie wyznacza zakończenia leczenia. Odstępy miareczkowania opisane odrębnie dla nadciśnienia, HF, nefropatii i profilaktyki nie są długością tej recepty ani automatycznym terminem odstawienia.",
    "choices": [30,60,90,120]
  },
  "toramide-hypertension": {
    "checkedAt": "2026-11-19", "kind": "chronic",
    "note": "Nadciśnienie: źródło nie wyznacza skończonej kuracji. Około 12 tygodni to czas osiągania maksymalnego efektu hipotensyjnego, nie minimalny lub maksymalny czas stosowania i nie termin zwiększenia dawki. Wpisany okres określa zapas, nie zalecenie odstawienia.",
    "choices": [30,60,90,120]
  },
  "toramide-oedema": {
    "checkedAt": "2026-11-19", "kind": "response",
    "note": "Dawkę i kontynuację przy obrzękach ustala się według przyczyny, odpowiedzi, wolemii i monitorowania. ChPL nie podaje tu liczbowego zakresu dni. Wpisany okres dotyczy zapasu bieżącej dawki, nie obowiązku utrzymywania jej ani ustalonego terminu odstawienia.",
    "choices": []
  },
  "atoris-maintenance": {
    "checkedAt": "2026-11-19", "kind": "chronic",
    "note": "Atorwastatyna: okres w kalkulatorze planuje zapas wybranej dawki, nie zakończenie leczenia. Co najmniej 4 tygodnie między zmianami dawki i czas osiągania odpowiedzi nie są minimalną długością nowej recepty, maksymalną kuracją ani terminem odstawienia. Dalszy plan zależy od indywidualnego celu i tolerancji.",
    "choices": [30,60,90,120]
  }
});
export const DURATION_BINDINGS=Object.freeze([["dental-ospamox-suspension-ge40-q8","amoxicillin","632780f0:b94f7fb4:548"],
["dental-ospamox-suspension-ge40-q12","amoxicillin","4d66ac3e:13abc472:551"],
["dental-ospamox-suspension-ge40-severe","amoxicillin","bb545c1:a3c6f9f5:571"],
["dental-ospamox-tablet-ge40-q8","amoxicillin","973e891c:a3b36670:566"],
["dental-ospamox-tablet-ge40-q12","amoxicillin","fa3764ac:40570004:569"],
["dental-ospamox-tablet-ge40-severe","amoxicillin","9dd70e51:d2d7c23d:589"],
["dental-augmentin-tablet-500-125-ge40","augmentin","fbb5eec3:98cd48ef:583"],
["dental-augmentin-tablet-875-125-ge40","augmentin","480cf31b:a7c7aee7:584"],
["dental-dalacin-c-150-over14-tid","clindamycin","c555b763:77a2cbeb:650"],
["dental-dalacin-c-150-over14-qid","clindamycin","b55a0968:fca09e70:650"],
["dental-dalacin-c-300-over14-tid","clindamycin","2fa32743:d0ab8977:650"],
["dental-dalacin-c-300-over14-qid","clindamycin","c11f65c8:e04608b4:650"],
["dental-ospamox-child-tid","amoxicillin","a7140605:d724cc59:569"],
["dental-augmentin-400-57-child","augmentin","29c5844e:a57bfd5a:519"],
["dental-ibuprom-200-over12","analgesic","3aebcb36:f16984fe:491"],
["dental-ibuprom-200-child6to9","analgesic","fc8db45f:bc9ec197:480"],
["dental-ibuprom-200-child10to12","analgesic","d0d9005b:e9353e47:476"],
["dental-metafen-paracetamol-over12-over50","analgesic","f04ea56e:27294f7e:510"],
["dentinox-teething","dentinox","3c5ae824:5ad8a8a8:595"],
["baikadent-chronic-mucosa","baikadent","b730a58a:76591e96:528"],
["eludril-care-adult","eludril","2b9c13fb:64e47a6f:491"],
["eludril-care-child","eludril","c925b1ce:78b14fc6:485"],
["tantum-spray-over12","tantum","2e6679ff:8cac395f:437"],
["tantum-spray-6to12","tantum","245c7abf:d781ceb:424"],
["tantum-spray-under6","tantum","e05fb0f9:cc94ee21:583"],
["tantum-rinse-use","tantum","98549b69:ea9d8755:472"],
["metronidazole-periodontal","metro-course","546a0626:de819872:603"],
["metronidazole-abscess","metro-abscess","d96255cf:5d843733:564"],
["metronidazole-endo","metro-endo","53bb5405:87d5ca71:694"],
["metronidazole-ulcerative-gingivitis","metro-ulcerative","e2388a8d:d3d31f85:570"],
["dental-augmentin-suspension-adult-substitution","augmentin","99ec75bc:dad9a240:686"],
["panacur-paste-nematodes","single","c7717fc8:132c6890:599"],
["panacur-paste-parascaris","single","c5131fa1:7ace8fd9:500"],
["panacur-susp-larvae-five-days","panacur5","69a5b78c:fc293284:552"],
["gastazole-treatment","gastazole","dc7189ed:6f631d25:575"],
["gastazole-followup","gastazole","7c917edb:8a99b3bb:605"],
["ventipulmin-acute","vent-acute","28899a7:23c2d2a3:551"],
["ventipulmin-chronic","vent-chronic","16d107f5:50254b19:571"],
["equioxx-horse-osteoarthritis","max14","ff8cb81a:4805d262:511"],
["metacam-dog-initial","initial","b3e1a6fa:4d52481a:547"],
["metacam-dog-maintenance","metacam-dog","9db649cf:1ab15d97:561"],
["metacam-cat-acute-initial","initial","257989a2:cfc042ee:530"],
["metacam-cat-acute-maintenance","metacam-cat-acute","3a9eb3b5:5d7e2451:538"],
["metacam-cat-chronic-initial","initial","b93d02ab:42f6e5d3:535"],
["metacam-cat-chronic-maintenance","metacam-cat-chronic","bde1bee3:4e79f72f:550"],
["metacam-horse-msk","max14","cbce861d:bce1a6e1:537"],
["cardisure-preferred","cardisure","f09642c3:bf44aa4b:564"],
["onsior-cat-acute","onsior","3b85822c:e8d36368:630"],
["cerenia-vomiting-16","max14","e89513b0:fb876780:592"],
["cerenia-vomiting-24","max14","f4a6dc9e:9b2b9ab6:595"],
["cerenia-vomiting-60","max14","bcd46266:abb9b77a:596"],
["flunivis-horse-msk-pyrexia","flunivis","219a3ce8:84f848c8:673"],
["butagran-horse-day-one","initial","37fe939c:a7cbd9a4:787"],
["butagran-horse-days-two-four","butagran-three","e420d9f4:39c2d0f8:790"],
["butagran-horse-daily-continuation","butagran-follow","41ec83a8:dca3538:799"],
["paramectin-horse-susceptible-parasites","single","fc585715:1efc81c1:583"],
["iverpraz-horse-mixed-infestation-table","single","d04d02ec:870ae804:1592"],
["equimoxin-horse-susceptible-parasites","single","7619c9c6:cde2f002:628"],
["pyrantel-vet-planet-horse-nematodes","single","5eff1d3a:8af5fbe2:575"],
["pyrantel-vet-planet-horse-anoplocephala","single","54f45f6d:d42bde21:476"],
// Additional source review, 2026-11-19. These literal snapshots are deliberately
// independent of live regimen imports. A changed record cannot approve itself.
["nystatin-adult-oral","nystatin-individual","bfa5165d:c67152d:511"],
["nystatin-child-oral","nystatin-individual","b81e914:66f5cd8:530"],
["nystatin-adult-gastrointestinal","nystatin-individual","bfbc8cda:7e35bcde:501"],
["nystatin-child-gastrointestinal","nystatin-individual","d9cff068:efccfee8:536"],
["nystatin-adult-antibiotic-prophylaxis","nystatin-individual","8d81e4d9:12e4afb5:521"],
["nystatin-oral-brushing","nystatin-brushing","435ea21a:c880b5d6:609"],
["cardio-eliquis-nvaf-standard","anticoagulant-nvaf","128c55f8:a3bf72d8:1721"],
["cardio-eliquis-nvaf-two-criteria","anticoagulant-nvaf","41a8f956:ed42f19e:1741"],
["cardio-eliquis-nvaf-severe-renal","anticoagulant-nvaf","f40adb51:6a53123d:1729"],
["cardio-eliquis-vte-initial","apixaban-vte-initial7","df643eb5:6f9374d:1690"],
["cardio-eliquis-vte-continuation","anticoagulant-vte-continuation","fb916234:43848100:1591"],
["cardio-eliquis-vte-extended","anticoagulant-vte-extended","32b762c:75e7af18:1602"],
["cardio-eliquis-post-hip","apixaban-hip32to38","8e4c2844:648aaae0:1699"],
["cardio-eliquis-post-knee","apixaban-knee10to14","13ce48f0:45f22d1c:1700"],
["cardio-xarelto-nvaf-standard","anticoagulant-nvaf","b6c03c04:fbc96e58:1106"],
["cardio-xarelto-nvaf-renal","anticoagulant-nvaf","ec9b7096:3f22916e:1546"],
["cardio-xarelto-vte-initial","rivaroxaban-vte-initial21","73a3a2b:4f969867:1119"],
["cardio-xarelto-vte-continuation","anticoagulant-vte-continuation","377afdd4:b367ec98:1061"],
["cardio-xarelto-vte-renal-reduced","anticoagulant-vte-continuation","deba2161:e5a34e71:1545"],
["cardio-xarelto-vte-extended-high-risk","anticoagulant-vte-extended","1674e2a8:543fa540:1575"],
["cardio-betaloc-hypertension-initial","betaloc-maintenance","5dac7630:3cc0b248:1074"],
["cardio-betaloc-hypertension-increased","betaloc-maintenance","3d5f10bd:92174ad5:1315"],
["cardio-betaloc-angina","betaloc-maintenance","6c281535:c1ae150d:1127"],
["cardio-betaloc-arrhythmia","betaloc-maintenance","fa022f61:ebe2da1d:1233"],
["cardio-betaloc-post-infarction-maintenance","betaloc-maintenance","d3691286:cde6f92:1268"],
["cardio-betaloc-palpitations-standard","betaloc-maintenance","14dd42a7:85fbcb3f:1092"],
["cardio-betaloc-palpitations-increased","betaloc-maintenance","cfb9a6ad:f215366d:1239"],
["cardio-betaloc-migraine-prophylaxis","betaloc-maintenance","4f34634d:31a70601:1130"],
["cardio-betaloc-hf-initial-standard","betaloc-hf-initial14","a7ce0650:612817bc:1323"],
["cardio-betaloc-hf-initial-nyha3to4","betaloc-hf-initial7","23bf5685:f70203b9:1343"],
["cardio-betaloc-hf-titration-zok25","betaloc-hf-titration","ecfa47f3:f541338f:1486"],
["cardio-betaloc-hf-titration-zok50","betaloc-hf-titration","72219b58:302e2eac:1501"],
["cardio-betaloc-hf-titration-zok100","betaloc-hf-titration","a77aa0f3:f271ba47:1516"],
["cardio-betaloc-hf-maintenance-zok200","betaloc-maintenance","d1c24cca:36815bfa:1390"],
["cardio-ramipril-hypertension-5-crcl-ge60","ramipril-maintenance","a7237e19:c80674f5:1320"],
["cardio-ramipril-hypertension-10-crcl-ge60","ramipril-maintenance","21978b1f:2f304363:1341"],
["cardio-ramipril-hypertension-5-crcl10to60","ramipril-maintenance","945fc9f5:843bb17d:1400"],
["cardio-ramipril-cv-prevention-5","ramipril-maintenance","6ea640b9:d1f91aa5:1396"],
["cardio-ramipril-cv-prevention-10","ramipril-maintenance","44f23a6f:4af6fb53:1417"],
["cardio-ramipril-nephropathy-microalbuminuria-5-standard","ramipril-maintenance","899faaef:4c91e22f:1328"],
["cardio-ramipril-nephropathy-microalbuminuria-5-reduced","ramipril-maintenance","85701b08:c051964c:1368"],
["cardio-ramipril-nephropathy-nondiabetic-proteinuria-5-standard","ramipril-maintenance","6161761f:9a293e87:1332"],
["cardio-ramipril-nephropathy-nondiabetic-proteinuria-5-reduced","ramipril-maintenance","a2c2b8:de927954:1372"],
["cardio-ramipril-diabetic-nephropathy-cv-risk-5","ramipril-maintenance","4ee60867:946bfe37:1366"],
["cardio-ramipril-diabetic-nephropathy-cv-risk-10","ramipril-maintenance","84cd2435:f9b3323d:1387"],
["cardio-ramipril-hf-maintenance-5-bid","ramipril-maintenance","b0e6fd40:c19f7f0c:1457"],
["cardio-ramipril-post-infarction-hf-maintenance-5-bid","ramipril-maintenance","5b8340d5:7aa1f641:1678"],
["cardio-ramipril-hypertension-haemodialysis-maintenance-5","ramipril-maintenance","bb845e58:74835b2c:1411"],
["cardio-toramide-hypertension-initial","toramide-hypertension","4d38f234:5623091c:930"],
["cardio-toramide-hypertension-increased","toramide-hypertension","132af5db:c0cb192b:1109"],
["cardio-toramide-oedema-initial","toramide-oedema","711de7d0:60efa3f0:984"],
["cardio-toramide-oedema-adjusted-2-5","toramide-oedema","71c7ae09:b8bcab85:1225"],
["cardio-toramide-oedema-adjusted-5","toramide-oedema","6eb84397:776034eb:1221"],
["cardio-toramide-oedema-adjusted-10","toramide-oedema","21b4b8f3:b47db99f:1225"],
["cardio-atoris-hypercholesterolaemia-initial","atoris-maintenance","36db1e5:a723f8c9:1245"],
["cardio-atoris-hypercholesterolaemia-maintenance-10","atoris-maintenance","8ea3d6d3:3bb5d8eb:1553"],
["cardio-atoris-hypercholesterolaemia-maintenance-20","atoris-maintenance","ccb445a1:92816ced:1553"],
["cardio-atoris-hypercholesterolaemia-maintenance-40","atoris-maintenance","8aaabd45:4873fc09:1553"],
["cardio-atoris-homozygous-familial-10","atoris-maintenance","bea82436:ec04cf06:1660"],
["cardio-atoris-homozygous-familial-20","atoris-maintenance","1f19f50:31fca5cc:1660"],
["cardio-atoris-homozygous-familial-40","atoris-maintenance","22e1e0d4:1867e208:1660"],
["cardio-atoris-cv-prevention-10","atoris-maintenance","92ecc827:1ca6142b:1233"],
["cardio-atoris-cv-prevention-adjusted-10","atoris-maintenance","2c0bac19:2488a2b1:1656"],
["cardio-atoris-cv-prevention-adjusted-20","atoris-maintenance","6fe28ccd:5316bc5d:1656"],
["cardio-atoris-cv-prevention-adjusted-40","atoris-maintenance","a3899c09:ae0b8d51:1656"],
["cardio-atoris-interaction-cap20-10","atoris-maintenance","fef0884a:4608e652:1488"],
["cardio-atoris-interaction-cap20-20","atoris-maintenance","f57fee24:4310a2d8:1488"],
["ligosan-adult-periodontal-procedure","ligosan-procedure","9247b452:3e3767da:801"]]);
const bindings=new Map(DURATION_BINDINGS.map(([id,policy,signature])=>[id,{policy,signature}]));
export function auditedDurationPolicy(source) {
  const binding=bindings.get(source?.id);
  if(!binding)return {status:'unverified',policy:null};
  if(binding.signature!==durationSourceSignature(source))return {status:'changed',policy:null};
  return {status:'reviewed',policy:DURATION_POLICIES[binding.policy],policyId:binding.policy};
}
