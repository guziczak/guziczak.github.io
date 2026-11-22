# Plik ↔ QR

Konwerter pojedynczych i animowanych kodów QR, działający lokalnie w przeglądarce. Adres: https://guziczak.github.io/wireguard-qr/

## Użycie

1. **Utwórz QR:** przeciągnij jeden lub kilka plików albo użyj przycisku wyboru. Kilka plików zostanie lokalnie skompresowanych do `pliki.zip` i wysłanych małą serią, jeśli archiwum zmieści się w jej limicie. Gotowe archiwum ZIP jest przesyłane bez ponownego pakowania. Pozostałe pliki do 2 953 bajtów otrzymują w trybie automatycznym zwykły QR, pliki do 10 MiB — serię w pamięci, a większe, do **200 MiB** — domyślnie duży transfer ze wznawianiem. Wyjątek: zaznaczona opcja **Zmniejsz pojedynczy plik serii przez ZIP** pozwala najpierw spróbować kompresji pojedynczego pliku do 32 MiB, także w przedziale 10–32 MiB. Jawny wybór dużego trybu zawsze pomija pakowanie i może być użyty również dla mniejszego pliku.
2. **Seria:** wybierz jeden kod albo **dwa kody obok siebie**, a następnie „Odtwórz serię”. Domyślne tempo to 2 zmiany obrazu/s, z wyborem **1/s, 2/s, 5/s, 10/s, 15/s i 20/s**. W układzie podwójnym jedna zmiana pokazuje parę niezależnych kodów, więc 5 par/s oznacza do 10 kodów/s. Dostępne są pauza, ręczny wybór części oraz „Duży widok QR”. Seria zaczyna w pauzie, a ukrycie karty zatrzymuje odtwarzanie. Warianty 15/s i 20/s najlepiej oceniać według rzeczywistego czasu odbioru lub próby ustawień.
3. **Odczytaj QR:** wybierz jeden lub wiele obrazów albo ustaw taki sam **Układ nadawcy** i uruchom kamerę. Dwa kody najwygodniej pokazać i skanować poziomo. Telefon może dołączyć w dowolnym momencie serii; opis pliku jest regularnie powtarzany. Odbiornik pokazuje przyrost niezależnych porcji danych, postęp składania oraz rzeczywistą szybkość odbioru. Po odtworzeniu całości i sprawdzeniu zgodności można pobrać plik.
4. **Reset odbioru:** odrzuć bieżący odbiór w pamięci. Zatrzymanie kamery i przełączanie zakładek zachowują postęp małej serii; odświeżenie strony go usuwa. Trwale zapisane segmenty dużego transferu pozostają dostępne po resecie.
5. **Wyczyść:** usuń pliki, fragmenty i wyniki z bieżącego widoku. Duże segmenty usuwa osobny przycisk **Usuń zapisany transfer**, po potwierdzeniu. Pobrane pliki i zrzuty ekranu usuwa się oddzielnie.

Dla konfiguracji WireGuarda **zwykły pojedynczy QR** zawiera bezpośrednio treść pliku klienta `.conf`, bez adresu strony, JSON, kodowania base64 ani własnego nagłówka. Aplikacja WireGuard może zeskanować go bezpośrednio. **Serię należy odebrać na tej stronie**, pobrać odtworzony `.conf`, a następnie zaimportować go z pliku w WireGuardzie. Skaner WireGuarda nie składa naszego formatu wieloczęściowego. Narzędzie nie konfiguruje serwera VPN i nie generuje kluczy.

Dostępne są przykłady pojedynczego QR, serii pięciu kodów danych (1 920 bajtów, 384 bajty na część), ZIP-a utworzonego z trzech plików, **Test 100 KiB** z powtarzalnymi danymi binarnymi oraz **Duży plik · 4 MiB**, składający się z dwóch segmentów dużego transferu. Serie obejmują też opisy i kody naprawcze, dlatego liczba widocznych QR może być większa od liczby części danych. Dane są demonstracyjne i nie zawierają działających kluczy VPN.

## Duży plik lub gotowy ZIP do 200 MiB

Duży tryb **v4** przenosi jeden wybrany plik przez QR, zachowując jego bajty. Limit **200 MiB (209 715 200 B)** dotyczy rozmiaru rzeczywiście wysyłanego pliku. Dla ZIP-a liczy się wielkość archiwum, niezależnie od liczby plików i rozmiaru po rozpakowaniu. Strona nie wyodrębnia jego zawartości i nie kompresuje go ponownie. Projekt z wieloma katalogami należy wcześniej zapakować na urządzeniu.

Plik dzielony jest na segmenty po **2 MiB**; ostatni może być krótszy. Nadajnik najpierw oblicza sumy segmentów, czytając je kolejno, a w czasie nadawania utrzymuje tylko bieżący segment. Odbiornik składa ten segment, sprawdza jego SHA-256 i zapisuje go lokalnie. Pamięć potrzebna do danych aktywnego dekodera zależy od rozmiaru segmentu. Pełne 200 MiB nie jest składane w jednym buforze RAM.

### Rozpoczęcie i odbiór

