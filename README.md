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
css/style.css   Kreide-auf-Rasen-Optik
js/data.js      Namen, Marotten, Gegner, Events, Kommentartexte
js/engine.js    Spiellogik (UI-unabhängig, läuft auch in Node)
js/game.js      UI-Controller (Screens, Match-Ablauf, Save)
sim/sim.js      Balance-Simulation
```

## Balance-Simulation

```
node sim/sim.js 500
```

Spielt komplette Runs mit einer Zufalls-KI durch und zeigt Winrate und Tore pro Stage. Richtwert: Die Zufalls-KI gewinnt ~3–5 % der Runs komplett; ein Mensch, der die angezeigten Wahrscheinlichkeiten nutzt, deutlich mehr.
