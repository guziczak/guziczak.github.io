# Plik ↔ QR

Konwerter pojedynczych i animowanych kodów QR, działający lokalnie w przeglądarce. Adres: https://guziczak.github.io/wireguard-qr/

## Użycie

1. **Utwórz QR:** przeciągnij jeden lub kilka plików albo użyj przycisku wyboru. Kilka plików zostanie lokalnie skompresowanych do `pliki.zip` i wysłanych serią. Gotowe archiwum ZIP również jest wysyłane serią, bez ponownego pakowania. Pozostałe pliki do 2 953 bajtów otrzymują w trybie automatycznym zwykły QR, a większe — serię. Opcja **Zmniejsz pojedynczy plik serii przez ZIP** pozwala ograniczyć ilość przesyłanych danych, jeśli kompresja daje wyraźną oszczędność; po takim transferze odbiornik pobiera ZIP do rozpakowania.
2. **Seria:** wybierz jeden kod albo **dwa kody obok siebie**, a następnie „Odtwórz serię”. Domyślne tempo to 2 zmiany obrazu/s, z wyborem **1/s, 2/s, 5/s, 10/s, 15/s i 20/s**. W układzie podwójnym jedna zmiana pokazuje parę niezależnych kodów, więc 5 par/s oznacza do 10 kodów/s. Dostępne są pauza, ręczny wybór części oraz „Duży widok QR”. Seria zaczyna w pauzie, a ukrycie karty zatrzymuje odtwarzanie. Warianty 15/s i 20/s najlepiej oceniać według rzeczywistego czasu odbioru lub próby ustawień.
3. **Odczytaj QR:** wybierz jeden lub wiele obrazów albo ustaw taki sam **Układ nadawcy** i uruchom kamerę. Dwa kody najwygodniej pokazać i skanować poziomo. Telefon może dołączyć w dowolnym momencie serii; opis pliku jest regularnie powtarzany. Odbiornik pokazuje przyrost niezależnych porcji danych, postęp składania oraz rzeczywistą szybkość odbioru. Po odtworzeniu całości i sprawdzeniu zgodności można pobrać plik.
4. **Reset odbioru:** rozpocznij odbieranie nowego pliku, odrzucając części poprzedniego. Zatrzymanie kamery i przełączanie zakładek zachowują postęp częściowego odbioru.
5. **Wyczyść:** usuń pliki, fragmenty i wyniki z bieżącego widoku. Pobrane pliki i zrzuty ekranu trzeba usunąć oddzielnie, jeżeli nie są już potrzebne.

Dla konfiguracji WireGuarda **zwykły pojedynczy QR** zawiera bezpośrednio treść pliku klienta `.conf`, bez adresu strony, JSON, kodowania base64 ani własnego nagłówka. Aplikacja WireGuard może zeskanować go bezpośrednio. **Serię należy odebrać na tej stronie**, pobrać odtworzony `.conf`, a następnie zaimportować go z pliku w WireGuardzie. Skaner WireGuarda nie składa naszego formatu wieloczęściowego. Narzędzie nie konfiguruje serwera VPN i nie generuje kluczy.

Dostępne są przykłady pojedynczego QR, serii pięciu kodów danych (1 920 bajtów, 384 bajty na część), ZIP-a utworzonego z trzech plików oraz **Test 100 KiB** z powtarzalnymi danymi binarnymi do porównań szybkości. Serie obejmują też opis pliku i dodatkowe kody naprawcze, dlatego liczba widocznych QR może być większa od liczby części danych. Dane są demonstracyjne i nie zawierają działających kluczy VPN.

## Dwa kody i dobieranie ustawień

**Dwa kody obok siebie** to dwa zwykłe, kwadratowe QR z różnymi pakietami jednej serii. Odbiornik śledzi je oddzielnie i przyjmuje każdy poprawny odczyt niezależnie. Nie trzeba odczytać obu kodów z pary jednocześnie. Pobranie klatki PNG zapisuje obydwa kody, a import takiego obrazu odczytuje je niezależnie. Tryb podwójny najlepiej wykorzystuje szeroki ekran i kadr kamery; pozostawienie dwóch małych kodów w pionowym widoku może utrudnić odczyt.

