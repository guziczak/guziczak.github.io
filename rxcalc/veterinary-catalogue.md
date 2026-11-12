# Katalog weterynaryjny — zakres i źródła

Sprawdzenie danych: **12 listopada 2026 r.** Katalog zawiera 5 marek i 12 postaci/mocy, w tym jedną kartę informacyjną bez obliczeń. Zawiera 12 jawnie wybieranych rekordów schematów źródłowych, przypisanych do konkretnej postaci, gatunku, wskazania i fazy. Nie wybiera rozpoznania ani fazy za lekarza. Dawka, częstość i czas pozostają puste po zmianie preparatu lub postaci aż do wyboru schematu lub ręcznego wpisania.

## Zakres

| Marka | Postaci w aplikacji | Gatunki w aplikacji | Charakter wpisu |
| --- | --- | --- | --- |
| Metacam | Zawiesiny 1,5 / 0,5 / 15 mg/ml | Pies / kot / koń, odpowiednio | Osobne stężenie dla każdego gatunku |
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

## Schematy źródłowe

- **Metacam:** pies — pierwszy dzień i faza podtrzymująca; kot — osobne fazy początkowe i kontynuacja dla ostrych oraz przewlekłych schorzeń narządu ruchu; koń — doustny schemat dla schorzeń narządu ruchu. Źródła: SPC VMD z kwietnia 2026, sekcje 3.3–3.9. Dla kota schematy zweryfikowano dodatkowo w [pełnym SPC](https://www.vmd.defra.gov.uk/ProductInformationDatabase/files/SPC_Documents/SPC_2177046.PDF). Nie wdrożono schematu pooperacyjnego wymagającego historii wcześniejszego podania iniekcyjnego.
- **Cardisure:** dawka preferowana w polskiej ulotce RPL (części 4–8) dla określonej zastoinowej niewydolności serca. Czas leczenia pozostaje do ustalenia. Nie dobieramy automatycznie innej dawki, gdy wynik nie odpowiada podziałowi tabletki.
- **Onsior:** tabela całych tabletek dla ostrych schorzeń narządu ruchu u kota, dokument VMD 10/2023, sekcje 4.5 i 4.9. Zakres masy 2,5–<6 kg oraz 6–12 kg; dokładnie 6 kg należy do drugiego przedziału. Maksymalny czas 6 dni jest limitem, nie automatycznie wybraną długością.
- **Cerenia:** literalna polska tabela dla wymiotów z wyłączeniem choroby lokomocyjnej (sekcja 3.9, strona 5). Każda moc ma własne zakresy; luk między granicami nie uzupełniamy zaokrąglaniem masy. Maksymalny czas 14 dni jest limitem. Moc 160 mg i schemat choroby lokomocyjnej nie są dodane.

Schemat źródłowy blokuje edycję podstawy dawki, częstości i zaokrąglania. „Edytuj ręcznie” odłącza schemat od źródła, zachowuje wartości do własnej oceny i usuwa potwierdzenie. Zmiana masy od nowa rozstrzyga tabelę dawkowania; brak dopasowania usuwa poprzednią dawkę. Zmiana gatunku, preparatu lub postaci usuwa schemat i potwierdzenie.

Kopiowanie wymaga zarówno poprawnego przeliczenia, jak i spełnienia zapisanych warunków schematu oraz jawnego potwierdzenia lekarza. Wiek oceniany jest w jednostkach źródła; między jednostkami stosujemy ostrożne granice kalendarzowe. Nie przyjmujemy, że miesiąc oznacza cztery tygodnie. Parametry pacjenta nie trafiają do pamięci trwałej.

Faza pierwszego dnia ma dokładnie 1 dzień i osobną etykietę w kopiowanym tekście. Zapas dotyczy wyłącznie wybranego etapu, a nie połączonej terapii początkowej i podtrzymującej. Warunkowe przerwanie Metacamu przy braku poprawy liczone jest od rozpoczęcia całego leczenia. Nie jest modelowane jako uniwersalny limit czasu u każdego odpowiadającego pacjenta.

Dla chomika i szczura nadal nie ma schematu podania gotowego roztworu. Karta Enrobactinu pozostaje informacyjna i nie może ominąć blokady obliczeń.

## Granice przeliczenia

Źródła są jawnie opisane w interfejsie: polski RPL, unijny UPD i uzupełniająca dokumentacja urzędów VMD/HPRA w języku angielskim. Nie oznaczamy zagranicznego dokumentu jako aktualnej polskiej ChPL. Wielkości opakowań są rejestracyjne; dostępność handlowa nie jest sprawdzana.

Trwałość fragmentu tabletki nie jest traktowana jako trwałość całego opakowania. Okresu 6 miesięcy po otwarciu wybranych zawiesin nie przybliżamy do 180 dni w silniku. Długie schematy otrzymują informację o konieczności sprawdzenia liczby opakowań według dat otwarcia i ważności.

Wynik pozostaje przeliczeniem arytmetycznym. Katalog nie rozstrzyga wskazania, przeciwwskazań, interakcji, okresu karencji ani dawkowania dla konkretnego zwierzęcia. Fazy leczenia z różnymi dawkami wymagają osobnych przeliczeń. Kopiowany tekst wymaga weryfikacji przez lekarza weterynarii.