1. Na nadajniku wybierz jeden gotowy plik. Tryb automatyczny domyślnie przechodzi na duży transfer powyżej 10 MiB. Przy włączonej opcji kompresji plik do 32 MiB może najpierw przejść próbę pakowania do małej serii; gotowy ZIP nie jest rekompresowany. Jawny wybór dużego trybu zawsze przesyła oryginał bez pakowania i umożliwia próbę na mniejszym pliku, np. **Duży plik · 4 MiB**.
2. Na odbiorniku wybierz **Włącz zapis i wznawianie**. W ten sposób włączasz przechowywanie odebranych segmentów w lokalnym magazynie tej strony — OPFS. Aplikacja sprawdza dostępność zapisu i blokady chroniącej przed jednoczesnym użyciem magazynu przez drugą kartę.
3. Wybierz zgodny układ jednego lub dwóch kodów, uruchom kamerę i odtwarzanie. Można wcześniej dobrać tempo próbą; w dużym trybie jej syntetyczne kody mają taki sam narzut jak pakiety v4.
4. Obserwuj oddzielnie **trwale zapisane segmenty** oraz postęp bieżącego segmentu. Za ukończony uznawany jest dopiero segment sprawdzony i zapisany. Zwrotny QR potwierdza wyłącznie takie segmenty.
5. Po odebraniu wszystkich segmentów strona sprawdza ich uporządkowaną sumę i sekwencyjnie tworzy końcowy plik. Pobieranie staje się dostępne po zakończeniu sprawdzania i zapisu.

Domyślnie nadajnik przechodzi między segmentami automatycznie. Dla każdego pokazuje wszystkie porcje źródłowe, następnie wybrany **Zapas kodów naprawczych na część**: **25%, 50% lub 100%** liczby porcji źródłowych, z zaokrągleniem w górę. Domyślne 100% oznacza tyle samo napraw co danych. Potem wybiera kolejny segment i cyklicznie wraca do wcześniejszych. Manifesty są dodatkowe. Mniejszy zapas skraca przebieg, ale może pozostawić więcej nieukończonych segmentów. Wyłączenie automatycznego przechodzenia zatrzymuje nadajnik na bieżącym segmencie i pozwala kontynuować jego naprawę bez limitu; dostępny jest też wybór segmentu ręcznie.

Po przekazaniu zbiorczego QR z postępem nadajnik wybiera wyłącznie brakujące segmenty. Jeśli pozostał tylko jeden, prowadzi jego naprawę bez automatycznego opuszczania go. Skończony przebieg naprawczy nie gwarantuje, że segment dotarł: potwierdza to dopiero zapis po stronie odbiornika. Przechodzenie między nieukończonymi segmentami może odrzucić ich częściowy stan w RAM, dlatego przy słabym odczycie warto zatrzymać się na jednym i zmniejszyć tempo.

### Wznawianie po przerwie

Na odbiorniku użyj **Wznów zapisany transfer**. Strona ponownie sprawdzi zapisane segmenty; uszkodzone lub niekompletne nie są potwierdzane jako odebrane. Na nadajniku ponownie wybierz **dokładnie ten sam plik z tą samą nazwą**, a następnie przekaż mu QR z listą braków. Tożsamość całego pliku pozostaje stała również po zmianie gęstości 384/600 B, tempa, układu kodów lub ponownym otwarciu strony. Nowa wewnętrzna sesja segmentu może odrzucić częściowy postęp aktualnej części, ale nie usuwa wcześniej zapisanych segmentów.

Po zamknięciu strony mogą przepaść nieukończone dane bieżącego segmentu. **Reset odbioru** i **Wyczyść** nie kasują trwałych segmentów. Służy do tego **Usuń zapisany transfer**, wymagający osobnego potwierdzenia. Opuszczenie strony zwalnia blokadę magazynu, zachowując zatwierdzone dane. Wyczyszczenie danych witryny w przeglądarce również usuwa możliwość wznowienia.

Tożsamość v4 jest SHA-256 kanonicznego opisu i uporządkowanych sum SHA-256 segmentów. **Nie jest zwykłym SHA-256 całego pliku**. Końcowa kontrola sprawdza tę tożsamość oraz faktycznie zapisane bajty wszystkich segmentów.

### Miejsce i obsługa przeglądarki

Magazyn zachowuje segmenty oraz złożony wynik, dlatego potrzebne jest około **dwukrotności rozmiaru pliku i dodatkowy zapas** — dla 200 MiB około 400 MiB oraz miejsce na metadane i pracę przeglądarki. Pobranie kopii pliku może wymagać kolejnego miejsca w zwykłym katalogu pobierania. Limit miejsca, tryb prywatny oraz polityka przechowywania danych witryny mogą wpływać na dostępność zapisu.

Duży odbiór wymaga dostępnego OPFS z `createWritable()` oraz Web Locks. Aplikacja sprawdza te możliwości przed rozpoczęciem i zgłasza niedostępność zamiast pozornie rozpoczynać trwały zapis. Nie ma gwarancji obsługi każdego Safari, telefonu ani wbudowanej przeglądarki aplikacji; najpierw sprawdź próbkę 4 MiB na swoich urządzeniach. Mała seria pozostaje dostępna bez trwałego magazynu.

