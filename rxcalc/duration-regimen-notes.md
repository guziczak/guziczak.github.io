# Czas stosowania a zgodność wpisanego schematu — 17.11.2026

## Doprecyzowanie źródeł — 18.11.2026

Kafelki poniżej lub powyżej zewnętrznego przedziału wskazują teraz nazwę źródła („Poniżej zakresu UCSF/SDCEP”, „Powyżej zakresu UCSF/SDCEP”). Ograniczenie pochodzące wyłącznie z pierwotnego źródła nie jest przypisywane do UCSF. Dla sprawdzonego czasu indywidualnego lub samego warunku kontroli bez zakresu widoczny jest komunikat „Czas nieoceniony”. Brak danych, zmiana rekordu lub niezweryfikowane źródło zachowują własną przyczynę, a ostrzeżenie o przekroczeniu zakresu/kontroli zachowuje pierwszeństwo.

Uzupełniający przegląd 17 rekordów jest dostępny w szczegółach. `duration-source-review.js` dostarcza wyłącznie opis i linki po sprawdzeniu dokładnego źródła i zakresu pacjenta. Nie dostarcza nowych progów ani nie zastępuje oceny łącznej. Zakres i źródła opisano w [duration-coverage-notes.md](duration-coverage-notes.md).

## Cel i zakres

Kolor czasu uwzględnia zgodność dostępnych danych z wybranym źródłem dawkowania. Porównywane są postać, grupa pacjenta lub gatunek, sprawdzane warunki pacjenta, wybrane wskazanie i etap reprezentowane przez konkretny rekord źródłowy, rzeczywista dawka oraz częstość. Aplikacja nie rozpoznaje wskazania ani nie dobiera terapii. Zielony wynik oznacza zgodność w zakresie wykonanych kontroli, a nie pełną ocenę kliniczną, bezpieczeństwo całego leczenia lub potwierdzenie wszystkich przeciwwskazań.

Aktualizacja nie dodaje leków, klinicznych wariantów dawkowania, wartości dawek do katalogu ani pól potwierdzających nieoceniane warunki kliniczne. Nie zmienia źródłowych ograniczeń, mechanizmu zaokrąglania ani indywidualnej oceny zaokrąglenia. Zmienia ocenę zgodności i jej prezentację w skrótach czasu, ręcznym wpisie oraz ostrzeżeniach wyniku.

## Podział odpowiedzialności

- `duration-rules.js` przypisuje istniejące rekordy do reguł czasu i sprawdza sygnaturę danych objętych wcześniejszym przeglądem.
- `durationPatientEligibility()` w `duration-guidance.js` sprawdza zakres pacjenta względem źródła. Tymczasowe wartości źródłowe używane na tym etapie nie potwierdzają aktualnie wpisanej dawki.
- `assessDurationRegimen()` w `duration-regimen.js` sprawdza rzeczywiste dawkowanie i zwraca `matched`, `mismatch`, `incomplete` albo `review` wraz z przyczynami po polsku.
- `durationDosePreview()` korzysta z kanonicznego `calculate()` w `engine.js`. Ten sam podgląd służy ocenie zgodności i informacji `doseComparison` wyświetlanej przy UCSF.
- `assessDurationTime()` w `duration-guidance.js` udostępnia osobną ocenę liczby dni z zachowaniem pierwszeństwa ograniczeń pierwotnego źródła. `assessDuration()` łączy ją z wynikiem dopasowania całego schematu, a `durationResultWarning()` przekazuje ostrzeżenia czasu i dopasowania do wyniku formularza.
- `duration-view.js` dla zewnętrznych odniesień pokazuje osobno porównanie dni w kafelkach oraz wszystkie przyczyny oceny schematu we wspólnym bloku. Dla pozostałych źródeł zachowuje dotychczasową prezentację oceny łącznej.

## Rzeczywista dawka i ograniczenia

Podstawą porównania jest ilość rzeczywiście podawana po wybranym zaokrągleniu. Podgląd używa wpisanych `doseMode`, `dose`, `frequency` i `roundingStep`, danych stężenia lub mocy konkretnej postaci oraz aktualnej masy. Wynik w mg lub jednostkach preparatu jest następnie przeliczany do jednostki wybranego źródła. Równoważny zapis w mg, mg/kg/dobę, mg/kg/podanie albo ml może być porównany bez uznawania różnych jednostek za różne dawki.

Dla ludzi działa ścisły `resolveHumanRegimen()` bez `allowNumericOverrides`. Dla zwierząt dawka i częstość są jawnie porównywane z wynikiem `resolveRegimen()`, także dla tabeli `weightBands`. Różne dawki etapów pozostają odrębne. Porównanie dopuszcza wyłącznie błąd reprezentacji zmiennoprzecinkowej związany z przeliczeniem; nie wprowadza procentowej tolerancji klinicznej.

