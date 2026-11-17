# Kolory czasu stosowania — 16.11.2026

## Aktualizacja oceny — 17.11.2026

Ocena czasu uwzględnia teraz rzeczywiste dawkowanie po zaokrągleniu, częstość, wybrane źródło i etap oraz sprawdzane warunki pacjenta i postaci. Brak danych wstrzymuje zielony wynik; rozbieżność oraz nieoceniane warunki zewnętrznego odniesienia dają ostrzeżenie. Dopasowanie do ChPL nie potwierdza całego schematu SDCEP. Szczegóły i kolejność reguł: [duration-regimen-notes.md](duration-regimen-notes.md). Poniższy zapis źródeł i historyczne wyniki testów zachowują datę pierwotnych prac.

## Zakres zmiany

Przyciski czasu mają osobno kolor odniesienia i stan wybrany (obwódka + znacznik). Ta sama funkcja ocenia przycisk oraz wpisaną ręcznie liczbę dni. Czas, dawka i częstość nie są wybierane automatycznie. Zmiana dni korzysta z istniejącego handlera: unieważnia poprzednie potwierdzenie i indywidualną ocenę zaokrąglenia. Nie zmieniono silnika przeliczeń, katalogu dawek, progów dawkowania ani schematów weterynaryjnych.

## Jawne odniesienie dla Ospamoxu

Dla wymienionych w module schematów amoksycyliny w leczeniu ropnia zębowego (Ospamox 250/500 mg/5 ml i tabletki 500/1000 mg) dodano osobne odniesienie do czasu z SDCEP: 3–5 dni. Nie przepisano tego zakresu do pól `minDays` lub `maxDays` polskiej ChPL. SDCEP wskazuje stosowanie antybiotyku wyłącznie gdy jest wskazany, wraz z właściwym leczeniem miejscowym/przyczynowym. Różne dawkowanie w wytycznych nie jest automatycznie uznawane za równoważne wszystkim wariantom ChPL; obecnie samo dopasowanie liczby dni do SDCEP nie daje zielonego wyniku.

Przed kolorowaniem sprawdzany jest istniejącym resolverem zakres pacjenta dla wybranego źródła. Do tego wstępnego sprawdzenia używany jest tymczasowy kontekst z wartościami źródłowymi; rzeczywista dawka i dni nie są podmieniane. Osobny krok `assessDurationRegimen()` porównuje rzeczywiście wpisane dawkowanie i końcową ilość po zaokrągleniu. Brak danych pacjenta, niezgodny preparat, ograniczenia nerkowe lub inny profil wyłączają kolorową ocenę. Dodatkowo nie rozszerzono zewnętrznej tabeli dziecięcej SDCEP na wiek poniżej 6 miesięcy. Brak podanego wieku dziecka nie jest traktowany jako spełnienie tej granicy.

- 3 i 5 dni przy kompletnym dawkowaniu: „Wymaga oceny”, ponieważ zgodność całego dawkowania i warunków SDCEP wymaga odrębnej oceny. Przy brakujących danych dawkowania ocena pozostaje neutralna. Przyczyną ostrzeżenia nie jest krótki czas ani dolna granica zakresu.
- 7 i 10 dni oraz wartości wpisane poza 3–5: bursztynowe ostrzeżenie, bez nowej blokady eksportu.
- Wybrane 10 dni pozostaje bursztynowe. Widoczne są obwódka, znacznik i `aria-pressed`; kolor nie jest jedynym komunikatem.
- Ponowna ocena najlepiej po 3 dniach jest osobną informacją, nie końcem terapii ani automatycznym zleceniem odstawienia. Pogorszenie może wymagać wcześniejszej oceny; decyzję podejmuje lekarz.
- Wybrany czas poza odniesieniem dodaje ten sam, nieblokujący komunikat do wyniku. Nie staje się błędem arytmetycznym ani automatycznie nie uniemożliwia kopiowania prawidłowo uzupełnionego i potwierdzonego wyniku.

