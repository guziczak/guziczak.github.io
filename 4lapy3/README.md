# Cztery Łapy i Ty — trzecia propozycja

Statyczna strona przychodni w ciepłej oprawie: kość słoniowa, atramentowy granat i przygaszona terakota. Adres publikacji: https://guziczak.github.io/4lapy3/

To niezależna propozycja, oparta na dopracowanej funkcjonalności poprzedniej wersji. Ma własne pliki, zasoby i klucze preferencji. Utworzenie tego katalogu nie zmienia poprzedniej strony pod `/4lapy2/`.

## Zawartość

- `index.html` — polska treść, semantyczny układ i formularz.
- `en/index.html` — pełna angielska wersja pod `/4lapy3/en/`, dostępna również bez JavaScript.
- `styles.css` — responsywny wygląd, jasny i ciemny motyw oraz obsługa ograniczenia ruchu.
- `preferences.js` — wybór i zapamiętywanie motywu oraz języka, wczesne ustawienie kolorów oraz dyskretne przejście przy przełączeniu PL/EN.
- `entry.js` — ustawienie sekcji z adresu przed pokazaniem treści przy pierwszym wczytaniu dokumentu.
- `site.js` — płynne akordeony usług, status otwarcia w Europe/Warsaw, menu, przypomnienia Google Calendar / ICS oraz mapa wczytywana po wyraźnej zgodzie. Teksty dynamiczne odpowiadają językowi dokumentu.
- `assets/` — lokalne zdjęcia i mapa WebP, fonty i licencje OFL.

Nie wymaga kompilacji ani bibliotek JavaScript. Katalog jest publikowany bezpośrednio przez istniejący GitHub Pages z gałęzi main.

## Język i wygląd

Przełączniki języka i motywu są stale widoczne w nagłówku, również na telefonie. Rozwijane menu zawiera wyłącznie nawigację do sekcji. Na telefonie kontakt pozostaje dostępny przez stały dolny przycisk „Umów wizytę”. Pierwszy wybór motywu odpowiada ustawieniu systemowemu. Ręczny wybór jasnego albo ciemnego motywu jest zapamiętywany na tym urządzeniu. Zmiana ustawienia systemowego wpływa na stronę tylko do momentu ręcznego wyboru.

Na ekranach do 1100 px menu otwiera się jako panel z większymi nazwami w kroju DM Serif Display i delikatnymi separatorami. Osobna warstwa przyciemnia pozostałą stronę, także dolny pasek kontaktu. Panel pojawia się przez 360 ms z ruchem 12 px, a zamyka przez 240 ms z ruchem 8 px; szybka zmiana kierunku zaczyna się od aktualnego położenia. Zamknięcie działa przyciskiem, kliknięciem tła i Escape. Klawiatura otwiera menu z fokusem na pierwszym odnośniku; wyjście fokusem poza nagłówek zamyka panel. Strona zachowuje semantykę nawigacji i zwykłych linków. Zmiana motywu pozostawia menu otwarte. Zmiana języka zamyka je synchronicznie przed przechwyceniem widoku, aby nie pozostawiać napisów starego menu nad nową stroną. Blokada przewijania nie zmienia pozycji dokumentu i jest zdejmowana przed nawigacją do sekcji. Ograniczenie ruchu wyłącza obie animacje.

Polska i angielska wersja mają osobne dokumenty HTML, wspólne style i skrypty oraz wzajemne odnośniki `hreflang`. Zmiana języka zachowuje bieżącą sekcję. Powrót na główny adres uwzględnia zapamiętany język; bez wcześniejszego wyboru strona otwiera się po polsku. Jawny wybór w przełączniku ma pierwszeństwo nad zapamiętaną preferencją.

Otwarcie strony z kotwicą, odświeżenie i zmiana języka pokazują wskazaną sekcję bez animowanego przewijania od góry. Płynny ruch jest włączany wyłącznie przy zwykłym kliknięciu lub aktywacji klawiaturą odnośnika do istniejącej sekcji w tym samym dokumencie. Nawigacja, fokus i historia pozostają natywne. Ustawienie jest czyszczone po nawigacji i przy przywracaniu strony z pamięci przeglądarki; preferencja ograniczenia ruchu wyłącza tę animację.

