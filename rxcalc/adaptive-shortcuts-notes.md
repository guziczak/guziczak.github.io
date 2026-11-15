# Adaptacyjne skróty zawiesin — 15.11.2026

Wspólna implementacja dla wszystkich obsługiwanych zawiesin doustnych dla ludzi. Nie zmienia katalogu, źródeł, dawkowania, limitów, kontroli nerek/wieku/masy, arytmetyki ani warunków kopiowania. Tabletki, kapsułki, iniekcje, pozostałe drogi i weterynaria zachowują dotychczasową obsługę; nie przenoszono reguł objętości zawiesin na te postaci.

## Dobór i edycja

- Bez wybranego schematu pozostają neutralne skróty objętości. Nie wyznacza się schematu na podstawie wpisanej dawki.
- Przy stałej dawce skróty obejmują wartość ze źródła i jej sąsiadów. Przykład obliczeniowy 875 mg przy 80 mg/ml, bez zaokrąglania: 10 / 10,9375 / 12,5 ml. Obie nowe wartości są większe od poprzedniego największego skrótu 10 ml. Kolory nadal wynikają z dotychczasowej kontroli, nie z miejsca kafelka.
- Przy zakresie dostępne są jego końce i wartość pośrednia (nie jest automatycznie wybierana ani określana jako optymalna). Jeżeli wszystkie dawne objętości były za małe, zachowywany jest użyteczny niższy sąsiad oraz dwie wartości w zakresie. Nie jest wymuszane zachowanie dalekiej, nieprzydatnej objętości.
- Dawkowanie na kg ma główne etykiety w jednostce schematu i dodatkową objętość na podanie. Przykład 25–45 mg/kg/dobę, 35 kg, 2 podania: 25 / 35 / 45 z odpowiednimi objętościami 5,46875 / 7,65625 / 9,84375 ml. To przypadek testowy, nie zalecenie.
- Jeżeli użytkownik jawnie określił krok zaokrąglenia, kafelki korzystają z jego siatki. Krok obliczeniowy NIE potwierdza podziałki urządzenia ani tolerancji klinicznej. Przy 875 mg i kroku 0,1 ml skróty 10 / 10,9 / 11 ml zachowują ostrzeżenia i rzeczywiste ilości 800 / 872 / 880 mg. Nie dodano domyślnej tolerancji procentowej.
- Bez kroku zachowano dokładne przeliczenia. Znak ≈ przy skróconej prezentacji nie zmienia liczby zapisywanej przez kafelek. Widoczny komunikat wymaga sprawdzenia możliwości odmierzenia.
- Mniejsze / Większe przegląda sąsiednie liczbowe skróty. Wg schematu przywraca zestaw, nie dawkę. Przeglądanie nie wysyła zdarzeń edycji, nie zmienia potwierdzenia, częstości, czasu ani limitów. Kliknięcie kafelka nadal jest zwykłą edycją z dotychczasową walidacją i unieważnieniem potwierdzenia.
- Okno skrótów nie jest kotwiczone w wybranej dawce. Wpisanie lub kliknięcie większej wartości nie proponuje automatycznie jeszcze większych. Zmiany preparatu, stężenia, źródła, masy, częstości, kroku i warunków porównania resetują przeglądanie. Przywrócenie źródła i nowy pacjent też resetują okno. Stan jest wyłącznie w pamięci; nie jest zapisywany ani wysyłany.

## Kontrola

494 testy Node.js przechodzą, w tym 27 nowych testów adaptacji. Dotychczasowe testy konkretnych 2,5 / 5 / 10 ml jawnie wybierają wariant statyczny, by nadal sprawdzać te same przeliczenia i ostrzeżenia. 53 sprawdzenia lokalnego Chromium obejmują rzeczywiste selektory, edytory, oba motywy, szerokości 320–1280 px, nawigację klawiaturą, przejście do 20 ml, niezmienione źródła, wybór 45 mg/kg/dobę, niekompletne dane i blokady eksportu. Brak błędów JavaScript oraz poziomego przepełnienia.

Test przeglądarki używa oryginalnych modułów i CSS w lokalnym środowisku bez sieci; importy i ikony mają lokalne adresy blob/data. Nie testowano produkcyjnej sieci, rzeczywistego iOS/Safari ani aktualizacji service workera. Testy techniczne nie są walidacją kliniczną. Nie wprowadzono nowych zaleceń medycznych ani nie zweryfikowano ponownie źródeł katalogu. Cache: 2026-11-15.54.
