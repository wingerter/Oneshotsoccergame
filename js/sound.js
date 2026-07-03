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

  function setMuted(v) {
    muted = v;
    try { localStorage.setItem('bolzplatz-legenden-muted', v ? '1' : '0'); } catch (e) { /* egal */ }
  }
  function isMuted() { return muted; }

  root.SoccerSound = { click, whistlePeep, goalFanfare, cardBeep, injurySad, powerWhoosh, setMuted, isMuted };
})(typeof window !== 'undefined' ? window : this);
