# Procenty na paskach schematów — 15.11.2026

Wyłącznie warstwa prezentacji: nie zmienia wpisanych dawek, arytmetyki silnika, katalogu, progów klinicznych, warunków porównania, kafelków ani kopiowania.

- Jeden jawny mianownik: 100% to górna granica dobowego zakresu wybranego schematu. Przy dawce stałej oznacza dobową dawkę tego schematu, a przy stosowaniu doraźnym jego pułap dobowy. Nie jest to procent bezpieczeństwa ani stopień ukończenia leczenia.
- Procent bieżącej dawki znajduje się obok ilości każdego składnika. Przerywane kreski mają procent i podpis początku/górnej granicy zakresu; stały schemat ma jedną kreskę. Dla bliskich końców zakresu etykieta jest wspólna, aby napisy nie nachodziły na siebie.
- Dodatkowy limit zachowuje oddzielną ciągłą kreskę i nazwę pochodzenia. Jego procent również odnosi się do górnej granicy schematu; niższy limit nie redefiniuje 100%.
- Koniec skali jest opisany procentowo i jako „Koniec skali · nie limit”. Zwykle to 125% górnej granicy. Jeśli osobny limit jest wyższy, zachowano istniejącą skalę obejmującą ten limit i pokazano jej rzeczywisty procent (np. 166,7%), zamiast nieprawdziwego 125%.
- Dawka powyżej końca skali nie ma obciętego procentu liczbowego. Brak dawki/częstości nie daje fałszywego 0%; niepotwierdzone warunki pacjenta wyłączają procentowe porównanie. Brak masy nie pozwala przypisać procentu limitowi bezwzględnemu na osi na kg.
- Wyświetlanie do jednego miejsca dziesiętnego nie zmienia dokładności obliczeń. Wartości tuż poniżej i powyżej 100% nie zaokrąglają się do pozornej równości; użyto oznaczeń >99,9% / >100%. Dokładne wartości pozostają w modelu i opisach dawek. Zachowano informację, że drugi składnik jest przeliczany z proporcji preparatu, a nie oceniany względem niezależnego maksimum.
- Dotychczasowe odniesienia A/B, pozostałe paski limitów i profile weterynaryjne nie zostały zmienione.

Przykład arytmetyczny ze zrzutu: 20 kg, 40 mg amoksycyliny/kg/dobę w schemacie 25–45. Ilości 800 mg i 114 mg/dobę pokazują 88,9% względem odpowiednich górnych granic 900 mg i 128,25 mg/dobę. Początek zakresu to 55,6%. Nie jest to zalecenie leczenia.

## Weryfikacja

467 testów Node.js przechodzi, w tym 16 nowych testów procentów; budowa statyczna poprawna. 59 sprawdzeń w lokalnym Chromium: rzeczywisty selektor schematu i edytory dawki/masy/wieku, oba składniki, 100%, 200% i ucięta skala, niższy limit, brak danych, dawkowanie stałe, cofnięcie potwierdzenia i blokada niezgodnego eksportu, dwa motywy i szerokości 320/360/390/768/1280 px. Brak błędów JavaScript i poziomego przepełnienia; etykiety mieszczą się w torze i nie nakładają na siebie.

Interfejs uruchomiono bez sieci, z lokalnymi modułami i CSS; adresy importów/ikony zastąpiono lokalnymi URL blob/data w harnessie. Zrzuty obejmują sam panel, z ukrytym nagłówkiem/paskiem akcji/toastem wyłącznie na czas przechwycenia. Nie testowano rzeczywistego iOS/Safari, sieci produkcyjnej ani aktualizacji service workera. Testy programu nie stanowią walidacji klinicznej. Obie kopie plików wykonawczych są identyczne. Cache: `2026-11-15.53`.
