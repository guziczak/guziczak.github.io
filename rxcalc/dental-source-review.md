# RxCalc — stomatologia: źródła i zakres do przeglądu klinicznego

**Stan katalogu:** `2026.11.14.dental.5` · **opracowanie:** 2026-11-13 · **aktualizacja zakresu:** 2026-11-14.

**Status: dane i reguły nie zostały niezależnie zwalidowane klinicznie.** Dokument opisuje przygotowaną implementację i materiały dla lekarza dokonującego przeglądu. Nie potwierdza zakończenia takiego przeglądu ani gotowości do używania kalkulatora przy rzeczywistej ordynacji. Przed wdrożeniem klinicznym potrzebne jest zatwierdzenie przez lekarza właściwych wskazań, populacji, reguł i wygenerowanych zaleceń.

## 1. Co jest w tej wersji

Liczby pochodzą z importu `DRUGS` z `catalogue.js` oraz `HUMAN_REGIMENS` z `human-regimens.js`, po odfiltrowaniu specjalizacji `dental`. Warianty opakowań policzono funkcją `catalogueProducts()` z `product-search.js`:

| Zakres | Liczba |
|---|---:|
| Grupy preparatów/substancji w katalogu | 14 |
| Konkretne postaci i moce | 22 |
| Warianty preparat–moc–opakowanie, łącznie z referencjami | 42 |
| Rekordy schematów lub instrukcji ze wskazanym źródłem | 30 |
| W tym rekordy liczbowe | 23 |
| W tym instrukcje bez liczbowej masy/objętości dawki | 7 |
| Postaci mające co najmniej jeden taki rekord | 17 |
| Postaci wyłącznie referencyjne, bez wykonywalnego schematu | 4 |
| Pozostałe postaci: ręczne przeliczenie objętości | 1 — Nystatyna Teva |

Wybór produktu nie ustala sam rozpoznania, dawki ani czasu antybiotykoterapii. Po jawnym wyborze schematu aplikacja uzupełnia stałe wartości źródłowe. Dla zakresu z ChPL lekarz zatwierdza wartość; aplikacja sprawdza zgodność z zakresem przypisanym do konkretnej postaci, wskazania i populacji. Puste pole dla tabletek lub kapsułek może zostać jednorazowo uzupełnione mocą **jednej całej sztuki**, jeśli mieści się w wybranym zakresie i dostępnych limitach. Algorytm nie wybiera końca zakresu; jedna sztuka może przypadkowo odpowiadać jego granicy. Nie wyznacza czasu antybiotykoterapii z rozmiaru opakowania ani nie wpisuje domyślnego okresu. Skróty dwóch, jednej i połowy sztuki uwzględniają podzielność preparatu; połówka jest wyłączona dla kapsułek Dalacin C i tabletek Augmentin. Skróty nie zastępują dawek zależnych od masy. Implementacja: `chooseSourceRegimen()` i `prefillSourceTabletDose()` w `app.js`, `tablet-doses.js`.

**Trzy sposoby obsługi:**

- **Liczbowy:** przeliczenie mg, mg/kg/dobę, ml, tabletek lub rozpyleń oraz opakowań, gdy znana jest odpowiednia jednostka i wydajność. Niektóre opakowania aerozolu mają tylko wydajność szacunkową.
- **Instrukcyjny:** np. pasek żelu około 1 cm, „ziarnko grochu” albo aplikacja zabiegowa. Bez wymyślonej masy w gramach i bez dokładnej liczby tub. Opakowanie jest opisem produktu.
- **Referencyjny:** identyfikacja produktu i źródła; brak automatycznego dawkowania oraz wyliczenia zapotrzebowania.

Nystatyna Teva pozostaje odrębnym przypadkiem: lekarz wpisuje zaleconą objętość w ml i sposób podania. Stężenia w j.m. nie zamieniamy na mg. [S09]

## 2. Inwentarz i zakres podpowiedzi

Opakowania w tabeli są **udokumentowane w źródłach, ale nie oznaczają potwierdzenia bieżącej sprzedaży, zapasu apteki ani refundacji**. Dla Ospamox i Augmentin w tabletkach, Dalacin C oraz Ibuprom wybrano część rozmiarów z ChPL. Nie łączono opakowań z różnych rodzin pozwoleń Ospamox. [S01–S06], [S31–S34]

