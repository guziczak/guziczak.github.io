# Fentanyl WZF — zakres przelicznika w kardiologii

Sprawdzenie: 20.11.2026. Jest to przeliczenie pojedynczego podania wybranego przez lekarza, nie pełny protokół leczenia OZW ani kliniczna walidacja terapii.

## Źródła

- [Polska ChPL w RPL](https://rejestry.ezdrowie.gov.pl/api/rpl/medicinal-products/2404/characteristic), punkty 2, 4.1–4.5 i 6.5–6.6.
- [ChPL producenta](https://polpharma.pl/wp-content/uploads/2024/05/253770_.pdf), z datą 25.04.2024 w punkcie 10. Data dotyczy tego dokumentu; punkt 10 odczytanego PDF RPL pozostaje pusty. Porównano fragmenty istotne dla tego widoku. Alias RPL był dostępny, podczas gdy adres ChPL pod `rejestrymedyczne.ezdrowie.gov.pl` zwracał błąd.
- [Oznakowanie opakowania w RPL](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/2404/package): opakowania i kategoria Lz.
- [ChPL Brilique w EMA](https://www.ema.europa.eu/en/documents/product-information/brilique-epar-product-information_en.pdf), punkt 4.5: oddzielne źródło uwagi o opioidach i doustnych inhibitorach P2Y12. Nie przypisano tej informacji ChPL fentanylu.

## Postać i jednostki

Jedna postać `fentanyl-wzf-50`: 50 mikrogramów fentanylu w ml, jako cytrynian. Obliczenia i pole dawki używają jawnych mikrogramów; nie korzystają z ogólnego silnika mg/dobę. Ampułka ma 2 albo 10 ml, a karton 10 albo 50 ampułek. Objętość kartonu nie jest wielkością pojemnika do pojedynczego podania. Ampułki są jednorazowe; pozostałości nie są przenoszone na kolejne podanie.

## Odniesienia źródłowe

ChPL 4.1 obejmuje silny ból, w tym ból towarzyszący zawałowi. Tabela 4.2 dotyczy jednak ogólnie dorosłych ze spontanicznym oddychaniem: początkowo 50–200 mikrogramów, dodatkowo 50 mikrogramów. Widok rozdziela te etapy, nie tworzy z nich harmonogramu OZW. W ChPL nie wskazano dla tego wariantu odstępu powtarzania ani maksymalnej sumy dobowej.

Dawka pozostaje pusta do świadomego wpisania. Mniejsze indywidualne dawki są możliwe z ostrzeżeniem: źródło przewiduje redukcję u starszych/osłabionych oraz rozważenie redukcji w niewydolności nerek, bez wspólnego algorytmu. Dawki ponad 200 mikrogramów wykraczają poza wybrany widok, gdyż ChPL dopuszcza je w znieczuleniach. W etapie dodatkowym próg 50 mikrogramów jest granicą tej opcji tabeli, nie uniwersalnym maksimum fentanylu.

## Zakres oprogramowania

- Osoba dorosła od 18 lat, jawny wybór etapu i nierozcieńczonego roztworu 50 mikrogramów/ml; podanie dożylne. Próg wieku wyznacza zakres aplikacji, nie pełne wskazania ChPL.
- Przed kopiowaniem wymagane są dane i potwierdzenia warunków źródła: monitorowanie i możliwość wspomagania oddychania/resuscytacji, doświadczony personel, indywidualna ocena pacjenta, właściwe stężenie i droga. Dodatkowa dawka wymaga ponownej oceny po poprzednim podaniu.
- Wynik to objętość, liczba otwieranych ampułek i pozostałość. Nie jest zleceniem podania całej ampułki. Pomocniczy pasek porównuje jedno podanie z tabelą; nie pokazuje bezpieczeństwa terapii.
- Brak pediatrii, dawek na kg, wlewów, PCA, znieczulenia, rozcieńczania i innych dróg. Nie są ukrycie zastępowane `1 ×/dobę` ani `1 dniem`.
- Kopiowanie tworzy zapis pojedynczego podania. Nie używa recepty `Rp.`, opakowań na kurację ani koszyka. Zmiana dawki, pacjenta, etapu lub opakowania odwołuje wcześniejsze potwierdzenie zapisu.
- Standardowy silnik kuracji, dobowe paski i zaokrąglanie ilości są dla tej postaci wyłączone. Osobny resolver waliduje jednostki, dokładny preparat, zakres wieku, źródło i opakowanie; eksport ponownie weryfikuje bieżący kontekst.

Testy obejmują jednostki, 50/100/200 mikrogramów → 1/2/4 ml, oba rozmiary ampułek, zakres i potwierdzenia, brak wartości domyślnych, niepoprawne liczby, nieaktualny wynik oraz brak kuracyjnego eksportu. Wspólny test pokrycia katalogu sprawdza tę postać odrębnym resolverem.
