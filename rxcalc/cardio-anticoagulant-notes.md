# Eliquis i Xarelto — zakres schematów i uzasadnienie źródłowe

Sprawdzenie źródeł: **19 listopada 2026 r.** Moduł `cardio-anticoagulant-regimens.js` zawiera 14 jawnie wybieranych schematów dla dorosłych i czterech istniejących postaci: Eliquis 2,5 mg, Eliquis 5 mg, Xarelto 15 mg, Xarelto 20 mg. Nazwy i objaśnienia są opracowaniem danych źródłowych; nie skopiowano pełnych instrukcji z ChPL. Wybór preparatu ani wpisanie CrCl nie wybiera wskazania, dawki lub następnego etapu terapii.

## Źródła pierwotne

1. **Eliquis — EMA, Annex I, Summary of Product Characteristics:** [aktualny dokument EN](https://www.ema.europa.eu/en/documents/product-information/eliquis-epar-product-information_en.pdf). Dla tabletek 2,5 mg odpowiednie punkty 4.1–4.4 rozpoczynają się na stronach 2–10; część dotycząca tabletek 5 mg zaczyna się na stronie 36. Wykorzystano wskazania, dawkowanie, tabelę 1 dla ZŻG/ZP, zasady redukcji w NVAF, funkcję nerek i sposób podawania. [Karta EPAR](https://www.ema.europa.eu/en/medicines/human/EPAR/eliquis) podaje ostatnią aktualizację informacji produktowej **10.04.2026**.
2. **Xarelto — EMA, Annex I, Summary of Product Characteristics:** [aktualny dokument EN](https://www.ema.europa.eu/en/documents/product-information/xarelto-epar-product-information_en.pdf). Część 15 mg zaczyna się na stronie 54, część 20 mg na stronie 86. Wykorzystano punkty 4.1–4.4, zwłaszcza tabele etapów ZŻG/ZP, odrębną redukcję nerkową w NVAF, warunkową redukcję w leczeniu ZŻG/ZP i przyjmowanie z posiłkiem. [Karta EPAR](https://www.ema.europa.eu/en/medicines/human/EPAR/xarelto) podaje ostatnią aktualizację informacji produktowej **22.09.2026**.

Numery stron odnoszą się do numeracji widocznej w pobranych dokumentach. `sourceDocumentDate` w rekordach jest datą aktualizacji dokumentu na stronie EMA, a nie datą pierwszego pozwolenia lub datą sporządzenia tych notatek. `sourceCheckedAt` oznacza dzień odczytu i porównania danych. W czasie przeglądu polskie adresy PDF zwracały w czytniku sieciowym błąd 429; podstawą danych jest dostępny dokument angielski z tego samego urzędowego źródła. Nie użyto streszczenia pacjenckiego jako podstawy warunków nerkowych.

## Dokładny zakres 14 rekordów

W poniższej tabeli dawka jest ilością na **jedno podanie**. Wszystkie rekordy wymagają potwierdzenia wskazania/fazy oraz ocenionego CrCl. Granica dorosłości wynosi 18 lat. Dodatkowe kryteria opisano niżej.

| ID po prefiksie `cardio-` | Postać | Dawka i częstość | Zakres i czas z ChPL 4.2 |
| --- | --- | --- | --- |
| `eliquis-nvaf-standard` | 5 mg | 5 mg × 2/dobę | NVAF; CrCl ≥30 i mniej niż 2 kryteria redukcji; długotrwale |
| `eliquis-nvaf-two-criteria` | 2,5 mg | 2,5 mg × 2/dobę | NVAF; CrCl ≥30 i co najmniej 2 kryteria; długotrwale |
| `eliquis-nvaf-severe-renal` | 2,5 mg | 2,5 mg × 2/dobę | NVAF; 15 ≤ CrCl <30, niezależnie od reguły 2 z 3; długotrwale |
| `eliquis-vte-initial` | 5 mg | 10 mg × 2/dobę | Pełny pierwszy etap ostrej ZŻG/ZP: 7 dni, po 2 tabletki na podanie |
| `eliquis-vte-continuation` | 5 mg | 5 mg × 2/dobę | Po początkowych 7 dniach; od dnia 8, czas indywidualny |
| `eliquis-vte-extended` | 2,5 mg | 2,5 mg × 2/dobę | Zapobieganie nawrotom po ukończeniu 6 miesięcy właściwego leczenia |
| `eliquis-post-hip` | 2,5 mg | 2,5 mg × 2/dobę | Po planowej wymianie stawu biodrowego; początek 12–24 h po operacji, 32–38 dni |
| `eliquis-post-knee` | 2,5 mg | 2,5 mg × 2/dobę | Po planowej wymianie stawu kolanowego; początek 12–24 h po operacji, 10–14 dni |
| `xarelto-nvaf-standard` | 20 mg | 20 mg × 1/dobę | NVAF; CrCl ≥50; długotrwale |
| `xarelto-nvaf-renal` | 15 mg | 15 mg × 1/dobę | NVAF; 15 ≤ CrCl <50; długotrwale |
| `xarelto-vte-initial` | 15 mg | 15 mg × 2/dobę | Pełny pierwszy etap ostrej ZŻG/ZP: 21 dni |
| `xarelto-vte-continuation` | 20 mg | 20 mg × 1/dobę | Po początkowych 21 dniach; od dnia 22, czas indywidualny |
| `xarelto-vte-renal-reduced` | 15 mg | 15 mg × 1/dobę | Po fazie początkowej, gdy standardem byłoby 20 mg/dobę; 15 ≤ CrCl <50 i oceniona przewaga ryzyka krwawienia nad ryzykiem nawrotu |
| `xarelto-vte-extended-high-risk` | 20 mg | 20 mg × 1/dobę | Po ≥6 miesiącach leczenia i ocenie wysokiego ryzyka nawrotu lub nawrotu mimo 10 mg/dobę |

Każdy rekord odsyła do ChPL przez `sourceUrl`, `sourceLabel`, `sourceSection`, `sourceCheckedAt`. Warunki wyboru dodatkowo zawierają własny `sourceSection` i kopię odnośnika oraz daty sprawdzenia. `notes` wyjaśniają znaczenie liczby lub reguły w danym wskazaniu. Wszystkie powyższe liczby dawki, częstości i czasu pochodzą z punktu 4.2 odpowiedniego dokumentu; populacja i wskazanie z 4.1, a wyłączenie niestabilnej ZP i ostrzeżenia z 4.4.

## Dlaczego trzeba rozdzielić reguły

### Apiksaban: trzy różne powody wybrania 2,5 mg

Reguła NVAF obejmuje wiek **≥80 lat**, masę **≤60 kg** oraz kreatyninę w surowicy **≥1,5 mg/dl**. Do redukcji potrzeba co najmniej dwóch spełnionych kryteriów. W części 4.2 ChPL podaje również równoważny próg 133 µmol/l; formularz tego modułu przyjmuje tylko mg/dl. Nie rozpoznaje jednostki na podstawie wielkości liczby i nie przelicza jej automatycznie.

Niezależnie od powyższego, NVAF przy CrCl 15–29 ml/min wymaga wariantu 2,5 mg 2 razy/dobę. Dlatego istnieje osobny rekord nerkowy, który nie wymaga sztucznego „uzupełnienia” drugiego kryterium wieku lub masy. Dwa rekordy oparte na liczbie kryteriów ograniczono do CrCl ≥30, żeby warianty nie udawały zamiennych przyczyn kwalifikacji.

Trzecie zastosowanie tej samej dawki dotyczy zapobiegania nawrotom ZŻG/ZP po 6 miesiącach oraz profilaktyki po planowej endoprotezoplastyce. Reguły NVAF nie stosuje się do tych wskazań. Wiek 85 lat, masa 50 kg i kreatynina 2 mg/dl nie zmieniają automatycznie 10 mg lub 5 mg w schemacie leczenia ostrej ZŻG/ZP na 2,5 mg. Przy CrCl 15–29 w tych wskazaniach ChPL wymaga ostrożności. CrCl <15 i dializoterapia są poza oferowanym zakresem. Źródło: Eliquis, 4.2, podrozdziały „Dose reduction”, „Renal impairment”, „Elderly”, „Body weight”; 4.4 dotyczący nerek.

Wymaganie podania wszystkich trzech danych przy porównaniu 2 z 3 jest konserwatywną zasadą kompletności aplikacji. Nie twierdzi, że ChPL wymaga nowego oznaczenia kreatyniny tylko po to, aby zliczyć kryteria już przesądzone przez wiek i masę. Wiek podany w dniach przy granicy 80 lat wymaga doprecyzowania w latach lub miesiącach, zamiast założenia stałej długości wszystkich miesięcy.

### Rywaroksaban: redukcja nerkowa zależy od wskazania

W NVAF dawka 15 mg raz/dobę przy CrCl 15–49 jest odrębnym, źródłowo opisanym schematem. W ostrej ZŻG/ZP początkowe 15 mg **2 razy**/dobę nadal obowiązuje przez pierwsze 3 tygodnie; nie zastępuje go nerkowa dawka NVAF raz/dobę.

Po fazie początkowej przy CrCl 15–49 można rozważyć 15 zamiast 20 mg raz/dobę **wyłącznie wtedy**, gdy ocenione ryzyko krwawienia przewyższa ryzyko nawrotu ZŻG/ZP. ChPL podkreśla, że ta redukcja opiera się na modelowaniu farmakokinetycznym i nie była badana klinicznie w tym zastosowaniu. Formularz wymaga osobnego potwierdzenia tej decyzji i wyświetla informację o ograniczeniu dowodów. Sam wynik CrCl 45 nie wybiera 15 mg.

W przedłużonej profilaktyce po ≥6 miesiącach ogólną dawką zalecaną jest 10 mg raz/dobę. Rekord 20 mg obejmuje jedynie wskazaną w ChPL sytuację wysokiego ryzyka nawrotu lub nawrotu podczas 10 mg. Obecny katalog nie zawiera mocy 10 mg; nie tworzymy jej przez dzielenie tabletki 20 mg ani nie zastępujemy dawką 15 mg. Źródło: Xarelto 15/20 mg, 4.2, „Treatment of DVT, treatment of PE and prevention of recurrent DVT and PE”, „Renal impairment”, „Method of administration”.

Przy CrCl 15–29 ostrzeżenie o ostrożności pozostaje niezależne od oceny potencjalnej redukcji. W przedziałach ciągłych aplikacja interpretuje opis „15–29” jako `15 ≤ CrCl <30`, a „15–49” jako `15 ≤ CrCl <50`. Nie zaokrągla CrCl do liczby całkowitej przed porównaniem.

## Czas i znaczenie limitów

`fixedDays: 7` i `fixedDays: 21` dotyczą pełnego **pierwszego** etapu. Potwierdzenie wyboru mówi o rozpoczynaniu tego etapu. Wystawienie dodatkowego zapasu pacjentowi, który zużył już część etapu, wymaga osobnej oceny; nie uruchamiamy kolejnych 7 lub 21 dni od nowej recepty. Rekordy pooperacyjne opisują całe planowane okresy 32–38 i 10–14 dni, a nie automatyczną liczbę dni pozostającą od daty nowej recepty.

Wskazane w ChPL co najmniej 3 miesiące leczenia przy określonych przemijających czynnikach ryzyka oraz 6 miesięcy leczenia poprzedzających profilaktykę nawrotów nie stają się `minDays: 90` lub `minDays: 180`. Trzy miesiące dotyczą całości odpowiednio zaplanowanej terapii, a sześć miesięcy — już przebytego leczenia. Formularz nie ma dat rozpoczęcia ani historii faz, dlatego stosuje jawne warunki wyboru i pozostawia okres zapasu do wpisania.

Nie każdy punkt porównania jest maksimum. Tylko poniższe rekordy wprowadzają `maxDailyMg`:

- Eliquis: tabela 1 w 4.2 dosłownie rozdziela maksymalne dawki dobowe na **20 mg** w pierwszych 7 dniach ZŻG/ZP, **10 mg** przy dalszym leczeniu oraz **5 mg** przy zapobieganiu nawrotom po 6 miesiącach.
- Xarelto: w zwykłym NVAF punkt 4.2 określa **20 mg/dobę** jako dawkę zalecaną i zalecane maksimum.

Pozostałe stałe dawki służą porównaniu z dokładnie wybranym schematem. Nie dopisano dla nich ogólnych maksimów substancji. Tabela ZŻG/ZP Xarelto podaje całkowitą dawkę dobową danego etapu, więc 30 mg/dobę w pierwszych 21 dniach nie staje się uniwersalnym maksimum rywaroksabanu.

## Kontrakt integracji

Moduł nie importuje `human-regimen-engine.js`. Eksportuje:

```js
CARDIO_ANTICOAGULANT_REGIMENS
assessAnticoagulantEligibility(record, context)
```

Każdy rekord ma `anticoagulantRule`, który identyfikuje dodatkową logikę, oraz `lockSourceValues: true`. Walidator zwraca `{ errors, warnings, requirements }`. `requirements` zawiera nazwy pól pacjenta, a nie potwierdzenia. Nie wybiera innego rekordu i nie modyfikuje wejścia.

| Pole | Jednostka / semantyka | Kontrola |
| --- | --- | --- |
| `context.age`, `ageUnit` | lata, miesiące lub dni | Generic engine sprawdza dorosłość; dodatkowy walidator próg 80 lat w dwóch rekordach NVAF apiksabanu |
| `context.weight` | kg | W regule 2 z 3 musi być dodatnią skończoną liczbą, w zakresie formularza do 500 kg |
| `context.crcl` | oceniony CrCl w ml/min | Wymagany we wszystkich 14 rekordach; nie zastępuje go `renalStatus: normal`, eGFR lub kreatynina |
| `context.serumCreatinine` | mg/dl | Wymagane wyłącznie w dwóch rekordach apiksabanu opartych na regule 2 z 3 |
| `context.sourceConfirmations` | tablica ID potwierdzeń | Generic engine musi wymagać wszystkich `selectionRequirements` bieżącego rekordu |
| `context.dose`, `frequency` | wartości odpowiadające `doseMode: fixed` | Po podaniu muszą być zgodne z wybranym stałym schematem; ogólne pozwolenie na nadpisania nie może omijać tego sprawdzenia |

`record.patientFields` określa dodatkowe widoczne dane pacjenta. Dla dwóch rekordów opartych na 2 z 3 to `['crcl', 'weight', 'serumCreatinine']`; dla pozostałych `['crcl']`. Wiek wynika też z istniejącego `minAgeMonths: 216`. Nie wymuszamy masy lub kreatyniny na siłę w nerkowym wariancie NVAF 2,5 mg ani w fazach ŻChZZ, w których nie służą do podanej redukcji.

Integracja musi wykonać wszystkie następujące działania:

1. Dopiąć rekordy do `HUMAN_REGIMENS`; wybór produktu pozostaje bez wybranego schematu.
2. W `resolveHumanRegimen` dołączyć wyniki `assessAnticoagulantEligibility` do zwykłej walidacji tożsamości, wieku, dawki, częstości i czasu. Sprawdzać potwierdzenia `selectionRequirements`, także przy `{allowNumericOverrides:true}`.
3. Pokazać czytelnie jednostkę mg/dl i oddzielne CrCl; respektować `lockSourceValues` w UI edycji. Nie wyliczać CrCl automatycznie z kreatyniny ani z samej etykiety „nerki prawidłowe”.
4. Czyścić potwierdzenia po zmianie schematu lub danych pacjenta. Dane i potwierdzenia muszą być częścią snapshotu/klucza kontekstu koszyka, aby stare teksty nie pozostawały aktualne po zmianie kreatyniny lub danych kwalifikacji.
5. Dodać nowy moduł do statycznego builda i precache, zwiększyć wersję cache i zsynchronizować kopię `public/rxcalc/` zgodnie z zasadami repozytorium.

Samo włączenie tablicy danych bez kroku 2 byłoby niekompletną integracją: poprzedni silnik zna dolną granicę CrCl, ale nie górną granicę przedziału, regułę 2 z 3 i jawne potwierdzenia fazy. Test integracyjny celowo wykrywa taki stan.

## Ograniczenia zakresu i testy

Oferta schematów obejmuje dorosłych. Aktualne dokumenty EMA zawierają także pediatryczne leczenie ŻChZZ, zasady zmiany antykoagulantu, pominięte dawki, kardiowersję, szczególne postępowanie po PCI i podawanie przez zgłębnik. Te osobne ścieżki nie zostały odtworzone przez analogię do 14 rekordów. Brak schematu w aplikacji nie oznacza braku rejestracji danego zastosowania.

Walidacja nie jest pełną oceną kliniczną. Nie rozpoznaje wskazania, aktywnego krwawienia, choroby wątroby, ciąży, interakcji, zespołu antyfosfolipidowego czy ryzyka związanego z protezą zastawkową. ChPL 4.3–4.6 nadal wymaga odrębnej oceny tych kwestii. Konkretnych warunków fazy, NVAF, dializoterapii lub porównania ryzyka krwawienia nie uznano za potwierdzone tylko dlatego, że istnieje prawidłowy wynik obliczenia.

`cardio-anticoagulant-regimens.test.mjs` sprawdza niezależne oczekiwania dawek dla 14 rekordów, przypisanie do czterech postaci i całych tabletek, osiem kombinacji reguły 2 z 3, granice CrCl 15/30/50, brak zastępowania CrCl przez eGFR, brak przenoszenia redukcji NVAF do ZŻG/ZP, etapowe czasy, ograniczenia nerkowego 15 mg, wymagane potwierdzenia oraz blokadę nadpisania stałego schematu. Testy programu nie stanowią walidacji klinicznej danych.
