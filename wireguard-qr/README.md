# Plik ↔ QR

Konwerter pojedynczych i animowanych kodów QR, działający lokalnie w przeglądarce. Adres: https://guziczak.github.io/wireguard-qr/

## Użycie

1. **Utwórz QR:** przeciągnij jeden lub kilka plików albo użyj przycisku wyboru. Kilka plików zostanie lokalnie skompresowanych do `pliki.zip` i wysłanych serią. Gotowe archiwum ZIP również jest wysyłane serią, bez ponownego pakowania. Pozostałe pliki do 2 953 bajtów otrzymują w trybie automatycznym zwykły QR, a większe — serię.
2. **Seria:** wybierz „Odtwórz serię”. Domyślne tempo to 2 kody/s, z wyborem 1/s, 2/s, 5/s i 10/s. Najpierw nadawane są części pliku, następnie nowe kody naprawcze. Dostępne są pauza, ręczny wybór części oraz „Duży widok QR”. Seria zaczyna w pauzie, a ukrycie karty zatrzymuje odtwarzanie.
3. **Odczytaj QR:** wybierz jeden lub wiele obrazów albo uruchom kamerę. Telefon może dołączyć w dowolnym momencie serii. Odbiornik pokazuje przyrost niezależnych porcji danych, postęp składania oraz rzeczywistą szybkość odbioru. Po odtworzeniu całości i sprawdzeniu zgodności można pobrać plik.
4. **Reset odbioru:** rozpocznij odbieranie nowego pliku, odrzucając części poprzedniego. Zatrzymanie kamery i przełączanie zakładek zachowują postęp częściowego odbioru.
5. **Wyczyść:** usuń pliki, fragmenty i wyniki z bieżącego widoku. Pobrane pliki i zrzuty ekranu trzeba usunąć oddzielnie, jeżeli nie są już potrzebne.

Dla konfiguracji WireGuarda **zwykły pojedynczy QR** zawiera bezpośrednio treść pliku klienta `.conf`, bez adresu strony, JSON, kodowania base64 ani własnego nagłówka. Aplikacja WireGuard może zeskanować go bezpośrednio. **Serię należy odebrać na tej stronie**, pobrać odtworzony `.conf`, a następnie zaimportować go z pliku w WireGuardzie. Skaner WireGuarda nie składa naszego formatu wieloczęściowego. Narzędzie nie konfiguruje serwera VPN i nie generuje kluczy.

Dostępne są przykłady pojedynczego QR, serii pięciu kodów danych (1 920 bajtów, 384 bajty na część) oraz ZIP-a utworzonego z trzech plików. Po pięciu kodach demonstracyjnych zaczynają się dodatkowe kody naprawcze. Dane są demonstracyjne i nie zawierają działających kluczy VPN.

## Odbiór przy pomijaniu klatek

Nowe serie używają protokołu v2: systematycznych kodów fountain opartych na równaniach XOR, w blokach po najwyżej 32 porcje. Odbiornik zwiększa postęp tylko dla niezależnych równań. Po uzyskaniu pełnego rzędu dla bloku odtwarza jego części, także te, których oryginalnych kodów nie odczytał. Powtórzenia lub zależne równania są pomijane. Odbiór może zacząć się również od kodów naprawczych. Nie oznacza to gwarancji odzyskania po dowolnej ustalonej liczbie klatek; potrzeba dostatecznie wielu niezależnych odczytów.

**Uzupełnij brakujące** na odbiorniku zatrzymuje kamerę i tworzy QR z potwierdzeniem postępu. Na nadajniku przycisk **Zeskanuj potwierdzenie** pozwala odczytać ten kod kamerą albo wczytać jego obraz. Potwierdzenie zawiera identyfikację bieżącego transferu, bitmapę ukończonych bloków oraz wskazówkę tempa. Nadajnik przechodzi do naprawy nieukończonych bloków; odtwarzanie wznawia użytkownik. Ukończenie całego pliku jest potwierdzane dopiero po zgodnym SHA-256. Potwierdzenie innej sesji jest odrzucane.

Jest to synchronizacja po przekazaniu potwierdzenia, bez ukrytego kanału sieciowego. Gdy telefon używa tylnej kamery, na czas pokazania potwierdzenia trzeba odwrócić go ekranem do kamery nadajnika. Następnie **Wróć do skanowania** przywraca odbiór z zachowanym postępem.