Podgląd zachowuje kontrolę podzielności tabletki, pełnych podziałek przyrządu, wieku produktu, warunkowych limitów preparatu oraz limitów dawki jednorazowej i dobowej. `manualMax` może zaostrzyć dostępny limit, lecz nie może go podnieść. Wiek jest przekazywany do silnika arytmetycznego w latach, z uwzględnieniem jednostki formularza.

Przy pustej dawce, częstości lub jednostce moduł nie podstawia wartości źródłowych. Tryb `instruction` nie wymaga wymyślonej dawki liczbowej; sprawdza częstość, jeżeli źródło ją określa, oraz dostępne warunki. Jeżeli opisowa ilość nie pozwala sprawdzić obecnego limitu w mg, nie powstaje zielone potwierdzenie tego porównania.

## Kolejność oceny i kolory

Najpierw oceniana jest sama liczba dni. Weryfikacja całkowitej dodatniej liczby, minimum, maksimum i warunków ponownej oceny pozostaje niezależna od dopasowania dawki. Stan wybrania przycisku, obwódka, znacznik i `aria-pressed` są niezależne od koloru.

Poniższa tabela dotyczy oceny łącznej oraz kafelków bez zewnętrznego odniesienia, gdy wybrany czas mieści się w pełnym źródłowym przedziale albo odpowiada stałemu czasowi. Osobna prezentacja UCSF i SDCEP jest opisana poniżej:

| Dopasowanie dawkowania | Prezentacja czasu | Znaczenie |
| --- | --- | --- |
| `matched` | Zielony: „Zgodne ze schematem”, „Zgodny etap” albo „Jednorazowo” | Wpisane dane odpowiadają sprawdzanym warunkom konkretnego źródła. |
| `incomplete` lub brak oceny dawkowania | Neutralny: „Uzupełnij dane” | Brakuje podstaw do potwierdzenia zgodności. |
| `mismatch` | Ostrzeżenie: „Wymaga oceny” | Istnieje opisana rozbieżność dawki, częstości, etapu lub ograniczenia postaci. |
| `review` | Ostrzeżenie: „Wymaga oceny” | Samo porównanie liczb nie rozstrzyga warunków odniesienia. |

Czas poza zakresem, przekroczony twardy limit lub warunek kontroli zachowują swój dotychczasowy stan i priorytet; przyczyny niedopasowania są dopisywane do komunikatu. Brak dawki nie usuwa ostrzeżenia o przekroczonym czasie. Pierwotny twardy limit nie może stać się zielony ani zostać osłabiony przez zewnętrzny zakres porównania.

Brak pełnego zakresu dni nadal pozostaje brakiem oceny zalecanego czasu. Samo minimum, samo maksimum, termin kontroli, leczenie doraźne, okres zapasu leczenia przewlekłego lub opis procedury nie wyznaczają pełnej kuracji. Tryb ręczny bez źródła pozostawia skróty neutralne.

## Zewnętrzne odniesienia UCSF i SDCEP

### Prezentacja porównania dni — aktualizacja 17.11.2026

Kafelki w zewnętrznym odniesieniu pokazują tylko wynik `assessDurationTime()`: wewnątrz przedziału są neutralne, z etykietą „W zakresie UCSF” albo „W zakresie SDCEP”; poniżej/powyżej przedziału zachowują ostrzeżenie. Brak zastosowalności źródła nie uzyskuje etykiety zgodności z zakresem. Twarde ograniczenia pierwotnego źródła i warunki kontroli mają nadal pierwszeństwo.

Wspólny blok przy grupie, dostępny także jako opis grupy dla czytnika ekranu, zawiera komplet przyczyn z `guidance.regimen.reasons`. Różnica ma oznaczenie ostrzegawcze; nieocenione warunki lub brak danych pozostają informacją neutralną. Przy wybranym czasie komunikat o samych dniach nie powtarza przyczyn oceny dawkowania. Ostrzeżenia wyniku i ocena całego schematu pozostają niezmienione.

Zaznaczenie kafelka ma widoczny napis „Wybrano” i `aria-pressed`. Neutralny wybór używa neutralnego obrysu, nie zielonego. Źródło bez pełnego przedziału nadal nie potwierdza żadnego z proponowanych skrótów jako zalecanej kuracji. Ta zmiana nie zmienia wpisanej dawki, częstości, dni, zaokrąglenia ani potwierdzeń.

