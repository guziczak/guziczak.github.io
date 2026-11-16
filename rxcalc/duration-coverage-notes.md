# Wspólna ocena czasu stosowania — 16.11.2026

## Zakres i ograniczenia

Przegląd dokumentacji obejmuje wszystkie 60 jawnie zdefiniowanych schematów (31 dla ludzi i 29 weterynaryjnych), nie tylko Ospamox. Każdy ma jedno jawne przypisanie do reguły czasu, odnośnik i datę przeglądu. To przegląd informacji w dokumentacji, **nie kliniczna walidacja aplikacji ani potwierdzenie leczenia pacjenta**.

- Zakres/fixed duration, jednorazowe podanie, etap, warunek konsultacji, ocena zależna od odpowiedzi, leczenie przewlekłe i procedura są odrębne. Zmiana danych źródłowych unieważnia przypisanie; nowy schemat jest niezweryfikowany, dopóki nie otrzyma przeglądu.
- Ten sam model ocenia kafelki, wpis ręczny i ostrzeżenie wyniku. Objął także instrukcje miejscowe, stałe etapy i weterynarię, poprzednio omijające wspólny widok. Zaznaczenie (obwódka/✓) jest niezależne od koloru.
- Zielony oznacza wyłącznie zgodność liczby dni z jawnym przedziałem lub stałym czasem. Pojedyncze minimum, maksimum lub termin konsultacji nie upoważnia do malowania pozostałych dni na zielono. Warunek konsultacji jest bursztynowy; przekroczenie odrębnego limitu danego schematu czerwone.
- Brak pełnego przedziału po przeglądzie jest podpisany wprost, inaczej niż brak weryfikacji. Tryb ręczny / brak wybranego schematu nie dziedziczy reguł po nazwie leku, wielkości opakowania, trwałości zawiesiny ani innym pacjencie.
- Ospamox zachowuje oddzielne zagraniczne odniesienie SDCEP 3–5 dni, z oceną najlepiej po 3 dniach. Nie utożsamia się go z ChPL ani oceną całej dawki. Pozostaje ograniczenie tabeli dziecięcej od 6 miesięcy.
- Augmentin: nie przedłużać ponad 14 dni bez ponownej oceny. To nie polecenie kontroli dopiero w dniu 14 i nie zalecenie każdej kuracji krótszej niż 14. Nie przeniesiono dawnych zaleceń SDCEP dotyczących co-amoxiclav, usuniętych z ich zaleceń drugiego wyboru w maju 2026.
- Dalacin: warunek minimum 10 dni dla paciorkowców beta-hemolizujących nie jest uogólniony na zakażenia zębów/jamy ustnej. Brak właściwego pełnego zakresu jest jawny. Nie zastosowano pięciodniowego SDCEP dla innego doboru wskazania/dawkowania.
- Analgetyki: konsultacja przy potrzebie stosowania ponad 3 dni nie staje się obowiązkową trzydniową kuracją. Tantum: okres ciągły do 7 dni i decyzja lekarza o przedłużeniu; Dentinox: kontrola przy braku poprawy po 7 dniach lub pogorszeniu.
- Metronidazol Chema: ogólne 7–10 dni z §4.4 nie jest minimalną kuracją po pojedynczym drenażu ani okresem jednego opatrunku. Dla wrzodziejącego zapalenia sanacja po 3–5 dniach jest osobną procedurą i nie znosi końca zakresu 10 dni. Baikadent: regularne dwa tygodnie; nie tworzono osobnego terminu kontroli tylko na podstawie tej długości.
- Weterynaria: dni etapu nie są liczone jako czas całego leczenia; np. brak odpowiedzi na Metacam/Butagran wymaga postępowania opisanego w źródle, ale nie wprowadza bezwarunkowego limitu dla zwierzęcia odpowiadającego na leczenie. Cardisure ma okres planowania zapasu, nie automatyczny dzień odstawienia. Jednorazowe odrobaczanie nie staje się wielodniową kuracją.
- Nie zmieniono dawek, źródłowych constraints, obliczeń, kontroli nerek/masy/wieku, warunków kopiowania ani indywidualnej oceny zaokrąglenia 11 ml. Istniejące ograniczenia resolverów nadal obowiązują; prezentacja warunku konsultacji sama nie odblokowuje wyniku. Źródło o stałym czasie nadal jawnie ustawia go przy wyborze schematu, tak jak poprzednio; nie wybieramy czasu przy braku źródłowego zalecenia.

## Weryfikacja źródeł