Przy wejściu z rozpoznaną kotwicą skrypt w nagłówku chwilowo wstrzymuje pokazanie treści, zachowując jej układ. Po parsowaniu dokumentu i krótkim oczekiwaniu na fonty ustawia sekcję bez animacji, a następnie odsłania ją bez wcześniejszego pokazania hero. Nie czeka na zdjęcia ani pełne zdarzenie `load`. Oczekiwanie na fonty ma limit 350 ms, a cała osłona bezwarunkowo znika po 1500 ms, błędzie lub działaniu użytkownika. Anulowanie unieważnia także późniejsze callbacki, aby nie przesuwały czytelnika. Zwykłe wejście na początek, nieznane kotwice i historia Wstecz/Dalej nie używają osłony. Mechanizm ustawia początek wskazanej sekcji; nie zapisuje własnej historii pozycji przewijania.

Po ręcznym przewinięciu na samą górę nieaktualny fragment adresu jest usuwany przez `replaceState`, bez dodawania wpisu do historii i bez zmiany parametrów adresu. Pozwala to odświeżyć początek strony bez powrotu do dawnej sekcji. Automatyczne wejście do kotwicy, samo dotknięcie ekranu oraz edycja pól formularza nie uruchamiają tego mechanizmu. Link językowy od razu uwzględnia oczyszczony adres. Gesty odświeżania i przewijania przeglądarki zachowują natywne działanie.

Zmiana języka korzysta z natywnych przejść między dokumentami (cross-document View Transitions), jeżeli przeglądarka je obsługuje. Tłumaczona treść główna unosi się o 10 px i zanika przez 280 ms, po czym nowa wersja pojawia się i opada do swojej pozycji przez 380 ms. Zdjęcie gabinetu, fotografia kota oraz podgląd mapy mają osobne, nieruchome warstwy: nie przesuwają się, nie zanikają i nie powtarzają animacji wejścia. Warstwy zdjęć są nad treścią, lecz pod przyklejonym nagłówkiem i dolnym przyciskiem kontaktu. Sam obraz hero nadal nie ma osobnej animacji przy wczytaniu strony. Tło nagłówka, logo i dolny przycisk telefonu mają osobne, nieruchome widoki. Etykiety nawigacji, oznaczenie EN/PL i tekst przycisku telefonu w nagłówku otrzymują własne, unikalne widoki z ruchem 3 px i tymi samymi etapami 280 + 380 ms. Dopisek pod logo ma osobny widok: stary tekst wygasa w miejscu przez 280 ms, a nowy odsłania się od lewej do prawej przez 380 ms, po zakończeniu wygaszania. Przesuwana maska gradientowa ma miękką krawędź 12 px; litery pozostają nieruchome i zachowują docelowy rozmiar. Początek maski w pełni ukrywa napis, a jej koniec odsłania go w całości. Reguły standardowe i z prefiksem WebKit obejmują oba języki; przy braku obsługi maski pozostaje odsłonięcie przez clip-path. Rozmiar i pozycja grupy napisu zmieniają się dopiero w niewidocznym momencie pomiędzy etapami, co zapobiega rozciąganiu liter przy różnej długości tłumaczeń. Przejście jest uruchamiane tylko przez zwykły odnośnik PL/EN, bez opóźniania nawigacji, przechwytywania kliknięcia ani zapisu dodatkowych danych. Odświeżenia, Wstecz/Dalej i wejścia bezpośrednie zachowują zwykłe działanie.

W pierwszej sekcji przyciski oraz wywieszka godzin mają nieruchome warstwy. Tło przycisku, ikona telefonu, podkreślenia linków, obrys i tło tabliczki, sznurek, gwóźdź oraz adres pozostają widoczne. Animują się tylko tłumaczone etykiety przycisków i komunikaty tabliczki (ruch 3 px, etapy 280 + 380 ms). Wspólna szerokość przycisku i osobna kolumna ikony stabilizują ich położenie; linki mają tę samą minimalną szerokość w obu językach. Na wąskich ekranach para CTA zawija się identycznie w PL i EN. Opis hero rezerwuje wysokość dłuższego tłumaczenia za pomocą niewidocznej warstwy CSS, dzięki czemu zmiana liczby wierszy nie przesuwa CTA i tabliczki. Szczegół godziny rezerwuje miejsce na dwa wiersze.

Przycisk telefonu w nagłówku rezerwuje miejsce na dłuższą angielską etykietę, gdy jest wyświetlany z tekstem (od 951 px). Dzięki temu ramka, ikona telefonu oraz przełączniki języka i motywu nie przesuwają się przy podmianie napisu. Węższe układy nadal korzystają z dotychczasowego przycisku ikony lub dolnego paska telefonu.

