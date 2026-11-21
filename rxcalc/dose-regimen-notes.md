# Zakres schematu i osobna kreska limitu — aktualizacja 2026-11-21

Warstwa prezentacji porównuje bieżącą dawkę dobową z jawnym zakresem lub stałą dawką wybranego schematu liczbowego. Obejmuje dostępne liczbowe postaci dla ludzi i zwierząt; weterynaryjne pasma masy rozstrzyga istniejący resolver. Nie zmienia katalogu, progów klinicznych, podzielności, edycji, przeliczeń silnika ani kontroli kopiowania. Nie wybiera dawki i nie przenosi wyższych zakresów z innego wskazania.

- Przerywane kreski i delikatnie wyróżniony przedział pokazują oba końce zakresu. Stała dawka źródłowa ma jedną kreskę. Nie są to progi toksyczności ani cel do wypełnienia paska.
- Osobna ciągła kreska pojawia się tylko dla dodatkowego limitu dostępnego w danych tego samego schematu/preparatu lub limitu ręcznego. Gdy limit źródłowy jest identyczny z końcem zakresu, nie powstaje fikcyjne drugie maksimum. Jawny limit ręczny o tej samej wartości jest opisany jako pokrywający się z granicą. Brak masy uniemożliwia umieszczenie absolutnego limitu na osi mg/kg, ale jego wartość pozostaje widoczna tekstowo.
- Niższy limit ręczny nie przesuwa źródłowego przedziału. Przekroczenie zakresu jest opisane jako odstępstwo od schematu; przekroczenie dodatkowego limitu jest oznaczone odrębnie. Żaden kolor nie stanowi oceny bezpieczeństwa.
- W trybach zależnych od masy oś używa ilości na kg/dobę; równolegle widoczne są wartości bezwzględne na dobę. W lekach złożonych zakres składnika towarzyszącego jest przeliczany z pełnej proporcji preparatu, nie z zaokrąglonej wartości wyświetlanej. Nie jest niezależnym maksimum tej substancji.
- Nadpisanie częstości nie przesuwa oryginalnego schematu ze stałą częstością. Dla źródła z listą częstości potrzebny jest jawny wybór jednej dozwolonej opcji. W stosowaniu doraźnym nie przedstawia się obowiązkowej dawki minimalnej; górny zakres uwzględnia zapisany limit dobowy.
- Brak dawki lub częstości nie jest zerem. Brak wartości wymaganej do wyliczenia ilości nie tworzy wypełnienia. Jeżeli obie porównywane ilości są znane, niekompletna kwalifikacja pacjenta w profilu dla ludzi pozostawia neutralny pasek i rzeczywisty procent, a osobny status wskazuje brakujące dane. Źródłowe liczby nie są zmieniane w celu pokazania grafiki. Czas kuracji nie jest potrzebny do podglądu. Porównawcze A/B dla ręcznej zawiesiny u dorosłego i bramki schematów weterynaryjnych pozostają bez zmian w aktualizacji z 2026-11-21.

## Oddzielna prezentacja liczb i kwalifikacji — 2026-11-21

`regimenDosePercentMarkup` i `regimenMeterMarkup` przyjmują opcjonalny piąty argument `{neutral:true}`. Zmienia on ton i opis prezentacji, bez zmiany `regimenMeterModel`, `regimenPercentModel` ani dotychczasowego znaczenia parametru `allowed`. `dailyDoseMarkup` jawnie rozdziela dostępność obliczenia od wyniku kwalifikacji pacjenta. Legenda również przyjmuje opcję neutralną.

Przykładowe 100% apiksabanu przed podaniem CrCl oznacza wyłącznie relację 10 mg/dobę do źródłowych 10 mg/dobę. Nie dopisuje osobnego `maxDailyMg`, nie potwierdza wskazania ani prawidłowego wariantu nerkowego. Komunikat o zgodności ilości jest zastąpiony neutralnym opisem liczbowym. Przekroczenie źródłowej wartości i odrębnego limitu pozostaje rozróżnione, także gdy warunki pacjenta są niekompletne. [Stan danych i panel nerkowy](renal-function-notes.md).

Współrzędne i klucze elementów nie zależą od neutralnego tonu ani stanu potwierdzenia. Wypełnienie, pasmo, granice i etykiety zachowują wspólny przebieg 240 ms. Uzupełnienie danych podczas ruchu zaczyna następny przebieg od widocznej pozycji, a nie od zera lub poprzedniej wartości docelowej. `prefers-reduced-motion` pozostaje respektowane.

Przypadek regresyjny ze zrzutu: 35 kg, źródłowe 25–45 mg amoksycyliny/kg/dobę w 2 podaniach: zakres dobowy 875–1575 mg. 45 jest w zakresie i na górnej granicy. Z proporcji 400:57 wynika 3,5625–6,4125 mg kwasu klawulanowego/kg/dobę. To arytmetyka do testu, nie zalecenie leczenia.

Źródło rozróżnienia i proporcji: polska ChPL Augmentin (400 mg + 57 mg)/5 ml, RPL 8695, §§2 i 4.2, s. 1–2; ponownie odczytano 15.11.2026:
https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/8695/characteristic

Weryfikacja historyczna z 15.11.2026: 436 testów Node.js, w tym 19 nowych testów zakresów; 58 sprawdzeń w lokalnym Chromium (moduły JS i CSS z lokalnych plików, bez sieci). Sprawdzono realny edytor dawki, źródła, ręczny limit, oba składniki, niekompletne dane, brak automatycznej zmiany progów, potwierdzanie/kopiowanie, A/B, dwa motywy oraz szerokości 320/360/390/768/1280 px. Ten przegląd nie obejmował produkcyjnej sieci, rzeczywistego iOS/Safari ani aktualizacji service workera. Ówczesny cache: 2026-11-15.51.

Aktualizacja z 2026-11-21 dodaje regresje neutralnego procentu przy niekompletnej kwalifikacji, znanego przekroczenia, pojedynczego komunikatu o danych oraz zmiany statusu w trakcie animacji. Sprawdzane są rzeczywiste dane apiksabanu i osobne zachowanie brakującej dawki/mianownika. Testy techniczne nie są walidacją kliniczną.