Segmenty i wznawianie umożliwiają kontynuowanie długiego odbioru. Prędkość nadal wyznaczają ekran, kamera i skuteczność rozpoznawania QR. Domyślny przebieg z równą liczbą danych i napraw wysyła znacznie więcej symboli niż sam plik; przy dużych archiwach trzeba liczyć się z wielogodzinnym transferem.

## Dwa kody i dobieranie ustawień

**Dwa kody obok siebie** to dwa zwykłe, kwadratowe QR z różnymi pakietami jednej serii. Odbiornik śledzi je oddzielnie i przyjmuje każdy poprawny odczyt niezależnie. Nie trzeba odczytać obu kodów z pary jednocześnie. Pobranie klatki PNG zapisuje obydwa kody, a import takiego obrazu odczytuje je niezależnie. Tryb podwójny najlepiej wykorzystuje szeroki ekran i kadr kamery; pozostawienie dwóch małych kodów w pionowym widoku może utrudnić odczyt.

Dwa kody nie gwarantują podwojenia transferu. Przykładowo 2 × 384 B przy 5 parach/s daje nominalnie 3 840 B/s porcji danych — tyle samo co jeden kod po 384 B przy 10 kodach/s. Zaletą pary może być dłuższa obecność każdego kodu na ekranie. Kody opisujące plik, pominięte odczyty i zależne równania zmniejszają skuteczną szybkość. Porównuj czas odbioru tego samego pliku do końcowej weryfikacji.

Przycisk **Dobierz tempo i gęstość** przeprowadza próbę na danych syntetycznych, bez zawartości wybranego pliku:

1. Przygotuj serię na nadajniku, wybierz układ jednego lub dwóch kodów oraz korekcję M albo L.
2. Na odbiorniku wybierz ten sam układ i uruchom kamerę, pozostawiając kody nadajnika poza kadrem. Jeśli wcześniej odebrano fragment pliku, najpierw użyj **Reset odbioru**.
3. Na nadajniku ustaw **Zakres próby** i wybierz **Dobierz tempo i gęstość**. Domyślny zakres **Pełny** porównuje dziesięć profili: 384 i 600 B na kod, każdy przy 2, 5, 10, 15 i 20 zmianach obrazu/s. Każdy profil trwa nominalnie 4 sekundy, łącznie około **40 sekund**. Zakres **Podstawowy** pozostaje przy sześciu profilach — 384 i 600 B przy 2, 5 i 10 zmianach/s — i trwa około **24 sekund**. Układ kodów i wybrana korekcja są stałe przez całą próbę. Po uruchomieniu próby skieruj na nią kamerę odbiornika; nie rozpoczynaj od skanowania zwykłych fragmentów pliku.
4. Na odbiorniku wybierz **Pokaż wynik nadajnikowi**, a na nadajniku **Zeskanuj potwierdzenie**. Wynik przekazujesz QR-em, bez połączenia sieciowego. Nadajnik przyjmuje tylko wynik swojej bieżącej próby.
5. Przyjęcie profilu przygotowuje nową serię. Na odbiorniku wybierz **Wróć do skanowania**, a na nadajniku **Odtwórz serię**. Dla małej serii, jeśli wcześniej odbierano już plik, użyj najpierw **Reset odbioru**: jej fragmentów sprzed zmiany gęstości nie można połączyć z nową sesją. W dużym transferze v4 zweryfikowane i zapisane segmenty pozostają zgodne po zmianie gęstości; od początku może być składany tylko bieżący nieukończony segment. Przekaż kod braków, aby nadajnik pominął zapisane części.

Wynik wybiera spośród przetestowanych profili na podstawie nowych odczytanych danych testowych. Krótka próba nie gwarantuje najlepszego ustawienia dla każdego pliku i warunków; po zmianie odległości, oświetlenia, układu lub korekcji warto powtórzyć pomiar. Zbyt mała liczba odczytów nie wystarcza do wskazania profilu. **Zatrzymaj próbę** przerywa dobieranie ustawień. Po ponownym rozpoczęciu przerwanej próby użyj **Zresetuj próbę** na odbiorniku. Ręczna zmiana kadru kamery lub układu odbioru usuwa pomiary wcześniejszej próby. Pełny zakres używa ramek CAL/SET v2, a podstawowy zachowuje CAL/SET v1; obie strony muszą obsługiwać wybrany zakres. Dla dużego transferu próba używa większych pakietów 476/692 B i osobnego znacznika, aby dobór uwzględniał narzut v4; stare strony wymagają odświeżenia.

W **Odporność kodów serii** domyślna korekcja **M** zapewnia większą nadmiarowość wewnątrz QR. Eksperymentalne **L** może dla tej samej porcji danych zmniejszyć liczbę modułów, kosztem słabszej korekcji uszkodzonych fragmentów obrazu. To odrębna warstwa od kodów naprawczych całej serii. Próba dobiera tempo i gęstość dla aktualnie wybranego M/L; nie przełącza automatycznie poziomu korekcji.

