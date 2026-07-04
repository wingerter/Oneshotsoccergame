/* Bolzplatz-Legenden – UI-Controller (Screens, Match-Ablauf, Save) */
(function () {
  'use strict';
  const E = window.SoccerEngine;
  const D = window.SoccerData;
  const S = window.SoccerSound;
  const Art = window.SoccerArt;
  const app = document.getElementById('app');
  const SAVE_KEY = 'bolzplatz-legenden-save';
  const SAVE_KEY_LEAGUE = 'bolzplatz-legenden-league-save';

  let mode = 'cup';        // 'cup' | 'league'
  let run = null;
  let match = null;
  let draftIndex = 0;
  let offerToast = [];
  let league = null;       // { run, clubs, table, schedule, roundIndex, aiSimmedUpTo }
  let currentOppId = null; // Liga: Vereins-ID des laufenden Matches

  // ---------- DOM-Helfer ----------
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function clear() { app.innerHTML = ''; }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function sfxClick() { if (S) S.click(); }

  function moralEmoji(mo) {
    if (mo < 35) return '😱';
    if (mo < 50) return '😟';
    if (mo < 65) return '🙂';
    if (mo < 80) return '😄';
    return '🔥';
  }

  function statBars(p) {
    const keys = p.pos === 'TW'
      ? ['reflexe', 'zweikampf', 'pass', 'tempo']
      : ['schuss', 'pass', 'dribbling', 'zweikampf', 'tempo'];
    return keys.map(k => `
      <div class="statrow">
        <span class="lbl">${E.STAT_LABELS[k]}</span>
        <span class="barwrap"><span class="bar" style="width:${Math.min(100, p.stats[k])}%"></span></span>
        <span class="val">${p.stats[k]}</span>
      </div>`).join('');
  }

  function playerCard(p, onPick) {
    const q = E.quirkOf(p);
    const card = el('div', 'card');
    card.innerHTML = `
      <div class="card-top">
        <span class="portrait-frame"><img class="pixel-art pp-lg" alt="" src="${Art.portraitURL(p)}"></span>
        <div class="card-id">
          <h3>${esc(p.name)}</h3>
          <div class="pos">${E.POS_LABELS[p.pos]} · Gesamt ${E.overall(p)}</div>
        </div>
      </div>
      ${statBars(p)}
      ${q ? `<div class="quirk"><b>${esc(q.name)}:</b> ${esc(q.desc)}</div>` : '<div class="quirk" style="opacity:.5">Keine Marotte. Verdächtig normal.</div>'}
    `;
    if (onPick) card.addEventListener('click', () => { sfxClick(); onPick(p); });
    return card;
  }

  // ---------- Save / Load (Pokal-Run) ----------
  function saveRun() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(run)); } catch (e) { /* egal */ }
  }
  function loadRun() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* egal */ }
  }

  // ---------- Save / Load (Liga-Saison) ----------
  function saveLeague() {
    try { localStorage.setItem(SAVE_KEY_LEAGUE, JSON.stringify(league)); } catch (e) { /* egal */ }
  }
  function loadLeague() {
    try {
      const raw = localStorage.getItem(SAVE_KEY_LEAGUE);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function clearLeagueSave() {
    try { localStorage.removeItem(SAVE_KEY_LEAGUE); } catch (e) { /* egal */ }
  }

  // ---------- Titel ----------
  function showTitle() {
    clear();
    const savedCup = loadRun();
    const savedLeague = loadLeague();
    const s = el('div', 'title-screen');
    const ball = `<img class="pixel-art" alt="" src="${Art.ballURL()}">`;
    // Zwei zufällige Legenden flankieren die Regeln
    const heroes = [
      { url: Art.heroURL(), name: 'Der Zeigefinger der Kreisklasse' },
      { url: Art.heroFredURL(), name: 'Feuerball Fred' },
      { url: Art.heroPadreURL(), name: 'Padre Peng' },
    ].sort(() => Math.random() - 0.5).slice(0, 2);
    s.innerHTML = `
      <h1>${ball} BOLZPLATZ-LEGENDEN ${ball}</h1>
      <div class="sub">Ein Fußball-Roguelike aus den Tiefen der Kreisklasse</div>
      <div class="title-hero-row">
        <img class="pixel-art hero-sprite h2 hero-bob" alt="" src="${heroes[0].url}" title="${heroes[0].name}">
        <div class="rules">
          <li>🎲 <b>Drafte</b> ein Team aus fragwürdigen Talenten mit noch fragwürdigeren Marotten.</li>
          <li>🎯 <b>Faires Glück:</b> Jede Aktion zeigt ihre Erfolgschance. Du entscheidest, wie viel Risiko du gehst.</li>
          <li>⚡ <b>Tempo-Bonus:</b> Schnelle Entscheidungen bekommen einen Extra-Prozentpunkte-Bonus, der mit der Zeit verfällt – nie schlechter als die normale Chance, aber schneller ist besser.</li>
          <li>💥 <b>Powerschüsse</b> sind ungenau – aber verzogene Bälle schießen schon mal einen Gegner um.</li>
          <li>🍰 Zwischen den Spielen: Training, Kuchenverkauf und dubiose Energydrinks.</li>
        </div>
        <img class="pixel-art hero-sprite h1 hero-bob" alt="" src="${heroes[1].url}" title="${heroes[1].name}">
      </div>
    `;

    const modeRow = el('div', 'mode-row');

    const cupBox = el('div', 'mode-box');
    cupBox.innerHTML = `<h3>🏆 Pokal-Run</h3><p>7 K.o.-Spiele, eine Niederlage beendet alles. Kurz, hart, spannend.</p>`;
    const cupBtn = el('button', 'btn-big', '🥾 Neuer Pokal-Run');
    cupBtn.addEventListener('click', () => { sfxClick(); startNewRun(); });
    cupBox.appendChild(cupBtn);
    if (savedCup && !savedCup.over) {
      const c2 = el('button', 'btn-ghost', '▶ Weiterspielen (Spiel ' + (savedCup.stage + 1) + '/7)');
      c2.addEventListener('click', () => { sfxClick(); mode = 'cup'; run = savedCup; offerToast = []; showPreMatch(); });
      cupBox.appendChild(c2);
    }
    modeRow.appendChild(cupBox);

    const leagueBox = el('div', 'mode-box');
    leagueBox.innerHTML = `<h3>📋 Liga-Saison</h3><p>5 Spieltage gegen 5 feste Vereine, echte Tabelle, Unentschieden erlaubt. Entspannter, mit Tabellenkampf bis zum Schluss.</p>`;
    const leagueBtn = el('button', 'btn-big', '📋 Neue Liga-Saison');
    leagueBtn.addEventListener('click', () => { sfxClick(); startNewLeague(); });
    leagueBox.appendChild(leagueBtn);
    if (savedLeague) {
      const l2 = el('button', 'btn-ghost', '▶ Liga fortsetzen (Spieltag ' + (savedLeague.roundIndex + 1) + '/' + savedLeague.schedule.length + ')');
      l2.addEventListener('click', () => {
        sfxClick();
        league = savedLeague; run = league.run; mode = 'league'; offerToast = [];
        enterLeagueRound();
      });
      leagueBox.appendChild(l2);
    }
    modeRow.appendChild(leagueBox);

    s.appendChild(modeRow);

    if (window.SoccerIntro) {
      const introBtn = el('button', 'btn-ghost', '🎬 Intro nochmal ansehen');
      introBtn.style.marginTop = '20px';
      introBtn.addEventListener('click', () => { sfxClick(); window.SoccerIntro.play(showTitle); });
      s.appendChild(introBtn);
    }

    app.appendChild(s);
  }

  // ---------- Draft (gemeinsam für Pokal & Liga) ----------
  function startNewRun() {
    mode = 'cup';
    run = E.newRun();
    draftIndex = 0;
    offerToast = [];
    showDraft();
  }

  function startNewLeague() {
    mode = 'league';
    run = E.newRun();
    const clubs = D.LEAGUE_CLUBS.map((c, i) => ({ id: i + 1, name: c.name, desc: c.desc, tier: c.tier }));
    const tableEntries = [{ id: 0, name: run.teamName }].concat(clubs.map(c => ({ id: c.id, name: c.name })));
    league = {
      run,
      clubs,
      table: E.newLeagueTable(tableEntries),
      schedule: E.roundRobinSchedule(1 + clubs.length),
      roundIndex: 0,
      aiSimmedUpTo: 0,
    };
    draftIndex = 0;
    offerToast = [];
    showDraft();
  }

  function showDraft() {
    clear();
    const slot = E.DRAFT_SLOTS[draftIndex];
    const head = el('div', 'screen-head');
    head.innerHTML = `
      <div class="crumb">DRAFT – Pick ${draftIndex + 1} von ${E.DRAFT_SLOTS.length} · Dein Team: <b>${esc(run.teamName)}</b></div>
      <h2>Wähle deinen ${esc(slot.label)}</h2>
    `;
    app.appendChild(head);
    const cands = E.draftCandidates(draftIndex);
    const cards = el('div', 'cards');
    for (const c of cands) {
      cards.appendChild(playerCard(c, (p) => {
        run.players.push(p);
        draftIndex++;
        if (draftIndex >= E.DRAFT_SLOTS.length) {
          if (mode === 'league') enterLeagueRound(); else showPreMatch();
        } else {
          showDraft();
        }
      }));
    }
    app.appendChild(cards);
  }

  // ---------- Vor dem Spiel (Pokal) ----------
  function showPreMatch() {
    clear();
    saveRun();
    const stage = D.STAGES[run.stage];
    const stars = '★'.repeat(Math.max(1, Math.round((stage.tier - 30) / 8))).padEnd(5, '☆');

    const head = el('div', 'screen-head');
    head.innerHTML = `<div class="crumb">SPIEL ${run.stage + 1} VON 7</div><h2>Der nächste Gegner wartet…</h2>`;
    app.appendChild(head);

    if (offerToast.length) {
      const t = el('div', 'toast-lines', offerToast.map(esc).join('<br>'));
      t.style.textAlign = 'center';
      app.appendChild(t);
      offerToast = [];
    }

    app.appendChild(statusPills());

    const vs = el('div', 'vs-box');
    const yourCard = el('div', 'card');
    yourCard.innerHTML = `<div class="card-top"><img class="pixel-art crest-md" alt="" src="${Art.crestURL(run.teamName)}"><div class="card-id"><h3>${esc(run.teamName)}</h3><div class="pos">Dein Haufen</div></div></div>` + squadOverviewRows();
    const oppCard = el('div', 'card');
    oppCard.innerHTML = `<div class="card-top"><img class="pixel-art crest-md" alt="" src="${Art.crestURL(stage.name)}"><div class="card-id"><h3>${esc(stage.name)}</h3><div class="pos">Gefahr: <span class="stars">${stars}</span></div></div></div><div class="desc">${esc(stage.desc)}</div>`;
    vs.appendChild(yourCard);
    vs.appendChild(el('div', 'vs', 'VS'));
    vs.appendChild(oppCard);
    app.appendChild(vs);

    const center = el('div', 'center-box');
    center.style.marginTop = '10px';
    const btn = el('button', 'btn-big', '🔥 ANPFIFF!');
    btn.addEventListener('click', () => { sfxClick(); startMatch(); });
    center.appendChild(btn);
    app.appendChild(center);

    addFooter('Run aufgeben', () => {
      clearSave();
      run = null;
      showTitle();
    });
  }

  function statusPills() {
    const pills = el('div', 'pill-row');
    pills.innerHTML = `<span class="pill">Moral: <b>${run.moral} ${moralEmoji(run.moral)}</b></span>` +
      run.relics.map(id => {
        const r = D.RELICS.find(x => x.id === id);
        return `<span class="pill" title="${esc(r.desc)}">🎁 ${esc(r.name)}</span>`;
      }).join('') +
      (run.buffs.energydrink ? '<span class="pill">⚡ Energydrink aktiv!</span>' : '');
    return pills;
  }

  function squadOverviewRows() {
    return run.players.map(p => {
      const status = p.verletzt ? ' 🤕' : (p.gesperrt > 0 ? ' 🔒' : '');
      return `<div class="statrow"><span class="lbl">${p.pos}</span><span style="flex:1">${esc(p.name)}${status}</span><span class="val">${E.overall(p)}</span></div>`;
    }).join('');
  }

  // ---------- Match (gemeinsam für Pokal & Liga) ----------
  let logEl, sitEl, scoreEl, squadEl, pitchEl, pendingEvents, revealTimer;
  let decisionStart = null, decisionTimerHandle = null;
  const SPEED_MAX_BONUS = 0.12;
  const SPEED_DECAY_MS = 5000;

  function beginMatchUI(m) {
    match = m;
    clear();

    scoreEl = el('div', 'scoreboard');
    app.appendChild(scoreEl);

    const pw = el('div', 'pitch-wrap');
    pitchEl = Art.makePitchCanvas();
    pw.appendChild(pitchEl);
    app.appendChild(pw);

    const grid = el('div', 'match-grid');
    logEl = el('div', 'log');
    logEl.title = 'Klicken zum Vorspulen';
    logEl.addEventListener('click', flushEvents);
    squadEl = el('div', 'squad');
    grid.appendChild(logEl);
    grid.appendChild(squadEl);
    app.appendChild(grid);

    sitEl = el('div', 'situation');
    app.appendChild(sitEl);

    pendingEvents = [];
    playEvents(match.events, refreshAll);
    refreshScore();
    refreshSquad();
  }

  function startMatch() {
    const opp = E.genOpponent(run.stage);
    beginMatchUI(E.createMatch(run, opp));
  }

  function startLeagueMatch(oppId) {
    const club = league.clubs.find(c => c.id === oppId);
    currentOppId = oppId;
    beginMatchUI(E.createMatch(run, E.genClubTeam(club), { knockout: false }));
  }

  function refreshAll() {
    refreshScore();
    refreshSquad();
    renderSituation();
  }

  function refreshScore() {
    const so = match.shootout;
    scoreEl.innerHTML = `
      <span class="teamname"><img class="pixel-art crest-sm" alt="" src="${Art.crestURL(run.teamName)}"><span>${esc(run.teamName)}</span></span>
      <span class="minute">${Math.min(90, Math.floor(match.minute))}'</span>
      <span class="score">${match.score.you}:${match.score.opp}${so ? ` <small style="font-size:0.9rem">(${so.you}:${so.opp} i.E.)</small>` : ''}</span>
      <span class="minute">${moralEmoji(run.moral)}</span>
      <span class="teamname right"><img class="pixel-art crest-sm" alt="" src="${Art.crestURL(match.opp.name)}"><span>${esc(match.opp.name)}</span></span>
    `;
    if (pitchEl) Art.drawPitch(pitchEl, match);
  }

  function squadLine(p, isCarrier) {
    let icons = '';
    if (p.verletzt) icons += '🤕';
    if (p.raus && !p.verletzt) icons += '🟥';
    if (p.stunned > 0) icons += '😵';
    if (p.gelb === 1) icons += '🟨';
    const fitClass = p.fitness < 40 ? 'low' : '';
    return `<div class="p">
      <span class="carrier-dot">${isCarrier ? '⚽' : ''}</span>
      <img class="pixel-art" alt="" src="${Art.portraitURL(p)}">
      <span class="nm" title="${esc(p.name)}">${esc(p.name)} <small>(${p.pos})</small></span>
      ${icons}
      <span class="fit"><i class="${fitClass}" style="width:${p.fitness}%"></i></span>
    </div>`;
  }

  function refreshSquad() {
    const c = match.ball.carrier;
    const lineup = [match.you.gk, ...match.you.field].filter(Boolean);
    const bench = run.players.filter(p => !lineup.includes(p));
    squadEl.innerHTML = '<h3>AUF DEM PLATZ</h3>' +
      lineup.map(p => squadLine(p, p === c)).join('') +
      (bench.length ? '<h3 style="margin-top:8px">BANK</h3>' + bench.map(p => squadLine(p, false)).join('') : '') +
      `<div class="moralbox">Team-Moral: <b>${run.moral}</b> ${moralEmoji(run.moral)}</div>`;
  }

  // Events nacheinander einblenden
  function playEvents(events, done) {
    pendingEvents = events.slice();
    const step = () => {
      if (!pendingEvents.length) { revealTimer = null; done(); return; }
      appendLog(pendingEvents.shift());
      refreshScore();
      revealTimer = setTimeout(step, 520);
    };
    if (revealTimer) clearTimeout(revealTimer);
    step();
  }

  function flushEvents() {
    if (!pendingEvents || !pendingEvents.length) return;
    if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
    while (pendingEvents.length) appendLog(pendingEvents.shift());
    refreshAll();
  }

  function soundForEvent(ev) {
    if (!S) return;
    if (ev.kind === 'goal') S.goalFanfare();
    else if (ev.kind === 'whistle') S.whistlePeep();
    else if (ev.kind === 'card') S.cardBeep();
    else if (ev.kind === 'injury') S.injurySad();
    else if (ev.kind === 'funny') S.powerWhoosh();
  }

  function appendLog(ev) {
    const minute = Math.min(90, Math.floor(match.minute));
    const e = el('div', 'entry ' + ev.kind, `<small style="opacity:.55">${minute}'</small> ${esc(ev.text)}`);
    logEl.appendChild(e);
    logEl.scrollTop = logEl.scrollHeight;
    soundForEvent(ev);
  }

  function probClass(p) {
    const pct = Math.round(p * 100);
    return pct >= 60 ? 'hi' : pct >= 35 ? 'mid' : 'lo';
  }
  function probBadge(p) {
    return `<span class="prob ${probClass(p)}">${Math.round(p * 100)}%</span>`;
  }

  // ---------- Tempo-Bonus: schnelle Entscheidungen bekommen einen Bonus, der verfällt ----------
  function currentSpeedBonus() {
    if (decisionStart == null) return 0;
    const elapsed = Date.now() - decisionStart;
    const frac = Math.max(0, 1 - elapsed / SPEED_DECAY_MS);
    return SPEED_MAX_BONUS * frac;
  }

  function clearDecisionTimer() {
    if (decisionTimerHandle) { clearInterval(decisionTimerHandle); decisionTimerHandle = null; }
    decisionStart = null;
  }

  function startDecisionTimer() {
    clearDecisionTimer();
    decisionStart = Date.now();
    updateSpeedBadges();
    decisionTimerHandle = setInterval(updateSpeedBadges, 100);
  }

  function updateSpeedBadges() {
    const bonus = currentSpeedBonus();
    sitEl.querySelectorAll('.action-btn').forEach(btn => {
      const base = btn.dataset.baseProb;
      if (base === undefined || base === '') return;
      const disp = Math.min(0.97, parseFloat(base) + bonus);
      const badge = btn.querySelector('.prob');
      if (badge) { badge.textContent = Math.round(disp * 100) + '%'; badge.className = 'prob ' + probClass(disp); }
    });
    const fill = sitEl.querySelector('.speed-bar-fill');
    if (fill) fill.style.width = Math.round((bonus / SPEED_MAX_BONUS) * 100) + '%';
    if (bonus <= 0.0001 && decisionTimerHandle) { clearInterval(decisionTimerHandle); decisionTimerHandle = null; }
  }

  function renderSituation() {
    clearDecisionTimer();
    const sit = E.situation(match);
    if (sit.type === 'end') { renderMatchEnd(); return; }

    let head = '';
    if (sit.type === 'attack') {
      head = `⚽ Ballbesitz: <b>${esc(sit.carrier.name)}</b> · ${esc(sit.zoneLabel)}`;
      if (sit.freiraum) head += '<span class="tag">Freiraum!</span>';
      if (sit.querpass) head += '<span class="tag">Gut freigespielt!</span>';
    } else if (sit.type === 'defense') {
      head = `🛡️ <b>${esc(match.opp.name)}</b> hat den Ball. Wie verteidigt ihr?`;
    } else if (sit.type === 'shootout') {
      head = sit.mode === 'shoot'
        ? `🥅 ELFMETERSCHIESSEN – <b>${esc(sit.shooter.name)}</b> legt sich den Ball hin. Wohin?`
        : `🧤 ELFMETERSCHIESSEN – <b>${esc(sit.shooter.name)}</b> läuft an. Wohin hechtet dein Keeper?`;
    }

    sitEl.innerHTML = `<div class="sit-text">${head}</div>`;

    const isAttack = sit.type === 'attack';
    if (isAttack) {
      sitEl.appendChild(el('div', 'speed-bar', '<div class="speed-bar-fill"></div>'));
      sitEl.appendChild(el('div', 'speed-caption', '⚡ Tempo-Bonus: schnell entscheiden lohnt sich'));
    }

    const actions = el('div', 'actions');
    for (const o of sit.options) {
      const btn = el('button', 'action-btn');
      if (isAttack && o.prob !== undefined) btn.dataset.baseProb = String(o.prob);
      btn.innerHTML = `<span class="toprow"><span>${esc(o.label)}</span>${o.prob !== undefined ? probBadge(o.prob) : ''}</span>` +
        (o.desc ? `<span class="adesc">${esc(o.desc)}</span>` : '');
      btn.addEventListener('click', () => onChoice(o.id));
      actions.appendChild(btn);
    }
    sitEl.appendChild(actions);

    if (isAttack) startDecisionTimer();
  }

  function onChoice(id) {
    const bonus = currentSpeedBonus();
    clearDecisionTimer();
    sfxClick();
    sitEl.querySelectorAll('button').forEach(b => b.disabled = true);
    const events = E.step(match, id, { speedBonus: bonus });
    playEvents(events, refreshAll);
  }

  function resultLabel(result) {
    if (result === 'win') return '🎉 <b>SIEG!</b> ';
    if (result === 'draw') return '🤝 <b>UNENTSCHIEDEN.</b> ';
    return '💀 <b>NIEDERLAGE.</b> ';
  }

  function renderMatchEnd() {
    let line;
    if (mode === 'league') {
      line = E.applyResult(run, match, { cup: false });
      E.recordResult(league.table, 0, currentOppId, match.score.you, match.score.opp);
      saveLeague();
    } else {
      line = E.applyResult(run, match);
      if (run.over) clearSave(); else saveRun();
    }
    refreshScore();
    refreshSquad();
    sitEl.innerHTML = `<div class="sit-text" style="font-size:1.2rem">${resultLabel(match.result)}${esc(line)}</div>`;
    const label = mode === 'league' ? 'Weiter' : (run.over ? (run.won ? '🏆 ZUM POKAL' : 'Zum Abpfiff des Runs') : 'Weiter');
    const btn = el('button', 'btn-big', label);
    btn.addEventListener('click', () => {
      sfxClick();
      match = null;
      if (mode === 'league') {
        league.roundIndex++;
        if (league.roundIndex >= league.schedule.length) { clearLeagueSave(); showLeagueEnd(); }
        else { showLeagueOffers(); }
      } else if (run.over) {
        showRunEnd();
      } else {
        showOffers();
      }
    });
    sitEl.appendChild(btn);
  }

  // ---------- Events zwischen Spielen (gemeinsam) ----------
  function renderOfferScreen(headerHtml, onApplied) {
    clear();
    app.appendChild(el('div', 'screen-head', headerHtml));
    const offers = E.rollOffers(run);
    const cards = el('div', 'cards');
    for (const o of offers) {
      const card = el('div', 'card');
      card.innerHTML = `<span class="icon">${o.icon || '🎁'}</span><h3>${esc(o.title)}</h3><div class="desc">${esc(o.desc)}</div>`;
      card.addEventListener('click', () => {
        sfxClick();
        offerToast = E.applyOffer(run, o);
        onApplied();
      });
      cards.appendChild(card);
    }
    app.appendChild(cards);
  }

  function showOffers() {
    renderOfferScreen(
      `<div class="crumb">NACH DEM SPIEL</div><h2>🎉 Sieg! Was macht ihr mit dem Schwung?</h2><div class="crumb">Wähle genau eine Sache:</div>`,
      () => showPreMatch()
    );
  }

  function showLeagueOffers() {
    renderOfferScreen(
      `<div class="crumb">SPIELTAG ${league.roundIndex} ABGESCHLOSSEN</div><h2>Was macht ihr mit dem Schwung?</h2><div class="crumb">Wähle genau eine Sache:</div>`,
      () => { saveLeague(); enterLeagueRound(); }
    );
  }

  // ---------- Run-Ende (Pokal) ----------
  function showRunEnd() {
    clear();
    clearSave();
    const box = el('div', 'center-box');
    if (run.won) {
      box.innerHTML = `
        <div class="huge">🎉 POKALSIEGER!! 🎉</div>
        <img class="pixel-art trophy" alt="Pokal" src="${Art.trophyURL()}">
        <p>${esc(run.teamName)} hat tatsächlich ALLE geschlagen.<br>
        Der Plastikpokal wird noch heute mit Limo gefüllt. Ihr seid <b>Bolzplatz-Legenden</b>.</p>`;
    } else {
      box.innerHTML = `
        <div class="huge">💀 RUN VORBEI</div>
        <p>${esc(run.teamName)} scheitert nach <b>${run.stage}</b> Sieg${run.stage === 1 ? '' : 'en'}.<br>
        In der Kabine gibt es Schweigen und lauwarme Limo. Nächstes Mal klappt's.</p>`;
    }
    const hist = el('ul', 'history');
    hist.innerHTML = '<b>Euer Weg:</b><br>' + (run.history.map(h => `<li>${esc(h)}</li>`).join('') || '<li>Kein einziges Spiel. Autsch.</li>') +
      `<li style="margin-top:8px">Tore gesamt: ${run.goalsFor}:${run.goalsAgainst}</li>`;
    box.appendChild(hist);
    const btn = el('button', 'btn-big', '🔁 Neuer Run');
    btn.addEventListener('click', () => { sfxClick(); startNewRun(); });
    box.appendChild(btn);
    const tBtn = el('button', 'btn-ghost', 'Zum Titelbildschirm');
    tBtn.style.marginLeft = '10px';
    tBtn.addEventListener('click', () => { sfxClick(); showTitle(); });
    box.appendChild(tBtn);
    app.appendChild(box);
  }

  // ---------- Liga-Saison ----------
  function buildTableElement(sorted, highlightId) {
    const wrap = el('div', 'table-wrap');
    wrap.innerHTML = `<table class="league-table">
      <thead><tr><th>#</th><th>Team</th><th>Sp</th><th>S</th><th>U</th><th>N</th><th>Tore</th><th>Diff</th><th>Pkt</th></tr></thead>
      <tbody>${sorted.map((r, i) => `
        <tr class="${r.id === highlightId ? 'me' : ''}">
          <td>${i + 1}</td><td>${esc(r.name)}</td><td>${r.sp}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td>
          <td>${r.gf}:${r.ga}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td><td><b>${r.pts}</b></td>
        </tr>`).join('')}</tbody>
    </table>`;
    return wrap;
  }

  function enterLeagueRound() {
    if (league.roundIndex >= league.schedule.length) { showLeagueEnd(); return; }
    if (league.aiSimmedUpTo <= league.roundIndex) {
      const round = league.schedule[league.roundIndex];
      for (const [a, b] of round) {
        if (a === 0 || b === 0) continue; // dein Spiel wird live gespielt
        const teamA = league.clubs.find(c => c.id === a);
        const teamB = league.clubs.find(c => c.id === b);
        const [golsA, golsB] = E.simulateAIMatch(teamA.tier, teamB.tier);
        E.recordResult(league.table, a, b, golsA, golsB);
      }
      league.aiSimmedUpTo = league.roundIndex + 1;
    }
    showLeagueHub();
  }

  function showLeagueHub() {
    clear();
    saveLeague();
    const round = league.schedule[league.roundIndex];
    const yourPair = round.find(p => p[0] === 0 || p[1] === 0);
    const oppId = yourPair[0] === 0 ? yourPair[1] : yourPair[0];
    const club = league.clubs.find(c => c.id === oppId);

    const head = el('div', 'screen-head');
    head.innerHTML = `<div class="crumb">LIGA-SAISON – SPIELTAG ${league.roundIndex + 1} VON ${league.schedule.length}</div><h2>Tabelle</h2>`;
    app.appendChild(head);

    if (offerToast.length) {
      const t = el('div', 'toast-lines', offerToast.map(esc).join('<br>'));
      t.style.textAlign = 'center';
      app.appendChild(t);
      offerToast = [];
    }

    app.appendChild(statusPills());
    app.appendChild(buildTableElement(E.sortedTable(league.table), 0));

    const vs = el('div', 'vs-box');
    const yourCard = el('div', 'card');
    yourCard.innerHTML = `<div class="card-top"><img class="pixel-art crest-md" alt="" src="${Art.crestURL(run.teamName)}"><div class="card-id"><h3>${esc(run.teamName)}</h3><div class="pos">Dein Haufen</div></div></div>` + squadOverviewRows();
    const oppCard = el('div', 'card');
    oppCard.innerHTML = `<div class="card-top"><img class="pixel-art crest-md" alt="" src="${Art.crestURL(club.name)}"><div class="card-id"><h3>${esc(club.name)}</h3><div class="pos">Stärke ${club.tier}</div></div></div><div class="desc">${esc(club.desc)}</div>`;
    vs.appendChild(yourCard);
    vs.appendChild(el('div', 'vs', 'VS'));
    vs.appendChild(oppCard);
    app.appendChild(vs);

    const center = el('div', 'center-box');
    center.style.marginTop = '10px';
    const btn = el('button', 'btn-big', '🔥 ANPFIFF!');
    btn.addEventListener('click', () => { sfxClick(); startLeagueMatch(oppId); });
    center.appendChild(btn);
    app.appendChild(center);

    addFooter('Saison verlassen', () => {
      clearLeagueSave();
      league = null;
      showTitle();
    }, 'Liga-Saison – wird automatisch gespeichert.');
  }

  function showLeagueEnd() {
    clear();
    clearLeagueSave();
    const sorted = E.sortedTable(league.table);
    const rank = sorted.findIndex(r => r.id === 0) + 1;
    const box = el('div', 'center-box');
    let headline, sub;
    if (rank === 1) { headline = '🏆 MEISTER!!'; sub = 'Ihr habt die Liga gewonnen! Der Pokal wird noch heute mit Limo gefüllt.'; }
    else if (rank <= 3) { headline = '🥈 Starke Saison!'; sub = 'Nicht ganz oben, aber richtig respektabel.'; }
    else if (rank <= 4) { headline = '📋 Mittelmaß.'; sub = 'Solide, aber ausbaufähig.'; }
    else { headline = '📉 Abstiegskampf.'; sub = 'Nächste Saison wird härter trainiert.'; }
    box.innerHTML = `<div class="huge">${headline}</div><p>${esc(run.teamName)} beendet die Saison auf Rang ${rank} von ${sorted.length}.<br>${esc(sub)}</p>`;
    box.appendChild(buildTableElement(sorted, 0));
    const btn = el('button', 'btn-big', '🔁 Neue Saison');
    btn.addEventListener('click', () => { sfxClick(); startNewLeague(); });
    box.appendChild(btn);
    const tBtn = el('button', 'btn-ghost', 'Zum Titelbildschirm');
    tBtn.style.marginLeft = '10px';
    tBtn.addEventListener('click', () => { sfxClick(); league = null; showTitle(); });
    box.appendChild(tBtn);
    app.appendChild(box);
  }

  // ---------- Footer / Mute ----------
  function addFooter(btnLabel, onLeave, text) {
    const f = el('footer', 'gamefoot');
    f.innerHTML = (text || 'Bolzplatz-Legenden – gespeichert wird automatisch vor jedem Spiel.') +
      ` <span class="ver">v${esc(D.VERSION)} · ${esc(D.BUILD)}</span>`;
    const btn = el('button', 'btn-ghost', btnLabel);
    btn.addEventListener('click', () => {
      sfxClick();
      if (confirm('Wirklich aufgeben? Der Spielstand wird gelöscht.')) onLeave();
    });
    f.appendChild(btn);
    app.appendChild(f);
  }

  function initMuteToggle() {
    if (!S) return;
    const b = document.createElement('button');
    b.className = 'btn-ghost mute-toggle';
    const render = () => { b.textContent = S.isMuted() ? '🔈 Stumm' : '🔊 Ton'; };
    render();
    b.addEventListener('click', () => { S.setMuted(!S.isMuted()); render(); });
    document.body.appendChild(b);
  }

  // Immer sichtbares Versions-Badge (zur Deploy-Kontrolle)
  function initVersionBadge() {
    const v = el('div', 'version-badge');
    v.textContent = `v${D.VERSION} · Build ${D.BUILD}`;
    v.title = 'Version und Build-Zeitpunkt – zeigt, welcher Stand deployt ist.';
    document.body.appendChild(v);
  }

  // Gemalter Abendhimmel hinter allem
  function initBackdrop() {
    if (!Art) return;
    const c = Art.backdropCanvas();
    c.className = 'backdrop';
    document.body.insertBefore(c, document.body.firstChild);
  }

  // Los geht's – erst das Intro (überspringbar), dann der Titel
  initBackdrop();
  initMuteToggle();
  initVersionBadge();
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (window.SoccerIntro && !reduceMotion) {
    window.SoccerIntro.play(showTitle);
  } else {
    showTitle();
  }
})();