## Pozostałe schematy

Nie przypisano 3–5 dni Augmentinowi, Dalacinowi, trybowi ręcznemu ani innym wskazaniom tylko na podstawie nazwy substancji. Brak odpowiedniej reguły daje neutralne skróty. Okres ważności zawiesiny, wielkość opakowania oraz liczba tabletek nie wyznaczają czasu leczenia.

Jawne liczbowe `fixedDays`, `minDays`, `maxDays` i `reviewAfterDays` istniejącego źródła mogą zasilać wspólny model prezentacji. Czerwony komunikat dotyczy istniejącego limitu wybranego schematu bez zapisanej klauzuli ponownej oceny; nie jest deklaracją uniwersalnego maksimum leku. Gdy źródło zawiera warunek konsultacji, przekroczenie jest ostrzeżeniem. Pojedyncze minimum/maksimum nie wystarcza, by wszystkie pozostałe liczby dni oznaczyć zielono. Istniejące blokady resolvera nie zostały zmienione. Nie dokonano nowej klinicznej walidacji całego katalogu.

## Źródła bezpośrednio odczytane 16.11.2026

1. SDCEP, Amoxicillin: 3–5 dni, kontrola najlepiej po 3 dniach, wskazanie i ograniczenia. Tabela dzieci zaczyna się od 6 miesięcy.
   https://www.sdcepdentalprescribing.nhs.scot/guidance/bacterial-infections/dental-abscess/first-line-antibiotics/amoxicillin/
2. SDCEP, Bacterial infections review tool: termin i cel kontroli, ocena odpowiedzi oraz indywidualna decyzja o zakończeniu/przedłużeniu albo eskalacji.
   https://www.sdcepdentalprescribing.nhs.scot/guidance/supporting-tools/bacterial-infections-review-tool/
3. Polska ChPL Ospamox, RPL 22744, §4.2: czas zależny od zakażenia i reakcji pacjenta, możliwie krótki. Brak ogólnego przedziału 3–5 dni dla ropnia w tej ChPL. Odczytano tekst PDF; próba zrzutu strony przez narzędzie web zakończyła się błędem cache.
   https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/22744/characteristic

## Historyczna weryfikacja i przygotowanie wersji z 16.11.2026

Poniższe wyniki i wersja cache opisują pierwotne prace. Nie są bieżącym raportem testów po dodaniu oceny zgodności dawkowania.

565 testów Node.js, w tym 31 nowych testów czasu. 60 sprawdzeń interfejsu w lokalnym Chromium: wybór kliknięciem/klawiaturą, ręcznie wpisany czas, zachowanie koloru i fokusu, neutralny tryb ręczny, zakres wieku/masy/nerek, poprawne pochodzenie źródeł, potwierdzanie, oba motywy i szerokości 320/360/390/768/1280 px. Brak błędów JavaScript i poziomego przepełnienia. Sprawdzono też, że cztery obrazy podglądu nie są pustymi przechwyceniami.

Przeglądarka nie miała dostępu HTTP nawet do localhost. Testy uruchamiają oryginalne moduły i CSS bez sieci; importy mają URL blob, ikony data URL, a pomocniczy hook ustawia początek scenariusza wyłącznie w kopii testowej. Przyciski i pola są obsługiwane rzeczywistymi zdarzeniami. Produkcyjny CSP pozostał bez zmian. Nie wykonano testu rzeczywistego iOS/Safari, produkcyjnego CSP, sieci ani service workera. To testy techniczne, nie walidacja kliniczna.

Baza tamtych prac: f98550f1a1f2b0348047c5889e4304259e4e478d. Przygotowana wówczas wersja cache: 2026-11-16.58. Pliki runtime były identyczne w rxcalc/ i public/rxcalc/. Ówczesny zapis dotyczył poprawki przygotowanej lokalnie; nie potwierdza publikacji bieżącej wersji.