Nowy widok językowy czeka na sparsowanie końca dokumentu przez `rel="expect"`, po czym `pagereveal` ustawia istniejącą kotwicę synchronicznie, przed przechwyceniem widoku. Gdy układ nie jest gotowy lub fonty jeszcze się ładują, animacja jest pomijana i działa sprawdzona osłona wejścia. Preferencja ograniczenia ruchu i brak obsługi API również pozostawiają zwykłą nawigację. Nie ma animacji wyjścia, która zostawiałaby pustą stronę podczas pobierania dokumentu.

Tłumaczenie obejmuje opisy usług, nawigację, etykiety dostępności, formularz, walidację, podgląd przypomnienia, wydarzenia Google Calendar i ICS oraz komunikaty mapy i godzin otwarcia. Nazwa przychodni i adres pozostają niezmienione. W obu językach godziny odnoszą się do Polski, a przypomnienie powstaje o 9:00 w strefie Europe/Warsaw, z uwzględnieniem czasu letniego i zimowego.

W `localStorage` zapisywane są wyłącznie preferencje `4lapy3-theme` i `4lapy3-language`. Są niezależne od ustawień poprzedniej propozycji. Wyłączenie tej pamięci nie blokuje strony ani jej przełączników. Dane formularza i zgoda na mapę nie są zapisywane.

## Dane i prywatność

Strona zachowuje dane kontaktowe, godziny i zakres usług z projektu /4lapy/. Dane pochodzą z publicznych źródeł oznaczonych jako październik 2026 i wymagają potwierdzenia przez przychodnię. Propozycja jest oznaczona jako poglądowa i ma noindex/nofollow.

Formularz nie wysyła i nie zapisuje danych na serwerze. Wybranie Google Calendar otwiera przygotowane wydarzenie w usłudze Google; ICS powstaje lokalnie. Oba warianty planują kontakt o 9:00 czasu polskiego przed terminem szczepienia. Brak analityki.

Podgląd przypomnienia stosuje tę samą walidację daty co eksport: po wybraniu przeszłego terminu od razu pokazuje ostrzeżenie, a komunikat przed przyciskami wyjaśnia, co poprawić. Gdy krótsze wyprzedzenie również nie jest już możliwe, formularz sugeruje kontakt telefoniczny. Powrót do karty ponownie sprawdza ważność daty; poprawa lub wyczyszczenie pola usuwa nieaktualny błąd. Pole daty zachowuje natywny systemowy kalendarz, a jego rozmiary i wyrównanie są dopasowane do pozostałych pól także w iOS.

Domyślny podgląd mapy jest lokalnym plikiem i nie łączy przeglądarki z dostawcą map. Iframe Google Maps powstaje dopiero po wybraniu przycisku „Zezwól na mapę Google”. Przycisk „Wyłącz mapę Google” usuwa iframe i przywraca statyczny podgląd. Zgoda obowiązuje tylko w bieżącym wyświetleniu strony; nie jest zapisywana w localStorage ani w cookies.

Akordeony zachowują semantykę natywnych details/summary. Animowana jest ich rzeczywista wysokość, również podczas zamykania i zmiany kierunku w trakcie ruchu. Zmiana szerokości lub wysokości treści aktualizuje cel animacji. Preferencja ograniczonego ruchu wyłącza animację; bez JavaScript akordeony nadal działają natywnie.

Wywieszka obok głównego przycisku kontaktu pokazuje najpierw bieżący status, a pod nim godzinę otwarcia lub zamknięcia. Po pierwszym zwykłym pojawieniu się w widoku wykonuje łagodne, tłumione kołysanie przez 2,4 s. Kliknięcie, stuknięcie albo aktywacja klawiszem Enter/Spacja rozkołysze ją ponownie po zakończeniu poprzedniego ruchu. Sznurek i tabliczka obracają się razem wokół gwoździa; gwóźdź i adres są nieruchome. Wybór języka zatrzymuje kołysanie przed przechwyceniem widoku, a wejście do tłumaczenia pomija ponowne intro; po przejściu nadal można poruszyć tabliczką. Ukrycie strony przerywa ruch. Preferencja ograniczonego ruchu pozostawia wywieszkę nieruchomą i ukrywa przycisk do jej rozkołysania. Przycisk nie zmienia wyglądu szyldu; ma nazwę dostępną dla czytników ekranu oraz obrys przy obsłudze klawiaturą. Przypomnienie o szczepieniu znajduje się bezpośrednio po usługach, przed opiniami, i ma dodatkowy skrót w pasku najważniejszych informacji.

