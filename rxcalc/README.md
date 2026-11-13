# RxCalc

Lekki kalkulator dawkowania i zapotrzebowania na preparaty z interfejsem po polsku. Aplikacja działa w przeglądarce i jest przygotowana jako PWA dla Androida oraz innych urządzeń.

Docelowy adres projektu: **https://guziczak.github.io/rxcalc/**. Sam adres w tym pliku nie stanowi potwierdzenia publikacji.

## Zakres pierwszej wersji

- Profile stomatologiczny i kardiologiczny oraz katalog wybranych preparatów z odnośnikami do źródeł.
- Profil weterynaryjny z wymaganym wyborem: pies, kot, koń, chomik lub szczur. Katalog obejmuje Metacam (osobne stężenia dla psa, kota i konia), Cardisure Flavoured, Onsior, Cerenię i informacyjną kartę koncentratu Enrobactin dla chomika/szczura. Dla koni dostępne są również Panacur (pasta i zawiesina), Gastazole, Ventipulmin granulat, Equioxx, Flunivis dożylny, Butagran Equi oraz Paramectin Pasta, Iverpraz, Equimoxin i Pyrantel Vet Planet. Łącznie: 11 marek, 12 postaci i 18 schematów dla konia. Katalog ma filtr drogi podania i pokazuje substancje czynne obok marek. Dokładne postaci są filtrowane według gatunku. Moc, droga podania i opakowanie pochodzą z danych konkretnego produktu. Dla produktów z dodanymi schematami lekarz może jawnie wybrać wskazanie i etap z dokumentacji; aplikacja uzupełnia podstawę dawki i częstość. Nie dobiera rozpoznania ani leczenia. Czas jest pusty poza schematami o stałej długości: pierwszy dzień, podanie jednorazowe, wybrane 3 lub 5 dni i oddzielne etapy po 28 dni. Dostępna jest osobna edycja ręczna; pełna baza przeciwwskazań i interakcji pozostaje poza zakresem. Gatunek i masa są wymagane i nie są zapamiętywane. Zmiana gatunku czyści poprzedni preparat i schemat. Profil specjalizacji pozostaje zapisany.
- Enrobactin jest koncentratem wymagającym przygotowania: karta katalogowa nie oblicza ani nie kopiuje dawki do podania, także w trybie jednostek. Stężenie koncentratu nie trafia do przelicznika. Gotowy roztwór może być opisany odrębnie w formularzu ręcznym.
- Źródła i ograniczenia katalogu weterynaryjnego opisuje [veterinary-catalogue.md](veterinary-catalogue.md). Rejestracja i postać nie oznaczają oceny wskazania, przeciwwskazań ani doboru leczenia.
- Dla zwierząt masa jest zawsze w kilogramach (100 g = 0,1 kg); techniczny zakres wejścia do 2000 kg. Wiek można podać w latach, miesiącach, tygodniach lub dniach. Schemat z progiem wieku wymaga wieku pacjenta; niejednoznaczne przeliczenie przy granicy wymaga jednostki podanej w źródle. Wynik weterynaryjny zawiera gatunek, masę i drogę podania; pozostaje przeliczeniem arytmetycznym wymagającym weryfikacji, nie kompletną receptą weterynaryjną.
- Przeliczenia dawek stałych, dawek zależnych od masy oraz ilości preparatu.
- Obsługa różnych jednostek podania, liczby opakowań i przygotowanie tekstu `D.S.`. Pasty, żele i granulaty doustne są przeliczane na gramy całego preparatu na podstawie mg/g. Dla Gastazole podziałka aplikatora jest kontrolowana bez automatycznego zaokrąglania; wynik pokazuje całe działki oraz pomocniczo przybliżoną masę pasty. Zapas zakłada wykorzystanie pełnych pozostałych działek z kolejnych strzykawek. Dla Ventipulmin kontrolujemy dolną i górną granicę czasu właściwą dla wybranego schematu oraz 21-dniową trwałość otwartego pojemnika.
- Kontrole arytmetyczne i wybrane ograniczenia opisane w danych konkretnego produktu.
- Lokalne obliczenia, responsywny interfejs i obsługa pracy offline po pobraniu aplikacji.

