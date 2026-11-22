# Cztery Łapy i Ty — czwarta propozycja

„Strona, która odpowiada”: zamiast zdjęcia w pierwszym ekranie jest zdanie na żywo — „Dziś przyjmujemy do 18:00.”, „Jutro przyjmujemy od 10:00.”, „Dziś święto. Zadzwoń przed wizytą.” — a pod nim telefon i dojazd. Reszta treści to siatka kafli. Adres publikacji po wypchnięciu na `main`: https://guziczak.github.io/4lapy4/

To niezależna propozycja obok `/4lapy2/` i `/4lapy3/`. Ma własne pliki i własny klucz preferencji. Dane, treść usług i mapa pochodzą z `/4lapy3/`.

## Zawartość

- `src/page.html` — jedyny szablon HTML dla obu języków.
- `src/content.json` — teksty PL i EN oraz wspólne dane (adresy URL, telefon, współrzędne).
- `tools/build.cjs` — generuje `index.html` i `en/index.html`. Bez zależności.
- `index.html`, `en/index.html` — **pliki generowane**; nie edytuj ich ręcznie.
- `site.js` — status otwarcia, kalendarz świąt, przypomnienie o szczepieniu, przełącznik motywu. Ten sam plik działa na stronie i w testach.
- `styles.css` — wygląd; pisany ręcznie, bez kompilacji i bez zagnieżdżeń.
- `tools/*.test.cjs` — testy logiki i wygenerowanych stron.
- `tools/og-card.html` — źródło obrazu podglądu linku `assets/og-card.png`.
- `assets/` — font Manrope z licencją OFL, mapa WebP, favicon, obraz podglądu.

## Praca ze stroną

```
node 4lapy4/tools/build.cjs                 # po każdej zmianie szablonu, treści, CSS lub JS
node --test "4lapy4/tools/*.test.cjs"       # 21 testów, bez przeglądarki i sieci
python -m http.server                       # z katalogu głównego repo → http://localhost:8000/4lapy4/
```

Budowanie wpisuje do HTML skróty treści `styles.css` i `site.js` jako parametr `?v=`, więc wersji nie zmienia się ręcznie. Test „the generated pages on disk are current” nie przejdzie, jeśli ktoś zmieni źródła i zapomni o budowaniu albo poprawi wygenerowany plik ręcznie.

Godziny otwarcia są zapisane raz, w tablicy `HOURS` w `site.js`. Z niej powstają: zdanie w hero, pasek tygodnia, lista godzin i dane strukturalne JSON-LD. Testy sprawdzają, że strona pokazuje te same godziny, których używa logika.

## Status na żywo

- Czas liczony jest zawsze w strefie Europe/Warsaw, niezależnie od urządzenia.
- Strona zna polskie dni ustawowo wolne, także ruchome (Wielkanoc, Poniedziałek Wielkanocny, Zielone Świątki, Boże Ciało) i Wigilię od 2025 r. W święto wypadające w dzień roboczy nigdy nie pisze „otwarte”: pokazuje „Dziś święto. Zadzwoń przed wizytą.”, a przy wyliczaniu najbliższego otwarcia święta pomija. Faktyczne godziny świąteczne przychodni nie są znane — to świadomie ostrożne założenie.
- Podgląd dowolnej chwili: `?czas=2026-11-23T11:30` (czas warszawski). Strona pokazuje wtedy plakietkę „Podgląd statusu dla: …”, żeby nie pomylić go ze stanem bieżącym. Przydatne do pokazania obu wariantów: otwarte (`…T11:30` w dzień roboczy), zamknięte (`2026-11-21T14:00`), święto (`2026-12-25T11:00`).
- Bez JavaScript w hero zostaje zdanie ze stałymi godzinami; telefon, dojazd, godziny i usługi działają normalnie. Formularz przypomnienia jest wtedy ukryty i zastąpiony krótką informacją.

## Wygląd

