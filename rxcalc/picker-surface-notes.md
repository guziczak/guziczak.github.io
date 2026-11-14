# Nieblokujący edytor pól — 14.11.2026

Edytory dawki, wieku, masy i ręcznie wpisanego CrCl używają teraz nieblokującego `dialog.show()`, zamiast `showModal()`. Nie rozmywają ani nie przyciemniają strony i nie ustawiają blokady przewijania dokumentu. Na komputerze panel zachowuje położenie na ekranie podczas przewijania; na telefonie pozostaje przy dolnej krawędzi widocznego obszaru.

Przewijanie myszą lub gestem poza panelem nie zamyka go i nie zapisuje szkicu. Bęben przewija się niezależnie. Zapis nadal następuje tylko po „Gotowe” albo Enter w polu/bębnie. „Anuluj”, Escape, ponowne kliknięcie wywołującego pola, kliknięcie poza panelem lub przejście fokusu do innego pola odrzuca szkic. Gest przeciągania nie jest traktowany jak kliknięcie poza panelem. Nie ma pułapki fokusu. Słuchacze zdarzeń są usuwane przy zamknięciu.

Nie zmieniono przeliczeń, dawek, progów klinicznych, schematów ani kontroli kopiowania. Inne okna aplikacji zachowują dotychczasowe działanie. Zaktualizowano obie kopie plików wykonawczych i cache do `2026-11-14.48`.

## Weryfikacja

- 388 testów Node.js przechodzi (12 nowych testów zachowania edytora); budowa statyczna zakończona poprawnie.
- 53 sprawdzenia w lokalnym Chromium: brak modalności, rozmycia, blokady przewijania i inert; przewijanie tła myszą i sekwencją dotykową; zachowanie szkicu; zatwierdzanie, anulowanie, Escape, Tab, kolejny edytor, ponowne otwieranie, działający bęben, brak błędów JavaScript, szerokości 320/390/768/1280/1440 px.
- Moduły i zasoby uruchomiono z lokalnych plików w harnessie bez sieci (zmienione są tylko adresy importów i obrazów). Nie jest to test sieci produkcyjnej, service workera ani rzeczywistego Safari/iOS. Testy programu nie są walidacją kliniczną.

Podstawa techniczna: https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/show — nieblokujące okno bez unieruchamiania reszty dokumentu.
