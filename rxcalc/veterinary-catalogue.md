# Katalog weterynaryjny — zakres i źródła

Sprawdzenie danych: **12 listopada 2026 r.** Katalog zawiera 5 marek i 10 postaci/mocy, w tym jedną kartę informacyjną bez obliczeń. Nie zawiera automatycznie wybieranych schematów leczenia. Wpisywane przez lekarza weterynarii dawka, częstość i czas stosowania pozostają puste po zmianie preparatu lub postaci.

## Zakres

| Marka | Postaci w aplikacji | Gatunki w aplikacji | Charakter wpisu |
| --- | --- | --- | --- |
| Metacam | Zawiesiny 1,5 / 0,5 / 15 mg/ml | Pies / kot / koń, odpowiednio | Osobne stężenie dla każdego gatunku |
| Cardisure Flavoured | Tabletki 1,25 / 2,5 / 5 / 10 mg | Pies | Dane z polskiej dokumentacji RPL |
| Onsior | Tabletki 6 mg | Kot | Całe tabletki |
| Cerenia | Tabletki 16 mg | Pies | Moc w mg maropitantu; dopuszczone połowy |
| Enrobactin | Koncentrat 25 mg/ml | Chomik, szczur | Karta informacyjna; przeliczenie i kopiowanie zablokowane |

`targetSpecies` należy do konkretnej postaci. Wyszukiwarka, wybór mocy i ulubione korzystają z tego samego filtra. Bez wybranego gatunku katalog weterynaryjny jest pusty. Nie przenosimy zastosowania u świnki morskiej na chomika lub szczura.

## Źródła

- **Cardisure:** [polska ulotka urzędowa RPL](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/25271/leaflet), obejmująca wszystkie cztery moce; skład i podział — część 2, gatunek — część 3, opakowania — część 14.
- **Metacam, pies:** [UPD](https://medicines.health.europa.eu/veterinary/en/600000001530) oraz [SPC VMD, EN](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2177020.PDF).
- **Metacam, kot:** [UPD](https://medicines.health.europa.eu/veterinary/en/600000001701) oraz [dokumentacja VMD, EN](https://www.vmd.defra.gov.uk/productinformationdatabase/files/QRD_Documents/QRD-Auth_2177231.PDF). Modelowana jest butelka 3 ml z trwałością 14 dni po otwarciu. Większe butelki mają inną trwałość i zostały pominięte.
- **Metacam, koń:** [UPD](https://medicines.health.europa.eu/veterinary/en/600000001534) oraz [SPC VMD, EN](https://vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2177034.PDF).
- **Onsior:** [UPD](https://medicines.health.europa.eu/veterinary/en/600000004134) oraz [SPC VMD, EN](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2652572.PDF).
- **Cerenia:** [UPD](https://medicines.health.europa.eu/veterinary/en/600000001524) oraz [SPC VMD, EN](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2243320.PDF). Kalkulator używa 16 mg maropitantu, nie masy jego soli podanej w osobnym polu rejestru.
- **Enrobactin:** [polski wpis UPD](https://medicines.health.europa.eu/veterinary/en/600000034874), [lista gatunków HPRA](https://www.hpra.ie/find-a-medicine/for-animal-use/authorised-medicines/details/905) i [SPC HPRA, EN, aktualizacja 29.04.2026](https://assets.hpra.ie/products/Animal/905/ie-spc-nlv0315001a004-mr-vpa10475-020-001-en_30042026111356.pdf). Obowiązek przygotowania opisuje część 3.5/3.9. Stężenie koncentratu jest przechowywane wyłącznie jako informacja; nie trafia do przelicznika gotowej dawki.

## Granice przeliczenia

Źródła są jawnie opisane w interfejsie: polski RPL, unijny UPD i uzupełniająca dokumentacja urzędów VMD/HPRA w języku angielskim. Nie oznaczamy zagranicznego dokumentu jako aktualnej polskiej ChPL. Wielkości opakowań są rejestracyjne; dostępność handlowa nie jest sprawdzana.

Trwałość fragmentu tabletki nie jest traktowana jako trwałość całego opakowania. Okresu 6 miesięcy po otwarciu wybranych zawiesin nie przybliżamy do 180 dni w silniku. Długie schematy otrzymują informację o konieczności sprawdzenia liczby opakowań według dat otwarcia i ważności.

Wynik pozostaje przeliczeniem arytmetycznym. Katalog nie rozstrzyga wskazania, przeciwwskazań, interakcji, okresu karencji ani dawkowania dla konkretnego zwierzęcia. Fazy leczenia z różnymi dawkami wymagają osobnych przeliczeń. Kopiowany tekst wymaga weryfikacji przez lekarza weterynarii.