Dwa kody nie gwarantują podwojenia transferu. Przykładowo 2 × 384 B przy 5 parach/s daje nominalnie 3 840 B/s porcji danych — tyle samo co jeden kod po 384 B przy 10 kodach/s. Zaletą pary może być dłuższa obecność każdego kodu na ekranie. Kody opisujące plik, pominięte odczyty i zależne równania zmniejszają skuteczną szybkość. Porównuj czas odbioru tego samego pliku do końcowej weryfikacji.

Przycisk **Dobierz tempo i gęstość** przeprowadza próbę na danych syntetycznych, bez zawartości wybranego pliku:

1. Przygotuj serię na nadajniku, wybierz układ jednego lub dwóch kodów oraz korekcję M albo L.
2. Na odbiorniku wybierz ten sam układ i uruchom kamerę, pozostawiając kody nadajnika poza kadrem. Jeśli wcześniej odebrano fragment pliku, najpierw użyj **Reset odbioru**.
3. Na nadajniku ustaw **Zakres próby** i wybierz **Dobierz tempo i gęstość**. Domyślny zakres **Pełny** porównuje dziesięć profili: 384 i 600 B na kod, każdy przy 2, 5, 10, 15 i 20 zmianach obrazu/s. Każdy profil trwa nominalnie 4 sekundy, łącznie około **40 sekund**. Zakres **Podstawowy** pozostaje przy sześciu profilach — 384 i 600 B przy 2, 5 i 10 zmianach/s — i trwa około **24 sekund**. Układ kodów i wybrana korekcja są stałe przez całą próbę. Po uruchomieniu próby skieruj na nią kamerę odbiornika; nie rozpoczynaj od skanowania zwykłych fragmentów pliku.
4. Na odbiorniku wybierz **Pokaż wynik nadajnikowi**, a na nadajniku **Zeskanuj potwierdzenie**. Wynik przekazujesz QR-em, bez połączenia sieciowego. Nadajnik przyjmuje tylko wynik swojej bieżącej próby.
5. Przyjęcie profilu przygotowuje nową serię. Na odbiorniku wybierz **Wróć do skanowania**, a na nadajniku **Odtwórz serię**. Jeżeli wcześniej odbierano już plik, użyj najpierw **Reset odbioru**. Nie łącz części sprzed zmiany gęstości z częściami nowej serii.

Wynik wybiera spośród przetestowanych profili na podstawie nowych odczytanych danych testowych. Krótka próba nie gwarantuje najlepszego ustawienia dla każdego pliku i warunków; po zmianie odległości, oświetlenia, układu lub korekcji warto powtórzyć pomiar. Zbyt mała liczba odczytów nie wystarcza do wskazania profilu. **Zatrzymaj próbę** przerywa dobieranie ustawień. Po ponownym rozpoczęciu przerwanej próby użyj **Zresetuj próbę** na odbiorniku. Ręczna zmiana kadru kamery lub układu odbioru usuwa pomiary wcześniejszej próby. Pełny zakres używa ramek CAL/SET v2, a podstawowy zachowuje CAL/SET v1; obie strony muszą obsługiwać wybrany zakres.

W **Odporność kodów serii** domyślna korekcja **M** zapewnia większą nadmiarowość wewnątrz QR. Eksperymentalne **L** może dla tej samej porcji danych zmniejszyć liczbę modułów, kosztem słabszej korekcji uszkodzonych fragmentów obrazu. To odrębna warstwa od kodów naprawczych całej serii. Próba dobiera tempo i gęstość dla aktualnie wybranego M/L; nie przełącza automatycznie poziomu korekcji.

**Kadr kamery** oferuje **Automatycznie**, **Szeroki · 16:9** i **Klasyczny · 4:3**. Są to preferencje przekazywane przeglądarce, a nie gwarancja trybu sensora. Faktyczne wymiary i zgłoszone FPS pochodzą z ustawień uruchomionej kamery i są dostępne w diagnostyce. Proporcje kadru nie zmieniają kwadratowego kształtu QR.

