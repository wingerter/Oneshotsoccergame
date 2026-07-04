/* Bolzplatz-Legenden – Pixel-Art-Engine
   Prozedural generierte Retro-Grafik (VGA-Adventure-Charme), keine externen Assets.
   Alles wird auf kleine Canvases gemalt und hochskaliert (image-rendering: pixelated). */
(function (root) {
  'use strict';

  // ---------- Seeded RNG (stabil pro Spieler/Team) ----------
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

  // ---------- Canvas-Helfer ----------
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function P(ctx) {
    return {
      px(x, y, col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); },
      rect(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); },
      hline(x1, x2, y, col) { ctx.fillStyle = col; ctx.fillRect(Math.min(x1, x2), y, Math.abs(x2 - x1) + 1, 1); },
      vline(x, y1, y2, col) { ctx.fillStyle = col; ctx.fillRect(x, Math.min(y1, y2), 1, Math.abs(y2 - y1) + 1); },
      // Form aus Zeilen-Spannen stanzen: spans = [[y, x1, x2], ...] – mit automatischer Outline
      blob(spans, ox, oy, fill, outline) {
        const set = new Set();
        for (const [y, x1, x2] of spans) for (let x = x1; x <= x2; x++) set.add(x + ',' + y);
        for (const key of set) {
          const [x, y] = key.split(',').map(Number);
          const edge = !set.has((x + 1) + ',' + y) || !set.has((x - 1) + ',' + y) ||
                       !set.has(x + ',' + (y + 1)) || !set.has(x + ',' + (y - 1));
          this.px(ox + x, oy + y, edge && outline ? outline : fill);
        }
      },
      disc(cx, cy, r, col) {
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
          if (x * x + y * y <= r * r + r * 0.4) this.px(cx + x, cy + y, col);
        }
      },
      ring(cx, cy, r, col) {
        const n = Math.max(64, Math.ceil(r * 12));
        for (let a = 0; a < n; a++) {
          const t = (a / n) * Math.PI * 2;
          this.px(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), col);
        }
      },
      dither(x, y, w, h, col, rnd, density) {
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
          if (rnd() < density) this.px(xx, yy, col);
        }
      },
    };
  }

  // ---------- Palette ----------
  const OUT = '#2e1a12'; // warme, dunkle Outline (kein hartes Schwarz)
  const SKINS = [
    { b: '#f2c091', s: '#d99a63', d: '#b97a48' },
    { b: '#e8b07a', s: '#c98b50', d: '#a86c38' },
    { b: '#d69a62', s: '#b57a42', d: '#8f5c2e' },
    { b: '#b07846', s: '#8f5c30', d: '#6e4420' },
    { b: '#8a5a32', s: '#6e4422', d: '#513016' },
    { b: '#6b422a', s: '#54301c', d: '#3d2112' },
  ];
  const KIT_YOU = { j: '#b5301f', j2: '#8c2314', trim: '#f2e6c8' };
  const KIT_GK  = { j: '#2f8f4d', j2: '#20693a', trim: '#f2e6c8' };
  const CREST_COLORS = [
    ['#b5301f', '#f2e6c8'], ['#25569a', '#e8c94a'], ['#2f8f4d', '#f2e6c8'],
    ['#26262e', '#e8c94a'], ['#8a4a9a', '#f2e6c8'], ['#c86a1f', '#26262e'],
    ['#25569a', '#f2e6c8'], ['#7a1f2e', '#e8c94a'],
  ];

  // Kleiner Ball (r=3) mit Fünfeck statt Schachbrett
  function drawMiniBall(g, x, y) {
    g.disc(x, y, 3, '#f6f2e4');
    g.ring(x, y, 3.4, OUT);
    g.rect(x - 1, y - 1, 2, 2, OUT);       // Fünfeck-Panel Mitte
    g.px(x - 3, y + 1, OUT); g.px(x + 2, y - 2, OUT); g.px(x + 1, y + 2, OUT); // Nähte
    g.px(x - 2, y - 2, '#ffffff');          // Glanz
  }

  // ---------- Kopf / Büste ----------
  const HEAD_SPANS = (function () {
    // Kopf lokal 12 breit, 16 hoch (0..11 / 0..15)
    const s = [];
    s.push([0, 3, 8]);
    s.push([1, 1, 10]);
    for (let y = 2; y <= 10; y++) s.push([y, 0, 11]);
    s.push([11, 1, 10]);
    s.push([12, 2, 9]);
    s.push([13, 3, 8]);
    return s;
  })();

  // Ein Gesicht + Oberkörper in ein 26x30-Raster malen.
  // prm: { skin, hair, hairStyle, browY, eyeStyle, noseBig, redNose, mouth, mustache,
  //        stubble, plaster, headband, kit, cap, armband }
  function drawBust(g, prm) {
    const sk = prm.skin, HC = prm.hair, kit = prm.kit;
    const HX = 7, HY = 3; // Kopf-Offset

    // Hinterhaar (liegt HINTER dem Kopf)
    if (prm.hairStyle === 'mullet' || prm.hairStyle === 'long') {
      g.blob([[0, 0, 13], [1, 0, 13], [2, 0, 13], [3, 0, 13], [4, 0, 13], [5, 0, 13],
              [6, 0, 13], [7, 0, 13], [8, 0, 13], [9, 0, 13], [10, 0, 13],
              [11, 0, 13], [12, 0, 13], [13, 1, 12], [14, 1, 12], [15, 2, 11], [16, 2, 11]],
        HX - 1, HY + 2, HC, OUT);
    }

    // Hals + Oberkörper
    g.rect(11, HY + 14, 4, 4, sk.s);
    g.vline(10, HY + 14, HY + 17, OUT);
    g.vline(15, HY + 14, HY + 17, OUT);
    // Trikot
    g.blob([[0, 3, 10], [1, 1, 12], [2, 0, 13], [3, 0, 13], [4, 0, 13], [5, 0, 13], [6, 0, 13], [7, 0, 13]],
      6, 22, kit.j, OUT);
    g.rect(16, 24, 3, 5, kit.j2);                 // Schatten rechts
    g.vline(19, 24, 28, OUT);
    g.hline(10, 15, 22, kit.trim);                // Kragen
    g.px(10, 23, kit.trim); g.px(15, 23, kit.trim);
    g.rect(11, 21, 4, 2, sk.s);                   // Halsansatz über Kragen
    if (prm.armband) { g.rect(6, 25, 2, 3, '#e8c94a'); g.px(6, 24, OUT); }

    // Kopf
    g.blob(HEAD_SPANS, HX, HY, sk.b, OUT);
    // Wangen-/Kinnschattierung
    g.vline(HX + 10, HY + 4, HY + 10, sk.s);
    g.hline(HX + 4, HY + 8, HY + 12, sk.s);
    // Ohren
    g.rect(6, HY + 8, 1, 3, sk.b); g.px(5, HY + 9, OUT); g.px(6, HY + 7, OUT); g.px(6, HY + 11, OUT);
    g.rect(19, HY + 8, 1, 3, sk.b); g.px(20, HY + 9, OUT); g.px(19, HY + 7, OUT); g.px(19, HY + 11, OUT);

    // Augen
    const eyeY = HY + 7;
    g.rect(9, eyeY, 2, 2, '#f6f2e4'); g.rect(14, eyeY, 2, 2, '#f6f2e4');
    const look = prm.look; // 0/1 Pupillenrichtung
    g.px(9 + look, eyeY + 1, OUT); g.px(14 + look, eyeY + 1, OUT);
    if (prm.eyeStyle === 'droopy') { g.hline(9, 10, eyeY, sk.s); g.hline(14, 15, eyeY, sk.s); }
    if (prm.eyeStyle === 'squint') { g.hline(9, 10, eyeY, OUT); g.hline(14, 15, eyeY, OUT); }

    // Brauen
    g.hline(9, 11, prm.browY, HC);
    g.hline(14, 16, prm.browY, HC);
    if (prm.bushy) { g.hline(9, 11, prm.browY - 1, HC); g.hline(14, 16, prm.browY - 1, HC); }
    if (prm.angry) { g.px(11, prm.browY + 1, HC); g.px(14, prm.browY + 1, HC); }

    // Nase (gern groß, gern rot)
    const noseC = prm.redNose ? '#c96a4a' : sk.s;
    const noseD = prm.redNose ? '#a84e34' : sk.d;
    if (prm.noseBig) {
      g.px(12, HY + 9, noseC);
      g.hline(11, 13, HY + 10, noseC);
      g.hline(11, 13, HY + 11, noseD);
    } else {
      g.hline(12, 13, HY + 10, noseC);
      g.px(12, HY + 11, noseD);
    }

    // Mund (Schnauzer ersetzt ggf. die Oberlippe)
    const mouthY = HY + 13;
    if (prm.mustache) {
      g.hline(9, 16, HY + 12, HC);
      g.px(9, HY + 13, HC); g.px(16, HY + 13, HC);
    }
    if (prm.mouth === 'grin') {
      if (!prm.mustache) g.hline(10, 15, mouthY - 1, OUT);
      g.px(9, mouthY, OUT); g.px(15, mouthY, OUT); // Mundwinkel
      g.hline(10, 14, mouthY, '#f6f2e4');
      g.px(12, mouthY, OUT); // Zahnlücke!
    } else if (prm.mouth === 'open') {
      g.rect(11, mouthY - 1, 4, 2, OUT);
      g.hline(11, 14, mouthY - 1, '#f6f2e4');
    } else if (prm.mouth === 'frown') {
      g.hline(11, 14, mouthY, OUT);
      g.px(10, mouthY - 1, OUT); g.px(15, mouthY - 1, OUT);
    } else { // smirk
      g.hline(11, 14, mouthY, OUT);
      g.px(15, mouthY - 1, OUT);
    }
    // Stoppeln
    if (prm.stubble) {
      g.dither(8, HY + 12, 3, 2, sk.d, prm.rnd, 0.4);
      g.dither(15, HY + 12, 3, 2, sk.d, prm.rnd, 0.4);
    }
    // Pflaster auf der Wange
    if (prm.plaster) { g.rect(15, HY + 9, 2, 2, '#e8d5a8'); g.px(15, HY + 9, '#c9b489'); }
    // Drahtbrille (Padre-Peng-Gedächtnismodell)
    if (prm.glasses) {
      g.hline(8, 11, eyeY - 1, OUT); g.hline(14, 17, eyeY - 1, OUT);
      g.px(8, eyeY, OUT); g.px(11, eyeY, OUT); g.px(14, eyeY, OUT); g.px(17, eyeY, OUT);
      g.hline(9, 10, eyeY + 2, OUT); g.hline(15, 16, eyeY + 2, OUT);
      g.hline(12, 13, eyeY, OUT); // Steg
    }
    // Heiligenschein fürs Maskottchen
    if (prm.halo) {
      g.hline(10, 15, 0, '#ffe9a0');
      g.px(9, 1, '#e8c94a'); g.px(16, 1, '#e8c94a');
      g.hline(11, 14, 1, '#c8922c');
    }

    // Fronthaar / Kopfbedeckung
    const hs = prm.hairStyle;
    if (hs === 'mullet' || hs === 'long') {
      g.blob([[0, 1, 12], [1, 0, 13], [2, 0, 13], [3, 0, 3], [3, 10, 13]], HX - 1, HY - 1, HC, OUT);
      g.px(HX + 3, HY + 3, HC); g.px(HX + 9, HY + 3, HC);
    } else if (hs === 'buzz') {
      g.blob([[0, 2, 9], [1, 0, 11], [2, 0, 11]], HX, HY, HC, OUT);
    } else if (hs === 'spiky') {
      g.blob([[0, 1, 1], [0, 4, 4], [0, 7, 7], [0, 10, 10], [1, 0, 11], [2, 0, 11], [3, 0, 11]], HX, HY - 1, HC, OUT);
    } else if (hs === 'curly') {
      g.blob([[0, 2, 9], [1, 0, 11], [2, -1, 12], [3, -1, 12], [4, 0, 2], [4, 9, 11]], HX, HY - 2, HC, OUT);
      g.dither(HX + 1, HY - 1, 10, 3, '#00000033', prm.rnd, 0); // (kein Effekt, Platzhalter)
    } else if (hs === 'bald') {
      g.rect(HX, HY + 4, 2, 2, HC); g.rect(HX + 10, HY + 4, 2, 2, HC);
      g.px(HX + 4, HY + 1, '#ffffff'); // Glanzpunkt
    } else if (hs === 'side') {
      g.blob([[0, 1, 10], [1, 0, 11], [2, 0, 5], [2, 8, 11], [3, 0, 2]], HX, HY, HC, OUT);
    } else if (hs === 'cap') {
      g.blob([[0, 2, 9], [1, 0, 11], [2, 0, 11], [3, 0, 11]], HX, HY - 1, prm.kit.j, OUT);
      g.hline(HX + 1, HX + 13, HY + 3, prm.kit.j2);
      g.hline(HX + 8, HX + 14, HY + 4, prm.kit.j2); // Schirm
      g.hline(HX + 8, HX + 14, HY + 5, OUT);
    }
    if (prm.headband) {
      g.hline(HX, HX + 11, HY + 4, '#e04848');
      g.hline(HX, HX + 11, HY + 5, '#b83030');
    }
  }

  function bustParams(rnd, opts) {
    const skin = pickR(rnd, SKINS);
    const hair = pickR(rnd, ['#57381d', '#7a4a22', '#3a2a1e', '#a3652a', '#c98f3a', '#20180f', '#8f8b80', '#a54a22']);
    const styles = opts.gk
      ? ['cap', 'cap', 'cap', 'mullet', 'curly', 'spiky', 'buzz']
      : ['mullet', 'mullet', 'mullet', 'buzz', 'spiky', 'curly', 'bald', 'side', 'long'];
    return {
      rnd,
      skin, hair,
      hairStyle: pickR(rnd, styles),
      browY: 3 + 6 + (rnd() < 0.5 ? 0 : -1), // HY+6/HY+5
      bushy: rnd() < 0.3,
      eyeStyle: pickR(rnd, ['normal', 'normal', 'droopy', 'droopy', 'squint']),
      look: rnd() < 0.5 ? 0 : 1,
      noseBig: rnd() < 0.6,
      redNose: rnd() < 0.35,
      mouth: pickR(rnd, ['grin', 'grin', 'smirk', 'open', 'frown']),
      mustache: rnd() < 0.45,
      stubble: rnd() < 0.35,
      plaster: !!opts.plaster || rnd() < 0.08,
      glasses: !!opts.glasses || rnd() < 0.08,
      halo: !!opts.halo,
      headband: !opts.gk && rnd() < 0.12,
      angry: !!opts.angry,
      armband: !!opts.armband,
      kit: opts.gk ? KIT_GK : KIT_YOU,
    };
  }

  // ---------- Porträt (26x30) ----------
  const portraitCache = new Map();
  function portraitURL(p) {
    const key = p.id + '|' + p.name + '|' + p.pos + '|' + (p.quirk || '');
    if (portraitCache.has(key)) return portraitCache.get(key);
    const c = makeCanvas(26, 30);
    const g = P(c.getContext('2d'));
    const rnd = rngFor(key);

    // Hintergrund: Dämmerungs-Halo
    g.rect(0, 0, 26, 30, '#22343c');
    g.disc(13, 12, 10, '#2d4a50');
    g.disc(13, 12, 7, '#38585c');
    g.rect(0, 28, 26, 2, '#1a2a30');
    // Eckpixel dunkel → wirkt gerundet
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [25, 0], [24, 0], [25, 1], [0, 29], [0, 28], [1, 29], [25, 29], [24, 29], [25, 28]]) {
      g.px(x, y, '#16232a');
    }

    const prm = bustParams(rnd, {
      gk: p.pos === 'TW',
      plaster: p.quirk === 'glaskinn',
      angry: p.quirk === 'rasenmaeher' || p.quirk === 'betonfuss',
      armband: p.quirk === 'kapitaen',
      glasses: p.quirk === 'lehrerliebling',
      halo: p.quirk === 'maskottchen',
    });
    if (p.ghost) { // Hausmeister Krause: grau, Glatze, missmutig
      prm.hairStyle = 'bald'; prm.hair = '#8f8b80'; prm.mouth = 'frown'; prm.mustache = true; prm.headband = false;
    }
    drawBust(g, prm);

    const url = c.toDataURL();
    portraitCache.set(key, url);
    return url;
  }

  // ---------- Held für den Titelbildschirm (40x58) ----------
  function heroURL(seed) {
    const c = makeCanvas(40, 58);
    const g = P(c.getContext('2d'));
    const rnd = rngFor(seed || 'held-nr-10');
    const sk = SKINS[0], HC = '#57381d', kit = KIT_YOU;
    const HX = 14, HY = 2;

    // Vokuhila hinten: oben hinterm Kopf versteckt, unten wallt die Matte raus
    g.blob([[0, 1, 12], [1, 1, 12], [2, 1, 12], [3, 1, 12], [4, 1, 12], [5, 1, 12], [6, 1, 12],
            [7, 0, 13], [8, 0, 13], [9, 0, 13], [10, 0, 13], [11, 0, 13], [12, 0, 13],
            [13, 1, 12], [14, 1, 12], [15, 2, 11], [16, 2, 11], [17, 3, 10]],
      HX - 1, HY + 2, HC, OUT);

    // Hals
    g.rect(HX + 4, HY + 14, 4, 3, sk.s);
    g.vline(HX + 3, HY + 14, HY + 16, OUT); g.vline(HX + 8, HY + 14, HY + 16, OUT);

    // Kopf
    g.blob(HEAD_SPANS, HX, HY, sk.b, OUT);
    g.vline(HX + 10, HY + 4, HY + 10, sk.s);
    // Ohren
    g.px(HX - 1, HY + 9, sk.b); g.px(HX - 2, HY + 9, OUT);
    g.px(HX + 12, HY + 9, sk.b); g.px(HX + 13, HY + 9, OUT);
    // Fronthaar (Vokuhila-Pony)
    g.blob([[0, 1, 12], [1, 0, 13], [2, 0, 13], [3, 0, 3], [3, 10, 13]], HX - 1, HY - 1, HC, OUT);
    // Gesicht: müde Augen, große rote Nase, Grinsen mit Zahnlücke, Schnauzer
    g.rect(HX + 2, HY + 7, 2, 2, '#f6f2e4'); g.rect(HX + 7, HY + 7, 2, 2, '#f6f2e4');
    g.px(HX + 3, HY + 8, OUT); g.px(HX + 8, HY + 8, OUT);
    g.hline(HX + 2, HX + 3, HY + 7, sk.s); g.hline(HX + 7, HX + 8, HY + 7, sk.s); // Schlafzimmerblick
    g.hline(HX + 2, HX + 4, HY + 6, HC); g.hline(HX + 7, HX + 9, HY + 6, HC);
    g.px(HX + 5, HY + 9, '#c96a4a'); g.hline(HX + 4, HX + 6, HY + 10, '#c96a4a'); g.hline(HX + 4, HX + 6, HY + 11, '#a84e34');
    // Schnauzer, darunter Grinsen mit Zahnlücke
    g.hline(HX + 2, HX + 9, HY + 12, HC);
    g.px(HX + 3, HY + 13, OUT); g.px(HX + 8, HY + 13, OUT);
    g.hline(HX + 4, HX + 7, HY + 13, '#f6f2e4'); g.px(HX + 6, HY + 13, OUT);

    // Rechter Arm (erhoben, Zeigefinger hoch) – aus Betrachtersicht rechts
    g.rect(29, 10, 3, 10, sk.b);                 // Unterarm hoch
    g.vline(28, 10, 19, OUT); g.vline(32, 10, 19, OUT);
    g.rect(29, 6, 2, 4, sk.b);                   // Zeigefinger
    g.vline(28, 6, 9, OUT); g.vline(31, 6, 9, OUT); g.hline(29, 30, 5, OUT);
    g.px(34, 4, OUT); g.px(35, 6, OUT); g.px(33, 2, OUT); // "Ping"-Funken
    g.rect(27, 19, 6, 4, kit.j);                 // Ärmel
    g.hline(27, 32, 18, kit.trim);
    g.vline(26, 19, 22, OUT); g.vline(33, 18, 22, OUT);

    // Torso (leichter Bierbauch)
    g.blob([[0, 2, 11], [1, 0, 13], [2, 0, 13], [3, 0, 13], [4, 0, 14], [5, 0, 14],
            [6, 0, 14], [7, 0, 14], [8, 1, 14], [9, 1, 14], [10, 1, 13]],
      13, 19, kit.j, OUT);
    g.rect(24, 22, 3, 6, kit.j2);
    g.hline(17, 22, 19, kit.trim);               // Kragen
    // Rückennummer 10 (weiß)
    g.vline(17, 23, 27, '#f6f2e4');
    g.px(16, 24, '#f6f2e4');
    g.rect(20, 23, 3, 5, '#f6f2e4'); g.px(21, 25, kit.j); g.px(21, 24, kit.j); g.px(21, 26, kit.j);
    // Bauch blitzt raus
    g.hline(16, 21, 29, sk.b); g.px(19, 29, sk.s);

    // Linker Arm: Hand in die Hüfte
    g.rect(9, 20, 4, 3, kit.j); g.hline(9, 13, 19, kit.trim);
    g.vline(8, 19, 22, OUT);
    g.rect(9, 23, 2, 4, sk.b); g.vline(8, 23, 26, OUT);
    g.rect(10, 27, 3, 2, sk.b); g.hline(9, 12, 29, OUT); g.px(9, 27, OUT);

    // Shorts
    g.blob([[0, 0, 12], [1, 0, 12], [2, 0, 12], [3, 0, 5], [3, 7, 12], [4, 0, 5], [4, 7, 12]],
      14, 30, '#2b2b33', OUT);
    g.vline(15, 31, 33, '#4a4a55'); g.px(20, 31, '#4a4a55'); // Kordel
    // Beine (dünn!)
    g.rect(16, 35, 3, 7, sk.b); g.vline(15, 35, 41, OUT); g.vline(19, 35, 41, OUT);
    g.rect(23, 35, 3, 7, sk.b); g.vline(22, 35, 41, OUT); g.vline(26, 35, 41, OUT);
    g.px(17, 38, '#c96a4a'); g.px(24, 39, '#c96a4a'); // aufgeschürfte Knie
    // Stutzen
    g.rect(16, 42, 3, 6, '#f2ede0'); g.vline(15, 42, 47, OUT); g.vline(19, 42, 47, OUT);
    g.rect(23, 42, 3, 6, '#f2ede0'); g.vline(22, 42, 47, OUT); g.vline(26, 42, 47, OUT);
    g.hline(16, 18, 43, '#b5301f'); g.hline(23, 25, 43, '#b5301f');
    // Schuhe
    g.blob([[0, 0, 4], [1, -2, 5], [2, -2, 5]], 15, 48, '#3d2c22', OUT);
    g.blob([[0, 1, 5], [1, 1, 8], [2, 1, 8]], 22, 48, '#3d2c22', OUT);
    g.px(14, 51, OUT); g.px(17, 51, OUT); g.px(25, 51, OUT); g.px(28, 51, OUT); // Stollen
    // Grasbüschel
    g.px(13, 51, '#3f7a38'); g.px(20, 52, '#3f7a38'); g.px(30, 51, '#3f7a38'); g.px(31, 52, '#2f6b33');

    void rnd;
    return c.toDataURL();
  }

  // ---------- Feuerball Fred: moppeliger Kicker mit Nr. 13 (46x58) ----------
  function heroFredURL() {
    const c = makeCanvas(46, 58);
    const g = P(c.getContext('2d'));
    const sk = SKINS[1], HC = '#4a3018', kit = KIT_YOU;
    const HX = 10, HY = 2;

    // Kopf
    g.blob(HEAD_SPANS, HX, HY, sk.b, OUT);
    g.vline(HX + 10, HY + 4, HY + 10, sk.s);
    // Strubbelhaar
    g.blob([[0, 2, 2], [0, 5, 5], [0, 8, 8], [0, 11, 11], [1, 1, 12], [2, 0, 12], [3, 0, 12], [4, 10, 12]],
      HX, HY - 2, HC, OUT);
    // Ohr links
    g.px(HX - 1, HY + 9, sk.b); g.px(HX - 2, HY + 9, OUT);
    // Fröhliche Kulleraugen
    g.rect(HX + 3, HY + 6, 2, 3, '#f6f2e4'); g.rect(HX + 8, HY + 6, 2, 3, '#f6f2e4');
    g.px(HX + 4, HY + 7, OUT); g.px(HX + 9, HY + 7, OUT);
    g.hline(HX + 3, HX + 5, HY + 5, HC); g.hline(HX + 8, HX + 10, HY + 5, HC);
    // Rote Knubbelnase
    g.hline(HX + 5, HX + 7, HY + 10, '#c96a4a'); g.px(HX + 6, HY + 9, '#e0846a'); g.hline(HX + 5, HX + 7, HY + 11, '#a84e34');
    // Breites Lachen mit Zahnlücken
    g.hline(HX + 3, HX + 9, HY + 12, OUT);
    g.hline(HX + 3, HX + 8, HY + 13, '#f6f2e4');
    g.px(HX + 5, HY + 13, OUT); g.px(HX + 8, HY + 13, OUT);

    // Hals (verbindet Kopf und Trikot)
    g.rect(15, 15, 4, 3, sk.s);
    g.vline(14, 15, 17, OUT); g.vline(19, 15, 17, OUT);

    // Linker Arm: nach hinten geschwungen (Faust)
    g.rect(2, 22, 8, 3, sk.b);
    g.hline(1, 9, 21, OUT); g.hline(2, 9, 25, OUT);
    g.rect(1, 20, 3, 4, sk.b); g.px(0, 21, OUT); g.px(0, 22, OUT); g.px(1, 19, OUT); g.px(3, 19, OUT);
    g.rect(10, 20, 5, 5, kit.j); g.vline(9, 20, 25, OUT);

    // Rechter Arm: nach vorn (offene Hand)
    g.rect(32, 20, 9, 3, sk.b);
    g.hline(31, 41, 19, OUT); g.hline(32, 40, 23, OUT);
    g.rect(41, 18, 3, 4, sk.b); g.vline(44, 18, 21, OUT); g.hline(41, 43, 17, OUT); g.px(40, 22, OUT);
    g.rect(29, 19, 4, 5, kit.j); g.vline(28, 19, 24, OUT);

    // Moppeliger Torso, Trikot spannt
    g.blob([[0, 3, 12], [1, 1, 14], [2, 0, 15], [3, 0, 16], [4, 0, 17], [5, 0, 17], [6, 0, 18],
            [7, 0, 18], [8, 0, 18], [9, 1, 18], [10, 1, 18], [11, 2, 17], [12, 3, 16]],
      13, 17, kit.j, OUT);
    g.rect(27, 20, 3, 8, kit.j2);
    g.hline(17, 23, 17, kit.trim); // Kragen
    // Nummer 13
    g.vline(18, 21, 26, '#f6f2e4'); g.px(17, 22, '#f6f2e4');
    g.rect(21, 21, 3, 6, '#f6f2e4');
    g.px(21, 22, kit.j); g.px(21, 25, kit.j); // "3"-Lücken links
    // Flammen-Tattoo am Ärmel (Andeutung)
    g.px(30, 21, '#e8632c'); g.px(31, 20, '#ffd34d'); g.px(30, 22, '#c93a1e');
    // Bauch blitzt unten raus
    g.hline(17, 27, 29, sk.b); g.hline(18, 26, 30, sk.b); g.px(22, 30, sk.d); g.hline(17, 27, 31, OUT);

    // Shorts
    g.blob([[0, 0, 11], [1, 0, 12], [2, 0, 12], [3, 0, 4], [3, 8, 12], [4, 0, 4], [4, 8, 13]],
      15, 32, '#2b2b33', OUT);
    g.vline(16, 33, 35, '#4a4a55');
    // Standbein (links, unter dem Körper)
    g.rect(17, 37, 3, 6, sk.b); g.vline(16, 37, 42, OUT); g.vline(20, 37, 42, OUT);
    g.rect(17, 43, 3, 6, '#f2ede0'); g.vline(16, 43, 48, OUT); g.vline(20, 43, 48, OUT);
    g.hline(17, 19, 44, '#b5301f');
    g.blob([[0, 0, 4], [1, -2, 5], [2, -2, 5]], 16, 49, '#3d2c22', OUT);
    g.px(15, 52, OUT); g.px(18, 52, OUT); // Stollen
    // Schussbein (rechts, in einem Stück zum Ball gestreckt)
    g.blob([[0, 0, 6], [1, 1, 7], [2, 3, 8], [3, 5, 9]], 27, 37, sk.b, OUT);
    g.px(30, 38, '#c96a4a'); // Schürfwunde
    g.blob([[0, 0, 4], [1, 1, 5], [2, 2, 6]], 34, 41, '#2f5da8', OUT); // blauer Stutzen
    g.hline(36, 37, 41, '#f2ede0');
    g.blob([[0, 0, 6], [1, 0, 7], [2, 1, 7]], 37, 44, '#3d2c22', OUT); // Schuh
    g.px(39, 47, OUT); g.px(42, 47, OUT); // Stollen

    // Ball mit Dreckspritzern
    drawMiniBall(g, 42, 52);
    g.px(36, 50, '#8a5a32'); g.px(34, 48, '#8a5a32'); g.px(38, 42, '#6e4420');
    // Gras
    g.px(14, 52, '#3f7a38'); g.px(21, 53, '#3f7a38'); g.hline(39, 45, 56, '#2f6b33'); g.px(38, 55, '#3f7a38'); g.px(45, 55, '#3f7a38');

    return c.toDataURL();
  }

  // ---------- Padre Peng: der segnende Libero (42x58) ----------
  function heroPadreURL() {
    const c = makeCanvas(42, 58);
    const g = P(c.getContext('2d'));
    const sk = SKINS[0], HC = '#4a3018';
    const CAS = '#26262e', CAS_HI = '#3d3d48';
    const HX = 15, HY = 2;

    // Heiligenschein (schwebt mit Abstand über der Glatze)
    g.hline(17, 24, 0, '#ffe9a0');
    g.px(16, 0, '#c8922c'); g.px(25, 0, '#c8922c');
    // Funkeln
    g.px(9, 6, '#ffe9a0'); g.px(33, 9, '#ffe9a0'); g.px(11, 14, '#e8c94a');

    // Kopf
    g.blob(HEAD_SPANS, HX, HY, sk.b, OUT);
    g.vline(HX + 10, HY + 4, HY + 10, sk.s);
    // Haarkranz + einzelne Wirbel oben
    g.rect(15, 9, 2, 4, HC); g.rect(25, 9, 2, 4, HC);
    g.px(15, 8, OUT); g.px(26, 8, OUT);
    // Runde Brille, selig geschlossene Augen
    g.hline(17, 20, 7, OUT); g.hline(22, 25, 7, OUT);
    g.px(17, 8, OUT); g.px(20, 8, OUT); g.px(22, 8, OUT); g.px(25, 8, OUT);
    g.hline(18, 19, 10, OUT); g.hline(23, 24, 10, OUT);
    g.px(21, 8, OUT); // Steg
    g.hline(18, 19, 9, OUT); g.hline(23, 24, 9, OUT); // zufriedene Schlitzaugen
    // Knubbelnase, rot
    g.rect(20, 10, 2, 2, '#c96a4a'); g.px(20, 10, '#e0846a'); g.hline(20, 21, 12, '#a84e34');
    // Mildes Lächeln
    g.px(18, 13, OUT); g.hline(19, 22, 14, OUT); g.px(23, 13, OUT);

    // Soutane: glockenförmig, wallend
    const bell = [];
    for (let r = 0; r <= 28; r++) {
      const spread = Math.min(14, 8 + Math.floor(r / 2.2));
      bell.push([r, 15 - spread, 14 + spread]);
    }
    g.blob(bell, 6, 16, CAS, OUT);
    // Faltenwurf
    g.vline(14, 26, 40, CAS_HI); g.vline(23, 24, 42, CAS_HI); g.vline(30, 30, 41, CAS_HI);
    g.hline(10, 33, 43, '#17171d');
    // Kollar
    g.rect(19, 17, 4, 2, '#f2ede0'); g.px(20, 17, CAS);

    // Rosenkranz
    for (const [rx, ry] of [[19, 21], [18, 23], [17, 25], [17, 27], [17, 29], [18, 31], [19, 33], [20, 35]]) g.px(rx, ry, '#7a4a22');
    g.rect(20, 36, 1, 3, '#e8c94a'); g.hline(19, 21, 37, '#e8c94a'); // Kreuz

    // Rechter Arm: erhoben zum Segensgruß (zwei Finger)
    g.rect(28, 14, 4, 6, CAS); g.vline(27, 14, 19, OUT); g.vline(32, 14, 19, OUT);
    g.hline(28, 31, 13, '#f2ede0'); // Manschette
    g.rect(28, 9, 4, 4, sk.b); g.vline(27, 9, 12, OUT); g.vline(32, 9, 12, OUT);
    g.rect(28, 5, 1, 4, sk.b); g.rect(30, 5, 1, 4, sk.b); // zwei Finger
    g.px(29, 6, OUT); g.vline(27, 5, 8, OUT); g.vline(31, 5, 8, OUT); g.hline(28, 30, 4, OUT);

    // Linker Arm: locker ausgestreckt
    g.rect(6, 21, 5, 4, CAS); g.hline(5, 10, 20, OUT); g.hline(5, 10, 25, OUT);
    g.vline(6, 21, 24, '#f2ede0');
    g.rect(3, 21, 3, 4, sk.b); g.vline(2, 21, 24, OUT); g.px(3, 20, OUT); g.px(2, 25, OUT);

    // Beine mit Schürfwunden, Stutzen, Schuhe
    g.rect(14, 45, 3, 3, sk.b); g.vline(13, 45, 47, OUT); g.vline(17, 45, 47, OUT);
    g.rect(24, 45, 3, 3, sk.b); g.vline(23, 45, 47, OUT); g.vline(27, 45, 47, OUT);
    g.px(15, 46, '#c96a4a');
    g.rect(14, 48, 3, 5, '#f2ede0'); g.vline(13, 48, 52, OUT); g.vline(17, 48, 52, OUT);
    g.rect(24, 48, 3, 5, '#f2ede0'); g.vline(23, 48, 52, OUT); g.vline(27, 48, 52, OUT);
    g.hline(14, 16, 49, '#8f8b80'); g.hline(24, 26, 49, '#8f8b80');
    g.blob([[0, 0, 4], [1, -2, 5], [2, -2, 5]], 13, 53, '#3d2c22', OUT);
    g.blob([[0, 0, 4], [1, 0, 6], [2, 0, 6]], 23, 53, '#3d2c22', OUT);
    g.px(12, 56, OUT); g.px(15, 56, OUT); g.px(25, 56, OUT); g.px(28, 56, OUT);

    // Ball wartet ehrfürchtig daneben
    drawMiniBall(g, 36, 53);
    g.px(11, 56, '#3f7a38'); g.px(19, 57, '#3f7a38'); g.px(31, 57, '#3f7a38'); g.px(40, 56, '#2f6b33');

    return c.toDataURL();
  }

  // ---------- Vereinswappen (18x20) ----------
  const crestCache = new Map();
  function crestURL(name) {
    if (crestCache.has(name)) return crestCache.get(name);
    const c = makeCanvas(18, 20);
    const g = P(c.getContext('2d'));
    const rnd = rngFor('crest|' + name);
    const [c1, c2] = pickR(rnd, CREST_COLORS);
    const style = pickR(rnd, ['half', 'bands', 'diag', 'plain']);
    // Schildform
    const spans = [];
    spans.push([0, 1, 14]);
    for (let y = 1; y <= 9; y++) spans.push([y, 0, 15]);
    spans.push([10, 1, 14]); spans.push([11, 1, 14]);
    spans.push([12, 2, 13]); spans.push([13, 3, 12]);
    spans.push([14, 4, 11]); spans.push([15, 5, 10]); spans.push([16, 6, 9]); spans.push([17, 7, 8]);
    g.blob(spans, 1, 1, c1, OUT);
    // Muster im Schild-Inneren
    const inShield = (x, y) => {
      const row = spans.find(s => s[0] === y - 1);
      return row && x - 1 >= row[1] + 1 && x - 1 <= row[2] - 1;
    };
    for (let y = 2; y <= 17; y++) for (let x = 2; x <= 15; x++) {
      if (!inShield(x, y)) continue;
      let paint = false;
      if (style === 'half') paint = x >= 9;
      else if (style === 'bands') paint = ((x - 2) % 4) >= 2;
      else if (style === 'diag') paint = ((x + y) % 6) >= 3;
      if (paint) g.px(x, y, c2);
    }
    // Symbol: Ball oder Stern
    const sym = pickR(rnd, ['ball', 'ball', 'star', 'none']);
    if (sym === 'ball') {
      g.disc(8.5, 8, 3, '#f6f2e4');
      g.ring(8.5, 8, 3, OUT);
      g.px(8, 8, OUT); g.px(9, 7, OUT); g.px(7, 7, OUT); g.px(9, 9, OUT);
    } else if (sym === 'star') {
      g.px(8, 5, '#e8c94a'); g.hline(7, 9, 6, '#e8c94a'); g.hline(6, 10, 7, '#e8c94a');
      g.hline(7, 9, 8, '#e8c94a'); g.px(7, 9, '#e8c94a'); g.px(9, 9, '#e8c94a');
    }
    // Oberkante Zierband
    g.hline(2, 15, 2, '#f6f2e4');
    const url = c.toDataURL();
    crestCache.set(name, url);
    return url;
  }

  // ---------- Abendlicher Bolzplatz als Hintergrund (192x108) ----------
  function backdropCanvas() {
    const c = makeCanvas(192, 108);
    const g = P(c.getContext('2d'));
    const rnd = rngFor('bolzplatz-abend');
    // Himmel in VGA-Bändern
    const bands = [
      [0, 10, '#1d1c3d'], [10, 18, '#33254f'], [18, 26, '#552c55'],
      [26, 33, '#7c3450'], [33, 39, '#a34544'], [39, 45, '#c65f36'], [45, 52, '#e08a3c'],
    ];
    for (const [y1, y2, col] of bands) g.rect(0, y1, 192, y2 - y1, col);
    // Sterne
    for (let i = 0; i < 26; i++) g.px(Math.floor(rnd() * 192), Math.floor(rnd() * 16), i % 3 ? '#8f86b8' : '#d8d2ee');
    // Sonne, tief über der Skyline
    g.disc(108, 37, 4, '#ffd98a'); g.disc(108, 37, 2, '#fff2c8');
    g.hline(100, 116, 42, '#e8a44f'); g.hline(102, 114, 44, '#d87a3c');
    // Bauschige Wolkenbänke (Ton in Ton mit dem Himmelsband)
    for (const [x, y, w] of [[12, 27, 26], [58, 33, 36], [126, 29, 22], [26, 43, 34], [146, 40, 24]]) {
      const light = y < 33 ? '#7a4468' : (y < 39 ? '#b05a54' : '#e08a4f');
      const core = y < 33 ? '#69395c' : (y < 39 ? '#a04c48' : '#d47a42');
      g.hline(x + 4, x + w - 4, y - 1, light);
      g.hline(x, x + w, y, core);
      g.hline(x + 7, x + w - 9, y + 1, core);
    }
    // Silhouette: Dächer, Kirchturm, Bäume
    const sil = '#1a1330';
    g.rect(0, 52, 192, 6, sil);
    let x = 0;
    while (x < 192) {
      const w = 8 + Math.floor(rnd() * 16);
      if (rnd() < 0.35) {
        // Baumkrone/Busch statt Haus, sitzt direkt auf dem Horizont
        const r = 2 + Math.floor(rnd() * 3);
        g.disc(x + r + 1, 52 - r, r, sil);
        x += r * 2 + 4;
        continue;
      }
      const h = 3 + Math.floor(rnd() * 8);
      g.rect(x, 52 - h, w, h, sil);
      if (rnd() < 0.4) g.px(x + Math.floor(w / 2), 52 - h - 1, sil); // Schornstein
      // Fensterlichter
      if (rnd() < 0.7) g.px(x + 2 + Math.floor(rnd() * (w - 3)), 52 - Math.floor(h / 2), '#ffd98a');
      x += w + Math.floor(rnd() * 4);
    }
    // Kirchturm
    g.rect(28, 34, 6, 18, sil); g.blob([[0, 2, 3], [1, 1, 4], [2, 0, 5]], 28, 31, sil, sil);
    g.px(31, 29, sil); g.px(31, 28, sil); g.hline(30, 32, 29, sil);
    // Flutlichtmasten
    for (const px_ of [16, 176]) {
      g.vline(px_, 26, 57, '#241a38');
      g.hline(px_ - 3, px_ + 3, 26, '#241a38');
      for (const lx of [px_ - 3, px_, px_ + 3]) { g.px(lx, 25, '#fff2a0'); g.px(lx, 24, '#e8c46a'); }
    }
    // Rasen mit Mähstreifen
    for (let yy = 58; yy < 108; yy++) {
      for (let xx = 0; xx < 192; xx++) {
        const stripe = Math.floor(xx / 16) % 2 === 0;
        const deep = yy > 84;
        g.px(xx, yy, stripe ? (deep ? '#2a5e2d' : '#31702f') : (deep ? '#255228' : '#2c6329'));
      }
    }
    // Kreidelinien
    g.hline(0, 191, 62, '#e0decba0');
    g.ring(96, 96, 22, '#e0decba0'); g.ring(96, 96, 21, '#e0decb50');
    // Grasbüschel + Details
    for (let i = 0; i < 40; i++) {
      const gx = Math.floor(rnd() * 192), gy = 64 + Math.floor(rnd() * 42);
      g.px(gx, gy, '#3f7a38');
      if (rnd() < 0.3) g.px(gx + 1, gy, '#4a8a3e');
    }
    // Vergessener Ball am Spielfeldrand
    drawMiniBall(g, 170, 100);
    return c;
  }

  // ---------- Mini-Spielfeld fürs Match (168x64) ----------
  function makePitchCanvas() { return makeCanvas(168, 64); }

  function drawPitch(canvas, m) {
    const g = P(canvas.getContext('2d'));
    const rnd = rngFor('pitch|' + (m ? m.opp.name : ''));
    // Rasen
    for (let y = 0; y < 64; y++) for (let x = 0; x < 168; x++) {
      const stripe = Math.floor(x / 14) % 2 === 0;
      g.px(x, y, stripe ? '#2f6b33' : '#2a5e2d');
    }
    // Abgewetzte Stellen (Kreisklasse!)
    for (let i = 0; i < 26; i++) {
      const bx = 10 + Math.floor(rnd() * 148), by = 6 + Math.floor(rnd() * 52);
      g.px(bx, by, '#57642e');
      if (rnd() < 0.5) g.px(bx + 1, by, '#4a5a2c');
    }
    const chalk = '#e6e3d0';
    // Außenlinien / Mittellinie / -kreis
    g.hline(4, 163, 3, chalk); g.hline(4, 163, 60, chalk);
    g.vline(4, 3, 60, chalk); g.vline(163, 3, 60, chalk);
    g.vline(84, 3, 60, chalk);
    g.ring(84, 32, 10, chalk);
    // Strafräume
    g.rect(4, 17, 1, 30, chalk); g.vline(24, 17, 46, chalk); g.hline(4, 24, 17, chalk); g.hline(4, 24, 46, chalk);
    g.vline(143, 17, 46, chalk); g.hline(143, 163, 17, chalk); g.hline(143, 163, 46, chalk);
    // Tore
    g.rect(1, 24, 3, 16, '#00000000');
    g.vline(1, 24, 40, chalk); g.hline(1, 4, 24, chalk); g.hline(1, 4, 40, chalk);
    g.vline(166, 24, 40, chalk); g.hline(163, 166, 24, chalk); g.hline(163, 166, 40, chalk);
    if (!m) return;
    // Spieler als Mini-Kicker (du: rot, links; Gegner: seeded Farbe, rechts)
    const oppCol = pickR(rngFor('kit|' + m.opp.name), ['#25569a', '#e8c94a', '#f2f2f2', '#26262e', '#8a4a9a', '#c86a1f']);
    const yours = [[20, 32], [45, 16], [45, 48], [70, 26], [70, 40], [98, 32]];
    const theirs = [[148, 32], [123, 16], [123, 48], [98, 20], [98, 44], [70, 32]];
    const spr = (x, y, col) => {
      g.px(x, y - 3, '#3a2a1e');  // Haarschopf
      g.px(x, y - 2, '#e8b07a');  // Kopf
      g.rect(x - 1, y - 1, 3, 2, col); // Körper
      g.px(x - 1, y + 1, OUT); g.px(x + 1, y + 1, OUT); // Beine
    };
    for (const [x, y] of yours) spr(x, y, '#c0392b');
    for (const [x, y] of theirs) spr(x, y, oppCol);
    // Ball je nach Zone/Seite
    const zone = m.ball ? m.ball.zone : 1;
    const youHave = m.ball && m.ball.side === 'you';
    const bx = youHave ? [40, 84, 130][zone] : [128, 84, 38][zone];
    const by = 32 + Math.round(Math.sin(hashStr(zone + '' + (m.minute | 0)) % 7) * 6);
    g.ring(bx, by, 4, '#ffd34d');
    g.disc(bx, by, 1, '#f6f2e4'); g.px(bx, by, '#c9c4b0');
  }

  // ---------- Pokal (für den Sieg-Screen, 22x26) ----------
  function trophyURL() {
    const c = makeCanvas(22, 26);
    const g = P(c.getContext('2d'));
    const gold = '#e8c94a', gd = '#b8942c';
    g.blob([[0, 2, 13], [1, 2, 13], [2, 2, 13], [3, 2, 13], [4, 3, 12], [5, 4, 11], [6, 5, 10], [7, 6, 9]],
      3, 3, gold, OUT);
    g.px(2, 4, OUT); g.px(1, 5, OUT); g.px(1, 6, OUT); g.px(2, 7, OUT); // Henkel links
    g.px(19, 4, OUT); g.px(20, 5, OUT); g.px(20, 6, OUT); g.px(19, 7, OUT);
    g.vline(6, 4, 6, '#fff2c8');
    g.rect(9, 11, 4, 3, gd); g.px(8, 11, OUT); g.px(13, 11, OUT);
    g.blob([[0, 0, 7], [1, 0, 7]], 7, 14, gold, OUT);
    g.blob([[0, 0, 11], [1, 0, 11], [2, 0, 11]], 5, 16, '#6e4420', OUT);
    g.hline(6, 15, 17, '#8a5a32');
    g.hline(3, 18, 20, '#3f7a38'); g.px(2, 21, '#3f7a38'); g.px(19, 21, '#2f6b33');
    return c.toDataURL();
  }

  // ---------- Kleiner Pixel-Ball (für Logo/Deko, 12x12) ----------
  function ballURL() {
    const c = makeCanvas(12, 12);
    const g = P(c.getContext('2d'));
    g.disc(5.5, 5.5, 4.6, '#f6f2e4');
    g.ring(5.5, 5.5, 5, OUT);
    // Fünfeck in der Mitte + Nähte
    g.rect(5, 5, 2, 2, OUT); g.px(4, 4, OUT); g.px(7, 4, OUT);
    g.px(5, 2, OUT); g.px(6, 2, OUT);   // Panel oben
    g.px(2, 5, OUT); g.px(9, 5, OUT);   // seitlich
    g.px(4, 8, OUT); g.px(7, 8, OUT);   // unten
    g.px(3, 3, '#ffffff'); g.px(3, 8, '#c9c4b0'); g.px(8, 8, '#c9c4b0');
    return c.toDataURL();
  }

  root.SoccerArt = {
    portraitURL, heroURL, heroFredURL, heroPadreURL, crestURL, trophyURL, ballURL,
    backdropCanvas, makePitchCanvas, drawPitch,
  };
})(typeof self !== 'undefined' ? self : this);
