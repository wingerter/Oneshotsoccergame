/* Bolzplatz-Legenden – Daten: Namen, Quirks, Gegner, Events, Kommentare */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SoccerData = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Bei jedem Release aktualisieren (Zeit in MESZ/MEZ)
  const VERSION = '2.0.1';
  const BUILD = '04.07.2026, 11:14 MESZ';

  const FIRST_NAMES = [
    'Kevin', 'Marcel', 'Torben', 'Ronny', 'Justin', 'Dennis', 'Maik', 'Björn',
    'Pascal', 'Sven', 'Nils', 'Jannik', 'Ole', 'Fiete', 'Bruno', 'Egon',
    'Detlef', 'Horst', 'Bernd', 'Uwe', 'Jörg', 'Achim', 'Rüdiger', 'Waldemar',
    'Leon', 'Finn', 'Mehmet', 'Luca', 'Tarik', 'Milan', 'Piotr', 'Giuseppe',
    'Karsten', 'Holger', 'Thorsten', 'Eddi', 'Knut', 'Ludger', 'Ossi', 'Poldi',
  ];

  const LAST_NAMES = [
    'Pommes', 'Grätsche', 'Abseits', 'Latte', 'Pfosten', 'Flanke', 'Stollen',
    'Bratwurst', 'Eckball', 'Tornetz', 'Krause', 'Wuttke', 'Kowalski',
    'Zweikampf', 'Hackentrick', 'Bolzer', 'Rasenschach', 'Matschke',
    'Pausenbrot', 'Trillerpfeife', 'Schwalbe', 'Aluminium', 'Querlatte',
    'Fallrückzieher', 'Notbremse', 'Blutgrätsche', 'Anstoß', 'Wembley',
    'Kunstrasen', 'Elfmeter', 'Nachspielzeit', 'Bananenflanke', 'Tikitaka',
    'Konter', 'Doppelpass', 'Sechzehner', 'Ampelkarte', 'Torjubel',
    'Seitenaus', 'Abstauber', 'Einwurf', 'Grasnarbe', 'Schienbein',
    'Kopfball', 'Übersteiger', 'Blutwurst', 'Currywurst', 'Vereinsheim',
    'Umkleidekabine', 'Schiedsrichter', 'Freistoß', 'Nebelhorn',
    'Stangenfieber', 'Sonntagsschuss', 'Hexenschuss', 'Rudelbildung',
    'Fanmeile', 'Bierzelt', 'Kreisliga', 'Verlängerung',
    'Nachbarschaftsderby', 'Halbzeitpfiff', 'Auswechselbank',
    'Kabinenpredigt', 'Eckfahne', 'Grätschenkönig', 'Torwartpatzer',
    'Balljunge', 'Vereinsmeier', 'Trainerfuchs', 'Standpauke',
    'Schummelpass', 'Torschützenkönig', 'Rasenmähermann', 'Fangesang',
  ];

  const NICKNAMES = [
    'die Wand', 'das Raubein', 'Turbo', 'die Ente', 'der Bomber', 'Socke',
    'Zauberfuß', 'die Krake', 'Beton', 'der Aal', 'Wadenbeißer', 'Freistoß-Gott',
    'die Libelle', 'Halbzeit', 'der Staubsauger', 'Knipser', 'die Planke',
  ];

  // Quirks: static = bei Generierung eingerechnet, dynamic = Engine-Hooks
  const QUIRKS = [
    { id: 'bananenflanke', name: 'Bananenflanke', desc: 'Pässe mit Effet: +8 Passen.', static: { pass: 8 } },
    { id: 'angsthase', name: 'Angsthase', desc: 'Flieht vor jedem Zweikampf: +8 Dribbling, −8 Zweikampf.', static: { dribbling: 8, zweikampf: -8 } },
    { id: 'rasenmaeher', name: 'Rasenmäher', desc: '+8 Zweikampf, aber die Grätschen sind… gründlich.', static: { zweikampf: 8 } },
    { id: 'tunnelblick', name: 'Tunnelblick', desc: 'Sieht nur das Tor: +10 Dribbling, −6 Passen.', static: { dribbling: 10, pass: -6 } },
    { id: 'glaskinn', name: 'Glasknochen', desc: '+5 Tempo, +5 Dribbling, aber doppelt so verletzungsanfällig.', static: { tempo: 5, dribbling: 5 } },
    { id: 'pausenbrot', name: 'Pausenbrot-Power', desc: 'Vor der Halbzeit (Min. 1–45): +6 auf alles.', static: {} },
    { id: 'spaetzuender', name: 'Spätzünder', desc: 'Ab Minute 60: +10 auf alles.', static: {} },
    { id: 'fliegenfaenger', name: 'Angstgegner', desc: 'Torwart-Nerven: +12 Reflexe bei Rückstand, −5 sonst.', static: {} },
    { id: 'showman', name: 'Showman', desc: 'Powerschüsse +8 Schuss, normale Schüsse −4. Hauptsache spektakulär.', static: {} },
    { id: 'elfmetergott', name: 'Elfmetergott', desc: 'Vom Punkt eiskalt: +15% bei Elfmetern.', static: {} },
    { id: 'lehrerliebling', name: 'Lehrerliebling', desc: 'Der Schiri drückt bei ihm beide Augen zu: halbes Karten-Risiko.', static: {} },
    { id: 'betonfuss', name: 'Betonfuß', desc: 'Verzogene Powerschüsse treffen deutlich öfter einen Gegner.', static: {} },
    { id: 'maskottchen', name: 'Maskottchen', desc: 'Solange er fit auf dem Platz steht: Team-Moral +5.', static: {} },
    { id: 'wadenkrampf', name: 'Wadenkrampf', desc: '+8 Tempo, aber die Puste ist schnell weg (Fitness sinkt 50% schneller).', static: { tempo: 8 } },
    { id: 'standfest', name: 'Standfest', desc: '+4 Zweikampf. Erholt sich doppelt so schnell von Powerschuss-Benommenheit.', static: { zweikampf: 4 } },
    { id: 'kapitaen', name: 'Kapitän', desc: '+4 Passen. Solange er mitspielt: das ganze Team +3 Zweikampf.', static: { pass: 4 } },
    { id: 'zauberfuss', name: 'Zauberfuß', desc: '+4 Schuss. Freistoß-Spezialist: +12% bei direkten Freistößen.', static: { schuss: 4 } },
    { id: 'schwalbenkoenig', name: 'Schwalbenkönig', desc: '+3 Dribbling. Bei misslungenem Dribbling schauspielert er öfter ein Foul herbei.', static: { dribbling: 3 } },
    { id: 'eisblock', name: 'Eisblock', desc: '+5 Reflexe. Im Elfmeterschießen hält er spürbar öfter.', static: { reflexe: 5 } },
  ];

  const RELICS = [
    { id: 'socken', name: 'Stinkende Glückssocken', desc: 'Ungewaschen seit 2019. Team-Moral fällt nie unter 50.' },
    { id: 'klebeband', name: 'Kapitänsbinde aus Klebeband', desc: 'Alle Spieler: +3 Zweikampf.' },
    { id: 'brot', name: 'Magisches Pausenbrot', desc: 'Zwischen den Spielen: +15 zusätzliche Fitness-Regeneration.' },
    { id: 'megafon', name: 'Megafon vom Hausmeister', desc: 'Nach jedem Sieg: +5 Extra-Moral.' },
    { id: 'pokal', name: 'Plastikpokal von 2011', desc: 'Powerschüsse gehen 6% öfter aufs Tor.' },
    { id: 'tornetz', name: 'Selbstgeknüpftes Tornetz', desc: 'Der eigene Torwart: +5 Reflexe.' },
    { id: 'tafel', name: 'Taktiktafel (leicht verbogen)', desc: 'Alle Spieler: +4 Passen.' },
    { id: 'pfeife', name: 'Ersatz-Trillerpfeife des Schiris', desc: 'Fouls am eigenen Team geben öfter Elfmeter.' },
  ];

  // 7 Gegner, aufsteigend fies
  const STAGES = [
    { name: '1. FC Pausenhof', desc: 'Spielen barfuß und diskutieren jede Entscheidung. Aufwärmgegner.', tier: 38 },
    { name: 'SV Rasenlücke 03', desc: 'Ihr Platz hat mehr Maulwurfshügel als Grashalme. Sie kennen jeden davon.', tier: 43 },
    { name: 'Eltern-Auswahl', desc: 'Konditionell fragwürdig, aber brutal in der Nachspielzeit motiviert.', tier: 47 },
    { name: 'Das Lehrerkollegium', desc: 'Der Sportlehrer pfeift UND spielt mit. Rechne mit nichts Gutem.', tier: 52 },
    { name: 'Die 10c', desc: 'Drei von denen sind eigentlich schon 18. Fragt keiner nach.', tier: 57 },
    { name: 'Dorf-Legenden 04', desc: 'Haben 2004 mal fast in der Kreisliga A gespielt. Reden noch heute davon.', tier: 62 },
    { name: 'Internatsauswahl St. Günther', desc: 'Privatschule mit eigenem Rasenroboter. Der Endgegner.', tier: 68 },
  ];

  // 5 feste Vereine für den Liga-Modus (Einfachrunde, gleichzeitig unterwegs)
  const LEAGUE_CLUBS = [
    { name: 'SV Blechbüchse', desc: 'Ihr Vereinsheim ist eine umgebaute Garage. Ihr Stolz ist grenzenlos.', tier: 42 },
    { name: 'Kreisliga-Kollektiv Nord', desc: 'Spielen seit Jahren dieselbe Aufstellung. Und dasselbe Ergebnis.', tier: 48 },
    { name: 'FC Feierabend', desc: 'Kommen direkt von der Arbeit, riechen nach Grillkohle, treten trotzdem zu.', tier: 54 },
    { name: 'Rasenballett München-Ost', desc: 'Nennen sich "technisch versiert". Sind meistens einfach nur langsam.', tier: 58 },
    { name: 'Alte Herren Vereinigt', desc: 'Durchschnittsalter 47, Laufbereitschaft 0. Aber die Übersicht, mein Gott.', tier: 63 },
  ];

  const TEAM_PREFIX = ['SV', 'FC', 'TSV', 'SG', 'Eintracht', 'Dynamo', 'Rot-Weiß', 'Blau-Gelb'];
  const TEAM_SUFFIX = [
    'Bolzplatz', 'Hinterhof', 'Kreisklasse', 'Ascheplatz', 'Tartanbahn',
    'Pausenhalle', 'Kabinengeruch', 'Flutlichtmast', 'Abstiegskampf', 'Baggersee',
  ];

  const HAUSMEISTER = { first: 'Hausmeister', last: 'Krause' };

  // Kommentar-Pools. Platzhalter: {name}, {team}, {opp}, {target}
  const COMMENTARY = {
    kickoff: [
      'Anpfiff! Der Schiri hat seine Pfeife heute tatsächlich dabei.',
      'Es geht los! Der Platzwart hat extra die größten Steine vom Feld gesammelt.',
      'Anstoß! Irgendwo bellt ein Hund. Atmosphäre pur.',
    ],
    halftime: [
      'HALBZEIT! Es gibt lauwarmen Tee und eine wirre Ansprache.',
      'Pause! Jemand hat die Orangenscheiben vergessen. Die Stimmung kippt fast.',
      'Halbzeit. Der Trainer malt wilde Pfeile auf die Taktiktafel. Niemand versteht sie.',
    ],
    passOk: [
      '{name} spielt einen sauberen Pass auf {target}.',
      '{name} findet {target} – gar nicht mal so schlecht!',
      'Flacher Ball von {name}, {target} nimmt ihn mit.',
      '{name} passt zu {target}. Fast schon Tiki-Taka. Fast.',
    ],
    passFail: [
      'Der Pass von {name} landet im Nirgendwo. Ballverlust!',
      '{name} passt direkt in den Fuß des Gegners. Autsch.',
      'Fehlpass {name}! Der Ball rollt traurig ins Aus… Gegnerball.',
    ],
    querpassOk: [
      '{name} legt quer auf {target} – der steht jetzt richtig gut!',
      'Kluger Querpass von {name}. {target} hat freie Bahn!',
    ],
    dribbleOk: [
      '{name} tanzt seinen Gegenspieler aus! Der guckt nur noch hinterher.',
      'Tunnel! {name} lässt einen stehen und hat Platz!',
      '{name} mit einem Übersteiger, den er seit Wochen übt. Er klappt!!',
    ],
    dribbleFail: [
      '{name} verdribbelt sich. Der Ball ist weg.',
      '{name} will zu viel – abgelaufen, Gegnerball.',
      'Der Übersteiger von {name} beeindruckt niemanden. Ballverlust.',
    ],
    dribbleHurt: [
      '{name} wird rustikal abgeräumt und bleibt kurz liegen. Aua.',
      'Harter Einsteiger gegen {name}! Der Schiri sieht nur Vorteil. Klar.',
    ],
    longOk: [
      'Langer Hafer von {name} – und {target} kriegt ihn tatsächlich runter!',
      '{name} drischt ihn lang nach vorn. {target} ist durch!',
    ],
    longFail: [
      'Der lange Ball von {name} segelt ins Aus. Der Balljunge seufzt hörbar.',
      '{name} schlägt ihn lang – direkt in die Arme des Torwarts. Gegnerball.',
    ],
    goal: [
      'TOOOOOR! {name} macht ihn rein! Ekstase am Spielfeldrand (3 Zuschauer)!',
      'TOR! {name} bleibt eiskalt! Der Torwart schimpft mit seiner Abwehr!',
      'DRIN! {name} trifft und rutscht auf den Knien durch den Matsch!',
    ],
    goalPower: [
      'WAS FÜR EIN HAMMER!! {name} zerlegt fast das Tornetz! POWERTOR!',
      'TOOOR! Der Powerschuss von {name} schlägt ein wie eine Rakete! Der Keeper hatte keine Chance – und will auch keine mehr.',
      'BOOOM! {name} trifft mit voller Wucht! Irgendwo klingelt ein Autoalarm!',
    ],
    save: [
      'Der Torwart hält den Schuss von {name}. Solide.',
      '{name} schießt – aber der Keeper ist da. Nächstes Mal!',
      'Guter Versuch von {name}, aber der Torwart fischt ihn raus.',
    ],
    miss: [
      '{name} verzieht! Der Ball geht Richtung Parkplatz.',
      'Knapp vorbei von {name}! Der Pfosten zittert noch.',
      '{name} schießt übers Tor. Der Ball muss aus der Hecke geholt werden.',
    ],
    powerHitPlayer: [
      'POWERSCHUSS VERZOGEN – und {target} kriegt ihn VOLL ab! Der steht erstmal neben sich!',
      'Der Gewaltschuss von {name} trifft {target} am Kopf! Der weiß gerade nicht mehr, wie er heißt!',
      '{name} zieht ab – der Ball klatscht {target} an die Brust! Der geht zu Boden wie ein nasser Sack!',
    ],
    powerInjure: [
      'Ohje… {target} bleibt liegen. Das war zu viel Wumms. Der ist raus!',
      '{target} muss behandelt werden – der Powerschuss von {name} hat Spuren hinterlassen!',
    ],
    powerHitCrowd: [
      'Der Powerschuss von {name} fliegt in die Zuschauer! Ein Bratwurststand wackelt bedenklich!',
      '{name} ballert den Ball über den Zaun. Ein Radfahrer flucht laut. Legendär!',
      'Der Schuss von {name} trifft die Eckfahne, einen Mülleimer und fast den Schiri. Physik ist auch nur eine Theorie.',
    ],
    powerWide: [
      'Powerschuss von {name}… weit drüber. WEIT. Der Ball ist jetzt ein Problem des Nachbargrundstücks.',
      '{name} wollte zu viel – der Ball fliegt Richtung Sonne.',
    ],
    tackleWin: [
      'Starke Grätsche! {name} holt sich den Ball fair und sauber!',
      '{name} spitzelt den Ball weg! Ballgewinn!',
      'Zweikampf gewonnen! {name} sagt dem Gegner noch etwas Nettes hinterher.',
    ],
    foul: [
      'Foul! Der Schiri pfeift und zückt drohend… erstmal nichts.',
      'Da wurde mehr Bein als Ball getroffen. Freistoß!',
      'Rustikal! Der Schiri hat es diesmal tatsächlich gesehen.',
    ],
    yellow: [
      'GELBE KARTE für {name}! Er diskutiert. Es hilft nichts.',
      'Gelb für {name}! Der Schiri notiert den Namen falsch, aber die Karte zählt.',
    ],
    redcard: [
      'GELB-ROT! {name} muss runter! Er klatscht demonstrativ Beifall. Ganz schlechte Idee.',
      'Die zweite Gelbe für {name} – das war’s! Duschen gehen!',
    ],
    penalty: [
      'ELFMETER! Der Schiri zeigt auf den Punkt! Diskussionen! Rudelbildung! (3 Personen)',
      'Strafstoß! Jemand ruft „NIEMALS!!" – der Schiri bleibt hart.',
    ],
    penaltyGoal: [
      'Elfmeter verwandelt! {name} bleibt cool wie das Pausenhof-Eis!',
      '{name} schiebt den Elfer lässig rein! Der Torwart war schon beim Bäcker.',
    ],
    penaltyMiss: [
      'Der Elfmeter ist GEHALTEN! {name} vergräbt das Gesicht im Trikot!',
      '{name} ballert den Elfer über das Tor. Darüber reden wir nie wieder.',
    ],
    freekickGoal: [
      'FREISTOSSTOR! {name} zirkelt ihn über die Mauer! Wo hat er DAS gelernt?!',
    ],
    freekickMiss: [
      'Der Freistoß von {name} landet in der Mauer. Die Mauer jubelt.',
      'Freistoß von {name} – drüber. Die Taube auf der Latte bleibt sitzen.',
    ],
    oppChance: [
      '{opp} kombiniert sich gefährlich nach vorn…',
      'Vorsicht! {opp} macht ernst!',
    ],
    injury: [
      '{name} verletzt sich! Der „Physio" (ein Vater mit Eisspray) sprintet aufs Feld!',
      '{name} greift sich ans Bein. Das Eisspray ist leer. Das sieht nicht gut aus.',
    ],
    sub: [
      'Wechsel: {name} kommt aufs Feld und wirkt nur mäßig vorbereitet.',
      '{name} wird eingewechselt. Die Trainingshose bleibt fast hängen. Aber er ist drin!',
    ],
    stunRecover: [
      '{name} schüttelt sich und weiß wieder, welches Tor das richtige ist.',
    ],
    fulltime: [
      'ABPFIFF! Der Schiri pfeift dreimal und geht sofort zum Auto.',
      'Schluss! Aus! Vorbei! Die Trikots gehen zurück in die Waschmaschine von Kevins Mutter.',
    ],
  };

  // Zwischen-Spiel-Events (Offers)
  const OFFER_POOL = [
    { id: 'training', weight: 22, title: 'Extra-Training', icon: '🏃' },
    { id: 'physio', weight: 12, title: 'Hausmeister-Physio', icon: '🩹' },
    { id: 'kuchen', weight: 12, title: 'Kuchenverkauf', icon: '🍰' },
    { id: 'neuzugang', weight: 10, title: 'Neuer Mitschüler', icon: '🆕' },
    { id: 'energydrink', weight: 8, title: 'Fragwürdige Energydrinks', icon: '⚡' },
    { id: 'geheimtraining', weight: 10, title: 'Geheimtraining am Baggersee', icon: '🌊' },
    { id: 'relic', weight: 18, title: 'Fundstück', icon: '🎁' },
    { id: 'taktikvideo', weight: 8, title: 'Taktik-Videoabend', icon: '📼' },
  ];

  return {
    VERSION, BUILD,
    FIRST_NAMES, LAST_NAMES, NICKNAMES, QUIRKS, RELICS, STAGES, LEAGUE_CLUBS,
    TEAM_PREFIX, TEAM_SUFFIX, HAUSMEISTER, COMMENTARY, OFFER_POOL,
  };
});
