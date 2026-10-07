# Tower Settings Keeper

Eine Mod für Civilization VII. Mit ihr bleiben die Einstellungen, die du in anderen Mods vornimmst, nach einem Neustart des Spiels erhalten. Sie hat keine eigenen Einstellungen und ändert nichts am Spielverlauf.

## Das Problem

Mods speichern ihre Einstellungen im `localStorage` des Spiels. In Civilization VII 1.5.0 hat dieser Speicher einen Fehler. Beim Lesen wird immer der erste Eintrag zurückgegeben, egal welcher Eintrag angefragt wurde, und die Einträge lassen sich nicht auflisten. Eine Mod kann ihre eigenen Einstellungen nur lesen, wenn ihr Eintrag zufällig an erster Stelle steht. Jede andere Mod bekommt die Daten einer fremden Mod, hält sie für ihre eigenen und schreibt sie beim nächsten Speichern unter ihrem eigenen Namen zurück.

Spieler sehen Optionsmenüs, die sich bei jedem Start zurücksetzen, und manchmal tauchen die Einstellungen einer Mod in einer anderen auf.

Die meisten Optionsmenüs teilen sich einen Eintrag namens `modSettings` mit einem Abschnitt pro Mod. Etwa fünfzig Workshop-Mods enthalten außerdem eine Hilfsroutine, die den gesamten Speicher löscht, sobald sie einen zweiten Eintrag sieht. Eine einzige Mod, die ihre Einstellungen unter einem eigenen Eintrag ablegt, genügt, um beim nächsten Speichern die Einstellungen aller anderen Mods zu löschen.

## Was die Mod tut

Sie hält jeden Eintrag in der einen Zeile, die das Spiel lesen kann, und beantwortet jeden `localStorage`-Aufruf aus dieser Zeile.

- Eine Mod mit eigenem Schlüssel bekommt ihn unter diesem Schlüssel gespeichert und zurückgelesen.
- Der gemeinsame Eintrag `modSettings` funktioniert wie bisher, ein Abschnitt pro Mod, sodass bestehende Optionsmenüs nicht geändert werden müssen.
- Der Speicher meldet immer genau einen Eintrag, deshalb läuft die Löschroutine nie.
- Hat eine andere Mod den Speicher bereits durcheinandergebracht, rückt die Mod die Einträge, die sie zuordnen kann, an ihren Platz und lässt den Rest unangetastet. Bei jedem Start prüft sie erneut.

Andere Mods brauchen keine Aktualisierung. Die Mod funktioniert mit den Mods, die es im Workshop bereits gibt.

## Funktioniert mit jeder Mod, ohne Änderungen

Diese Mod behebt das Problem für jede Mod, die Einstellungen speichert, so wie diese Mods heute sind. Mod-Autoren müssen nichts ändern und nichts anmelden. Wer diese Mod installiert, bekommt auf einen Schlag funktionierende Einstellungen in allen seinen Mods.

Mod-Autoren haben eine zusätzliche Möglichkeit. Sie können dieselbe Datei in ihrer eigenen Mod mitliefern, damit ihre Spieler auch dann versorgt sind, wenn sie diese Mod nie installieren. Das ist unten unter „Für Mod-Autoren“ beschrieben. Eine Mod, die die Datei mitliefert, und diese Mod können zusammen installiert sein. Nur eine Kopie läuft, die neueste, die anderen tun nichts.

## Bildschirmfotos

Einstellungen im Hauptmenü geändert und nach einem Neustart im Optionsbildschirm wieder gelesen:

| Vorher | Nach der Änderung | Nach einem Neustart |
|---|---|---|
| ![](../images/1-menu-before.png) | ![](../images/1-menu-after.png) | ![](../images/2-menu-persisted.png) |

Einstellungen während einer Partie geändert und nach einem weiteren Neustart im Menü und in der Partie wieder gelesen:

| In der Partie, vorher | In der Partie, nachher | Menü, nach einem Neustart | Partie, nach einem Neustart |
|---|---|---|---|
| ![](../images/3-ingame-before.png) | ![](../images/3-ingame-after.png) | ![](../images/4-menu-after-game.png) | ![](../images/5-ingame-persisted.png) |

