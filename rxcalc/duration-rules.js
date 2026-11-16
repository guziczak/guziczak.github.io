/** Duration-source review, 2026-11-16. Not clinical validation or treatment approval.
 * Explicit mappings for every shipped regimen; no matching by medicine name.
 * A changed or new record stays unverified until its duration review is updated.
 */
export const DURATION_REVIEW_DATE='2026-11-16';
const AUDIT_KEYS=["formIds","sourceUrl","sourceSection","indication","doseMode","dose","doseRange","frequency","frequencyOptions","fixedDays","minDays","maxDays","reviewAfterDays","asNeeded","patientTypes","specialties","species","minAgeMonths","maxAgeMonths","minAgeExclusive","maxAgeExclusive","minWeight","maxWeight","maxWeightExclusive","renalPolicy","minCrCl","minCrClExclusive","minimumAge","requiresFoodChainExclusion"];
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
export const DURATION_BINDINGS=Object.freeze([["dental-ospamox-suspension-ge40-q8","amoxicillin","e458ad24:7e9902b4:386"],
["dental-ospamox-suspension-ge40-q12","amoxicillin","31a9d58c:8bb59c64:387"],
["dental-ospamox-suspension-ge40-severe","amoxicillin","676745c1:27ff9bbd:407"],
["dental-ospamox-tablet-ge40-q8","amoxicillin","e9a9c589:3f37758d:404"],
["dental-ospamox-tablet-ge40-q12","amoxicillin","20f910ff:e3f23d0f:405"],
["dental-ospamox-tablet-ge40-severe","amoxicillin","11d60828:e569868:425"],
["dental-augmentin-tablet-500-125-ge40","augmentin","e5874dc6:2d4c8172:370"],
["dental-augmentin-tablet-875-125-ge40","augmentin","5ee44890:fcf5f13c:371"],
["dental-dalacin-c-150-over14-tid","clindamycin","9e58ba9f:9282f247:409"],
["dental-dalacin-c-150-over14-qid","clindamycin","6bd09e3f:25dd7e63:409"],
["dental-dalacin-c-300-over14-tid","clindamycin","7efb05ff:80e30a03:409"],
["dental-dalacin-c-300-over14-qid","clindamycin","c4dd319f:a6907b87:409"],
["dental-ospamox-child-tid","amoxicillin","8ff1b1a0:9fa85ac8:378"],
["dental-augmentin-400-57-child","augmentin","8b001eff:91776e1b:348"],
["dental-ibuprom-200-over12","analgesic","f3c1a162:47b0e71e:297"],
["dental-ibuprom-200-child6to9","analgesic","5f26b3c7:80dc7e53:272"],
["dental-ibuprom-200-child10to12","analgesic","d5f279ac:e61c8dc4:275"],
["dental-metafen-paracetamol-over12-over50","analgesic","1ae40b33:ab27336f:304"],
["dentinox-teething","dentinox","2b510281:4e01fae9:297"],
["baikadent-chronic-mucosa","baikadent","4f67e2de:8ad69846:317"],
["eludril-care-adult","eludril","7bcbc399:9f785549:297"],
["eludril-care-child","eludril","2a4c3fb4:f4fc514:300"],
["tantum-spray-over12","tantum","775f0780:7eacf3c:317"],
["tantum-spray-6to12","tantum","83f52b66:761ffd56:304"],
["tantum-spray-under6","tantum","5816003b:d614bb53:314"],
["tantum-rinse-use","tantum","33b804e9:8b0c799:297"],
["metronidazole-periodontal","metro-course","4492eb0e:fe4e8182:342"],
["metronidazole-abscess","metro-abscess","d00fed7d:afda9131:297"],
["metronidazole-endo","metro-endo","e153f79b:592495db:319"],
["metronidazole-ulcerative-gingivitis","metro-ulcerative","3796b25b:454de7fb:304"],
["dental-augmentin-suspension-adult-substitution","augmentin","ec5afa8a:9de45b86:428"],
["panacur-paste-nematodes","single","a73c097b:aa3bc2e7:401"],
["panacur-paste-parascaris","single","9ff55e8a:42b64876:302"],
["panacur-susp-larvae-five-days","panacur5","6134726f:385461cf:383"],
["gastazole-treatment","gastazole","5fd41083:d3cb882f:356"],
["gastazole-followup","gastazole","567663f0:d11a0d88:356"],
["ventipulmin-acute","vent-acute","5164d588:76ba88f4:390"],
["ventipulmin-chronic","vent-chronic","bd0e29f7:2c53c9f7:392"],
["equioxx-horse-osteoarthritis","max14","f382bb71:34e0cca1:334"],
["metacam-dog-initial","initial","8903feb9:c384b1dd:347"],
["metacam-dog-maintenance","metacam-dog","d08ca63e:b23a629e:350"],
["metacam-cat-acute-initial","initial","261a0a61:939b7931:330"],
["metacam-cat-acute-maintenance","metacam-cat-acute","4d8384cc:774863ec:334"],
["metacam-cat-chronic-initial","initial","78911acc:10d53d98:335"],
["metacam-cat-chronic-maintenance","metacam-cat-chronic","f5be5da2:e5cb3506:339"],
["metacam-horse-msk","max14","2f57f656:5afaa0e6:347"],
["cardisure-preferred","cardisure","7e41a148:594eaf5c:424"],
["onsior-cat-acute","onsior","926ef9ae:f29a37a2:327"],
["cerenia-vomiting-16","max14","14eda3b:4350602f:361"],
["cerenia-vomiting-24","max14","6d5ea416:d1730daa:361"],
["cerenia-vomiting-60","max14","1e5151a6:9e8e954a:361"],
["flunivis-horse-msk-pyrexia","flunivis","d76f3651:2bdcf8c9:382"],
["butagran-horse-day-one","initial","1f254962:532b1da2:416"],
["butagran-horse-days-two-four","butagran-three","c268d204:a52e0874:416"],
["butagran-horse-daily-continuation","butagran-follow","97be139f:14654f37:419"],
["paramectin-horse-susceptible-parasites","single","c038810d:c350f079:402"],
["iverpraz-horse-mixed-infestation-table","single","8aebb15e:20e4e222:398"],
["equimoxin-horse-susceptible-parasites","single","5ef658d2:2b52749e:434"],
["pyrantel-vet-planet-horse-nematodes","single","a259e7cb:f42ca3ab:440"],
["pyrantel-vet-planet-horse-anoplocephala","single","99981026:eac23916:341"]]);
const bindings=new Map(DURATION_BINDINGS.map(([id,policy,signature])=>[id,{policy,signature}]));
export function auditedDurationPolicy(source) {
  const binding=bindings.get(source?.id);
  if(!binding)return {status:'unverified',policy:null};
  if(binding.signature!==durationSourceSignature(source))return {status:'changed',policy:null};
  return {status:'reviewed',policy:DURATION_POLICIES[binding.policy],policyId:binding.policy};
}
