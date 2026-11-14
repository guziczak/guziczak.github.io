# Kafelki zawiesin i jawne wartości startowe — 14.11.2026

## Interfejs

Doustne zawiesiny dla ludzi otrzymały kafelki 2,5 / 5 / 10 ml na jedno podanie. Znane stężenie określa podpis w mg składnika głównego. W trybie ml wpisywana jest objętość; w mg — masa substancji; w mg/kg/podanie lub mg/kg/dobę stosowane są rzeczywista masa i wybrana częstość. Brak wymaganych danych wyłącza kafelek. Dla postaci bez stężenia w mg (np. nystatyna) skrót działa wyłącznie objętościowo, bez zmyślonego mg.

Kafelki są skrótami arytmetycznymi, nie rekomendacjami dawki. Nie ustawiają częstości ani dni. Sprawdzają znane limity jednorazowe/dobowe/na kg, zakres schematu, granice objętości, zgodność zaokrąglenia i kwalifikację pacjenta. Nie resetują zmian ręcznych. Kliknięcie unieważnia potwierdzenie. Weterynaria, instrukcje i karty zablokowane pozostają bez zmian.

Przy zawiesinach można osobno wybrać „Uzupełnij ze schematu”. Istniejące schematy Ospamox i pediatryczny Augmentin są pokazane jako jawne wybory. Schematy zakresowe nie wybierają automatycznie minimum ani maksimum. Pola ręczne pozostają dostępne bez wybrania schematu. Wybranie kafelka źródła zachowuje już wpisany czas, niższy limit ręczny i dodatkowe zalecenia; nie dopisuje czasu leczenia.

## Dodatkowy wariant dla Augmentin 400/57 u dorosłego

Dodano jeden opcjonalny wariant: 875 mg amoksycyliny co 12 h, wyłącznie dorosły ≥40 kg z trudnością połknięcia tabletki i potwierdzonym wskazaniem. Wariant jest jawnym ZESTAWIENIEM dwóch dokumentów, nie gotowym schematem polskiej ChPL zawiesiny i nie uniwersalną dawką dla każdego dorosłego:

- Polska ChPL Augmentin 875/125 (tabletki), RPL 7496, §4.1–4.2: wskazanie ciężkiego ropnia okołozębowego z szerzącym się zapaleniem tkanki łącznej, standardowa dawka tabletki 875/125 dwa razy/dobę dla ≥40 kg.
  https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/7496/characteristic
- FDA AUGMENTIN, rewizja 07/2026, §2.2 i §2.8, tabela 6: u osób niemogących połknąć tabletki 875/125 właściwą mocą do zamiany jest zawiesina 400/57 (lub 200/28,5). Źródło zagraniczne nie jest traktowane jako polska rejestracja schematu stomatologicznego.
  https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/050785s022lbl.pdf
- Polska ChPL zawiesiny, RPL 8695, §2 i §4.2: 80 mg amoksycyliny + 11,4 mg kwasu klawulanowego/ml. Nie podaje analogicznego liczbowego schematu dorosłych.
  https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/8695/characteristic

Źródła sprawdzono 14.11.2026. Opracowanie tego wariantu wymaga niezależnego przeglądu klinicznego. Źródło FDA odczytano tekstowo; próby renderowania stron tabeli przez narzędzie przeglądarkowe zwracały błąd pobierania. Powiązanie mocy potwierdza też urzędowa etykieta DailyMed amoxicillin/clavulanate, tabela 6 (setid 46921419-9fae-4f51-b1b2-dc2e1ab04e8e).

Wybór wariantu nie wpisuje masy ani czasu. Kwalifikacja nadal wymaga rzeczywistej masy ≥40 kg. Zachowano sprawdzanie danych nerkowych i istniejącą zachowawczą granicę aplikacji CrCl ≤30 (ChPL nie zaleca postaci 7:1 poniżej 30). Przeliczenie dokładne: 875 mg → 10,9375 ml i 124,6875 mg kwasu klawulanowego na podanie, nie 125 mg. Brak automatycznego zaokrąglenia; możliwość odmierzenia sprawdza lekarz. Pozostały wszystkie dotychczasowe warunki eksportu, limity i jawne potwierdzenie. Nie dodano wariantu 3 razy/dobę. Katalog klindamycyny nie został zmieniony.

## Weryfikacja

411 testów Node.js (23 nowe) bez błędów; budowa poprawna. 60 sprawdzeń w lokalnym Chromium: rzeczywiste wybieranie produktu, kafelki, bęben, anulowanie, ręczne nadpisanie, przywrócenie, dawki obu składników, limity, nerki, zakres pediatryczny, potwierdzenie/kopiowanie oraz szerokości 320/360/390/768/1280 px i oba motywy.

Test interfejsu używa modułów lokalnych z adresami importów zamienionymi na blob/importmap, CSS i SVG w pamięci, bez sieci. Nie testuje rzeczywistego iOS/Safari, sieci produkcyjnej ani cyklu instalacji service workera. Pliki offline sprawdzono statycznie; cache 2026-11-14.49. Testy kodu nie stanowią walidacji klinicznej.
