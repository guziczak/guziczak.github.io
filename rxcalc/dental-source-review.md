# RxCalc — stomatologia: źródła i zakres do przeglądu klinicznego

**Stan katalogu:** `2026.11.13.dental.1` · **opracowanie:** 2026-11-13.

**Status: dane i reguły nie zostały niezależnie zwalidowane klinicznie.** Dokument opisuje przygotowaną implementację i materiały dla lekarza dokonującego przeglądu. Nie potwierdza zakończenia takiego przeglądu ani gotowości do używania kalkulatora przy rzeczywistej ordynacji. Przed wdrożeniem klinicznym potrzebne jest zatwierdzenie przez lekarza właściwych wskazań, populacji, reguł i wygenerowanych zaleceń.

## 1. Co jest w tej wersji

Liczby pochodzą z importu `DRUGS` z `catalogue.js` oraz `HUMAN_REGIMENS` z `human-regimens.js`, po odfiltrowaniu specjalizacji `dental`:

| Zakres | Liczba |
|---|---:|
| Grupy preparatów/substancji w katalogu | 21 |
| Konkretne postaci i moce | 28 |
| Warianty preparat–moc–opakowanie, łącznie z referencjami | 48 |
| Rekordy schematów lub instrukcji ze wskazanym źródłem | 31 |
| W tym rekordy liczbowe | 18 |
| W tym instrukcje bez liczbowej masy/objętości dawki | 13 |
| Postaci mające co najmniej jeden taki rekord | 19 |
| Postaci wyłącznie referencyjne, bez wykonywalnego schematu | 8 |
| Pozostałe postaci: ręczne przeliczenie objętości | 1 — Nystatyna Teva |

Wybór produktu nie ustala sam rozpoznania, dawki ani czasu antybiotykoterapii. Dla zakresu z ChPL lekarz wybiera wartość; aplikacja sprawdza zgodność z zakresem przypisanym do konkretnej postaci, wskazania i populacji.

**Trzy sposoby obsługi:**

- **Liczbowy:** przeliczenie mg, mg/kg/dobę, ml, tabletek lub rozpyleń oraz opakowań, gdy znana jest odpowiednia jednostka i wydajność. Niektóre opakowania aerozolu mają tylko wydajność szacunkową.
- **Instrukcyjny:** np. pasek żelu około 1 cm, „ziarnko grochu” albo aplikacja zabiegowa. Bez wymyślonej masy w gramach i bez dokładnej liczby tub. Opakowanie jest opisem produktu.
- **Referencyjny:** identyfikacja produktu i źródła; brak automatycznego dawkowania oraz wyliczenia zapotrzebowania.

Nystatyna Teva pozostaje odrębnym przypadkiem: lekarz wpisuje zaleconą objętość w ml i sposób podania. Stężenia w j.m. nie zamieniamy na mg. [S09]

## 2. Inwentarz i zakres podpowiedzi

Opakowania w tabeli są **udokumentowane w źródłach, ale nie oznaczają potwierdzenia bieżącej sprzedaży, zapasu apteki ani refundacji**. Dla Ospamox w tabletkach i Ibuprom wybrano część rozmiarów z ChPL. Nie łączono opakowań z różnych rodzin pozwoleń Ospamox. [S01–S06]

