# Cztery Łapy i Ty — druga propozycja

Statyczna strona przychodni w nowej oprawie wizualnej. Adres publikacji: https://guziczak.github.io/4lapy2/

## Zawartość

- `index.html` — polska treść, semantyczny układ i formularz.
- `en/index.html` — pełna angielska wersja pod `/4lapy2/en/`, dostępna również bez JavaScript.
- `styles.css` — responsywny wygląd, jasny i ciemny motyw oraz obsługa ograniczenia ruchu.
- `preferences.js` — wybór i zapamiętywanie motywu oraz języka, wczesne ustawienie kolorów oraz dyskretne przejście przy przełączeniu PL/EN.
- `entry.js` — ustawienie sekcji z adresu przed pokazaniem treści przy pierwszym wczytaniu dokumentu.
- `site.js` — płynne akordeony usług, status otwarcia w Europe/Warsaw, menu, przypomnienia Google Calendar / ICS oraz mapa wczytywana po wyraźnej zgodzie. Teksty dynamiczne odpowiadają językowi dokumentu.
- `assets/` — lokalne zdjęcia i mapa WebP, fonty i licencje OFL.

Nie wymaga kompilacji ani bibliotek JavaScript. Katalog jest publikowany bezpośrednio przez istniejący GitHub Pages z gałęzi main.

## Język i wygląd

Przełączniki języka i motywu są stale widoczne w nagłówku, również na telefonie. Rozwijane menu zawiera wyłącznie nawigację do sekcji. Na telefonie kontakt pozostaje dostępny przez stały dolny przycisk „Umów wizytę”. Pierwszy wybór motywu odpowiada ustawieniu systemowemu. Ręczny wybór jasnego albo ciemnego motywu jest zapamiętywany na tym urządzeniu. Zmiana ustawienia systemowego wpływa na stronę tylko do momentu ręcznego wyboru.

Polska i angielska wersja mają osobne dokumenty HTML, wspólne style i skrypty oraz wzajemne odnośniki `hreflang`. Zmiana języka zachowuje bieżącą sekcję. Powrót na główny adres uwzględnia zapamiętany język; bez wcześniejszego wyboru strona otwiera się po polsku. Jawny wybór w przełączniku ma pierwszeństwo nad zapamiętaną preferencją.

Otwarcie strony z kotwicą, odświeżenie i zmiana języka pokazują wskazaną sekcję bez animowanego przewijania od góry. Płynny ruch jest włączany wyłącznie przy zwykłym kliknięciu lub aktywacji klawiaturą odnośnika do istniejącej sekcji w tym samym dokumencie. Nawigacja, fokus i historia pozostają natywne. Ustawienie jest czyszczone po nawigacji i przy przywracaniu strony z pamięci przeglądarki; preferencja ograniczenia ruchu wyłącza tę animację.

Przy wejściu z rozpoznaną kotwicą skrypt w nagłówku chwilowo wstrzymuje pokazanie treści, zachowując jej układ. Po parsowaniu dokumentu i krótkim oczekiwaniu na fonty ustawia sekcję bez animacji, a następnie odsłania ją bez wcześniejszego pokazania hero. Nie czeka na zdjęcia ani pełne zdarzenie `load`. Oczekiwanie na fonty ma limit 350 ms, a cała osłona bezwarunkowo znika po 1500 ms, błędzie lub działaniu użytkownika. Anulowanie unieważnia także późniejsze callbacki, aby nie przesuwały czytelnika. Zwykłe wejście na początek, nieznane kotwice i historia Wstecz/Dalej nie używają osłony. Mechanizm ustawia początek wskazanej sekcji; nie zapisuje własnej historii pozycji przewijania.