Teksty źródeł z poniższych przypisań odczytano narzędziem web 16.11.2026. Dla PDF wykonano próby zrzutów odpowiednich stron; część usług RPL/VMD zwróciła błąd cache. Tam podstawą był odczyt tekstowy, nie udawana weryfikacja obrazu. Nie przeprowadzono niezależnej klinicznej recenzji przez lekarza/farmaceutę. Instrukcja Eludril Care pochodzi od producenta, a nie z ChPL produktu leczniczego. Nazwy wersji wskazane w katalogu nie są nową gwarancją aktualności wszystkich danych o dawkowaniu.

Dodatkowe źródła odniesienia:
- SDCEP amoksycylina: https://www.sdcepdentalprescribing.nhs.scot/guidance/bacterial-infections/dental-abscess/first-line-antibiotics/amoxicillin/
- SDCEP ponowna ocena: https://www.sdcepdentalprescribing.nhs.scot/guidance/supporting-tools/bacterial-infections-review-tool/
- SDCEP zmiany wytycznych: https://www.sdcepdentalprescribing.nhs.scot/guidance/updates/

## Pokrycie wszystkich zdefiniowanych schematów

| Schemat | Rodzaj oceny czasu | Dane liczbowe | Źródło |
|---|---|---|---|
| dental-ospamox-suspension-ge40-q8 | range | minimum=3; maximum=5; reviewAfterDays=3 | https://www.sdcepdentalprescribing.nhs.scot/guidance/bacterial-infections/dental-abscess/first-line-antibiotics/amoxicillin/ |
| dental-ospamox-suspension-ge40-q12 | range | minimum=3; maximum=5; reviewAfterDays=3 | https://www.sdcepdentalprescribing.nhs.scot/guidance/bacterial-infections/dental-abscess/first-line-antibiotics/amoxicillin/ |
| dental-ospamox-suspension-ge40-severe | range | minimum=3; maximum=5; reviewAfterDays=3 | https://www.sdcepdentalprescribing.nhs.scot/guidance/bacterial-infections/dental-abscess/first-line-antibiotics/amoxicillin/ |
| dental-ospamox-tablet-ge40-q8 | range | minimum=3; maximum=5; reviewAfterDays=3 | https://www.sdcepdentalprescribing.nhs.scot/guidance/bacterial-infections/dental-abscess/first-line-antibiotics/amoxicillin/ |
| dental-ospamox-tablet-ge40-q12 | range | minimum=3; maximum=5; reviewAfterDays=3 | https://www.sdcepdentalprescribing.nhs.scot/guidance/bacterial-infections/dental-abscess/first-line-antibiotics/amoxicillin/ |
| dental-ospamox-tablet-ge40-severe | range | minimum=3; maximum=5; reviewAfterDays=3 | https://www.sdcepdentalprescribing.nhs.scot/guidance/bacterial-infections/dental-abscess/first-line-antibiotics/amoxicillin/ |
| dental-augmentin-tablet-500-125-ge40 | review-only | reviewAfterDays=14 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/830/characteristic |
| dental-augmentin-tablet-875-125-ge40 | review-only | reviewAfterDays=14 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/7496/characteristic |
| dental-dalacin-c-150-over14-tid | individual | Brak pełnego przedziału dni | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/1692/characteristic |
| dental-dalacin-c-150-over14-qid | individual | Brak pełnego przedziału dni | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/1692/characteristic |
| dental-dalacin-c-300-over14-tid | individual | Brak pełnego przedziału dni | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/1693/characteristic |
| dental-dalacin-c-300-over14-qid | individual | Brak pełnego przedziału dni | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/1693/characteristic |
| dental-ospamox-child-tid | range | minimum=3; maximum=5; reviewAfterDays=3 | https://www.sdcepdentalprescribing.nhs.scot/guidance/bacterial-infections/dental-abscess/first-line-antibiotics/amoxicillin/ |
| dental-augmentin-400-57-child | review-only | reviewAfterDays=14 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/8695/characteristic |
| dental-ibuprom-200-over12 | as-needed | reviewAfterDays=3 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/19798/characteristic |
| dental-ibuprom-200-child6to9 | as-needed | reviewAfterDays=3 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/19798/characteristic |
| dental-ibuprom-200-child10to12 | as-needed | reviewAfterDays=3 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/19798/characteristic |
| dental-metafen-paracetamol-over12-over50 | as-needed | reviewAfterDays=3 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/44355/characteristic |
| dentinox-teething | as-needed | reviewAfterDays=7 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/1765/characteristic |
| baikadent-chronic-mucosa | fixed | minimum=14; maximum=14 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/10297/characteristic |
| eludril-care-adult | routine | Brak pełnego przedziału dni | https://www.pierrefabre-oralcare.com/pl-pl/rutyna-przeciwprochnicowa |
| eludril-care-child | routine | Brak pełnego przedziału dni | https://www.pierrefabre-oralcare.com/pl-pl/rutyna-przeciwprochnicowa |
| tantum-spray-over12 | review-only | maximum=7; reviewAfterDays=7 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/6561/characteristic |
| tantum-spray-6to12 | review-only | maximum=7; reviewAfterDays=7 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/6561/characteristic |
| tantum-spray-under6 | review-only | maximum=7; reviewAfterDays=7 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/6561/characteristic |
| tantum-rinse-use | review-only | maximum=7; reviewAfterDays=7 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/6560/characteristic |
| metronidazole-periodontal | range | minimum=7; maximum=10 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/11440/characteristic |
| metronidazole-abscess | procedural | Brak pełnego przedziału dni | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/11440/characteristic |
| metronidazole-endo | procedural | Brak pełnego przedziału dni | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/11440/characteristic |
| metronidazole-ulcerative-gingivitis | range | minimum=7; maximum=10 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/11440/characteristic |
| dental-augmentin-suspension-adult-substitution | review-only | reviewAfterDays=14 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/7496/characteristic |
| panacur-paste-nematodes | single | minimum=1; maximum=1 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/18365/characteristic |
| panacur-paste-parascaris | single | minimum=1; maximum=1 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/18365/characteristic |
| panacur-susp-larvae-five-days | fixed | minimum=5; maximum=5 | https://assets.hpra.ie/products/Animal/2272/VPA10996_111_001_CRN00FDZT_04_10_2024_Nationalspc_14102024155757.pdf |
| gastazole-treatment | stage | minimum=28; maximum=28 | https://rejestry.ezdrowie.gov.pl/api/rpl/medicinal-products/46637/characteristic |
| gastazole-followup | stage | minimum=28; maximum=28 | https://rejestry.ezdrowie.gov.pl/api/rpl/medicinal-products/46637/characteristic |
| ventipulmin-acute | range | minimum=10; maximum=14 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/16870/characteristic |
| ventipulmin-chronic | chronic | minimum=28 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/16870/characteristic |
| equioxx-horse-osteoarthritis | maximum | maximum=14 | https://vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2285817.PDF |
| metacam-dog-initial | stage | minimum=1; maximum=1 | https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2177020.PDF |
| metacam-dog-maintenance | response | Brak pełnego przedziału dni | https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2177020.PDF |
| metacam-cat-acute-initial | stage | minimum=1; maximum=1 | https://www.vmd.defra.gov.uk/ProductInformationDatabase/files/SPC_Documents/SPC_2177046.PDF |
| metacam-cat-acute-maintenance | response | Brak pełnego przedziału dni | https://www.vmd.defra.gov.uk/ProductInformationDatabase/files/SPC_Documents/SPC_2177046.PDF |
| metacam-cat-chronic-initial | stage | minimum=1; maximum=1 | https://www.vmd.defra.gov.uk/ProductInformationDatabase/files/SPC_Documents/SPC_2177046.PDF |
| metacam-cat-chronic-maintenance | response | Brak pełnego przedziału dni | https://www.vmd.defra.gov.uk/ProductInformationDatabase/files/SPC_Documents/SPC_2177046.PDF |
| metacam-horse-msk | maximum | maximum=14 | https://vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2177034.PDF |
| cardisure-preferred | chronic | Brak pełnego przedziału dni | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/25271/leaflet |
| onsior-cat-acute | maximum | maximum=6 | https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2652572.PDF |
| cerenia-vomiting-16 | maximum | maximum=14 | https://www.zoetis.com.pl/_locale-assets/charakterystyki-produktow/cerenia_qrd_2024.10_vnra.pdf |
| cerenia-vomiting-24 | maximum | maximum=14 | https://www.zoetis.com.pl/_locale-assets/charakterystyki-produktow/cerenia_qrd_2024.10_vnra.pdf |
| cerenia-vomiting-60 | maximum | maximum=14 | https://www.zoetis.com.pl/_locale-assets/charakterystyki-produktow/cerenia_qrd_2024.10_vnra.pdf |
| flunivis-horse-msk-pyrexia | maximum | maximum=5 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/50492/characteristic |
| butagran-horse-day-one | stage | minimum=1; maximum=1 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/30160/characteristic |
| butagran-horse-days-two-four | stage | minimum=3; maximum=3 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/30160/characteristic |
| butagran-horse-daily-continuation | response | Brak pełnego przedziału dni | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/30160/characteristic |
| paramectin-horse-susceptible-parasites | single | minimum=1; maximum=1 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/18731/characteristic |
| iverpraz-horse-mixed-infestation-table | single | minimum=1; maximum=1 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/31634/characteristic |
| equimoxin-horse-susceptible-parasites | single | minimum=1; maximum=1 | https://rejestry.ezdrowie.gov.pl/api/rpl/medicinal-products/47141/characteristic |
| pyrantel-vet-planet-horse-nematodes | single | minimum=1; maximum=1 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/16565/characteristic |
| pyrantel-vet-planet-horse-anoplocephala | single | minimum=1; maximum=1 | https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/16565/characteristic |

