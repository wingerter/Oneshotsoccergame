/* Bolzplatz-Legenden – Engine: Spieler, Draft, Run, Match-Zustandsmaschine.
 * UI-unabhängig; läuft im Browser (global SoccerEngine) und in Node (Balance-Sim). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./data.js'));
  } else {
    root.SoccerEngine = factory(root.SoccerData);
  }
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  // ---------- Helpers ----------
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const rnd = () => Math.random();
  const chance = (p) => rnd() < p;
  const irnd = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  let idSeq = 1;

  function say(pool, vars) {
    let s = pick(D.COMMENTARY[pool] || ['…']);
    for (const k in (vars || {})) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }

  const STAT_KEYS = ['schuss', 'pass', 'dribbling', 'zweikampf', 'tempo', 'reflexe'];
  const STAT_LABELS = {
    schuss: 'Schuss', pass: 'Passen', dribbling: 'Dribbling',
    zweikampf: 'Zweikampf', tempo: 'Tempo', reflexe: 'Reflexe',
  };
  const POS_LABELS = { TW: 'Torwart', ABW: 'Abwehr', MF: 'Mittelfeld', ST: 'Sturm' };

  // Positionsprofile: Bonus/Malus auf den Tier-Mittelwert
  const POS_PROFILE = {
    TW:  { schuss: -18, pass: -8, dribbling: -15, zweikampf: -5, tempo: -10, reflexe: 16 },
    ABW: { schuss: -10, pass: 0, dribbling: -6, zweikampf: 14, tempo: 2, reflexe: -20 },
    MF:  { schuss: 0, pass: 12, dribbling: 6, zweikampf: 4, tempo: 2, reflexe: -20 },
    ST:  { schuss: 14, pass: -2, dribbling: 8, zweikampf: -8, tempo: 6, reflexe: -22 },
  };

  // ---------- Spieler & Teams ----------
  function genName() {
    const first = pick(D.FIRST_NAMES);
    const last = pick(D.LAST_NAMES);
    if (chance(0.18)) return first + ' „' + pick(D.NICKNAMES) + '“ ' + last;
    return first + ' ' + last;
  }

  function genPlayer(pos, tier) {
    const prof = POS_PROFILE[pos];
    const stats = {};
    for (const k of STAT_KEYS) {
      stats[k] = clamp(Math.round(tier + prof[k] + irnd(-9, 9)), 8, 95);
    }
    const p = {
      id: idSeq++,
      name: genName(),
      pos,
      stats,
      quirk: null,
      fitness: 100,
      verletzt: false,
      gesperrt: 0,
      // Match-scoped (werden bei Matchstart zurückgesetzt):
      stunned: 0, gelb: 0, raus: false,
      ghost: false,
    };
    if (chance(0.6)) {
      let q = pick(D.QUIRKS);
      // Manche Marotten wirken nur beim Torwart oder nie beim Torwart (der nie dribbelt/schießt/passt als Feldspieler)
      const TW_ONLY = ['fliegenfaenger', 'eisblock'];
      const OUTFIELD_ONLY = ['showman', 'tunnelblick', 'angsthase', 'zauberfuss', 'schwalbenkoenig'];
      if (pos === 'TW' && OUTFIELD_ONLY.includes(q.id)) q = pick(D.QUIRKS.filter(x => TW_ONLY.includes(x.id)));
      if (pos !== 'TW' && TW_ONLY.includes(q.id)) q = pick(D.QUIRKS.filter(x => !TW_ONLY.includes(x.id)));
      p.quirk = q.id;
      for (const k in q.static) p.stats[k] = clamp(p.stats[k] + q.static[k], 5, 95);
    }
    return p;
  }

  function genHausmeister() {
    const p = genPlayer('MF', 18);
    p.name = D.HAUSMEISTER.first + ' ' + D.HAUSMEISTER.last;
    p.quirk = null;
    p.ghost = true;
    return p;
  }

  function quirkOf(p) { return p.quirk ? D.QUIRKS.find(q => q.id === p.quirk) : null; }
  function hasQuirk(p, id) { return p && p.quirk === id; }

  function overall(p) {
    if (p.pos === 'TW') return Math.round(p.stats.reflexe * 0.8 + p.stats.zweikampf * 0.1 + p.stats.pass * 0.1);
    const w = {
      ABW: { zweikampf: 0.4, tempo: 0.2, pass: 0.15, dribbling: 0.15, schuss: 0.1 },
      MF: { pass: 0.3, dribbling: 0.2, zweikampf: 0.2, tempo: 0.15, schuss: 0.15 },
      ST: { schuss: 0.4, dribbling: 0.2, tempo: 0.2, pass: 0.1, zweikampf: 0.1 },
    }[p.pos];
    let v = 0;
    for (const k in w) v += p.stats[k] * w[k];
    return Math.round(v);
  }

  function genTeamName() {
    return pick(D.TEAM_PREFIX) + ' ' + pick(D.TEAM_SUFFIX);
  }

  function genOpponent(stage) {
    const s = D.STAGES[stage];
    const players = [genPlayer('TW', s.tier)];
    for (const pos of ['ABW', 'MF', 'MF', 'ST', pick(['ABW', 'ST'])]) players.push(genPlayer(pos, s.tier));
    return { name: s.name, desc: s.desc, tier: s.tier, moral: 50 + stage * 2, players };
  }

  // Liga-Modus: eigenständige Vereinsgenerierung (keine Eskalation über Spieltage hinweg)
  function genClubTeam(spec) {
    const players = [genPlayer('TW', spec.tier)];
    for (const pos of ['ABW', 'MF', 'MF', 'ST', pick(['ABW', 'ST'])]) players.push(genPlayer(pos, spec.tier));
    return { name: spec.name, desc: spec.desc, tier: spec.tier, moral: 45 + irnd(-6, 6), players };
  }

  // Einfachrunde für n Teams (gerade), Team-Index 0 = du. Circle-Method.
  function roundRobinSchedule(n) {
    const teams = [];
    for (let i = 0; i < n; i++) teams.push(i);
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) pairs.push([teams[i], teams[n - 1 - i]]);
      rounds.push(pairs);
      teams.splice(1, 0, teams.pop());
    }
    return rounds;
  }

  function poissonSample(lambda) {
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= rnd(); } while (p > L);
    return k - 1;
  }

  // Ergebnis zweier KI-Vereine (nicht live gespielt, für die Hintergrund-Spieltage der Liga)
  function simulateAIMatch(tierA, tierB) {
    const diff = (tierA - tierB) * 0.035;
    const lamA = clamp(1.25 + diff, 0.25, 3.2);
    const lamB = clamp(1.25 - diff, 0.25, 3.2);
    return [poissonSample(lamA), poissonSample(lamB)];
  }

  function newLeagueTable(entries) {
    return entries.map(e => ({ id: e.id, name: e.name, sp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
  }

  function recordResult(table, idA, idB, golsA, golsB) {
    const a = table.find(r => r.id === idA);
    const b = table.find(r => r.id === idB);
    a.sp++; b.sp++;
    a.gf += golsA; a.ga += golsB;
    b.gf += golsB; b.ga += golsA;
    if (golsA > golsB) { a.w++; a.pts += 3; b.l++; }
    else if (golsA < golsB) { b.w++; b.pts += 3; a.l++; }
    else { a.d++; b.d++; a.pts++; b.pts++; }
  }

  function sortedTable(table) {
    return table.slice().sort((x, y) =>
      y.pts - x.pts ||
      (y.gf - y.ga) - (x.gf - x.ga) ||
      y.gf - x.gf ||
      x.name.localeCompare(y.name)
    );
  }

  // ---------- Run ----------
  function newRun() {
    return {
      teamName: genTeamName(),
      players: [],           // 5 Starter-Slots + 1 Bank
      relics: [],
      moral: 60,
      stage: 0,              // 0..6, gewonnene Spiele = stage
      buffs: {},             // z.B. energydrink
      goalsFor: 0, goalsAgainst: 0,
      history: [],           // ['3:1 gegen X', ...]
      over: false, won: false,
    };
  }

  const DRAFT_SLOTS = [
    { pos: 'TW', label: 'Torwart' },
    { pos: 'ABW', label: 'Abwehr' },
    { pos: 'MF', label: 'Mittelfeld' },
    { pos: 'MF', label: 'Mittelfeld' },
    { pos: 'ST', label: 'Sturm' },
    { pos: null, label: 'Ersatzbank (freie Wahl)' },
  ];

  function draftCandidates(slotIndex) {
    const slot = DRAFT_SLOTS[slotIndex];
    const out = [];
    for (let i = 0; i < 3; i++) {
      const pos = slot.pos || pick(['ABW', 'MF', 'ST']);
      out.push(genPlayer(pos, 46 + irnd(-4, 6)));
    }
    return out;
  }

  // ---------- Moral / Relikte ----------
  function addMoral(run, d) {
    run.moral = clamp(run.moral + d, 20, 95);
    if (run.relics.includes('socken') && run.moral < 50) run.moral = 50;
  }

  // ---------- Effektive Stats ----------
  function effStat(m, sideKey, p, key) {
    let v = p.stats[key];
    // Relikte (nur Spieler-Team)
    if (sideKey === 'you') {
      const r = m.run.relics;
      if (key === 'zweikampf' && r.includes('klebeband')) v += 3;
      if (key === 'pass' && r.includes('tafel')) v += 4;
      if (key === 'reflexe' && r.includes('tornetz')) v += 5;
      if (key === 'tempo' && m.buffs.energydrink) v += 8;
    }
    // Dynamische Quirks
    if (hasQuirk(p, 'pausenbrot') && m.minute < 45) v += 6;
    if (hasQuirk(p, 'spaetzuender') && m.minute >= 60) v += 10;
    if (hasQuirk(p, 'fliegenfaenger') && key === 'reflexe') {
      const behind = sideKey === 'you' ? m.score.you < m.score.opp : m.score.opp < m.score.you;
      v += behind ? 12 : -5;
    }
    if (key === 'zweikampf' && teamHasActiveQuirk(m, sideKey, 'kapitaen')) v += 3;
    // Fitness
    v *= 0.7 + 0.3 * (p.fitness / 100);
    // Moral
    const moral = sideKey === 'you' ? effMoral(m) : m.opp.moral;
    v += (moral - 50) * 0.18;
    // Benommen
    if (p.stunned > 0) v *= 0.55;
    return clamp(v, 5, 110);
  }

  function effMoral(m) {
    let mo = m.run.moral;
    const allYou = m.you.gk ? [m.you.gk, ...m.you.field] : [];
    if (allYou.some(p => hasQuirk(p, 'maskottchen') && !p.verletzt && !p.raus && p.fitness > 30)) mo += 5;
    return clamp(mo, 20, 100);
  }

  function teamHasActiveQuirk(m, sideKey, quirkId) {
    const s = m[sideKey];
    if (!s || !s.field) return false;
    const onField = s.gk ? [s.gk, ...s.field] : s.field;
    return onField.some(p => hasQuirk(p, quirkId));
  }

  // Stun-Dauer: „Standfest“ erholt sich in halber Zeit (min. 1 Minute)
  function stunAmount(p, base) {
    return hasQuirk(p, 'standfest') ? Math.max(1, Math.round(base / 2)) : base;
  }

  function drainFitness(p, amount) {
    if (hasQuirk(p, 'wadenkrampf')) amount *= 1.5;
    p.fitness = clamp(p.fitness - amount, 10, 100);
  }

  // ---------- Aufstellung ----------
  function available(players) {
    return players.filter(p => !p.verletzt && !p.raus && p.gesperrt === 0);
  }

  function buildLineup(side) {
    const av = available(side.teamPlayers).slice();
    // Torwart: bester Reflexe-Wert (TW bevorzugt)
    av.sort((a, b) => (b.pos === 'TW' ? 1000 : 0) + b.stats.reflexe - ((a.pos === 'TW' ? 1000 : 0) + a.stats.reflexe));
    side.gk = av.shift() || null;
    av.sort((a, b) => overall(b) - overall(a));
    side.field = av.slice(0, 4);
    const events = [];
    while (side.field.length < 4 || !side.gk) {
      const h = genHausmeister();
      side.teamPlayers.push(h);
      if (!side.gk) side.gk = h; else side.field.push(h);
      events.push({ kind: 'sub', text: 'Personalnot! ' + h.name + ' springt widerwillig ein. („Aber nur bis zur Pause!!")' });
    }
    return events;
  }

  function defRating(m, sideKey) {
    const s = m[sideKey];
    let sum = 0, n = 0;
    for (const p of s.field) {
      sum += effStat(m, sideKey, p, 'zweikampf') * 0.7 + effStat(m, sideKey, p, 'tempo') * 0.3;
      n++;
    }
    return n ? sum / n : 20;
  }

  function bestShooter(m, sideKey) {
    const f = m[sideKey].field;
    return f.slice().sort((a, b) => effStat(m, sideKey, b, 'schuss') - effStat(m, sideKey, a, 'schuss'))[0];
  }

  // ---------- Match ----------
  const ZONE_LABELS = ['Eigene Hälfte', 'Mittelfeld', 'Vor dem Tor'];

  function createMatch(run, oppTeam, opts) {
    opts = opts || {};
    // Match-scoped Spielerfelder zurücksetzen
    for (const p of run.players.concat(oppTeam.players)) {
      p.stunned = 0; p.gelb = 0; p.raus = false;
    }
    const m = {
      run,
      you: { teamPlayers: run.players, name: run.teamName, gk: null, field: [] },
      opp: { teamPlayers: oppTeam.players, name: oppTeam.name, moral: oppTeam.moral, tier: oppTeam.tier, gk: null, field: [] },
      minute: 0,
      endMinute: 90 + irnd(0, 3),
      halfTwoDone: false,
      score: { you: 0, opp: 0 },
      ball: { side: 'you', zone: 0, carrier: null },
      phase: 'attack', // attack | defense | shootout | end
      tactic: 'stellung',
      freiraum: false, querpass: false,
      buffs: Object.assign({}, run.buffs),
      knockout: opts.knockout !== false, // false = Unentschieden erlaubt (Liga), kein Elfmeterschießen
      shootout: null,
      events: [],
      stats: { youShots: 0, oppShots: 0 },
      result: null,
      _speedBonus: 0,
    };
    run.buffs = {}; // einmalige Buffs verbrauchen
    const ev1 = buildLineup(m.you);
    buildLineup(m.opp);
    m.ball.carrier = pick(m.you.field);
    m.events = [{ kind: 'info', text: say('kickoff') }, ...ev1];
    return m;
  }

  function log(m, kind, text) { m.events.push({ kind, text }); }

  // Uhr weiterdrehen; true = Possession-Unterbrechung (Halbzeit/Ende)
  function tick(m, mins) {
    m.minute += mins;
    if (!m.halfTwoDone && m.minute >= 45) {
      m.minute = 46;
      m.halfTwoDone = true;
      log(m, 'whistle', say('halftime'));
      decStunAll(m, 99); // Pause: alle sammeln sich
      // Zweite Halbzeit: Gegner-Anstoß
      m.ball = { side: 'opp', zone: 0, carrier: null };
      m.phase = 'defense';
      m.freiraum = m.querpass = false;
      return true;
    }
    if (m.minute >= m.endMinute) {
      endMatch(m);
      return true;
    }
    return false;
  }

  function decStunAll(m, n) {
    for (const p of [...m.you.field, m.you.gk, ...m.opp.field, m.opp.gk]) {
      if (p && p.stunned > 0) {
        p.stunned = Math.max(0, p.stunned - n);
        if (p.stunned === 0 && n < 99) log(m, 'info', say('stunRecover', { name: p.name }));
      }
    }
  }

  function possessionTo(m, sideKey, zone) {
    decStunAll(m, 1);
    m.freiraum = m.querpass = false;
    m.ball.side = sideKey;
    m.ball.zone = clamp(zone, 0, 2);
    if (sideKey === 'you') {
      m.ball.carrier = pickCarrier(m, zone);
      m.phase = 'attack';
    } else {
      m.ball.carrier = null;
      m.phase = 'defense';
    }
  }

  function pickCarrier(m, zone) {
    const f = m.you.field.filter(p => p.stunned === 0);
    const pool = f.length ? f : m.you.field;
    if (zone === 2) {
      const st = pool.filter(p => p.pos === 'ST');
      if (st.length && chance(0.6)) return pick(st);
    }
    return pick(pool);
  }

  // ---------- Wahrscheinlichkeiten (auch fürs UI) ----------
  function probPass(m, c) {
    return clamp(0.74 + (effStat(m, 'you', c, 'pass') - defRating(m, 'opp')) * 0.006, 0.25, 0.93);
  }
  function probDribble(m, c) {
    const atk = effStat(m, 'you', c, 'dribbling') * 0.75 + effStat(m, 'you', c, 'tempo') * 0.25;
    return clamp(0.55 + (atk - defRating(m, 'opp')) * 0.006, 0.15, 0.85);
  }
  function probLong(m, c) {
    return clamp(0.44 + (effStat(m, 'you', c, 'pass') - defRating(m, 'opp')) * 0.005, 0.15, 0.72);
  }
  function shotSkill(m, sideKey, c, power) {
    let s = effStat(m, sideKey, c, 'schuss');
    if (hasQuirk(c, 'showman')) s += power ? 8 : -4;
    return s;
  }
  function probShot(m, c, zone) {
    const kp = m.opp.gk;
    const base = zone === 2 ? 0.30 : 0.11;
    let p = base + (shotSkill(m, 'you', c, false) - effStat(m, 'opp', kp, 'reflexe')) * 0.005;
    if (m.freiraum) p += 0.10;
    if (m.querpass) p += 0.08;
    if (kp.stunned > 0) p += 0.25;
    return clamp(p, 0.04, 0.8);
  }
  function probPowerOnTarget(m, c, zone) {
    let p = 0.5 + shotSkill(m, 'you', c, true) * 0.0018;
    if (zone === 1) p -= 0.13;
    if (hasQuirk(c, 'betonfuss')) p -= 0.05;
    if (m.run.relics.includes('pokal')) p += 0.06;
    if (m.freiraum) p += 0.07;
    return clamp(p, 0.2, 0.85);
  }
  function probPowerGoalGivenOnTarget(m, c) {
    const kp = m.opp.gk;
    let p = 0.56 + (shotSkill(m, 'you', c, true) - effStat(m, 'opp', kp, 'reflexe') * 0.6) * 0.005;
    if (kp.stunned > 0) p += 0.25;
    return clamp(p, 0.25, 0.92);
  }
  function probPowerGoal(m, c, zone) {
    return probPowerOnTarget(m, c, zone) * probPowerGoalGivenOnTarget(m, c);
  }

  // ---------- Situationsabfrage fürs UI ----------
  function situation(m) {
    if (m.phase === 'end') return { type: 'end' };
    if (m.phase === 'shootout') return shootoutSituation(m);
    if (m.phase === 'defense') {
      return {
        type: 'defense',
        options: [
          { id: 'stellung', label: 'Stellungsspiel', desc: 'Solide und unaufgeregt. Der Klassiker.' },
          { id: 'pressing', label: 'Pressing', desc: 'Früh draufgehen: mehr Ballgewinne, aber Foul-Gefahr.' },
          { id: 'beton', label: 'Beton anrühren', desc: 'Alle hinten rein. Schüsse werden schwer – aber der Gegner kommt leichter nach vorn.' },
          { id: 'graetsche', label: 'Blutgrätsche', desc: 'Volles Risiko: oft Ballgewinn, aber Karten, Elfmeter oder Schlimmeres drohen.' },
        ],
      };
    }
    // attack
    const c = m.ball.carrier;
    const zone = m.ball.zone;
    const opts = [];
    opts.push({
      id: 'pass', label: zone === 2 ? 'Querpass' : 'Passen', prob: probPass(m, c),
      desc: zone === 2 ? 'Verlagern für die bessere Schussposition (+Bonus auf den nächsten Schuss).' : 'Sicher nach vorn spielen (1 Zone).',
    });
    opts.push({
      id: 'dribble', label: 'Dribbeln', prob: probDribble(m, c),
      desc: zone === 2 ? 'Den Verteidiger aussteigen lassen (+Freiraum für den Abschluss).' : 'Riskanter nach vorn (1 Zone, bei Erfolg Freiraum-Bonus).',
    });
    if (zone < 2) {
      opts.push({ id: 'long', label: 'Langer Ball', prob: probLong(m, c), desc: 'Bolzen wie früher: direkt vors Tor – oder ins Aus.' });
    }
    if (zone >= 1) {
      opts.push({
        id: 'shot', label: zone === 1 ? 'Distanzschuss' : 'Schuss', prob: probShot(m, c, zone),
        desc: 'Kontrollierter Abschluss.',
      });
      opts.push({
        id: 'power', label: 'POWERSCHUSS 💥', prob: probPowerGoal(m, c, zone),
        desc: 'Volles Rohr! Ungenau, aber brutal – verzogene Bälle treffen gern mal einen Gegner.',
      });
    }
    return {
      type: 'attack',
      zone, zoneLabel: ZONE_LABELS[zone],
      carrier: c,
      freiraum: m.freiraum, querpass: m.querpass,
      options: opts,
    };
  }

  // ---------- Schritt ausführen ----------
  // opts.speedBonus: 0..~0.12, von der UI aus der Entscheidungszeit berechnet.
  // Wirkt NUR auf die gerade gewählte Aktion (Tempo-Bonus fürs schnelle Entscheiden) und
  // wird danach sofort wieder zurückgesetzt – nie schlechter als die reguläre Chance.
  function step(m, choiceId, opts) {
    m._speedBonus = (opts && typeof opts.speedBonus === 'number') ? Math.max(0, opts.speedBonus) : 0;
    m.events = [];
    if (m.phase === 'end') { m._speedBonus = 0; return m.events; }
    if (m.phase === 'shootout') { shootoutStep(m, choiceId); m._speedBonus = 0; return m.events; }
    if (m.phase === 'defense') {
      m.tactic = choiceId;
      simulateOppPossession(m);
      m._speedBonus = 0;
      return m.events;
    }
    resolveAttack(m, choiceId);
    m._speedBonus = 0;
    return m.events;
  }

  function resolveAttack(m, actionId) {
    if (tick(m, irnd(2, 5))) return;
    const c = m.ball.carrier;
    const zone = m.ball.zone;
    drainFitness(c, 2);

    if (actionId === 'pass') {
      const ok = chance(clamp(probPass(m, c) + m._speedBonus, 0.02, 0.97));
      const mates = m.you.field.filter(p => p !== c);
      const target = zone === 2
        ? (mates.filter(p => p.pos === 'ST')[0] || pick(mates))
        : pick(mates);
      if (ok) {
        if (zone === 2) {
          m.querpass = true;
          log(m, 'good', say('querpassOk', { name: c.name, target: target.name }));
        } else {
          m.ball.zone = zone + 1;
          log(m, 'good', say('passOk', { name: c.name, target: target.name }));
        }
        m.ball.carrier = target;
        m.freiraum = false;
      } else {
        log(m, 'bad', say('passFail', { name: c.name }));
        possessionTo(m, 'opp', 2 - zone);
      }
      return;
    }

    if (actionId === 'dribble') {
      const ok = chance(clamp(probDribble(m, c) + m._speedBonus, 0.02, 0.95));
      if (ok) {
        if (zone < 2) m.ball.zone = zone + 1;
        m.freiraum = true;
        log(m, 'good', say('dribbleOk', { name: c.name }));
      } else {
        const r = rnd();
        const foulThresh = 0.12 + (hasQuirk(c, 'schwalbenkoenig') ? 0.15 : 0);
        if (r < foulThresh) {
          // Foul am Dribbler → Standard
          log(m, 'whistle', say('foul'));
          resolveSetPiece(m, 'you', zone);
        } else if (r < foulThresh + 0.18) {
          drainFitness(c, 8);
          log(m, 'bad', say('dribbleHurt', { name: c.name }));
          maybeInjure(m, 'you', c, 0.08, null);
          if (m.phase !== 'end') possessionTo(m, 'opp', 2 - zone);
        } else {
          log(m, 'bad', say('dribbleFail', { name: c.name }));
          possessionTo(m, 'opp', 2 - zone);
        }
      }
      return;
    }

    if (actionId === 'long') {
      const ok = chance(clamp(probLong(m, c) + m._speedBonus, 0.02, 0.9));
      const st = m.you.field.filter(p => p.pos === 'ST')[0] || pick(m.you.field.filter(p => p !== c)) || c;
      if (ok) {
        m.ball.zone = 2;
        m.ball.carrier = st;
        log(m, 'good', say('longOk', { name: c.name, target: st.name }));
      } else {
        log(m, 'bad', say('longFail', { name: c.name }));
        possessionTo(m, 'opp', 0);
      }
      return;
    }

    if (actionId === 'shot') {
      m.stats.youShots++;
      drainFitness(c, 1);
      const p = clamp(probShot(m, c, zone) + m._speedBonus, 0.02, 0.95);
      m.freiraum = m.querpass = false;
      if (chance(p)) {
        scoreGoal(m, 'you', c, false);
      } else {
        log(m, 'bad', chance(0.55) ? say('save', { name: c.name }) : say('miss', { name: c.name }));
        possessionTo(m, 'opp', 0);
      }
      return;
    }

    if (actionId === 'power') {
      m.stats.youShots++;
      drainFitness(c, 4);
      m.freiraum = m.querpass = false;
      resolvePowerShot(m, 'you', c, zone, m._speedBonus);
      return;
    }
  }

  function resolvePowerShot(m, sideKey, c, zone, extraAdjust) {
    extraAdjust = extraAdjust || 0;
    const other = sideKey === 'you' ? 'opp' : 'you';
    const onTarget = sideKey === 'you'
      ? chance(clamp(probPowerOnTarget(m, c, zone) + extraAdjust, 0.05, 0.95))
      : chance(clamp(0.48 - (zone === 1 ? 0.13 : 0) + shotSkill(m, sideKey, c, true) * 0.0018 + extraAdjust, 0.05, 0.95));
    if (onTarget) {
      const kp = m[other].gk;
      let pGoal = clamp(0.56 + (shotSkill(m, sideKey, c, true) - effStat(m, other, kp, 'reflexe') * 0.6) * 0.005, 0.25, 0.92);
      if (kp.stunned > 0) pGoal += 0.25;
      if (chance(pGoal)) {
        scoreGoal(m, sideKey, c, true);
      } else {
        // Gehalten – mit Wumms: kleiner Chance, dass der Keeper benommen ist
        log(m, 'bad', say('save', { name: c.name }));
        if (chance(0.2)) {
          kp.stunned = stunAmount(kp, 2);
          log(m, 'funny', kp.name + ' hält den Kracher – aber seine Hände vibrieren noch. Er wirkt benommen!');
        }
        possessionTo(m, other, 0);
      }
    } else {
      // Verzogen: Chaos-Tabelle
      let pHit = 0.38;
      if (hasQuirk(c, 'betonfuss')) pHit += 0.2;
      const r = rnd();
      if (r < pHit) {
        const victims = m[other].field.filter(p => !p.raus);
        const victim = victims.length ? pick(victims) : m[other].gk;
        victim.stunned = stunAmount(victim, 3);
        log(m, 'funny', say('powerHitPlayer', { name: c.name, target: victim.name }));
        maybeInjure(m, other, victim, 0.12, say('powerInjure', { name: c.name, target: victim.name }));
      } else if (r < pHit + 0.22) {
        log(m, 'funny', say('powerHitCrowd', { name: c.name }));
        if (sideKey === 'you') addMoral(m.run, 2);
      } else {
        log(m, 'bad', say('powerWide', { name: c.name }));
      }
      if (m.phase !== 'end') possessionTo(m, other, 0);
    }
  }

  function scoreGoal(m, sideKey, scorer, power) {
    m.score[sideKey]++;
    log(m, 'goal', say(power ? 'goalPower' : 'goal', { name: scorer.name }) + '  [' + m.score.you + ':' + m.score.opp + ']');
    if (sideKey === 'you') {
      m.run.goalsFor++;
      addMoral(m.run, power ? 4 : 2);
    } else {
      m.run.goalsAgainst++;
      addMoral(m.run, -2);
    }
    // Anstoß für die Gegenseite
    possessionTo(m, sideKey === 'you' ? 'opp' : 'you', 0);
  }

  function maybeInjure(m, sideKey, p, baseChance, extraText) {
    let pc = baseChance;
    if (hasQuirk(p, 'glaskinn')) pc *= 2;
    if (p.ghost) pc = 0;
    if (chance(pc)) {
      p.verletzt = true;
      p.raus = true;
      log(m, 'injury', extraText || say('injury', { name: p.name }));
      if (sideKey === 'you') addMoral(m.run, -5);
      rebuildAfterLoss(m, sideKey, p);
    }
  }

  function rebuildAfterLoss(m, sideKey, lost) {
    const s = m[sideKey];
    const inGame = [s.gk, ...s.field];
    const sub = available(s.teamPlayers).find(p => !inGame.includes(p));
    if (s.gk === lost) {
      if (sub) { s.gk = sub; log(m, 'sub', say('sub', { name: sub.name })); }
      else {
        // Feldspieler ins Tor
        const f = s.field.slice().sort((a, b) => b.stats.reflexe - a.stats.reflexe)[0];
        if (f) {
          s.field = s.field.filter(p => p !== f);
          s.gk = f;
          log(m, 'sub', f.name + ' zieht sich das Torwarttrikot über. Es passt nicht. Gar nicht.');
          padWithGhost(m, s);
        }
      }
    } else {
      s.field = s.field.filter(p => p !== lost);
      if (sub) { s.field.push(sub); log(m, 'sub', say('sub', { name: sub.name })); }
      else padWithGhost(m, s);
    }
    if (m.ball.carrier === lost) m.ball.carrier = s.field[0] || s.gk;
  }

  function padWithGhost(m, s) {
    // In Unterzahl weiterspielen – Kleinfeld-Regeln sind da flexibel.
    if (s.field.length === 0) {
      const h = genHausmeister();
      s.teamPlayers.push(h);
      s.field.push(h);
      log(m, 'sub', h.name + ' wird vom Rasenmähen weggeholt und eingewechselt.');
    }
  }

  // Standardsituation für sideKey in dessen Angriffszone `zone`
  function resolveSetPiece(m, sideKey, zone) {
    const other = sideKey === 'you' ? 'opp' : 'you';
    let penaltyChance = zone === 2 ? 0.35 : 0;
    if (sideKey === 'you' && m.run.relics.includes('pfeife')) penaltyChance += 0.15;
    if (zone === 2 && chance(penaltyChance)) {
      // Elfmeter (auto-aufgelöst)
      const shooter = bestShooter(m, sideKey);
      log(m, 'whistle', say('penalty'));
      let p = 0.74 + (shotSkill(m, sideKey, shooter, false) - effStat(m, other, m[other].gk, 'reflexe')) * 0.003;
      if (hasQuirk(shooter, 'elfmetergott')) p += 0.15;
      m.stats[sideKey === 'you' ? 'youShots' : 'oppShots']++;
      if (chance(clamp(p, 0.35, 0.93))) {
        m.score[sideKey]++;
        log(m, 'goal', say('penaltyGoal', { name: shooter.name }) + '  [' + m.score.you + ':' + m.score.opp + ']');
        if (sideKey === 'you') { m.run.goalsFor++; addMoral(m.run, 3); }
        else { m.run.goalsAgainst++; addMoral(m.run, -2); }
        possessionTo(m, other, 0);
      } else {
        log(m, 'bad', say('penaltyMiss', { name: shooter.name }));
        possessionTo(m, other, 0);
      }
    } else if (zone === 2) {
      // Freistoß in Tornähe
      const shooter = bestShooter(m, sideKey);
      m.stats[sideKey === 'you' ? 'youShots' : 'oppShots']++;
      let p = clamp(0.15 + (shotSkill(m, sideKey, shooter, false) - effStat(m, other, m[other].gk, 'reflexe')) * 0.003, 0.05, 0.35);
      if (hasQuirk(shooter, 'zauberfuss')) p = clamp(p + 0.12, 0.05, 0.5);
      if (chance(p)) {
        log(m, 'goal', say('freekickGoal', { name: shooter.name }));
        m.score[sideKey]++;
        m.events[m.events.length - 1].text += '  [' + m.score.you + ':' + m.score.opp + ']';
        if (sideKey === 'you') { m.run.goalsFor++; addMoral(m.run, 3); } else { m.run.goalsAgainst++; addMoral(m.run, -2); }
        possessionTo(m, other, 0);
      } else {
        log(m, 'bad', say('freekickMiss', { name: shooter.name }));
        possessionTo(m, other, 0);
      }
    } else {
      // Schnell ausgeführt: Ballbesitz bleibt, eine Zone vor
      log(m, 'info', 'Der Freistoß wird schnell ausgeführt – weiter geht’s.');
      if (sideKey === 'you') possessionTo(m, 'you', zone + 1);
      else { m.ball.zone = clamp(zone + 1, 0, 2); }
    }
  }

  // ---------- Gegnerischer Ballbesitz ----------
  function simulateOppPossession(m) {
    const t = m.tactic;
    let guard = 0;
    log(m, 'info', say('oppChance', { opp: m.opp.name }));
    while (guard++ < 7) {
      if (tick(m, irnd(2, 4))) return;
      const zone = m.ball.zone;
      const carrier = pick(m.opp.field.filter(p => p.stunned === 0 && !p.raus)) || pick(m.opp.field) || m.opp.gk;
      drainFitness(carrier, 1.5);

      // Blutgrätsche: aktiver Tackling-Versuch vor der Gegner-Aktion
      if (t === 'graetsche' && chance(0.4)) {
        const tackler = pick(m.you.field);
        const pWin = clamp(0.45 + (effStat(m, 'you', tackler, 'zweikampf') - effStat(m, 'opp', carrier, 'dribbling')) * 0.006, 0.2, 0.8);
        if (chance(pWin)) {
          log(m, 'good', say('tackleWin', { name: tackler.name }));
          maybeInjure(m, 'opp', carrier, hasQuirk(tackler, 'rasenmaeher') ? 0.14 : 0.06, null);
          if (m.phase !== 'end') possessionTo(m, 'you', 2 - zone);
          return;
        }
        // Daneben gegrätscht
        if (chance(0.45)) {
          log(m, 'whistle', say('foul'));
          bookPlayer(m, tackler, hasQuirk(tackler, 'rasenmaeher') ? 0.35 : 0.25);
          if (m.phase === 'end') return;
          resolveSetPiece(m, 'opp', zone);
          if (m.phase !== 'defense') return;
          continue;
        }
      }

      // Pressing: passiver Abfangversuch
      if (t === 'pressing' && chance(0.18)) {
        const tackler = pick(m.you.field);
        log(m, 'good', say('tackleWin', { name: tackler.name }));
        possessionTo(m, 'you', 2 - zone);
        return;
      }

      // Gegner wählt Aktion
      const aggro = m.opp.tier >= 55;
      let action;
      if (zone === 2) action = weighted([['shot', 50], ['power', aggro ? 25 : 12], ['pass', 25]]);
      else if (zone === 1) action = weighted([['pass', 45], ['dribble', 22], ['shot', 10], ['power', aggro ? 13 : 6], ['long', 12]]);
      else action = weighted([['pass', 55], ['dribble', 25], ['long', 20]]);

      const defBase = defRating(m, 'you') + (t === 'pressing' ? 6 : 0) - (t === 'beton' ? 7 : 0);

      if (action === 'shot' || action === 'power') {
        m.stats.oppShots++;
        const kp = m.you.gk;
        if (action === 'power') {
          resolvePowerShot(m, 'opp', carrier, zone, -m._speedBonus);
          return;
        }
        let p = (zone === 2 ? 0.34 : 0.14) + (shotSkill(m, 'opp', carrier, false) - effStat(m, 'you', kp, 'reflexe')) * 0.005;
        if (t === 'beton') p -= 0.10;
        if (kp.stunned > 0) p += 0.25;
        p = clamp(p - m._speedBonus, 0.03, 0.75);
        if (chance(p)) {
          scoreGoal(m, 'opp', carrier, false);
        } else {
          log(m, 'good', 'Schuss von ' + carrier.name + ' – ' + (chance(0.6) ? m.you.gk.name + ' hält sicher!' : 'vorbei! Abstoß.'));
          possessionTo(m, 'you', 0);
        }
        return;
      }

      // Fortbewegung des Gegners
      let pOk;
      if (action === 'pass') pOk = clamp(0.76 + (effStat(m, 'opp', carrier, 'pass') - defBase) * 0.006 - m._speedBonus, 0.2, 0.92);
      else if (action === 'dribble') pOk = clamp(0.56 + (effStat(m, 'opp', carrier, 'dribbling') - defBase) * 0.006 - m._speedBonus, 0.12, 0.84);
      else pOk = clamp(0.4 + (effStat(m, 'opp', carrier, 'pass') - defBase) * 0.005 - m._speedBonus, 0.12, 0.7);

      if (chance(pOk)) {
        m.ball.zone = action === 'long' ? 2 : clamp(zone + 1, 0, 2);
        if (zone === 2) {
          log(m, 'info', m.opp.name + ' lässt den Ball vor dem Strafraum laufen…');
        } else {
          log(m, 'info', m.opp.name + ' spielt sich nach vorn (' + ZONE_LABELS[2 - m.ball.zone] + ' aus deiner Sicht).');
        }
        // Pressing-Foulrisiko
        if (t === 'pressing' && chance(0.10)) {
          const tackler = pick(m.you.field);
          log(m, 'whistle', say('foul'));
          bookPlayer(m, tackler, 0.2);
          if (m.phase === 'end') return;
          resolveSetPiece(m, 'opp', m.ball.zone);
          if (m.phase !== 'defense') return;
        }
      } else {
        const winner = pick(m.you.field);
        log(m, 'good', say('tackleWin', { name: winner.name }));
        possessionTo(m, 'you', 2 - zone);
        return;
      }
    }
    // Ballbesitz verpufft im Mittelfeld
    log(m, 'info', 'Das Spiel verliert sich im Mittelfeld-Gewusel. Du kommst an den Ball.');
    possessionTo(m, 'you', 1);
  }

  function weighted(pairs) {
    let total = 0;
    for (const [, w] of pairs) total += w;
    let r = rnd() * total;
    for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
    return pairs[0][0];
  }

  function bookPlayer(m, p, cardChance) {
    if (hasQuirk(p, 'lehrerliebling')) cardChance *= 0.5;
    if (chance(cardChance)) {
      p.gelb++;
      if (p.gelb >= 2) {
        p.raus = true;
        p.gesperrt = 1;
        log(m, 'card', say('redcard', { name: p.name }));
        addMoral(m.run, -4);
        rebuildAfterLoss(m, 'you', p);
      } else {
        log(m, 'card', say('yellow', { name: p.name }));
      }
    }
  }

  // ---------- Matchende & Elfmeterschießen ----------
  function endMatch(m) {
    log(m, 'whistle', say('fulltime') + '  Endstand: ' + m.score.you + ':' + m.score.opp);
    if (m.score.you === m.score.opp) {
      if (m.knockout) {
        log(m, 'whistle', 'Unentschieden im K.o.-Spiel – ELFMETERSCHIESSEN! Jemand holt schnell den Kreidebeutel für den Punkt.');
        initShootout(m);
      } else {
        m.phase = 'end';
        m.result = 'draw';
        log(m, 'whistle', 'Unentschieden! Ein Punkt für jeden – auch okay.');
      }
    } else {
      m.phase = 'end';
      m.result = m.score.you > m.score.opp ? 'win' : 'loss';
    }
  }

  function initShootout(m) {
    const order = (side) => side.field.slice().sort((a, b) => b.stats.schuss - a.stats.schuss);
    m.phase = 'shootout';
    m.shootout = {
      you: 0, opp: 0, youTaken: 0, oppTaken: 0,
      turn: 'you',
      yourShooters: order(m.you), oppShooters: order(m.opp),
    };
  }

  const CORNERS = [
    { id: 'links', label: 'Links unten' },
    { id: 'mitte', label: 'Mitte (frech!)' },
    { id: 'rechts', label: 'Rechts oben' },
  ];

  function shootoutSituation(m) {
    const so = m.shootout;
    if (so.turn === 'you') {
      const shooter = so.yourShooters[so.youTaken % so.yourShooters.length];
      return {
        type: 'shootout', mode: 'shoot', shooter,
        score: { you: so.you, opp: so.opp, youTaken: so.youTaken, oppTaken: so.oppTaken },
        options: CORNERS.map(c => ({ id: c.id, label: c.label, desc: 'Wohin schießt ' + shooter.name + '?' })),
      };
    }
    const shooter = so.oppShooters[so.oppTaken % so.oppShooters.length];
    return {
      type: 'shootout', mode: 'dive', shooter,
      score: { you: so.you, opp: so.opp, youTaken: so.youTaken, oppTaken: so.oppTaken },
      options: CORNERS.map(c => ({ id: c.id, label: c.label, desc: 'Wohin hechtet ' + m.you.gk.name + '?' })),
    };
  }

  function shootoutStep(m, corner) {
    const so = m.shootout;
    if (so.turn === 'you') {
      const shooter = so.yourShooters[so.youTaken % so.yourShooters.length];
      so.youTaken++;
      const kpCorner = pick(CORNERS).id;
      let pGoal;
      if (kpCorner === corner) {
        pGoal = clamp(0.32 + (effStat(m, 'you', shooter, 'schuss') - effStat(m, 'opp', m.opp.gk, 'reflexe')) * 0.004, 0.1, 0.6);
      } else {
        pGoal = corner === 'mitte' ? 0.8 : 0.86;
      }
      if (hasQuirk(shooter, 'elfmetergott')) pGoal = clamp(pGoal + 0.15, 0, 0.95);
      if (chance(pGoal)) {
        so.you++;
        log(m, 'goal', shooter.name + ' verwandelt eiskalt ' + cornerText(corner) + '! (' + so.you + ':' + so.opp + ')');
      } else {
        log(m, 'bad', kpCorner === corner
          ? 'GEHALTEN! Der Keeper ahnt die Ecke von ' + shooter.name + '!'
          : shooter.name + ' setzt den Ball neben das Tor! Kollektives Stöhnen!');
      }
      so.turn = 'opp';
    } else {
      const shooter = so.oppShooters[so.oppTaken % so.oppShooters.length];
      so.oppTaken++;
      // Gegner zielt; leichte Vorliebe für Ecken
      const oppCorner = weighted([['links', 40], ['rechts', 40], ['mitte', 20]]);
      let saved = false;
      if (corner === oppCorner) {
        let pSave = clamp(0.55 + (effStat(m, 'you', m.you.gk, 'reflexe') - effStat(m, 'opp', shooter, 'schuss')) * 0.004, 0.3, 0.85);
        if (hasQuirk(m.you.gk, 'eisblock')) pSave = clamp(pSave + 0.10, 0.3, 0.95);
        saved = chance(pSave);
      } else {
        saved = chance(0.06); // Glücksfuß
      }
      const missAnyway = !saved && chance(0.1);
      if (saved) {
        log(m, 'good', 'GEHALTEN!! ' + m.you.gk.name + ' fliegt ' + cornerText(corner) + ' und kratzt den Ball raus!');
      } else if (missAnyway) {
        log(m, 'good', shooter.name + ' schießt am Tor vorbei! Da war der Druck wohl zu groß!');
      } else {
        so.opp++;
        log(m, 'bad', shooter.name + ' trifft ' + cornerText(oppCorner) + '. (' + so.you + ':' + so.opp + ')');
      }
      so.turn = 'you';
    }
    checkShootoutEnd(m);
  }

  function cornerText(c) {
    return { links: 'unten links', mitte: 'durch die Mitte', rechts: 'oben rechts' }[c];
  }

  function checkShootoutEnd(m) {
    const so = m.shootout;
    const base = 5;
    // Entschieden, wenn der Rückstand nicht mehr aufholbar ist
    const youLeft = Math.max(0, base - so.youTaken);
    const oppLeft = Math.max(0, base - so.oppTaken);
    let decided = false;
    if (so.youTaken <= base && so.oppTaken <= base) {
      if (so.you > so.opp + oppLeft || so.opp > so.you + youLeft) decided = true;
      if (so.youTaken === base && so.oppTaken === base && so.you !== so.opp) decided = true;
    } else if (so.youTaken === so.oppTaken && so.you !== so.opp) {
      decided = true; // Sudden Death
    }
    if (decided) {
      m.phase = 'end';
      m.result = so.you > so.opp ? 'win' : 'loss';
      log(m, 'whistle', 'ENTSCHIEDEN! Elfmeterschießen endet ' + so.you + ':' + so.opp + (m.result === 'win' ? ' – IHR GEWINNT!' : ' – das war’s leider.'));
    }
  }

  // ---------- Nach dem Spiel ----------
  // opts.cup = false → Liga-Modus: Unentschieden möglich, kein Run-Ende, keine Stage-Eskalation.
  function applyResult(run, m, opts) {
    const cup = !opts || opts.cup !== false;
    const line = m.score.you + ':' + m.score.opp + (m.shootout ? ' (' + m.shootout.you + ':' + m.shootout.opp + ' i.E.)' : '') + ' gegen ' + m.opp.name;
    const emoji = m.result === 'win' ? '✅' : m.result === 'draw' ? '🤝' : '❌';
    run.history.push(emoji + ' ' + line);
    if (m.result === 'win') {
      addMoral(run, 8 + (run.relics.includes('megafon') ? 5 : 0));
      if (cup) {
        run.stage++;
        if (run.stage >= D.STAGES.length) { run.won = true; run.over = true; }
      }
    } else if (m.result === 'draw') {
      addMoral(run, 1);
    } else {
      addMoral(run, cup ? -2 : -3);
      if (cup) run.over = true;
    }
    // Regeneration
    const regen = 30 + (run.relics.includes('brot') ? 15 : 0);
    for (const p of run.players) {
      p.fitness = clamp(p.fitness + regen, 10, 100);
      p.stunned = 0; p.gelb = 0; p.raus = false;
      if (p.gesperrt > 0) p.gesperrt--;
      if (m.buffs && m.buffs.energydrink) p.fitness = clamp(p.fitness - 15, 10, 100);
    }
    // Notnagel-Hausmeister verlassen den Kader wieder
    run.players = run.players.filter(p => !p.ghost);
    return line;
  }

  // ---------- Zwischen-Spiel-Angebote ----------
  function rollOffers(run) {
    const pool = D.OFFER_POOL.slice();
    const offers = [];
    const usedIds = new Set();
    let guard = 0;
    while (offers.length < 3 && guard++ < 50) {
      const entry = weighted(pool.map(o => [o, o.weight]));
      if (usedIds.has(entry.id)) continue;
      const offer = buildOffer(run, entry);
      if (!offer) { usedIds.add(entry.id); continue; }
      usedIds.add(entry.id);
      offers.push(offer);
    }
    while (offers.length < 3) offers.push(buildOffer(run, D.OFFER_POOL[2])); // Kuchen als Fallback
    return offers;
  }

  function buildOffer(run, entry) {
    const alive = run.players.filter(p => !p.ghost);
    switch (entry.id) {
      case 'training': {
        const p = pick(alive);
        const statKey = pick(p.pos === 'TW' ? ['reflexe', 'pass'] : ['schuss', 'pass', 'dribbling', 'zweikampf', 'tempo']);
        return {
          id: 'training', icon: entry.icon, title: entry.title,
          desc: p.name + ' bleibt nach dem Training länger: +6 ' + STAT_LABELS[statKey] + '.',
          data: { pid: p.id, statKey },
        };
      }
      case 'physio': {
        const hasInjury = alive.some(p => p.verletzt);
        return {
          id: 'physio', icon: entry.icon, title: entry.title,
          desc: (hasInjury ? 'Heilt alle Verletzungen und ' : '') + 'bringt allen +30 Fitness. Riecht nach Pferdesalbe.',
        };
      }
      case 'kuchen':
        return { id: 'kuchen', icon: entry.icon, title: entry.title, desc: 'Selbstgebackener Marmorkuchen von Kevins Oma: +12 Team-Moral.' };
      case 'neuzugang': {
        const p = genPlayer(pick(['ABW', 'MF', 'ST']), 46 + run.stage * 3);
        return {
          id: 'neuzugang', icon: entry.icon, title: entry.title,
          desc: p.name + ' (' + POS_LABELS[p.pos] + ', Stärke ' + overall(p) + (p.quirk ? ', ' + quirkOf(p).name : '') + ') ist neu an der Schule und will mitspielen. Ersetzt euren schwächsten Spieler.',
          data: { player: p },
        };
      }
      case 'energydrink':
        return {
          id: 'energydrink', icon: entry.icon, title: entry.title,
          desc: 'Marke „RASENBLITZ ULTRA“: nächstes Spiel +8 Tempo für alle – danach −15 Fitness. Zutatenliste unleserlich.',
        };
      case 'geheimtraining': {
        const p = pick(alive);
        const statKey = pick(p.pos === 'TW' ? ['reflexe'] : ['schuss', 'pass', 'dribbling', 'zweikampf', 'tempo']);
        return {
          id: 'geheimtraining', icon: entry.icon, title: entry.title,
          desc: p.name + ' trainiert heimlich am Baggersee: +12 ' + STAT_LABELS[statKey] + ' – aber 25% Risiko, sich dabei zu verletzen.',
          data: { pid: p.id, statKey },
        };
      }
      case 'relic': {
        const free = D.RELICS.filter(r => !run.relics.includes(r.id));
        if (!free.length) return null;
        const r = pick(free);
        return { id: 'relic', icon: entry.icon, title: r.name, desc: r.desc + ' (Dauerhafter Gegenstand)', data: { relicId: r.id } };
      }
      case 'taktikvideo':
        return { id: 'taktikvideo', icon: entry.icon, title: entry.title, desc: 'VHS-Kassette „Abwehrschlachten 1994“: alle Spieler +3 Zweikampf.' };
      default:
        return null;
    }
  }

  function applyOffer(run, offer) {
    const lines = [];
    const byId = (pid) => run.players.find(p => p.id === pid);
    switch (offer.id) {
      case 'training': {
        const p = byId(offer.data.pid);
        if (p) { p.stats[offer.data.statKey] = clamp(p.stats[offer.data.statKey] + 6, 5, 99); lines.push(p.name + ' hat was gelernt!'); }
        break;
      }
      case 'physio':
        for (const p of run.players) { p.verletzt = false; p.fitness = clamp(p.fitness + 30, 10, 100); }
        lines.push('Alle wieder fit(-ish). Die Pferdesalbe wirkt.');
        break;
      case 'kuchen':
        addMoral(run, 12);
        lines.push('Der Kuchen war hervorragend. Moral +12!');
        break;
      case 'neuzugang': {
        const np = offer.data.player;
        const sorted = run.players.slice().sort((a, b) => overall(a) - overall(b));
        // Torwart nur ersetzen, wenn der Neue auch einer ist
        const weakest = sorted.find(p => np.pos === 'TW' ? p.pos === 'TW' : p.pos !== 'TW') || sorted[0];
        run.players = run.players.filter(p => p !== weakest);
        run.players.push(np);
        lines.push(np.name + ' ist dabei! ' + weakest.name + ' „konzentriert sich jetzt auf die Schule“.');
        break;
      }
      case 'energydrink':
        run.buffs.energydrink = true;
        lines.push('Die Dosen zischen bedrohlich. Nächstes Spiel wird schnell.');
        break;
      case 'geheimtraining': {
        const p = byId(offer.data.pid);
        if (p) {
          p.stats[offer.data.statKey] = clamp(p.stats[offer.data.statKey] + 12, 5, 99);
          if (chance(0.25)) { p.verletzt = true; lines.push(p.name + ' ist stark wie nie – aber beim Sprung vom Steg umgeknickt. Verletzt!'); }
          else lines.push(p.name + ' kommt braungebrannt und deutlich besser zurück.');
        }
        break;
      }
      case 'relic':
        run.relics.push(offer.data.relicId);
        lines.push('Neuer Gegenstand: ' + offer.title + '!');
        break;
      case 'taktikvideo':
        for (const p of run.players) p.stats.zweikampf = clamp(p.stats.zweikampf + 3, 5, 99);
        lines.push('Alle sind eingeschlafen, aber irgendwas ist hängen geblieben: +3 Zweikampf für alle.');
        break;
    }
    return lines;
  }

  // ---------- Auto-Play (Balance-Sim & Auto-Knopf) ----------
  function autoChoice(m) {
    const sit = situation(m);
    if (sit.type === 'end') return null;
    if (sit.type === 'shootout') return pick(CORNERS).id;
    if (sit.type === 'defense') return weighted([['stellung', 45], ['pressing', 25], ['beton', 18], ['graetsche', 12]]);
    // attack: simple Heuristik – beste Chance grob nutzen
    const zone = sit.zone;
    if (zone === 2) {
      const shot = sit.options.find(o => o.id === 'shot');
      const power = sit.options.find(o => o.id === 'power');
      if (m.querpass || m.freiraum || (shot && shot.prob > 0.3)) return chance(0.25) ? 'power' : 'shot';
      return weighted([['pass', 35], ['dribble', 25], ['shot', 25], ['power', 15]]);
    }
    if (zone === 1) return weighted([['pass', 45], ['dribble', 25], ['long', 12], ['shot', 8], ['power', 10]]);
    return weighted([['pass', 55], ['dribble', 28], ['long', 17]]);
  }

  function autoPlayMatch(run, oppTeam, maxSteps) {
    const m = createMatch(run, oppTeam);
    let guard = 0;
    while (m.phase !== 'end' && guard++ < (maxSteps || 600)) {
      step(m, autoChoice(m));
    }
    if (m.phase !== 'end') { m.phase = 'end'; m.result = m.score.you > m.score.opp ? 'win' : 'loss'; }
    return m;
  }

  return {
    STAT_KEYS, STAT_LABELS, POS_LABELS, ZONE_LABELS, DRAFT_SLOTS,
    genPlayer, genOpponent, genClubTeam, genTeamName, overall, quirkOf,
    newRun, draftCandidates, addMoral,
    createMatch, situation, step, applyResult,
    rollOffers, applyOffer,
    autoChoice, autoPlayMatch,
    roundRobinSchedule, simulateAIMatch, newLeagueTable, recordResult, sortedTable,
    _internals: { effStat, defRating, probShot, probPowerGoal },
  };
});