UCSF jest osobnym odniesieniem tylko dla istniejącego dziecięcego wariantu Augmentinu i dokładnie sprawdzanej postaci. Rzeczywista dawka na podanie jest porównywana z `comparisonSingleMg`, a częstość z `comparisonFrequency`. Rozbieżność daje `mismatch`. Przy zgodnych liczbach wynik nadal wynosi `review`: formularz nie ustala niewystarczającej odpowiedzi na leczenie pierwszego wyboru, potrzeby indywidualizacji przy powikłaniach ani dopasowania zagranicznego odniesienia do postaci. Szczegóły pochodzenia zakresu pozostają w [duration-reference-notes.md](duration-reference-notes.md).

SDCEP pozostaje odrębnym odniesieniem dla wskazanych wariantów Ospamoxu. Zgodność wpisanej dawki z wybraną ChPL nie potwierdza zgodności całego dawkowania i warunków SDCEP, więc po poprawnym sprawdzeniu źródła wynik nadal wynosi `review`. Brak danych daje wcześniej `incomplete`, a rozbieżność z wybranym źródłem `mismatch`. Żadne z tych dwóch odniesień zewnętrznych nie uzyskuje zielonego potwierdzenia tylko dzięki zgodnym liczbom lub zaznaczeniu nowego pola — takich pól nie dodano.

Pierwotne ograniczenia ChPL pozostają niezależne. W przypadku porównania UCSF dla Augmentinu zachowany jest m.in. warunek ponownej oceny przy przedłużeniu ponad 14 dni; nie jest on zamieniany w zalecany czas ani w termin oczekiwania na kontrolę.

## Czas i etapy nie są przeliczane z sumy miligramów

`assessDurationRegimen()` nie odczytuje wybranego `context.days` jako podstawy dopasowania dawki. Na potrzeby ścisłego resolvera używa kopii kontekstu z `fixedDays`, `minDays` albo technicznym jednym dniem. Kanoniczny podgląd arytmetyczny ma zawsze `days: 1`. Te wartości nie wracają do formularza i nie są rekomendacją czasu. Opakowanie oraz trwałość służą wymaganiom arytmetycznego podglądu; nie wyznaczają kuracji.

Zmiana dawki lub częstości ponownie ocenia zgodność, pozostawiając wpisany czas. Wybór źródłowego schematu ze stałym `fixedDays` nadal może ustawić czas tego etapu istniejącą ścieżką świadomego wyboru. Sama ocena nie dobiera dni, nie łączy etapów i nie wyrównuje sumy miligramów.

Trzy dni mogą oznaczać zgodny czas konkretnego źródłowego etapu, np. istniejącego etapu dni 2–4 Butagranu. Dolna granica dopuszczonego zakresu także nie jest samodzielną przyczyną ostrzeżenia. Błędna dawka innego etapu lub niepotwierdzone zastosowanie zewnętrznego odniesienia są odrębnymi przyczynami oceny.

## Regresje i weryfikacja techniczna

`duration-regimen.test.mjs` obejmuje m.in. oba końce zakresu dawki, równoważne jednostki, zmienioną częstość, brak danych, brak mutacji i niezależność od dni, rzeczywistą dawkę po zaokrągleniu, limit na podanie w odniesieniu UCSF, źródłowy etap trzydniowy, tabelę masy, podziałki przyrządu, podzielność tabletek, limity niezależne i tryb instrukcyjny. Przykład regresji rachunkowej: nominalne 450 mg w sprawdzanej zawiesinie po zaokrągleniu objętości do 5,6 ml daje 448 mg; informacja przy źródle i ocena zgodności muszą używać tej samej rzeczywistej wartości. To przypadek testowy, nie propozycja leczenia.

Testy integracji znajdują się także w `duration-guidance.test.mjs`, `duration-reference.test.mjs` i `duration-coverage.test.mjs`. `duration-comparison-view.test.mjs` sprawdza osobną prezentację porównania czasu, wspólny komunikat, ograniczenia pierwotnego źródła oraz wybór bez zmiany wartości. Pełny zestaw uruchamia `npm test` z katalogu `rxcalc/`, a budowę statyczną `npm run build`. Moduł jest wpisany do list plików `build.mjs` i `sw.js`.

Historyczna weryfikacja pierwotnej zmiany oceny łącznej: pełny zestaw `npm test` zakończył się wynikiem **703/703**, a budowa statyczna zakończyła się poprawnie. Sprawdzono zgodność wszystkich **61 plików wykonawczych** między katalogiem źródłowym a `public/rxcalc/`. Ta historyczna liczba nie opisuje aktualnego zestawu po późniejszych zmianach interfejsu. Testy techniczne nie stanowią walidacji klinicznej.
