# Cztery Łapy i Ty — piąta propozycja: „książeczka zdrowia”

Strona wygląda jak książeczka zdrowia zwierzaka, którą zna każdy opiekun: atramentowy granat na kremowym papierze, zdanie o godzinach zapisane na liniach, pieczątka „OTWARTE” albo „ZAMKNIĘTE”, rubryki z kropkami, data szczepienia w kratkach i adres jak emaliowana tabliczka z numerem domu. Adres publikacji: https://guziczak.github.io/4lapy5/

To niezależna propozycja obok `/4lapy2/`, `/4lapy3/` i `/4lapy4/`. Logika, testy i sposób budowania pochodzą z `/4lapy4/`; zmieniła się warstwa wizualna i kilka drobiazgów opisanych niżej.

## Zawartość

- `src/page.html` — jedyny szablon HTML dla obu języków.
- `src/content.json` — teksty PL i EN oraz wspólne dane (adresy URL, telefon, współrzędne).
- `tools/build.cjs` — generuje `index.html` i `en/index.html`. Bez zależności.
- `index.html`, `en/index.html` — **pliki generowane**; nie edytuj ich ręcznie.
- `site.js` — status otwarcia, kalendarz świąt, pieczątka, przypomnienie o szczepieniu, etykiety słupków, przełącznik motywu. Ten sam plik działa na stronie i w testach.
- `styles.css` — wygląd; pisany ręcznie, bez kompilacji i bez zagnieżdżeń.
- `tools/*.test.cjs` — testy logiki i wygenerowanych stron.
- `tools/og-card.html` — źródło obrazu podglądu linku `assets/og-card.png`.
- `assets/` — fonty z licencjami OFL, mapa WebP, favicon, obraz podglądu.

## Praca ze stroną

```
node 4lapy5/tools/build.cjs                 # po każdej zmianie szablonu, treści, CSS lub JS
node --test "4lapy5/tools/*.test.cjs"       # 33 testy, bez przeglądarki i sieci
python -m http.server                       # z katalogu głównego repo → http://localhost:8000/4lapy5/
```

Budowanie wpisuje do HTML skróty treści `styles.css` i `site.js` jako parametr `?v=`, więc wersji nie zmienia się ręcznie. **Po każdej zmianie trzeba przebudować i dopiero wtedy publikować** — test „the generated pages on disk are current” nie przejdzie, jeśli źródła i wygenerowane strony się rozjadą.

Godziny otwarcia są zapisane raz, w tablicy `HOURS` w `site.js`. Z niej powstają: zdanie w pierwszym kaflu, słupki tygodnia z etykietami, lista godzin i dane strukturalne JSON-LD.

## Elementy książeczki

