# Pokrycie katalogu schematami źródłowymi

Przegląd: 2026-11-19. Punkt wyjścia: `aef2ccb5088a203fe0f42ddcb6b8535473ff0d89`.
To audyt pokrycia danych i zakresu kalkulatora, nie walidacja kliniczna wszystkich wskazań.

## Wynik i znaczenie „wszystkich preparatów”

Katalog ma **60 postaci preparatów**. Po dołączeniu instrukcji Ligosanu z tego przeglądu jest **56 aktywnych postaci** i **4 postacie referencyjne lub z wyłączonymi obliczeniami**. Żadnej dodatkowej aktywnej luki poza Nystatyną Teva i 15 postaciami sześciu leków kardiologicznych nie wykryto. Te 16 postaci jest opracowywanych w równoległych modułach.

Właściwe kryterium zakończenia integracji to: każda z 56 aktywnych postaci ma co najmniej jeden jawnie nazwany, źródłowy schemat dla określonego wskazania, etapu i grupy pacjentów. Samo przypisanie schematu do postaci nie oznacza obsługi wszystkich jej wskazań, każdego pacjenta ani wszystkich modyfikacji dawki.

Zalecane sformułowanie po pełnej integracji:

> Wszystkie 56 aktywnych postaci z obecnego katalogu mają schematy źródłowe dla opisanych zastosowań. Cztery pozostałe karty pokazują dokumentację i powód wyłączenia obliczeń. Zakres każdego schematu jest widoczny przed jego zastosowaniem.

Nie należy ogłaszać tego wyniku, dopóki test pokrycia nie potwierdzi integracji Nystatyny, kardiologii i Ligosanu.

## Pięć ocenianych postaci

| Postać | Decyzja | Powód i podstawa | Wykres / ilość |
| --- | --- | --- | --- |
| `ligosan-periodontal-gel` | Dodać aktywną instrukcję profesjonalną | Oficjalny RPL udostępnia polską ChPL, ulotkę i oznakowanie. Stara broszura z 2017 r. nie jest już jedyną podstawą. | Instrukcja zabiegu, bez liczbowej dawki na kieszonkę, sztucznego dawkowania dobowego i automatycznej liczby wkładów. |
| `chlosite-025` | Zachować kartę referencyjną | Aktualna karta i broszura Ghimas potwierdzają wariant. Nie znaleziono aktualnej instrukcji dla polskiego wariantu. Proponowany w broszurze plan wizyt sam producent odróżnia od protokołu. | Objętość strzykawki jest opakowaniem, a orientacyjne „1–2 kieszonki” nie stanowią dokładnego przelicznika zużycia. |
| `chlosite-1` | Zachować kartę referencyjną | Jak wyżej; potwierdzony wariant strzykawki 1 ml. | Nie wprowadzać liczby ml na kieszonkę ani dawki maksymalnej. |
| `dentomycin-gel-ie` | Zachować kartę historyczną / referencyjną | HPRA nadal podaje wycofanie pozwolenia 2022-12-07 i brak w obrocie. Archiwalna ChPL nie dowodzi obecnej dostępności. | Brak aktywnego schematu i obliczeń na podstawie historycznej rejestracji. |
| `enrobactin-rodents-25` | Zachować blokadę obliczeń | ChPL HPRA z rewizją 2026-04-29 opisuje koncentrat, konieczne rozcieńczanie i przygotowanie przed podaniem. | 25 mg/ml pozostaje stężeniem informacyjnym koncentratu, nigdy automatycznym stężeniem roztworu podawanego zwierzęciu. |

### Ligosan: granice wdrożenia

Moduł `periodontal-source-regimens.js` udostępnia `PERIODONTAL_SOURCE_REGIMENS` oraz `PERIODONTAL_FORM_PATCHES`. Patch zastępuje źródło formularza urzędową ChPL i znosi wyłącznie `referenceOnly`; zachowuje tryb instrukcyjny, profesjonalne zastosowanie, brak danych do arytmetyki żelu i ręczną liczbę opakowań.