**Kadr kamery** oferuje **Automatycznie**, **Szeroki · 16:9** i **Klasyczny · 4:3**. Są to preferencje przekazywane przeglądarce, a nie gwarancja trybu sensora. Diagnostyka zapisuje rozdzielczość i FPS zgłoszone przez kamerę przy uruchomieniu. Pod podglądem pokazywane są aktualne wymiary obrazu video, które mogą zmieniać się po obróceniu telefonu. Proporcje kadru nie zmieniają kwadratowego kształtu QR.

Podgląd kamery oraz odczytu potwierdzenia zachowuje proporcje aktualnych `videoWidth` i `videoHeight`. Jego szerokość i wysokość dopasowują się razem do dostępnego miejsca, także po obrocie telefonu albo zmianie wielkości okna. Jedna obwódka oznacza obszar podglądu; nie trzeba trafiać kodami w dwa osobne pola. Skaner szuka dwóch symboli zarówno obok siebie, jak i jeden nad drugim oraz odczytuje kody obrócone o 90°. Obrót urządzenia i zmiana rozmiaru podglądu nie uruchamiają ponownie kamery ani nie resetują odebranych danych. Aparat warto skierować na wprost ekranu i zmieścić całe białe marginesy; ułożenie telefonu pionowo lub poziomo pozostaje wyborem użytkownika.

### Jak porównać szybkość na swoich urządzeniach

1. Wybierz ten sam niepoufny plik większy niż 2 953 B, np. kilkadziesiąt KiB. Zachowaj ten sam stan opcji kompresji, korekcję, gęstość, jasność ekranu i położenie urządzeń. Włącz duży widok QR i zmieść całe białe marginesy w kadrze.
2. Odbierz plik w układzie jednego kodu. Zapisz **czas do ukończenia i sprawdzenia całości**, średnią prędkość oraz rzeczywiste tempo nadawcy. Wybierz **Kopiuj diagnostykę** po zakończeniu.
3. Użyj **Reset odbioru**, ustaw dwa kody na obu urządzeniach i odbierz ten sam plik ponownie. Porównanie jednego kodu przy 10/s z parą przy 5/s utrzymuje tę samą nominalną liczbę kodów/s; osobno można przeprowadzić próbę ustawień dla każdego układu i porównać najlepsze znalezione profile.
4. Powtórz każdy wariant trzy razy i porównaj środkowy wynik. Przy zgłaszaniu wyników dołącz ustawienia obu prób oraz ich raporty diagnostyczne. Sama liczba rozpoznanych QR lub ustawione 20/s nie opisuje czasu potrzebnego do odzyskania pliku.

## Odbiór przy pomijaniu klatek

Nowe małe serie używają kompaktowego protokołu **v3**; duże korzystają z tych samych równań wewnątrz segmentów otoczonych ramką **v4**. Nazwa, rozmiar, SHA-256 i wymiary małego transferu znajdują się w osobnym opisie pliku — manifeście. Nadajnik pokazuje go na początku i ponownie po każdych 16 pakietach danych lub naprawy. Zwykły pakiet v3 ma tylko 36 bajtów nagłówka i 4 bajty CRC32 poza porcją danych, zamiast powtarzać pełne metadane w każdym QR. Odbiornik, który dołącza w trakcie, czeka na kolejny manifest; wcześniejsze pakiety nie są buforowane ani zaliczane jako postęp.

V3 zachowuje systematyczne kody fountain oparte na równaniach XOR, w blokach po najwyżej 32 porcje. Najpierw nadawane są części źródłowe, następnie nowe kody naprawcze. **Części źródłowe są przeplatane między blokami**: najpierw po jednej z każdego bloku, potem kolejne. Krótka przerwa w odczycie rozkłada więc braki między blokami, zamiast pomijać wiele sąsiednich porcji jednego bloku. Zmiana kolejności nie zwiększa liczby pakietów ani nie zmienia formatu v3. Ręczny wybór fragmentu nadal odnosi się do jego położenia w pliku.

Odbiornik zwiększa postęp tylko dla niezależnych równań. Po uzyskaniu pełnego rzędu dla bloku odtwarza jego części, także te, których oryginalnych kodów nie odczytał. Powtórzenia lub zależne równania są pomijane. Po odebraniu manifestu można odtworzyć plik również z samych kodów naprawczych. Nie oznacza to gwarancji odzyskania po dowolnej ustalonej liczbie klatek; potrzeba dostatecznie wielu niezależnych odczytów.

**Uzupełnij brakujące** na odbiorniku zatrzymuje kamerę i tworzy QR z potwierdzeniem postępu. Na nadajniku przycisk **Zeskanuj potwierdzenie** pozwala odczytać ten kod kamerą albo wczytać jego obraz. Potwierdzenie zawiera identyfikację bieżącego transferu, bitmapę ukończonych bloków oraz wskazówkę tempa. W v3 dodatkowo wskazuje potrzebne porcje w maksymalnie 16 nieukończonych blokach i może zalecać tempo 1, 2, 5, 10, 15 albo 20 zmian/s. Potwierdzenia starszych serii zachowują zestaw 1, 2, 5 i 10 zmian/s. Nadajnik najpierw wysyła wskazane porcje, a następnie kody naprawcze tylko dla nieukończonych bloków. Odtwarzanie wznawia użytkownik. Ukończenie całego pliku jest potwierdzane dopiero po zgodnym SHA-256. Potwierdzenie innej sesji jest odrzucane.

