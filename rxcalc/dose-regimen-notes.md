# Zakres schematu i osobna kreska limitu — 15.11.2026

Warstwa prezentacji porównuje bieżącą dawkę dobową z jawnym zakresem lub stałą dawką wybranego schematu liczbowego dla ludzi. Nie zmienia katalogu, progów klinicznych, podzielności, edycji, przeliczeń silnika ani kontroli kopiowania. Nie wybiera dawki i nie przenosi wyższych zakresów z innego wskazania.

- Przerywane kreski i delikatnie wyróżniony przedział pokazują oba końce zakresu. Stała dawka źródłowa ma jedną kreskę. Nie są to progi toksyczności ani cel do wypełnienia paska.
- Osobna ciągła kreska pojawia się tylko dla dodatkowego limitu dostępnego w danych tego samego schematu/preparatu lub limitu ręcznego. Gdy limit źródłowy jest identyczny z końcem zakresu, nie powstaje fikcyjne drugie maksimum. Jawny limit ręczny o tej samej wartości jest opisany jako pokrywający się z granicą. Brak masy uniemożliwia umieszczenie absolutnego limitu na osi mg/kg, ale jego wartość pozostaje widoczna tekstowo.
- Niższy limit ręczny nie przesuwa źródłowego przedziału. Przekroczenie zakresu jest opisane jako odstępstwo od schematu; przekroczenie dodatkowego limitu jest oznaczone odrębnie. Żaden kolor nie stanowi oceny bezpieczeństwa.
- W trybach zależnych od masy oś używa ilości na kg/dobę; równolegle widoczne są wartości bezwzględne na dobę. W lekach złożonych zakres składnika towarzyszącego jest przeliczany z pełnej proporcji preparatu, nie z zaokrąglonej wartości wyświetlanej. Nie jest niezależnym maksimum tej substancji.
- Nadpisanie częstości nie przesuwa oryginalnego schematu ze stałą częstością. Dla źródła z listą częstości potrzebny jest jawny wybór jednej dozwolonej opcji. W stosowaniu doraźnym nie przedstawia się obowiązkowej dawki minimalnej; górny zakres uwzględnia zapisany limit dobowy.
- Brak dawki lub częstości nie jest zerem. Brak danych wymaganych do oceny pacjenta wyłącza wypełnienie i kreski porównania; opis źródłowego zakresu pozostaje widoczny. Czas kuracji nie jest potrzebny do podglądu. Porównawcze A/B dla ręcznej zawiesiny u dorosłego i schematy weterynaryjne pozostają bez zmian.

Przypadek regresyjny ze zrzutu: 35 kg, źródłowe 25–45 mg amoksycyliny/kg/dobę w 2 podaniach: zakres dobowy 875–1575 mg. 45 jest w zakresie i na górnej granicy. Z proporcji 400:57 wynika 3,5625–6,4125 mg kwasu klawulanowego/kg/dobę. To arytmetyka do testu, nie zalecenie leczenia.

Źródło rozróżnienia i proporcji: polska ChPL Augmentin (400 mg + 57 mg)/5 ml, RPL 8695, §§2 i 4.2, s. 1–2; ponownie odczytano 15.11.2026:
https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/8695/characteristic

Weryfikacja: 436 testów Node.js, w tym 19 nowych testów zakresów; 58 sprawdzeń w lokalnym Chromium (moduły JS i CSS z lokalnych plików, bez sieci). Sprawdzono realny edytor dawki, źródła, ręczny limit, oba składniki, niekompletne dane, brak automatycznej zmiany progów, potwierdzanie/kopiowanie, A/B, dwa motywy oraz szerokości 320/360/390/768/1280 px. Nie testowano produkcyjnej sieci, rzeczywistego iOS/Safari ani aktualizacji service workera. Testy techniczne nie są walidacją kliniczną. Cache: 2026-11-15.51.