## Pozostałe postaci / tryby bez zdefiniowanego schematu

Poniższe postaci nie otrzymują domyślnego zalecanego czasu z samej nazwy produktu. W trybie ręcznym informacja brzmi „Wybierz schemat, aby ocenić czas”; nie jest to etykieta „sprawdzono i nie ma zakresu”. Karty informacyjne i preparaty z blokadą przeliczenia nie są odblokowywane przez nowy moduł.

- nystatyna-teva: brak zdefiniowanego schematu — czas nieoceniany
- eliquis-2.5: brak zdefiniowanego schematu — czas nieoceniany
- eliquis-5: brak zdefiniowanego schematu — czas nieoceniany
- xarelto-15: brak zdefiniowanego schematu — czas nieoceniany
- xarelto-20: brak zdefiniowanego schematu — czas nieoceniany
- betaloc-zok-25: brak zdefiniowanego schematu — czas nieoceniany
- betaloc-zok-50: brak zdefiniowanego schematu — czas nieoceniany
- betaloc-zok-100: brak zdefiniowanego schematu — czas nieoceniany
- ramipril-krka-5: brak zdefiniowanego schematu — czas nieoceniany
- ramipril-krka-10: brak zdefiniowanego schematu — czas nieoceniany
- toramide-2.5: brak zdefiniowanego schematu — czas nieoceniany
- toramide-5: brak zdefiniowanego schematu — czas nieoceniany
- toramide-10: brak zdefiniowanego schematu — czas nieoceniany
- atoris-10: brak zdefiniowanego schematu — czas nieoceniany
- atoris-20: brak zdefiniowanego schematu — czas nieoceniany
- atoris-40: brak zdefiniowanego schematu — czas nieoceniany
- enrobactin-rodents-25: karta informacyjna / przeliczenie zablokowane
- ligosan-periodontal-gel: karta informacyjna / przeliczenie zablokowane
- chlosite-025: karta informacyjna / przeliczenie zablokowane
- chlosite-1: karta informacyjna / przeliczenie zablokowane
- dentomycin-gel-ie: karta informacyjna / przeliczenie zablokowane

