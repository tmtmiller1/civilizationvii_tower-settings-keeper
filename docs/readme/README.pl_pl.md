# Tower Settings Keeper

Mod do Civilization VII. Po jego zainstalowaniu opcje ustawione w innych modach pozostają ustawione po ponownym uruchomieniu gry. Nie ma własnych opcji i nie zmienia rozgrywki.

## Problem

Mody przechowują swoje ustawienia w `localStorage` gry. W Civilization VII 1.5.0 ten magazyn ma błąd. Odczyt zwraca pierwszy wpis w magazynie bez względu na to, o który wpis pytano, a wpisów nie da się wylistować. Mod może odczytać własne ustawienia tylko wtedy, gdy jego wpis akurat jest pierwszy. Każdy inny mod dostaje dane innego moda, traktuje je jak swoje i przy następnym zapisie zapisuje je pod własną nazwą.

Gracze widzą panele opcji, które resetują się między uruchomieniami, a czasem ustawienia jednego moda pojawiają się w innym.

Większość paneli opcji dzieli jeden wpis o nazwie `modSettings`, z osobną sekcją dla każdego moda. Około pięćdziesiąt modów z Workshopu zawiera też procedurę pomocniczą, która czyści cały magazyn, gdy tylko zobaczy drugi wpis. Wystarczy jeden mod przechowujący ustawienia pod własnym wpisem, aby przy następnym zapisie skasować ustawienia wszystkich pozostałych.

## Co robi mod

Przechowuje każdy wpis w jedynym wierszu, który gra potrafi odczytać, i obsługuje każde wywołanie `localStorage` z tego wiersza.

- Mod używający własnego klucza ma go zapisany i odczytywany pod tym kluczem.
- Wspólny wpis `modSettings` działa jak dotychczas, z sekcją dla każdego moda, więc istniejące panele opcji nie wymagają zmian.
- Magazyn zawsze zgłasza jeden wpis, więc procedura czyszcząca nigdy się nie uruchamia.
- Jeśli inny mod zdążył już zaburzyć kolejność w magazynie, mod przenosi na miejsce wpisy, które potrafi rozpoznać, a resztę zostawia w spokoju. Sprawdza to ponownie przy każdym uruchomieniu.

Inne mody nie wymagają aktualizacji. Mod działa z modami, które już są w Workshopie.

## Działa z każdym modem, bez zmian

Ten mod rozwiązuje problem dla każdego moda przechowującego ustawienia, takiego, jakim jest dzisiaj. Autorzy modów nie muszą niczego zmieniać ani rejestrować. Gracz, który zainstaluje ten mod, od razu ma działające ustawienia we wszystkich swoich modach.

Autorzy modów mają jedną dodatkową możliwość. Mogą dołączyć ten sam plik do własnego moda, aby ich gracze byli zabezpieczeni nawet wtedy, gdy nigdy nie zainstalują tego moda. Opisano to poniżej w sekcji „Dla autorów modów”. Mod zawierający plik i ten mod mogą być zainstalowane razem. Działa tylko jedna kopia, najnowsza, a pozostałe nic nie robią.

## Zrzuty ekranu

Opcje zmienione w menu głównym, a potem odczytane na ekranie opcji po ponownym uruchomieniu:

| Przed | Po zmianie | Po ponownym uruchomieniu |
|---|---|---|
| ![](../images/1-menu-before.png) | ![](../images/1-menu-after.png) | ![](../images/2-menu-persisted.png) |

Opcje zmienione w trakcie rozgrywki, a potem odczytane po kolejnym ponownym uruchomieniu, w menu i w rozgrywce:

| W grze, przed | W grze, po | Menu, po ponownym uruchomieniu | Gra, po ponownym uruchomieniu |
|---|---|---|---|
| ![](../images/3-ingame-before.png) | ![](../images/3-ingame-after.png) | ![](../images/4-menu-after-game.png) | ![](../images/5-ingame-persisted.png) |

Inne mody korzystają z zapisanych wartości, a nie tylko je wyświetlają. Opcję „Commander lens activation” w Map Trix ustawiono na „Military and Recon Units” i zapisano. W nowym procesie zaznaczenie zwiadowcy włącza soczewkę dowódcy, co nie dzieje się przy ustawieniu domyślnym:

![](../images/lens-persisted-scout.png)

Przetestowano na 1.5.0 z 28 modami, w tym Map Trix, City Hall, Celebratory Celebrations, Wonders Screen Continued, Better Ribbon Info, Compact Policy Cards, History and Rankings, menedżerem ustawień i AutoMissionary. Pełny zapis znajduje się w [docs/design.md](../design.md) (po angielsku).

## Instalacja