Die anderen Mods verwenden die gespeicherten Werte, sie zeigen sie nicht nur an. Die Einstellung „Commander lens activation“ von Map Trix wurde auf „Military and Recon Units“ gesetzt und gespeichert. In einem neuen Spielprozess schaltet die Auswahl eines Spähers die Kommandanten-Linse ein, was mit der Standardeinstellung nicht passiert:

![](../images/lens-persisted-scout.png)

Getestet mit 1.5.0 und 28 Mods, darunter Map Trix, City Hall, Celebratory Celebrations, Wonders Screen Continued, Better Ribbon Info, Compact Policy Cards, History and Rankings, ein Einstellungsmanager und AutoMissionary. Das vollständige Protokoll steht in [docs/design.md](../design.md) (Englisch).

## Installation

Abonniere die Mod im Steam Workshop, oder lade das Zip der neuesten Version herunter und entpacke es nach `~/Library/Application Support/Civilization VII/Mods/` (macOS) oder `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Mods\` (Windows). Aktiviere sie dann unter „Zusätzliche Inhalte“. Es gibt nichts einzustellen.

## Gut zu wissen

- Einstellungen, die du ab jetzt speicherst, bleiben erhalten. Einstellungen, die vor der Installation verloren gingen, sind weg, es sei denn, sie liegen noch unter einem Eintrag auf der Festplatte, den die Mod zuordnen kann.
- War der Speicher bereits beschädigt, rät die Mod nicht, welche Mod einen Eintrag geschrieben hat, den sie nicht zuordnen kann. Ist dieser Eintrag der einzige verbliebene, baut die Mod den Speicher um ihn herum neu auf und behält seinen Inhalt. Der Name des Eintrags geht verloren. Eine spätere Version, die den Inhalt erkennt, legt ihn wieder unter dem richtigen Namen ab. Stehen zwei oder mehr solcher Einträge im Weg, legt die Mod eine neue Wurzel vor ihnen an, lässt sie auf der Festplatte liegen und versucht es beim nächsten Start erneut. Sie überschreibt nie die Daten einer anderen Mod.
- Das Spiel garantiert nicht, in welcher Reihenfolge Mod-Skripte laufen. Eine Mod, die ihre Einstellungen in dem Moment liest, in dem ihr Skript geladen wird, bevor diese Mod gelaufen ist, sieht für diesen einen Start das alte Verhalten. In jedem bisherigen Teststart lief diese Mod als erste.
- Die eigenen Texte der Mod sind in alle elf Sprachen übersetzt, die das Spiel unterstützt.
- Der Speicher hat ein Größenlimit von 4 MB. Das ist das Achtfache der 0,5 MB, die ein Speicher mit 28 Mods belegt. Eine Mod, die darüber hinaus will, bekommt diesen einen Schreibvorgang abgelehnt und behält ihre früheren Einstellungen, und unter „Optionen, Add-ons“ erscheint eine Zeile „Speicherlimit erreicht“, die die Mod benennt. Sonst ist nichts betroffen. Siehe „Last und Grenzen“ weiter unten.
- Auf dem Bildschirm erscheint nichts, abgesehen von einer Zeile in `Logs/UI.log`, die mit `[settings-keeper] ready:` beginnt. Die Ausnahme ist der oben beschriebene Ersatzfall. Dann zeigt „Optionen, Add-Ons“ eine Zeile „Speicher neu aufbauen“. Drücke sie, bestätige, und die Einträge, die die Mod nicht zuordnen konnte, werden gelöscht und der Speicher wird als ein Eintrag zurückgeschrieben. Die Zeile verschwindet, sobald der Speicher wieder normal ist.

  | Die Zeile, nur wenn nötig | Die Bestätigung |
  |---|---|
  | ![](../images/rebuild-row.png) | ![](../images/rebuild-dialog.png) |

## Last und Grenzen

Alles liegt in einer Zeile, deshalb ist die Größe dieser Zeile die entscheidende Größe. Mit 28 installierten Mods ist die Zeile auf dem Testrechner etwa 0,5 MB groß, fast alles davon die Spielhistorie einer einzigen Mod. Ein Optionsmenü fügt ein paar hundert Bytes hinzu. Ein Schreibvorgang serialisiert die ganze Zeile, bei dieser Größe etwa 8 ms, einmal pro Aufgabe, egal wie viele Werte darin geschrieben werden. Die Zahl der Mods ist für sich genommen unerheblich. Entscheidend ist, wie viel sie speichern.

Um herauszufinden, wo die Engine aufgibt, hat eine Sonde die Zeile in einem „Jetzt spielen“-Spiel mit denselben 28 Mods durch die Mod hindurch in 1-MB-Schritten wachsen lassen, und getrennte Starts haben die Einzelteile für sich geprüft.

| Zeilengröße | Ein Schreibvorgang (serialisieren und speichern) | Lesen eines Schlüssels nach einem Schreibvorgang |
|---|---|---|
| 0,5 MB, der echte Speicher | 8 ms | 2 ms |
| 5 MB | 71 ms | 20 ms |
| 10 MB | 101 ms | 64 ms |
| 13 MB | 141 ms | 67 ms |
| 16 MB in einem Schreibvorgang | 102 ms | |
| 20 MB, in 1-MB-Schritten gewachsen | 197 ms | |

Bei keiner Größe ging etwas verloren oder wurde beschädigt, und der Speicher blieb durchgehend eine Zeile. Der Spielprozess selbst hat eine Obergrenze. Er blieb ohne Absturzbericht beim 14-MB-Schritt stehen, wenn die Zeile mehrmals hintereinander gelesen und neu geschrieben wurde, und beim 21-MB-Schritt, wenn sie nur neu geschrieben wurde. Ein 14-MB-Speicher lud im Hauptmenü und im Spiel mit allen lesbaren Schlüsseln und blieb dann stehen, als die Zeile noch einmal gelesen und neu geschrieben wurde. Der Prozess belegte dabei 1,9 GB, die Grenze ist also der Arbeitsspeicher des Spiels, nicht der Speicher.

Die Mod lehnt deshalb jeden Schreibvorgang ab, der die Zeile über 4 MB bringen würde, ein Viertel der kleinsten Größe, bei der das Spiel stehen blieb. Der abgelehnte Schreibvorgang wirft denselben `QuotaExceededError`, den ein Browser wirft, wenn sein localStorage voll ist, sodass eine für die Web-API geschriebene Mod ihn bereits kennt. Der frühere Wert der Mod bleibt, alle anderen Mods bleiben unberührt, das Protokoll nennt die Mod und die Größen, und unter „Optionen, Add-ons“ erscheint eine Zeile „Speicherlimit erreicht“ mit denselben Angaben und einem OK, das sie entfernt. Das Limit ist eine Konstante am Anfang von `ui/settings-keeper.js`.

## Die Mod entfernen

Normalerweise ist nichts zu tun. Der Speicher besteht aus einer Zeile, das Spiel liest also wie bisher zuerst `modSettings`, und die anderen Mods finden ihre Abschnitte. Der einzige Zusatz sind ein paar interne Felder, die sie ignorieren. Zeigt „Optionen“ die Zeile „Speicher neu aufbauen“, drücke sie, bevor du die Mod deaktivierst. Sonst löscht die Hilfsroutine in anderen Mods den Speicher beim nächsten Speichern.

## Für Mod-Autoren

Von dir wird nichts verlangt. Die Einstellungen deiner Mod funktionieren mit dieser Mod, egal ob deine Mod den gemeinsamen Eintrag `modSettings` oder einen eigenen Schlüssel verwendet.

Wenn deine Spieler auch ohne diese Mod versorgt sein sollen, kannst du die Korrektur in deiner eigenen Mod mitliefern. Es ist eine Datei und zwei Zeilen in deiner Modinfo, und dein Einstellungscode bleibt unverändert. Die Anleitung steht in [embed/README.md](../../embed/README.md) (Englisch), oder nimm `settings-keeper-embed-<version>.zip` aus der neuesten Version.

## Lizenz

MIT.