Jest to synchronizacja po przekazaniu potwierdzenia, bez ukrytego kanału sieciowego. Gdy telefon używa tylnej kamery, na czas pokazania potwierdzenia trzeba odwrócić go ekranem do kamery nadajnika. Następnie **Wróć do skanowania** przywraca odbiór z zachowanym postępem.

Skaner po znalezieniu QR śledzi jego położenie i analizuje wycinek z zapasem wokół kodu. W trybie podwójnym każdy symbol ma osobne śledzenie. Rozdzielczość stabilnego wycinka jest dobierana do wielkości modułów i czasu dekodowania; nieudany odczyt przywraca dokładniejszą analizę. Po utracie kodu skaner przeszukuje obraz ponownie, również w wyższej rozdzielczości. Płótna są ponownie wymiarowane tylko przy zmianie potrzebnego rozmiaru. Czarne kody na białym tle używają szybkiej ścieżki dekodowania; ponowne wyszukiwanie i import obrazów zachowują obsługę odwróconych kodów.

Dekodowanie może działać w lokalnym workerze, który korzysta z tego samego jsQR i zwraca oryginalne bajty. Bufory pikseli RGBA są przekazywane do workera przez transfer własności, zamiast kopiowania ich przy każdym odczycie. W trybie podwójnym skaner zamraża jeden obraz obejmujący oba potrzebne wycinki, a przy stabilnym śledzeniu pomija pozostałą część kadru. Oba kody nadal pochodzą z tej samej klatki. Identyczne wycinki podczas ponownego wyszukiwania są dekodowane tylko raz. Gdy worker jest niedostępny albo zawiedzie, skaner dekoduje w głównym wątku te same zachowane obrazy wycinków. Nie ma kolejki starych klatek ani konwersji binarnej zawartości QR na tekst.

**Nadawca również używa lokalnego workera**, który przygotowuje matryce kolejnych kodów poza głównym wątkiem. Przygotowanie jest asynchroniczne i ograniczone do jednej paczki jednego lub dwóch kodów naraz; bufor odtwarzania mieści najwyżej trzy gotowe widoki z wyprzedzeniem. Pauza lub zmiana źródła unieważnia nieukończone przygotowanie. Przy braku workera lub jego błędzie dostępne jest kodowanie w głównym wątku. Wyświetlanie odbywa się w rytmie ekranu; renderer dobiera całkowitą liczbę pikseli na moduł i zachowuje czteromodułowy biały margines. Te zmiany zmniejszają pracę wykonywaną przy przełączaniu obrazów, ale nie przesądzają o szybkości fizycznego odczytu kamerą.

## Statystyki odbioru i diagnostyka

Panel **Statystyki odbioru** znajduje się przy odzyskanym pliku. Pokazuje czas odbioru, liczbę nowych porcji danych oraz odczytanych QR; po zakończeniu także średnią prędkość. Wyniki pozostają widoczne po zatrzymaniu kamery i odebraniu całości. Pauza, pokazanie zwrotnego QR i wznowienie zachowują pomiar. Reset odbioru lub wyczyszczenie strony usuwa go.

W małej serii czas odbioru biegnie od pierwszego zaakceptowanego fragmentu do zakończenia weryfikacji pliku, razem z przerwami. Średnia prędkość kompletnej małej serii to rozmiar pliku podzielony przez ten czas. Przy pojedynczym natychmiastowym odczycie prędkość może pozostać niedostępna. To pomiar odbioru, a nie tempa wyświetlania kodów na drugim urządzeniu.

W dużym transferze v4 prędkość oznacza **bajty nowo zapisane w bieżącej sesji podzielone przez czas tej sesji**: `(savedBytes - restoredBytes) / czas_w_sekundach`. Segmenty przywrócone z magazynu nie zawyżają wyniku. Punkt początkowy zapisanych bajtów jest odtwarzany także po **Reset odbioru** lub **Wyczyść** i bezpośrednim powrocie do skanowania, bez użycia przycisku wznawiania. Raport wskazuje osobno zapisane bajty, przywrócone bajty oraz nietrwały postęp aktualnego segmentu. Nie odtwarza czasu wcześniejszych sesji z zakończonych już zapisów.

Panel nadawcy osobno pokazuje rzeczywiste tempo wyświetlania i czas przygotowania klatki. W trybie podwójnym rozróżnia pary/s i kody/s. Ustawione tempo jest celem; wolniejsze kodowanie lub obciążenie przeglądarki może obniżyć liczbę wyświetlonych obrazów.

Szczegóły rozdzielają próby odczytu kamery i poprawnie rozpoznane QR. W małej serii rozróżniają też pakiety dodające nowe niezależne dane i pakiety bez nowych danych; do tych drugich należą powtórzenia oraz zależne równania naprawcze. W v4 licznik użytecznych jednostek postępu oznacza **zapisane segmenty**. Pakiety, które zwiększają rangę bieżącego segmentu, są nadal użyteczne przed jego zatwierdzeniem, chociaż nie zwiększają jeszcze licznika trwale zapisanych części ani bajtów. Nieudana próba rozpoznania obrazu nie oznacza zgubienia osobnego kodu nadawcy. Parametry obrazu i czas analizy klatki pomagają ocenić skaner; zgłoszone przez kamerę FPS nie są gwarancją takiej liczby skutecznych odczytów.