## Testy techniczne

646 testów Node.js, w tym test pokrycia każdego z 60 schematów i każdej przypisanej postaci. 154 unikalnych sprawdzeń funkcjonalnych / układu w lokalnym Chromium: schematy ludzkie, miejscowe i weterynaryjne; zakresy, progi kontroli, stałe etapy, brak danych, dwie drogi wpisania dni, potwierdzenie i kopiowanie, dwa motywy, 320/390/768/1280 px. Brak błędów JavaScript w zakończonych scenariuszach.

Lokalne HTTP było blokowane przez środowisko. Testy UI korzystały z niezmienionej logiki modułów/CSS z lokalnych plików, z adresami importów i ikon zamienionymi na blob/data i CSP pominiętym tylko w stronie testowej. Część przygotowania scenariusza używa natywnych zdarzeń DOM selektorów; nie jest to test fizycznego dotyku. Nie testowano rzeczywistego iPhone/Safari, produkcyjnego CSP, sieci ani aktualizacji service workera. Flaki automatyzacji związane ze stabilnością animowanego edytora rozwiązano w sterowniku testu (nie zmieniano edytora w aplikacji); nie stanowi to pełnego audytu jego ergonomii.

Kod wykonawczy jest identyczny w rxcalc/ i public/rxcalc/. Cache: `2026-11-16.59`. Testy programu nie są walidacją kliniczną.
