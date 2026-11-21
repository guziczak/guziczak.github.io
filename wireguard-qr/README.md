# Plik ↔ QR

Konwerter pojedynczych i animowanych kodów QR, działający lokalnie w przeglądarce. Adres: https://guziczak.github.io/wireguard-qr/

## Użycie

1. **Utwórz QR:** przeciągnij plik lub użyj przycisku wyboru. W trybie automatycznym plik do 2 953 bajtów otrzymuje zwykły QR, a większy — serię. Można też jawnie wybrać jeden QR albo serię.
2. **Seria:** wybierz „Odtwórz serię”. Domyślne tempo to 5 kodów/s. Przełącznik 5/s · 10/s działa także podczas odtwarzania i zachowuje bieżący plik. Kody zapętlają się. Dostępne są pauza, poprzedni/następny fragment oraz suwak. Seria zaczyna w pauzie, a ukrycie karty zatrzymuje odtwarzanie.
3. **Odczytaj QR:** wybierz jeden lub wiele obrazów albo uruchom kamerę. Telefon może dołączyć w dowolnym momencie serii; odbiornik pokazuje otrzymane i brakujące fragmenty. Po odebraniu kompletu i sprawdzeniu zgodności można pobrać plik.
4. **Reset odbioru:** rozpocznij odbieranie nowego pliku, odrzucając części poprzedniego. Zatrzymanie kamery i przełączanie zakładek zachowują postęp częściowego odbioru.
5. **Wyczyść:** usuń pliki, fragmenty i wyniki z bieżącego widoku. Pobrane pliki i zrzuty ekranu trzeba usunąć oddzielnie, jeżeli nie są już potrzebne.

Dla konfiguracji WireGuarda **zwykły pojedynczy QR** zawiera bezpośrednio treść pliku klienta `.conf`, bez adresu strony, JSON, kodowania base64 ani własnego nagłówka. Aplikacja WireGuard może zeskanować go bezpośrednio. **Serię należy odebrać na tej stronie**, pobrać odtworzony `.conf`, a następnie zaimportować go z pliku w WireGuardzie. Skaner WireGuarda nie składa naszego formatu wieloczęściowego. Narzędzie nie konfiguruje serwera VPN i nie generuje kluczy.

Dostępne są przykłady pojedynczego QR oraz serii pięciu kodów (3 000 bajtów). Dane są demonstracyjne i nie zawierają działających kluczy VPN.

## Prywatność i granice

- Plik jest odczytywany przez `File.arrayBuffer()`. Kodowanie, odczyt obrazu, skanowanie kamery i tworzenie pobieranego pliku wykonuje przeglądarka.
- Brak wysyłania danych, analityki, cookies, localStorage, IndexedDB, telemetrii i skryptów pobieranych z CDN. Biblioteki są dołączone w `assets/qr-core.js`.
- Polityka CSP blokuje połączenia `connect-src`, zewnętrzne skrypty, formularze i obiekty. GitHub Pages otrzymuje zwykłe żądania pobrania plików strony; zawartość konfiguracji nie trafia do tych żądań.
- Kamera wymaga HTTPS i zgody użytkownika. Uruchamia się wyłącznie przyciskiem i zatrzymuje po odebraniu całego pliku, ręcznym zatrzymaniu, zmianie trybu, ukryciu strony lub jej opuszczeniu. Przy serii pozostaje aktywna po pierwszym fragmencie. Wczytanie obrazów jest alternatywą dla kamery.
- Seria również pozostaje lokalna. Każdy fragment ma identyfikator transferu, numer, metadane, CRC32 i sumę SHA-256 pliku. Odbiornik nie łączy różnych sesji i udostępnia plik dopiero po sprawdzeniu całości. Sumy kontrolne służą wykrywaniu błędów; nie są szyfrowaniem ani uwierzytelnieniem nadawcy.
- Podgląd zawartości jest domyślnie zamknięty; tekst jest wstawiany wyłącznie przez `textContent` i nie jest wykonywany. Linki z obcych kodów QR nigdy nie otwierają się automatycznie.
- Prywatny klucz w pliku lub QR pozostaje poufny. Nie publikuj swoich konfiguracji ani zrzutów ekranu z kodem w repozytorium.
- „Wyczyść” usuwa wyniki i odwołania do danych z aplikacji, ale nie stanowi gwarancji kryminalistycznego wymazania pamięci przeglądarki lub systemu.

## Format i ograniczenia

