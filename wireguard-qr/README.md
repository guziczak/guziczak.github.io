# Plik ↔ QR

Mały konwerter działający lokalnie w przeglądarce. Adres: https://guziczak.github.io/wireguard-qr/

## Użycie

1. **Utwórz QR:** przeciągnij mały plik lub użyj przycisku wyboru. Kod pojawi się automatycznie; można go zeskanować z drugiego urządzenia albo zapisać jako PNG.
2. **Odczytaj QR:** wybierz obraz lub uruchom kamerę. Po odczytaniu nadaj nazwę plikowi i pobierz jego zawartość.
3. **Wyczyść:** usuń pliki i wyniki z bieżącego widoku. Pobrane pliki i zrzuty ekranu trzeba usunąć oddzielnie, jeżeli nie są już potrzebne.

Dla konfiguracji WireGuarda kod zawiera bezpośrednio treść pliku klienta `.conf`, bez adresu strony, JSON, kodowania base64 ani własnego nagłówka. Aplikacja WireGuard może zeskanować taki kod bezpośrednio. To narzędzie nie konfiguruje serwera VPN i nie generuje kluczy.

Przykład dostępny przyciskiem zawiera celowo nieprawidłowe klucze i służy wyłącznie do sprawdzenia konwersji.

## Prywatność i granice

- Plik jest odczytywany przez `File.arrayBuffer()`. Kodowanie, odczyt obrazu, skanowanie kamery i tworzenie pobieranego pliku wykonuje przeglądarka.
- Brak wysyłania danych, analityki, cookies, localStorage, IndexedDB, telemetrii i skryptów pobieranych z CDN. Biblioteki są dołączone w `assets/qr-core.js`.
- Polityka CSP blokuje połączenia `connect-src`, zewnętrzne skrypty, formularze i obiekty. GitHub Pages otrzymuje zwykłe żądania pobrania plików strony; zawartość konfiguracji nie trafia do tych żądań.
- Kamera wymaga HTTPS i zgody użytkownika. Uruchamia się wyłącznie przyciskiem i zatrzymuje po odczytaniu, zatrzymaniu, zmianie trybu, ukryciu strony lub jej opuszczeniu. Wczytanie obrazu jest alternatywą dla kamery.
- Podgląd zawartości jest domyślnie zamknięty; tekst jest wstawiany wyłącznie przez `textContent` i nie jest wykonywany. Linki z obcych kodów QR nigdy nie otwierają się automatycznie.
- Prywatny klucz w pliku lub QR pozostaje poufny. Nie publikuj swoich konfiguracji ani zrzutów ekranu z kodem w repozytorium.
- „Wyczyść” usuwa wyniki i odwołania do danych z aplikacji, ale nie stanowi gwarancji kryminalistycznego wymazania pamięci przeglądarki lub systemu.

## Format i ograniczenia

Jeden kod: maksymalnie **2 953 bajty**, bez dzielenia na części. Do 2 331 bajtów używana jest korekcja M, powyżej korekcja L. Limit dotyczy bajtów, a nie liczby liter. Duże kody wymagają ostrego obrazu i odpowiedniej wielkości na ekranie.

Własne pliki są kodowane jako pojedynczy segment byte. Odczyt wykorzystuje `jsQR.binaryData`, a pobieranie bezpośrednio te bajty. Dzięki temu konwersja zachowuje UTF-8, BOM, CRLF/LF, końcowe spacje i dane binarne. Nazwa pliku nie jest częścią standardowej zawartości QR, dlatego trzeba ją wybrać po odczytaniu. Plik z innego skanera lub kod korzystający ze specjalnych trybów tekstowych może wymagać interpretacji zgodnej z jego formatem.

Obrazy: do 20 MB i 50 megapikseli, z dodatkowym limitem dłuższego boku 20 000 pikseli. Obsługiwane formaty obrazu zależą od przeglądarki. PNG i JPG są zalecane. Kod musi mieścić się w kadrze razem z jasnym marginesem. SVG nie jest wczytywany.

## Pliki i publikacja

- `index.html`, `styles.css`, `app.js` — interfejs i obsługa plików/kamery.
- `assets/qr-core.js` — gotowy, samodzielny bundle kodera i dekodera.
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

Budowanie zapisuje `../assets/qr-core.js`, `../vendor-licenses.txt` i metadane z SHA-256. Nie aktualizuje samoczynnie wersji zależności. Testy używają wyłącznie syntetycznych danych i kodują rzeczywiste PNG, które następnie odczytują przez jsQR. Obejmują m.in. BOM, CRLF, polskie znaki, emoji, dane binarne, białe znaki, kody odwrócone i graniczne rozmiary.

## Biblioteki i dokumentacja

- [node-qrcode 1.5.4](https://github.com/soldair/node-qrcode) — kodowanie bajtów i limity QR; MIT.
- [jsQR 1.4.0](https://github.com/cozmo/jsQR) — odczyt QR z pikseli i `binaryData`; Apache-2.0.
- [WireGuard dla iOS](https://apps.apple.com/pl/app/wireguard/id1441195209) — import konfiguracji z pliku i QR.

Pełne licencje zależności są dostępne lokalnie w `vendor-licenses.txt`.
