# Schematy kardiologiczne: Betaloc ZOK, Ramipril Krka, Toramide i Atoris

Sprawdzenie źródeł: **19 listopada 2026 r.** Moduł zawiera jawnie wybierane opcje dla dorosłych i wszystkich **11 obecnych postaci** tych czterech preparatów. Nie jest kompletną instrukcją leczenia wszystkich wskazań, grup wieku ani sytuacji klinicznych. Sam wybór preparatu nie ustala wskazania ani dawki.

## Źródła

| Preparat | Oficjalna ChPL w RPL | Data tekstu w dokumencie | Wykorzystany zakres |
|---|---|---|---|
| Betaloc ZOK 25/50/100 | [RPL 7778](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/7778/characteristic) | 07/2026 | 2–3, 4.1–4.5; dawkowanie na stronach 2–3 |
| Ramipril Krka 5/10 mg | [RPL 30040](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/30040/characteristic) | 13.09.2019 | 2–3, 4.1–4.5; dawkowanie na stronach 2–4 |
| Toramide 2,5/5/10 mg | [RPL 14012](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/14012/characteristic) | Sekcja 10 nie podaje daty | 2–3, 4.1–4.5; dawkowanie na stronie 1 |
| Atoris 10/20/40 mg | [RPL 11340](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/11340/characteristic) | 15.01.2025 | 2–3, 4.1–4.5; dawkowanie na stronach 2–3 |

Daty dokumentów odczytano z plików udostępnianych przez RPL; nie zastąpiono ich datą sprawdzenia. Jeden dokument obejmuje wszystkie wymienione moce danego preparatu.

## Decyzje dotyczące produktów

### Betaloc ZOK

ChPL podaje dawki w nazewnictwie produktu odpowiadającym winianowi, podczas gdy katalog liczy rzeczywisty bursztynian. Przeliczenie wynosi `mg ZOK × 0,95`: 12,5 → 11,875; 25 → 23,75; 50 → 47,5; 100 → 95; 200 → 190 mg. Równe połowy są dopuszczone wyłącznie dla ZOK 25.

Rozdzielono nadciśnienie, dławicę, zaburzenia rytmu, etap po ostrej fazie zawału, czynnościowe kołatania i profilaktykę migreny. W przewlekłej HF osobne są początki 25 przez dwa tygodnie oraz 12,5 przez pierwszy tydzień NYHA III–IV, następnie ocenione etapy miareczkowania i tolerowana dawka docelowa. Nie ma automatycznego przejścia do kolejnego etapu. Nerki nie narzucają rutynowej redukcji; ciężka niewydolność wątroby wymaga osobnego doboru. Warunki krążeniowe i tolerancja muszą być ocenione. Źródło: [ChPL Betaloc ZOK, 2–4.4](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/7778/characteristic).

### Ramipril Krka

Brak potwierdzonego podziału tabletek 5/10 mg wyklucza realizowanie nimi etapów 1,25/2,5 mg. Wprowadzono wykonalne późniejsze etapy nadciśnienia, profilaktyki sercowo-naczyniowej, wskazań nerkowych oraz HF. `5 mg dwa razy/dobę` przypisano tylko tabletce 5 mg; tabletka 10 mg raz/dobę nie zastępuje podzielonego schematu.

Wymagany jest oceniony CrCl. Limit wynosi 10 mg/dobę przy ≥60 ml/min i 5 mg/dobę przy 10–<60 ml/min. Graniczne 60 należy do jawnego źródłowego przedziału ≥60; niższy przedział zamknięto od góry wyłącznie dla rozłączności. Zmniejszonych dawek początkowych nie modelowano. Hemodializa ma odrębną opcję późniejszej dawki 5 mg, podawanej kilka godzin po zabiegu. Przy zaburzeniach wątroby maksimum 2,5 mg wyłącza wszystkie dostępne tutaj całe tabletki. Źródło: [ChPL Ramipril Krka, 3–4.4](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/30040/characteristic).

### Toramide

Nadciśnienie: początek 2,5 mg, ewentualnie 5 mg raz/dobę; brak dodatkowego efektu hipotensyjnego ponad 5 mg nie staje się globalnym maksimum dla innych wskazań. Obrzęki: zwykle 5 mg, dostosowanie do 20 mg raz/dobę. Wzmianka o indywidualnych przypadkach do 40 mg nie tworzy standardowej opcji ani celu.

