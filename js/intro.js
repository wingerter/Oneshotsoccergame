/* Bolzplatz-Legenden – Intro-Cutscene
   Eine komplett prozedural gerenderte "Videosequenz" im Pixel-Stil des Spiels:
   Dribbling übers Feld → Torschuss → Kamerafahrt raus übers Stadion → Titel.
   Mit Chiptune-Musik (sound.js), jederzeit überspringbar (Klick / Taste / Button). */
(function (root) {
  'use strict';

  const W = 192, H = 108;
  const OUT = '#2e1a12';
  const CHALK = '#e6e3d0';
  const KIT_YOU = { j: '#b5301f', j2: '#8c2314', trim: '#f2e6c8' };
  const KIT_OPP = { j: '#25569a', j2: '#173a6e', trim: '#f2e6c8' };
  const KIT_GK  = { j: '#2f8f4d', j2: '#20693a', trim: '#f2e6c8' };
  const SKIN  = { b: '#e8b07a', s: '#c98b50' };
  const SKIN2 = { b: '#b07846', s: '#8f5c30' };
  const HAIR_YOU = '#57381d';
  const HAIR_OPP = '#20180f';

  // ---------- Zeitplan (ms) ----------
  const CAM_SPEED = 0.055;
  const CAM_MAX = 230;
  const T_WIND = 4550;     // Ausholen zum Schuss
  const T_SHOT = 4700;     // Schuss
  const T_IMPACT = 4990;   // Ball zappelt im Netz
  const T_ZOOM = 6400;     // Schnitt: Stadion-Totale, Kamera fährt raus
  const T_TITLE = 9500;    // Titel einblenden
  const TOTAL = 14500;

  const GX = 380;          // Tor (Weltkoordinate, Innenpfosten)
  const GROUND = 94;       // Fußlinie der Spieler

  // ---------- Mini-Helfer (wie in art.js) ----------
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    s = String(s);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rngFor(key) { return mulberry32(hashStr(key)); }
  function pickR(rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function P(ctx) {
    return {
      px(x, y, col) { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); },
      rect(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); },
      hline(x1, x2, y, col) { ctx.fillStyle = col; ctx.fillRect(Math.min(x1, x2), y, Math.abs(x2 - x1) + 1, 1); },
      vline(x, y1, y2, col) { ctx.fillStyle = col; ctx.fillRect(x, Math.min(y1, y2), 1, Math.abs(y2 - y1) + 1); },
      disc(cx, cy, r, col) {
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
          if (x * x + y * y <= r * r + r * 0.4) this.px(cx + x, cy + y, col);
        }
      },
      ring(cx, cy, r, col) {
        const n = Math.max(24, Math.ceil(r * 12));
        for (let a = 0; a < n; a++) {
          const t = (a / n) * Math.PI * 2;
          this.px(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), col);
        }
      },
    };
  }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function easeInOut(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }

  // ---------- Sprites (Seitenansicht, ~24px hoch) ----------
  function leg(g, lx, y, col, sockRing) {
    g.rect(lx - 1, y - 9, 2, 4, col);                 // Bein
    g.rect(lx - 1, y - 5, 2, 3, '#f2ede0');           // Stutzen
    g.hline(lx - 1, lx, y - 5, sockRing || '#b5301f'); // Stutzenring
    g.rect(lx - 1, y - 2, 3, 2, '#3d2c22');           // Schuh
  }
  function torso(g, x, y, kit) {
    g.rect(x - 4, y - 12, 9, 3, '#2b2b33');           // Hose
    g.rect(x - 4, y - 18, 9, 6, kit.j);               // Trikot
    g.rect(x + 3, y - 18, 2, 6, kit.j2);              // Schattenseite
    g.vline(x - 5, y - 18, y - 10, OUT);
    g.vline(x + 5, y - 18, y - 10, OUT);
    g.hline(x - 1, x + 1, y - 18, kit.trim);          // Kragen
  }
  function head(g, x, y, sk, hair, d, opts) {
    opts = opts || {};
    const hx = x + d;                                  // Kopf lehnt in Laufrichtung
    g.rect(hx - 3, y - 27, 8, 8, OUT);                 // Outline-Block
    g.rect(hx - 2, y - 26, 6, 6, sk.b);                // Gesicht
    g.rect(hx - 2, y - 26, 6, 2, hair);                // Schopf
    g.rect(hx + (d > 0 ? -4 : 4), y - 24, 2, 5, hair); // Vokuhila im Nacken
    g.px(hx + 2 * d, y - 24, OUT);                     // Auge
    g.px(hx + 4 * d, y - 23, '#c96a4a');               // rote Nase
    if (opts.mustache !== false) g.hline(hx + d, hx + 3 * d, y - 22, hair); // Schnauzer
    if (opts.happy) g.hline(hx, hx + 2 * d, y - 21, '#f6f2e4');             // Jubel-Grinsen
  }
  // Laufzyklus, dir: 1 = nach rechts, -1 = nach links
  function runner(g, x, y, f, kit, sk, hair, d, opts) {
    const fx = [4, 2, -2, 1][f], bx = [-3, -1, 3, 0][f];
    leg(g, x + bx * d, y, sk.s);                       // hinteres Bein (dunkler)
    torso(g, x, y, kit);
    leg(g, x + fx * d, y, sk.b);                       // vorderes Bein
    const af = [-3, -1, 3, 1][f];
    g.rect(x + af * d - 1, y - 16, 2, 5, sk.b);        // schwingender Arm
    head(g, x, y, sk, hair, d, opts);
  }
  function kicker(g, x, y, phase, kit, sk, hair) {
    if (phase === 'wind') {                            // Ausholen: Schussbein hinten hoch
      leg(g, x + 2, y, sk.b);
      torso(g, x, y, kit);
      g.rect(x - 5, y - 10, 2, 3, sk.s);
      g.rect(x - 7, y - 8, 2, 3, sk.s);
      g.rect(x - 9, y - 7, 3, 2, '#3d2c22');
      g.rect(x - 6, y - 17, 2, 5, sk.b);               // Arm hinten
      head(g, x, y, sk, hair, 1);
    } else if (phase === 'strike') {                   // Schuss: Bein gestreckt nach vorn
      leg(g, x - 1, y, sk.s);
      torso(g, x, y, kit);
      g.rect(x + 1, y - 10, 3, 2, sk.b);
      g.rect(x + 4, y - 9, 3, 2, sk.b);
      g.rect(x + 6, y - 8, 2, 2, '#f2ede0');
      g.rect(x + 8, y - 8, 3, 2, '#3d2c22');
      g.rect(x - 4, y - 21, 2, 6, sk.b);               // Arm hinten oben
      g.rect(x + 3, y - 16, 4, 2, sk.b);               // Arm vorn
      head(g, x, y, sk, hair, 1);
    } else {                                           // Jubel: beide Arme hoch
      leg(g, x - 2, y, sk.b);
      leg(g, x + 2, y, sk.b);
      torso(g, x, y, kit);
      head(g, x, y, sk, hair, 1, { happy: true });
      g.rect(x - 7, y - 24, 2, 8, sk.b);               // Arme über den Kopf gerissen
      g.rect(x + 6, y - 24, 2, 8, sk.b);
      g.px(x - 7, y - 25, sk.b); g.px(x + 7, y - 25, sk.b); // Fäuste
    }
  }
  // Umgegrätschter Gegner am Boden
  function fallen(g, x, y, kit, sk) {
    g.rect(x - 4, y - 3, 8, 3, kit.j);                 // Rumpf am Boden
    g.rect(x - 8, y - 5, 4, 4, OUT);
    g.rect(x - 7, y - 4, 2, 2, sk.b);                  // Kopf
    g.rect(x + 4, y - 7, 2, 4, sk.b);                  // Bein ragt hoch
    g.rect(x + 3, y - 9, 3, 2, '#3d2c22');
    g.px(x - 3, y - 6, '#9ecbff');                     // Schweißtropfen
    g.px(x + 7, y - 1, '#cdbf9e'); g.px(x - 10, y - 1, '#cdbf9e'); // Staub
  }
  // Grätsche ins Leere (rutscht nach links)
  function slider(g, x, y, kit, sk) {
    g.rect(x - 9, y - 3, 5, 2, sk.b);                  // gestrecktes Bein
    g.rect(x - 12, y - 3, 3, 2, '#3d2c22');            // Schuh vorn
    g.rect(x - 2, y - 7, 6, 5, kit.j);                 // Rumpf schräg
    g.rect(x + 4, y - 5, 2, 3, sk.b);                  // angewinkeltes Bein
    g.rect(x + 1, y - 13, 6, 6, OUT);
    g.rect(x + 2, y - 12, 4, 4, sk.b);                 // Kopf
    g.rect(x + 2, y - 12, 4, 1, HAIR_OPP);
    g.px(x + 2, y - 10, OUT);                          // Auge (guckt dem Ball nach)
    g.px(x + 8, y - 2, '#cdbf9e'); g.px(x + 10, y - 1, '#cdbf9e'); // Grätsch-Staub
  }
  function keeper(g, x, y, t) {
    if (t < T_SHOT + 50) {
      // Bereit in den Knien, Blick nach links
      leg(g, x - 3, y, SKIN.b, '#f2e6c8');
      leg(g, x + 3, y, SKIN.b, '#f2e6c8');
      torso(g, x, y, KIT_GK);
      g.rect(x - 6, y - 15, 2, 4, SKIN.b);             // Arme abgespreizt
      g.rect(x + 5, y - 15, 2, 4, SKIN.b);
      head(g, x, y, SKIN, '#20693a', -1);              // grüne Kappe
    } else {
      // Hechtet in die falsche (untere) Ecke
      const q = clamp01((t - T_SHOT - 50) / 320);
      const kx = x - 13 * q, ky = y - 3 - 5 * Math.sin(Math.PI * q);
      g.rect(kx - 4, ky - 4, 9, 3, KIT_GK.j);          // Rumpf quer in der Luft
      g.rect(kx + 3, ky - 5, 2, 1, KIT_GK.j2);
      g.rect(kx - 9, ky - 6, 4, 2, SKIN.b);            // Arme gestreckt
      g.rect(kx - 8, ky - 8, 4, 4, OUT);
      g.rect(kx - 7, ky - 7, 2, 2, SKIN.b);            // Kopf
      g.rect(kx + 5, ky - 3, 4, 2, SKIN.b);            // Beine
      g.rect(kx + 8, ky - 4, 3, 2, '#3d2c22');
      if (q >= 1) { g.px(kx - 6, y - 1, '#cdbf9e'); g.px(kx + 2, y - 1, '#cdbf9e'); } // Aufprall-Staub
    }
  }
  function ballPx(g, x, y) {
    g.disc(x, y, 2, '#f6f2e4');
    g.ring(x, y, 2.6, OUT);
    g.px(x, y, OUT);
    g.px(x - 1, y - 1, '#ffffff');
  }

  // ---------- Vorgerenderte Ebenen der Seitenszene ----------
  function buildSky() {
    const c = makeCanvas(W, 58);
    const g = P(c.getContext('2d'));
    const rnd = rngFor('intro-himmel');
    const bands = [
      [0, 10, '#1d1c3d'], [10, 18, '#33254f'], [18, 26, '#552c55'],
      [26, 33, '#7c3450'], [33, 39, '#a34544'], [39, 45, '#c65f36'], [45, 58, '#e08a3c'],
    ];
    for (const [y1, y2, col] of bands) g.rect(0, y1, W, y2 - y1, col);
    for (let i = 0; i < 22; i++) g.px(Math.floor(rnd() * W), Math.floor(rnd() * 15), i % 3 ? '#8f86b8' : '#d8d2ee');
    // Tiefe Abendsonne
    g.disc(150, 42, 4, '#ffd98a'); g.disc(150, 42, 2, '#fff2c8');
    g.hline(142, 158, 47, '#e8a44f');
    // Wolkenbänke
    for (const [x, y, w] of [[14, 28, 26], [66, 35, 32], [120, 30, 22]]) {
      const light = y < 33 ? '#7a4468' : '#b05a54';
      g.hline(x + 4, x + w - 4, y - 1, light);
      g.hline(x, x + w, y, y < 33 ? '#69395c' : '#a04c48');
    }
    return c;
  }
  function buildSkyline() {
    const c = makeCanvas(384, 24);
    const g = P(c.getContext('2d'));
    const rnd = rngFor('intro-skyline');
    const sil = '#1a1330';
    g.rect(0, 20, 384, 4, sil);
    let x = 0;
    while (x < 384) {
      const w = 10 + Math.floor(rnd() * 18);
      if (rnd() < 0.3) {
        const r = 2 + Math.floor(rnd() * 3);
        g.disc(x + r + 1, 20 - r, r, sil);
        x += r * 2 + 5;
        continue;
      }
      const h = 4 + Math.floor(rnd() * 9);
      g.rect(x, 20 - h, w, h, sil);
      if (rnd() < 0.4) g.px(x + Math.floor(w / 2), 19 - h, sil);
      if (rnd() < 0.7) g.px(x + 2 + Math.floor(rnd() * (w - 3)), 20 - Math.floor(h / 2), '#ffd98a');
      x += w + Math.floor(rnd() * 4);
    }
    // Flutlichtmasten
    for (const mx of [70, 290]) {
      g.vline(mx, 2, 22, '#241a38');
      g.hline(mx - 3, mx + 3, 2, '#241a38');
      for (const lx of [mx - 3, mx, mx + 3]) { g.px(lx, 1, '#fff2a0'); g.px(lx, 0, '#e8c46a'); }
    }
    return c;
  }
  function buildBande() {
    const c = makeCanvas(384, 9);
    const g = P(c.getContext('2d'));
    g.rect(0, 0, 384, 9, '#4a2e1c');
    g.hline(0, 383, 0, '#6e4629');
    g.hline(0, 383, 8, '#331d10');
    for (let x = 0; x < 384; x += 32) g.vline(x, 0, 8, '#3a2413');
    // "Werbetafeln" der Kreisklasse
    const rnd = rngFor('intro-bande');
    for (let x = 6; x < 384; x += 48) {
      g.rect(x, 2, 20, 4, pickR(rnd, ['#cdbf9e', '#e8c94a', '#8fb0c9']));
      for (let d = 0; d < 5; d++) g.px(x + 2 + d * 4, 3 + (d % 2), '#3a2413'); // Fake-Schriftzug
    }
    return c;
  }
  function buildGrass() {
    const c = makeCanvas(384, 50);
    const g = P(c.getContext('2d'));
    const rnd = rngFor('intro-rasen');
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 384; x++) {
        const stripe = Math.floor(x / 16) % 2 === 0;
        const deep = y > 30;
        g.px(x, y, stripe ? (deep ? '#2a5e2d' : '#31702f') : (deep ? '#255228' : '#2c6329'));
      }
    }
    g.hline(0, 383, 1, '#e0decba0'); // ferne Seitenlinie
    g.vline(190, 0, 49, '#e0decb80'); g.vline(191, 0, 49, '#e0decb40'); // Mittellinie zieht vorbei
    for (let i = 0; i < 60; i++) {   // kahle Stellen & Grasbüschel (Kreisklasse!)
      const bx = Math.floor(rnd() * 384), by = 4 + Math.floor(rnd() * 44);
      g.px(bx, by, rnd() < 0.5 ? '#57642e' : '#3f7a38');
    }
    return c;
  }

  // ---------- Stadion-Totale (für den Zoom-out) ----------
  function buildStadium() {
    const c = makeCanvas(W, H);
    const g = P(c.getContext('2d'));
    const rnd = rngFor('intro-stadion');
    // Nachthimmel überm Flutlicht
    const bands = [
      [0, 7, '#141230'], [7, 13, '#1d1c3d'], [13, 19, '#33254f'], [19, 25, '#552c55'],
      [25, 30, '#7c3450'], [30, 34, '#a34544'], [34, 38, '#c65f36'],
    ];
    for (const [y1, y2, col] of bands) g.rect(0, y1, W, y2 - y1, col);
    for (let i = 0; i < 30; i++) g.px(Math.floor(rnd() * W), Math.floor(rnd() * 17), i % 3 ? '#8f86b8' : '#d8d2ee');
    // Hintertribüne mit Publikum
    g.rect(0, 36, W, 3, '#17131f');   // Dachkante
    g.rect(0, 39, W, 12, '#241a30');  // Tribünenkörper
    const fans = ['#e8c94a', '#f2e6c8', '#c65f36', '#8f86b8', '#b5301f', '#25569a', '#d98a3c'];
    for (let y = 40; y < 50; y++) for (let x = 1; x < W - 1; x += 1) {
      if (rnd() < 0.4) g.px(x, y, pickR(rnd, fans));
    }
    g.rect(0, 51, W, 3, '#3a2a3c');   // Mauer/Wellenbrecher
    // Anzeigetafel überm Dach: 1:0!
    g.vline(88, 30, 36, '#17131f'); g.vline(104, 30, 36, '#17131f');
    g.rect(82, 20, 29, 12, OUT);
    g.rect(83, 21, 27, 10, '#101a14');
    g.vline(91, 24, 28, '#ffcf5c'); g.px(90, 25, '#ffcf5c');            // 1
    g.px(96, 25, '#ffcf5c'); g.px(96, 27, '#ffcf5c');                   // :
    g.vline(100, 24, 28, '#ffcf5c'); g.vline(103, 24, 28, '#ffcf5c');   // 0
    g.hline(100, 103, 24, '#ffcf5c'); g.hline(100, 103, 28, '#ffcf5c');
    // Flutlichtmasten (ragen in den Himmel, mit Glow)
    for (const mx of [10, 182]) {
      g.vline(mx, 14, 51, '#241a38');
      g.rect(mx - 4, 11, 9, 3, '#241a38');
      g.disc(mx, 11, 5, 'rgba(255,240,180,0.14)');
      for (const lx of [mx - 3, mx, mx + 3]) { g.px(lx, 11, '#fff2a0'); g.px(lx, 10, '#e8c46a'); }
    }
    // Rasen
    for (let y = 54; y < 97; y++) for (let x = 0; x < W; x++) {
      const stripe = Math.floor(x / 12) % 2 === 0;
      g.px(x, y, stripe ? '#2f6b33' : '#2a5e2d');
    }
    // Kreidelinien
    g.hline(24, 168, 57, CHALK); g.hline(24, 168, 94, CHALK);
    g.vline(24, 57, 94, CHALK); g.vline(168, 57, 94, CHALK);
    g.vline(96, 57, 94, CHALK);
    g.ring(96, 75.5, 9, CHALK);
    g.vline(36, 64, 87, CHALK); g.hline(24, 36, 64, CHALK); g.hline(24, 36, 87, CHALK);
    g.vline(156, 64, 87, CHALK); g.hline(156, 168, 64, CHALK); g.hline(156, 168, 87, CHALK);
    g.px(30, 76, CHALK); g.px(162, 76, CHALK);
    // Tore
    g.vline(21, 71, 80, CHALK); g.vline(22, 71, 80, '#cdbf9e');
    g.vline(170, 71, 80, CHALK); g.vline(171, 71, 80, '#cdbf9e');
    // Jubeltraube am rechten Tor (da ist das 1:0 gerade reingegangen)
    const spr = (x, y, col, arms) => {
      g.px(x, y - 3, '#3a2a1e');
      g.px(x, y - 2, '#e8b07a');
      g.rect(x - 1, y - 1, 3, 2, col);
      if (arms) { g.px(x - 2, y - 3, '#e8b07a'); g.px(x + 2, y - 3, '#e8b07a'); }
      g.px(x - 1, y + 1, OUT); g.px(x + 1, y + 1, OUT);
    };
    spr(150, 73, '#c0392b', true);
    spr(155, 78, '#c0392b', true);
    spr(147, 80, '#c0392b', true);
    spr(152, 84, '#c0392b', false);
    // Geschlagener Keeper liegt in seinem Tor
    g.rect(163, 76, 5, 2, '#2f8f4d'); g.px(162, 76, '#e8b07a');
    // Ball im Netz + Konfetti
    g.px(166, 74, '#f6f2e4'); g.ring(166, 74, 2, '#ffd34d');
    for (let i = 0; i < 14; i++) {
      g.px(140 + Math.floor(rnd() * 26), 62 + Math.floor(rnd() * 12), pickR(rnd, ['#ffcf5c', '#ff8a72', '#8fe08a', '#9ecbff']));
    }
    // Vordertribüne (unten): Hinterköpfe und jubelnde Arme
    g.rect(0, 97, W, 11, '#1c1426');
    for (let y = 99; y < 107; y += 2) for (let x = 1; x < W - 1; x += 2) {
      if (rnd() < 0.55) {
        const hx = x + (y % 4 === 1 ? 1 : 0);
        g.px(hx, y, pickR(rnd, ['#8a5a32', '#57381d', '#b07846', '#3a2a1e', '#cdbf9e']));
        if (rnd() < 0.18) g.px(hx, y - 1, '#e8b07a'); // Arm hoch
      }
    }
    return c;
  }

  // ---------- Szene: Seitenansicht (Dribbling + Schuss) ----------
  function blitLoop(ctx, strip, off, y) {
    const w = strip.width;
    const o = ((off % w) + w) % w;
    ctx.drawImage(strip, -o, y);
    ctx.drawImage(strip, w - o, y);
  }
  function camAt(t) { return Math.min(CAM_MAX, t * CAM_SPEED); }
  function playerWorld(t) {
    const tCap = CAM_MAX / CAM_SPEED;
    if (t <= tCap) return 58 + t * CAM_SPEED;
    return 58 + CAM_MAX + Math.min(12, (t - tCap) * 0.03); // trabt die letzten Meter allein
  }
  function ballPos(t, pw, cam) {
    const psx = pw - cam;
    if (t < T_WIND) {
      return { x: psx + 6 + 3 * Math.sin(t / 120), y: GROUND - 3 - 2.5 * Math.abs(Math.sin(t / 95)) };
    }
    if (t < T_SHOT) return { x: psx + 8, y: GROUND - 3 };
    if (t < T_IMPACT) {
      const u = (t - T_SHOT) / (T_IMPACT - T_SHOT);
      const x0 = psx + 8, y0 = GROUND - 3;
      const x1 = GX - cam + 9, y1 = 69;
      return { x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u - Math.sin(Math.PI * u) * 8, u };
    }
    const v = Math.min(1, (t - T_IMPACT) / 500);   // plumpst im Netz zu Boden
    return { x: GX - cam + 9, y: 69 + (GROUND - 4 - 69) * v * v };
  }
  function drawGoal(g, x, t) {
    // Netz
    const net = 'rgba(230,227,208,0.4)';
    for (const nx of [3, 6, 9, 12]) g.vline(x + nx, 66 + Math.floor(nx / 5), 92 - Math.floor(nx / 6), net);
    for (const ny of [69, 73, 77, 81, 85, 89]) g.hline(x + 2, x + 12, ny, net);
    // Netz beult beim Einschlag
    if (t >= T_IMPACT && t < T_IMPACT + 420) {
      const b = t < T_IMPACT + 180 ? 2 : 1;
      g.vline(x + 12 + b, 67, 76, net);
      g.vline(x + 12 + b, 77, 90, 'rgba(230,227,208,0.25)');
    }
    // Latte mit Perspektive nach hinten
    g.hline(x, x + 4, 64, CHALK);
    g.hline(x + 4, x + 8, 65, CHALK);
    g.hline(x + 8, x + 12, 66, '#cdbf9e');
    // Pfosten
    g.vline(x, 64, GROUND, CHALK);
    g.vline(x + 1, 64, GROUND, '#cdbf9e');
    g.vline(x + 12, 67, GROUND - 3, '#cdbf9e');
    g.hline(x + 1, x + 12, GROUND - 2, 'rgba(205,191,158,0.5)');
    // Elfmeterpunkt davor
    g.px(x - 24, GROUND + 4, '#e0decb');
  }
  function renderSide(ctx, g, t, pre) {
    const cam = camAt(t);
    const pw = playerWorld(t);
    const psx = pw - cam;

    ctx.drawImage(pre.sky, 0, 0);
    blitLoop(ctx, pre.skyline, cam * 0.35, 34);
    blitLoop(ctx, pre.bande, cam * 0.8, 49);
    blitLoop(ctx, pre.grass, cam, 58);

    // Tor + Keeper (tauchen rechts auf)
    const goalX = GX - cam;
    if (goalX < W + 20) {
      drawGoal(g, goalX, t);
      keeper(g, goalX - 8, GROUND, t);
    }

    // Verfolger, der nie rankommt
    const chaseX = psx - 26 - Math.min(14, t * 0.004);
    if (chaseX > -14) {
      runner(g, chaseX, GROUND, Math.floor(t / 130 + 2) % 4, KIT_OPP, SKIN2, HAIR_OPP, 1, { mustache: false });
      g.px(chaseX + 5, GROUND - 26, '#9ecbff'); // kommt ins Schwitzen
    }

    // Gegner 1 (Weltposition 165): Grätsche ins Leere, dann liegt er
    const d1 = 165 - cam;
    if (d1 > -16 && d1 < W + 16) {
      if (t < 1500) runner(g, d1, GROUND, 0, KIT_OPP, SKIN2, HAIR_OPP, -1);
      else if (t < 2150) slider(g, d1 - (t - 1500) * 0.02, GROUND, KIT_OPP, SKIN2);
      else fallen(g, d1 - 14, GROUND, KIT_OPP, SKIN2);
    }
    // Gegner 2 (Weltposition 240): verladen, fällt hin
    const d2 = 240 - cam;
    if (d2 > -16 && d2 < W + 16) {
      if (t < 3100) runner(g, d2, GROUND, Math.floor(t / 160) % 4, KIT_OPP, SKIN2, HAIR_OPP, -1);
      else if (t < 3600) slider(g, d2 - (t - 3100) * 0.015, GROUND, KIT_OPP, SKIN2);
      else fallen(g, d2 - 10, GROUND, KIT_OPP, SKIN2);
    }

    // Unser Held
    if (t < T_WIND) {
      const hop = (t > 1550 && t < 1950) ? Math.sin((t - 1550) / 400 * Math.PI) * 4 : 0; // Hüpfer über die Grätsche
      runner(g, psx, GROUND - hop, Math.floor(t / 110) % 4, KIT_YOU, SKIN, HAIR_YOU, 1);
    } else if (t < T_SHOT) {
      kicker(g, psx, GROUND, 'wind', KIT_YOU, SKIN, HAIR_YOU);
    } else if (t < T_IMPACT + 250) {
      kicker(g, psx, GROUND, 'strike', KIT_YOU, SKIN, HAIR_YOU);
    } else {
      const jump = Math.abs(Math.sin((t - T_IMPACT) / 260 * Math.PI)) * 5;
      kicker(g, psx, GROUND - jump, 'jubel', KIT_YOU, SKIN, HAIR_YOU);
    }

    // Ball (+ Schweif beim Schuss)
    const b = ballPos(t, pw, cam);
    if (b.u !== undefined) {
      for (let k = 1; k <= 3; k++) {
        const bu = ballPos(t - k * 26, pw, cam);
        g.px(bu.x, bu.y, ['#ffd34d', '#e8a44f', '#c65f36'][k - 1]);
      }
    }
    ballPx(g, b.x, b.y);

    // Einschlag-Blitz
    if (t >= T_IMPACT && t < T_IMPACT + 260) {
      g.rect(0, 0, W, H, 'rgba(255,244,214,' + (0.85 * (1 - (t - T_IMPACT) / 260)).toFixed(3) + ')');
    }
  }

  // ---------- Szene: Stadion-Zoom + Titel ----------
  function renderStadium(ctx, g, t, pre) {
    const p = clamp01((t - (T_ZOOM + 100)) / 2700);
    const z = 7 - 6 * easeInOut(p);
    const sw = W / z, sh = H / z;
    const sx = 168 * (1 - sw / W), sy = 74 * (1 - sh / H);
    ctx.drawImage(pre.stad, sx, sy, sw, sh, 0, 0, W, H);
    if (t < T_ZOOM + 450) {
      g.rect(0, 0, W, H, 'rgba(255,244,214,' + (0.9 * (1 - (t - T_ZOOM) / 450)).toFixed(3) + ')');
    }
    // Leicht abdunkeln, sobald der Titel kommt – bessere Lesbarkeit
    if (t > T_TITLE) {
      g.rect(0, 0, W, H, 'rgba(10,8,20,' + (0.32 * clamp01((t - T_TITLE) / 800)).toFixed(3) + ')');
    }
  }

  // ---------- Ablaufsteuerung ----------
  let playing = false;

  function play(onDone) {
    if (playing) return;
    playing = true;

    const Art = root.SoccerArt;
    const S = root.SoccerSound;
    const ball = Art ? '<img class="pixel-art" alt="" src="' + Art.ballURL() + '">' : '⚽';

    const overlay = document.createElement('div');
    overlay.className = 'intro-overlay';
    overlay.innerHTML =
      '<canvas class="intro-canvas" width="' + W + '" height="' + H + '"></canvas>' +
      '<div class="intro-tor">TOR!</div>' +
      '<div class="intro-titlebox">' +
        '<h1>' + ball + ' BOLZPLATZ-LEGENDEN ' + ball + '</h1>' +
        '<div class="intro-sub">Ein Fußball-Roguelike aus den Tiefen der Kreisklasse</div>' +
      '</div>' +
      '<div class="intro-hint">Klick oder Taste: weiter</div>' +
      '<button class="btn-ghost intro-skip">⏭ Intro überspringen</button>';
    document.body.appendChild(overlay);

    const canvas = overlay.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const g = P(ctx);
    const torEl = overlay.querySelector('.intro-tor');
    const titleEl = overlay.querySelector('.intro-titlebox');
    const hintEl = overlay.querySelector('.intro-hint');

    const pre = {
      sky: buildSky(),
      skyline: buildSkyline(),
      bande: buildBande(),
      grass: buildGrass(),
      stad: buildStadium(),
    };

    if (S && S.startIntroTune) S.startIntroTune();

    let raf = null;
    let done = false;
    const sfx = { whistle: false, shot: false, goal: false };
    const t0 = performance.now();

    function finish() {
      if (done) return;
      done = true;
      playing = false;
      if (raf) cancelAnimationFrame(raf);
      if (S && S.stopIntroTune) S.stopIntroTune();
      window.removeEventListener('keydown', onKey);
      overlay.remove();
      if (onDone) onDone();
    }
    function onKey(e) {
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
      finish();
    }
    overlay.addEventListener('pointerdown', finish);
    window.addEventListener('keydown', onKey);

    function frame(now) {
      if (done) return;
      const t = now - t0;

      // Sound-Marken
      if (S) {
        if (!sfx.whistle && t >= 250) { sfx.whistle = true; S.whistlePeep(); }
        if (!sfx.shot && t >= T_SHOT) { sfx.shot = true; S.powerWhoosh(); }
        if (!sfx.goal && t >= T_IMPACT) {
          sfx.goal = true;
          S.goalFanfare();
          if (S.crowdCheer) S.crowdCheer();
        }
      }
      // Text-Einblendungen
      if (t >= T_IMPACT + 80 && t < T_ZOOM) torEl.classList.add('show');
      if (t >= T_ZOOM) torEl.classList.remove('show');
      if (t >= T_TITLE) titleEl.classList.add('show');
      if (t >= T_TITLE + 1600) hintEl.classList.add('show');

      if (t < T_ZOOM) renderSide(ctx, g, t, pre);
      else renderStadium(ctx, g, t, pre);

      if (t >= TOTAL) { finish(); return; }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  }

  root.SoccerIntro = { play };
})(typeof window !== 'undefined' ? window : this);