| Grupa | Postaci/opakowania ujęte w aplikacji | Klasyfikacja i obsługa | Źródło |
|---|---|---|---|
| Amoksycylina + klawulanian | Augmentin (400 + 57 mg)/5 ml; 35/70/140 ml | Lek; zakres dla dziecka <40 kg, po wyborze wskazania | [S01] |
| Amoksycylina | Ospamox 250 i 500 mg/5 ml, 60/100 ml; tabletki 500 i 1000 mg, po 14/16/20 szt. | Lek; odrębne warianty wskazania stomatologicznego, wieku i masy | [S02], [S03], [S04] |
| Ibuprofen | Ibuprom 200 mg; 20/24/50 tabl. | Lek; doraźnie, limity zależne od wieku i masy | [S05] |
| Paracetamol | Metafen Paracetamol 500 mg; 10/20/60 tabl. | Lek; podpowiedź wyłącznie >12 lat i >50 kg | [S06] |
| Benzydamina | Tantum Verde 1,5 mg/ml: aerozol 30 ml i płyn 120/240 ml | Lek; aerozol zależnie od wieku, płyn w ml; <6 lat instrukcja wg masy | [S07], [S08] |
| Nystatyna | Nystatyna Teva 100 000 j.m./ml; 28 ml po sporządzeniu | Lek; ręcznie w ml, bez gotowego schematu | [S09] |
| Sachol | (87,1 + 0,1 mg)/g; 10 g | Lek; instrukcja paska żelu | [S10], [S11] |
| Dezaftan | Żel ochronny; 8 g | Wyrób medyczny; instrukcja kropli | [S12] |
| Dezaftan med | Aerozol (2,9 + 1,96 + 25,6 mg)/ml; 30 ml | Lek; instrukcja rozpyleń z limitem liczby aplikacji | [S13] |
| Anaftin | Żel 8 ml, spray 15 ml, płyn 120 ml | Wyroby medyczne; żel/spray instrukcyjnie, płyn liczbowo | [S14], [S15], [S16] |
| Dentinox N | 15% + 0,34% + 0,32%; 10 g | Lek na objawy ząbkowania; instrukcja w aplikacji od 12 miesięcy | [S17] |
| Baikadent | 5,77 mg/g; 15 g | Lek; instrukcja dla dorosłych | [S18], [S19] |
| Eludril Care | CHX 0,05% + CPC 0,05%; 500 ml | Kosmetyk; ilość płynu i częstotliwość wg producenta | [S20], [S21] |
| Metronidazol Chema | Maść 100 mg/g; tuba z kaniulą 5 g | Lek; cztery odrębne instrukcje stomatologiczne | [S22] |
| Ligosan | 140 mg/g; 2/4/8/10/16 wkładów po 260 mg żelu | Lek; wyłącznie referencja | [S23] |
| Chlo-Site | 6 strzykawek × 0,25 ml albo 1 strzykawka × 1 ml | Wyrób medyczny; dwie postaci wyłącznie referencyjne | [S24] |
| Triamcynolon — pasta stomatologiczna | Triamcinolone Acetonide Dental Paste 0,1%; 5/7,5 g | Lek opisany w dokumentacji USA; referencja | [S25] |
| Arestin | Minocyklina 1 mg/wkład; 1 albo 24 wkłady | Lek opisany w dokumentacji USA; referencja | [S26] |
| Atridox | System mieszania, hyklan doksycykliny 10%; 2 albo 6 zestawów | Archiwalny rekord USA; referencja | [S27] |
| Dentomycin | Minocyklina 2%; 5 aplikatorów × 0,5 g | Archiwalny produkt irlandzki; referencja | [S28], [S29] |
| Actisite | Włókno z tetracykliną 12,7 mg; aktualne opakowanie niepotwierdzone | Produkt historyczny; referencja | [S30] |

## 3. Zasady wymagające szczególnego przeglądu

### Limity i preparaty ogólne

1. **Limit jest przypisany do schematu.** Górne wartości amoksycyliny wynikające z wariantu wskazania i częstości nie są uniwersalną „maksymalną dawką amoksycyliny”. Aplikacja nie przyjmuje ogólnego limitu 4000 mg/dobę ani nie zamienia wszystkich dawek dorosłych na mg/kg. [S02], [S04]
2. **Augmentin:** wprowadzana dawka mg/kg/dobę dotyczy amoksycyliny; klawulanian jest pokazywany oddzielnie. Zakres stomatologiczny 25–45 mg/kg/dobę w dwóch podaniach dotyczy dzieci od 2 miesięcy i <40 kg. Wyższy zakres opisany dla innych zakażeń nie został automatycznie przeniesiony do stomatologii. [S01]
3. **Ospamox u dzieci:** wariant aplikacji obejmuje od 1 miesiąca, <40 kg i trzy podania. Nie modeluje schematu noworodkowego ani warunkowego schematu dwóch podań przy dawkach z górnej części zakresu. Jest to zakres implementacji, nie nowa granica dopuszczenia produktu. [S02], [S03]
4. **Czynność nerek:** standardowe podpowiedzi wymagają potwierdzenia przez lekarza prawidłowej funkcji nerek; nie implementują redukcji dla niewydolności/dializ. Znana wartość CrCl ≤30 ml/min blokuje standardowe schematy antybiotyków. eGFR nie zastępuje automatycznie CrCl. Samo zaznaczenie potwierdzenia nie jest oceną kliniczną. [S01], [S02], [S04]
5. **Doraźne leki przeciwbólowe:** częstość oznacza wybrany limit planowanych podań, a liczba opakowań — maksymalne zaplanowane zużycie. Eksport zachowuje „w razie bólu”, odstęp i limit dobowy. Ibuprom 200 mg nie otrzymuje ogólnego limitu 2400 mg/dobę; Metafen nie otrzymuje automatycznego limitu 4000 mg dla osoby ≤50 kg. [S05], [S06]