Schemat dotyczy dorosłych i kieszonek co najmniej 5 mm jako uzupełnienie leczenia niechirurgicznego. Ilość wynika z anatomii kieszonki. Siedem dni opisuje higienę po aplikacji, a nie czas codziennego dawkowania. W źródłowej instrukcji i części dotyczącej przeciwwskazań uwzględniono m.in. karmienie piersią oraz niedawną albo trwającą antybiotykoterapię ogólnoustrojową.

Pole daty zmiany ChPL w odczytanym PDF jest puste. Dlatego `sourceDocumentDate` ma wartość `null`; `sourceCheckedAt: '2026-11-19'` oznacza dzień odczytu, nie datę wydania dokumentu. Obecność dokumentacji RPL nie jest potwierdzeniem zapasu w aptekach.

Testy w `periodontal-source-regimens.test.mjs` sprawdzają poprawne rozwiązanie instrukcji bez fikcyjnej częstości i kuracji, granicę wieku, przypisanie do właściwej postaci, eksport zaleceń po zabiegu oraz zachowanie metadanych opakowań i statusów pozostałych kart.

### Dlaczego Chlo-Site nie otrzymuje obecnie schematu wykonawczego

Publiczne źródła Ghimas obejmują aktualną kartę produktu, broszurę rev5 i tekst edukacyjny o technice aplikacji. Broszura proponuje różną liczbę sesji zależnie od sytuacji klinicznej, lecz określa ją jako poradę dla lekarza, a nie protokół. Nie uzasadnia to automatycznego wpisania stałej częstości dobowej, liczby dni ani liczby strzykawek. Deklarowany czas pozostawania żelu w kieszonce także nie wyznacza odstępu między kolejnymi zabiegami.

Wyszukiwanie znalazło czeską instrukcję na stronie dystrybutora, z datą opracowania 2012-10-01, oraz polską broszurę handlową. Nie są dowodem zweryfikowania bieżącej instrukcji konkretnego polskiego wyrobu. W tym przeglądzie nie uzyskano podstawy do zdjęcia ograniczenia. Kartę można aktywować po sprawdzeniu właściwej IFU; moduł powinien wtedy obsługiwać procedurę gabinetową, a nie wymuszać liczbową dawkę antybiotyku na dobę.

### Dlaczego Enrobactin wymaga osobnego modułu przygotowania

Źródło HPRA zabrania podania nierozcieńczonego produktu i opisuje ryzyko uszkodzenia błony śluzowej przy bezpośrednim podaniu. Dawka substancji, objętość pobrana z koncentratu, objętość wody, stężenie końcowe i podawana część przygotowanej mieszaniny to odrębne wielkości. Obecny kalkulator nie modeluje tego procesu. Dodanie samego schematu mg/kg do istniejącej karty mogłoby błędnie przedstawić objętość koncentratu jako objętość do podania.

Odblokowanie wymagałoby odrębnego, zweryfikowanego modelu rozcieńczenia, odmierzania małych objętości i eksportu instrukcji przygotowania. W tym zadaniu pozostawiono `calculationBlocked: true`, `concentrationMg: null` i `concentrationMl: null`.

## Istniejące schematy weterynaryjne a wykresy

W katalogu są 23 postacie weterynaryjne. **22 aktywne postacie mają przypisania do 29 istniejących schematów lub etapów.** Jedyną postacią wyłączoną jest Enrobactin. W tych danych występują tryby `perKgDose` i `units`, także tablice przedziałów masy ciała.

Do narysowania porównania wystarczy dawka wynikająca z wybranego schematu. Nie trzeba wpisywać jej jako `maxDailyMg`:

| Typ schematu | Referencja do wykresu | Warunek |
| --- | --- | --- |
| `perKgDose` | Dawka źródłowa × masa × częstość źródłowa | Zachować właściwy gatunek, etap, wiek i ograniczenia masy. |
| `units` ze stałą ilością | Źródłowa liczba jednostek × częstość źródłowa | Nie przenosić na postać o innej mocy lub zakresie masy. |
| `units` z `weightBands` | Ilość z jednego dopasowanego przedziału × częstość źródłowa | Najpierw rozwiązać kwalifikację; zachować brzegowe nierówności i luki tabeli. |
| Instrukcja jakościowa / procedura | Opis sposobu użycia | Brak podstawy do procentowego wykresu dawki dobowej. |

Próg 100% powinien znaczyć „dawka wybranego schematu”, a nie „maksymalna bezpieczna dawka”. Jeżeli istnieje odrębny zweryfikowany limit, powinien mieć osobne oznaczenie. Po zmianie wpisanej częstości referencja pozostaje oparta na częstości źródłowej, dzięki czemu różnica jest widoczna. Wartość poza przedziałem kwalifikacji nie powinna otrzymywać pozornie poprawnego zielonego statusu.

Sprawdzony przykład źródłowy: Metacam dla psa rozdziela pierwszą dawkę i późniejszą dawkę podtrzymującą; opisuje też możliwość indywidualnego zmniejszenia po odpowiedzi klinicznej. Ten sam próg nie może obsługiwać obu etapów, a dawka referencyjna nie jest niezależnym progiem toksyczności. Onsior z tabeli masy ciała musi być porównywany do ilości dla wybranego przedziału, bez dowolnej interpolacji tabletek.

## Źródła pierwotne odczytane podczas przeglądu