To pierwsza wersja pomocniczego kalkulatora. Katalog oraz zakres kontroli nie zastępują aktualnej ChPL ani pełnej oceny klinicznej. Nie ma certyfikacji wyrobu medycznego, pełnego silnika interakcji, integracji P1 ani automatycznej synchronizacji z RPL. Wynik wymaga weryfikacji przez osobę ordynującą; komunikat o braku przekroczeń odnosi się tylko do wykonanych kontroli. Dobór leku, wskazania, schematu i danych pacjenta pozostaje po stronie użytkownika.

## Android: dodanie do ekranu głównego

1. Otwórz opublikowany adres aplikacji w **Chrome** na Androidzie przy dostępie do internetu.
2. Otwórz menu **⋮** i wybierz **Dodaj do ekranu głównego** lub **Zainstaluj aplikację**. Nazwa opcji zależy od wersji Chrome i urządzenia.
3. Potwierdź instalację. Ikona **RxCalc** pojawi się wśród aplikacji lub na ekranie głównym.
4. Uruchom aplikację z ikony. Przy instalacji PWA będzie korzystać z osobnego okna. Dostępny skrót przeglądarkowy może zamiast tego otwierać kartę Chrome.

Praca offline jest dostępna po udanym zarejestrowaniu service workera i zapisaniu plików aplikacji. Pierwsze uruchomienie, instalacja aktualizacji i otwieranie zewnętrznych ChPL wymagają połączenia. System lub przeglądarka mogą usunąć pamięć witryny, co wymaga ponownego otwarcia online.

## Rozszerzenie stomatologiczne — 13.11.2026

- Katalog: **20 grup, 27 postaci i 47 wariantów z opakowaniem**. Obejmuje leki, wyroby medyczne, kosmetyk oraz wyraźnie oznaczone zagraniczne i historyczne karty referencyjne. Nie jest wykazem bieżących stanów aptek.
- Wpisanie substancji, marki, mocy lub wielkości opakowania pokazuje dokładne warianty. Jeden wybór ustala preparat, moc i opakowanie. Można wyszukać kilka cech jednocześnie, np. `amoksycylina 1000 14`.
- **30 jawnie wybieranych schematów źródłowych:** 18 liczbowych i 12 instrukcyjnych. Wskazanie wybiera lekarz. Stałe wartości są uzupełniane; zakresy pozostają do decyzji lekarza. Nie ustawiamy automatycznie końca zakresu ani czasu antybiotykoterapii.
- Podpowiedzi liczbowe sprawdzają warunki konkretnego schematu: wiek, masę, czas, postać, dawkę i częstość. Dane nerkowe są opcjonalne; brak danych nie wymaga potwierdzenia ani nie wywołuje komunikatu. Wprowadzony CrCl i wskazane zaburzenia są nadal uwzględniane. CrCl nie jest zamieniany z eGFR. Schematy redukcji nerkowej są poza zakresem tego modułu.
- Dobowy limit w mg/kg jest przeliczany na aktualną masę. Granice zakresu antybiotyku są podpisane jako granice wybranego schematu, nie uniwersalne maksimum substancji. Niższy limit lekarza obowiązuje także w kopiowanym tekście.
- Schematy doraźne zachowują słowa „w razie potrzeby”, maksymalną liczbę podań oraz minimalny odstęp. Opakowania oznaczają maksymalne zaplanowane zużycie.
- Żele z porcją opisaną słownie i zabiegi miejscowe mają instrukcje bez zmyślonej dawki w gramach, FTU czy liczby tub. Lekarz może jawnie wpisać liczbę opakowań. Wymagany źródłowo czas stosowania trafia do skopiowanego tekstu.
- Warianty referencyjne nie generują dawkowania. Wyroby i kosmetyk są opisane właściwą kategorią, a ich zapis zaczyna się od „Preparat”, nie od „Rp.”.
- Źródła, dokładny zakres, ograniczenia i przykłady do niezależnego przeglądu opisuje [dental-source-review.md](dental-source-review.md). Testy programu i sprawdzenie źródeł nie stanowią walidacji klinicznej.

## Rozszerzenie praktyki końskiej — 13.11.2026

