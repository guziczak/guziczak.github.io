# Katalog weterynaryjny — zakres i źródła

Rozszerzenie końskie sprawdzono **13 listopada 2026 r.**; wcześniejsze wpisy zachowują datę sprawdzenia 12 listopada 2026 r. Katalog zawiera 9 marek i 17 postaci/mocy, w tym jedną kartę informacyjną bez obliczeń. Dla konia dostępnych jest 5 marek, 6 postaci i 9 schematów. Cały katalog zawiera 20 jawnie wybieranych rekordów schematów źródłowych, przypisanych do konkretnej postaci, gatunku, wskazania i fazy. Nie wybiera rozpoznania ani fazy za lekarza. Dawka, częstość i czas pozostają puste po zmianie preparatu lub postaci aż do wyboru schematu lub ręcznego wpisania.

## Zakres

| Marka | Postaci w aplikacji | Gatunki w aplikacji | Charakter wpisu |
| --- | --- | --- | --- |
| Metacam | Zawiesiny 1,5 / 0,5 / 15 mg/ml | Pies / kot / koń, odpowiednio | Osobne stężenie dla każdego gatunku |
| Panacur | Pasta 187,5 mg/g i zawiesina 100 mg/ml | Koń | Polska pasta; zawiesina z dokumentacji HPRA (Irlandia), wyraźnie oznaczona |
| Gastazole | Pasta 370 mg/g, strzykawka 7,57 g | Koń | Osobne 28-dniowe etapy, kontrola podziałki aplikatora |
| Ventipulmin | Granulat 0,016 mg chlorowodorku klenbuterolu/g, 500 g | Koń | Masa całego granulatu; otwarte opakowanie 21 dni |
| Equioxx | Tabletki 57 mg | Koń | Cała tabletka wyłącznie w zakresie 450–600 kg |
| Cardisure Flavoured | Tabletki 1,25 / 2,5 / 5 / 10 mg | Pies | Dane z polskiej dokumentacji RPL |
| Onsior | Tabletki 6 mg | Kot | Całe tabletki |
| Cerenia | Tabletki 16 / 24 / 60 mg | Pies | Moc w mg maropitantu; dopuszczone połowy |
| Enrobactin | Koncentrat 25 mg/ml | Chomik, szczur | Karta informacyjna; przeliczenie i kopiowanie zablokowane |

`targetSpecies` należy do konkretnej postaci. Wyszukiwarka, wybór mocy i ulubione korzystają z tego samego filtra. Bez wybranego gatunku katalog weterynaryjny jest pusty. Nie przenosimy zastosowania u świnki morskiej na chomika lub szczura.

## Źródła

