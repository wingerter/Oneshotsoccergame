# ⚽ Bolzplatz-Legenden

Ein humorvolles **Fußball-Roguelike** aus den Tiefen der Kreisklasse – im Browser, ohne Installation, ohne Build-Step.

## Spielen

`index.html` im Browser öffnen. Fertig. (Funktioniert direkt vom Dateisystem, kein Server nötig.)

## Das Spiel

Du draftest ein Team aus fragwürdigen Schulhof-Talenten und kämpfst dich durch **7 K.o.-Spiele** bis zum Pokal. Eine Niederlage – und der Run ist vorbei.

### Kernmechaniken

- **Draft:** 6 Picks (Torwart, Abwehr, 2× Mittelfeld, Sturm, Bank) aus je 3 zufälligen Kandidaten. Viele Spieler haben **Marotten** („Angsthase", „Betonfuß", „Spätzünder" …) mit echten Spieleffekten.
- **Rundenbasierte Matches (JRPG-Stil):** Bei Ballbesitz wählst du pro Aktion – Passen, Dribbeln, Langer Ball, Schuss oder **Powerschuss**. Bei gegnerischem Ballbesitz wählst du eine Verteidigungstaktik (Stellungsspiel, Pressing, Beton anrühren, Blutgrätsche).
- **RNG, aber fair:** Jede Aktion zeigt ihre Erfolgschance **vorher** an. Die Chancen sind auf 4–93 % begrenzt – niemand ist Messi, niemand ist chancenlos.
- **Powerschuss-Trade-off:** Deutlich ungenauer, aber brutal. Verzogene Powerschüsse treffen gerne mal einen Gegner (benommen, manchmal verletzt), den Bratwurststand oder einen Radfahrer.
- **Roguelike-Zwischenspiele:** Nach jedem Sieg wählst du 1 von 3 Events – Training, Hausmeister-Physio, Kuchenverkauf, dubiose Energydrinks, Geheimtraining mit Verletzungsrisiko oder dauerhafte **Fundstücke** (Relikte wie die „Stinkenden Glückssocken").
- **Persistente Konsequenzen:** Verletzungen, Sperren, Fitness und Team-Moral tragen sich durch den Run. Bei Personalnot springt Hausmeister Krause ein (widerwillig).
- **Elfmeterschießen** bei Unentschieden: Ecke wählen beim Schießen UND beim Halten.

Der Spielstand wird automatisch vor jedem Spiel in `localStorage` gesichert.

## Projektstruktur

```
index.html      Einstieg
css/style.css   Retro-Adventure-Optik (VGA-Dämmerung, Holzpanels, Scanlines)
js/data.js      Namen, Marotten, Gegner, Events, Kommentartexte
js/art.js       Pixel-Art-Engine: Porträts, Wappen, Helden, Spielfeld (prozedural, keine Assets)
js/engine.js    Spiellogik (UI-unabhängig, läuft auch in Node)
js/game.js      UI-Controller (Screens, Match-Ablauf, Save)
sim/sim.js      Balance-Simulation
```

## Grafik

Die komplette 2D-Grafik wird zur Laufzeit prozedural auf kleine Canvases gemalt und
hochskaliert (`image-rendering: pixelated`) – im Charme alter Point-&-Click-Adventures:

- **Spielerporträts** (seeded pro Spieler, stabil über Save/Load): Vokuhilas, Schnauzer,
  Zahnlücken, rote Nasen, Pflaster, Drahtbrillen … Marotten färben aufs Porträt ab
  (Kapitänsbinde, Heiligenschein fürs Maskottchen, grimmige Brauen für Rasenmäher).
- **Vereinswappen** (seeded pro Teamname) auf Anzeigetafel und Spielplakaten.
- **Titelhelden**: Feuerball Fred, Padre Peng und der Zeigefinger der Kreisklasse –
  zwei von dreien flankieren zufällig den Titel.
- **Abendlicher Bolzplatz** als gemalter Hintergrund (VGA-Sonnenuntergang, Flutlicht,
  Kirchturm) plus **Mini-Spielfeld** im Match, das Ballbesitz und Zone live anzeigt.

Es werden weiterhin keinerlei externe Assets geladen – alles läuft direkt vom Dateisystem.

## Balance-Simulation

```
node sim/sim.js 500
```

Spielt komplette Runs mit einer Zufalls-KI durch und zeigt Winrate und Tore pro Stage. Richtwert: Die Zufalls-KI gewinnt ~3–5 % der Runs komplett; ein Mensch, der die angezeigten Wahrscheinlichkeiten nutzt, deutlich mehr.