### Jak porównać szybkość na swoich urządzeniach

1. Wybierz ten sam niepoufny plik większy niż 2 953 B, np. kilkadziesiąt KiB. Zachowaj ten sam stan opcji kompresji, korekcję, gęstość, jasność ekranu i położenie urządzeń. Włącz duży widok QR i zmieść całe białe marginesy w kadrze.
2. Odbierz plik w układzie jednego kodu. Zapisz **czas do ukończenia i sprawdzenia całości**, średnią prędkość oraz rzeczywiste tempo nadawcy. Wybierz **Kopiuj diagnostykę** po zakończeniu.
3. Użyj **Reset odbioru**, ustaw dwa kody na obu urządzeniach i odbierz ten sam plik ponownie. Porównanie jednego kodu przy 10/s z parą przy 5/s utrzymuje tę samą nominalną liczbę kodów/s; osobno można przeprowadzić próbę ustawień dla każdego układu i porównać najlepsze znalezione profile.
4. Powtórz każdy wariant trzy razy i porównaj środkowy wynik. Przy zgłaszaniu wyników dołącz ustawienia obu prób oraz ich raporty diagnostyczne. Sama liczba rozpoznanych QR lub ustawione 20/s nie opisuje czasu potrzebnego do odzyskania pliku.

## Odbiór przy pomijaniu klatek

Nowe serie używają kompaktowego protokołu **v3**. Nazwa, rozmiar, SHA-256 i wymiary transferu znajdują się w osobnym opisie pliku — manifeście. Nadajnik pokazuje go na początku i ponownie po każdych 16 pakietach danych lub naprawy. Zwykły pakiet v3 ma tylko 36 bajtów nagłówka i 4 bajty CRC32 poza porcją danych, zamiast powtarzać pełne metadane w każdym QR. Odbiornik, który dołącza w trakcie, czeka na kolejny manifest; wcześniejsze pakiety nie są buforowane ani zaliczane jako postęp.

V3 zachowuje systematyczne kody fountain oparte na równaniach XOR, w blokach po najwyżej 32 porcje. Najpierw nadawane są części źródłowe, następnie nowe kody naprawcze. **Części źródłowe są przeplatane między blokami**: najpierw po jednej z każdego bloku, potem kolejne. Krótka przerwa w odczycie rozkłada więc braki między blokami, zamiast pomijać wiele sąsiednich porcji jednego bloku. Zmiana kolejności nie zwiększa liczby pakietów ani nie zmienia formatu v3. Ręczny wybór fragmentu nadal odnosi się do jego położenia w pliku.

Odbiornik zwiększa postęp tylko dla niezależnych równań. Po uzyskaniu pełnego rzędu dla bloku odtwarza jego części, także te, których oryginalnych kodów nie odczytał. Powtórzenia lub zależne równania są pomijane. Po odebraniu manifestu można odtworzyć plik również z samych kodów naprawczych. Nie oznacza to gwarancji odzyskania po dowolnej ustalonej liczbie klatek; potrzeba dostatecznie wielu niezależnych odczytów.

**Uzupełnij brakujące** na odbiorniku zatrzymuje kamerę i tworzy QR z potwierdzeniem postępu. Na nadajniku przycisk **Zeskanuj potwierdzenie** pozwala odczytać ten kod kamerą albo wczytać jego obraz. Potwierdzenie zawiera identyfikację bieżącego transferu, bitmapę ukończonych bloków oraz wskazówkę tempa. W v3 dodatkowo wskazuje potrzebne porcje w maksymalnie 16 nieukończonych blokach i może zalecać tempo 1, 2, 5, 10, 15 albo 20 zmian/s. Potwierdzenia starszych serii zachowują zestaw 1, 2, 5 i 10 zmian/s. Nadajnik najpierw wysyła wskazane porcje, a następnie kody naprawcze tylko dla nieukończonych bloków. Odtwarzanie wznawia użytkownik. Ukończenie całego pliku jest potwierdzane dopiero po zgodnym SHA-256. Potwierdzenie innej sesji jest odrzucane.