Po ręcznym przewinięciu na samą górę nieaktualny fragment adresu jest usuwany przez `replaceState`, bez dodawania wpisu do historii i bez zmiany parametrów adresu. Pozwala to odświeżyć początek strony bez powrotu do dawnej sekcji. Automatyczne wejście do kotwicy, samo dotknięcie ekranu oraz edycja pól formularza nie uruchamiają tego mechanizmu. Link językowy od razu uwzględnia oczyszczony adres. Gesty odświeżania i przewijania przeglądarki zachowują natywne działanie.

Zmiana języka korzysta z natywnych przejść między dokumentami (cross-document View Transitions), jeżeli przeglądarka je obsługuje. Stara treść unosi się o 4 px i znika, a nowa delikatnie opada do swojej pozycji; całość trwa 540 ms. Zanikanie i pojawianie się trwają równocześnie 400 ms, z łagodnym początkiem i końcem. Osobno animowany ruch nowej treści wyhamowuje przez 460 ms po krótkim opóźnieniu 80 ms. Mieszanie `plus-lighter` utrzymuje jasność wspólnego tła podczas przenikania widoków. Animowane są obrazy widoków, dzięki czemu rzeczywista geometria kotwicy pozostaje bez zmian. Nagłówek i dolny przycisk telefonu mają osobne, nieruchome widoki. Przejście jest uruchamiane tylko przez zwykły odnośnik PL/EN, bez opóźniania nawigacji, przechwytywania kliknięcia ani zapisu dodatkowych danych. Odświeżenia, Wstecz/Dalej i wejścia bezpośrednie zachowują zwykłe działanie.

Nowy widok językowy czeka na sparsowanie końca dokumentu przez `rel="expect"`, po czym `pagereveal` ustawia istniejącą kotwicę synchronicznie, przed przechwyceniem widoku. Gdy układ nie jest gotowy lub fonty jeszcze się ładują, animacja jest pomijana i działa sprawdzona osłona wejścia. Preferencja ograniczenia ruchu i brak obsługi API również pozostawiają zwykłą nawigację. Nie ma animacji wyjścia, która zostawiałaby pustą stronę podczas pobierania dokumentu.

Tłumaczenie obejmuje opisy usług, nawigację, etykiety dostępności, formularz, walidację, podgląd przypomnienia, wydarzenia Google Calendar i ICS oraz komunikaty mapy i godzin otwarcia. Nazwa przychodni i adres pozostają niezmienione. W obu językach godziny odnoszą się do Polski, a przypomnienie powstaje o 9:00 w strefie Europe/Warsaw, z uwzględnieniem czasu letniego i zimowego.

W `localStorage` zapisywane są wyłącznie preferencje `4lapy2-theme` i `4lapy2-language`. Wyłączenie tej pamięci nie blokuje strony ani jej przełączników. Dane formularza i zgoda na mapę nie są zapisywane.

## Dane i prywatność

Strona zachowuje dane kontaktowe, godziny i zakres usług z projektu /4lapy/. Dane pochodzą z publicznych źródeł oznaczonych jako październik 2026 i wymagają potwierdzenia przez przychodnię. Propozycja jest oznaczona jako poglądowa i ma noindex/nofollow.

Formularz nie wysyła i nie zapisuje danych na serwerze. Wybranie Google Calendar otwiera przygotowane wydarzenie w usłudze Google; ICS powstaje lokalnie. Oba warianty planują kontakt o 9:00 czasu polskiego przed terminem szczepienia. Brak analityki.

Podgląd przypomnienia stosuje tę samą walidację daty co eksport: po wybraniu przeszłego terminu od razu pokazuje ostrzeżenie, a komunikat przed przyciskami wyjaśnia, co poprawić. Gdy krótsze wyprzedzenie również nie jest już możliwe, formularz sugeruje kontakt telefoniczny. Powrót do karty ponownie sprawdza ważność daty; poprawa lub wyczyszczenie pola usuwa nieaktualny błąd. Pole daty zachowuje natywny systemowy kalendarz, a jego rozmiary i wyrównanie są dopasowane do pozostałych pól także w iOS.