Zakres dla tabletki 10 mg zaczyna się od 10 mg wyłącznie ze względu na całą tabletkę; nie jest to nowe minimum kliniczne. Wykluczenie bezmoczu i śpiączki wątrobowej nie oznacza wykluczenia wszystkich chorób nerek lub wątroby — obrzęki tych etiologii są wskazaniami. Potwierdzenie obejmuje też ciśnienie, rytm, wolemię, elektrolity i mikcję. Źródło: [ChPL Toramide, 4.1–4.5](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/14012/characteristic).

### Atoris

Oddzielono początek 10 mg, dawkę indywidualną w hipercholesterolemii, homozygotyczną postać rodzinną oraz prewencję sercowo-naczyniową. Górna granica 80 mg nie jest dawką domyślną. Zakresy uwzględniają wyłącznie całe tabletki wybranej mocy; zmiany dawki wymagają oceny i odstępów co najmniej czterotygodniowych.

Osobny wariant przy elbaswirze/grazoprewirze albo letermowirze ma limit 20 mg/dobę i nie obejmuje tabletki 40 mg. Nie obejmuje też przeciwwskazanego glekaprewiru/pibrentaswiru ani niezalecanego skojarzenia letermowiru z cyklosporyną. Pozostałe interakcje wymagają odrębnej oceny. Konieczne jest wykluczenie czynnej choroby wątroby i utrwalonych, niewyjaśnionych aminotransferaz >3 × GGN. Sama niewydolność nerek nie powoduje automatycznej redukcji. Źródło: [ChPL Atoris, 4.1–4.5](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/11340/characteristic).

## Kontrakt integracji

Eksport `CARDIO_MAINTENANCE_REGIMENS` ma standardową strukturę rekordów `human-regimen-engine.js`. `CARDIO_MAINTENANCE_RESEARCH` zawiera metadane i jawne wyłączenia zakresu.

- `selectionRequirements: [{ id, label, detail? }]` określa warunki zakresu schematu. Silnik wymaga odpowiadających identyfikatorów w `context.sourceConfirmations`. Zmiana pacjenta lub źródła nie może odziedziczyć nieaktualnego potwierdzenia.
- `requireCrCl`, `minCrCl`, `maxCrCl`, `maxCrClExclusive` ograniczają odpowiednie warianty ramiprylu. Brak CrCl nie oznacza prawidłowej funkcji nerek. Wariant hemodializy ma własne jawne potwierdzenie zamiast fikcyjnej wartości klirensu.
- Zakres wymaga dawki wybranej przez lekarza. Początek zakresu nie jest automatycznie wpisywaną dawką.
- Stały etap jest punktem porównania dla tego etapu. `maxDailyMg` zachowuje nazwany zakres źródłowy lub właściwy limit narządowy/interakcyjny; nie każdy punkt porównania nazywa się maksimum substancji.
- `fixedDays` występuje tylko przy dwóch jawnych początkach HF dla Betaloc. Pozostałe recepty wymagają wybranego czasu zaopatrzenia, bez przypisywania długości przewlekłej terapii.
- Potwierdzenia nie zastępują pełnej oceny klinicznej. Moduł celowo nie tworzy automatycznego rozpoznania ani pełnego systemu kontroli przeciwwskazań.

## Weryfikacja i ograniczenia

Plik `cardio-maintenance-regimens.test.mjs` sprawdza pokrycie dokładnych postaci, wykonalność skrajnych dawek i stałych etapów, zgodność jednostek Betaloc, brak niepotwierdzonych podziałów, rozłączne przedziały CrCl, warunki potwierdzeń oraz odrębne limity wskazań i interakcji. Testy nie stwierdzają skuteczności lub bezpieczeństwa leczenia konkretnego pacjenta.

Warianty pediatryczne Betaloc/Atoris, wszystkie możliwe indywidualne dawki tolerowane i wszystkie korekty interakcyjne nie są modelowane. Pokrycie oznacza przynajmniej właściwe, źródłowe opcje dla każdej obecnej postaci u dorosłych, a nie kompletność farmakoterapii.