Jest to synchronizacja po przekazaniu potwierdzenia, bez ukrytego kanału sieciowego. Gdy telefon używa tylnej kamery, na czas pokazania potwierdzenia trzeba odwrócić go ekranem do kamery nadajnika. Następnie **Wróć do skanowania** przywraca odbiór z zachowanym postępem.

Skaner po znalezieniu QR śledzi jego położenie i analizuje wycinek z zapasem wokół kodu. W trybie podwójnym każdy symbol ma osobne śledzenie. Rozdzielczość stabilnego wycinka jest dobierana do wielkości modułów i czasu dekodowania; nieudany odczyt przywraca dokładniejszą analizę. Po utracie kodu skaner przeszukuje obraz ponownie, również w wyższej rozdzielczości. Płótna są ponownie wymiarowane tylko przy zmianie potrzebnego rozmiaru. Czarne kody na białym tle używają szybkiej ścieżki dekodowania; ponowne wyszukiwanie i import obrazów zachowują obsługę odwróconych kodów.

Dekodowanie może działać w lokalnym workerze, który korzysta z tego samego jsQR i zwraca oryginalne bajty. Bufory pikseli RGBA są przekazywane do workera przez transfer własności, zamiast kopiowania ich przy każdym odczycie. W trybie podwójnym skaner zamraża jeden obraz obejmujący oba potrzebne wycinki, a przy stabilnym śledzeniu pomija pozostałą część kadru. Oba kody nadal pochodzą z tej samej klatki. Identyczne wycinki podczas ponownego wyszukiwania są dekodowane tylko raz. Gdy worker jest niedostępny albo zawiedzie, skaner dekoduje w głównym wątku te same zachowane obrazy wycinków. Nie ma kolejki starych klatek ani konwersji binarnej zawartości QR na tekst.

**Nadawca również używa lokalnego workera**, który przygotowuje matryce kolejnych kodów poza głównym wątkiem. Przygotowanie jest asynchroniczne i ograniczone do jednej paczki jednego lub dwóch kodów naraz; bufor odtwarzania mieści najwyżej trzy gotowe widoki z wyprzedzeniem. Pauza lub zmiana źródła unieważnia nieukończone przygotowanie. Przy braku workera lub jego błędzie dostępne jest kodowanie w głównym wątku. Wyświetlanie odbywa się w rytmie ekranu; renderer dobiera całkowitą liczbę pikseli na moduł i zachowuje czteromodułowy biały margines. Te zmiany zmniejszają pracę wykonywaną przy przełączaniu obrazów, ale nie przesądzają o szybkości fizycznego odczytu kamerą.

## Statystyki odbioru i diagnostyka

Panel **Statystyki odbioru** znajduje się przy odzyskanym pliku. Pokazuje czas odbioru, liczbę nowych porcji danych oraz odczytanych QR; po zakończeniu także średnią prędkość. Wyniki pozostają widoczne po zatrzymaniu kamery i odebraniu całości. Pauza, pokazanie zwrotnego QR i wznowienie zachowują pomiar. Reset odbioru lub wyczyszczenie strony usuwa go.

Czas odbioru biegnie od pierwszego zaakceptowanego fragmentu do zakończenia weryfikacji pliku, razem z przerwami. Średnia prędkość kompletnej serii to rozmiar pliku podzielony przez ten czas. Przy pojedynczym natychmiastowym odczycie prędkość może pozostać niedostępna. To pomiar całego odbioru, a nie tempa wyświetlania kodów na drugim urządzeniu.

Panel nadawcy osobno pokazuje rzeczywiste tempo wyświetlania i czas przygotowania klatki. W trybie podwójnym rozróżnia pary/s i kody/s. Ustawione tempo jest celem; wolniejsze kodowanie lub obciążenie przeglądarki może obniżyć liczbę wyświetlonych obrazów.