Skaner po znalezieniu QR śledzi jego położenie i analizuje wycinek z zapasem wokół kodu. Po utracie kodu powraca do przeszukiwania pełnego obrazu, okresowo w wyższej rozdzielczości. Płótno jest ponownie wymiarowane tylko przy zmianie rozmiaru analizowanego obrazu. Czarne kody na białym tle używają szybkiej ścieżki dekodowania; okresowe ponowne wyszukiwanie i import obrazów zachowują obsługę odwróconych kodów.

## Statystyki odbioru i diagnostyka

Panel **Statystyki odbioru** znajduje się przy odzyskanym pliku. Pokazuje czas odbioru, liczbę nowych porcji danych oraz odczytanych QR; po zakończeniu także średnią prędkość. Wyniki pozostają widoczne po zatrzymaniu kamery i odebraniu całości. Pauza, pokazanie zwrotnego QR i wznowienie zachowują pomiar. Reset odbioru lub wyczyszczenie strony usuwa go.

Czas odbioru biegnie od pierwszego zaakceptowanego fragmentu do zakończenia weryfikacji pliku, razem z przerwami. Średnia prędkość kompletnej serii to rozmiar pliku podzielony przez ten czas. Przy pojedynczym natychmiastowym odczycie prędkość może pozostać niedostępna. To pomiar całego odbioru, a nie tempa wyświetlania kodów na drugim urządzeniu.

Szczegóły rozdzielają próby odczytu kamery, poprawnie rozpoznane QR, pakiety dodające nowe dane i pakiety bez nowych danych. Te ostatnie obejmują zarówno powtórzenia, jak i zależne równania naprawcze. Nieudana próba rozpoznania obrazu nie oznacza zgubienia osobnego kodu nadawcy. Parametry obrazu i czas analizy klatki pomagają ocenić skaner; zgłoszone przez kamerę FPS nie są gwarancją takiej liczby skutecznych odczytów.

Przycisk **Kopiuj diagnostykę** tworzy lokalny raport JSON z wersją aplikacji, licznikami, czasami oraz parametrami transferu i obrazu. Raport nie zawiera nazwy, treści, kluczy, identyfikatora ani sumy pliku, adresu IP czy identyfikatora urządzenia. Nie odczytujemy User-Agent. Gdy schowek jest niedostępny, aplikacja pokazuje tekst do ręcznego skopiowania. Nic nie jest automatycznie wysyłane ani zapisywane w trwałej pamięci przeglądarki.

## Kilka plików w jednym ZIP-ie

Wybór lub przeciągnięcie co najmniej dwóch plików uruchamia kompresję ZIP w przeglądarce. Po spakowaniu interfejs pokazuje nazwy plików i rozmiar gotowego archiwum. Przycisk **Pobierz ZIP** pozwala zachować kopię po stronie nadawcy. Odbiornik pobiera jedno archiwum, które rozpakowuje się standardowymi narzędziami urządzenia; strona nie wyodrębnia ani nie uruchamia zawartości archiwów.

Do pakowania można wybrać maksymalnie **100 plików** o łącznym rozmiarze do **32 MiB przed kompresją**. Gotowy ZIP musi mieć najwyżej **10 MiB**, razem z nagłówkami i nazwami. Kompresja może pozwolić na wysłanie większej ilości tekstu; dane już skompresowane mogą się niewiele zmniejszyć. Pliki zbyt duże po spakowaniu są odrzucane przed tworzeniem serii QR.

Pliki znajdują się w głównym katalogu ZIP-a. Nazwy są oczyszczane z elementów ścieżek i niedozwolonych znaków. Powtarzające się nazwy dostają numery, aby nie zastępować innych wpisów. Zawartość każdego pliku jest zachowana bajt po bajcie, także dla pustych plików wewnątrz paczki. ZIP nie jest szyfrowany.

## Prywatność i granice

