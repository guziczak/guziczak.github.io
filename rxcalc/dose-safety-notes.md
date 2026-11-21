# Wskaźniki dawek dobowych — aktualizacja 2026-11-21

Wskaźniki porównują ilości z jednego preparatu do granicy jawnie wybranego schematu, dostępnego limitu katalogowego albo niższego limitu lekarza. Nie wyznaczają dawki docelowej ani nie potwierdzają bezpieczeństwa. Nie sumują innych leków.

- Osobny wiersz dla każdej substancji lub rzeczywistej jednostki preparatu. Obsługiwane są liczbowe postaci ujęte w `supportsDailyDose`, także weterynaryjne. Instrukcje bez liczbowej porcji, karty referencyjne, koncentraty z blokadą i osobny tryb pojedynczego podania nie otrzymują fikcyjnej dawki dobowej. Obliczenia nie wymagają czasu kuracji.
- Wykres samego limitu ma skalę 0–125%, kreskę przy 100% i osobny segment przekroczenia. Wykres dawki lub zakresu schematu zachowuje źródłowy punkt 100%; dodatkowy limit może poszerzyć skalę i nie zastępuje tego mianownika. Pełny procent pozostaje podany liczbowo, także poza końcem paska.
- Brak dawki, częstości albo danych niezbędnych do arytmetyki nie jest zerem. Bez znanego punktu odniesienia nie powstaje procent ani wypełnienie; widoczne znane ilości pozostają dostępne. Sam brak odrębnego maksimum nie usuwa porównania do istniejącej dawki źródłowej.
- Ilość składnika towarzyszącego przy granicy składnika głównego jest proporcjonalnym przeliczeniem, nie niezależnym maksimum. Dla 400:57 zachowano pełną proporcję, bez progu utworzonego z zaokrąglonego 6,4.
- Progi kliniczne i katalog nie zostały zmienione. Nie dodano uniwersalnego limitu 375/400 mg klawulanianu ani limitu pediatrycznego dla dorosłych.
- Informacja o zaokrągleniu pokazuje objętość przed i po zmianie; paski odnoszą się do ilości po zaokrągleniu.
- Sprawdzenie warunków pacjenta jest odrębne od rzeczywistej dawki: przekroczenie nie wyłącza własnego ostrzeżenia. Wartości użyte tylko do sprawdzenia zakresu źródła nie są zapisywane ani proponowane jako leczenie. Wybór źródła jest jawny.

## Niekompletna kwalifikacja nie usuwa znanej arytmetyki

Dla schematów ludzkich porównanie dwóch znanych ilości pozostaje widoczne, nawet jeśli nie ukończono kwalifikacji pacjenta. Przykład regresyjny dla apiksabanu: wpisane 10 mg/dobę i źródłowe 10 mg/dobę oznaczają **100% w neutralnym kolorze**. Brak CrCl nadal ma status wymagający uzupełnienia, a wynik nie uzyskuje zgody na eksport. Pasek nie używa wtedy komunikatu sugerującego zgodność warunków stosowania. Prawdziwe liczbowe przekroczenie źródła lub osobnego limitu jest nadal wyróżnione i opisane.

`dailyDosePresentationModel` rozdziela `clinicalConfirmed` od możliwości pokazania arytmetyki. `clinicalStatusMarkup` przedstawia jeden zwarty status na podstawie `eligibility.issues` o strukturze `{code, field, kind, message}`. Typy `missing`, `invalid` i `out-of-scope` nie są wnioskowane wyłącznie z brzmienia komunikatu. Powtórzone kontrole tego samego pola są scalane; oryginalne błędy silnika pozostają dostępne dla kwalifikacji i blokady eksportu.

Przycisk `data-action="complete-patient-data"` z opcjonalnym `data-focus-field` prowadzi do rzeczywistego brakującego wejścia. W trybie CG są to dane wzoru lub warunki oszacowania, a nie niepotrzebne drugie pole ręcznego CrCl. Brakująca ocena stabilności i masy jest opisana wspólnie. Błędne dane oraz pacjent poza zakresem mają odrębny, czytelny status. Szczegóły panelu: [renal-function-notes.md](renal-function-notes.md).

W tym rozszerzeniu nie zmieniono rozstrzygania weterynaryjnych pasm masy, gatunku i warunków źródła. Neutralny wykres nie pozwala pożyczyć wartości z innego pasma lub gatunku.

## Ruch bez zmiany znaczenia

Wypełnienie, zakres, znaczniki i etykiety animują wspólną zmianę geometrii przez 240 ms. Przy kolejnej edycji początek ruchu odpowiada temu, co jest aktualnie widoczne. Uzupełnienie CrCl nie resetuje istniejącej geometrii neutralnego porównania, również w trakcie animacji. Zmiana preparatu, źródła lub podstawy pomiaru wyznacza nową tożsamość; ograniczenie animacji w systemie wyłącza ruch. Liczby i statusy są aktualizowane od razu.

Źródło rozróżnienia: polska ChPL Augmentin (400 mg + 57 mg)/5 ml, RPL 8695, sekcje 2 i 4.2; sprawdzono 14.11.2026:
https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/8695/characteristic

Testy obejmują pusty czas, nieznane granice, brak danych, przekroczenia, dokładne proporcje, tabletkę 875/125, niższy limit ręczny, jednostki międzynarodowe i bezpieczeństwo HTML. Regresje z 2026-11-21 dodatkowo sprawdzają 10/10 bez danych nerkowych, identyczną geometrię po ukończeniu kwalifikacji, brak fikcyjnego zera, pojedynczy komunikat oraz rzeczywisty nieukończony tryb CG. Dotychczasowe testy ruchu dla paracetamolu, Ibupromu i Augmentinu pozostają uzupełnione o zmianę kwalifikacji w trakcie animacji. Testy programu nie stanowią walidacji klinicznej.