Zasubskrybuj mod w Steam Workshop albo pobierz zip z najnowszego wydania i rozpakuj go do `~/Library/Application Support/Civilization VII/Mods/` (macOS) lub `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Mods\` (Windows). Następnie włącz go w „Dodatkowej zawartości”. Nie ma nic do skonfigurowania.

## Warto wiedzieć

- Ustawienia zapisane od tej chwili zostają. Ustawienia utracone przed zainstalowaniem moda przepadły, chyba że wciąż są na dysku pod wpisem, który mod potrafi rozpoznać.
- Jeśli magazyn był już uszkodzony, mod nie zgaduje, który mod zapisał wpis, którego nie potrafi rozpoznać. Jeśli ten wpis jest jedynym, jaki pozostał, mod odbudowuje magazyn wokół niego i zachowuje jego zawartość. Nazwa wpisu przepada. Późniejsza wersja, która rozpozna zawartość, przywróci ją pod właściwą nazwą. Jeśli na drodze stoją dwa takie wpisy lub więcej, mod tworzy przed nimi nowy korzeń, zostawia je na dysku i próbuje ponownie przy następnym uruchomieniu. Nigdy nie nadpisuje danych innego moda.
- Gra nie gwarantuje kolejności uruchamiania skryptów modów. Mod, który odczytuje swoje ustawienia w chwili ładowania skryptu, zanim ten mod się uruchomi, widzi stare zachowanie przez to jedno uruchomienie. We wszystkich dotychczasowych uruchomieniach testowych ten mod uruchamiał się pierwszy.
- Własne teksty moda są przetłumaczone na wszystkie jedenaście języków obsługiwanych przez grę.
- Magazyn ma limit rozmiaru 4 MB. To osiem razy więcej niż 0,5 MB, które zajmuje magazyn z 28 modami. Mod, który próbuje go przekroczyć, ma ten jeden zapis odrzucony i zachowuje wcześniejsze ustawienia, a w Opcje, Dodatki pojawia się wiersz „Osiągnięto limit pamięci” z nazwą moda. Nic innego nie jest dotknięte. Zobacz „Obciążenie i limity” poniżej.
- Na ekranie nic się nie pojawia, poza jedną linią w `Logs/UI.log` zaczynającą się od `[settings-keeper] ready:`. Wyjątkiem jest opisany wyżej przypadek zastępczy. Wtedy w „Opcje, Dodatki” pojawia się wiersz „Przebuduj magazyn”. Naciśnij go, potwierdź, a wpisy, których mod nie potrafił rozpoznać, zostaną usunięte, a magazyn zapisany ponownie jako jeden wpis. Wiersz znika, gdy magazyn wraca do normy.

  | Wiersz, tylko gdy jest potrzebny | Potwierdzenie |
  |---|---|
  | ![](../images/rebuild-row.png) | ![](../images/rebuild-dialog.png) |

## Obciążenie i limity

Wszystko mieści się w jednym wierszu, więc rozmiar tego wiersza jest tym, co trzeba obserwować. Z 28 zainstalowanymi modami wiersz na maszynie testowej ma około 0,5 MB, prawie w całości historię gier jednego moda. Panel opcji dodaje kilkaset bajtów. Zapis serializuje cały wiersz, około 8 ms przy tym rozmiarze, raz na zadanie, niezależnie od liczby zapisywanych w nim wartości. Sama liczba modów nie ma znaczenia. Liczy się to, ile przechowują.

Aby znaleźć, gdzie silnik się poddaje, sonda powiększała wiersz o 1 MB na krok przez tego moda w grze Graj teraz z tymi samymi 28 modami, a osobne uruchomienia sprawdzały poszczególne elementy z osobna.

| Rozmiar wiersza | Jeden zapis (serializacja i zapis) | Odczyt jednego klucza po zapisie |
|---|---|---|
| 0,5 MB, prawdziwy magazyn | 8 ms | 2 ms |
| 5 MB | 71 ms | 20 ms |
| 10 MB | 101 ms | 64 ms |
| 13 MB | 141 ms | 67 ms |
| 16 MB w jednym zapisie | 102 ms | |
| 20 MB, po 1 MB na krok | 197 ms | |

Przy żadnym rozmiarze nic nie zginęło ani nie uległo uszkodzeniu, a magazyn cały czas był jednym wierszem. Sam proces gry ma jednak sufit. Zatrzymał się, bez raportu o awarii, na kroku 14 MB, gdy wiersz był kilka razy z rzędu odczytywany i zapisywany na nowo, oraz na kroku 21 MB, gdy był tylko zapisywany na nowo. Magazyn 14 MB wczytał się w menu głównym i w grze ze wszystkimi kluczami do odczytu, a potem zatrzymał się, gdy wiersz został raz jeszcze odczytany i zapisany. Proces zajmował wtedy 1,9 GB, więc sufitem jest pamięć gry, nie magazyn.

Dlatego mod odrzuca każdy zapis, który powiększyłby wiersz ponad 4 MB, czyli ćwierć najniższego rozmiaru, przy którym gra się zatrzymała. Odrzucony zapis rzuca ten sam `QuotaExceededError`, który rzuca przeglądarka, gdy jej localStorage jest pełny, więc mod napisany pod API sieciowe już wie, co to znaczy. Wcześniejsza wartość moda zostaje, pozostałe mody są nietknięte, dziennik podaje nazwę moda i rozmiary, a Opcje, Dodatki pokazują wiersz „Osiągnięto limit pamięci” z tymi samymi danymi i przyciskiem OK, który go usuwa. Limit to jedna stała na początku `ui/settings-keeper.js`.

## Usuwanie moda

Zwykle nie trzeba nic robić. Magazyn to jeden wiersz, więc gra czyta najpierw `modSettings` jak dawniej, a inne mody znajdują swoje sekcje. Jedynym dodatkiem jest kilka wewnętrznych pól, które ignorują. Jeśli w „Opcjach” widać wiersz „Przebuduj magazyn”, naciśnij go przed wyłączeniem moda. W przeciwnym razie procedura czyszcząca w innych modach wyczyści magazyn przy następnym zapisie.

## Dla autorów modów

Niczego się od ciebie nie wymaga. Ustawienia twojego moda działają z tym modem, niezależnie od tego, czy twój mod używa wspólnego wpisu `modSettings`, czy własnego klucza.

Jeśli chcesz, by twoi gracze byli zabezpieczeni bez instalowania tego moda, możesz dołączyć poprawkę do własnego moda. To jeden plik i dwie linie w modinfo, a kod ustawień pozostaje bez zmian. Instrukcje są w [embed/README.md](../../embed/README.md) (po angielsku), albo pobierz `settings-keeper-embed-<wersja>.zip` z najnowszego wydania.

## Licencja

MIT.
