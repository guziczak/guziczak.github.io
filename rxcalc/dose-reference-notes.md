# Punkty odniesienia A/B — 14.11.2026

## Zakres

Druga, wyłącznie informacyjna warstwa dla ręcznego przeliczenia Augmentin 400/57 mg/5 ml w profilu dla ludzi. Pojawia się, gdy nie ma wybranego schematu ani przypisanego limitu: w grupie dorosłych oraz dzieci z podaną masą co najmniej 40 kg. Nie rozszerza katalogu schematów, nie wybiera wskazania, nie ustala dawki i nie zmienia walidacji ani eksportu. Nie obejmuje innych proporcji, postaci, produktów ani weterynarii.

## Źródła i wartości

Polska ChPL Augmentin 875 mg + 125 mg, RPL 7496, §4.2, s. 2, sprawdzona 2026-11-14:
https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/7496/characteristic

- A: schemat standardowy tabletek, 875/125 mg dwa razy na dobę: 1750 mg amoksycyliny + 250 mg kwasu klawulanowego na dobę.
- B: większy schemat tabletek, 875/125 mg trzy razy na dobę: 2625 mg + 375 mg na dobę. ChPL wymienia go szczególnie dla zakażeń ucha, zatok, dolnych dróg oddechowych i dróg moczowych.
- Są to pary dawek dobowych konkretnych schematów tabletek, NIE niezależne maksima substancji ani limity zawiesiny.

Polska ChPL wybranej zawiesiny, RPL 8695, §2 i 4.2, sprawdzona 2026-11-14:
https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/8695/characteristic

Zawiera 80 mg amoksycyliny i 11,4 mg klawulanianu na ml. Nie podaje analogicznego liczbowego schematu dla dorosłych. Progi pediatryczne 2800/400 mg nie zostały przeniesione do dorosłych. Odniesienia nie są zaleceniem zamiany postaci. Do ich prezentacji nie jest potrzebne uznanie preparatów za równoważne.

## Zachowanie

Paski pokazują aktualne ilości po zaokrągleniu objętości. Ich wartości referencyjne pozostają literalnymi wartościami tabletek; nie są przeliczane proporcją zawiesiny. A/B są przerywane, w odróżnieniu od ciągłej granicy zastosowanego schematu. Powyżej B widoczny jest bursztynowy komunikat porównawczy, nie deklaracja toksyczności ani automatyczna blokada. Skala kończy się na 125% B, a nadmiar jest widoczny jako strzałka i nieobcięty procent liczbowy.

Przy niepodanej masie w jawnie wybranej grupie dorosłych dostępne jest arytmetyczne porównanie z komunikatem o niepotwierdzonym zakresie ≥40 kg. Nie oznacza to kwalifikacji pacjenta. Znana masa <40 kg, nieprawidłowe dane i podane problemy nerkowe wyłączają wypełnienie oraz procenty, pozostawiając opis wartości źródłowych. Przy CrCl ≤30 ml/min porównanie jest wstrzymywane do oceny; wartość 30 to zachowawcza zasada interfejsu zgodna z istniejącą aplikacją, nie nowa granica przeciwwskazania z ChPL. Źródło mówi o niezalecaniu postaci 7:1 poniżej 30 ml/min.

Jawny limit ręczny lub wybrany schemat zachowuje dotychczasowe działanie i pierwszeństwo. Przełączenie na dziecko bez masy ≥40 kg usuwa odniesienia dorosłych. Brak czasu kuracji nie blokuje podglądu, ale nadal blokuje niekompletny wynik do kopiowania.

## Weryfikacja

13 nowych testów, łącznie 363 testy Node: bez błędów. Sprawdzono formularz w Chromium, z oryginalnymi modułami ładowanymi z pamięci w lokalnym harnessie bez sieci: przypadki 500/1300/2000 mg × 2, pusty czas, zmiany masy, limit ręczny, przełączenie na schemat dziecka, jasny/ciemny motyw, szerokości 320/360/390/768/1280 px oraz brak błędów JavaScript. Harness nie testuje nawigacji sieciowej, rzeczywistego iOS/Safari ani działania service workera. Pliki wymagane do pracy offline sprawdzono statycznie oraz kompilacją; cache zwiększony do 2026-11-14.46. Testy programu i przegląd źródeł nie stanowią walidacji klinicznej.
