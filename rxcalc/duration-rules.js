/** Duration-source review, 2026-11-16. Not clinical validation or treatment approval.
 * Explicit mappings for every shipped regimen; no matching by medicine name.
 * A changed or new record stays unverified until its duration review is updated.
 */
export const DURATION_REVIEW_DATE='2026-11-16';
const AUDIT_KEYS=["formIds","sourceUrl","sourceSection","indication","doseMode","dose","doseRange","frequency","frequencyOptions","fixedDays","minDays","maxDays","reviewAfterDays","asNeeded","patientTypes","specialties","species","minAgeMonths","maxAgeMonths","minAgeExclusive","maxAgeExclusive","minWeight","maxWeight","maxWeightExclusive","renalPolicy","minCrCl","minCrClExclusive","minimumAge","requiresFoodChainExclusion","weightBands","phaseLabel","maxDailyMg","maxDailyMgPerKg","maxSingleMg","maxSingleMgPerKg","maxUnitsPerDose","maxDailyUnits","minIntervalHours","requireCrCl","requiresDuration","minWeightExclusive","instructionText","amountText","administration","professionalUse"];
export function durationSourceSignature(source) {
  // Change detector for an audited catalogue record, not a security credential.
  const text=JSON.stringify(AUDIT_KEYS.map(k=>source?.[k] ?? null));
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
["pyrantel-vet-planet-horse-anoplocephala","single","54f45f6d:d42bde21:476"]]);
const bindings=new Map(DURATION_BINDINGS.map(([id,policy,signature])=>[id,{policy,signature}]));
export function auditedDurationPolicy(source) {
  const binding=bindings.get(source?.id);
  if(!binding)return {status:'unverified',policy:null};
  if(binding.signature!==durationSourceSignature(source))return {status:'changed',policy:null};
  return {status:'reviewed',policy:DURATION_POLICIES[binding.policy],policyId:binding.policy};
}