| Grupa | Postaci/opakowania ujęte w aplikacji | Klasyfikacja i obsługa | Źródło |
|---|---|---|---|
| Amoksycylina + klawulanian | Augmentin (400 + 57 mg)/5 ml: 35/70/140 ml; tabletki 500 mg + 125 mg: 14/21 szt.; tabletki 875 mg + 125 mg: 14 szt. | Lek; zawiesina dla dziecka <40 kg; odrębne standardowe schematy tabletek dla masy ≥40 kg, po wyborze wskazania | [S01], [S31], [S32] |
| Amoksycylina | Ospamox 250 i 500 mg/5 ml, 60/100 ml; tabletki 500 i 1000 mg, po 14/16/20 szt. | Lek; odrębne warianty wskazania stomatologicznego, wieku i masy | [S02], [S03], [S04] |
| Klindamycyna | Dalacin C 150 mg i 300 mg; kapsułki po 16/20 szt. dla każdej mocy | Lek; cztery schematy dla wieku >14 lat: osobne moce oraz 3 lub 4 podania; kapsułki w całości | [S33], [S34] |
| Ibuprofen | Ibuprom 200 mg; 20/24/50 tabl. | Lek; doraźnie, limity zależne od wieku i masy | [S05] |
| Paracetamol | Metafen Paracetamol 500 mg; 10/20/60 tabl. | Lek; podpowiedź wyłącznie >12 lat i >50 kg | [S06] |
| Benzydamina | Tantum Verde 1,5 mg/ml: aerozol 30 ml i płyn 120/240 ml | Lek; aerozol zależnie od wieku, płyn w ml; <6 lat instrukcja wg masy | [S07], [S08] |
| Nystatyna | Nystatyna Teva 100 000 j.m./ml; 28 ml po sporządzeniu | Lek; ręcznie w ml, bez gotowego schematu | [S09] |
| Dentinox N | 15% + 0,34% + 0,32%; 10 g | Lek na objawy ząbkowania; instrukcja w aplikacji od 12 miesięcy | [S17] |
| Baikadent | 5,77 mg/g; 15 g | Lek; instrukcja dla dorosłych | [S18], [S19] |
| Eludril Care | CHX 0,05% + CPC 0,05%; 500 ml | Kosmetyk; ilość płynu i częstotliwość wg producenta | [S20], [S21] |
| Metronidazol Chema | Maść 100 mg/g; tuba z kaniulą 5 g | Lek; cztery odrębne instrukcje stomatologiczne | [S22] |
| Ligosan | 140 mg/g; 2/4/8/10/16 wkładów po 260 mg żelu | Lek; wyłącznie referencja | [S23] |
| Chlo-Site | 6 strzykawek × 0,25 ml albo 1 strzykawka × 1 ml | Wyrób medyczny; dwie postaci wyłącznie referencyjne | [S24] |
| Dentomycin | Minocyklina 2%; 5 aplikatorów × 0,5 g | Archiwalny produkt irlandzki; referencja | [S28], [S29] |

## 3. Zasady wymagające szczególnego przeglądu

### Limity i preparaty ogólne

