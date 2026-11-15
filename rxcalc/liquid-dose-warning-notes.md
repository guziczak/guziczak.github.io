# Kafelki objętości: ostrzeżenia zamiast blokady wyboru — 15.11.2026

Zakres zmiany: wyłącznie skróty objętości zawiesin dla ludzi. `allowed` oznacza możliwość wpisania obliczalnej wartości, nie jej zgodność ze źródłem. Nie zmieniono katalogu, granic klinicznych, dawek, obliczeń, reguł schematów ani warunków eksportu. Kafelki tabletek i schematy weterynaryjne pozostają bez zmian.

- Poniżej dolnej granicy zakresu lub stałej dawki źródłowej: klikalny kafelek w kolorze żółtym/bursztynowym z opisem „Poniżej zakresu schematu” lub „Poniżej dawki ze źródła”.
- Powyżej zakresu, stałej dawki lub dostępnego limitu: klikalny czerwony kafelek z opisem przyczyny. Przekroczony limit ma pierwszeństwo przed jednoczesnym komunikatem o zbyt małej dawce względem zakresu. Wszystkie przyczyny zachowane są w modelu i tytule przycisku.
- Kliknięcie (również Enter/Spacja) wpisuje dokładne przeliczenie w aktualnych jednostkach, zachowuje zaznaczenie oraz ostrzegawczy kolor. Kolor nie jest jedyną informacją: widoczne są opis i symbol ostrzeżenia; wybrana pozycja ma znacznik i `aria-pressed`.
- Edycja od razu aktualizuje dawki obu składników i oznaczenie odstępstwa od źródła. Dotychczasowy handler nadal unieważnia wcześniejsze potwierdzenie. Nie omija sprawdzania przed kopiowaniem; niezgodny wynik pozostaje zablokowany w tym schemacie.
- Brak danych niezbędnych do przeliczenia, nieprawidłowe wartości, niedopasowany preparat/tryb, niepotwierdzone warunki pacjenta, niewłaściwa częstość/odstęp oraz niezgodny krok zaokrąglenia nadal blokują odpowiedni skrót. Nie są zastępowane ostrzeżeniem o dawce.
- Brak kolorowego ostrzeżenia nie potwierdza bezpieczeństwa. Kafelki są skrótami wpisywania, nie rekomendacją leczenia. Nie wybiera się żadna dawka ani czas kuracji automatycznie.

Przypadki regresyjne (arytmetyka testowa, nie zalecenia): zawiesina 400/57 mg w 5 ml, źródłowe 25–45 mg/kg/dobę w 2 podaniach. Przy 39 kg mniejsze kafelki są żółte, 10 ml nie ma ostrzeżenia o zakresie. Przy 35 kg wszystkie trzy pozostają klikalne, ale 10 ml jest czerwone. W obu przypadkach zachowano źródłowy przedział; nie zmieniono 45 na większą wartość. Osobno przetestowano niższy limit ręczny, brak danych, jednostki ml/mg/mg/kg oraz oba składniki.

## Weryfikacja

451 testów Node.js przechodzi (15 nowych testów). Budowa statyczna poprawna, pliki wykonawcze identyczne w `rxcalc/` i `public/rxcalc/`. 66 sprawdzeń w lokalnym Chromium: kliknięcia i klawiatura, zachowanie wybranej wartości/koloru/fokusu, podgląd bez czasu, niezmienione progi, blokowanie niezgodnego eksportu, cofnięcie potwierdzenia, przywracanie źródła, brak masy i znane problemy nerkowe, motywy jasny/ciemny, szerokości 320/360/390/768/1280 px. Nie wykryto błędów JavaScript.

Interfejs uruchomiono w lokalnym harnessie bez sieci, z modułami i CSS z plików (zmienione wyłącznie adresy importów/ikon). Nie testowano rzeczywistego iOS/Safari ani produkcyjnej sieci/service workera. Testy programu nie stanowią walidacji klinicznej. Wersja cache: `2026-11-15.52`.

Podstawa techniczna tekstowych oznaczeń towarzyszących kolorom: W3C, Understanding SC 1.4.1 Use of Color, odczytano 15.11.2026:
https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
