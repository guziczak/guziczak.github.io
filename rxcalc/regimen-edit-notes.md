# Bezpośrednia edycja schematu — 14.11.2026

Dawka i częstotliwość w liczbowych schematach źródłowych dla ludzi są edytowalne w tym samym formularzu. Wybór źródła jednorazowo wstawia jego stałe wartości. Kolejne przeliczenia nie zastępują wpisanych danych, również po wyczyszczeniu pola. Bęben, ręczne wpisywanie i anulowanie wersji roboczej zachowują dotychczasową semantykę.

Odstępstwo od stałej wartości lub dostępnego zakresu jest oznaczane „Zmodyfikowany przez użytkownika”. Wybór liczby wewnątrz dopuszczonego zakresu nie jest odstępstwem. Widoczne są niezmienione wartości źródłowe i „Przywróć wartości ze źródła”. Przywrócenie dotyczy dawki i częstotliwości, bez kasowania pacjenta, czasu, niższego limitu ręcznego ani dodatkowych zaleceń. Pola zakresowe wracają do stanu początkowego (z dotychczasowym skrótem jednej tabletki, jeżeli jest dozwolony).

Nadpisanie pola NIE znosi ograniczeń: zachowano granice jednorazowe, dobowe, na kg, zakresy i opcje źródłowe, minimalne odstępy, warunki wieku/masy/nerek/czasu oraz podzielność dokładnej postaci. Nie zmieniono katalogu, progów klinicznych ani źródeł. Przekroczenie pozostaje wpisane i widoczne w podglądzie arytmetycznym oraz paskach, lecz nie uprawnia do kopiowania niezgodnego schematu. Pacjent poza zakresem nadal nie otrzymuje procentowej oceny względem tego schematu.

Każda zatwierdzona edycja i każde przywrócenie unieważnia wcześniejsze potwierdzenie. Zmieniony, kompletny schemat bez wykrytych blokad wymaga ponownego jawnego potwierdzenia przez lekarza; jego odstępstwo jest ostrzeżeniem, nie deklaracją zgodności z niezmienioną ChPL. Kopiowany tekst używa aktualnych liczb. Nie dołącza automatycznie oryginalnego opisu podania, który mógłby zawierać starą częstość; pozostaje on widoczny w „Źródło i zakres schematu”. Strukturalne ograniczenia doraźne, minimalny odstęp i niższy limit dobowy są zachowane. Dodatkowe zalecenia ustala lekarz.

Instrukcje opisowe, karty referencyjne i źródłowe schematy weterynaryjne nie zostały zmienione. Wartości pacjenta nadal nie są zapisywane ani wysyłane. Cache: `2026-11-14.47`.

## Testy

- 376 testów Node.js przechodzi, w tym 13 nowych testów edycji, zgodności limitów, pustych danych, przywracania i eksportu.
- 46 sprawdzeń formularza w lokalnym Chromium: rzeczywisty bęben i jego klawiatura, wpisanie/anulowanie/zatwierdzenie, widoczna lista częstości, zachowanie wartości, oba składniki, przekroczenie, blokada kopiowania i ponowne potwierdzenie, nerki, reset pacjenta, jasny/ciemny motyw i szerokości 320/360/390/768/1280 px.
- Test UI uruchamia dokładne moduły w lokalnym harnessie bez sieci (pliki CSS i SVG także lokalne). Nie jest testem rzeczywistego iOS/Safari, sieci produkcyjnej ani działania service workera.
- Budowa i komplet plików offline są sprawdzane statycznie. Testy programu nie są walidacją kliniczną.