- Polska ChPL jest podpięta bezpośrednio do każdego z sześciu nowych preparatów i dziewięciu nowych schematów. Wybór wskazania i etapu jest jawny; brak automatycznego rozpoznania lub harmonogramu odrobaczania.
- Flunivis: tylko końska droga dożylna, fiolki wielodawkowe 50/100/250 ml, 28 dni po otwarciu i zachowawczy limit 25 pobrań. Jedno opakowanie to jedna nowa fiolka. Każde podanie pochodzi z jednej fiolki, bez łączenia resztek z różnych fiolek; zbyt mała fiolka wymaga wyboru większej.
- Butagran Equi: fazy dnia 1, dni 2–4 i dalszego wariantu codziennego są liczone osobno. Zapas obejmuje całe jednorazowe saszetki 5 g otwierane do każdego podania. Paramectin również nie przenosi resztki strzykawki na kolejne podanie.
- Butagran, Equimoxin i Pyrantel wymagają potwierdzenia w kontekście pacjenta statusu wykluczenia konia z uboju do spożycia przez ludzi. Brak potwierdzenia blokuje wynik i kopiowanie także po przejściu na ręczne dawkowanie. Status jest wyłącznie w pamięci karty i znika po zmianie gatunku, nowym pacjencie lub przeładowaniu.
- Iverpraz korzysta z literalnej tabeli gramów w ChPL, a wynik pokazuje obie substancje. Niedopasowane podziałki lub luki w tabeli nie powodują automatycznego zaokrąglenia masy.
- To rozszerzenie zakresu, nie ranking sprzedaży ani potwierdzenie najczęstszego stosowania w Polsce. Część wcześniejszych produktów korzysta z jawnie opisanych dokumentów zagranicznych. Testy kodu nie stanowią pełnej walidacji klinicznej.

## Reaktywny przepływ pracy — 13.11.2026

- Specjalizacja jest małym selektorem w pasku kontekstu; gatunek pojawia się tylko w weterynarii. Zapisana specjalizacja i ulubione pozostają między uruchomieniami.
- Ulubione dla bieżącej specjalizacji i gatunku są dostępne bezpośrednio w formularzu. Wyszukiwanie zastępuje skróty wynikami; kategorie i droga podania rozwijają się pod „Filtry”. Katalog nie ma wewnętrznego przewijania.
- Po świadomym wyborze preparatu katalog zwija się do edytowalnego podsumowania. Jedna zgodna postać jest pokazywana bez dodatkowego kliknięcia. Przy kilku wariantach użytkownik jawnie wybiera postać i moc, zanim zobaczy schemat i wynik.
- Schemat źródłowy pokazuje dawkę, częstość i ewentualny stały czas jako informacje. Pełne źródło i dodatkowe ustawienia są rozwijane, a screening, kalibracja oraz bieżące blokady pozostają widoczne.
- `workflow.js` wyznacza widoczność pól, bez zmiany walidacji klinicznej. Masa zwierzęcia pozostaje zawsze dostępna. Wiek, warunkowe limity masy oraz paszport konia pojawiają się zgodnie z wymaganiami postaci i schematu; już wpisane wartości zawsze można poprawić. Wykluczenie konia pozostaje wymagane także w trybie ręcznym.
- Wynik obejmuje podsumowanie kontekstu przed jawnym potwierdzeniem i kopiowaniem. Zmiana danych unieważnia potwierdzenie. Brak świadomego wyboru preparatu lub wariantu czyści poprzedni wynik oraz tekst do skopiowania.
- Mobilny pasek udostępnia podsumowanie i kopiowanie, uwzględnia safe-area i ukrywa się podczas wpisywania. Pola tekstowe aktualizują wynik bez przebudowy formularza i utraty fokusu.
- „Nowy pacjent” i przeładowanie usuwają dane kliniczne, wybór gatunku i schemat; nic z nich nie jest zapisywane jako preferencja.

## Prywatność

Obliczenia wykonują się lokalnie. Service worker zapisuje wyłącznie znane pliki aplikacji; nie zapisuje formularzy, parametrów pacjenta ani zewnętrznych stron. W tej wersji nie dodano analityki ani wysyłania parametrów obliczeń na serwer. Hosting i przeglądarka mogą prowadzić własne logi techniczne. Skopiowany tekst trafia do systemowego schowka na wyraźne żądanie użytkownika.

## Uruchomienie lokalne

Nie jest wymagane instalowanie zależności ani kompilacja.

```bash
python3 -m http.server 8080
```