### Preparaty miejscowe i zabiegowe

- **Brak FTU i umownych gramów:** pasek 1–2 cm, krople żelu oraz „ziarnko grochu” pozostają ilościami opisowymi. Nie wynikają z nich dokładne mg/dobę ani tuby na kurację. Baikadent 5,77 mg/g dotyczy zespołu flawonów; Sachol zawiera chlorek cetalkoniowy, a nie CPC. [S10], [S12], [S14], [S17], [S18]
- **Dentinox N:** ChPL wyklucza <3 miesięcy i, przy określonych lekach wywołujących methemoglobinemię, także <12 miesięcy. Gotowy schemat aplikacji zawężono do ≥12 miesięcy, gdyż brak odpowiedniego wywiadu lekowego. Podanie pozostaje **doraźne (`asNeeded`)**, krótkotrwałe, przy objawach ząbkowania; 2–3 aplikacje nie oznaczają obowiązku stosowania codziennie. [S17]
- **Dezaftan med:** trzy rozpylenia tworzą jedną aplikację. U dorosłego maks.8 aplikacji/dobę, u dzieci >6 lat maks.6; dokładnie 6 lat wymaga indywidualnej interpretacji granicy źródłowej. Rozruch pompki zużywa produkt, dlatego nie generujemy dokładnej liczby butelek. Limit pięciu dni wymaga podania czasu — pusty czas nie przechodzi eksportu. [S13]
- **Tantum:** przedział 6–12 lat i grupa >12 lat są rozdzielone. Dla <6 lat brak reguły zaokrąglenia ułamka rozpylenia w źródle, więc moduł pokazuje instrukcję, nie wymyśla zaokrągleń. Około 176 rozpyleń z 30 ml to szacunek; nie gwarantowana liczba dawek użytkowych. Płyn wymaga umiejętności płukania i wypluwania. [S07], [S08]
- **Metronidazol Chema:** ropień po odbarczeniu i wkładka do kanału są procedurami; nie przeliczamy kieszonek ani kanałów na mg/kg/dobę. Dla zapalenia przyzębia oraz wrzodziejącego zapalenia dziąseł źródłowy okres w aplikacji wynosi **7–10 dni**, z wymaganą wartością czasu. W drugim wskazaniu instrukcja zachowuje sanację po 3–5 dniach. [S22]
- **Ligosan/Chlo-Site:** oba są referencyjne. Ligosan ma dostępną polską ChPL w materiale producenta z 2017 r.; nie potwierdzono aktualności dokumentu. Dla Chlo-Site zweryfikowano kartę producenta, ale nie aktualną polską instrukcję. Wkład Ligosan 260 mg to masa żelu, zawierająca 36,4 mg doksycykliny. [S23], [S24]
- **Zagraniczne wpisy:** dokument USA nie potwierdza rejestracji ani sprzedaży w Polsce. Dentomycin ma irlandzki status wycofania pozwolenia 2022-12-07; Atridox wskazany rekord USA zakończył obrót opakowań 2021-12-31. Nie oznacza to automatycznie statusu we wszystkich krajach. [S25–S30]

## 4. Przypadki odbioru: wyłącznie sztuczne dane i arytmetyka

Poniższe wartości służą sprawdzeniu przeliczeń i blokad. **Nie są zaleceniami leczenia, ustaleniem wskazania ani klinicznym zatwierdzeniem dawek i czasu.** Wiek, masa i okres są danymi testowymi. Dla przypadków źródłowych zakłada się świadome wybranie właściwego wskazania i wymagane potwierdzenie czynności nerek.

