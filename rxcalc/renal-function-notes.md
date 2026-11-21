# Czynność nerek, CrCl i kwalifikacja schematu

Stan implementacji i przeglądu źródeł: **2026-11-21**. Zakres dotyczy panelu nerkowego, normalizacji danych i prezentacji istniejących schematów. Nie dodano nowych dawek ani automatycznego wyboru leczenia.

## Dwa jawne tryby

Domyślny tryb **Mam oceniony CrCl** przyjmuje ustaloną wartość w ml/min. **Oblicz z kreatyniny** jest osobnym wyborem użytkownika i udostępnia oszacowanie Cockcrofta–Gaulta (CG) dla dorosłych. Wybranie leku lub wpisanie kreatyniny nie uruchamia CG samoczynnie. Podczas obliczania nie używa się poprzedniej wartości ręcznej jako zastępczego wyniku.

CrCl jest odrębny od kreatyniny w surowicy i eGFR. MHRA wskazuje CG do oceny CrCl przy dawkowaniu DOAC; nie przenosimy tego na twierdzenie, że eGFR jest niewłaściwe dla wszystkich leków. Wymaganie CrCl w aplikacji nadal wynika z konkretnego schematu. [MHRA, sekcje „Advice for healthcare professionals” i „When to use estimated creatinine clearance”](https://www.gov.uk/drug-safety-update/prescribing-medicines-in-renal-impairment-using-the-appropriate-estimate-of-renal-function-to-avoid-the-risk-of-adverse-drug-reactions).

## Zakres oszacowania CG

Tryb obliczania wymaga wieku dorosłego w latach albo miesiącach, rzeczywistej masy pacjenta, kreatyniny z jednostką oraz jawnie wybranego współczynnika płci. Wiek w dniach wymaga przepisania w jednej z obsługiwanych jednostek. Nie zakłada się płci ani prawidłowej czynności nerek na podstawie innych pól.

Przed udostępnieniem wyniku użytkownik potwierdza, że kreatynina odzwierciedla stabilną czynność nerek i że masa użyta we wzorze jest odpowiednia. Brak potwierdzenia pozostawia wynik niekompletny. Jawnie niestabilna czynność nerek jest poza zakresem tego oszacowania. SPS opisuje potrzebę stabilnego stężenia oraz ograniczenia CG przy nietypowej masie i budowie ciała; poprawna arytmetyka nie usuwa tych ograniczeń. [SPS, „Estimated Creatinine Clearance” i „Weight for calculation”](https://www.sps.nhs.uk/articles/calculating-kidney-function/).

W implementacji [renal-function.js](renal-function.js) obliczenie ma postać:

```text
CrCl [ml/min] = ((140 − wiek w latach) × masa do wzoru [kg])
               / (72 × kreatynina [mg/dl])
Współczynnik dla wybranej opcji female: × 0,85.
```

Nie stosuje się dolnego zamiennika stężenia kreatyniny, automatycznego doboru masy idealnej/skorygowanej ani ograniczania wyniku do umownego maksimum. Wartości niedodatnie, błędne jednostki, nieprawidłowe dane i nieprawidłowy wynik arytmetyczny są odrzucane. Techniczne granice formularza nie stanowią wskazań klinicznych.

## Dwie różne role masy

`weight` oznacza rzeczywistą masę pacjenta. Pozostaje używana w kwalifikacji schematu i kryterium masy w NVAF. Wartość `renalCalculationWeight` jest opcjonalną, jawną decyzją lekarza dotyczącą wyłącznie wzoru CG. Puste pole pozostawia masę rzeczywistą; wpisanie innej masy nie zastępuje danych pacjenta ani kryterium redukcji dawki. Wynik wyświetla, której masy użyto. Aplikacja nie ustala, jaka masa jest klinicznie właściwa dla danej budowy ciała.

## Jednostki i pełna precyzja

Formularz obsługuje **mg/dl** i **µmol/l** z jawnym wyborem jednostki. Kod normalizuje kreatyninę do mg/dl z użyciem współczynnika 88,4; oba warianty wejścia trafiają do tego samego wzoru. Nie odgaduje jednostki z wielkości wyniku ani nie miesza zaokrąglonych współczynników wzoru SI z wersją mg/dl.

Zmiana samej jednostki zachowuje pierwotny wpis laboratoryjny i jego jednostkę w `renalCreatinineSource`. Obliczenia, kwalifikacja i kontekst koszyka korzystają z tego oryginału, nie z kolejnych konwersji wyświetlanego `Number`. Dzięki temu przełączenie jednostki i powrót nie przesuwają wartości leżącej dokładnie na progu. Rzeczywista edycja liczby unieważnia zachowany oryginał i ustanawia nowy wpis. Przy innej jednostce wyświetlania panel przypomina: **„Wpisany wynik: … Obliczenia zachowują tę wartość.”**

Do porównań trafia pełny, niezaokrąglony wynik w arytmetyce JavaScript. Format ekranu jest osobny: `formatCrClEstimate` zwiększa liczbę cyfr, gdy skrócenie zmieniłoby stronę znanego progu lub pokazało zero zamiast dodatniej wartości. Skrócony wynik jest oznaczany jako przybliżenie. Wyświetlanie nie zmienia wartości przekazywanej do reguł 15/30/50 ml/min ani innych progów wybranego źródła.

## NVAF: warunkowe zliczenie 2 z 3

Podstawa kliniczna reguły pozostaje w [ChPL Eliquis, punkt 4.2: „Dose reduction” i „Renal impairment”](https://www.ema.europa.eu/en/documents/product-information/eliquis-epar-product-information_en.pdf). Wiek, rzeczywista masa i kreatynina są niezależnymi kryteriami; ocena nerkowa pozostaje osobną częścią kwalifikacji.

`apixabanReductionCriteria` wymaga prawidłowego wieku i rzeczywistej masy. Logika nie traktuje nieznanej kreatyniny jako niespełnionego kryterium:

| Spełnione kryteria wieku i masy | Czy kreatynina może zmienić wynik zliczenia? | Zachowanie aplikacji |
| --- | --- | --- |
| 0 z 2 | Nie; najwyżej jedno z trzech może być spełnione | Zliczenie rozstrzygnięte, kreatynina nie jest wymagana tylko w tym celu |
| 1 z 2 | Tak | Kreatynina jest wymagana do rozstrzygnięcia |
| 2 z 2 | Nie; wymagane dwa są już spełnione | Zliczenie rozstrzygnięte, kreatynina nie jest wymagana tylko w tym celu |

Wpisana nieprawidłowa kreatynina nadal jest błędem. Rozstrzygnięte zliczenie nie usuwa wymogu CrCl, oceny nerkowego wariantu, wskazania, fazy ani potwierdzeń. W trybie CG kreatynina jest potrzebna do obliczenia niezależnie od tej tabeli. To częściowe obliczenie istniejącej reguły logicznej, nie automatyczne zalecenie redukcji dawki.

## Neutralny wykres i osobny status

Znana dawka i znana wartość odniesienia mogą być porównane liczbowo przed ukończeniem kwalifikacji pacjenta. Przykład testowy: 10 mg/dobę wobec źródłowych 10 mg/dobę daje neutralne 100%. Brak CrCl nie usuwa tej arytmetyki, ale pozostaje przeszkodą do ukończenia odpowiedniego schematu.

`issues` rozróżniają brak danych, błędne dane i wartości poza zakresem. Wspólny status grupuje brakujące pola i prowadzi do nich przyciskiem `complete-patient-data`. W trybie CG wskazuje konkretnie np. płeć do wzoru albo warunki oszacowania, zamiast dodatkowej prośby o ręczny CrCl. Nie dopisuje się mianownika, maksimum ani zerowej dawki dla potrzeb grafiki. Przekroczenie wartości źródłowej i przekroczenie osobnego limitu pozostają jawne. Szczegóły: [dose-safety-notes.md](dose-safety-notes.md) i [dose-regimen-notes.md](dose-regimen-notes.md).

## Potwierdzenia i koszyk

`sourceConfirmationsAfterEdit` zachowuje wyłącznie wcześniej zaznaczone warunki znajdujące się na jawnej liście niezależności od edytowanego pola. Dotyczy to wybranych potwierdzeń wskazania NVAF oraz odrębnych etapów ZŻG/ZP apiksabanu po edycji masy lub danych nerkowych. Potwierdzenie nerkowe jest unieważniane. Zmiana wieku, nieznany rekord, nowe warunki lub nieznana zależność nie korzystają z tego wyjątku; warunki łączące etap z oceną ryzyka również nie są automatycznie zachowywane.

Mechanizm nie zaznacza żadnego warunku samodzielnie. **Końcowe potwierdzenie aktualnego wyniku jest zawsze resetowane po edycji.** Kontekst koszyka obejmuje aktywny sposób oceny nerek i jej dane. Wcześniejszy zapis nie może przejść eksportu dla zmienionego kontekstu tylko dlatego, że arytmetyczny procent nadal wynosi 100%.

## Podział odpowiedzialności i testy

| Moduł | Odpowiedzialność |
| --- | --- |
| `renal-function.js` | Walidacja danych, normalizacja jednostek, obliczenie CG, strukturalne problemy wejścia |
| `renal-state.js` | Aktywny tryb, oryginał wpisu laboratoryjnego, odrębność danych ekranu i kontekstu schematu |
| `renal-view.js`, `renal.css` | Formularz i wynik; aktualizacja bez odtwarzania edytowanego pola |
| `cardio-anticoagulant-regimens.js`, `human-regimen-engine.js` | Kryteria NVAF, zakres nerkowy, pozostałe reguły i blokady wyniku |
| `source-confirmations.js` | Selektywne unieważnianie potwierdzeń warunków |
| `dose-safety-view.js`, `dose-regimen.js` | Osobna prezentacja liczb i stanu kwalifikacji |

Testy funkcji nerkowych obejmują obie jednostki, granice, błędne dane, wymagane potwierdzenia i odrębność mas. Testy kwalifikacji sprawdzają częściową regułę 2 z 3 oraz niezależny CrCl. `dose-presentation-eligibility.test.mjs` sprawdza neutralne 100%, pojedynczy komunikat, rzeczywisty nieukończony tryb CG, brak fikcyjnego wypełnienia i zachowanie błędów; `dose-scale-motion.test.mjs` sprawdza ruch przy zmianie stanu kwalifikacji, przerwaną animację i ograniczenie ruchu. Testy programu nie zastępują walidacji klinicznej.
