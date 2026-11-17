# Osobne porównanie czasu UCSF — 17.11.2026

Zakres: istniejący źródłowy wariant dziecięcy `dental-augmentin-400-57-child`, zawiesina doustna `augmentin-400-57`. Dane dawkowania w katalogu, silnik zaokrąglania i dotychczasowe ograniczenia pozostają bez zmian. Aktualizacja z 17.11.2026 uzależnia kolor czasu od porównania rzeczywistego dawkowania i zakresu oceny odniesienia; sam zakres dni nie daje zielonego potwierdzenia. Nie przypisano zakresu UCSF innym lekom, dorosłym ani trybowi ręcznemu. Wspólne zasady opisuje [duration-regimen-notes.md](duration-regimen-notes.md).

## Źródło i rozdzielenie danych

Bezpośrednio odczytano stronę UCSF IDMP „Dental Infection”, populacja Pediatric:
https://idmp.ucsf.edu/content/dental-infection

Podaje czas 3–7 dni z indywidualizacją w zakażeniach bardziej powikłanych. Amoksycylina z klawulanianem jest wariantem po niewystarczającej odpowiedzi na leczenie pierwszego wyboru, z konsultacją stomatologiczną. Dawkowanie tego źródła to 22,5 mg amoksycyliny/kg na podanie, maks. 875 mg na podanie, dwa razy na dobę. Nie przeniesiono do aplikacji nowego dawkowania, automatycznego rozpoznania wcześniejszego niepowodzenia leczenia ani kontroli po trzech dniach (ta strona jej nie podaje).

Strona odsyła także do osobnego materiału o dawkach i postaciach:
https://idmp.ucsf.edu/content/maximum-dosing-for-amoxicillin-and-amoxicillin-clavulanate-0

To jest odniesienie do porównania czasu, nie stwierdzenie równoważności postaci, dawki ani wskazania. Dotychczasowy schemat ChPL 25–45 mg/kg/dobę i jego warunki pozostają źródłem dawkowania. W szczególności wpisane 35 nie zmienia się na 45. Dopasowanie rzeczywistej dawki na podanie i częstości do UCSF wpływa teraz zarówno na informację o różnicy, jak i na ocenę koloru. Oba miejsca korzystają z tego samego `durationDosePreview()`, uwzględniającego jawne zaokrąglenie. Zgodność liczbowa nadal nie stanowi kwalifikacji klinicznej. Górna granica wieku <18 lat jest zakresem interfejsu dla tej podpowiedzi, nie liczbą odczytaną z tabeli UCSF.

## Zachowanie

- `rule` nadal opisuje ChPL; osobny obiekt `reference` opisuje UCSF. Zmiana źródła wykryta przez istniejącą sygnaturę wyłącza porównanie. Brak wymaganych danych, warunki nerkowe, niewłaściwy profil, postać lub skład nie uzyskują nowego kolorowania.
- Dla kompletnego przypadku 20 kg, 35 mg/kg/dobę, dwa podania na dobę, 3, 5 i 7 dni mają ostrzeżenie „Wymaga oceny” z przyczyną dotyczącą rozbieżności dawkowania. Po liczbowym dopasowaniu dawki i częstości nadal wymagają oceny warunków UCSF. Formularz nie ustala wcześniejszej niewystarczającej odpowiedzi na leczenie, potrzeby indywidualizacji przy powikłaniach ani dopasowania zagranicznego odniesienia do postaci. Nie dodano pól, które mogłyby zmienić te nieoceniane warunki w zielone potwierdzenie.
- Przy brakującej dawce, częstości lub jednostce porównanie czasu mieszczącego się w zakresie pozostaje neutralne. 10 dni nadal oznacza wyjście poza odniesienie i daje ostrzeżenie; jest to osobna przyczyna, a nie bezwzględny zakaz. Wpis ręczny, przyciski i ostrzeżenia wyniku korzystają z jednej oceny. Czerwone stany istniejących ograniczeń zachowują pierwszeństwo.
- Nazwa UCSF, informacja o zgodności lub różnicy rzeczywistego dawkowania i warunek niewystarczającej odpowiedzi pozostają widoczne. W szczegółach są pełne dawkowanie UCSF i oba źródła. Zgodność sprawdzanych liczb nie jest oznaczana jako zatwierdzone leczenie.
- Warunek ChPL nieprzedłużania ponad 14 dni bez ponownej oceny zachowano niezależnie; jest w szczegółach oraz w widocznym ostrzeżeniu po przekroczeniu progu. Nie traktuje się 14 dni jako zalecanej długości lub terminu oczekiwania na kontrolę.
- Kolory nie wybierają dawki/częstości/dni, nie zaznaczają potwierdzenia i nie odblokowują innych błędów. Zmiana dni nadal cofa końcowe potwierdzenie.

## Historyczna weryfikacja pierwszej wersji porównania UCSF

Poniższy zapis dotyczy wcześniejszej wersji porównującej sam zakres czasu. Zachowano go jako historię prac; liczby testów, opis środowiska i wersja cache nie są raportem z ponownej weryfikacji aktualnej logiki.

676 testów Node.js (22 nowe), budowa statyczna oraz 51 sprawdzeń formularza w lokalnym Chromium. Sprawdzono oba motywy, szerokości 320/360/390/768/1280 px, rzeczywiste edytory masy/wieku/dawki, wpisywanie dni, kolory po zaznaczeniu, źródła, zmianę częstości, końcowe potwierdzenie i niezależny warunek >14 dni. Nie wykryto błędów JavaScript ani poziomego przepełnienia.

Przypadek arytmetyczny ze zrzutu: 20 kg, 35 mg/kg/dobę w 2 podaniach, 5 dni. Wynik: 350 mg i 4,375 ml na podanie, 700 mg amoksycyliny i 99,75 mg klawulanianu na dobę, 43,75 ml na kurację i 2 opakowania po 35 ml. Jawne zaokrąglenie do 0,1 ml daje 4,4 ml, 352 mg na podanie, 704 mg i 100,32 mg na dobę, 44 ml na kurację. To testy rachunków, nie zalecenie dla pacjenta.

Nawigacja HTTP była blokowana przez środowisko. Interfejs uruchomiono bez sieci, z rzeczywistymi modułami i CSS, ze zmianą jedynie adresów importów na lokalne blob/import map oraz ikon na data URL. Testowa strona nie miała produkcyjnego CSP. Nie testowano produkcyjnego połączenia, service workera ani fizycznego iOS/Safari. Potwierdzenie publikacji w GitHub Pages nie zastępuje tych testów. Weryfikacja techniczna nie jest walidacją kliniczną. W tamtej wersji pliki wykonawcze obu katalogów były zgodne; cache `2026-11-17.61`.