1. [RPL — Ligosan, ChPL](https://rejestry.ezdrowie.gov.pl/api/rpl/medicinal-products/32531/characteristic), punkty 4.1–4.4 i 6.3–6.6. Alias `rejestrymedyczne.ezdrowie.gov.pl` dla tego dokumentu zwracał błąd narzędzia odczytu; działający urzędowy alias zapisano w schemacie.
2. [RPL — Ligosan, ulotka](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/32531/leaflet), punkt 3; [oznakowanie opakowań](https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/32531/package).
3. [Ghimas — Chlosite 1, aktualna karta](https://www.ghimas.com/en/chlosite1).
4. [Ghimas — Chlosite, broszura angielska rev5](https://www.ghimas.com/files/00026/engchlositepresentazionerev5.pdf), część dotycząca proponowanych sesji i zastrzeżenia do planu.
5. [Ghimas — edukacyjny tekst o aplikacji](https://www.ghimas.com/it/blog/suggerimenti-clinici-per-l-applicazione-di-un-gel-di-clorexidina-a-base-di-xantano), 2023-10-16. Nie traktowano go jako kompletnej IFU.
6. [HPRA — Dentomycin 2%, status pozwolenia](https://www.hpra.ie/find-a-medicine/for-human-use/withdrawn-medicines/details/25737).
7. [HPRA — Enrobactin 25 mg/ml, ChPL z rewizją 2026-04-29](https://assets.hpra.ie/products/Animal/905/ie-spc-nlv0315001a004-mr-vpa10475-020-001-en_30042026111356.pdf), punkty 3.5 i 3.9 oraz 5.2.
8. [VMD — Metacam 1,5 mg/ml dla psów, kwiecień 2026](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2177020.PDF), punkt 3.9.
9. [VMD — Onsior 6 mg dla kotów](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2652572.PDF), punkty 4.5 i 4.9.

Nie oparto nowych wykonywalnych schematów na sklepach, agregatorach leków ani na niezweryfikowanych instrukcjach dystrybutorów.

## Integracja

Pliki wspólne zmienia właściciel integracji. Potrzebne są: dodanie `PERIODONTAL_SOURCE_REGIMENS` do `HUMAN_REGIMENS`, zastosowanie `PERIODONTAL_FORM_PATCHES` do końcowego katalogu oraz dołączenie nowego modułu do jawnych list zasobów w budowaniu i cache aplikacji. Test pokrycia powinien liczyć końcowe postacie katalogu po wszystkich patchach i oddzielnie raportować cztery wymienione wyjątki.

## Kontrakt wdrożonego podglądu dawki dobowej

`supportsDailyDose(form)` w `daily-dose.js` określa dostępność miejsca na wykres. Obsługuje numeryczne postacie silnika: tabletki, zawiesiny, roztwory, aerozole, żele, krople, iniekcje, pasty doustne, proszki doustne i żele doustne. Odrzuca `calculationMode: 'instruction'`, `referenceOnly` i `calculationBlocked`. Instrukcje jakościowe nadal nie mają pozornego procentowego progu.

Wywołanie `ingredientDailyDose` zachowuje dotychczasowe argumenty i przyjmuje dodatkowy `sourceContext`. Przy pacjencie weterynaryjnym powinien on zawierać oryginalny wiek i jednostkę wieku z `regimenContext()`. To ważne przy granicach określonych w tygodniach. Gatunek, masa, identyfikator postaci i status wyłączenia z produkcji żywności pochodzą z bieżącego `input` i `form`, aby nie odziedziczyć starego dopasowania tabeli.

Model wywołuje istniejący `resolveRegimen`, który sprawdza kompletność i rozłączność tabeli oraz dosłowne nierówności przedziału. `note.comparisonEligibility` przenosi wynik do renderera. Nieprawidłowego dopasowania nie nadpisuje zewnętrzne `eligibility.valid: true`. Czas kuracji nie wpływa na porównanie dawki dobowej; sprawdzanie czasu pełnego schematu pozostaje w dotychczasowym przepływie aplikacji.

Znaczenie mocy w modelu:

| Dane postaci | Interpretacja |
| --- | --- |
| `strengthMg` dla tabletki / aerozolu | mg w jednej tabletce / jednym rozpyleniu |
| `strengthMg` dla pasty, proszku i żelu doustnego | mg w 1 g całego preparatu |
| `concentrationMg / concentrationMl` | mg w ml dla płynu lub iniekcji |
| Stężenie płynu i `dropsPerMl` | mg w jednej skalibrowanej kropli |
| `activityIngredients` | Deklarowana aktywność, np. j.m. nystatyny w ml |
| Brak danych substancji, znana ilość fizyczna | Podgląd ml / g / rozpyleń / kropli, bez wymyślania mg |

`ingredientOverride` zachowuje pierwszeństwo nad `activityIngredients`. Historyczna nazwa wewnętrzna `perMl` pozostaje dla zgodności funkcji porównania; po normalizacji oznacza mianownik w fizycznej jednostce obliczeniowej, np. g dla pasty. Krople są normalizowane przy użyciu kalibracji produktu i nie są utożsamiane z ml.

`dailyDoseMarkup` renderuje `schemeRows` również dla zwierząt. Przy braku wybranego schematu albo danych pokazuje krótką neutralną instrukcję. Stwierdzony konflikt z warunkami źródła nadal blokuje procent i wypełnienie. Błędy rzeczywistego odmierzania — np. niepełna działka aplikatora — pozostają widoczne przez `note.calculationErrors`, nawet gdy matematyczna ilość jest zgodna ze źródłem.

`renderDailyDoseNote` zachowuje animację szerokości 240 ms, kontynuowanie od widocznej szerokości przerwanej animacji oraz obsługę `prefers-reduced-motion`. Wartości liczbowe i komunikaty aktualizują się od razu. Nowe źródło lub inna skala nie są animowane jako zwykła zmiana dawki.

Testy `source-dose-comparison.test.mjs` obejmują wszystkie 22 aktywne postacie weterynaryjne, 29 schematów/etapów, niezależne oczekiwane wyniki mg/g i ml, dwuskładnikową pastę, luki i końce tabel, gatunek, wiek, paszport, niezmienność źródła po edycji, IU, kalibrację kropli, neutralny brak danych, błędy aplikatora i animację. Dla danych liczbowych silnik publikuje wielkości z dokładnością 14 cyfr znaczących; porównanie wizualne uwzględnia ten szum arytmetyczny, bez zmiany źródłowej dawki lub limitów silnika.