- Plik jest odczytywany przez `File.arrayBuffer()`. Kompresję ZIP, kodowanie, odczyt obrazu, skanowanie kamery i tworzenie pobieranego pliku wykonuje przeglądarka.
- Brak wysyłania danych, analityki sieciowej, cookies, localStorage, IndexedDB, zdalnej telemetrii i skryptów pobieranych z CDN. Lokalne liczniki diagnostyczne pozostają w pamięci strony; użytkownik może je skopiować. Biblioteki są dołączone lokalnie w `assets/`.
- Polityka CSP blokuje połączenia `connect-src`, zewnętrzne skrypty, formularze i obiekty. GitHub Pages otrzymuje zwykłe żądania pobrania plików strony; zawartość konfiguracji nie trafia do tych żądań.
- Kamera wymaga HTTPS i zgody użytkownika. Uruchamia się wyłącznie przyciskiem i zatrzymuje po odebraniu całego pliku, ręcznym zatrzymaniu, zmianie trybu, ukryciu strony lub jej opuszczeniu. Przy serii pozostaje aktywna po pierwszym fragmencie. Wczytanie obrazów jest alternatywą dla kamery.
- Seria i zwrotne potwierdzenia pozostają lokalne. Każda ramka ma identyfikator transferu, metadane, CRC32 i sumę SHA-256 pliku. Odbiornik nie łączy różnych sesji i udostępnia plik dopiero po sprawdzeniu całości. Sumy kontrolne służą wykrywaniu błędów; nie są szyfrowaniem ani uwierzytelnieniem nadawcy. Potwierdzenie jest przypisane do konkretnego pliku i sesji, ale również nie stanowi kryptograficznego uwierzytelnienia urządzenia.
- Podgląd zawartości jest domyślnie zamknięty; tekst jest wstawiany wyłącznie przez `textContent` i nie jest wykonywany. Linki z obcych kodów QR nigdy nie otwierają się automatycznie.
- Prywatny klucz w pliku lub QR pozostaje poufny. Nie publikuj swoich konfiguracji ani zrzutów ekranu z kodem w repozytorium.
- „Wyczyść” usuwa wyniki i odwołania do danych z aplikacji, ale nie stanowi gwarancji kryminalistycznego wymazania pamięci przeglądarki lub systemu.

## Format i ograniczenia

Jeden zwykły kod: maksymalnie **2 953 bajty**. Do 2 331 bajtów używana jest korekcja M, powyżej korekcja L. Limit dotyczy bajtów, a nie liczby liter. Duże kody wymagają ostrego obrazu i odpowiedniej wielkości na ekranie.

Seria: maksymalnie **10 MiB (10 485 760 bajtów)**, domyślnie po **384 bajty pliku na porcję**, z opcją gęstszego kodu po **600 bajtów**. Liczba części danych wynika z rozmiaru. Maksymalny plik ma odpowiednio 27 307 lub 17 477 części, a do nich dochodzą kody naprawcze. Limit dotyczy jednego pliku lub całego ZIP-a po kompresji. Kolejne paczki można wysyłać oddzielnie, resetując odbiornik pomiędzy transferami. Zmiana gęstości tworzy nowy transfer i wymaga resetu odbioru po drugiej stronie. Wartość 1, 2, 5 lub 10 kodów/s jest tempem wyświetlania; skuteczna szybkość zależy od kamery, ekranu, oświetlenia, ostrości oraz odsetka nowych niezależnych odczytów.

Przed odtwarzaniem strona pokazuje **szacowany czas pierwszego przebiegu części danych** dla wszystkich czterech prędkości, obliczony jako liczba części podzielona przez tempo. Wyróżnia wybrane ustawienie bez automatycznego uruchamiania odtwarzania. Kody naprawcze, pominięcia i czas dekodowania mogą wydłużyć odbiór. Licznik po stronie kamery mierzy rzeczywisty przyrost niezależnych porcji danych; duplikaty nie zawyżają wyniku. Wskazówka tempa jest przekazywana nadawcy dopiero w zwrotnym QR.

Protokół jest opisany w [protocol.md](protocol.md). Jest przeznaczony do przesyłania między dwoma egzemplarzami tej strony. V2 jest własnym binarnym formatem fountain/FEC i nie implementuje standardu UR ani RaptorQ. Nowy odbiornik zachowuje obsługę v1. Stare odbiorniki wymagają odświeżenia strony przed odebraniem v2. Protokół zachowuje nazwę pliku po usunięciu niebezpiecznych znaków i ograniczeniu jej długości. Nazwa nie wpływa na zawartość pliku.

