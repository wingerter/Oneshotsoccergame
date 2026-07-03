/* Balance-Simulation: spielt komplette Runs mit Zufalls-KI durch.
 * Aufruf: node sim/sim.js [anzahlRuns]
 * Ein menschlicher Spieler trifft bessere Entscheidungen als die Zufalls-KI,
 * daher sollte die KI-Winrate DEUTLICH unter der Ziel-Spieler-Winrate liegen. */
const E = require('../js/engine.js');
const D = require('../js/data.js');

const N = parseInt(process.argv[2] || '300', 10);

function randomDraft(run) {
  for (let i = 0; i < E.DRAFT_SLOTS.length; i++) {
    const cands = E.draftCandidates(i);
    // KI: nimmt den besten nach Overall (leicht verrauscht)
    cands.sort((a, b) => E.overall(b) - E.overall(a));
    run.players.push(Math.random() < 0.7 ? cands[0] : cands[1]);
  }
}

const stageReached = new Array(D.STAGES.length + 1).fill(0);
let totalGoalsFor = 0, totalGoalsAgainst = 0, totalMatches = 0, shootouts = 0, errors = 0;
const goalDiffPerStage = D.STAGES.map(() => ({ gf: 0, ga: 0, n: 0, wins: 0 }));

for (let i = 0; i < N; i++) {
  try {
    const run = E.newRun();
    randomDraft(run);
    while (!run.over) {
      const stage = run.stage;
      const opp = E.genOpponent(stage);
      const m = E.autoPlayMatch(run, opp);
      if (m.shootout) shootouts++;
      totalMatches++;
      goalDiffPerStage[stage].gf += m.score.you;
      goalDiffPerStage[stage].ga += m.score.opp;
      goalDiffPerStage[stage].n++;
      if (m.result === 'win') goalDiffPerStage[stage].wins++;
      E.applyResult(run, m);
      if (!run.over) {
        const offers = E.rollOffers(run);
        E.applyOffer(run, offers[Math.floor(Math.random() * offers.length)]);
      }
    }
    stageReached[run.stage]++;
    totalGoalsFor += run.goalsFor;
    totalGoalsAgainst += run.goalsAgainst;
  } catch (e) {
    errors++;
    if (errors <= 3) console.error('FEHLER in Run', i, e);
  }
}

console.log('=== Balance-Sim:', N, 'Runs (Zufalls-KI) ===');
console.log('Fehler:', errors);
console.log('Ø Tore pro Spiel:', (totalGoalsFor / totalMatches).toFixed(2), ':', (totalGoalsAgainst / totalMatches).toFixed(2));
console.log('Elfmeterschießen-Quote:', (100 * shootouts / totalMatches).toFixed(1) + '%');
console.log('\nStage erreicht (= Anzahl Siege vor dem Aus; 7 = Run gewonnen):');
for (let s = 0; s <= D.STAGES.length; s++) {
  const bar = '#'.repeat(Math.round(60 * stageReached[s] / N));
  console.log(String(s).padStart(2), String(stageReached[s]).padStart(5), bar);
}
console.log('\nWinrate & Tore je Stage:');
goalDiffPerStage.forEach((g, s) => {
  if (!g.n) return;
  console.log('Stage', s, D.STAGES[s].name.padEnd(30),
    'Winrate ' + (100 * g.wins / g.n).toFixed(0) + '%',
    ' Tore ' + (g.gf / g.n).toFixed(2) + ':' + (g.ga / g.n).toFixed(2));
});
const fullWins = stageReached[D.STAGES.length];
console.log('\nKomplette Runs gewonnen:', fullWins, '(' + (100 * fullWins / N).toFixed(1) + '%)');