Przycisk **Kopiuj diagnostykę** tworzy lokalny raport JSON z wersją aplikacji, licznikami, czasami oraz parametrami transferu i obrazu. Raport nie zawiera nazwy, treści, kluczy, identyfikatora ani sumy pliku, adresu IP czy identyfikatora urządzenia. Nie odczytujemy User-Agent. Gdy schowek jest niedostępny, aplikacja pokazuje tekst do ręcznego skopiowania. Raport nie jest automatycznie wysyłany ani utrwalany. W dużym trybie osobno zapisywane są plik i postęp potrzebne do wznowienia.

## Kompresja pojedynczego pliku i paczki ZIP

Opcja **Zmniejsz pojedynczy plik serii przez ZIP** jest domyślnie wyłączona. Po jej włączeniu pojedynczy plik przeznaczony do serii jest kompresowany lokalnie, a archiwum zastępuje oryginał w transferze tylko wtedy, gdy oszczędza **co najmniej 5% i co najmniej 128 bajtów**, z uwzględnieniem nagłówków ZIP-a. Przy mniejszej korzyści wysyłany jest oryginalny plik. Mały plik do 2 953 B w trybie automatycznym oraz tryb **Jeden QR — WireGuard** zachowują bezpośrednią treść QR. Gotowy ZIP nie jest ponownie pakowany.

Gdy kompresja zostanie użyta w małej serii, interfejs pokazuje archiwum jako wysyłany plik. **Odbiornik pobiera ZIP**, który trzeba rozpakować na urządzeniu; strona nie rozpakowuje go automatycznie. Dotyczy to także konfiguracji `.conf` wysłanej jako skompresowana seria — do WireGuarda importuje się plik wyjęty z archiwum. Limity mechanizmu pakowania pozostają **32 MiB wejścia** oraz **10 MiB gotowego archiwum**. W trybie automatycznym z zaznaczoną kompresją również plik 10–32 MiB może najpierw zostać spakowany do małej serii. Gdy pakowanie przekracza swój limit, wybierz jawnie duży transfer, aby wysłać oryginał. Przy wyłączonej kompresji albo wejściu większym niż 32 MiB plik powyżej 10 MiB trafia bezpośrednio do dużego transferu. Jawny duży tryb zawsze omija kompresję, a gotowe archiwa ZIP nigdy nie są ponownie pakowane.

Wybór lub przeciągnięcie co najmniej dwóch plików uruchamia kompresję ZIP w przeglądarce. Po spakowaniu interfejs pokazuje nazwy plików i rozmiar gotowego archiwum. Przycisk **Pobierz ZIP** pozwala zachować kopię po stronie nadawcy. Odbiornik pobiera jedno archiwum, które rozpakowuje się standardowymi narzędziami urządzenia; strona nie wyodrębnia ani nie uruchamia zawartości archiwów.

Do pakowania można wybrać maksymalnie **100 plików** o łącznym rozmiarze do **32 MiB przed kompresją**. Gotowy ZIP musi mieć najwyżej **10 MiB**, razem z nagłówkami i nazwami. Kompresja może pozwolić na wysłanie większej ilości tekstu; dane już skompresowane mogą się niewiele zmniejszyć. Pliki zbyt duże po spakowaniu są odrzucane przed tworzeniem serii QR.

Pliki znajdują się w głównym katalogu ZIP-a. Nazwy są oczyszczane z elementów ścieżek i niedozwolonych znaków. Powtarzające się nazwy dostają numery, aby nie zastępować innych wpisów. Zawartość każdego pliku jest zachowana bajt po bajcie, także dla pustych plików wewnątrz paczki. ZIP nie jest szyfrowany.

## Prywatność i granice

