# Indywidualna ocena zaokrąglenia — 16.11.2026

## Zakres i znaczenie

Jedna wspólna ocena zasila kafelek, sprawdzenie schematu, paski i eksport. Nie wprowadzono uniwersalnej tolerancji procentowej ani automatycznie zatwierdzonej reguły stomatologicznej. Implementacja rozróżnia dowód na konkretną zamianę postaci od decyzji lekarza dotyczącej indywidualnego przypadku.

Obsługiwany przypadek to wyłącznie istniejący wariant `dental-augmentin-suspension-adult-substitution`, preparat `augmentin-400-57`, profil stomatologiczny dla dorosłych, potwierdzona masa ≥40 kg, niezmienione źródłowe 875 mg w 2 podaniach/dobę i jawnie wpisane 880 mg = 11 ml. Podany wiek musi odpowiadać osobie dorosłej. Zmiana składu, stężenia, drogi, zakresu źródła lub semantyki jego ograniczeń wyłącza wyjątek. Dzieci, inne preparaty, wartości 10,9/12,5 ml, inne częstości i weterynaria nie uzyskują tej akceptacji.

## Przepływ

- 11 ml otrzymuje żółte oznaczenie „Zaokrąglenie wymaga indywidualnej oceny”, a nie automatyczne rozpoznanie przedawkowania. Przed oceną kopiowanie pozostaje zablokowane.
- Lekarz wpisuje uzasadnienie (10–500 znaków) i potwierdza ocenę wskazania, zamiany postaci, przeciwwskazań i danych pacjenta oraz możliwość odmierzenia 11 ml. Wymagane są kompletne dane obliczenia, także czas kuracji. Brak któregokolwiek elementu nie pozwala zapisać oceny.
- Po zapisaniu lokalnej oceny kolor jest niebieski, opis brzmi „Zaokrąglenie ocenione indywidualnie”. Nie jest to walidacja kliniczna polityki ani automatyczne potwierdzenie bezpieczeństwa. Nadal trzeba osobno potwierdzić cały wynik przed kopiowaniem.
- Źródłowe 875 mg i 1750 mg/dobę pozostają niezmienione w danych i na paskach. W bardzo wąskim opisanym przypadku nie są ponownie używane jako niezależne maksima blokujące ocenę zaokrąglenia. Niezależne limity preparatu, limit lekarza, dostępne limity składników oraz warunki nerek/wieku/masy/czasu nadal blokują niezgodny wynik i nie mogą zostać ominięte tym potwierdzeniem.
- Rzeczywiste ilości to 880 mg amoksycyliny i 125,4 mg klawulanianu na podanie; 1760 mg i 250,8 mg/dobę. Paski pozostają na około 100,6% niezmienionej dawki schematu. Nie zmienia się mianownika ani nie obcina przekroczenia.
- Każda zatwierdzona edycja unieważnia ocenę i wcześniejsze końcowe potwierdzenie. Odcisk kontekstu obejmuje dane pacjenta, preparat, źródło i niezależne limity. Przywrócenie źródła lub nowy pacjent również usuwa ocenę. Nie można zwiększać tolerancji przez kolejne zaokrąglenia.
- Uzasadnienie i potwierdzenia są wyłącznie w pamięci bieżącej karty. Nie trafiają do localStorage, service workera ani na serwer. Pełny zapis do dokumentacji zawiera pierwotną i rzeczywistą dawkę, informację o indywidualnej ocenie oraz uzasadnienie. Tryb samego D.S. zawiera faktyczne 11 ml, bez rozbudowanego dopisku do dokumentacji.

## Źródła ponownie odczytane 16.11.2026

1. Polska ChPL Augmentin 400/57 mg/5 ml, RPL 8695, §2 i §4.2: skład 80/11,4 mg/ml i warunki dawkowania. Nie tworzy ogólnej tolerancji ±%.
   https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/8695/characteristic
2. HSE, *Pneumonia in Residential Care Facilities*, v2.0, przegląd 09/2024, publikacja pliku 02/2026, s. 5: zamiana 875/125 mg na 11 ml zawiesiny 400/57; oznaczona off-label. Kontekst zapalenia płuc w placówkach opieki nie jest automatycznie regułą stomatologiczną. Aplikacja liczy 125,4 mg drugiego składnika, nie zaokrąglone 125 mg z tabeli.
   https://assets.hse.ie/media/documents/Pneumonia_in_residential_care_facilities_guideline.pdf
3. Cleveland Clinic, *Clinical Rx Forum*, September/October 2020, s. 7: instytucjonalna zamiana tabletki 875/125 mg na 11 ml zawiesiny, 880/125,4 mg. To materiał historyczny, nie potwierdzenie bieżącej polityki ani walidacji tej aplikacji.
   https://www.clevelandclinicmeded.com/medicalpubs/pharmacy/September%20October%202020%20Clinical%20Rx%20Forum.pdf

Tekst obu zagranicznych PDF został odczytany. Narzędzie zrzutów tych dwóch plików zwracało błąd cache; strona dawkowania polskiej ChPL została również obejrzana jako obraz.

## Weryfikacja techniczna

527 testów Node.js (18 nowych testów wspólnej oceny) oraz 51 sprawdzeń formularza w lokalnym Chromium. Obejmują brak automatycznej akceptacji, oba składniki, uzasadnienie i potwierdzenia, kompletność, ostrzegawczą i ocenioną wersję, końcowe potwierdzenie i rzeczywisty tekst eksportu, niższy limit lekarza, nerkowe ograniczenia, cofanie oceny, przywracanie, reset, dwa motywy i szerokości 320–1280 px. Nie wykryto błędów JavaScript ani poziomego przepełnienia.

Przeglądarkę uruchomiono bez sieci z lokalnymi modułami i CSS; jedynie adresy importów i ikon zastąpiono blob/data, a CSP pominięto w testowej kopii strony. Produkcyjnego CSP nie zmieniono. Nie testowano rzeczywistego iOS/Safari, produkcyjnej sieci ani aktualizacji service workera. Testy techniczne i indywidualne potwierdzenie użytkownika nie są walidacją kliniczną reguły. Cache: `2026-11-16.56`.