Domyślny podgląd mapy jest lokalnym plikiem i nie łączy przeglądarki z dostawcą map. Iframe Google Maps powstaje dopiero po wybraniu przycisku „Zezwól na mapę Google”. Przycisk „Wyłącz mapę Google” usuwa iframe i przywraca statyczny podgląd. Zgoda obowiązuje tylko w bieżącym wyświetleniu strony; nie jest zapisywana w localStorage ani w cookies.

Akordeony zachowują semantykę natywnych details/summary. Animowana jest ich rzeczywista wysokość, również podczas zamykania i zmiany kierunku w trakcie ruchu. Zmiana szerokości lub wysokości treści aktualizuje cel animacji. Preferencja ograniczonego ruchu wyłącza animację; bez JavaScript akordeony nadal działają natywnie.

Wywieszka obok głównego przycisku kontaktu pokazuje najpierw bieżący status, a pod nim godzinę otwarcia lub zamknięcia. Kołysze się delikatnie tylko przy pierwszym pojawieniu się w widoku; preferencja ograniczonego ruchu pozostawia ją nieruchomą. Przypomnienie o szczepieniu znajduje się bezpośrednio po usługach, przed opiniami, i ma dodatkowy skrót w pasku najważniejszych informacji.

## Materiały wizualne

Tekst strony przedstawia lokalizację, lek. wet. Agnieszkę Janeczek oraz zakres usług. Zdjęcia pełnią rolę ilustracyjną; usunięto reklamowe podpisy na fotografiach i powtarzalne slogany. Na telefonie zdjęcie główne zachowuje pełny portret i naturalną wysokość, bez przycinania głów zwierząt.

Portrety psa i kota są ilustracyjnymi zdjęciami wygenerowanymi przy użyciu wbudowanego ImageGen. Nie przedstawiają personelu, wnętrza ani pacjentów przychodni.

Prompty: spokojny golden retriever i szary kot w pionowym portrecie na ciemnozielonym tle, naturalne ciepłe boczne światło, redakcyjna fotografia, realistyczna sierść, bez tekstów i logo; jasny kot delikatnie głaskany przez właściciela pod brodą, twarz człowieka poza kadrem, neutralne szałwiowe tło, miękkie dzienne światło, naturalna anatomia.

Fonty DM Serif Display i Manrope pobrano z Google Fonts. Licencje znajdują się w assets/fonts/.

Statyczna mapa `assets/map-wysoka.webp` powstała z rzeczywistych geometrii OpenStreetMap pobranych 19 listopada 2026. Użyty punkt adresowy Chabrowa 2D to [OSM node 12862580150](https://www.openstreetmap.org/node/12862580150), współrzędne 51.0480638, 16.9997411. Dane źródłowe: [OSM API, obszar Wysokiej](https://api.openstreetmap.org/api/0.6/map?bbox=16.9880,51.0435,17.0115,51.0526). Kartografia dopasowana do strony; dane © autorzy OpenStreetMap, [licencja ODbL](https://www.openstreetmap.org/copyright). Podgląd nie jest obrazem wygenerowanym przez model ani mapą Google.

Wariant `assets/map-wysoka-mobile.webp` pokazuje bliższy kadr dla telefonów. Generator `tools/render_map.py` odtwarza mapę z oficjalnego eksportu OSM; wymaga Pythona, Pillow i fontu DejaVu Sans. Uruchomienie: `python tools/render_map.py`, a wariant mobilny: `python tools/render_map.py --mobile`.

Na stronie tła `map-wysoka-base.webp` i `map-wysoka-base-mobile.webp` są połączone z tekstową etykietą oraz pinezką HTML/SVG. Nazwa ma 1.125rem, a adres 1.375rem, dzięki czemu nie maleją razem z bitmapą. Czubek znacznika jest zakotwiczony w środku obu map, czyli w zweryfikowanym punkcie adresowym. Tła odtwarza opcja `--background-only` generatora, opcjonalnie wraz z `--mobile`.