1. **Limit jest przypisany do schematu.** Górne wartości amoksycyliny wynikające z wariantu wskazania i częstości nie są uniwersalną „maksymalną dawką amoksycyliny”. Aplikacja nie przyjmuje ogólnego limitu 4000 mg/dobę ani nie zamienia wszystkich dawek dorosłych na mg/kg. [S02], [S04]
2. **Augmentin:** wartość w mg lub mg/kg/dobę dotyczy amoksycyliny; klawulanian jest pokazywany oddzielnie. Dla zawiesiny zakres stomatologiczny 25–45 mg/kg/dobę w dwóch podaniach dotyczy dzieci od 2 miesięcy i <40 kg. Wyższy zakres opisany dla innych zakażeń nie został automatycznie przeniesiony do stomatologii. Dwa nowe schematy tabletek dotyczą masy ≥40 kg i ciężkiego ropnia z szerzącym się zapaleniem: jedna tabletka 500 mg + 125 mg 3 razy na dobę albo jedna tabletka 875 mg + 125 mg 2 razy na dobę. Linia podziału nie potwierdza równych dawek, więc przeliczenie obejmuje całe tabletki. Żaden z tych schematów nie nadaje domyślnego czasu kuracji. [S01], [S31], [S32]
3. **Ospamox u dzieci:** wariant aplikacji obejmuje od 1 miesiąca, <40 kg i trzy podania. Nie modeluje schematu noworodkowego ani warunkowego schematu dwóch podań przy dawkach z górnej części zakresu. Jest to zakres implementacji, nie nowa granica dopuszczenia produktu. [S02], [S03]
4. **Czynność nerek:** nie ma obowiązkowego pola potwierdzania prawidłowej funkcji nerek. Brak danych nie jest równoznaczny z potwierdzeniem prawidłowej funkcji. Standardowe podpowiedzi nie implementują redukcji dla niewydolności/dializ. W tej wersji znana wartość **CrCl ≤30 ml/min blokuje obecne standardowe schematy amoksycyliny oraz amoksycyliny z klawulanianem**; nie jest wspólną regułą wszystkich antybiotyków i **nie została przypisana klindamycynie**. To ograniczenie zakresu tych podpowiedzi, nie ogólne przeciwwskazanie dla wszystkich postaci i schematów. Pozostaje ręczne pole „Znany CrCl” w ml/min, z bębnem oraz możliwością wpisania liczby. Kalkulator Cockcrofta–Gaulta, jego pola i wejścia „Narzędzia” usunięto. Aplikacja nie oblicza CrCl ani eGFR i nie podstawia eGFR za CrCl; nadal sprawdza ręcznie podany wynik oraz zgłoszone zaburzenia według reguł wybranego schematu. [S01], [S02], [S04], [S31–S34]
5. **Doraźne leki przeciwbólowe:** częstość oznacza wybrany limit planowanych podań, a liczba opakowań — maksymalne zaplanowane zużycie. Eksport zachowuje „w razie bólu”, odstęp i limit dobowy. Ibuprom 200 mg nie otrzymuje ogólnego limitu 2400 mg/dobę; Metafen nie otrzymuje automatycznego limitu 4000 mg dla osoby ≤50 kg. [S05], [S06]
6. **Dalacin C:** cztery rekordy obejmują kapsułki 150/300 mg, wiek >14 lat i 600–1800 mg na **całą dobę**, podzielone na 3 albo 4 podania. Granice pojedynczego podania są wyprowadzane z wybranej częstości; dawka musi być wykonalna w całych kapsułkach. Połówki ani zawartość kapsułki nie służą do odmierzania dawki. Schematy uwzględniają ciężkie zakażenia zębów lub jamy ustnej i przypomnienie o ryzyku związanym z C. difficile. Nie implementują automatycznej korekty w ciężkiej niewydolności narządów ani rutynowej blokady przy CrCl ≤30 ml/min. Nie ustawiono domyślnego czasu; minimum 10 dni opisane dla paciorkowców beta-hemolizujących nie zostało przeniesione na każdą kurację stomatologiczną. [S33], [S34]

### Podsumowanie a tekst do skopiowania

Dla ludzi funkcja `prescriptionText()` w `dental-output.js` generuje dwa warianty. **„Rp. + D.S.”** zawiera nagłówek `Rp.`, preparat, opakowanie i dawkowanie, bez automatycznych wierszy „Wskazanie” i „Schemat”. **„Zalecenia”** zawierają jedną linię „Wskazanie: ….” z wybranego źródła, pusty wiersz i tekst `D.S.`, bez automatycznej linii „Schemat”. Ręczny schemat bez przypisanego wskazania daje samo `D.S.`; aplikacja nie dopisuje brakującego rozpoznania. Uwagi lekarza pozostają niezmienione. Wskazanie, wybrany wariant i dane pacjenta pozostają też w widocznym podsumowaniu do sprawdzenia. Wyroby i kosmetyk nadal mają nagłówek „Preparat” zamiast `Rp.`. Zapis weterynaryjny zachowuje dotychczasowy kontekst gatunku, masy, wskazania i etapu leczenia. Zmiana eksportu nie usuwa kontroli schematu.

### Preparaty miejscowe i zabiegowe