- Mała seria odczytuje plik przez `File.arrayBuffer()` i przechowuje dane w RAM. Duży nadajnik odczytuje `File.slice()` segmentami po 2 MiB. Kodowanie, odczyt obrazów i skanowanie kamery wykonuje przeglądarka.
- Brak wysyłania danych, analityki sieciowej, cookies, localStorage, IndexedDB, zdalnej telemetrii i skryptów pobieranych z CDN. Biblioteki są dołączone lokalnie w `assets/`. Liczniki diagnostyczne pozostają w pamięci strony; użytkownik może je skopiować.
- Mały tryb nie utrwala plików w magazynie witryny. **Duży odbiór po jawnym włączeniu zapisu przechowuje lokalnie w OPFS nazwę, opis, sumy kontrolne, zweryfikowane segmenty i wynik**, aby umożliwić wznowienie. Te dane pozostają po zamknięciu strony do ich usunięcia w aplikacji lub przez przeglądarkę. Nie są przesyłane na serwer.
- Polityka CSP blokuje połączenia `connect-src`, zewnętrzne skrypty, formularze i obiekty. GitHub Pages otrzymuje zwykłe żądania pobrania plików strony; zawartość konfiguracji nie trafia do tych żądań.
- Kamera wymaga HTTPS i zgody użytkownika. Uruchamia się wyłącznie przyciskiem i zatrzymuje po odebraniu całego pliku, ręcznym zatrzymaniu, zmianie trybu, ukryciu strony lub jej opuszczeniu. Przy serii pozostaje aktywna po pierwszym fragmencie. Wczytanie obrazów jest alternatywą dla kamery.
- Seria i zwrotne potwierdzenia pozostają lokalne. Pakiet v3 zawiera identyfikator transferu i CRC32; metadane oraz SHA-256 pliku są w manifeście. V4 dodatkowo wiąże segment z całością przez uporządkowaną sumę segmentów. Odbiornik nie łączy obcych plików i udostępnia wynik po sprawdzeniu całości. Sumy kontrolne służą wykrywaniu błędów; nie są szyfrowaniem ani uwierzytelnieniem nadawcy. Potwierdzenie także nie stanowi kryptograficznego uwierzytelnienia urządzenia.
- Próba dobierania tempa zawiera wyłącznie dane syntetyczne i własny losowy identyfikator. Wynik próby przekazuje się QR-em. Workery kodera i dekodera są lokalnymi plikami strony i nie wysyłają danych pliku ani obrazów przez sieć.
- Podgląd zawartości jest domyślnie zamknięty; tekst jest wstawiany wyłącznie przez `textContent` i nie jest wykonywany. Linki z obcych kodów QR nigdy nie otwierają się automatycznie.
- Prywatny klucz w pliku lub QR pozostaje poufny. Nie publikuj swoich konfiguracji ani zrzutów ekranu z kodem w repozytorium.
- „Wyczyść” usuwa wyniki i odwołania do danych z bieżącego widoku. Trwały duży odbiór usuwa się osobno przez **Usuń zapisany transfer**. Żadna z tych operacji nie stanowi gwarancji kryminalistycznego wymazania pamięci przeglądarki lub systemu.

## Format i ograniczenia

Jeden zwykły kod: maksymalnie **2 953 bajty**. Do 2 331 bajtów używana jest korekcja M, powyżej korekcja L. Limit dotyczy bajtów, a nie liczby liter. Duże kody wymagają ostrego obrazu i odpowiedniej wielkości na ekranie.

Mała seria v3: maksymalnie **10 MiB (10 485 760 bajtów)**, domyślnie po **384 bajty pliku na porcję**, z opcją gęstszego kodu po **600 bajtów**. Maksymalny plik ma odpowiednio 27 307 lub 17 477 części danych; dochodzą manifesty i naprawy. Zmiana gęstości tworzy nową małą serię i wymaga resetu jej odbioru. Duży transfer v4: maksymalnie **200 MiB**, najwyżej 100 segmentów po 2 MiB, z takimi samymi porcjami 384/600 B. Jego zweryfikowane segmenty mogą zostać wznowione po zmianie gęstości. Wartość **1, 2, 5, 10, 15 lub 20** oznacza zmiany obrazu/s — pojedynczego kodu albo pary. Skuteczna szybkość zależy od kamery, ekranu, oświetlenia, ostrości oraz odsetka nowych niezależnych odczytów.

Przed odtwarzaniem strona pokazuje **szacowany czas przebiegu** dla wszystkich sześciu prędkości. Dla małej serii obejmuje części źródłowe, okresowe manifesty i liczbę kodów pokazywanych naraz: `ceil((N + ceil(N / 16)) / liczba_kodów) / tempo`, gdzie `N` oznacza liczbę części źródłowych. W dużym trybie szacunek obejmuje **wszystkie potrzebne segmenty oraz wybrany zapas 25%, 50% lub 100% napraw**, wraz z ich manifestami. Po zbiorczym potwierdzeniu uwzględnia brakujące segmenty. To czas planowanego przebiegu, bez gwarancji zakończenia: pominięcia, dalsze powtórzenia, kodowanie, zapis i sprawdzanie pliku mogą go wydłużyć. Przy ręcznym pozostaniu na jednym segmencie naprawa może trwać bez ograniczenia. Duplikaty i manifesty nie zawyżają postępu. Wskazówka tempa jest przekazywana nadawcy dopiero w zwrotnym QR.

Protokół jest opisany w [protocol.md](protocol.md). Jest przeznaczony do przesyłania między dwoma egzemplarzami tej strony. V3 jest własnym binarnym formatem fountain/FEC, a v4 dodaje segmenty i trwały postęp; nie implementują UR ani RaptorQ. Odbiornik zachowuje odczyt serii **v1 i v2**, małe nowe serie tworzy jako v3, a duże jako v4. Starsze strony wymagają odświeżenia przed nowym formatem. Nazwa pliku jest oczyszczana i ograniczana do 120 bajtów UTF-8. W v4 uczestniczy w tożsamości transferu, ale nie zmienia jego zawartości.