Następnie otwórz `http://localhost:8080/`. Używaj serwera HTTP zamiast otwierania `index.html` jako pliku. Service worker wymaga HTTPS lub lokalnego zaufanego adresu, np. `localhost`.

Testy silnika wymagają Node.js:

```bash
npm test
```

## Publikacja w GitHub Pages

W istniejącym repozytorium **guziczak/guziczak.github.io** aplikację można opublikować jako niezależny katalog `rxcalc/`. Jeżeli główna witryna korzysta z kompilacji kopiującej zasoby z `public/`, identyczne pliki powinny znajdować się także w `public/rxcalc/`, aby kolejna publikacja głównej strony zachowała aplikację. Nie zastępuj głównego workflow ani manifestu istniejącej witryny. Service worker RxCalc ma własny zakres `/rxcalc/` i własne nazwy cache.

Poniższy workflow jest wariantem dla **oddzielnego repozytorium**; nie wymaga aktywowania w głównej witrynie:

1. Umieść pliki w repozytorium **Guziczak/rxcalc** na gałęzi `main`.
2. W repozytorium wybierz **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Workflow `.github/workflows/pages.yml` uruchamia testy, przygotowuje statyczne pliki i publikuje stronę.
4. Sprawdź wynik procesu **Publish RxCalc to GitHub Pages** w zakładce Actions. Adres jest publikowany w wyniku etapu Deploy.

Manifest, ikony i ścieżki modułów są względne. Ta sama aplikacja może działać pod `/rxcalc/` albo w głównym katalogu osobnego hostingu.

## Aktualizacje i cache

Przy każdej publikacji zmieniającej aplikację zwiększ `CACHE_VERSION` w `sw.js`. Dopisz każdy nowy lokalny plik potrzebny offline do `STATIC_PATHS` oraz do kroku przygotowania statycznej strony w workflow. Nowy service worker czeka na zamknięcie starych okien lub jawny komunikat `{ type: 'SKIP_WAITING' }` wysłany po akceptacji aktualizacji. Cache innych aplikacji na tej samej domenie nie jest usuwany.

Po zmianie reguł klinicznych trzeba osobno zaktualizować źródło, datę weryfikacji oraz przypadki testowe. Aktualizacja plików przez GitHub nie stanowi walidacji medycznej.

## Struktura

| Plik | Rola |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | Interfejs i przepływ pracy |
| `workflow.js`, `workflow.test.mjs` | Widoczność wymaganych pól w reaktywnym formularzu i testy regresji |
| `engine.js`, `engine.test.mjs`, `oral-forms.test.mjs` | Deterministyczne przeliczenia i testy |
| `catalogue.js`, `catalogue-selection.js`, `equine-nsaids.js`, `equine-antiparasitics.js` | Dane produktów, źródła i filtrowanie postaci według gatunku |
| `regimens.js`, `regimen-engine.js` | Jawnie wybierane schematy źródłowe i kontrola ich zakresu |
| `dental-systemic.js`, `dental-topicals.js`, `human-regimens.js` | Źródłowe dane stomatologiczne: preparaty, postaci, opakowania, schematy i instrukcje |
| `human-regimen-engine.js`, `dental-output.js` | Warunki schematu dla ludzi i teksty zachowujące doraźne limity |
| `product-search.js` | Wyszukiwanie dokładnych wariantów preparat–moc–opakowanie |
| `dental-source-review.md`, `dental-*.test.mjs`, `human-regimen-engine.test.mjs`, `product-search.test.mjs` | Ścieżka źródeł oraz testy zakresów i integracji |
| `regimen-engine.test.mjs`, `regimens.test.mjs`, `equine-regimens.test.mjs`, `equine-practice.test.mjs`, `veterinary-vials.test.mjs` | Testy granic wieku/masy, faz, czasu i zgodności z katalogiem |
| `catalogue-selection.test.mjs`, `veterinary-catalogue.md` | Kontrole izolacji gatunków i dokumentacja katalogu |
| `manifest.webmanifest`, `sw.js`, `icons/` | Instalacja PWA i cache offline |
| `.github/workflows/pages.yml` | Testy i publikacja GitHub Pages |

Dokumentacja PWA: [instalowanie aplikacji webowych w Chrome](https://developer.chrome.com/docs/modern-web-guidance/guides/pwa/install-web-app), [manifest aplikacji webowej](https://web.dev/learn/pwa/web-app-manifest).
