# RxCalc

Lekki kalkulator dawkowania i zapotrzebowania na preparaty z interfejsem po polsku. Aplikacja działa w przeglądarce i jest przygotowana jako PWA dla Androida oraz innych urządzeń.

Docelowy adres projektu: **https://guziczak.github.io/rxcalc/**. Sam adres w tym pliku nie stanowi potwierdzenia publikacji.

## Auto i smukłe zaokrąglanie przy kopiowaniu — 19.11.2026

Kontrolka pozostaje w stopce pola z zapisem: **Auto / Własne / Wyłączone**. Domyślny tryb Auto stosuje wyłącznie rozpoznane, wersjonowane reguły. Brak reguły pozostawia wynik bez automatycznej zmiany. Własne odsłania wybór 0–3 miejsc po przecinku; szczegóły zmiany i źródła są rozwijane. Kontrolki mają minimum 44 px wysokości na telefonie.

Pierwsza reguła dotyczy wyłącznie istniejącego schematu `dental-augmentin-suspension-adult-substitution` dla dorosłego ≥40 kg i zawiesiny Augmentin 400/57 mg na 5 ml: **875 mg → 11 ml, czyli 880 mg + 125,4 mg na podanie**. Zachowuje nominalne 875 mg i porównanie rzeczywistej zmiany +0,57%. Źródła dotyczą zamiany postaci, nie zatwierdzenia całego schematu stomatologicznego: [Cleveland Clinic, formularz dla dorosłych, 2020, s. 7](https://www.clevelandclinicmeded.com/medicalpubs/pharmacy/September%20October%202020%20Clinical%20Rx%20Forum.pdf) i [HSE, zamiana off-label, s. 5](https://assets.hse.ie/media/documents/Pneumonia_in_residential_care_facilities_guideline.pdf).

Wspólna ocena w `rounding-assessment.js` jest używana przez kafelki, wynik, składniki i porównanie schematu. Rozpoznana reguła ma neutralny status informacyjny i nie wymaga osobnego formularza uzasadnienia. Silnik zachowuje niezależne limity produktu, pacjenta, lekarza i składników, podziałki oraz ograniczenia nerkowe. Jedynie zduplikowane cele źródłowe 875/1750 mg są oddzielane od limitów niezależnych. Nie ma globalnej tolerancji procentowej. Czas i częstość leczenia nie są zmieniane ani automatycznie zatwierdzane; końcowe potwierdzenie lekarza pozostaje wymagane.

Artymetyczne komunikaty silnika mają jawne kody. Dopiero zgodna ocena konkretnej reguły może potraktować komunikat zaokrąglenia i brak odrębnego maksimum jako informację; pozostałe ostrzeżenia i błędy zachowują działanie. Koszyk przechowuje ilości rzeczywiste, wybraną precyzję/tryb oraz identyfikator, wersję i źródła zastosowanej reguły.

## Potwierdzenie dodania do koszyka — 18.11.2026

Po udanym dodaniu przycisk pokazuje krótkie potwierdzenie, a znacznik przemieszcza się do widocznego koszyka i wyróżnia jego licznik. Zapis edytowanej pozycji pokazuje osobne potwierdzenie bez sygnału dodania następnej pozycji. Koszyk pozostaje zamknięty, fokus i pozycja przewijania są zachowane. Przy systemowym ograniczeniu animacji pozostaje potwierdzenie tekstowe i kolorystyczne. Komunikat pod przyciskiem nadal zawiera skróty do następnego preparatu i koszyka; nie zasłania go dodatkowy toast. Efekty dotyczą wyłącznie prezentacji udanego zapisu.

## Zgodność liczbowa UCSF bez stałego alarmu — 18.11.2026

Gdy rzeczywista dawka po zaokrągleniu i częstość odpowiadają odniesieniu UCSF, a czas mieści się w jego zakresie, wynik pokazuje krótką neutralną informację o zgodności liczbowej. Stały akapit o nieocenianych warunkach nie jest już ostrzeżeniem wyniku ani osobnym blokiem obok dni. Pełne warunki zastosowania pozostają w szczegółach źródła.

Rozbieżności dawki/częstości, czas poza zakresem, warunki ponownej oceny i pozostałe ograniczenia zachowują działanie. Ten stan jest odrębny od potwierdzenia zgodności całego schematu; nie zmienia danych formularza ani końcowego potwierdzenia. Szczegóły: [duration-regimen-notes.md](duration-regimen-notes.md).

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

## Przełącznik dawki i objętości — 17.11.2026

Skróty dla zawiesin z przeliczeniem w mg mają dwa widoki: **Dawka** (w jednostce aktualnego sposobu dawkowania, np. mg lub mg/kg/dobę) i **Objętość** (ml na podanie). Po wybraniu liczbowego schematu w mg domyślnie pokazywana jest dawka. Ręczny wybór widoku pozostaje w pamięci bieżącej karty podczas edycji; wybór nowego preparatu lub schematu przywraca odpowiedni widok domyślny. Przełącznik nie zapisuje danych, nie zmienia dawki, czasu, częstości ani potwierdzeń.

Dla źródłowych 875 mg widok dawki zachowuje dokładny kafelek **875 mg = 10,9375 ml**. Widok objętości nadal udostępnia odrębny skrót **11 ml = 880 mg** wraz z dotychczasową oceną zaokrąglenia. Bieżąca wpisana dawka i jej przeliczenie są widoczne także wtedy, gdy nie odpowiadają żadnemu z trzech kafelków. Przełączenie po wyborze 11 ml nie podmienia 880 mg na 875 mg. Obliczona objętość pozostaje odrębna od możliwości jej odmierzenia. Jawny krok zaokrąglenia oraz dotychczasowe ograniczenia i kontrola kopiowania nadal obowiązują. Preparaty bez stężenia w mg/ml i dawkowanie w jednostkach zachowują widok objętości.

## Ocena czasu według wpisanego schematu — 17.11.2026

Ocena całego schematu uwzględnia wybrane źródło i etap, postać, zakres pacjenta, rzeczywistą dawkę po zaokrągleniu oraz częstość. Dla źródłowych schematów zielony wymaga zgodności sprawdzanych danych. Sama liczba „3 dni” ani położenie na dolnej granicy zakresu nie przesądzają o kolorze.

W zewnętrznych odniesieniach **UCSF i SDCEP kafelki porównują wyłącznie liczbę dni**: czas wewnątrz przedziału jest neutralny i opisany „W zakresie UCSF/SDCEP”, a wyjście poza przedział zachowuje ostrzeżenie. Dopasowanie dawkowania, brak danych i nieocenione warunki zastosowania są pokazane raz, we wspólnym komunikacie przy grupie. Ocena całego schematu i ostrzeżenia wyniku nadal zachowują te różnice. Przy źródle bez pełnego zakresu dni neutralne skróty nie potwierdzają czasu kuracji. Zaznaczony kafelek ma osobny napis **„Wybrano”**; neutralny wybór nie zmienia obrysu na zielony.

UCSF i SDCEP pozostają odrębnymi odniesieniami wymagającymi oceny warunków zastosowania także przy zgodnym dawkowaniu liczbowym. Zmiana dawki ponownie ocenia zgodność, ale nie skraca ani nie wydłuża wybranego czasu. Pierwotne limity czasu i warunki kontroli zachowują pierwszeństwo. Jest to porównanie danych ze źródłem, nie dobór terapii; nie dodano nowych leków, wartości dawek ani pól potwierdzenia warunków klinicznych. Szczegóły: [duration-regimen-notes.md](duration-regimen-notes.md).

### Doprecyzowanie źródła oceny — 18.11.2026

Kafelki poza zewnętrznym przedziałem wskazują jego źródło, np. **„Powyżej zakresu UCSF”**. Brak zakresu w sprawdzonym źródle dla czasu indywidualnego lub warunku kontroli jest podpisany **„Czas nieoceniony — źródło wybranego schematu nie określa zakresu dni dla tego wskazania”**. Ostrzeżenia o rzeczywistym przekroczeniu czasu lub potrzebie ponownej oceny zachowują pierwszeństwo.

W szczegółach 17 wskazanych schematów stomatologicznych dodano przegląd źródeł z 18.11.2026 i warunki ich zastosowania. Przypisania są jawne i wymagają zgodnego rekordu źródłowego oraz zakresu pacjenta. Przegląd wyjaśnia m.in. zależne od objawów zakończenie wariantu ADA i ograniczenie wskazania w Queensland; te informacje nie tworzą nowych minimów ani przedziałów dni. Moduł `duration-source-review.js` zawiera wyłącznie opisy i odnośniki. Zakres przeglądu i decyzje opisuje [duration-coverage-notes.md](duration-coverage-notes.md).

## Android: dodanie do ekranu głównego

1. Otwórz opublikowany adres aplikacji w **Chrome** na Androidzie przy dostępie do internetu.
2. Otwórz menu **⋮** i wybierz **Dodaj do ekranu głównego** lub **Zainstaluj aplikację**. Nazwa opcji zależy od wersji Chrome i urządzenia.
3. Potwierdź instalację. Ikona **RxCalc** pojawi się wśród aplikacji lub na ekranie głównym.
4. Uruchom aplikację z ikony. Przy instalacji PWA będzie korzystać z osobnego okna. Dostępny skrót przeglądarkowy może zamiast tego otwierać kartę Chrome.

Praca offline jest dostępna po udanym zarejestrowaniu service workera i zapisaniu plików aplikacji. Pierwsze uruchomienie, instalacja aktualizacji i otwieranie zewnętrznych ChPL wymagają połączenia. System lub przeglądarka mogą usunąć pamięć witryny, co wymaga ponownego otwarcia online.

## Katalog stomatologiczny — stan 14.11.2026

- Wersja katalogu: **`2026.11.14.dental.5`**. Katalog obejmuje **14 grup, 22 postaci i 42 warianty z opakowaniem**: leki, wyrób medyczny, kosmetyk oraz wyraźnie oznaczone zagraniczne i historyczne karty referencyjne. Liczby wynikają z `DRUGS`, `HUMAN_REGIMENS` i `catalogueProducts()` dla specjalizacji `dental`. Nie jest to wykaz bieżących stanów aptek.
- Dodano Augmentin **500 mg + 125 mg, tabletki po 14/21 szt.**, oraz **875 mg + 125 mg, tabletki po 14 szt.** Źródła: [ChPL RPL 830](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/830/characteristic) i [ChPL RPL 7496](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/7496/characteristic), rewizja 2026-09-09. Dodano także Dalacin C **150 mg i 300 mg, kapsułki po 16/20 szt.** Źródła: [ChPL RPL 1692](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/1692/characteristic) i [ChPL RPL 1693](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/1693/characteristic), rewizja 2026-07-10. Te cztery źródła sprawdzono 2026-11-14. Wybrane opakowania są udokumentowane; bieżąca sprzedaż, zapas apteki i refundacja nie zostały potwierdzone.
- Wpisanie substancji, marki, mocy lub wielkości opakowania pokazuje dokładne warianty. Jeden wybór ustala preparat, moc i opakowanie. Można wyszukać kilka cech jednocześnie, np. `amoksycylina 1000 14`.
- **30 jawnie wybieranych schematów źródłowych: 23 liczbowe i 7 instrukcyjnych.** Schematy obejmują 17 postaci; 4 postaci to karty referencyjne, a Nystatyna Teva pozostaje ręcznym przeliczeniem objętości bez gotowego schematu.
- Wskazanie i schemat wybiera lekarz. Po tym wyborze uzupełniane są stałe wartości źródłowe. Przy edytowalnym zakresie puste pole dawki tabletki lub kapsułki może zostać jednorazowo uzupełnione wartością **jednej całej sztuki**, jeśli odpowiada zakresowi i dostępnym limitom. Algorytm nie wybiera górnej granicy zakresu; dawkę można zmienić. Podział zależy od konkretnego produktu: połówka jest niedostępna dla kapsułek Dalacin C i tabletek Augmentin. Nie ustalamy automatycznie czasu antybiotykoterapii ani nie wyznaczamy go z opakowania.
- Podpowiedzi liczbowe sprawdzają warunki konkretnego schematu: wiek, masę, czas, postać, dawkę i częstość. Dane nerkowe są opcjonalne; brak danych nie wymaga potwierdzenia ani nie wywołuje komunikatu. Pozostaje pole **„Znany CrCl”** do podania już ustalonej wartości w ml/min, z bębnem i możliwością wpisania liczby. Kalkulator Cockcrofta–Gaulta, jego pola oraz wejścia „Narzędzia” zostały usunięte; aplikacja nie oblicza CrCl ani eGFR.
- Wprowadzony CrCl i wskazane zaburzenia są nadal uwzględniane zgodnie z konkretnym schematem. W tej wersji próg **CrCl ≤30 ml/min** blokuje obecne standardowe schematy amoksycyliny i amoksycyliny z klawulanianem; **nie jest regułą dla klindamycyny ani wszystkich antybiotyków**. eGFR nie jest podstawiane za CrCl. Nie dodano automatycznych schematów redukcji nerkowej; szczegóły i źródła opisuje [przegląd stomatologiczny](dental-source-review.md).
- Dobowy limit w mg/kg jest przeliczany na aktualną masę. Granice zakresu antybiotyku są podpisane jako granice wybranego schematu, nie uniwersalne maksimum substancji. Niższy limit lekarza obowiązuje także w kopiowanym tekście.
- Schematy doraźne zachowują słowa „w razie potrzeby”, maksymalną liczbę podań oraz minimalny odstęp. Opakowania oznaczają maksymalne zaplanowane zużycie.
- Eksport dla ludzi ma dwa warianty: **„Rp. + D.S.”** zawiera preparat, opakowania i dawkowanie; **„Zalecenia”** dodają wybrane wskazanie, pusty wiersz i `D.S.`. Automatyczna linia „Schemat” pozostaje wyłącznie w podsumowaniu aplikacji. Przy ręcznym schemacie bez przypisanego wskazania zalecenia zawierają samo `D.S.`. Zapis weterynaryjny nadal zachowuje kontekst gatunku, masy oraz wybranego wskazania i etapu.
- Żele z porcją opisaną słownie i zabiegi miejscowe mają instrukcje bez zmyślonej dawki w gramach, FTU czy liczby tub. Lekarz może jawnie wpisać liczbę opakowań. Wymagany źródłowo czas stosowania trafia do skopiowanego tekstu. Pełny zapis produktu leczniczego ma nagłówek `Rp.` również w trybie instrukcji; nazwa, ilość opakowań i `D.S.` tworzą samodzielny blok w podglądzie i koszyku. Dla Baikadentu wpisane 2 opakowania są eksportowane jako `2 op. po 15 g`; informacja o ręcznym ustaleniu ilości pozostaje w interfejsie. Pusta liczba opakowań pozostaje nieokreślona. W koszyku zawierającym także pozycje opisowe zakładka pełnego eksportu nazywa się „Pełny zapis”.
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
- Katalog zaczyna od sześciu pozycji lub skrótów ulubionych w zwykłym układzie. Na ekranach od 781 px dopiero „Pokaż wszystkie” (lub rozwinięcie pozostałych wyników wyszukiwania) przełącza katalog na pełną szerokość i siatkę kilku kolumn. „Zwiń katalog” przywraca krótki widok. Wybór preparatu przywraca formularz i wynik obok siebie. Przełączenie aktualizuje listę i układ bez resetowania danych formularza. Na mniejszych ekranach pozostaje dotychczasowe rozwijanie listy.
- Po świadomym wyborze preparatu katalog zwija się do edytowalnego podsumowania, a widok przewija do karty „Wybrany preparat” z odstępem pod przyklejonym nagłówkiem. Dotyczy też wyszukiwarki, ulubionych i wyboru wariantu. Przy wyszukiwaniu przewinięcie czeka na zamknięcie klawiatury; nowy gest użytkownika je anuluje. Jedna zgodna postać jest pokazywana bez dodatkowego kliknięcia. Przy kilku wariantach użytkownik jawnie wybiera postać i moc, zanim zobaczy schemat i wynik.
- Schemat źródłowy pokazuje dawkę, częstość i ewentualny stały czas jako informacje. Pełne źródło i dodatkowe ustawienia są rozwijane, a screening, kalibracja oraz bieżące blokady pozostają widoczne.
- `workflow.js` wyznacza widoczność pól, bez zmiany walidacji klinicznej. Masa zwierzęcia pozostaje zawsze dostępna. Wiek, warunkowe limity masy oraz paszport konia pojawiają się zgodnie z wymaganiami postaci i schematu; już wpisane wartości zawsze można poprawić. Wykluczenie konia pozostaje wymagane także w trybie ręcznym.
- Wynik obejmuje podsumowanie kontekstu przed jawnym potwierdzeniem i kopiowaniem. Zmiana danych unieważnia potwierdzenie. Brak świadomego wyboru preparatu lub wariantu czyści poprzedni wynik oraz tekst do skopiowania.
- Mobilny pasek udostępnia podsumowanie i kopiowanie, uwzględnia safe-area i ukrywa się podczas wpisywania. Pola tekstowe aktualizują wynik bez przebudowy formularza i utraty fokusu.
- Zapisany motyw jest odczytywany przez mały skrypt klasyczny w nagłówku HTML, zanim powstanie loader i zostaną uruchomione moduły aplikacji. Przy braku poprawnej preferencji używany jest motyw systemowy. Zmiana motywu aktualizuje też kolor interfejsu przeglądarki. Systemowy ekran uruchamiania PWA ma stałe ciemne tło marki zapisane w manifeście; wybór motywu loadera HTML działa niezależnie od tego ekranu.
- Nagłówek i loader używają tego samego wektorowego monogramu z `icons/icon.svg`. Ikony PNG 192/512, wariant maskowalny i nieprzezroczysty Apple touch 180 px są eksportami znaków SVG z tego katalogu.
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
| `patient-picker.js`, `patient-picker-model.js`, `patient-picker.css`, `wheel-motion.js` | Bębny wieku, masy i ręcznie podanego CrCl; obsługa ruchu oraz wpisywania wartości |
| `engine.js`, `engine.test.mjs`, `oral-forms.test.mjs` | Deterministyczne przeliczenia i testy |
| `catalogue.js`, `catalogue-selection.js`, `equine-nsaids.js`, `equine-antiparasitics.js` | Dane produktów, źródła i filtrowanie postaci według gatunku |
| `regimens.js`, `regimen-engine.js` | Jawnie wybierane schematy źródłowe i kontrola ich zakresu |
| `dental-systemic.js`, `dental-topicals.js`, `human-regimens.js` | Źródłowe dane stomatologiczne: preparaty, postaci, opakowania, schematy i instrukcje |
| `human-regimen-engine.js`, `dental-output.js` | Warunki schematu dla ludzi i teksty zachowujące doraźne limity |
| `duration-regimen.js`, `duration-guidance.js`, `duration-reference.js`, `duration-view.js` | Dopasowanie rzeczywistego dawkowania do źródła i wspólna ocena czasu w polach, skrótach oraz ostrzeżeniach wyniku |
| `duration-source-review.js` | Dodatkowe źródła przypisane do konkretnych schematów wraz z zakresem zastosowania; bez nowych progów czasu |
| `product-search.js` | Wyszukiwanie dokładnych wariantów preparat–moc–opakowanie |
| `dental-source-review.md`, `dental-*.test.mjs`, `human-regimen-engine.test.mjs`, `product-search.test.mjs` | Ścieżka źródeł oraz testy zakresów i integracji |
| `regimen-engine.test.mjs`, `regimens.test.mjs`, `equine-regimens.test.mjs`, `equine-practice.test.mjs`, `veterinary-vials.test.mjs` | Testy granic wieku/masy, faz, czasu i zgodności z katalogiem |
| `catalogue-selection.test.mjs`, `veterinary-catalogue.md` | Kontrole izolacji gatunków i dokumentacja katalogu |
| `theme-init.js`, `theme-init.test.mjs` | Motyw przed pierwszym wyświetleniem loadera, ustawienia przeglądarki i testy preferencji / niedostępnej pamięci |
| `manifest.webmanifest`, `sw.js`, `icons/` | Instalacja PWA i cache offline |
| `.github/workflows/pages.yml` | Testy i publikacja GitHub Pages |

Dokumentacja PWA: [instalowanie aplikacji webowych w Chrome](https://developer.chrome.com/docs/modern-web-guidance/guides/pwa/install-web-app), [manifest aplikacji webowej](https://web.dev/learn/pwa/web-app-manifest).


## Zaokrąglanie i koszyk obliczeń

W podsumowaniu ciągłych ilości preparatu (ml/g) domyślne Auto stosuje wyłącznie regułę opisaną powyżej. Tryb Własne pozwala wybrać 0–3 miejsca po przecinku, a Wyłączone przywraca ilość wynikającą z nominalnej dawki. Rzeczywista ilość na podanie zasila mg, ilość dobową, zapotrzebowanie, opakowania i zapis Rp./D.S. Nieznane reguły nie otrzymują domyślnego zaokrąglenia. Tabletki, krople, rozpylenia, instrukcje i postacie z własną podziałką urządzenia zachowują swoje zasady; sama kontrolka precyzji nie zastępuje podziałki urządzenia.

Potwierdzone obliczenie można dodać do koszyka, edytować, usunąć lub połączyć z kolejnymi preparatami w jeden tekst do skopiowania. Każda pozycja przechowuje niezmienną kopię parametrów i obu formatów zapisu. Zmiana preparatu zachowuje dane pacjenta. Zmiana danych pacjenta oznacza zapisane pozycje jako nieaktualne i blokuje zbiorczy eksport do ich ponownego przeliczenia i potwierdzenia. Edycja pozycji zachowuje nowe dane pacjenta. Powtórny wybór tego samego produktu i postaci kieruje do edycji, bez cichego sumowania opakowań. Zmiana ludzkiej specjalizacji nie zmienia tożsamości pacjenta koszyka.

Koszyk i parametry pozostają wyłącznie w pamięci bieżącej karty. „Nowy pacjent”, zamknięcie lub przeładowanie strony usuwa ten kontekst. Koszyk łączy teksty z kalkulatora; nie wykonuje analizy interakcji między pozycjami ani nie wystawia e-recepty.