Pliki i fragmenty są kodowane jako segmenty byte. Odczyt wykorzystuje `jsQR.binaryData`, a pobieranie odtworzone bajty. Dzięki temu konwersja zachowuje UTF-8, BOM, CRLF/LF, końcowe spacje i dane binarne. Nazwa pliku nie jest częścią zwykłego QR, dlatego trzeba ją wybrać po odczytaniu. Seria zawiera nazwę w metadanych. Plik z innego skanera lub kod korzystający ze specjalnych trybów tekstowych może wymagać interpretacji zgodnej z jego formatem.

Prefiksy `WGQR-XFR`, `WGQR-ACK`, `WGQR-LRG`, `WGQR-LAK`, `WGQR-CAL` i `WGQR-SET` są zarezerwowane dla ramek serii, potwierdzeń oraz próby i jej wyniku. Pliki zaczynające się od któregoś z tych ośmiobajtowych prefiksów trzeba przesłać w serii, nawet jeśli są małe, aby odbiornik mógł jednoznacznie rozpoznać format. QR z potwierdzeniem albo danymi próby nie jest pobierany jako plik.

Obrazy: do 20 MB i 50 megapikseli, z dodatkowym limitem dłuższego boku 20 000 pikseli. Obsługiwane formaty obrazu zależą od przeglądarki. PNG i JPG są zalecane. Kod musi mieścić się w kadrze razem z jasnym marginesem. SVG nie jest wczytywany.

## Pliki i publikacja

- `index.html`, `styles.css`, `app.js` — interfejs i obsługa plików/kamery.
- `assets/qr-core.js` — gotowy, samodzielny bundle kodera i dekodera.
- `assets/qr-render.js` — rysowanie z całkowitą liczbą pikseli na moduł i ponownym wykorzystaniem bufora obrazu.
- `assets/qr-encoder.js`, `assets/qr-encoder-worker.js` — asynchroniczne przygotowanie jednej lub dwóch matryc QR w lokalnym workerze, anulowanie i awaryjny powrót do głównego wątku.
- `assets/qr-transfer.js` — zgodność z poprzednim protokołem v1.
- `assets/qr-resilient.js` — kompaktowy protokół v3, odczyt v1/v2, równania naprawcze, manifesty, składanie pliku, zwrotne potwierdzenia i sprawdzanie integralności.
- `assets/qr-large.js` — protokół v4 do 200 MiB, tożsamość całego pliku, segmenty po 2 MiB, zbiorcze potwierdzenia i wznawianie.
- `assets/qr-large-store.js` — magazyn OPFS, kontrola zapisanych segmentów, blokada między kartami i sekwencyjne składanie wyniku.
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

Testy dużego transportu sprawdzają stałą tożsamość przy zmianie gęstości, odczyt źródła wyłącznie segmentami, utratę manifestów, naprawę FEC, pełną zgodność binarną, granice pakietów, wznowienie i odrzucanie spóźnionych operacji. ACK nie może potwierdzić segmentu przed trwałym zapisem; wynik nie może być udostępniony przed zgodnym uporządkowanym rootem. Reprezentatywne manifesty, dane, naprawy i potwierdzenia v4 przechodzą również przez rzeczywiste kodowanie QR i odczyt jsQR. Test magazynu dyskowego nie zastępuje sprawdzenia limitów i zachowania OPFS na docelowym telefonie.

Z tego samego katalogu można uruchomić testy dużego transferu osobno:

```sh
npm run test:large
npm run test:large:200mib
```

Pierwsze polecenie sprawdza protokół, zapis i scenariusze integracyjne dużego transferu. Drugie jest **osobnym, uruchamianym świadomie testem pełnych 200 MiB**: przesyła wszystkie ramki przez nadajnik, kolektor i magazyn dyskowy, składa wynik oraz porównuje go z niezależnie wyliczonym SHA-256 oryginału. Weryfikuje też tożsamość opartą na uporządkowanych sumach segmentów. Pełny strumień jest przekazywany jako bajty ramek, bez rasteryzacji każdego QR. Czas tego testu opisuje wykonanie lokalnego pipeline'u programowego, **nie prędkość kamery ani fizycznego transferu optycznego**.

## Biblioteki i dokumentacja

- [node-qrcode 1.5.4](https://github.com/soldair/node-qrcode) — kodowanie bajtów i limity QR; MIT.
- [jsQR 1.4.0](https://github.com/cozmo/jsQR) — odczyt QR z pikseli i `binaryData`; Apache-2.0.
- [fflate 0.8.2](https://github.com/101arrowz/fflate) — kompresja DEFLATE i standardowe archiwa ZIP; MIT. Dołączona lokalnie, bez workerów i zewnętrznych połączeń.
- [WireGuard dla iOS](https://apps.apple.com/pl/app/wireguard/id1441195209) — import konfiguracji z pliku i QR.
- [Kod skanera WireGuard dla iOS](https://git.zx2c4.com/wireguard-apple/tree/Sources/WireGuardApp/UI/iOS/ViewController/QRScanViewController.swift) — interpretuje odczytany QR jako całą konfigurację.
- [Animated QRs — Blockchain Commons](https://developer.blockchaincommons.com/animated-qrs/) — omówienie idei animowanych QR i standardu UR; nasza strona korzysta z własnego formatu binarnego.

Pełne licencje zależności są dostępne lokalnie w `vendor-licenses.txt`.