- **Zdanie na liniach.** Najważniejsza informacja („Dziś przyjmujemy do 18:00.”) jest zapisana dużym krojem na liniaturze: pod każdym wierszem biegnie jedna linia (jednostka `lh`). Godzina jest zaznaczona zakreślaczem. Wcześniejsze faliste podkreślenie wyglądało jak znacznik błędu pisowni, dlatego go nie ma.
- **Pieczątka.** Okrągły stempel w SVG z jednym neutralnym słowem: „Otwarte”, „Zamknięte” albo „Święto” — zielony lub czerwony zależnie od stanu. Nierówne krawędzie i nierówny tusz daje filtr SVG. Na szerokim kaflu stoi w prawym dolnym rogu, tam gdzie formularze mają miejsce na pieczątkę; na telefonie w prawym górnym. **Pieczątka nigdy nie zawiera nazwiska ani niczego, co udawałoby pieczęć lekarza lub przychodni** — pilnuje tego test, a stopka mówi wprost, że to element graficzny.
- **Rubryki.** Kafle są ponumerowane jak rubryki formularza (01 · Godziny przyjęć …). Numery są w szablonie, nie w licznikach CSS: liczniki zerują się w kaflach będących kontenerami zapytań.
- **Słupki tygodnia.** Godziny przyjęć są zakreskowane długopisem, dzisiejszy słupek jest wypełniony, czerwona kreska pokazuje bieżącą godzinę. Najechanie na słupek pokazuje etykietę z dniem i godzinami; na ekranie dotykowym etykietę przypina stuknięcie, a zdejmuje drugie stuknięcie albo stuknięcie obok. Escape chowa etykietę. Słupki są ozdobnikiem (`aria-hidden`), a tę samą informację dla klawiatury i czytników ekranu niesie lista pod spodem.
- **Zakreślacz.** Żółty z granatowym pismem, taki sam w obu motywach: dzisiejszy dzień, dzisiejsze godziny, godzina w zdaniu, ocena.
- **Fajki.** Pozycje usług to drukowane kratki odhaczone odręcznie: fajka jest narysowanym pociągnięciem pióra (maska SVG), zaczyna się w kratce i wychodzi przez prawy górny róg; kolejne różnią się lekko kątem.
- **Wpis o szczepieniu.** Data pojawia się w kratkach cyfra po cyfrze już podczas wpisywania, a treść przypomnienia na „naklejce” z przerywaną ramką. W kratki można pisać bezpośrednio: kliknięcie albo stuknięcie zaczyna wpisywanie, kratka na następną cyfrę ma ramkę i kursor, Backspace kasuje od końca, wklejona data zastępuje całość. Data, której nie ma w kalendarzu, albo miniona zostaje w kratkach na czerwono. Technicznie nad kratkami leży niewidoczne pole tekstowe, które każdą zmianę oddaje polu „Data szczepienia” w formularzu, więc data ma jedno źródło. To pole nie jest przystankiem klawisza Tab (klawiatura trafia do pola w formularzu) i dzieli z nim etykietę.
- **Pole daty i kalendarz.** Systemowego okienka z datami nie da się ostylować, więc pole jest zwykłym polem tekstowym z klawiaturą numeryczną: datę wpisuje się jak w książeczce (`15032027`, `15.03.2027`, `1.3.2027` — kropki wstawiają się same). Własny kalendarz w formie kartki otwiera przycisk obok pola albo kliknięcie w samo pole: niedziele i polskie święta są na czerwono, dzisiejszy dzień zakreślony długopisem, wybrany zaznaczony zakreślaczem, minione dni nieaktywne. Po kliknięciu myszą kursor zostaje w polu, więc można pisać dalej, a kalendarz pokazuje wpisywaną datę; strzałka w dół przechodzi z pola do dni, pierwszy Enter chowa kalendarz i nie wysyła formularza, Tab idzie dalej. Na ekranie dotykowym pierwsze stuknięcie w pole pokazuje kalendarz bez klawiatury ekranowej, a drugie zamienia kalendarz na klawiaturę. W kalendarzu strzałki przechodzą po dniach i tygodniach, Home i End na krańce tygodnia, PageUp i PageDown zmieniają miesiąc (z Shift — rok), Escape zamyka. Data, której nie ma w kalendarzu (31.02), dostaje własny komunikat.
- **Tabliczka adresowa.** Granatowa emaliowana tabliczka „ul. Chabrowa 2D” na mapie; między mapą a adresem biegnie perforacja.
- **Mapa Google po zgodzie.** Pod mapą jest drukowana kratka „Pokaż mapę Google” z informacją, co się stanie. Dopiero jej odhaczenie (odręczną fajką, jak przy usługach) tworzy ramkę z mapą Google w miejscu mapy poglądowej; odznaczenie ją usuwa. Zgoda nie jest zapamiętywana: po odświeżeniu strona znów pokazuje mapę poglądową. Mapa Google jest wyższa od poglądowej, bo Google nakłada na nią własną kartę z adresem. Bez JavaScript kratki nie ma.
- **Nagłówek i dolny pasek.** Na telefonie nagłówek przewija się razem ze stroną, a trzy główne akcje (Zadzwoń, Trasa, Godziny) są w stałym pasku na dole — dwa stałe paski zabierałyby około jednej piątej małego ekranu. Od 720 px dolnego paska nie ma, więc nagłówek jest przyklejony do góry i ma numer telefonu; od 960 px także odnośniki do sekcji. Sekcje otwierane odnośnikiem zatrzymują się pod nagłówkiem, a to, co strona sama przewija do widoku (kalendarz, mapa Google), nad dolnym paskiem (`scroll-padding`).

## Status na żywo

- Czas liczony jest zawsze w strefie Europe/Warsaw, niezależnie od urządzenia.
- Strona zna polskie dni ustawowo wolne, także ruchome, i Wigilię od 2025 r. W święto wypadające w dzień roboczy nigdy nie pisze „otwarte”: pokazuje „Dziś święto. Zadzwoń przed wizytą.”, a przy wyliczaniu najbliższego otwarcia święta pomija. Faktyczne godziny świąteczne przychodni nie są znane — to świadomie ostrożne założenie.
- Podgląd dowolnej chwili: `?czas=2026-11-23T11:30` (czas warszawski); strona pokazuje wtedy ramkę „Podgląd statusu dla: …”. Otwarte: `…T11:30` w dzień roboczy, zamknięte: `2026-11-21T14:00`, święto: `2026-12-25T11:00`.
- Bez JavaScript zostaje zdanie ze stałymi godzinami, bez pieczątki; telefon, dojazd, godziny i usługi działają normalnie, a formularz przypomnienia jest zastąpiony krótką informacją.