Jeden zwykły kod: maksymalnie **2 953 bajty**. Do 2 331 bajtów używana jest korekcja M, powyżej korekcja L. Limit dotyczy bajtów, a nie liczby liter. Duże kody wymagają ostrego obrazu i odpowiedniej wielkości na ekranie.

Seria: maksymalnie **256 KiB (262 144 bajty)**, po **600 bajtów pliku na fragment**; liczba fragmentów wynika z rozmiaru. Plik 3 000 B ma 5 kodów, a maksymalny — 437. Pełne ramki z metadanymi mają do 796 bajtów i mieszczą się w korekcji M. Opuszczone klatki wracają w następnych obiegach. 5 lub 10 kodów/s jest ustawieniem tempa wyświetlania; skuteczna szybkość zależy od kamery, ekranu, oświetlenia, ostrości oraz powtórzeń. Nie obiecujemy odczytania każdej klatki w pierwszym obiegu.

Protokół jest opisany w [protocol.md](protocol.md). Jest przeznaczony do przesyłania między dwoma egzemplarzami tej strony i nie implementuje standardu UR ani kodów fountain. Zachowuje nazwę pliku po usunięciu niebezpiecznych znaków i ograniczeniu jej długości. Nazwa nie wpływa na zawartość pliku.

Pliki i fragmenty są kodowane jako segmenty byte. Odczyt wykorzystuje `jsQR.binaryData`, a pobieranie odtworzone bajty. Dzięki temu konwersja zachowuje UTF-8, BOM, CRLF/LF, końcowe spacje i dane binarne. Nazwa pliku nie jest częścią zwykłego QR, dlatego trzeba ją wybrać po odczytaniu. Seria zawiera nazwę w metadanych. Plik z innego skanera lub kod korzystający ze specjalnych trybów tekstowych może wymagać interpretacji zgodnej z jego formatem.

Prefiks `WGQR-XFR` jest zarezerwowany dla ramek serii. Pliki zaczynające się od tych ośmiu bajtów trzeba przesłać w serii, nawet jeśli są małe, aby odbiornik mógł jednoznacznie rozpoznać format.

Obrazy: do 20 MB i 50 megapikseli, z dodatkowym limitem dłuższego boku 20 000 pikseli. Obsługiwane formaty obrazu zależą od przeglądarki. PNG i JPG są zalecane. Kod musi mieścić się w kadrze razem z jasnym marginesem. SVG nie jest wczytywany.

## Pliki i publikacja

- `index.html`, `styles.css`, `app.js` — interfejs i obsługa plików/kamery.
- `assets/qr-core.js` — gotowy, samodzielny bundle kodera i dekodera.
- `assets/qr-transfer.js` — protokół fragmentów, składanie pliku i sprawdzanie integralności przez Web Crypto.
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

Budowanie zapisuje `../assets/qr-core.js`, `../vendor-licenses.txt` i metadane z SHA-256. Nie aktualizuje samoczynnie wersji zależności. `qr-transfer.js` jest gotowym skryptem i nie wymaga budowania. Testy używają wyłącznie syntetycznych danych i kodują rzeczywiste PNG, które następnie odczytują przez jsQR. Obejmują m.in. BOM, CRLF, polskie znaki, emoji, dane binarne, białe znaki, kody odwrócone i graniczne rozmiary, a także utracone/przemieszane/powtórzone fragmenty serii, izolowanie sesji, uszkodzone nagłówki, CRC, SHA-256 i reset podczas asynchronicznego sprawdzania pliku.

## Biblioteki i dokumentacja

- [node-qrcode 1.5.4](https://github.com/soldair/node-qrcode) — kodowanie bajtów i limity QR; MIT.
- [jsQR 1.4.0](https://github.com/cozmo/jsQR) — odczyt QR z pikseli i `binaryData`; Apache-2.0.
- [WireGuard dla iOS](https://apps.apple.com/pl/app/wireguard/id1441195209) — import konfiguracji z pliku i QR.
- [Kod skanera WireGuard dla iOS](https://git.zx2c4.com/wireguard-apple/tree/Sources/WireGuardApp/UI/iOS/ViewController/QRScanViewController.swift) — interpretuje odczytany QR jako całą konfigurację.
- [Animated QRs — Blockchain Commons](https://developer.blockchaincommons.com/animated-qrs/) — szersze omówienie idei animowanych QR oraz standardu UR; nasza strona używa prostszego, własnego protokołu numerowanych fragmentów.

Pełne licencje zależności są dostępne lokalnie w `vendor-licenses.txt`.
