# Jawny kafelek 11 ml — 15.11.2026

Zmiana dotyczy wyłącznie skrótu wpisywania dla istniejącego wariantu `dental-augmentin-suspension-adult-substitution`, dorosłego >=40 kg, Augmentinu 400/57 mg/5 ml, dawki źródłowej 875 mg i częstości 2 razy/dobę. Wymagane są potwierdzone przez resolver warunki pacjenta. Nie wprowadzono nowego schematu ani ogólnej tolerancji zaokrąglania.

Przy braku wybranego kroku zaokrąglenia kafelki mają wartości 10 / 11 / 12,5 ml. Środkowy wpisuje rzeczywiste 880 mg amoksycyliny (125,4 mg klawulanianu na podanie), nie zachowuje ukrytych 875 mg. Widoczna różnica wynosi +0,57%. Przy 2 podaniach podgląd pokazuje 1760 mg i 250,8 mg na dobę. Dokładne przeliczenie źródła 10,9375 ml znajduje się w rozwijanym objaśnieniu.

Samo wskazanie schematu nadal uzupełnia 875 mg. Wariant 11 ml wymaga kliknięcia; nie jest automatycznie wybierany ani oznaczany jako równy 875 mg. Przywrócenie źródła wraca do 875 mg i cofa potwierdzenie. Jawny krok 0,1 ml zachowuje ogólne skróty 10 / 10,9 / 11 ml; nie jest nadpisywany szczególną regułą. Dzieci, inne preparaty, inne stężenia/proporcje, schematy ręczne i weterynaria pozostają bez zmian.

Oryginalne limity 875 mg na podanie i 1750 mg/dobę NIE są podnoszone. Kafelek 11 ml pozostaje ostrzegawczo czerwony, a aktualne kontrole uniemożliwiają skopiowanie 880 mg jako zgodnych z niezmienionym wariantem 875 mg. Podanie wartości do analizy nie jest zatwierdzeniem leczenia. Niższy limit lekarza, warunki nerkowe i dane pacjenta nadal są sprawdzane. Nie zmieniono engine.js, human-regimen-engine.js, źródeł katalogowych ani handlerów potwierdzania/eksportu.

## Źródła sprawdzone 15.11.2026

- HSE, Pneumonia in Residential Care Facilities, v2.0 (przegląd 09/2024, plik opublikowany 02/2026), s. 5: zamiana postaci 875/125 mg na 11 ml zawiesiny 400/57 mg/5 ml przy trudnościach połykania; oznaczona off-label. Dokument dotyczy zapalenia płuc w placówkach opieki, nie tworzy polskiego schematu stomatologicznego. Tabela zaokrągla opis klawulanianu do 125 mg; aplikacja liczy rzeczywistą ilość 125,4 mg.
  https://assets.hse.ie/media/documents/Pneumonia_in_residential_care_facilities_guideline.pdf
- Cleveland Clinic, Clinical Rx Forum, September/October 2020, s. 7, Adult CCHS Formulary: zamiana tabletki 875/125 mg na 11 ml zawiesiny 400/57, podane wartości 880/125,4 mg. Jest to historyczny standard instytucjonalny, nie potwierdzenie bieżącej polityki tej placówki.
  https://www.clevelandclinicmeded.com/medicalpubs/pharmacy/September%20October%202020%20Clinical%20Rx%20Forum.pdf
- Polska ChPL Augmentin 400/57 mg/5 ml, RPL 8695, sekcja 2: 80 mg amoksycyliny i 11,4 mg kwasu klawulanowego/ml.
  https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/8695/characteristic

## Weryfikacja techniczna

509 testów Node.js (15 nowych), 59 sprawdzeń formularza w lokalnym Chromium: wybór źródła, rzeczywisty edytor masy, kliknięcie i Enter, ilości obu składników, zachowanie częstości/czasu, cofnięcie potwierdzenia, blokada niezgodnego eksportu, przywracanie źródła, przeglądanie skrótów, zmiana pacjenta, jasny/ciemny motyw i szerokości 320/360/390/768/1280 px. Budowa zakończona pomyślnie. Runtime mirrors są identyczne, a nowy moduł jest uwzględniony w budowie i cache.

Nawigacja HTTP w środowisku testowym była niedostępna. Interfejs uruchomiono bez sieci z dokładnych lokalnych modułów i CSS; wyłącznie adresy importów/ikon zastąpiono blob/data, a CSP pominięto w lokalnej stronie testowej. Nie testowano produkcyjnej sieci, service workera ani rzeczywistego iOS/Safari. Testy techniczne nie są walidacją kliniczną. Cache: `2026-11-15.55`.