- **Cardisure:** [polska ulotka urzędowa RPL](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/25271/leaflet), obejmująca wszystkie cztery moce; skład i podział — część 2, gatunek — część 3, opakowania — część 14.
- **Metacam, pies:** [UPD](https://medicines.health.europa.eu/veterinary/en/600000001530) oraz [SPC VMD, EN](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2177020.PDF).
- **Metacam, kot:** [UPD](https://medicines.health.europa.eu/veterinary/en/600000001701) oraz [dokumentacja VMD, EN](https://www.vmd.defra.gov.uk/productinformationdatabase/files/QRD_Documents/QRD-Auth_2177231.PDF). Modelowana jest butelka 3 ml z trwałością 14 dni po otwarciu. Większe butelki mają inną trwałość i zostały pominięte.
- **Metacam, koń:** [UPD](https://medicines.health.europa.eu/veterinary/en/600000001534) oraz [SPC VMD, EN](https://vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2177034.PDF).
- **Onsior:** [UPD](https://medicines.health.europa.eu/veterinary/en/600000004134) oraz [SPC VMD, EN](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2652572.PDF).
- **Cerenia:** [UPD](https://medicines.health.europa.eu/veterinary/en/600000001524) oraz [polska ChPL producenta, 10/2024](https://www.zoetis.com.pl/_locale-assets/charakterystyki-produktow/cerenia_qrd_2024.10_vnra.pdf). Kalkulator używa mocy w mg maropitantu, nie masy jego soli podanej w osobnym polu rejestru. Wpis UPD dotyczy mocy 16 mg; wspólna ChPL opisuje wszystkie dodane moce.
- **Enrobactin:** [polski wpis UPD](https://medicines.health.europa.eu/veterinary/en/600000034874), [lista gatunków HPRA](https://www.hpra.ie/find-a-medicine/for-animal-use/authorised-medicines/details/905) i [SPC HPRA, EN, aktualizacja 29.04.2026](https://assets.hpra.ie/products/Animal/905/ie-spc-nlv0315001a004-mr-vpa10475-020-001-en_30042026111356.pdf). Obowiązek przygotowania opisuje część 3.5/3.9. Stężenie koncentratu jest przechowywane wyłącznie jako informacja; nie trafia do przelicznika gotowej dawki.

## Rozszerzenie dla koni — źródła i granice

- **Panacur Pasta:** [polska ChPL RPL](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/18365/characteristic), sekcje 3.2–3.9 i 5.4. 187,5 mg fenbendazolu/g; 24 g w pojedynczej strzykawce. Schematy 7,5 mg/kg (opisane stadia słupkowców i owsików) i 10 mg/kg (Parascaris equorum) są jednorazowe. Nie dodano odrębnego schematu 50 mg/kg dla Strongyloides westeri u źrebiąt ssących. Źródło nie podaje liczbowego kroku podziałki — aplikacja wylicza gramy i wymaga potwierdzenia nastawy urządzenia, nie wymyśla liczby kliknięć.
- **Panacur zawiesina:** [SPC HPRA, EN, Irlandia, 04.10.2024](https://assets.hpra.ie/products/Animal/2272/VPA10996_111_001_CRN00FDZT_04_10_2024_Nationalspc_14102024155757.pdf), sekcje 3.2–3.9 i 5.4. Gotowa zawiesina 100 mg/ml, opakowania 250/1000/2500 ml. Dodano wyłącznie schemat 7,5 mg/kg raz dziennie przez 5 dni dla wymienionych stadiów larwalnych dużych i małych słupkowców. Nie oznaczamy tej wersji jako polskiej i nie przenosimy na nią brytyjskiej trwałości po otwarciu.
- **Gastazole:** [polska ChPL RPL](https://rejestry.ezdrowie.gov.pl/api/rpl/medicinal-products/46637/characteristic), sekcje 3.5, 3.9, 5.2–5.4. 370 mg omeprazolu/g, jedna strzykawka 7,57 g jako modelowane opakowanie. Leczenie 4 mg/kg raz dziennie przez 28 dni; kolejny etap 1 mg/kg raz dziennie przez następne 28 dni. Minimum 4 tygodnie i 70 kg. Jedna działka podziałki odpowiada 100 kg przy dawce 4 mg/kg, czyli 400/370 g pasty. Przy dawce 1 mg/kg nastawa odpowiada jednej czwartej masy konia. Wynik niepasujący do całych działek blokuje kopiowanie. Strzykawka po otwarciu ma trwałość 28 dni. Obliczenie zapasu zakłada wykorzystanie pełnych pozostałych działek: pojedyncza dawka może pochodzić z dwóch kolejnych strzykawek. To założenie pokazujemy przy zapasie i w pełnym kopiowanym tekście. Nie modelujemy kartonu z wieloma strzykawkami jako jednego otwartego opakowania.
- **Ventipulmin granulat:** [polska ChPL RPL](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/16870/characteristic), sekcje 3.2–3.9 i 5.2–5.4. 0,016 mg chlorowodorku klenbuterolu/g, 500 g w pojemniku; 21 dni po otwarciu. Podstawa dawki to 0,8 µg soli/kg na podanie = 0,0008 mg/kg, dwa razy dziennie. Nie używamy zawartości zasady (0,014 mg/g) do przeliczenia dawki soli. Ostry przebieg: 10–14 dni; przewlekły: co najmniej 28 dni. Źródło nie ustanawia ogólnego maksimum przewlekłego leczenia. Miarka ma 10 g, a wymaganą dokładność odmierzenia części miarki potwierdza lekarz.
- **Equioxx:** [SPC VMD, EN, 08/2023](https://vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2285817.PDF), sekcje 4.1–4.9 i 6.5, oraz [wpis UPD obejmujący Polskę](https://medicines.health.europa.eu/veterinary/en/600000000067). Jedna cała tabletka 57 mg raz dziennie dla koni 450–600 kg, do 14 dni, w opisanym wskazaniu choroby zwyrodnieniowej stawów. Opakowania 10/30/60/180 tabletek. Nie dodajemy progu wieku z dokumentacji innej postaci ani nie uznajemy samej kreski na tabletce za dopuszczenie równych części dawki.

Pasty doustne i granulat mają osobne typy `oralPaste` i `oralPowder`: ich `strengthMg` oznacza mg substancji w 1 g rzeczywistego preparatu. Nie używamy objętości ml ani masy substancji jako masy całego produktu. Weryfikacja dawki na podziałce jest dodatkowym warunkiem, obok warunków źródła i poprawności arytmetycznej.

## Schematy źródłowe

- **Metacam:** pies — pierwszy dzień i faza podtrzymująca; kot — osobne fazy początkowe i kontynuacja dla ostrych oraz przewlekłych schorzeń narządu ruchu; koń — doustny schemat dla schorzeń narządu ruchu. Źródła: SPC VMD z kwietnia 2026, sekcje 3.3–3.9. Dla kota schematy zweryfikowano dodatkowo w [pełnym SPC](https://www.vmd.defra.gov.uk/ProductInformationDatabase/files/SPC_Documents/SPC_2177046.PDF). Nie wdrożono schematu pooperacyjnego wymagającego historii wcześniejszego podania iniekcyjnego.
- **Cardisure:** dawka preferowana w polskiej ulotce RPL (części 4–8) dla określonej zastoinowej niewydolności serca. Czas leczenia pozostaje do ustalenia. Nie dobieramy automatycznie innej dawki, gdy wynik nie odpowiada podziałowi tabletki.
- **Onsior:** tabela całych tabletek dla ostrych schorzeń narządu ruchu u kota, dokument VMD 10/2023, sekcje 4.5 i 4.9. Zakres masy 2,5–<6 kg oraz 6–12 kg; dokładnie 6 kg należy do drugiego przedziału. Maksymalny czas 6 dni jest limitem, nie automatycznie wybraną długością.
- **Cerenia:** literalna polska tabela dla wymiotów z wyłączeniem choroby lokomocyjnej (sekcja 3.9, strona 5). Każda moc ma własne zakresy; luk między granicami nie uzupełniamy zaokrąglaniem masy. Maksymalny czas 14 dni jest limitem. Moc 160 mg i schemat choroby lokomocyjnej nie są dodane.

Schemat źródłowy blokuje edycję podstawy dawki, częstości i zaokrąglania. „Edytuj ręcznie” odłącza schemat od źródła, zachowuje wartości do własnej oceny i usuwa potwierdzenie. Zmiana masy od nowa rozstrzyga tabelę dawkowania; brak dopasowania usuwa poprzednią dawkę. Zmiana gatunku, preparatu lub postaci usuwa schemat i potwierdzenie.

Kopiowanie wymaga zarówno poprawnego przeliczenia, jak i spełnienia zapisanych warunków schematu oraz jawnego potwierdzenia lekarza. Wiek oceniany jest w jednostkach źródła; między jednostkami stosujemy ostrożne granice kalendarzowe. Nie przyjmujemy, że miesiąc oznacza cztery tygodnie. Parametry pacjenta nie trafiają do pamięci trwałej.

Faza pierwszego dnia i podanie jednorazowe mają dokładnie 1 dzień; wybrane inne schematy stałe mają 5 albo 28 dni. Wskazanie i etap zawsze są zapisane w kopiowanym tekście. Zapas dotyczy wyłącznie wybranego etapu, a nie połączonej terapii początkowej i podtrzymującej. Warunkowe przerwanie Metacamu przy braku poprawy liczone jest od rozpoczęcia całego leczenia. Nie jest modelowane jako uniwersalny limit czasu u każdego odpowiadającego pacjenta.

Dla chomika i szczura nadal nie ma schematu podania gotowego roztworu. Karta Enrobactinu pozostaje informacyjna i nie może ominąć blokady obliczeń.

## Granice przeliczenia

Źródła są jawnie opisane w interfejsie: polski RPL, unijny UPD i uzupełniająca dokumentacja urzędów VMD/HPRA w języku angielskim. Nie oznaczamy zagranicznego dokumentu jako aktualnej polskiej ChPL. Wielkości opakowań są rejestracyjne; dostępność handlowa nie jest sprawdzana.

Trwałość fragmentu tabletki nie jest traktowana jako trwałość całego opakowania. Okresu 6 miesięcy po otwarciu wybranych zawiesin nie przybliżamy do 180 dni w silniku. Długie schematy otrzymują informację o konieczności sprawdzenia liczby opakowań według dat otwarcia i ważności.

Wynik pozostaje przeliczeniem arytmetycznym. Katalog nie rozstrzyga wskazania, przeciwwskazań, interakcji, okresu karencji ani dawkowania dla konkretnego zwierzęcia. Fazy leczenia z różnymi dawkami wymagają osobnych przeliczeń. Kopiowany tekst wymaga weryfikacji przez lekarza weterynarii.