Szczegóły rozdzielają próby odczytu kamery, poprawnie rozpoznane QR, pakiety dodające nowe dane i pakiety bez nowych danych. Te ostatnie obejmują zarówno powtórzenia, jak i zależne równania naprawcze. Nieudana próba rozpoznania obrazu nie oznacza zgubienia osobnego kodu nadawcy. Parametry obrazu i czas analizy klatki pomagają ocenić skaner; zgłoszone przez kamerę FPS nie są gwarancją takiej liczby skutecznych odczytów.

Przycisk **Kopiuj diagnostykę** tworzy lokalny raport JSON z wersją aplikacji, licznikami, czasami oraz parametrami transferu i obrazu. Raport nie zawiera nazwy, treści, kluczy, identyfikatora ani sumy pliku, adresu IP czy identyfikatora urządzenia. Nie odczytujemy User-Agent. Gdy schowek jest niedostępny, aplikacja pokazuje tekst do ręcznego skopiowania. Nic nie jest automatycznie wysyłane ani zapisywane w trwałej pamięci przeglądarki.

## Kompresja pojedynczego pliku i paczki ZIP

Opcja **Zmniejsz pojedynczy plik serii przez ZIP** jest domyślnie wyłączona. Po jej włączeniu pojedynczy plik przeznaczony do serii jest kompresowany lokalnie, a archiwum zastępuje oryginał w transferze tylko wtedy, gdy oszczędza **co najmniej 5% i co najmniej 128 bajtów**, z uwzględnieniem nagłówków ZIP-a. Przy mniejszej korzyści wysyłany jest oryginalny plik. Mały plik do 2 953 B w trybie automatycznym oraz tryb **Jeden QR — WireGuard** zachowują bezpośrednią treść QR. Gotowy ZIP nie jest ponownie pakowany.

Gdy kompresja zostanie użyta, interfejs pokazuje archiwum jako wysyłany plik. **Odbiornik pobiera ZIP**, który trzeba rozpakować na urządzeniu; strona nie rozpakowuje go automatycznie. Dotyczy to także konfiguracji `.conf` wysłanej jako skompresowana seria — do WireGuarda importuje się plik wyjęty z archiwum. Pojedynczy plik przed kompresją może mieć do **32 MiB**, a wynik przesyłany serią nadal musi zmieścić się w **10 MiB**. Przy wyłączonej kompresji limit pojedynczego pliku wynosi 10 MiB.

Wybór lub przeciągnięcie co najmniej dwóch plików uruchamia kompresję ZIP w przeglądarce. Po spakowaniu interfejs pokazuje nazwy plików i rozmiar gotowego archiwum. Przycisk **Pobierz ZIP** pozwala zachować kopię po stronie nadawcy. Odbiornik pobiera jedno archiwum, które rozpakowuje się standardowymi narzędziami urządzenia; strona nie wyodrębnia ani nie uruchamia zawartości archiwów.

Do pakowania można wybrać maksymalnie **100 plików** o łącznym rozmiarze do **32 MiB przed kompresją**. Gotowy ZIP musi mieć najwyżej **10 MiB**, razem z nagłówkami i nazwami. Kompresja może pozwolić na wysłanie większej ilości tekstu; dane już skompresowane mogą się niewiele zmniejszyć. Pliki zbyt duże po spakowaniu są odrzucane przed tworzeniem serii QR.

Pliki znajdują się w głównym katalogu ZIP-a. Nazwy są oczyszczane z elementów ścieżek i niedozwolonych znaków. Powtarzające się nazwy dostają numery, aby nie zastępować innych wpisów. Zawartość każdego pliku jest zachowana bajt po bajcie, także dla pustych plików wewnątrz paczki. ZIP nie jest szyfrowany.

## Prywatność i granice