## Kroje i kolory

- **Bricolage Grotesque** (800, zmienna szerokość, tu zwężony do 86%) — zdanie, tytuły, liczby, tabliczka. Pobrany jest tylko wariant nagłówkowy: 58 KB zamiast 181 KB pełnego pliku zmiennego.
- **Manrope** — tekst ciągły.
- **JetBrains Mono** — podpisy rubryk, daty, godziny, pieczątka.
- Motyw jasny: papier, biurko w kolorze manili, atrament. Motyw ciemny odwraca to w „kalkę techniczną”: jasny atrament na granatowym papierze. Działa w samym CSS przez `light-dark()` i podąża za systemem; ręczny wybór zapisuje się w `localStorage` pod kluczem `4lapy5-theme`.
- Najmniejszy tekst ma 13 px; pilnuje tego test.

## Dane i prywatność

- Projekt poglądowy: `noindex, nofollow` i wyjaśnienie w stopce (bez paska na górze strony). Godziny, usługi, ocena Google i dane kontaktowe pochodzą z publicznych źródeł (październik 2026) i wymagają potwierdzenia przez przychodnię.
- Strona nie używa zdjęć ani wizualizacji generowanych przez AI. W kaflu „Kto leczy” jest znak łapy; gdy przychodnia dostarczy portret, wystarczy podmienić zawartość elementu `.avatar` w `src/page.html`.
- Brak analityki i własnych ciasteczek; fonty są lokalne. Strona sama z siebie nie łączy się z żadnym zewnętrznym serwerem. Do Google prowadzą tylko rzeczy wybrane przez użytkownika: linki (trasa, opinie, szablon wydarzenia w Kalendarzu Google) oraz mapa Google, która wczytuje się dopiero po odhaczeniu zgody — wtedy Google poznaje adres IP i może zapisać własne pliki cookie. Ramka mapy ma `referrerpolicy="no-referrer"`. Plik `.ics` powstaje lokalnie.
- W `localStorage` zapisywany jest wyłącznie wybór motywu.

## Mapa i licencje

- `assets/map-wysoka-base*.webp` — te same pliki co w `/4lapy3/`, wyrenderowane z danych OpenStreetMap przez `4lapy3/tools/render_map.py`. Dane © autorzy OpenStreetMap, licencja ODbL. Strona kadruje bitmapę tak, żeby jej wypalona podziałka i podpis nie były widoczne, i pokazuje własny podpis z linkiem. Pinezka leży w środku obrazu, czyli w punkcie adresowym Chabrowa 2D.
- Mapa Google to ramka z adresem `https://www.google.com/maps?q=…&output=embed`, bez klucza API; adres jest w `src/content.json` (`mapEmbedUrl`), a język dopisuje skrypt. Ten sam wzorzec mają `/4lapy1/`, `/4lapy2/` i `/4lapy3/`.
- Fonty pobrano z Google Fonts; wszystkie na licencji SIL Open Font License 1.1, teksty licencji są w `assets/fonts/`.

## Obraz podglądu linku

`assets/og-card.png` (1200 × 630) powstaje z `tools/og-card.html`:

```
msedge --headless=new --window-size=1200,630 --hide-scrollbars --screenshot=4lapy5/assets/og-card.png 4lapy5/tools/og-card.html
```

## Nie sprawdzono

Stronę renderowano w Edge i Chrome 158: desktop, 1024, 768, 600, 390 i 320 px, oba motywy, oba języki, trzy stany pieczątki i tryb bez JavaScript. Nie sprawdzono Safari i iOS (w szczególności filtra SVG na pieczątce, maski z fajką, jednostki `lh` oraz wpisywania daty na klawiaturze telefonu), czytników ekranu, faktycznego pobrania pliku `.ics` ani otwarcia Kalendarza Google oraz przeglądarek wbudowanych w aplikacje. Otwieranie kalendarza kliknięciem i stuknięciem w pole oraz wpisywanie daty w kratki sprawdzono w Edge, dotyk w emulacji; nie sprawdzono na iPhonie (pierwsze stuknięcie w pole ma pokazać kalendarz bez klawiatury, stuknięcie w kratki ma otworzyć klawiaturę numeryczną) ani z klawiaturą ekranową Androida. Mapę Google sprawdzono w Edge i Chrome (wczytuje się po zgodzie w obu językach); nie sprawdzono jej na iPhonie ani w przeglądarkach blokujących treści Google, takich jak Brave, gdzie ramka może pozostać pusta.
