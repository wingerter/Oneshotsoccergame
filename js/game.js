/* Bolzplatz-Legenden – UI-Controller (Screens, Match-Ablauf, Save) */
(function () {
  'use strict';
  const E = window.SoccerEngine;
  const D = window.SoccerData;
  const app = document.getElementById('app');
  const SAVE_KEY = 'bolzplatz-legenden-save';

  let run = null;
  let match = null;
  let draftIndex = 0;
  let offerToast = [];

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
      <h3>${esc(p.name)}</h3>
      <div class="pos">${E.POS_LABELS[p.pos]} · Gesamt ${E.overall(p)}</div>
      ${statBars(p)}
      ${q ? `<div class="quirk"><b>${esc(q.name)}:</b> ${esc(q.desc)}</div>` : '<div class="quirk" style="opacity:.5">Keine Marotte. Verdächtig normal.</div>'}
    `;
    if (onPick) card.addEventListener('click', () => onPick(p));
    return card;
  }

  // ---------- Save / Load ----------
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

  // ---------- Titel ----------
  function showTitle() {
    clear();
    const saved = loadRun();
    const s = el('div', 'title-screen');
    s.innerHTML = `
      <h1>⚽ BOLZPLATZ-LEGENDEN</h1>
      <div class="sub">Ein Fußball-Roguelike aus den Tiefen der Kreisklasse</div>
      <div class="rules">
        <li>🎲 <b>Drafte</b> ein Team aus fragwürdigen Talenten mit noch fragwürdigeren Marotten.</li>
        <li>🏆 <b>7 K.o.-Spiele</b> bis zum Pokal – eine Niederlage und der Run ist vorbei.</li>
        <li>🎯 <b>Faires Glück:</b> Jede Aktion zeigt ihre Erfolgschance. Du entscheidest, wie viel Risiko du gehst.</li>
        <li>💥 <b>Powerschüsse</b> sind ungenau – aber verzogene Bälle schießen schon mal einen Gegner um.</li>
        <li>🍰 Zwischen den Spielen: Training, Kuchenverkauf und dubiose Energydrinks.</li>
      </div>
    `;
    const startBtn = el('button', 'btn-big', '🥾 Neuer Run');
    startBtn.addEventListener('click', startNewRun);
    s.appendChild(startBtn);
    if (saved && !saved.over) {
      const contBtn = el('button', 'btn-big', '▶ Weiterspielen (Spiel ' + (saved.stage + 1) + '/7)');
      contBtn.style.marginLeft = '12px';
      contBtn.addEventListener('click', () => { run = saved; offerToast = []; showPreMatch(); });
      s.appendChild(contBtn);
    }
    app.appendChild(s);
  }

  // ---------- Draft ----------
  function startNewRun() {
    run = E.newRun();
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
        if (draftIndex >= E.DRAFT_SLOTS.length) showPreMatch();
        else showDraft();
      }));
    }
    app.appendChild(cards);
  }

  // ---------- Vor dem Spiel ----------
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

    const pills = el('div', 'pill-row');
    pills.innerHTML = `<span class="pill">Moral: <b>${run.moral} ${moralEmoji(run.moral)}</b></span>` +
      run.relics.map(id => {
        const r = D.RELICS.find(x => x.id === id);
        return `<span class="pill" title="${esc(r.desc)}">🎁 ${esc(r.name)}</span>`;
      }).join('') +
      (run.buffs.energydrink ? '<span class="pill">⚡ Energydrink aktiv!</span>' : '');
    app.appendChild(pills);

    const vs = el('div', 'vs-box');
    const yourCard = el('div', 'card');
    yourCard.innerHTML = `<h3>${esc(run.teamName)}</h3><div class="pos">Dein Haufen</div>` +
      run.players.map(p => {
        const status = p.verletzt ? ' 🤕' : (p.gesperrt > 0 ? ' 🔒' : '');
        return `<div class="statrow"><span class="lbl">${p.pos}</span><span style="flex:1">${esc(p.name)}${status}</span><span class="val">${E.overall(p)}</span></div>`;
      }).join('');
    const oppCard = el('div', 'card');
    oppCard.innerHTML = `<h3>${esc(stage.name)}</h3><div class="pos">Gefahr: <span class="stars">${stars}</span></div><div class="desc">${esc(stage.desc)}</div>`;
    vs.appendChild(yourCard);
    vs.appendChild(el('div', 'vs', 'VS'));
    vs.appendChild(oppCard);
    app.appendChild(vs);

    const center = el('div', 'center-box');
    center.style.marginTop = '10px';
    const btn = el('button', 'btn-big', '🔥 ANPFIFF!');
    btn.addEventListener('click', startMatch);
    center.appendChild(btn);
    app.appendChild(center);

    addFooter();
  }

  // ---------- Match ----------
  let logEl, sitEl, scoreEl, squadEl, pendingEvents, revealTimer;

  function startMatch() {
    const opp = E.genOpponent(run.stage);
    match = E.createMatch(run, opp);
    clear();

    scoreEl = el('div', 'scoreboard');
    app.appendChild(scoreEl);

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

  function refreshAll() {
    refreshScore();
    refreshSquad();
    renderSituation();
  }

  function refreshScore() {
    const so = match.shootout;
    scoreEl.innerHTML = `
      <span class="teamname">${esc(run.teamName)}</span>
      <span class="minute">${Math.min(90, Math.floor(match.minute))}'</span>
      <span class="score">${match.score.you}:${match.score.opp}${so ? ` <small style="font-size:0.9rem">(${so.you}:${so.opp} i.E.)</small>` : ''}</span>
      <span class="minute">${moralEmoji(run.moral)}</span>
      <span class="teamname right">${esc(match.opp.name)}</span>
    `;
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

  function appendLog(ev) {
    const minute = Math.min(90, Math.floor(match.minute));
    const e = el('div', 'entry ' + ev.kind, `<small style="opacity:.55">${minute}'</small> ${esc(ev.text)}`);
    logEl.appendChild(e);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function probBadge(p) {
    const pct = Math.round(p * 100);
    const cls = pct >= 60 ? 'hi' : pct >= 35 ? 'mid' : 'lo';
    return `<span class="prob ${cls}">${pct}%</span>`;
  }

  function renderSituation() {
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
    const actions = el('div', 'actions');
    for (const o of sit.options) {
      const btn = el('button', 'action-btn');
      btn.innerHTML = `<span class="toprow"><span>${esc(o.label)}</span>${o.prob !== undefined ? probBadge(o.prob) : ''}</span>` +
        (o.desc ? `<span class="adesc">${esc(o.desc)}</span>` : '');
      btn.addEventListener('click', () => onChoice(o.id));
      actions.appendChild(btn);
    }
    sitEl.appendChild(actions);
  }

  function onChoice(id) {
    sitEl.querySelectorAll('button').forEach(b => b.disabled = true);
    const events = E.step(match, id);
    playEvents(events, refreshAll);
  }

  function renderMatchEnd() {
    const won = match.result === 'win';
    const line = E.applyResult(run, match);
    if (run.over) clearSave(); else saveRun();
    refreshScore();
    refreshSquad();
    sitEl.innerHTML = `<div class="sit-text" style="font-size:1.2rem">${won ? '🎉 <b>SIEG!</b> ' : '💀 <b>NIEDERLAGE.</b> '}${esc(line)}</div>`;
    const btn = el('button', 'btn-big', run.over ? (run.won ? '🏆 ZUM POKAL' : 'Zum Abpfiff des Runs') : 'Weiter');
    btn.addEventListener('click', () => {
      match = null;
      if (run.over) showRunEnd();
      else showOffers();
    });
    sitEl.appendChild(btn);
  }

  // ---------- Events zwischen Spielen ----------
  function showOffers() {
    clear();
    const head = el('div', 'screen-head');
    head.innerHTML = `<div class="crumb">NACH DEM SPIEL</div><h2>🎉 Sieg! Was macht ihr mit dem Schwung?</h2>
      <div class="crumb">Wähle genau eine Sache:</div>`;
    app.appendChild(head);
    const offers = E.rollOffers(run);
    const cards = el('div', 'cards');
    for (const o of offers) {
      const card = el('div', 'card');
      card.innerHTML = `<span class="icon">${o.icon || '🎁'}</span><h3>${esc(o.title)}</h3><div class="desc">${esc(o.desc)}</div>`;
      card.addEventListener('click', () => {
        offerToast = E.applyOffer(run, o);
        showPreMatch();
      });
      cards.appendChild(card);
    }
    app.appendChild(cards);
  }

  // ---------- Run-Ende ----------
  function showRunEnd() {
    clear();
    clearSave();
    const box = el('div', 'center-box');
    if (run.won) {
      box.innerHTML = `
        <div class="huge">🏆🎉 POKALSIEGER!! 🎉🏆</div>
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
    btn.addEventListener('click', startNewRun);
    box.appendChild(btn);
    const tBtn = el('button', 'btn-ghost', 'Zum Titelbildschirm');
    tBtn.style.marginLeft = '10px';
    tBtn.addEventListener('click', showTitle);
    box.appendChild(tBtn);
    app.appendChild(box);
  }

  function addFooter() {
    const f = el('footer', 'gamefoot');
    f.innerHTML = 'Bolzplatz-Legenden – gespeichert wird automatisch vor jedem Spiel.';
    const btn = el('button', 'btn-ghost', 'Run aufgeben');
    btn.addEventListener('click', () => {
      if (confirm('Wirklich aufgeben? Der Spielstand wird gelöscht.')) {
        clearSave();
        run = null;
        showTitle();
      }
    });
    f.appendChild(btn);
    app.appendChild(f);
  }

  // Los geht's
  showTitle();
})();