- Plik jest odczytywany przez `File.arrayBuffer()`. Kompresję ZIP, kodowanie, odczyt obrazu, skanowanie kamery i tworzenie pobieranego pliku wykonuje przeglądarka.
- Brak wysyłania danych, analityki sieciowej, cookies, localStorage, IndexedDB, zdalnej telemetrii i skryptów pobieranych z CDN. Lokalne liczniki diagnostyczne pozostają w pamięci strony; użytkownik może je skopiować. Biblioteki są dołączone lokalnie w `assets/`.
- Polityka CSP blokuje połączenia `connect-src`, zewnętrzne skrypty, formularze i obiekty. GitHub Pages otrzymuje zwykłe żądania pobrania plików strony; zawartość konfiguracji nie trafia do tych żądań.
- Kamera wymaga HTTPS i zgody użytkownika. Uruchamia się wyłącznie przyciskiem i zatrzymuje po odebraniu całego pliku, ręcznym zatrzymaniu, zmianie trybu, ukryciu strony lub jej opuszczeniu. Przy serii pozostaje aktywna po pierwszym fragmencie. Wczytanie obrazów jest alternatywą dla kamery.
- Seria i zwrotne potwierdzenia pozostają lokalne. Każdy pakiet v3 zawiera identyfikator transferu i CRC32; pełne metadane oraz SHA-256 pliku są w powtarzanym manifeście. Odbiornik nie łączy różnych sesji i udostępnia plik dopiero po sprawdzeniu całości. Sumy kontrolne służą wykrywaniu błędów; nie są szyfrowaniem ani uwierzytelnieniem nadawcy. Potwierdzenie jest przypisane do konkretnego pliku i sesji, ale również nie stanowi kryptograficznego uwierzytelnienia urządzenia.
- Próba dobierania tempa zawiera wyłącznie dane syntetyczne i własny losowy identyfikator. Wynik próby przekazuje się QR-em. Workery kodera i dekodera są lokalnymi plikami strony i nie wysyłają danych pliku ani obrazów przez sieć.
- Podgląd zawartości jest domyślnie zamknięty; tekst jest wstawiany wyłącznie przez `textContent` i nie jest wykonywany. Linki z obcych kodów QR nigdy nie otwierają się automatycznie.
- Prywatny klucz w pliku lub QR pozostaje poufny. Nie publikuj swoich konfiguracji ani zrzutów ekranu z kodem w repozytorium.
- „Wyczyść” usuwa wyniki i odwołania do danych z aplikacji, ale nie stanowi gwarancji kryminalistycznego wymazania pamięci przeglądarki lub systemu.

## Format i ograniczenia

Jeden zwykły kod: maksymalnie **2 953 bajty**. Do 2 331 bajtów używana jest korekcja M, powyżej korekcja L. Limit dotyczy bajtów, a nie liczby liter. Duże kody wymagają ostrego obrazu i odpowiedniej wielkości na ekranie.

Seria: maksymalnie **10 MiB (10 485 760 bajtów)**, domyślnie po **384 bajty pliku na porcję**, z opcją gęstszego kodu po **600 bajtów**. Liczba części danych wynika z rozmiaru. Maksymalny plik ma odpowiednio 27 307 lub 17 477 części, a do nich dochodzą manifesty i kody naprawcze. Limit dotyczy jednego pliku lub całego ZIP-a po kompresji. Kolejne paczki można wysyłać oddzielnie, resetując odbiornik pomiędzy transferami. Zmiana gęstości tworzy nowy transfer i wymaga resetu odbioru po drugiej stronie. Wartość **1, 2, 5, 10, 15 lub 20** oznacza zmiany obrazu/s — pojedynczego kodu albo pary, zależnie od układu. Skuteczna szybkość zależy od kamery, ekranu, oświetlenia, ostrości oraz odsetka nowych niezależnych odczytów.

Przed odtwarzaniem strona pokazuje **szacowany czas pierwszego przebiegu części danych** dla wszystkich sześciu prędkości. Szacunek uwzględnia części danych, okresowe manifesty i liczbę kodów pokazywanych naraz: `ceil((N + ceil(N / 16)) / liczba_kodów) / tempo`, gdzie `N` oznacza liczbę części źródłowych. Wyróżnia wybrane ustawienie bez automatycznego uruchamiania odtwarzania. Szacunek nie obejmuje dodatkowej naprawy, pominięć ani opóźnień kodowania i odczytu. Licznik po stronie kamery mierzy rzeczywisty przyrost niezależnych porcji danych; duplikaty i manifesty nie zawyżają wyniku. Wskazówka tempa jest przekazywana nadawcy dopiero w zwrotnym QR.