- **Brak FTU i umownych gramów:** pasek 1–2 cm oraz „ziarnko grochu” pozostają ilościami opisowymi. Nie wynikają z nich dokładne mg/dobę ani tuby na kurację. Baikadent 5,77 mg/g dotyczy zespołu flawonów. [S17], [S18]
- **Dentinox N:** ChPL wyklucza <3 miesięcy i, przy określonych lekach wywołujących methemoglobinemię, także <12 miesięcy. Gotowy schemat aplikacji zawężono do ≥12 miesięcy, gdyż brak odpowiedniego wywiadu lekowego. Podanie pozostaje **doraźne (`asNeeded`)**, krótkotrwałe, przy objawach ząbkowania; 2–3 aplikacje nie oznaczają obowiązku stosowania codziennie. [S17]
- **Tantum:** przedział 6–12 lat i grupa >12 lat są rozdzielone. Dla <6 lat brak reguły zaokrąglenia ułamka rozpylenia w źródle, więc moduł pokazuje instrukcję, nie wymyśla zaokrągleń. Około 176 rozpyleń z 30 ml to szacunek; nie gwarantowana liczba dawek użytkowych. Płyn wymaga umiejętności płukania i wypluwania. [S07], [S08]
- **Metronidazol Chema:** ropień po odbarczeniu i wkładka do kanału są procedurami; nie przeliczamy kieszonek ani kanałów na mg/kg/dobę. Dla zapalenia przyzębia oraz wrzodziejącego zapalenia dziąseł źródłowy okres w aplikacji wynosi **7–10 dni**, z wymaganą wartością czasu. W drugim wskazaniu instrukcja zachowuje sanację po 3–5 dniach. [S22]
- **Ligosan/Chlo-Site:** oba są referencyjne. Ligosan ma dostępną polską ChPL w materiale producenta z 2017 r.; nie potwierdzono aktualności dokumentu. Dla Chlo-Site zweryfikowano kartę producenta, ale nie aktualną polską instrukcję. Wkład Ligosan 260 mg to masa żelu, zawierająca 36,4 mg doksycykliny. [S23], [S24]
- **Dentomycin:** pozostaje irlandzką kartą referencyjną. HPRA podaje wycofanie pozwolenia 2022-12-07 i status „Not marketed”. Nie jest to potwierdzenie rejestracji ani dostępności produktu w Polsce ani statusu we wszystkich krajach. [S28], [S29]

## 4. Przypadki odbioru: wyłącznie sztuczne dane i arytmetyka

Poniższe wartości służą sprawdzeniu przeliczeń i blokad. **Nie są zaleceniami leczenia, ustaleniem wskazania ani klinicznym zatwierdzeniem dawek i czasu.** Wiek, masa i okres są danymi testowymi. Dla przypadków źródłowych zakłada się świadome wybranie właściwego wskazania; przykłady poniżej dotyczą arytmetyki, a nie oceny czynności nerek.

