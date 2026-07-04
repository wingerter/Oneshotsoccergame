/* Bolzplatz-Legenden – synthetisierte Soundeffekte (Web Audio API, keine Assets nötig) */
(function (root) {
  'use strict';
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('bolzplatz-legenden-muted') === '1'; } catch (e) { /* egal */ }

  function getCtx() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, opts) {
    if (muted) return;
    const c = getCtx();
    if (!c) return;
    opts = opts || {};
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (opts.slideTo) osc.frequency.linearRampToValueAtTime(opts.slideTo, c.currentTime + dur);
    const vol = opts.vol !== undefined ? opts.vol : 0.16;
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.linearRampToValueAtTime(vol, c.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + dur + 0.02);
  }

  function noiseBurst(dur, opts) {
    if (muted) return;
    const c = getCtx();
    if (!c) return;
    opts = opts || {};
    const bufferSize = Math.max(1, Math.floor(c.sampleRate * dur));
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = opts.filterType || 'bandpass';
    filter.frequency.value = opts.freq || 1200;
    const gain = c.createGain();
    gain.gain.value = opts.vol !== undefined ? opts.vol : 0.15;
    src.connect(filter).connect(gain).connect(c.destination);
    src.start();
  }

  function click() { tone(520, 0.05, { type: 'square', vol: 0.05 }); }
  function whistlePeep() {
    tone(2200, 0.16, { type: 'square', vol: 0.08 });
    setTimeout(() => tone(2200, 0.16, { type: 'square', vol: 0.08 }), 210);
  }
  function goalFanfare() {
    [660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => tone(f, 0.22, { type: 'sawtooth', vol: 0.11 }), i * 90));
    noiseBurst(0.5, { freq: 2500, vol: 0.04, filterType: 'highpass' });
  }
  function cardBeep() { tone(300, 0.28, { type: 'square', vol: 0.09, slideTo: 180 }); }
  function injurySad() { tone(300, 0.4, { type: 'sine', vol: 0.09, slideTo: 120 }); }
  function powerWhoosh() {
    noiseBurst(0.32, { freq: 700, vol: 0.13, filterType: 'lowpass' });
    tone(150, 0.28, { type: 'sawtooth', vol: 0.07, slideTo: 60 });
  }

  function crowdCheer() {
    if (muted) return;
    const c = getCtx();
    if (!c) return;
    const dur = 1.6;
    const size = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, size, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.6;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.17, c.currentTime + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    src.connect(filter).connect(gain).connect(c.destination);
    src.start();
  }

  // ---------- Intro-Musik: kleiner Chiptune-Track (~14 s), fest durchgeplant ----------
  let introBus = null;
  function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function startIntroTune() {
    if (muted) return;
    const c = getCtx();
    if (!c) return;
    stopIntroTune();
    const master = c.createGain();
    master.gain.value = 1;
    master.connect(c.destination);
    introBus = { master, c };

    const t0 = c.currentTime + 0.08;
    const E = 0.2273; // Achtelnote bei 132 BPM

    function note(idx, midi, len, type, vol) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.value = midiHz(midi);
      const ts = t0 + idx * E;
      const d = len * E;
      gain.gain.setValueAtTime(0.0001, ts);
      gain.gain.linearRampToValueAtTime(vol, ts + 0.015);
      gain.gain.setValueAtTime(vol, ts + Math.max(0.015, d - 0.06));
      gain.gain.linearRampToValueAtTime(0.0001, ts + d);
      osc.connect(gain).connect(master);
      osc.start(ts);
      osc.stop(ts + d + 0.03);
    }
    function hat(idx, vol) {
      const dur = 0.05;
      const size = Math.floor(c.sampleRate * dur);
      const buffer = c.createBuffer(1, size, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
      const src = c.createBufferSource();
      src.buffer = buffer;
      const filter = c.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 6000;
      const gain = c.createGain();
      gain.gain.value = vol;
      src.connect(filter).connect(gain).connect(master);
      src.start(t0 + idx * E);
    }

    // Bass (Triangle): Am | F | C | G | Am | F | G | A-Finale
    const roots = [45, 41, 48, 43, 45, 41, 43, 45]; // A2 F2 C3 G2 …
    for (let bar = 0; bar < 8; bar++) {
      if (bar === 7) { note(56, 45, 8, 'triangle', 0.16); continue; } // Schlusston hält
      for (let i = 0; i < 8; i++) {
        note(bar * 8 + i, roots[bar] + (i % 2 === 1 ? 12 : 0), 0.9, 'triangle', 0.14);
      }
    }
    // Melodie (Square): Dribbel-Riff → Anlauf → Tor-Jubel → Ausklang → Titel-Akkord
    const mel = [
      [0, 69, 1], [1, 72, 1], [2, 76, 1], [3, 72, 1], [4, 69, 1], [5, 72, 1], [6, 76, 2],
      [8, 69, 1], [9, 65, 1], [10, 69, 1], [11, 72, 1], [12, 74, 1], [13, 72, 1], [14, 69, 2],
      [16, 67, 1], [17, 64, 1], [18, 67, 1], [19, 72, 1], [20, 76, 1], [21, 74, 1], [22, 72, 2],
      [24, 71, 1], [25, 67, 1], [26, 71, 1], [27, 74, 1], [28, 79, 3], [31, 81, 1],
      [32, 76, 2], [34, 72, 2], [36, 69, 2], [38, 64, 2],
      [40, 65, 2], [42, 69, 2], [44, 72, 4],
      [48, 74, 2], [50, 71, 2], [52, 67, 2], [54, 71, 2],
    ];
    for (const [i, m, l] of mel) note(i, m, l * 0.92, 'square', 0.055);
    // Finale in A-Dur: der Pokal glänzt schon
    for (const m of [69, 73, 76]) note(56, m, 7, 'square', 0.045);
    note(58, 81, 5, 'square', 0.028);
    // Hi-Hats
    for (let i = 0; i < 56; i++) hat(i, i % 2 === 0 ? 0.03 : 0.014);
  }

  function stopIntroTune() {
    if (!introBus) return;
    const { master, c } = introBus;
    introBus = null;
    try {
      master.gain.setTargetAtTime(0.0001, c.currentTime, 0.04);
      setTimeout(() => { try { master.disconnect(); } catch (e) { /* egal */ } }, 400);
    } catch (e) { /* egal */ }
  }

  function setMuted(v) {
    muted = v;
    try { localStorage.setItem('bolzplatz-legenden-muted', v ? '1' : '0'); } catch (e) { /* egal */ }
    if (v) stopIntroTune();
  }
  function isMuted() { return muted; }

  root.SoccerSound = {
    click, whistlePeep, goalFanfare, cardBeep, injurySad, powerWhoosh, crowdCheer,
    startIntroTune, stopIntroTune, setMuted, isMuted,
  };
})(typeof window !== 'undefined' ? window : this);