Protokół jest opisany w [protocol.md](protocol.md). Jest przeznaczony do przesyłania między dwoma egzemplarzami tej strony. V3 jest własnym binarnym formatem fountain/FEC i nie implementuje standardu UR ani RaptorQ. Nowy odbiornik zachowuje odczyt serii **v1 i v2**, a nowe serie tworzy jako v3. Odbiorniki sprzed tej aktualizacji wymagają odświeżenia strony przed odebraniem v3. Protokół zachowuje nazwę pliku po usunięciu niebezpiecznych znaków i ograniczeniu jej długości. Nazwa nie wpływa na zawartość pliku.

Pliki i fragmenty są kodowane jako segmenty byte. Odczyt wykorzystuje `jsQR.binaryData`, a pobieranie odtworzone bajty. Dzięki temu konwersja zachowuje UTF-8, BOM, CRLF/LF, końcowe spacje i dane binarne. Nazwa pliku nie jest częścią zwykłego QR, dlatego trzeba ją wybrać po odczytaniu. Seria zawiera nazwę w metadanych. Plik z innego skanera lub kod korzystający ze specjalnych trybów tekstowych może wymagać interpretacji zgodnej z jego formatem.

Prefiksy `WGQR-XFR`, `WGQR-ACK`, `WGQR-CAL` i `WGQR-SET` są zarezerwowane dla ramek serii, potwierdzeń oraz próby i jej wyniku. Pliki zaczynające się od któregoś z tych ośmiobajtowych prefiksów trzeba przesłać w serii, nawet jeśli są małe, aby odbiornik mógł jednoznacznie rozpoznać format. QR z potwierdzeniem albo danymi próby nie jest pobierany jako plik.

Obrazy: do 20 MB i 50 megapikseli, z dodatkowym limitem dłuższego boku 20 000 pikseli. Obsługiwane formaty obrazu zależą od przeglądarki. PNG i JPG są zalecane. Kod musi mieścić się w kadrze razem z jasnym marginesem. SVG nie jest wczytywany.

## Pliki i publikacja

- `index.html`, `styles.css`, `app.js` — interfejs i obsługa plików/kamery.
- `assets/qr-core.js` — gotowy, samodzielny bundle kodera i dekodera.
- `assets/qr-render.js` — rysowanie z całkowitą liczbą pikseli na moduł i ponownym wykorzystaniem bufora obrazu.
- `assets/qr-encoder.js`, `assets/qr-encoder-worker.js` — asynchroniczne przygotowanie jednej lub dwóch matryc QR w lokalnym workerze, anulowanie i awaryjny powrót do głównego wątku.
- `assets/qr-transfer.js` — zgodność z poprzednim protokołem v1.
- `assets/qr-resilient.js` — kompaktowy protokół v3, odczyt v1/v2, równania naprawcze, manifesty, składanie pliku, zwrotne potwierdzenia i sprawdzanie integralności.
- `assets/qr-playback.js` — plan kolejnych pakietów dla jednego lub dwóch kodów, przeplatanie bloków v3, manifesty i naprawa wskazanych części.
- `assets/qr-camera.js` — lokalny skaner z niezależnym śledzeniem jednego lub dwóch kodów, wspólnym przechwytywaniem wycinków i doborem ich rozdzielczości.
- `assets/qr-decoder-worker.js` — dekodowanie QR poza głównym wątkiem, z zachowaniem binarnej zawartości.
- `assets/qr-calibration.js` — syntetyczna próba sześciu podstawowych lub dziesięciu rozszerzonych profili oraz zwrotny QR z jej wynikiem.
- `assets/qr-telemetry.js` — lokalne liczniki, pomiar czasu oraz raport diagnostyczny z ograniczonym zestawem pól.
- `assets/zip-core.js` — samodzielny bundle tworzenia standardowych archiwów ZIP.
- `protocol.md` — specyfikacja binarna i API protokołu serii.
- `assets/favicon.svg` — lokalna ikona.
- `vendor-licenses.txt` — licencje dołączonych bibliotek.
- `development/` — przypięte zależności, źródło bundla, skrypt budowania i testy.