| Przypadek | Wprowadzenie do sprawdzenia | Oczekiwany wynik |
|---|---|---|
| Doba a pojedyncza dawka | Ospamox 250 mg/5 ml; fikcyjnie 20 kg, 30 mg/kg/**dobę**, 3 podania, 5 dni | 600 mg/dobę; 200 mg/podanie; 4 ml/podanie; 60 ml łącznie; 1 butelka 60 ml |
| Zmiana stężenia | Te same dane, ale Ospamox 500 mg/5 ml | Ta sama dawka w mg, 2 ml/podanie; 30 ml łącznie — nie 4 ml |
| Dwa składniki | Augmentin 400+57 mg/5 ml; fikcyjnie 20 kg, 45 mg amoksycyliny/kg/dobę, 2 podania, 7 dni | 900 mg amoksycyliny i 128,25 mg klawulanianu/dobę; 5,625 ml/podanie przed oceną możliwości odmierzenia; 78,75 ml łącznie; 2 × 70 ml albo 1 × 140 ml |
| Doraźne maksimum | Ibuprom 200 mg; fikcyjnie dorosły, 400 mg × 4/dobę | Blokada: 1600 mg przekracza limit 1200 mg dla tego źródłowego wariantu |
| Granica populacji | Schemat Metafen: masa dokładnie 50 kg albo wiek dokładnie 12 lat | Brak dostępności tego automatycznego wariantu; nie dopisać 4000 mg jako uniwersalnej normy |
| Niemowlę | Dentinox: 11 miesięcy, następnie 12 miesięcy | Brak automatycznego schematu dla 11 miesięcy; od 12 miesięcy dostępna instrukcja doraźna, po pozostałych kontrolach |
| Rzeczywiste ml płynu | Eludril Care: fikcyjnie dorosły, 15 ml × 2/dobę, okres 7 dni | 210 ml, 1 butelka 500 ml; nie jest to dawka leku do połknięcia |

Nie należy zaokrąglać 5,625 ml wyłącznie w celu otrzymania estetycznego wyniku. Weryfikacja strzykawki, dopuszczalnego kroku i dawki po zaokrągleniu jest osobnym etapem. Wydajność zawiesin zależy również od trwałości po sporządzeniu: Augmentin 7 dni, Ospamox 14 dni; aplikacja nie może utożsamiać niewykorzystanej objętości z zapasem ważnym bezterminowo. [S01], [S02]

## 5. Lista do zatwierdzenia przez lekarza

- [ ] Potwierdzono aktualne dokumenty dla konkretnych nazw, mocy, postaci i rodzin pozwoleń; sprawdzono sekcje 4.1–4.4 oraz 6.5.
- [ ] Potwierdzono wskazania stomatologiczne, wiek, masę i zakresy wyłączone z automatyzacji; szczególnie małe dzieci oraz zaburzenia czynności nerek.
- [ ] Sprawdzono różnicę mg/kg/dobę vs mg/kg/podanie, oba składniki preparatu złożonego, granice jednorazowe i dobowe oraz jednostki j.m.
- [ ] Potwierdzono, że zakres źródłowy, maksimum i czas wymagający kontroli nie są prezentowane jako automatycznie zalecana dawka lub kuracja.
- [ ] Sprawdzono eksport doraźny, minimalny odstęp, instrukcje miejscowe, obowiązkowy czas przy ograniczonym okresie oraz brak dokładnych opakowań przy ilościach opisowych.
- [ ] Sprawdzono rozróżnienie lek/wyrób medyczny/kosmetyk oraz oznaczenia referencji zagranicznych i historycznych.
- [ ] Przeszły przykłady odbioru i próby błędów na telefonie; potwierdzono pełne jednostki i tekst po skopiowaniu do dokumentacji.
- [ ] Zapisano osobę, datę, zakres i wynik przeglądu, otwarte uwagi oraz warunki dopuszczenia do użycia klinicznego.

**Wynik zewnętrznego przeglądu na dzień sporządzenia dokumentu: nieprzeprowadzony / nieudokumentowany.** Testy oprogramowania nie zastępują tego kroku. Niniejszy dokument nie obejmuje klinicznego przeglądu kardiologii ani weterynarii.

## 6. Rejestr wszystkich źródeł stomatologicznych

**Data sprawdzenia dostępu ≠ data dokumentu ≠ data zatwierdzenia klinicznego.** Podstawowe rekordy i podpowiedzi sprawdzano 2026-11-13; nowe tabletki Augmentin i kapsułki Dalacin C — 2026-11-14. Metadane wcześniej obecnej Nystatyny zachowują 2026-11-12. Gdy w danych nie zanotowano daty rewizji ChPL/instrukcji, nie nadajemy jej daty dostępu. Oznacza to punkt do potwierdzenia w przeglądzie. Stare dokumenty podlinkowane na aktualnej stronie nie stają się dokumentami z 2026 r.

### Polskie ChPL, oznakowanie i instrukcje

- **S01 — Augmentin zawiesina (400 mg + 57 mg)/5 ml:** [ChPL RPL 8695](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/8695/characteristic). Sprawdzenie 2026-11-13; daty rewizji nie zapisano w danych.
- **S02 — Ospamox zawiesiny:** [ChPL RPL 22744](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/22744/characteristic). Sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S03 — Ospamox, liczba podań:** [ulotka RPL 22744, §3](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/22744/leaflet). Sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S04 — Ospamox tabletki:** [ChPL RPL 22646](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/22646/characteristic). Rodzina pozwoleń 16801/16802/16687; sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S05 — Ibuprom 200 mg:** [ChPL RPL 19798](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/19798/characteristic). Sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S06 — Metafen Paracetamol 500 mg:** [ChPL RPL 44355](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/44355/characteristic). Sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S07 — Tantum Verde aerozol:** [ChPL RPL 6561](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/6561/characteristic). Sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S08 — Tantum Verde płyn:** [ChPL RPL 6560](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/6560/characteristic). Sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S09 — Nystatyna Teva:** [ChPL RPL 20512](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/20512/characteristic). Data sprawdzenia w odziedziczonych metadanych 2026-11-12; brak nowego schematu w tym wydaniu.
- **S17 — Dentinox N:** [ChPL RPL 1765](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/1765/characteristic). Sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S18 — Baikadent:** [ChPL RPL 10297](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/10297/characteristic). Sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S19 — Baikadent 15 g:** [karta producenta Herbapol](https://herbapol.pl/produkty/baikadent/). Sprawdzenie 2026-11-13; data rewizji strony nieustalona.
- **S20 — Eludril Care, skład i opakowanie:** [polska karta Pierre Fabre](https://www.pierrefabre-oralcare.com/pl-pl/p/eludril-care-przeciwplytkowy-plyn-do-plukania-jamy-ustnej-3577056021695-808759b4). Sprawdzenie 2026-11-13; data rewizji strony nieustalona.
- **S21 — Eludril Care, ilość i sposób użycia:** [polska instrukcja Pierre Fabre](https://www.pierrefabre-oralcare.com/pl-pl/rutyna-przeciwprochnicowa). Sprawdzenie 2026-11-13; data rewizji strony nieustalona.
- **S22 — Metronidazol Chema:** [ChPL RPL 11440](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/11440/characteristic). Sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S31 — Augmentin 500 mg + 125 mg, tabletki powlekane:** [ChPL RPL 830](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/830/characteristic). Rewizja dokumentu 2026-09-09; sprawdzenie 2026-11-14. Z §6.5 wybrano opakowania 14 i 21 tabletek; dane nie potwierdzają bieżącego zapasu apteki.
- **S32 — Augmentin 875 mg + 125 mg, tabletki powlekane:** [ChPL RPL 7496](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/7496/characteristic). Rewizja dokumentu 2026-09-09; sprawdzenie 2026-11-14. Z §6.5 wybrano opakowanie 14 tabletek; dane nie potwierdzają bieżącego zapasu apteki.
- **S33 — Dalacin C 150 mg, kapsułki:** [ChPL RPL 1692](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/1692/characteristic). Rewizja dokumentu 2026-07-10; sprawdzenie 2026-11-14. Z §6.5 wybrano opakowania 16 i 20 kapsułek; dane nie potwierdzają bieżącego zapasu apteki.
- **S34 — Dalacin C 300 mg, kapsułki:** [ChPL RPL 1693](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/1693/characteristic). Rewizja dokumentu 2026-07-10; sprawdzenie 2026-11-14. Z §6.5 wybrano opakowania 16 i 20 kapsułek; dane nie potwierdzają bieżącego zapasu apteki.

### Dokumenty referencyjne — bez źródłowego dawkowania w aplikacji

- **S23 — Ligosan:** [Kulzer, polska ChPL w broszurze](https://kulzer.pl/media/product-downloads/pl/ligosan/kulzer-ulotka-ligosan-pl.pdf). ChPL z 2017-09-18; dostęp sprawdzony 2026-11-13. Aktualność wymaga potwierdzenia.
- **S24 — Chlo-Site:** [karta producenta Ghimas](https://www.ghimas.com/en/chlosite1). Dostęp sprawdzony 2026-11-13; brak zweryfikowanej polskiej instrukcji i daty jej wersji.
- **S28 — Dentomycin, status:** [HPRA, rekord irlandzki](https://www.hpra.ie/find-a-medicine/for-human-use/withdrawn-medicines/details/25737). Wycofanie pozwolenia 2022-12-07; status „Not marketed”; dostęp 2026-11-13.
- **S29 — Dentomycin, opakowanie i postać:** [archiwalna ChPL HPRA](https://assets.hpra.ie/products/Human/25737/Licence_PA1321-001-001_04122018114740.pdf). Dokument 2018-12-04; dostęp 2026-11-13.