## Materiały wizualne

Tekst strony przedstawia lokalizację, lek. wet. Agnieszkę Janeczek oraz zakres usług. Główny obraz to wygenerowana przy użyciu wbudowanego ImageGen wizualizacja fikcyjnego gabinetu: kość słoniowa, jasny dąb, stół do badań, kompaktowy aparat USG, miękkie światło dzienne oraz drobne granatowo-terakotowe akcenty. W kadrze nie ma ludzi ani zwierząt. Nie jest to zdjęcie rzeczywistej przychodni ani dokumentacja jej wyposażenia.

Hero korzysta z plików `assets/hero-clinic.webp` (1536 × 1024 px) i `assets/hero-clinic-640.webp` (640 × 427 px), z responsywnym `srcset` i dopasowanym wstępnym ładowaniem. Pierwsza sekcja zaczyna się 28 px pod nagłówkiem strony (24 px na telefonie), bez dodatkowego pionowego paddingu kolumny tekstu. Na ekranach powyżej 1150 px zdjęcie zajmuje 58% dostępnej szerokości siatki i jest wyrównane do początku nagłówka, zamiast środka całej kolumny. Na mniejszych komputerach obie kolumny mają równą szerokość. Kadr pozostaje 4:3 na komputerze i pełny 3:2 na telefonie. Dobór źródła obrazu uwzględnia powiększenie 1,125 wynikające z desktopowego kadrowania, aby nie rozciągać zbyt małego pliku. Zaokrąglenie i obramowanie obejmują sam obraz. Kolor ramki korzysta ze zmiennych jasnego i ciemnego motywu.

Zdjęcie kota w sekcji o przychodni pozostaje ilustracją wygenerowaną przy użyciu ImageGen, z naturalną sierścią, miękkim dziennym światłem i ciepłym neutralnym tłem. Obrazy nie zawierają napisów ani logo i nie przedstawiają rzeczywistych pacjentów ani personelu przychodni. Informacja w stopce ujawnia pochodzenie obrazów oraz poglądowy charakter wnętrza. Poprzednie pliki `hero-pets` pozostają w zasobach, lecz nie są używane jako hero ani obraz udostępniania.

Fonty DM Serif Display i Manrope pobrano z Google Fonts. Licencje znajdują się w assets/fonts/.

Statyczna mapa `assets/map-wysoka.webp` powstała z rzeczywistych geometrii OpenStreetMap pobranych 19 listopada 2026. Użyty punkt adresowy Chabrowa 2D to [OSM node 12862580150](https://www.openstreetmap.org/node/12862580150), współrzędne 51.0480638, 16.9997411. Dane źródłowe: [OSM API, obszar Wysokiej](https://api.openstreetmap.org/api/0.6/map?bbox=16.9880,51.0435,17.0115,51.0526). Kartografia trzeciej propozycji została ponownie wyrenderowana z tych samych geometrii: neutralne ciepłe tło, atramentowe opisy, jasnoniebieska woda i stonowane obrysy zabudowy. Położenia, nazwy i skala pozostają zgodne z danymi źródłowymi; dane © autorzy OpenStreetMap, [licencja ODbL](https://www.openstreetmap.org/copyright). Podgląd nie jest obrazem wygenerowanym przez model ani mapą Google.

Wariant `assets/map-wysoka-mobile.webp` pokazuje bliższy kadr dla telefonów. Generator `tools/render_map.py` odtwarza mapę z oficjalnego eksportu OSM; wymaga Pythona, Pillow i fontu DejaVu Sans. Uruchomienie: `python tools/render_map.py`, a wariant mobilny: `python tools/render_map.py --mobile`.

Na stronie tła `map-wysoka-base.webp` i `map-wysoka-base-mobile.webp` są połączone z tekstową etykietą oraz pinezką HTML/SVG. Nazwa ma 1.125rem, a adres 1.375rem, dzięki czemu nie maleją razem z bitmapą. Czubek znacznika jest zakotwiczony w środku obu map, czyli w zweryfikowanym punkcie adresowym. Tła odtwarza opcja `--background-only` generatora, opcjonalnie wraz z `--mobile`.