Strona nie potrzebuje backendu ani kompilacji do uruchomienia. GitHub Pages publikuje ten katalog z istniejącej gałęzi `main`. Nie zmienia aplikacji portfolio ani innych podstron.

## Odtworzenie biblioteki i testy

Z katalogu `wireguard-qr/development`:

```sh
npm ci
npm run build
npm test
```

Budowanie zapisuje `../assets/qr-core.js`, `../assets/zip-core.js`, wspólny plik `../vendor-licenses.txt` i metadane z SHA-256. Osobne polecenia `npm run build:qr` i `npm run build:zip` przebudowują wybraną bibliotekę i zachowują komplet licencji. Wersje zależności są przypięte. Skrypty protokołów i skanera nie wymagają budowania.

Testy używają wyłącznie syntetycznych danych i obejmują zarówno rzeczywiste PNG, jak i obrazy pikselowe odczytywane przez jsQR. Sprawdzają m.in. BOM, CRLF, polskie znaki, emoji, dane binarne, białe znaki, kody odwrócone i graniczne rozmiary, a także utracone/przemieszane/powtórzone fragmenty serii, izolowanie sesji, uszkodzone nagłówki, CRC, SHA-256 i reset podczas asynchronicznego sprawdzania pliku. Scenariusze protokołu obejmują zgodność v1/v2, kompaktowe pakiety v3, oczekiwanie na manifest, odtwarzanie z kodów naprawczych i naprawę wskazanych części po potwierdzeniu. Plan nadawania ma testy przeplatania bloków, przerw obejmujących kolejne obrazy, przywracania pozycji po pauzie i pomijania ukończonych bloków. Próba ustawień sprawdza oba zakresy CAL/SET oraz wybór według rzeczywiście odebranych danych.

Testy skanera wykorzystują syntetyczny obraz, śledzą niezależne symbole, sprawdzają ponowne znalezienie kodu i współrzędne po przycięciu wspólnego kadru. Testy workerów sprawdzają zgodność bajtów, przekazywanie buforów, ograniczenie oczekującej pracy, reset, spóźnione odpowiedzi i awarie. Dekoder po awarii musi odtworzyć ten sam przechwycony obraz nawet wtedy, gdy bieżący obraz kamery już się zmienił. Testy renderera weryfikują odtworzenie bajtów, margines oraz rozmiar modułów przy różnych gęstościach ekranu. **Nie są to pomiary transferu fizyczną kamerą** i nie dowodzą konkretnego przyspieszenia na telefonie użytkownika.

Testy ZIP (`npm run test:zip`) sprawdzają standardowym czytnikiem Pythona zgodność bajtów i nazw, kompresję, limity, przerwanie pakowania oraz odtworzenie archiwum z przemieszanych fragmentów serii; wymagają `python3`.

## Biblioteki i dokumentacja

- [node-qrcode 1.5.4](https://github.com/soldair/node-qrcode) — kodowanie bajtów i limity QR; MIT.
- [jsQR 1.4.0](https://github.com/cozmo/jsQR) — odczyt QR z pikseli i `binaryData`; Apache-2.0.
- [fflate 0.8.2](https://github.com/101arrowz/fflate) — kompresja DEFLATE i standardowe archiwa ZIP; MIT. Dołączona lokalnie, bez workerów i zewnętrznych połączeń.
- [WireGuard dla iOS](https://apps.apple.com/pl/app/wireguard/id1441195209) — import konfiguracji z pliku i QR.
- [Kod skanera WireGuard dla iOS](https://git.zx2c4.com/wireguard-apple/tree/Sources/WireGuardApp/UI/iOS/ViewController/QRScanViewController.swift) — interpretuje odczytany QR jako całą konfigurację.
- [Animated QRs — Blockchain Commons](https://developer.blockchaincommons.com/animated-qrs/) — omówienie idei animowanych QR i standardu UR; nasza strona korzysta z własnego formatu binarnego.

Pełne licencje zależności są dostępne lokalnie w `vendor-licenses.txt`.