- Jeden krój: Manrope (zmienny, 200–800). Nagłówki w 800, tekst w 450.
- Zdanie w hero skaluje się do szerokości własnego kafla (jednostki `cqi`), nie do okna. Dłuższe zdania („Wracamy w poniedziałek…”) dostają mniejszy rozmiar; spacje nierozdzielające trzymają razem godzinę i „w poniedziałek”.
- Kolor jako płaszczyzny: złamana biel, prawie czarny atrament i mandarynka `#ff7a45`. Kafel hero jest mandarynkowy, gdy otwarte, i granatowy, gdy zamknięte lub święto.
- Motyw jasny/ciemny działa w samym CSS przez `light-dark()` i podąża za systemem. Ręczny wybór zapisuje się w `localStorage` pod kluczem `4lapy4-theme`. Przeglądarki bez `light-dark()` dostają motyw jasny, a przełącznik się nie pojawia.
- Na telefonie zamiast menu jest stały dolny pasek: Zadzwoń, Trasa, Godziny.
- Akordeon usług to natywne `<details name>`; animacja otwierania działa tam, gdzie przeglądarka obsługuje `interpolate-size`, a w pozostałych przełącza się natychmiast. Przed drukiem skrypt otwiera wszystkie grupy.
- Najmniejszy tekst ma 13 px; pilnuje tego test.

## Dane i prywatność

- Projekt poglądowy: widoczny pasek na górze, `noindex, nofollow`, wyjaśnienie w stopce. Godziny, usługi, ocena Google i dane kontaktowe pochodzą z publicznych źródeł (październik 2026) i wymagają potwierdzenia przez przychodnię.
- Strona nie używa zdjęć ani wizualizacji generowanych przez AI. W kaflu „Kto leczy” jest znak łapy; gdy przychodnia dostarczy portret, wystarczy podmienić zawartość elementu `.avatar` w `src/page.html`.
- Brak analityki, ciasteczek i zewnętrznych zasobów. Jedyne wyjścia do Google to linki klikane przez użytkownika: trasa, opinie i szablon wydarzenia w Kalendarzu Google. Plik `.ics` powstaje lokalnie.
- W `localStorage` zapisywany jest wyłącznie wybór motywu.

## Co celowo pominięto względem /4lapy3/

- Osadzana mapa Google po zgodzie — zastąpiona przyciskiem „Wyznacz trasę”.
- Zapis przez Google OAuth i okno dialogowe — zostały link do Kalendarza Google i plik `.ics`.
- Zapamiętywanie języka i przekierowania — adres decyduje o języku; link PL/EN zachowuje bieżącą sekcję.
- Własne mechanizmy przewijania, wejścia z kotwicą i choreografia zmiany języka — zostało domyślne przenikanie stron (`@view-transition`).

## Mapa i licencje

- `assets/map-wysoka-base*.webp` — te same pliki co w `/4lapy3/`, wyrenderowane z danych OpenStreetMap przez `4lapy3/tools/render_map.py`. Dane © autorzy OpenStreetMap, licencja ODbL. Strona kadruje bitmapę tak, żeby jej wypalona podziałka i podpis nie były widoczne, i pokazuje własny podpis z linkiem. Pinezka leży w środku obrazu, czyli w punkcie adresowym Chabrowa 2D.
- Manrope: SIL Open Font License 1.1, tekst w `assets/fonts/Manrope-OFL.txt`.

## Obraz podglądu linku

`assets/og-card.png` (1200 × 630) powstaje z `tools/og-card.html`:

```
msedge --headless=new --window-size=1200,630 --hide-scrollbars --screenshot=4lapy4/assets/og-card.png 4lapy4/tools/og-card.html
```

## Nie sprawdzono

Stronę oglądano w Chrome 158 na desktopie oraz w ramkach 320, 390 i 768 px, w obu motywach i bez JavaScript. Nie sprawdzono Safari i iOS, czytników ekranu, faktycznego pobrania pliku `.ics` ani otwarcia Kalendarza Google (pokrywają je testy jednostkowe) oraz przeglądarek wbudowanych w aplikacje.