| Przypadek | Wprowadzenie do sprawdzenia | Oczekiwany wynik |
|---|---|---|
| Doba a pojedyncza dawka | Ospamox 250 mg/5 ml; fikcyjnie 20 kg, 30 mg/kg/**dobę**, 3 podania, 5 dni | 600 mg/dobę; 200 mg/podanie; 4 ml/podanie; 60 ml łącznie; 1 butelka 60 ml |
| Zmiana stężenia | Te same dane, ale Ospamox 500 mg/5 ml | Ta sama dawka w mg, 2 ml/podanie; 30 ml łącznie — nie 4 ml |
| Dwa składniki | Augmentin 400+57 mg/5 ml; fikcyjnie 20 kg, 45 mg amoksycyliny/kg/dobę, 2 podania, 7 dni | 900 mg amoksycyliny i 128,25 mg klawulanianu/dobę; 5,625 ml/podanie przed oceną możliwości odmierzenia; 78,75 ml łącznie; 2 × 70 ml albo 1 × 140 ml |
| Doraźne maksimum | Ibuprom 200 mg; fikcyjnie dorosły, 400 mg × 4/dobę | Blokada: 1600 mg przekracza limit 1200 mg dla tego źródłowego wariantu |
| Granica populacji | Schemat Metafen: masa dokładnie 50 kg albo wiek dokładnie 12 lat | Brak dostępności tego automatycznego wariantu; nie dopisać 4000 mg jako uniwersalnej normy |
| Instrukcja bez masy | Sachol, 3 aplikacje/dobę, właściwy wiek | Tekst o pasku około 1 cm; brak wymyślonych gramów, mg/dobę i dokładnej liczby tub |
| Wymagany czas | Dezaftan med: pusty czas /5 dni /6 dni | Odpowiednio: blokada /czas mieści się w zakresie /blokada źródłowego wariantu |
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

**Data sprawdzenia dostępu ≠ data dokumentu ≠ data zatwierdzenia klinicznego.** Nowe rekordy i podpowiedzi sprawdzano 2026-11-13; metadane wcześniej obecnej Nystatyny zachowują 2026-11-12. Gdy w danych nie zanotowano daty rewizji ChPL/instrukcji, nie nadajemy jej daty dostępu. Oznacza to punkt do potwierdzenia w przeglądzie. Stare dokumenty podlinkowane na aktualnej stronie nie stają się dokumentami z 2026 r.

### Polskie ChPL, oznakowanie i instrukcje

- **S01 — Augmentin:** [ChPL RPL 8695](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/8695/characteristic). Sprawdzenie 2026-11-13; daty rewizji nie zapisano w danych.
- **S02 — Ospamox zawiesiny:** [ChPL RPL 22744](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/22744/characteristic). Sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S03 — Ospamox, liczba podań:** [ulotka RPL 22744, §3](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/22744/leaflet). Sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S04 — Ospamox tabletki:** [ChPL RPL 22646](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/22646/characteristic). Rodzina pozwoleń 16801/16802/16687; sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S05 — Ibuprom 200 mg:** [ChPL RPL 19798](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/19798/characteristic). Sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S06 — Metafen Paracetamol 500 mg:** [ChPL RPL 44355](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/44355/characteristic). Sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S07 — Tantum Verde aerozol:** [ChPL RPL 6561](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/6561/characteristic). Sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S08 — Tantum Verde płyn:** [ChPL RPL 6560](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/6560/characteristic). Sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S09 — Nystatyna Teva:** [ChPL RPL 20512](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/20512/characteristic). Data sprawdzenia w odziedziczonych metadanych 2026-11-12; brak nowego schematu w tym wydaniu.
- **S10 — Sachol:** [ChPL RPL 5927](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/5927/characteristic). Rewizja 2026-07-07; sprawdzenie 2026-11-13.
- **S11 — Sachol 10 g:** [oznakowanie opakowania RPL 5927](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/5927/package). Sprawdzenie 2026-11-13.
- **S12 — Dezaftan żel:** [Aflofarm, oznakowanie i instrukcja](https://www.aflofarm.com.pl/media/produkt_zalaczniki/dezaftan-ulotka-iB.pdf). Sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S13 — Dezaftan med:** [ChPL RPL 38148](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/38148/characteristic). Sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S14 — Anaftin żel:** [instrukcja producenta](https://anaftin.pl/wp-content/uploads/2020/03/Anaftin_zel_PIL.pdf). Dokument 09/2016; sprawdzenie 2026-11-13.
- **S15 — Anaftin spray:** [instrukcja producenta](https://anaftin.pl/wp-content/uploads/2020/03/Anaftin_spray_PIL.pdf). Dokument 09/2016; sprawdzenie 2026-11-13.
- **S16 — Anaftin płyn:** [instrukcja producenta](https://anaftin.pl/wp-content/uploads/2020/03/Anatin_Plyn_do_plukania_jamy_ustnej_PIL.pdf). Dokument 09/2016; sprawdzenie 2026-11-13.
- **S17 — Dentinox N:** [ChPL RPL 1765](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/1765/characteristic). Sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S18 — Baikadent:** [ChPL RPL 10297](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/10297/characteristic). Sprawdzenie 2026-11-13; daty rewizji nie zapisano.
- **S19 — Baikadent 15 g:** [karta producenta Herbapol](https://herbapol.pl/produkty/baikadent/). Sprawdzenie 2026-11-13; data rewizji strony nieustalona.
- **S20 — Eludril Care, skład i opakowanie:** [polska karta Pierre Fabre](https://www.pierrefabre-oralcare.com/pl-pl/p/eludril-care-przeciwplytkowy-plyn-do-plukania-jamy-ustnej-3577056021695-808759b4). Sprawdzenie 2026-11-13; data rewizji strony nieustalona.
- **S21 — Eludril Care, ilość i sposób użycia:** [polska instrukcja Pierre Fabre](https://www.pierrefabre-oralcare.com/pl-pl/rutyna-przeciwprochnicowa). Sprawdzenie 2026-11-13; data rewizji strony nieustalona.
- **S22 — Metronidazol Chema:** [ChPL RPL 11440](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/11440/characteristic). Sprawdzenie 2026-11-13; daty rewizji nie zapisano.

### Dokumenty referencyjne — bez źródłowego dawkowania w aplikacji

- **S23 — Ligosan:** [Kulzer, polska ChPL w broszurze](https://kulzer.pl/media/product-downloads/pl/ligosan/kulzer-ulotka-ligosan-pl.pdf). ChPL z 2017-09-18; dostęp sprawdzony 2026-11-13. Aktualność wymaga potwierdzenia.
- **S24 — Chlo-Site:** [karta producenta Ghimas](https://www.ghimas.com/en/chlosite1). Dostęp sprawdzony 2026-11-13; brak zweryfikowanej polskiej instrukcji i daty jej wersji.
- **S25 — Triamcinolone Acetonide Dental Paste:** [DailyMed, produkt Sun Pharma](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=b353c8b1-9088-4969-8199-37876f2461cc). Dokument 09/2025; dostęp 2026-11-13; USA.
- **S26 — Arestin:** [DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8515df41-1936-4f3b-86ba-d2bb2a8441fb). Dokument 05/2024; dostęp 2026-11-13; USA.
- **S27 — Atridox:** [DailyMed, wskazany rekord produktu](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=2550dbc0-8bdd-4bca-81d5-eec77ee6fbd5). Dokument 10/2016; zakończenie obrotu tych opakowań w rekordzie 2021-12-31; dostęp 2026-11-13; USA.
- **S28 — Dentomycin, status:** [HPRA, rekord irlandzki](https://www.hpra.ie/find-a-medicine/for-human-use/withdrawn-medicines/details/25737). Wycofanie pozwolenia 2022-12-07; status „Not marketed”; dostęp 2026-11-13.
- **S29 — Dentomycin, opakowanie i postać:** [archiwalna ChPL HPRA](https://assets.hpra.ie/products/Human/25737/Licence_PA1321-001-001_04122018114740.pdf). Dokument 2018-12-04; dostęp 2026-11-13.
- **S30 — Actisite:** [FDA, historyczny przegląd nazw z 2014 r.](https://www.accessdata.fda.gov/drugsatfda_docs/nda/2014/205931Orig1s000NameR.pdf). Wymienia produkt już nieobecny na rynku; dostęp 2026-11-13. Nie jest aktualną ChPL ani potwierdzeniem statusu w Polsce.