Pliki i fragmenty są kodowane jako segmenty byte. Odczyt wykorzystuje `jsQR.binaryData`, a pobieranie odtworzone bajty. Dzięki temu konwersja zachowuje UTF-8, BOM, CRLF/LF, końcowe spacje i dane binarne. Nazwa pliku nie jest częścią zwykłego QR, dlatego trzeba ją wybrać po odczytaniu. Seria zawiera nazwę w metadanych. Plik z innego skanera lub kod korzystający ze specjalnych trybów tekstowych może wymagać interpretacji zgodnej z jego formatem.

Prefiksy `WGQR-XFR` i `WGQR-ACK` są zarezerwowane dla ramek serii i potwierdzeń. Pliki zaczynające się od tych ośmiu bajtów trzeba przesłać w serii, nawet jeśli są małe, aby odbiornik mógł jednoznacznie rozpoznać format. Sam QR z potwierdzeniem nie jest pobierany jako plik.

Obrazy: do 20 MB i 50 megapikseli, z dodatkowym limitem dłuższego boku 20 000 pikseli. Obsługiwane formaty obrazu zależą od przeglądarki. PNG i JPG są zalecane. Kod musi mieścić się w kadrze razem z jasnym marginesem. SVG nie jest wczytywany.

## Pliki i publikacja

- `index.html`, `styles.css`, `app.js` — interfejs i obsługa plików/kamery.
- `assets/qr-core.js` — gotowy, samodzielny bundle kodera i dekodera.
- `assets/qr-transfer.js` — zgodność z poprzednim protokołem v1.
- `assets/qr-resilient.js` — binarny protokół v2, równania naprawcze, składanie pliku, zwrotne potwierdzenia i sprawdzanie integralności.
- `assets/qr-camera.js` — lokalny skaner z wyborem i śledzeniem wycinka obrazu.
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

Testy używają wyłącznie syntetycznych danych i kodują rzeczywiste PNG, które następnie odczytują przez jsQR. Obejmują m.in. BOM, CRLF, polskie znaki, emoji, dane binarne, białe znaki, kody odwrócone i graniczne rozmiary, a także utracone/przemieszane/powtórzone fragmenty serii, izolowanie sesji, uszkodzone nagłówki, CRC, SHA-256 i reset podczas asynchronicznego sprawdzania pliku. Scenariusze v2 sprawdzają odtworzenie po utracie części danych oraz start wyłącznie od kodów naprawczych, zależne równania i selektywną naprawę po zwrotnym potwierdzeniu. Testy skanera wykorzystują syntetyczny obraz, przemieszczają QR i sprawdzają ponowne znalezienie kodu. Nie zastępują pomiaru wydajności fizycznej kamery konkretnego telefonu. Testy ZIP (`npm run test:zip`) sprawdzają standardowym czytnikiem Pythona zgodność bajtów i nazw, kompresję, limity, przerwanie pakowania oraz odtworzenie archiwum z przemieszanych fragmentów serii; wymagają `python3`.

## Biblioteki i dokumentacja

- [node-qrcode 1.5.4](https://github.com/soldair/node-qrcode) — kodowanie bajtów i limity QR; MIT.
- [jsQR 1.4.0](https://github.com/cozmo/jsQR) — odczyt QR z pikseli i `binaryData`; Apache-2.0.
- [fflate 0.8.2](https://github.com/101arrowz/fflate) — kompresja DEFLATE i standardowe archiwa ZIP; MIT. Dołączona lokalnie, bez workerów i zewnętrznych połączeń.
- [WireGuard dla iOS](https://apps.apple.com/pl/app/wireguard/id1441195209) — import konfiguracji z pliku i QR.
- [Kod skanera WireGuard dla iOS](https://git.zx2c4.com/wireguard-apple/tree/Sources/WireGuardApp/UI/iOS/ViewController/QRScanViewController.swift) — interpretuje odczytany QR jako całą konfigurację.
- [Animated QRs — Blockchain Commons](https://developer.blockchaincommons.com/animated-qrs/) — omówienie idei animowanych QR i standardu UR; nasza strona korzysta z własnego formatu binarnego.

Pełne licencje zależności są dostępne lokalnie w `vendor-licenses.txt`.
