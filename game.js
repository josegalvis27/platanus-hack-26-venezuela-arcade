// Platanus Hack 26 — Caracas Edition
// ¡TROMPAZO! Duelo de trompos criollo. Enrolla el pabilo, lanza y saca al rival de la rueda.
(() => {
const { PI, abs, atan2, ceil, cos, exp, floor, hypot, max, min, pow, random, round, sign, sin } = Math;
const GP = Phaser.GameObjects.Graphics.prototype;
GP.fs = GP.fillStyle;
GP.fr = GP.fillRect;
GP.fe = GP.fillEllipse;
GP.ls = GP.lineStyle;
GP.lb = GP.lineBetween;
GP.fc = GP.fillCircle;
GP.fp = GP.fillPoints;
GP.se = GP.strokeEllipse;
GP.frr = GP.fillRoundedRect;
const W = 800;
const H = 600;
const CX = 400;
const CY = 352;
const R0 = 236;
const K = 0.58; // aplastado del piso (vista 3/4)
const KZ = 0.82; // altura en pantalla
const TAU = PI * 2;
const STORAGE_KEY = 'trompo-wars-ph26-top5';
const MAX_HIGH_SCORES = 5;
const FONT = '"Arial Black", "Trebuchet MS", Impact, sans-serif';
const HX = [90, 710];
const YMIN = CY - (CY - 140) / K;
const YMAX = CY + (H - 30 - CY) / K;

// DO NOT replace existing keys — they match the physical arcade cabinet wiring.
// To add local testing shortcuts, append extra keys to any array.
const CABINET_KEYS = {
  P1_U: ['w'],
  P1_D: ['s'],
  P1_L: ['a'],
  P1_R: ['d'],
  P1_1: ['u'],
  P1_2: ['i'],
  P1_3: ['o'],
  P1_4: ['j'],
  P1_5: ['k'],
  P1_6: ['l'],
  P2_U: ['ArrowUp'],
  P2_D: ['ArrowDown'],
  P2_L: ['ArrowLeft'],
  P2_R: ['ArrowRight'],
  P2_1: ['r'],
  P2_2: ['t'],
  P2_3: ['y'],
  P2_4: ['f'],
  P2_5: ['g'],
  P2_6: ['h'],
  START1: ['Enter'],
  START2: ['2'],
};

const KEYBOARD_TO_ARCADE = {};
for (const [arcadeCode, keys] of Object.entries(CABINET_KEYS)) {
  for (const key of keys) {
    KEYBOARD_TO_ARCADE[normalizeIncomingKey(key)] = arcadeCode;
  }
}

// ---------------------------------------------------------------------------
// Datos del juego
// ---------------------------------------------------------------------------

// st = [velocidad, peso, aguante] (1..5) · s = especial del botón [3]
const TYPES = [
  { n: 'EL PAVITO', d: 'Liviano y rapidito, pica como avispa', c: [0xffcc00, 0x1d4fd8, 0xe8202a], r: 23, m: 0.8, acc: 1.28, dec: 1.1, dash: 1.12, st: [5, 2, 2], s: ['CHUPA', '¡CHUPAGIRO!', 'Si lo tocas le robas giro'] },
  { n: 'EL ZUMBADOR', d: 'Parejo: ni muy muy, ni tan tan', c: [0x1fcf6a, 0xfff6dc, 0xff7a00], r: 25, m: 1, acc: 1, dec: 0.95, dash: 1, st: [3, 3, 3], s: ['ZUMBA', '¡ZUMBIDO!', 'Arranque a millón por 2 segundos'] },
  { n: 'EL MACIZO', d: 'Pesado como nevera de abasto', c: [0x8a3dff, 0xffd23f, 0x2a2340], r: 28, m: 1.45, acc: 0.8, dec: 0.95, dash: 0.95, st: [2, 5, 3], s: ['PISÓN', '¡PISÓN!', 'Brinca y empuja todo al caer'] },
  { n: 'LA CHUPETA', d: 'Gira y gira... y no se cansa nunca', c: [0xff4fb0, 0x6ff5ff, 0xfff6dc], r: 24, m: 0.95, acc: 0.95, dec: 0.62, dash: 0.86, st: [3, 2, 5], s: ['ZIGZAG', '¡ZIGZAG!', 'Esquiva y se vuelve fantasma'] },
  { n: 'EL CHUZO', d: 'Punta de clavo largo: pica y raja', c: [0x3ad1c4, 0x14213d, 0xffd23f], r: 24, m: 1.05, acc: 1.05, dec: 1, dash: 1.2, st: [4, 3, 2], s: ['PUYA', '¡PUYAZO!', 'Tu próximo golpe le saca el triple'] },
  { n: 'EL REMOLINO', d: 'Gordito y terco, se chupa la rueda', c: [0x00b4d8, 0xffffff, 0x0d3b66], r: 26, m: 1.15, acc: 0.9, dec: 0.85, dash: 0.95, st: [2, 4, 4], s: ['JALA', '¡REMOLINO!', 'Jala al rival hacia ti'] },
];
const NT = TYPES.length;
// terrenos: n = nombre, b = piso, p = piedritas, f = roce, d = cuánto frena el giro
const TER = [
  { n: 'LA CALLE', h: 'ASFALTO PAREJO', b: 0x3a393c, p: [0x2b2a2e, 0x46454a, 0x525057, 0x333236, 0x5f5c62, 0x6a6560], f: 1, d: 1 },
  { n: 'LA CANCHA DE TIERRA', h: 'LA TIERRA FRENA EL TROMPO', b: 0x6e4a2e, p: [0x5a3b22, 0x7d5636, 0x8c6440, 0x4e331d, 0x9a7350, 0x664226], f: 1.6, d: 1.3 },
  { n: 'EL PATIO DE GRANITO', h: '¡RESBALA COMO JABÓN!', b: 0x56605c, p: [0xe8e4da, 0x2a2c2b, 0xb04a3a, 0x7d8a84, 0x3d4542, 0xc9c2b0], f: 0.5, d: 0.8 },
];
const SPT = [3.2, 1.8, 0.4, 0.9, 2.5, 1.6]; // duración del especial
const CDS = [1, 6, 8]; // enfriamiento de [1] [2] [3]
const LOCO_T = 3.2;
const SUP = 0.8; // duración del corte del súper

// [nombre, barrio, tipo, dificultad, frase]
const RIVALS = [
  ['EL CHAMO NENO', 'CATIA', 1, 0.12, '¡Mi mamá me dio permiso hasta las 6!'],
  ['LA GOCHA', 'LA PASTORA', 3, 0.3, '¡Ay, mijo, no me haga reír!'],
  ['EL PELÚO', 'PETARE', 5, 0.48, '¡Epa, chamo, aquí se juega duro!'],
  ['DOÑA CHEPA', 'EL VALLE', 2, 0.64, '¡Yo jugaba trompo antes que tú nacieras!'],
  ['EL CATIRE', 'ANTÍMANO', 4, 0.8, '¡Te voy a dejar sin pabilo, pana!'],
  ['EL MAESTRO', 'LA VEGA', 2, 0.97, '¡En mi rueda mando yo!'],
];

const HIT_LINES = ['¡TROMPAZO!', '¡CHAMO, QUÉ TROMPAZO!', '¡LE DISTE DURO!', '¡TOMA, PAPÁ!', '¡ESO, ASÍ ES!', '¡UFFF!', '¡ZAS!'];
const WIN_LINES = ['¡QUÉ NIVEL!', '¡ERES UN DURO!', '¡SE LA COMIÓ!', '¡ASÍ SE JUEGA EN CARACAS!'];
// Melodía tipo gaita: 8 compases x 6 corcheas, grados de Re mayor ('.' = silencio)
const MEL = ['4.24.7', '5.35.8', '4.64.1', '2.0...', '7.97.4', '8.58.5', '6.46.1', '7..4..'];
const SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
const ROOTS = [0, 5, 7, 0, 0, 5, 7, 0];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789*-.';
const CW = '#ffffff';
const CY1 = '#ffe066';
const CR = '#ff6f6f';
const CG = '#7dff6a';
const CP = '#ff8fb8';
const CK = '#f4f1ea';
const DUST = [0x8a877f, 0xf4f1ea, 0x5f5c62];
const TRI = [0xffcc00, 0x1d4fd8, 0xe8202a];

// ---------------------------------------------------------------------------
// Estado global
// ---------------------------------------------------------------------------

let sc = null; // escena
let CAM = null; // cámara
let g = null; // gráficos del mundo
let og = null; // gráficos del HUD
let CT = null; // controles
let AC = null; // audio
let SB = null; // bus de efectos
let MUS = null; // bus de música
let NB = null; // ruido blanco
const HUMS = [];
const CHALK = [];

const S = {
  md: 'title',
  t: 0,
  pool: [],
  pi: 0,
  pt: [],
  pops: [],
  ps: [],
  R: R0,
  ph: 'launch',
  rt: 0,
  lt: 0,
  et: 0,
  stop: 0,
  slow: 0,
  msg: null,
  tw: false,
  dm: true,
  lv: 0,
  score: 0,
  need: 2,
  round: 1,
  menu: 0,
  idle: 0,
  sel: [0, 2],
  rdy: [false, false],
  board: [],
  boardOk: false,
  hi: -1,
  name: [0, 0, 0],
  slot: 0,
  mt: 0,
  ms: 0,
  sd: false,
  chapa: null,
  chT: 0,
  navT: [0, 0, 0, 0],
  navR: [0, 0, 0, 0],
  mwin: -1,
  mendT: 0,
  vsT: 0,
  saveMsg: '',
  champ: false,
  rv: 0,
  bE: 0,
  ter: -1,
  flash: 0,
};

new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game-root',
  backgroundColor: '#2a292d',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
  scene: { create, update },
});

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function rnd(a, b) {
  return a + random() * (b - a);
}
function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
function pick(a) {
  return a[floor(random() * a.length)];
}
function hex(c) {
  return '#' + c.toString(16).padStart(6, '0');
}
function lerpC(a, b, t) {
  const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t;
  const gg = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t;
  const bb = (a & 255) + ((b & 255) - (a & 255)) * t;
  return ((r | 0) << 16) | ((gg | 0) << 8) | (bb | 0);
}
// piso del mundo -> pantalla
function Y(y) {
  return CY + (y - CY) * K;
}
function held(c) {
  return CT.held[c] === true;
}
function jp(c) {
  return CT.pressed[c] === true;
}
function anyJ(list) {
  for (const c of list) if (jp(c)) return true;
  return false;
}
function anyKey() {
  for (const k in CT.pressed) if (CT.pressed[k]) return true;
  return false;
}
function pad(n, l) {
  return String(n).padStart(l, '0');
}
function act(p, t) {
  return p.ti === t && p.sT > 0;
}
function other(p) {
  return S.ps[1 - p.i];
}

// Texto en modo inmediato: se reciclan objetos Text cada frame
function P(x, y, s, sz, col, ox, oy, al, sk) {
  let t = S.pool[S.pi++];
  if (!t) {
    t = sc.add.text(0, 0, '', { fontFamily: FONT, fontStyle: 'bold', align: 'center' }).setDepth(30);
    t._z = 0;
    t._c = '';
    t._k = '';
    S.pool.push(t);
  }
  sk = sk || '#1d1d22';
  if (t._z !== sz || t._k !== sk) {
    t._z = sz;
    t._k = sk;
    t.setFontSize(sz);
    t.setStroke(sk, max(3, (sz / 6) | 0));
  }
  if (t._c !== col) {
    t._c = col;
    t.setColor(col);
  }
  t.setText(s);
  t.setPosition(x, y);
  t.setOrigin(ox === undefined ? 0.5 : ox, oy === undefined ? 0.5 : oy);
  t.setAlpha(al === undefined ? 1 : al);
  t.setScale(1);
  t.setAngle(0);
  t.setVisible(true);
  return t;
}

function popup(x, y, s, col, sz) {
  if (S.pops.length > 4) S.pops.shift();
  S.pops.push({ x, y, s, col: col || CY1, sz: sz || 22, l: 1.3, ml: 1.3, a: rnd(-6, 6) });
}

function say(s, sub, col, life) {
  S.msg = { s, sub: sub || '', col: col || CY1, l: life || 1.8, ml: life || 1.8 };
}

// ---------------------------------------------------------------------------
// Audio sintetizado (Web Audio): todo pasa por bus -> master -> compresor
// ---------------------------------------------------------------------------

function aInit() {
  if (AC) return;
  const c = sc.sound && sc.sound.context;
  if (!c) return;
  AC = c;
  const cp = c.createDynamicsCompressor();
  cp.threshold.value = -16;
  cp.knee.value = 12;
  cp.ratio.value = 4;
  cp.attack.value = 0.004;
  cp.release.value = 0.2;
  cp.connect(c.destination);
  const mg = c.createGain();
  mg.gain.value = 0.75;
  mg.connect(cp);
  SB = c.createGain();
  SB.gain.value = 0.9;
  SB.connect(mg);
  MUS = c.createGain();
  MUS.gain.value = 0.3;
  MUS.connect(mg);
  NB = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = NB.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = random() * 2 - 1;
  // susurro suave del giro: ruido filtrado con un leve vaivén (nada de zumbido)
  for (let i = 0; i < 2; i++) {
    const s = c.createBufferSource();
    const f = c.createBiquadFilter();
    const gn = c.createGain();
    const l = c.createOscillator();
    const lg = c.createGain();
    s.buffer = NB;
    s.loop = true;
    f.type = 'bandpass';
    f.Q.value = 1.6;
    f.frequency.value = 500;
    gn.gain.value = 0;
    lg.gain.value = 0;
    l.connect(lg).connect(gn.gain);
    s.connect(f).connect(gn).connect(SB);
    s.start();
    l.start();
    HUMS.push({ f, gn, l, lg });
  }
}

function on() {
  return AC && AC.state === 'running';
}

// envolvente sin clics: sube en 'a' segundos, cae exponencial hasta 'd'
function env(pr, t, v, d, a) {
  pr.setValueAtTime(0.0001, t);
  pr.linearRampToValueAtTime(v, t + a);
  pr.exponentialRampToValueAtTime(0.0001, t + d);
}

function tone(f, d, ty, v, f2, at, out) {
  if (!on()) return;
  const t = at || AC.currentTime;
  const o = AC.createOscillator();
  const gn = AC.createGain();
  o.type = ty || 'triangle';
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  env(gn.gain, t, v, d, min(0.006, d / 4));
  o.connect(gn).connect(out || SB);
  o.start(t);
  o.stop(t + d + 0.05);
}

function noise(d, v, ff, ty, at, out, q, ff2, a) {
  if (!on()) return;
  const t = at || AC.currentTime;
  const s = AC.createBufferSource();
  const f = AC.createBiquadFilter();
  const gn = AC.createGain();
  s.buffer = NB;
  f.type = ty || 'bandpass';
  f.frequency.setValueAtTime(ff, t);
  if (ff2) f.frequency.exponentialRampToValueAtTime(ff2, t + d);
  f.Q.value = q || 1;
  env(gn.gain, t, v, d, a || 0.003);
  s.connect(f).connect(gn).connect(out || SB);
  s.start(t, random() * 0.5);
  s.stop(t + d + 0.05);
}

// "toc" de madera: ruido corto filtrado + golpecito senoidal
function wood(f, v, t) {
  noise(0.05, v, f, 'bandpass', t, 0, 5);
  tone(f * 0.6, 0.07, 'sine', v * 0.7, f * 0.45, t);
}

function arp(fs, dt, d, v, ty, t0) {
  fs.forEach((f, i) => tone(f, d, ty, v, 0, t0 + i * dt));
}

// efecto de juego: callado en el modo demo
function gs(k, a) {
  if (!S.dm) sfx(k, a);
}

function sfx(k, a) {
  if (!on()) return;
  const n = AC.currentTime + 0.01;
  if (k === 'blip') tone(880, 0.07, 'triangle', 0.1, 0, n);
  else if (k === 'ok') arp([587, 880], 0.07, 0.16, 0.12, 'triangle', n);
  else if (k === 'back') tone(440, 0.14, 'triangle', 0.1, 294, n);
  else if (k === 'tick') wood(800 + a * 900, 0.05, n);
  else if (k === 'throw') {
    noise(0.38, 0.3, 450, 'bandpass', n, 0, 1.2, 2600, 0.1);
    wood(1200, 0.12, n);
  } else if (k === 'land') {
    wood(1400, 0.22, n);
    tone(140, 0.14, 'sine', 0.3, 70, n);
  } else if (k === 'hit') {
    const v = clamp(a / 450, 0.25, 1);
    wood(rnd(950, 1250), 0.5 * v, n);
    tone(130, 0.18, 'sine', 0.55 * v, 55, n);
    if (v > 0.6) noise(0.12, 0.14 * v, 3500, 'bandpass', n, 0, 1.5, 1500);
  } else if (k === 'dash') {
    noise(0.16, 0.18, 900, 'bandpass', n, 0, 1.5, 3200, 0.04);
    tone(2637, 0.16, 'sine', 0.05, 0, n + 0.03);
  } else if (k === 'baila') {
    arp([440, 554, 659, 880], 0.06, 0.2, 0.08, 'triangle', n);
  } else if (k === 'perfect') {
    arp([1175, 1480, 1760, 2349], 0.055, 0.4, 0.08, 'sine', n);
    arp([587, 740, 880, 1175], 0.055, 0.3, 0.04, 'triangle', n);
  } else if (k === 'out') {
    tone(660, 0.5, 'triangle', 0.12, 180, n);
    noise(0.45, 0.18, 1500, 'bandpass', n, 0, 1, 300, 0.05);
  } else if (k === 'fall') {
    [0, 0.16, 0.28, 0.37, 0.43, 0.48].forEach((d, i) => wood(1300 - i * 90, 0.3 - i * 0.04, n + d));
  } else if (k === 'win') {
    arp([587, 740, 880], 0.1, 0.18, 0.11, 'triangle', n);
    [587, 740, 880, 1175].forEach((f) => tone(f, 0.8, 'triangle', 0.06, 0, n + 0.32));
    tone(1760, 0.5, 'sine', 0.04, 0, n + 0.32);
  } else if (k === 'lose') {
    arp([440, 415, 392], 0.2, 0.22, 0.1, 'triangle', n);
    tone(370, 0.7, 'triangle', 0.11, 0, n + 0.62);
    tone(185, 0.7, 'sine', 0.1, 0, n + 0.62);
  } else if (k === 'chapa') arp([1319, 1976], 0.07, 0.3, 0.08, 'sine', n);
  else if (k === 'go') {
    tone(880, 0.1, 'triangle', 0.11, 0, n);
    tone(1175, 0.3, 'triangle', 0.12, 0, n + 0.12);
    noise(0.25, 0.1, 2000, 'bandpass', n + 0.1, 0, 1, 5000, 0.05);
  } else if (k === 'alarm') {
    for (let i = 0; i < 3; i++) {
      tone(880, 0.1, 'triangle', 0.09, 0, n + i * 0.2);
      tone(740, 0.1, 'triangle', 0.09, 0, n + i * 0.2 + 0.1);
    }
  } else if (k === 's0') {
    tone(300, 0.3, 'sine', 0.14, 900, n);
    tone(900, 0.25, 'sine', 0.08, 450, n + 0.2);
  } else if (k === 's1') {
    tone(220, 0.45, 'triangle', 0.09, 880, n);
    noise(0.45, 0.2, 600, 'bandpass', n, 0, 2, 4000, 0.15);
  } else if (k === 's2') noise(0.18, 0.12, 700, 'bandpass', n, 0, 1, 2000, 0.05);
  else if (k === 'slam') {
    tone(110, 0.45, 'sine', 0.7, 38, n);
    noise(0.35, 0.3, 500, 'lowpass', n, 0, 1, 120);
    wood(700, 0.3, n);
  } else if (k === 's3') {
    noise(0.12, 0.2, 2500, 'bandpass', n, 0, 2, 5000, 0.03);
    noise(0.12, 0.2, 5000, 'bandpass', n + 0.4, 0, 2, 2500, 0.03);
  } else if (k === 'steal') {
    tone(1200, 0.25, 'sine', 0.1, 300, n);
    tone(300, 0.2, 'triangle', 0.08, 600, n + 0.2);
  } else if (k === 'loco') {
    arp([587, 740, 880, 1175, 1480, 1760], 0.045, 0.3, 0.08, 'triangle', n);
    tone(80, 0.5, 'sine', 0.6, 40, n);
    noise(0.6, 0.22, 400, 'bandpass', n, 0, 1, 6000, 0.3);
  } else if (k === 'ready') arp([1760, 2349], 0.08, 0.25, 0.05, 'sine', n);
}

// Gaita sintetizada en 6/8: cuatro, furro (bajo), tambora y charrasca
function music() {
  const now = AC.currentTime;
  if (S.mt < now) S.mt = now + 0.05;
  while (S.mt < now + 0.2) {
    step(S.ms, S.mt);
    S.mt += S.sd ? 0.125 : 0.15;
    S.ms++;
  }
}

function step(n, t) {
  const bar = floor(n / 6) % 8;
  const st = n % 6;
  const acc = st % 3 === 0;
  const root = 146.83 * pow(2, ROOTS[bar] / 12);
  // cuatro rasgueado (tríada mayor, afinada)
  if (st % 3 !== 1) [0, 4, 7].forEach((s, k) => tone(root * 2 * pow(2, s / 12), 0.16, 'triangle', acc ? 0.04 : 0.025, 0, t + k * 0.012, MUS));
  // charrasca
  noise(0.05, acc ? 0.05 : 0.025, 6000, 'highpass', t, MUS, 0.7);
  // furro: tónica y quinta
  if (acc) tone(st ? root * 0.75 : root / 2, 0.28, 'triangle', 0.2, 0, t, MUS);
  // tambora: bombo suave, aro y repique
  if (st === 0) tone(110, 0.14, 'sine', 0.3, 55, t, MUS);
  if (st === 4) noise(0.03, 0.07, 2500, 'bandpass', t, MUS, 3);
  if (st === 5) tone(180, 0.08, 'sine', 0.12, 120, t, MUS);
  if (S.md !== 'name' && S.md !== 'board') {
    const ch = MEL[bar][st];
    if (ch !== '.') {
      const f = 293.66 * pow(2, SCALE[+ch] / 12);
      tone(f, 0.24, 'triangle', 0.07, 0, t, MUS);
      tone(f * 2, 0.12, 'sine', 0.02, 0, t, MUS);
    }
  }
}

function humTick() {
  for (let i = 0; i < 2; i++) {
    const h = HUMS[i];
    const p = S.ps[i];
    let v = 0;
    const k = clamp(p.sn / 100, 0, 1);
    if (S.md === 'play' && !S.dm && p.ld && !p.fl && !p.out) v = 0.005 + k * 0.015;
    const n = AC.currentTime;
    h.f.frequency.setTargetAtTime(350 + k * 650, n, 0.1);
    h.l.frequency.setTargetAtTime(5 + k * 12, n, 0.1);
    h.gn.gain.setTargetAtTime(v, n, 0.15);
    h.lg.gain.setTargetAtTime(v * 0.6, n, 0.15);
  }
}

// ---------------------------------------------------------------------------
// Escena
// ---------------------------------------------------------------------------

function create() {
  sc = this;
  CAM = sc.cameras.main;
  createControls(sc);
  CT = sc.controls;
  g = sc.add.graphics().setDepth(5);
  og = sc.add.graphics().setDepth(20);
  for (let i = 0; i < 64; i++) CHALK.push(rnd(-2.5, 2.5));
  startDemo();
  loadHighScores()
    .then((b) => {
      S.board = b;
      S.boardOk = true;
    })
    .catch(() => {
      S.board = [];
    });
}

function update(time, delta) {
  if (!S.ps.length) return;
  const dt = min(delta, 50) / 1000;
  S.pi = 0;
  S.t += dt;
  g.clear();
  og.clear();
  if (on()) {
    music();
    humTick();
  }
  logic(dt);
  drawWorld();
  drawUI();
  for (let i = S.pi; i < S.pool.length; i++) S.pool[i].setVisible(false);
  for (const k in CT.pressed) CT.pressed[k] = false;
  if (S.sup && (S.sup.t -= dt) <= 0) {
    supGo(S.sup.p);
    S.sup = null;
  }
  const cam = CAM;
  cam.zoom += (1 - cam.zoom) * min(1, dt * 6);
}

function logic(dt) {
  const m = S.md;
  if (m !== 'board') S.bE = 0;
  if (anyKey()) S.idle = 0;
  else S.idle += dt;
  if (m === 'title') titleInput(dt);
  else if (m === 'select') selectInput(dt);
  else if (m === 'vs') {
    S.vsT -= dt;
    if (S.vsT <= 0 || (S.vsT < 1.6 && anyJ(['START1', 'P1_1', 'START2', 'P2_1']))) {
      S.md = 'play';
      newMatch();
    }
  } else if (m === 'mend') mendInput(dt);
  else if (m === 'name') nameInput(dt);
  else if (m === 'board') {
    S.boardT -= dt;
    S.bE += dt;
    if (S.boardT <= 0 || (S.bE > 0.8 && anyJ(['START1', 'START2', 'P1_1', 'P2_1', 'P1_2']))) {
      sfx('back');
      toTitle();
    }
  }
  if (m === 'play' && !S.tw && jp('START2')) {
    // ¡Nuevo retador!
    S.tw = true;
    S.sel[1] = floor(random() * NT);
    S.rdy = [false, false];
    S.md = 'select';
    say('¡NUEVO RETADOR!', 'P2 SE METIÓ EN LA RUEDA', CR, 2.2);
    sfx('alarm');
    return;
  }
  if (S.md === 'play' || S.md === 'title' || S.md === 'mend') sim(dt);
  else stepFx(dt);
}

// ---------------------------------------------------------------------------
// Flujo de pantallas
// ---------------------------------------------------------------------------

function mkP(i, ti, cpu, diff) {
  const T = TYPES[ti];
  const c = T.c;
  // mismo trompo los dos: el P2 sale con la pintura cambiada
  const C = i && S.ps[0] && S.ps[0].ti === ti ? [c[2], c[0], c[1]] : c;
  return { i, ti, T, C, cpu, diff: diff || 0.5, r: T.r, wins: 0, lo: 0 };
}

// cambia el piso y redibuja el fondo si hace falta
function terr(t) {
  if (t !== S.ter) {
    S.ter = t;
    buildBackground();
  }
}

function resetP(p) {
  Object.assign(p, {
    x: HX[p.i], y: CY, vx: 0, vy: 0, sn: 0, ang: random() * TAU, pr: random() * TAU,
    tn: false, ld: false, air: 0, ch: false, c: 0, cdir: 1, aim: 0, h: 0,
    out: false, fl: false, fallT: 0, fa: 0, th0: 0, dT: 0, brace: false,
    k: [0, 0, 0], bT: 0, sT: 0, ghost: 0, lT: 0, zz: 1,
    wob: 0, whip: 0, tickT: 0, perfect: false, ai: {}, inp: { x: 0, y: 0, b: [0, 0, 0], j: [] },
    pb: [0, 0, 0], hitT: 0, quinos: 0, tr: [],
  });
}

function startDemo() {
  S.dm = true;
  S.tw = false;
  const a = floor(random() * NT);
  S.ps = [mkP(0, a, true, rnd(0.55, 0.95))];
  S.ps[1] = mkP(1, (a + 1 + floor(random() * (NT - 1))) % NT, true, rnd(0.55, 0.95));
  terr(floor(random() * 3));
  S.need = 2;
  S.round = 1;
  startRound();
}

function toTitle() {
  S.md = 'title';
  S.menu = 0;
  S.idle = 0;
  S.msg = null;
  startDemo();
}

function newMatch() {
  S.dm = false;
  S.need = S.tw ? 3 : 2;
  S.ps = [mkP(0, S.sel[0], false)];
  if (S.tw) S.ps[1] = mkP(1, S.sel[1], false);
  else {
    const rv = RIVALS[(S.rv = S.lv)];
    S.ps[1] = mkP(1, rv[2], true, rv[3]);
  }
  terr(S.tw ? floor(random() * 3) : S.lv % 3);
  S.round = 1;
  startRound();
}

function startRound() {
  S.sup = null;
  S.R = R0;
  S.rt = 0;
  S.lt = 0;
  S.ph = 'launch';
  S.sd = false;
  S.chapa = null;
  S.chT = rnd(8, 12);
  S.ps.forEach(resetP);
  if (!S.dm) say('RONDA ' + S.round, TER[S.ter].n + ' · ' + TER[S.ter].h, CY1, 2);
}

function endRound(w, why) {
  if (S.ph === 'end') return;
  S.ph = 'end';
  S.et = 3;
  S.slow = 0.9;
  CAM.zoom = 1.08;
  CAM.shake(260, 0.012);
  S.flash = 0.5;
  const titles = { out: "¡PA' FUERA!", fall: '¡SE CAYÓ EL TROMPO!', self: "¡LO TIRASTE PA'L MONTE!", draw: '¡EMPATE!' };
  if (w >= 0) {
    const wp = S.ps[w];
    wp.wins++;
    const who = S.tw || w === 0 ? 'P' + (w + 1) : S.dm ? 'CPU ' + (w + 1) : RIVALS[S.rv][0];
    say(titles[why], 'GANA ' + who + ' · ' + (S.dm ? wp.T.n : pick(WIN_LINES)), w === 0 ? CY1 : CP, 2.6);
    if (!S.dm && !S.tw && w === 0) {
      const mult = 1 + S.lv * 0.35;
      const pts = round((1000 + floor(wp.sn) * 10 + (why === 'out' ? 500 : 0)) * mult);
      addScore(pts, wp.x, Y(wp.y) - 70);
    }
    if (!S.dm && (S.tw || w === 0)) sfx('win');
    else gs('lose');
  } else {
    say('¡EMPATE!', 'SE REPITE LA RONDA', CW, 2.4);
  }
  gs(why === 'fall' ? 'fall' : 'out');
  if (why !== 'draw') S.round++;
}

function addScore(pts, x, y) {
  S.score += pts;
  if (x !== undefined) popup(x, y, '+' + pts, CG, 20);
}

function afterRound() {
  const w = S.ps[0].wins >= S.need ? 0 : S.ps[1].wins >= S.need ? 1 : -1;
  if (w < 0) {
    startRound();
    return;
  }
  if (S.dm) {
    startDemo();
    return;
  }
  S.md = 'mend';
  S.mwin = w;
  S.mendT = 0;
  S.champ = false;
  if (S.tw || w === 0) confetti(w === 0 ? 0xffe066 : 0xff8fb8);
  if (!S.tw) {
    if (w === 0) {
      addScore(1500 * (S.lv + 1));
      S.lv++;
      if (S.lv >= RIVALS.length) {
        S.champ = true;
        addScore(10000);
      }
      sfx('win');
    } else sfx('lose');
  } else sfx('win');
}

function mendInput(dt) {
  S.mendT += dt;
  if (S.mendT < 1.2) return;
  const go = anyJ(['START1', 'P1_1', 'START2', 'P2_1']);
  if (S.tw) {
    if (go) {
      sfx('ok');
      S.md = 'vs';
      S.vsT = 2;
    } else if (anyJ(['P1_2', 'P2_2']) || S.mendT > 15) toTitle();
    return;
  }
  if (S.mwin === 0 && !S.champ) {
    if (go || S.mendT > 6) {
      sfx('ok');
      S.md = 'vs';
      S.vsT = 3.2;
    }
  } else if (go || S.mendT > 7) finishRun();
}

function finishRun() {
  if (qualifies(S.score)) {
    S.md = 'name';
    S.name = [0, 0, 0];
    S.slot = 0;
    sfx('perfect');
  } else {
    S.md = 'board';
    S.boardT = 9;
    S.hi = -1;
  }
}

function qualifies(s) {
  if (s <= 0) return false;
  if (S.board.length < MAX_HIGH_SCORES) return true;
  return s > S.board[S.board.length - 1].s;
}

function titleInput(dt) {
  const ax = navAxis(0, dt, true);
  if (ax) {
    S.menu = (S.menu + ax + 4) % 4;
    sfx('blip');
    S.idle = 0;
  }
  if (jp('START2')) {
    begin(true);
    return;
  }
  if (anyJ(['START1', 'P1_1', 'P2_1'])) {
    if (S.menu < 2) begin(S.menu === 1);
    else if (S.menu === 2) {
      S.md = 'board';
      S.boardT = 12;
      S.hi = -1;
      sfx('ok');
    } else {
      S.idle = 13;
      sfx('ok');
    }
  }
}

function begin(two) {
  sfx('ok');
  S.tw = two;
  S.score = 0;
  S.lv = 0;
  S.rdy = [false, false];
  S.sel = [S.sel[0], two ? (S.sel[0] + 2) % NT : RIVALS[0][2]];
  S.md = 'select';
  S.msg = null;
}

// Navegación con repetición para menús. Devuelve -1/0/1
function navAxis(i, dt, vertical) {
  const k = i === 0 ? 'P1_' : 'P2_';
  const ti = i + (vertical ? 2 : 0);
  let a = 0;
  if (vertical) a = (held(k + 'D') ? 1 : 0) - (held(k + 'U') ? 1 : 0);
  else a = (held(k + 'R') ? 1 : 0) - (held(k + 'L') ? 1 : 0);
  if (i === 0 && vertical && S.md === 'title') a = a || (held('P2_D') ? 1 : 0) - (held('P2_U') ? 1 : 0);
  if (!a) {
    S.navT[ti] = 0;
    S.navR[ti] = 0;
    return 0;
  }
  S.navT[ti] -= dt;
  if (S.navT[ti] <= 0) {
    S.navT[ti] = S.navR[ti] ? 0.11 : 0.3;
    S.navR[ti] = 1;
    return a;
  }
  return 0;
}

function selectInput(dt) {
  for (let i = 0; i < 2; i++) {
    if (i === 1 && !S.tw) break;
    const k = 'P' + (i + 1) + '_';
    if (!S.rdy[i]) {
      const a = navAxis(i, dt, false);
      if (a) {
        S.sel[i] = (S.sel[i] + a + NT) % NT;
        sfx('blip');
      }
      if (jp(k + '1') || jp('START' + (i + 1))) {
        S.rdy[i] = true;
        sfx('ok');
      } else if (jp(k + '2')) {
        if (i === 0 && !S.rdy[1]) {
          sfx('back');
          toTitle();
          return;
        }
      }
    } else if (jp(k + '2')) {
      S.rdy[i] = false;
      sfx('back');
    }
  }
  if (S.rdy[0] && (S.rdy[1] || !S.tw)) {
    S.md = 'vs';
    S.vsT = S.tw ? 2.2 : 3.2;
    sfx('go');
  }
}

function nameInput(dt) {
  const ay = navAxis(0, dt, true);
  const ax = navAxis(1, dt, false) || navAxis(0, dt, false);
  const L = LETTERS.length;
  if (ay) {
    S.name[S.slot] = (S.name[S.slot] - ay + L) % L;
    sfx('tick', S.name[S.slot] / L);
  }
  if (ax > 0 || jp('P1_1')) {
    if (S.slot === 2 && jp('P1_1')) {
      saveName();
      return;
    }
    S.slot = min(2, S.slot + 1);
    sfx('blip');
  } else if (ax < 0 || jp('P1_2')) {
    S.slot = max(0, S.slot - 1);
    sfx('back');
  }
  if (jp('START1')) saveName();
}

function saveName() {
  const nm = S.name.map((i) => LETTERS[i]).join('');
  const entry = { n: nm, s: S.score, l: S.lv, t: S.sel[0] };
  sfx('win');
  S.saveMsg = 'GUARDANDO...';
  const list = S.board.concat(entry).sort((a, b) => b.s - a.s).slice(0, MAX_HIGH_SCORES);
  S.board = list;
  S.hi = list.indexOf(entry);
  S.md = 'board';
  S.boardT = 12;
  persistHighScore(entry)
    .then((b) => {
      S.board = b;
      S.hi = b.findIndex((e) => e.n === entry.n && e.s === entry.s);
      S.saveMsg = '¡RÉCORD GUARDADO!';
    })
    .catch(() => {
      S.saveMsg = 'NO SE PUDO GUARDAR (SIN MEMORIA)';
    });
}

// ---------------------------------------------------------------------------
// Simulación (piso en coordenadas de mundo: la rueda es un círculo)
// ---------------------------------------------------------------------------

function sim(dt) {
  if (S.stop > 0) {
    S.stop -= dt;
    stepFx(dt * 0.15);
    return;
  }
  if (S.slow > 0) {
    S.slow -= dt;
    dt *= 0.35;
  }
  if (S.ph === 'end' && S.md !== 'mend') {
    S.et -= dt / (S.slow > 0 ? 0.35 : 1);
    if (S.et <= 0 || (S.et < 1.8 && !S.dm && anyJ(['START1', 'START2']))) {
      afterRound();
      return;
    }
  }
  const [a, b] = S.ps;
  for (const p of S.ps) {
    if (p.cpu) ai(p, other(p), dt);
    readIn(p);
  }
  if (S.ph === 'launch') {
    S.lt += dt;
    for (const p of S.ps) launch(p, dt);
    if (a.ld && b.ld) {
      S.ph = 'fight';
      S.rt = 0;
      if (!S.dm) {
        say('¡A ZUMBAR!', '', CW, 1);
        sfx('go');
      }
    }
  } else if (S.ph === 'fight') {
    S.rt += dt;
    if (S.rt > 25) {
      if (!S.sd) {
        S.sd = true;
        if (!S.dm) {
          say('¡MUERTE SÚBITA!', 'SE ACHICA LA RUEDA', CR, 2);
          sfx('alarm');
        }
      }
      S.R = max(92, R0 - (S.rt - 25) * 10);
    }
    chapaTick(dt);
  }
  const h = dt / 3;
  for (let k = 0; k < 3; k++) {
    for (const p of S.ps) move(p, h);
    if (S.ph !== 'launch' && a.ld && b.ld && !a.fl && !b.fl) collide(a, b);
  }
  for (const p of S.ps) status(p, dt);
  if (S.ph === 'fight') {
    const da = a.out || a.fl;
    const db = b.out || b.fl;
    if (da || db) {
      const why = da && db ? 'draw' : (da ? a : b).out ? 'out' : 'fall';
      endRound(da && db ? -1 : da ? 1 : 0, why);
    }
  }
  stepFx(dt);
}

function readIn(p) {
  const n = p.inp;
  if (!p.cpu) {
    const k = 'P' + (p.i + 1) + '_';
    n.x = (held(k + 'R') ? 1 : 0) - (held(k + 'L') ? 1 : 0);
    n.y = (held(k + 'D') ? 1 : 0) - (held(k + 'U') ? 1 : 0);
    n.b = [1, 2, 3].map((i) => held(k + i) || jp(k + i));
  }
  if (S.md === 'mend') {
    n.x = n.y = 0;
    n.b = [0, 0, 0];
  }
  n.j = n.b.map((v, i) => v && !p.pb[i]);
  p.pb = n.b.slice();
}

function aimDir(p) {
  return { x: cos(p.aim) * (p.i ? -1 : 1), y: sin(p.aim) };
}

function landDist(c) {
  return 105 + c * 255;
}

function launch(p, dt) {
  const n = p.inp;
  if (!p.tn) {
    p.aim = clamp(p.aim + n.y * 1.5 * dt, -0.95, 0.95);
    if (n.b[0] || n.j[0]) {
      if (!p.ch) {
        p.ch = true;
        p.c = 0;
        p.cdir = 1;
      }
      p.c += p.cdir * dt * 1.35;
      if (p.c >= 1) {
        p.c = 1;
        p.cdir = -1;
      }
      if (p.c <= 0) {
        p.c = 0;
        p.cdir = 1;
      }
      p.tickT -= dt;
      if (p.tickT <= 0) {
        p.tickT = 0.09;
        gs('tick', p.c);
      }
      p.ang += dt * 3;
    } else if (p.ch) throwTop(p);
    if (S.lt > 7 && !p.tn) {
      p.c = max(p.c, 0.4);
      throwTop(p);
    }
  } else if (!p.ld) {
    p.air += dt;
    const t = min(1, p.air / 0.5);
    p.x = p.sx + (p.tx - p.sx) * t;
    p.y = p.sy + (p.ty - p.sy) * t;
    p.h = sin(PI * t) * (40 + p.c * 50);
    p.ang += dt * 30;
    if (t >= 1) {
      p.ld = true;
      p.h = 0;
      const d = aimDir(p);
      p.vx = d.x * (50 + p.c * 120);
      p.vy = d.y * (50 + p.c * 120);
      burst(p.x, p.y, 14, DUST, 120, 1);
      CAM.shake(90, 0.004);
      gs('land');
      arriba(p, other(p));
      if (hypot(p.x - CX, p.y - CY) > S.R) {
        p.out = true;
        p.sn = min(p.sn, 30);
        const o = other(p);
        S.ph = 'fight';
        endRound(o.out ? -1 : o.i, o.out ? 'draw' : 'self');
      }
    }
  }
}

// ¡LE CAÍSTE ARRIBA!: el trompo lanzado aterriza encima del rival
function arriba(p, o) {
  const dx = o.x - p.x;
  const dy = o.y - p.y;
  const d = hypot(dx, dy);
  if (!o.ld || o.out || o.fl || d > p.r + o.r + 12) return;
  const a = d > 1 ? atan2(dy, dx) : random() * TAU;
  const f = 20 + p.c * 16 + (p.perfect ? 10 : 0);
  o.sn = max(1, o.sn - f);
  o.vx = cos(a) * 430 / o.T.m;
  o.vy = sin(a) * 430 / o.T.m;
  o.hitT = 0.4;
  p.sn = min(120, p.sn + 10);
  p.vx = -cos(a) * 120;
  p.vy = -sin(a) * 120;
  meter(p, 45);
  S.stop = 0.16;
  S.flash = 0.2;
  CAM.shake(300, 0.02);
  CAM.zoom = 1.07;
  sparks(p.x, p.y, 40, cos(a), sin(a), p.r + o.r);
  ring(o.x, o.y, 0xffe066, 120);
  burst(o.x, o.y, 30, TRI, 260, 0);
  gs('slam');
  if (S.dm) return;
  popup(o.x, Y(o.y) - o.r * 2 - 30, '-' + round(f) + ' GIRO', CR, 15);
  tag(p, '¡LE CAÍSTE ARRIBA!');
  if (!S.tw && !p.i) addScore(800, p.x, Y(p.y) - 90);
}

function throwTop(p) {
  const d = aimDir(p);
  p.tn = true;
  p.ch = false;
  p.perfect = p.c >= 0.9;
  p.sx = p.x + d.x * 26;
  p.sy = p.y + d.y * 26;
  const L = landDist(p.c);
  p.tx = p.x + d.x * L;
  p.ty = p.y + d.y * L;
  p.air = 0;
  p.whip = 0.5;
  p.sn = 100 * (0.55 + 0.45 * p.c) * (p.perfect ? 1.15 : 1);
  gs('throw');
  if (S.dm) return;
  if (p.c < 0.35) {
    popup(p.x + d.x * 70, CY - 50, '¡FLOJITO! POCO GIRO', CR, 16);
    sfx('back');
  }
  if (p.perfect) {
    popup(p.x + d.x * 60, CY - 50, '¡TIMING PERFECTO!', CY1, 18);
    sfx('perfect');
    if (!S.tw && p.i === 0) addScore(300, p.x + d.x * 60, CY - 24);
  }
}

function move(p, h) {
  if (!p.ld) return;
  if (p.fl) {
    p.vx *= exp(-4 * h);
    p.vy *= exp(-4 * h);
    p.x += p.vx * h;
    p.y += p.vy * h;
    return;
  }
  const n = p.inp;
  const T = p.T;
  const k = clamp(p.sn / 100, 0, 1.2);
  const sf = 0.45 + 0.55 * min(1, k);
  const zu = act(p, 1);
  const lo = p.lT > 0;
  const sl = act(p, 2);
  if ((S.ph === 'fight' || S.ph === 'launch') && !p.out && !sl) {
    let ix = n.x;
    let iy = n.y;
    const l = hypot(ix, iy);
    if (l > 0) {
      ix /= l;
      iy /= l;
    }
    const acc = (S.ph === 'launch' ? 280 : 560) * T.acc * sf * (p.brace ? 0.15 : 1) * (zu ? 2.2 : 1) * (lo ? 1.4 : 1) * (p.cpu ? 0.8 + 0.2 * p.diff : 1);
    p.vx += ix * acc * h;
    p.vy += iy * acc * h;
    // ¡TROMPO LOCO!: se va solito encima del rival
    if (lo) {
      const o = other(p);
      const dx = o.x - p.x;
      const dy = o.y - p.y;
      const d = hypot(dx, dy) || 1;
      p.vx += (dx / d) * 330 * h;
      p.vy += (dy / d) * 330 * h;
    }
    // ¡REMOLINO! del rival: te jala hacia él
    const o = other(p);
    if (act(o, 5) && o.ld && !o.fl) {
      const dx = o.x - p.x;
      const dy = o.y - p.y;
      const d = hypot(dx, dy) || 1;
      p.vx += (dx / d) * 620 * h;
      p.vy += (dy / d) * 620 * h;
    }
    // el borde de la rueda tiene un poquito de agarre
    const dc = hypot(p.x - CX, p.y - CY);
    if (dc > S.R - 40 && p.dT <= 0) {
      const e = ((dc - S.R + 40) / 40) * 260 * sf;
      p.vx -= ((p.x - CX) / dc) * e * h;
      p.vy -= ((p.y - CY) / dc) * e * h;
    }
    // bamboleo: con poco giro el trompo se va solo
    if (k < 0.35) {
      p.wob += h * (3 + (0.35 - k) * 10);
      const wf = (0.35 - k) * 520;
      p.vx += cos(p.wob * 1.7) * wf * h;
      p.vy += sin(p.wob * 1.3) * wf * h;
    }
  }
  const fr = (sl ? 10 : p.brace ? 6 : zu ? 1.3 : 2.5) * TER[S.ter].f;
  p.vx *= exp(-fr * h);
  p.vy *= exp(-fr * h);
  const sp = hypot(p.vx, p.vy);
  const cap = zu || lo ? 900 : 720;
  if (sp > cap) {
    p.vx *= cap / sp;
    p.vy *= cap / sp;
  }
  p.x += p.vx * h;
  p.y += p.vy * h;
  if (!p.out && hypot(p.x - CX, p.y - CY) > S.R + p.r * 0.35 && S.ph === 'fight') {
    p.out = true;
    burst(p.x, p.y, 20, [0xffffff, 0xf1ead2], 160, 1);
    CAM.shake(200, 0.01);
  }
  if (p.out) {
    // fuera de la rueda: rebota contra los bordes de la pantalla
    if (p.x < 20 || p.x > W - 20) p.vx = -p.vx * 0.6;
    if (p.y < YMIN || p.y > YMAX) p.vy = -p.vy * 0.6;
    p.x = clamp(p.x, 20, W - 20);
    p.y = clamp(p.y, YMIN, YMAX);
  }
}

function status(p, dt) {
  if (!p.ld || p.fl) {
    if (p.fl) {
      p.fallT += dt;
      p.ang += dt * 7 * exp(-p.fallT);
    }
    if (!p.ld && p.tn) return;
    if (!p.tn) p.ang += dt * (p.ch ? 4 : 0.5);
    return;
  }
  const n = p.inp;
  for (let i = 0; i < 3; i++) p.k[i] -= dt;
  p.dT -= dt;
  p.hitT -= dt;
  p.whip -= dt;
  p.bT -= dt;
  p.ghost -= dt;
  p.lT -= dt;
  const was = p.sT;
  p.sT -= dt;
  if (p.ti === 2 && was > 0 && p.sT <= 0) shock(p);
  if (p.ti === 3 && was > 0.45 && p.sT <= 0.45) zig(p, -p.zz);
  const winner = S.ph === 'end' && !p.out;
  if (S.ph === 'fight' && !p.out) {
    // [1] TROMPAZO: embestida con la punta
    if (n.j[0] && p.k[0] <= 0 && p.sn > 10 && !p.brace && !act(p, 2)) {
      let dx = n.x;
      let dy = n.y;
      if (!dx && !dy) {
        const o = other(p);
        dx = o.x - p.x;
        dy = o.y - p.y;
      }
      const l = hypot(dx, dy) || 1;
      const pw = 390 * p.T.dash * (p.cpu ? 0.7 + 0.3 * p.diff : 1);
      p.vx = p.vx * 0.3 + (dx / l) * pw;
      p.vy = p.vy * 0.3 + (dy / l) * pw;
      p.sn -= 3.5;
      p.dT = 0.3;
      p.k[0] = CDS[0];
      burst(p.x, p.y, 10, DUST, 90, 1);
      gs('dash');
    }
    // [2] BAILAR: se planta y recupera giro
    if (n.j[1] && p.k[1] <= 0 && p.sn > 4) {
      p.bT = 1.1;
      p.k[1] = CDS[1];
      tag(p, '¡A BAILAR!');
      gs('baila');
    }
    // [3] especial, o ¡TROMPO LOCO! si la barra está llena
    if (n.j[2]) {
      if (p.lo >= 100) loco(p);
      else if (p.k[2] <= 0 && p.sn > 6) special(p);
    }
  } else p.bT = 0;
  p.brace = p.bT > 0;
  let dec = 2.3 * p.T.dec * TER[S.ter].d * (S.sd ? 1.8 : 1) * (p.lT > 0 ? 0.4 : 1);
  if (n.x || n.y) dec += 0.5;
  if (p.brace) dec = -12;
  if (p.out) dec = 14;
  if (winner || S.md === 'mend') dec = 0;
  if (S.ph === 'launch') dec *= 0.3;
  p.sn = clamp(p.sn - dec * dt, 0, 120);
  p.ang += dt * (3 + min(p.sn, 110) * 0.13);
  p.pr += dt * (2 + (1 - min(1, p.sn / 100)) * 7);
  if (hypot(p.vx, p.vy) > 60) p.tr.push([p.x, p.y]);
  else p.tr.shift();
  if (p.tr.length > 9) p.tr.shift();
  if (random() < hypot(p.vx, p.vy) / 900) burst(p.x - p.vx * 0.03, p.y - p.vy * 0.03, 1, DUST, 30, 1);
  if (p.sn <= 0 && !p.fl) {
    p.fl = true;
    p.fallT = 0;
    p.th0 = tiltOf(p);
    p.fa = p.vx < 0 ? PI : 0;
    burst(p.x, p.y, 18, DUST, 120, 1);
    if (S.ph !== 'fight') gs('fall');
  }
}

// Letrero de habilidad en tiza sobre el trompo
function tag(p, s) {
  popup(p.x, Y(p.y) - p.r * 2.3 - 34, s, p.i ? CP : CY1, 16);
}

function special(p) {
  const t = p.ti;
  const o = other(p);
  p.k[2] = CDS[2];
  p.sT = SPT[t];
  tag(p, p.T.s[1]);
  gs('s' + t);
  if (t === 1) {
    let dx = p.inp.x;
    let dy = p.inp.y;
    if (!dx && !dy) {
      dx = o.x - p.x;
      dy = o.y - p.y;
    }
    const l = hypot(dx, dy) || 1;
    p.vx += (dx / l) * 300;
    p.vy += (dy / l) * 300;
    burst(p.x, p.y, 16, [0x1fcf6a, 0xfff6dc, 0xffe066], 160, 1);
  } else if (t === 3) {
    p.ghost = SPT[3];
    const dx = o.x - p.x;
    const dy = o.y - p.y;
    p.zz = -dy * (CX - p.x) + dx * (CY - p.y) >= 0 ? 1 : -1;
    zig(p, p.zz);
  } else if (t === 0) burst(p.x, p.y, 16, [0x7dff6a, 0xffffff], 120, 1);
  else if (t > 3) ring(p.x, p.y, p.C[0], t > 4 ? 200 : 70);
}

// Chupeta: brinco lateral (zig... zag)
function zig(p, s) {
  const o = other(p);
  const dx = o.x - p.x;
  const dy = o.y - p.y;
  const l = hypot(dx, dy) || 1;
  p.vx += (-dy / l) * 380 * s;
  p.vy += (dx / l) * 380 * s;
  burst(p.x, p.y, 10, [0xff4fb0, 0x6ff5ff], 120, 1);
}

// Macizo: cae del brinco y empuja todo lo que esté cerca
function shock(p) {
  const o = other(p);
  const dx = o.x - p.x;
  const dy = o.y - p.y;
  const d = hypot(dx, dy) || 1;
  const R = 180;
  ring(p.x, p.y, 0xf4f1ea, R);
  ring(p.x, p.y, 0xffd23f, R * 0.65);
  burst(p.x, p.y, 26, DUST, 240, 1);
  CAM.shake(220, 0.012);
  S.stop = 0.06;
  gs('slam');
  if (d < R && o.ld && !o.out && !o.fl && o.ghost <= 0) {
    const f = 1 - d / R;
    const v = (180 + 420 * f) / (o.T.m * (o.brace ? 2.6 : 1));
    o.vx += (dx / d) * v;
    o.vy += (dy / d) * v;
    o.sn = max(0, o.sn - 9 * f);
    o.hitT = 0.25;
    if (!S.dm) popup(o.x, Y(o.y) - o.r * 2 - 16, '-' + round(9 * f) + ' GIRO', CR, 14);
  }
}

function loco(p) {
  p.lo = 0;
  p.lT = LOCO_T;
  p.sn = min(120, p.sn + 30);
  // súper tipo Dragon Ball: se congela todo, sale el corte con el trompo y arranca
  S.sup = { p, t: SUP };
  S.stop = SUP;
  CAM.zoom = 1.1;
  gs('ready');
}

function supGo(p) {
  S.flash = 0.3;
  CAM.shake(350, 0.016);
  CAM.zoom = 1.06;
  ring(p.x, p.y, 0xffffff, 160);
  burst(p.x, p.y, 44, TRI, 300, 0);
  gs('loco');
}

function drawSup() {
  const q = S.sup;
  const p = q.p;
  const u = 1 - q.t / SUP;
  const a = min(1, u * 8, q.t * 8);
  const e = 1 - pow(1 - min(1, u * 4), 3);
  const sg = p.i ? -1 : 1;
  const col = p.i ? 0xff6f9f : 0xffd23f;
  // todo oscuro menos el trompo, que brilla
  og.fs(0x07060a, 0.62 * a).fr(0, 0, W, H);
  const ys = Y(p.y);
  og.fs(col, 0.25 * a).fe(p.x, ys - p.r, p.r * 6, p.r * 6);
  drawTop(og, p.x, ys, p.r, S.t * 30, 0.05, S.t * 6, p.C, a, 120);
  // franja diagonal que entra del lado del jugador
  const y0 = 150;
  const x0 = sg * (1 - e) * -W;
  const pts = [{ x: x0 - 40, y: y0 + 40 }, { x: x0 + W + 40, y: y0 - 40 }, { x: x0 + W + 40, y: y0 + 90 }, { x: x0 - 40, y: y0 + 170 }];
  og.fs(0x000000, 0.9 * a).fp(pts, true);
  pts.forEach((o, i) => (o.y += i < 2 ? 8 : -8));
  og.fs(col, 0.95 * a).fp(pts, true);
  // líneas de velocidad
  for (let i = 0; i < 14; i++) {
    const yy = y0 + 4 + i * 11 - ((i * 37) % 13);
    const xx = ((i * 97 + S.t * 2400 * sg) % (W + 300)) - 150;
    og.ls(2, 0xffffff, 0.5 * a).lb(x0 + xx, yy + 40 - (xx * 80) / W, x0 + xx + 120 * sg, yy + 40 - ((xx + 120 * sg) * 80) / W);
  }
  const tx = CX + x0 - 230 * sg;
  drawTop(og, tx, y0 + 112, 44, S.t * 40, 0.15, S.t * 8, p.C, a, 120);
  P(CX + x0 + 60 * sg, y0 + 50, '¡TROMPO LOCO!', 48, CW, 0.5, 0.5, a, '#140b04').setAngle(-5).setScale(1 + (1 - e) * 0.6);
  P(CX + x0 + 60 * sg, y0 + 98, p.T.n + ' · ' + (S.dm || p.cpu ? 'CPU' : 'P' + (p.i + 1)), 18, '#140b04', 0.5, 0.5, a, hex(col)).setAngle(-5);
}

function meter(p, v) {
  if (p.lT > 0 || p.lo >= 100) return;
  p.lo = min(100, p.lo + v);
  if (p.lo >= 100) {
    tag(p, '¡LOCO LISTO!');
    gs('ready');
  }
}

function steal(p, o) {
  const s = min(12, o.sn);
  o.sn -= s;
  p.sn = min(120, p.sn + s);
  const px = p.x - o.x;
  const py = (p.y - o.y) * K;
  for (let i = 0; i < 14; i++) S.pt.push({ x: o.x + rnd(-10, 10), y: Y(o.y) - o.r * 1.3, vx: px * 2.5 + rnd(-50, 50), vy: py * 2.5 + rnd(-50, 50), l: 0.4, ml: 0.4, c: pick([0x7dff6a, 0xffffff]), s: 3, t: 6 });
  if (!S.dm) popup(p.x, Y(p.y) - p.r * 2 - 22, '+' + round(s) + ' ¡CHUPADO!', CG, 16);
  gs('steal');
}

function mass(p, k) {
  return p.T.m * k * (p.brace ? 2.6 : 1) * (p.dT > 0 ? 1.3 : 1) * (p.lT > 0 ? 1.7 : 1) * (act(p, 1) ? 1.25 : 1);
}

function collide(a, b) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let d = hypot(dx, dy);
  const rr = a.r + b.r;
  if (d >= rr || a.out || b.out || a.ghost > 0 || b.ghost > 0) return;
  if (d < 0.01) {
    dx = 1;
    dy = 0;
    d = 1;
  }
  const nx = dx / d;
  const ny = dy / d;
  // con poco giro el trompo pesa menos y sale volando más (moderado, sin bola de nieve)
  const ka = 0.6 + 0.65 * min(1, a.sn / 100);
  const kb = 0.6 + 0.65 * min(1, b.sn / 100);
  const ma = mass(a, ka);
  const mb = mass(b, kb);
  const ia = 1 / ma;
  const ib = 1 / mb;
  const ov = rr - d;
  a.x -= nx * ov * (ia / (ia + ib));
  a.y -= ny * ov * (ia / (ia + ib));
  b.x += nx * ov * (ib / (ia + ib));
  b.y += ny * ov * (ib / (ia + ib));
  const vr = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vr > 0) return;
  const imp = -vr;
  // los trompos se repelen con fuerza proporcional al giro
  const minSep = 70 + 50 * (ka + kb - 1.5) * 0.8;
  const j = (max(imp * 0.7, minSep) + imp) / (ia + ib);
  const tx = -ny;
  const ty = nx;
  a.vx -= nx * j * ia - tx * j * ia * 0.18;
  a.vy -= ny * j * ia - ty * j * ia * 0.18;
  b.vx += nx * j * ib - tx * j * ib * 0.18;
  b.vy += ny * j * ib - ty * j * ib * 0.18;
  const cx = a.x + nx * a.r;
  const cy = a.y + ny * a.r;
  // daño de giro
  const fresh = a.hitT <= 0 && b.hitT <= 0;
  const base = fresh ? imp * 0.0055 + 0.35 : imp * 0.001;
  const quA = a.dT > 0 && b.dT <= 0;
  const quB = b.dT > 0 && a.dT <= 0;
  let la = base * (mb / ma) * (a.brace ? 0.45 : 1) * (quA ? 0.4 : 1) * (b.lT > 0 ? 1.6 : 1) * (a.lT > 0 ? 0.5 : 1);
  let lb = base * (ma / mb) * (b.brace ? 0.45 : 1) * (quB ? 0.4 : 1) * (a.lT > 0 ? 1.6 : 1) * (b.lT > 0 ? 0.5 : 1);
  const pa = act(a, 4);
  const pb = act(b, 4);
  la = clamp(la * (pb ? 3 : 1), 0.1, pb ? 30 : 14);
  lb = clamp(lb * (pa ? 3 : 1), 0.1, pa ? 30 : 14);
  if (fresh && (pa || pb)) {
    const q = pa ? a : b;
    q.sT = 0;
    S.stop = 0.14;
    burst(q.x, q.y, 24, [0xff3030, 0xffffff, 0xffd23f], 240, 0);
    if (!S.dm) tag(q, '¡RAJADO!');
  }
  a.sn = max(0, a.sn - la);
  b.sn = max(0, b.sn - lb);
  if (fresh && !S.dm) {
    if (la >= 2) popup(a.x, Y(a.y) - a.r * 2 - 12, '-' + round(la) + ' GIRO', CR, 13);
    if (lb >= 2) popup(b.x, Y(b.y) - b.r * 2 - 12, '-' + round(lb) + ' GIRO', CR, 13);
    const vic = quA ? b : quB ? a : null;
    if (vic && vic.i === 0 && !S.tw && S.score > 0) {
      S.score = max(0, S.score - 100);
      popup(vic.x, Y(vic.y) + 18, '-100', CR, 15);
    }
  }
  if (quA && fresh) a.sn = min(110, a.sn + 4);
  if (quB && fresh) b.sn = min(110, b.sn + 4);
  a.hitT = b.hitT = 0.15;
  if (!fresh) return;
  if (act(a, 0)) steal(a, b);
  if (act(b, 0)) steal(b, a);
  meter(a, quA ? 26 : quB ? 10 : 7);
  meter(b, quB ? 26 : quA ? 10 : 7);
  const big = imp > 260;
  sparks(cx, cy, min(40, 6 + imp / 14), nx, ny, (a.r + b.r) * 0.8);
  gs('hit', imp);
  if (big) {
    S.stop = min(0.13, 0.04 + imp / 5000);
    CAM.shake(140, min(0.018, imp / 40000));
    S.flash = max(S.flash, 0.15);
  }
  if ((quA || quB) && !S.dm) {
    const q = quA ? a : b;
    q.quinos++;
    popup(cx, Y(cy) - 60, pick(HIT_LINES), q.i === 0 ? CY1 : CP, big ? 19 : 15);
    if (!S.tw && q.i === 0) addScore(150 + round(imp / 4));
  } else if (!S.dm && big) popup(cx, Y(cy) - 60, '¡CRASH!', CW, 18);
}

function chapaTick(dt) {
  if (!S.chapa) {
    S.chT -= dt;
    if (S.chT <= 0) {
      const a = random() * TAU;
      const r = random() * S.R * 0.55;
      S.chapa = { x: CX + cos(a) * r, y: CY + sin(a) * r, l: 7 };
      S.chT = rnd(9, 13);
    }
    return;
  }
  const c = S.chapa;
  c.l -= dt;
  if (c.l <= 0 || hypot(c.x - CX, c.y - CY) > S.R - 10) {
    S.chapa = null;
    return;
  }
  for (const p of S.ps) {
    if (!p.out && !p.fl && hypot(p.x - c.x, p.y - c.y) < p.r + 12) {
      p.sn = min(115, p.sn + 22);
      meter(p, 15);
      burst(c.x, c.y, 24, [0xffd23f, 0xffffff, 0xff9d00], 200, 0);
      if (!S.dm) popup(c.x, Y(c.y) - 30, '¡CHAPA! +GIRO', '#ffd23f', 18);
      gs('chapa');
      if (!S.tw && !S.dm && p.i === 0) addScore(200);
      S.chapa = null;
      return;
    }
  }
}

// IA del CPU: busca ponerse "detrás" del rival para empujarlo hacia el borde
function ai(p, o, dt) {
  const A = p.ai;
  const n = p.inp;
  const d = p.diff;
  n.b = [0, 0, 0];
  if (S.ph === 'launch') {
    n.x = 0;
    if (A.aim === undefined) {
      A.aim = rnd(-0.3, 0.3) * (1.3 - d);
      A.rel = clamp(0.93 - rnd(0, 0.5) * (1 - d) + (random() < d * 0.7 ? 0.03 : 0), 0.25, 0.99);
      A.wait = rnd(0.4, 1.6);
    }
    // si el rival ya cayó, a veces le apunta para caerle arriba
    if (o.ld && !A.tg && !p.ch) {
      A.tg = 1;
      if (random() < 0.25 + d * 0.6) {
        const hx = HX[p.i];
        A.aim = clamp(atan2(o.y - CY, (o.x - hx) * (p.i ? -1 : 1)) + rnd(-0.12, 0.12) * (1 - d), -0.95, 0.95);
        A.rel = clamp((hypot(o.x - hx, o.y - CY) - 105) / 255 + rnd(-0.08, 0.08) * (1 - d), 0.2, 0.99);
        A.wait = 0.3;
      }
    }
    n.y = abs(A.aim - p.aim) > 0.04 ? sign(A.aim - p.aim) : 0;
    A.wait -= dt;
    if (!p.tn && A.wait <= 0) {
      n.b[0] = !(p.ch && p.cdir > 0 && p.c >= A.rel);
      if (p.ch && p.cdir < 0 && p.c < 0.5) n.b[0] = 0;
    }
    return;
  }
  A.t = (A.t || 0) - dt;
  if (A.t > 0) return;
  A.t = 0.42 - 0.32 * d + random() * 0.1;
  const pc = hypot(p.x - CX, p.y - CY);
  const dx = o.x - p.x;
  const dy = o.y - p.y;
  const dist = hypot(dx, dy) || 1;
  let tx;
  let ty;
  const edge = S.R - pc;
  const ox = o.x - CX;
  const oy = o.y - CY;
  const ol = hypot(ox, oy) || 1;
  if (edge < 40 + 70 * d) {
    tx = CX - p.x;
    ty = CY - p.y;
  } else {
    // punto detrás del rival (del lado del centro)
    tx = o.x - (ox / ol) * (p.r + o.r + 34) - p.x;
    ty = o.y - (oy / ol) * (p.r + o.r + 34) - p.y;
    if (hypot(tx, ty) < 20) {
      tx = dx;
      ty = dy;
    }
  }
  const ang = atan2(ty, tx) + rnd(-0.7, 0.7) * (1 - d);
  n.x = clamp(round(cos(ang) * 1.3), -1, 1);
  n.y = clamp(round(sin(ang) * 1.3), -1, 1);
  const align = (dx / dist) * (ox / ol) + (dy / dist) * (oy / ol);
  if (dist < 120 + 80 * d && p.k[0] <= 0 && p.sn > 18 && align > 0.2 - d * 0.5 && random() < 0.12 + d * 0.35 && edge > 30) {
    n.b[0] = 1;
    n.x = sign(round((dx / dist) * 1.4));
    n.y = sign(round((dy / dist) * 1.4));
  }
  // habilidades del CPU
  const incoming = o.dT > 0 && dist < 130 && (o.vx * -dx + o.vy * -dy) / dist > 150;
  const sk = 0.4 + 0.5 * d;
  const r = random();
  if (p.k[1] <= 0 && r < sk && ((p.sn < 40 && dist > 130) || incoming)) n.b[1] = 1;
  if (p.lo >= 100) n.b[2] = dist < 230 && r < sk;
  else if (p.k[2] <= 0 && r < sk * 0.5) {
    const t = p.ti;
    n.b[2] = (t === 0 && dist < 150) || (t === 1 && dist > 110 && edge > 60) || (t === 2 && dist < 105) || (t === 3 && (incoming || o.lT > 0)) || (t === 4 && dist < 170) || (t === 5 && dist > 90 && dist < 260);
  }
}

// ---------------------------------------------------------------------------
// Partículas y efectos (se guardan en coordenadas de pantalla)
// ---------------------------------------------------------------------------

function burst(x, y, n, cols, sp, ty) {
  y = Y(y);
  for (let i = 0; i < n; i++) {
    const a = random() * TAU;
    const v = random() * sp;
    S.pt.push({ x, y, vx: cos(a) * v, vy: sin(a) * v * K, l: rnd(0.3, 0.8), ml: 0.8, c: pick(cols), s: rnd(2, 5), t: ty, g: 0 });
  }
  if (S.pt.length > 500) S.pt.splice(0, S.pt.length - 500);
}

function sparks(x, y, n, nx, ny, z) {
  y = Y(y) - z;
  for (let i = 0; i < n; i++) {
    const a = atan2(ny, nx) + PI / 2 + (random() < 0.5 ? 0 : PI) + rnd(-0.9, 0.9);
    const v = rnd(120, 520);
    S.pt.push({ x, y, vx: cos(a) * v, vy: sin(a) * v, l: rnd(0.2, 0.5), ml: 0.5, c: pick([0xffffff, 0xffe14d, 0xffa21f]), s: rnd(1.5, 3), t: 2, g: 0 });
  }
  S.pt.push({ x, y, vx: 0, vy: 0, l: 0.18, ml: 0.18, c: 0xffffff, s: 30, t: 3, g: 0 });
}

// onda expansiva en el piso
function ring(x, y, c, r) {
  S.pt.push({ x, y: Y(y), vx: 0, vy: 0, l: 0.45, ml: 0.45, c, s: r, t: 5 });
}

function confetti(c0) {
  for (let i = 0; i < 120; i++) {
    S.pt.push({ x: rnd(0, W), y: rnd(-200, 0), vx: rnd(-40, 40), vy: rnd(60, 200), l: rnd(2.5, 4.5), ml: 4.5, c: pick([0xffcc00, 0x1d4fd8, 0xe8202a, 0xffffff, c0]), s: rnd(3, 6), t: 4, g: rnd(0, TAU) });
  }
}

function stepFx(dt) {
  for (let i = S.pt.length - 1; i >= 0; i--) {
    const q = S.pt[i];
    q.l -= dt;
    if (q.l <= 0) {
      S.pt.splice(i, 1);
      continue;
    }
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    if (q.t === 4) {
      q.g += dt * 6;
      q.vx += sin(q.g) * 30 * dt;
    } else if (q.t !== 6) {
      q.vx *= exp(-4 * dt);
      q.vy *= exp(-4 * dt);
    }
  }
  for (let i = S.pops.length - 1; i >= 0; i--) {
    S.pops[i].l -= dt;
    S.pops[i].y -= dt * 30;
    if (S.pops[i].l <= 0) S.pops.splice(i, 1);
  }
  if (S.msg) {
    S.msg.l -= dt;
    if (S.msg.l <= 0) S.msg = null;
  }
  S.flash = max(0, S.flash - dt * 2.5);
}

// ---------------------------------------------------------------------------
// Dibujo
// ---------------------------------------------------------------------------

// --- Tiza: trazos irregulares, estables entre frames (ruido por hash) ---
function hr(n) {
  const s = sin(n * 127.1 + 311.7) * 43758.5453;
  return (s - floor(s)) * 2 - 1;
}

function chalkPath(gr, pts, col, w, al, closed, seed) {
  for (let k = 0; k < 3; k++) {
    gr.ls(w * (k ? 0.55 : 1), col, al * (k ? 0.4 : 0.75));
    gr.beginPath();
    pts.forEach((p, i) => {
      const x = p[0] + hr(seed + i * 3 + k * 101) * (1 + k * 0.6);
      const y = p[1] + hr(seed + i * 7 + k * 57) * (1 + k * 0.6);
      if (i) gr.lineTo(x, y);
      else gr.moveTo(x, y);
    });
    if (closed) gr.closePath();
    gr.strokePath();
  }
}

function chalkLine(gr, x1, y1, x2, y2, col, w, al, seed) {
  const n = max(2, (hypot(x2 - x1, y2 - y1) / 16) | 0);
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n]);
  chalkPath(gr, pts, col, w, al === undefined ? 1 : al, false, seed || x1 + y1 * 3);
}

function chalkRect(gr, x, y, w, h, col, lw, al, seed) {
  seed = seed || x * 7 + y;
  chalkLine(gr, x - 4, y, x + w + 3, y + 1, col, lw, al, seed);
  chalkLine(gr, x + w, y - 3, x + w - 1, y + h + 4, col, lw, al, seed + 9);
  chalkLine(gr, x + w + 2, y + h, x - 3, y + h - 1, col, lw, al, seed + 19);
  chalkLine(gr, x, y + h + 3, x + 1, y - 4, col, lw, al, seed + 29);
}

// círculo (ky=1) o elipse de tiza
function chalkCircle(gr, x, y, r, col, lw, al, seed, ky) {
  const pts = [];
  const n = max(16, (r / 3) | 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r + hr(seed + i) * 2;
    pts.push([x + cos(a) * rr, y + sin(a) * rr * (ky || 1)]);
  }
  chalkPath(gr, pts, col, lw, al, true, seed);
}

function buildBackground() {
  const b = sc.add.graphics();
  const T = TER[S.ter];
  const z = S.ter;
  if (S.bg) S.bg.destroy();
  // piso del terreno: asfalto, tierra o granito
  b.fs(T.b).fr(0, 0, W, H);
  for (let i = 0; i < 7000; i++) {
    b.fs(pick(T.p), rnd(0.4, 0.9)).fe(rnd(0, W), rnd(0, H), rnd(1, 3.6) * (z === 1 ? 1.5 : 1), rnd(0.6, 2) * (z === 1 ? 1.4 : 1));
  }
  if (z === 2) {
    // baldosas del patio con su brillo
    b.ls(2, 0x2a2f2d, 0.6);
    for (let x = 0; x < W; x += 100) b.lb(x, 92, x, H);
    for (let y = 92; y < H; y += 58) b.lb(0, y, W, y);
    for (let i = 0; i < 9; i++) b.fs(0xffffff, 0.05).fe(rnd(0, W), rnd(120, H), rnd(120, 260), rnd(30, 60));
  }
  if (z === 1) {
    // charcos secos y huellas de zapatos
    for (let i = 0; i < 8; i++) b.fs(0x4e331d, 0.3).fe(rnd(0, W), rnd(100, H), rnd(60, 140), rnd(20, 40));
    for (let i = 0; i < 18; i++) b.fs(0x3e2816, 0.25).fe(rnd(0, W), rnd(100, H), 9, 16);
  }
  // manchas de aceite
  for (let i = 0; i < (z ? 0 : 6); i++) {
    const x = rnd(0, W);
    const y = rnd(80, H);
    b.fs(0x232227, 0.35).fe(x, y, rnd(50, 120), rnd(20, 45));
    b.fs(0x1c1b20, 0.3).fe(x + 6, y + 3, rnd(15, 40), rnd(8, 18));
  }
  // grietas
  b.ls(1.5, 0x1e1d21, 0.9);
  for (let i = 0; i < (z ? 0 : 10); i++) {
    let x = rnd(0, W);
    let y = rnd(60, H);
    b.beginPath();
    b.moveTo(x, y);
    for (let k = 0; k < 7; k++) {
      x += rnd(-24, 24);
      y += rnd(-14, 14);
      b.lineTo(x, y);
    }
    b.strokePath();
  }
  // brocal pintado de amarillo arriba
  b.fs(0x8c8a86).fr(0, 76, W, 16);
  for (let x = 0; x < W; x += 60) b.fs((x / 60) % 2 ? 0xe9c43a : 0x2a2a2a, 0.9).fr(x, 76, 60, 12);
  b.fs(0x000000, 0.35).fr(0, 92, W, 5);
  // tanquilla y rejilla
  b.fs(0x000000, 0.4).fe(706, 540, 76, 46);
  b.fs(0x4b4a4f).fe(702, 536, 70, 42);
  b.ls(2, 0x2f2e33).se(702, 536, 56, 32);
  for (let i = -2; i <= 2; i++) {
    b.lb(702 + i * 10, 522, 702 + i * 10, 550);
    b.lb(676, 536 + i * 6, 728, 536 + i * 6);
  }
  b.fs(0x1a191d).fr(52, 526, 84, 24);
  b.fs(0x5a585e);
  for (let i = 0; i < 7; i++) b.fr(56 + i * 11, 529, 5, 18);
  // chapas regadas
  for (let i = 0; i < 14; i++) {
    let x;
    let y;
    do {
      x = rnd(20, W - 20);
      y = rnd(110, H - 30);
    } while (hypot(x - CX, (y - CY) / K) < R0 + 30 || abs(x - HX[0]) < 60 || abs(x - HX[1]) < 60);
    const c = pick([0xd62828, 0x1d4fd8, 0x2a9d4a, 0xd0d0d0, 0xe9c43a]);
    b.fs(0x000000, 0.4).fe(x + 2, y + 2, 15, 9);
    b.fs(lerpC(c, 0, 0.4)).fe(x, y + 1, 14, 9);
    b.fs(c).fe(x, y - 1, 14, 8);
    b.fs(0xffffff, 0.4).fe(x - 2, y - 2, 5, 3);
  }
  // garabatos de tiza
  const CHK = [0xf4f1ea, 0xffe066, 0xff8fb8, 0x9fe3ff];
  // sol
  chalkCircle(b, 60, 150, 22, CHK[1], 3, 0.6, 3);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    chalkLine(b, 60 + cos(a) * 30, 150 + sin(a) * 30, 60 + cos(a) * 42, 150 + sin(a) * 42, CHK[1], 2.5, 0.55, i * 13);
  }
  // estrellas del tricolor en tiza
  for (let i = 0; i < 8; i++) {
    const a = PI + 0.5 + (i / 7) * (PI - 1);
    const x = 690 + cos(a) * 60;
    const y = 196 + sin(a) * 34;
    const p = [];
    for (let k = 0; k < 10; k++) {
      const aa = -PI / 2 + (k * PI) / 5;
      const rr = k % 2 ? 3 : 7;
      p.push([x + cos(aa) * rr, y + sin(aa) * rr]);
    }
    chalkPath(b, p, CHK[0], 1.6, 0.5, true, i * 77);
  }
  // corazón
  const hp = [];
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * TAU;
    hp.push([735 + 16 * pow(sin(t), 3) * 0.9, 470 - (13 * cos(t) - 5 * cos(2 * t) - 2 * cos(3 * t) - cos(4 * t)) * 0.9]);
  }
  chalkPath(b, hp, CHK[2], 2.5, 0.55, true, 5);
  // flechas hacia la rueda
  chalkLine(b, 110, 250, 150, 270, CHK[3], 3, 0.45, 8);
  chalkLine(b, 150, 270, 138, 256, CHK[3], 3, 0.45, 9);
  chalkLine(b, 150, 270, 134, 274, CHK[3], 3, 0.45, 10);
  // polvo de tiza
  for (let i = 0; i < 500; i++) {
    const a = random() * TAU;
    const r = R0 + rnd(-14, 20);
    b.fs(pick(CHK), rnd(0.05, 0.25)).fc(CX + cos(a) * r, CY + sin(a) * r * K, rnd(0.6, 2));
  }
  // viñeta
  for (let i = 0; i < 12; i++) b.ls(14, 0x000000, 0.04 * (12 - i)).strokeRect(i * 6, i * 6, W - i * 12, H - i * 12);
  const rtx = (S.bg = sc.add.renderTexture(0, 0, W, H).setOrigin(0).setDepth(0));
  rtx.draw(b);
  b.destroy();
  // letreros escritos con tiza
  const tx = sc.make.text({ x: 0, y: 0, text: '', style: { fontFamily: FONT, fontStyle: 'bold' } }, false);
  const wr = (s, x, y, sz, col, ang, al) => {
    tx.setText(s).setFontSize(sz).setColor(col).setOrigin(0.5).setAngle(ang).setAlpha(al);
    rtx.draw(tx, x, y);
  };
  wr('P1', HX[0], CY - 82, 30, CY1, -8, 0.55);
  wr('P2', HX[1], CY - 82, 30, CP, 7, 0.55);
  wr('¡NO SE VALE\nPISAR LA RAYA!', 700, 425, 13, CK, 6, 0.4);
  wr('LA RUEDA', CX, CY - R0 * K - 24, 14, CK, -2, 0.35);
  wr('CARACAS', 62, 196, 12, CY1, -6, 0.4);
  wr(T.n, 120, H - 46, 13, CK, -3, 0.45);
  tx.destroy();
}

function drawRing() {
  const R = S.R;
  if (R < R0) {
    // fuera de la rueda chica: zona prohibida rayada
    const m = (R0 + R + 20) / 2;
    g.ls(R0 - R + 20, 0x15141a, 0.35).se(CX, CY, m * 2, m * 2 * K);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU + 0.1;
      g.ls(2, 0xff8fb8, 0.18).lb(CX + cos(a) * (R + 8), CY + sin(a) * (R + 8) * K, CX + cos(a + 0.12) * (R0 + 10), CY + sin(a + 0.12) * (R0 + 10) * K);
    }
    chalkCircle(g, CX, CY, R0, 0xf4f1ea, 2, 0.2, 55, K);
  }
  const pts = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU;
    const r = R + CHALK[i % 64];
    pts.push([CX + cos(a) * r, CY + sin(a) * r * K]);
  }
  const hot = S.sd && sin(S.t * 12) > 0;
  chalkPath(g, pts, hot ? 0xff8fb8 : 0xf4f1ea, 6, 0.95, true, 1);
  chalkCircle(g, CX, CY, R - 12, 0xffe066, 2, 0.28, 21, K);
  // cruz de tiza en el centro
  chalkLine(g, CX - 14, CY - 8, CX + 14, CY + 8, 0xf4f1ea, 3, 0.55, 2);
  chalkLine(g, CX + 14, CY - 8, CX - 14, CY + 8, 0xf4f1ea, 3, 0.55, 4);
}

// --- El trompo: sólido de revolución en rebanadas (punta de metal, cuerpo de pera, cabeza) ---
// perfil del radio según la altura u (0 = punta, 1 = cabeza)
function prof(u) {
  return u < 0.12 ? 0.05 + u * 0.4 : u < 0.72 ? 0.1 + 0.9 * pow(sin((u - 0.12) * 2.618), 1.2) : u < 0.86 ? 1 - ((u - 0.72) / 0.14) ** 2 * 0.24 : 0.27;
}
// clavo, madera cruda, franjas pintadas y cabeza
function bandC(u, c) {
  return u < 0.12 ? 0xc8ced6 : u < 0.28 ? 0xd29a5c : u >= 0.86 ? 0x9a6232 : c[[1, 0, 2, 0, 1, 0][min(5, ((u - 0.28) / 0.0967) | 0)]];
}

// x,y = punto de apoyo en pantalla. th = inclinación, ph = hacia dónde se inclina, h = altura en el aire
function drawTop(gr, x, y, r, ang, th, ph, c, al, sp, h) {
  h = h || 0;
  const L = r * 2.8;
  const st = sin(th);
  const ct = cos(th);
  const cp = cos(ph);
  const sn = sin(ph);
  const ax = st * cp;
  const ay = st * sn;
  const vy = ay * K - ct * KZ;
  const fx = ct * cp;
  const fy = ct * sn;
  // sombra
  gr.fs(0, 0.32 * al * max(0.3, 1 - h / 120)).fe(x + ax * L * 0.45 + 4, y + ay * L * 0.45 * K + 3, r * 2.2, r * 1.3);
  y -= h;
  const n = clamp(round(r * 1.1), 18, 44);
  const m = r > 30 ? 20 : 14;
  const pt = (u, rr, b) => {
    const cb = cos(b) * rr;
    const sb = sin(b) * rr;
    return { x: x + ax * u * L - cb * sn + sb * fx, y: y + vy * u * L + (cb * cp + sb * fy) * K + sb * st * KZ };
  };
  const ring = (u, rr, lo, hi) => {
    const q = [];
    const cx = x + ax * u * L;
    for (let i = 0; i < m; i++) {
      const p = pt(u, rr, (i / m) * TAU);
      p.x = clamp(p.x, cx + lo * rr, cx + hi * rr);
      q.push(p);
    }
    return q;
  };
  const up = ay * KZ + ct * K > 0;
  const nf = floor(n * 0.86 - 0.001);
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j <= n; j++) {
      const i = up ? j : n - j;
      const u = i / n;
      const rr = prof(u) * r;
      if (!pass) {
        gr.fs(0x1a1208, al).fp(ring(u, rr + 1.6, -2, 2), true);
        continue;
      }
      const col = bandC(u, c);
      gr.fs(lerpC(col, 0, 0.42), al).fp(ring(u, rr, -2, 2), true);
      gr.fs(col, al).fp(ring(u, rr, -2, 0.3), true);
      gr.fs(lerpC(col, 0xffffff, 0.35), al).fp(ring(u, rr, -0.62, -0.28), true);
      // cara de arriba: anillos pintados y rayas que giran
      if (up && i === nf) {
        gr.fs(c[2], al).fp(ring(u, rr * 0.66, -2, 2), true);
        gr.fs(c[0], al).fp(ring(u, rr * 0.48, -2, 2), true);
        const bl = (sp || 0) > 55 ? 3 : 1;
        for (let k = 0; k < 3; k++) {
          for (let b = 0; b < bl; b++) {
            const a = ang + (k * TAU) / 3 - b * 0.3;
            const p1 = pt(u, rr * 0.3, a);
            const p2 = pt(u, rr * 0.95, a);
            gr.ls(max(1.5, r * 0.09), c[1], al * (b ? 0.3 / b : 1)).lb(p1.x, p1.y, p2.x, p2.y);
          }
        }
      }
    }
  }
  // rayas blancas del costado: se ven correr cuando gira
  if (up) {
    for (let k = 0; k < 3; k++) {
      const b = ang + (k * TAU) / 3 + 1;
      const nv = (cos(b) * cp + sin(b) * fy) * KZ - sin(b) * st * K;
      if (nv < 0.12) continue;
      gr.ls(max(1.5, r * 0.1), 0xfff6dc, al * min(1, nv * 2) * ((sp || 0) > 55 ? 0.45 : 0.75));
      gr.beginPath();
      for (let s = 0; s <= 6; s++) {
        const u = 0.3 + s * 0.09;
        const p = pt(u, prof(u) * r, b);
        if (s) gr.lineTo(p.x, p.y);
        else gr.moveTo(p.x, p.y);
      }
      gr.strokePath();
    }
  }
}

function tiltOf(p) {
  return 0.06 + pow(1 - clamp(p.sn / 100, 0, 1), 2) * 0.6 + max(0, p.hitT) * 1.4;
}

function drawPlayer(p) {
  const c = p.C;
  const x = p.x;
  const ys = Y(p.y);
  const r = p.r;
  if (p.fl) {
    // se ladea, pega contra el piso, rebota y rueda alrededor de la punta
    const t = p.fallT;
    const t0 = max(0, t - 0.3);
    const th = t < 0.3 ? p.th0 + (1.18 - p.th0) * (t / 0.3) ** 2 : 1.18 - 0.14 * abs(sin(t0 * 13)) * exp(-t0 * 4);
    const sg = p.fa ? -1 : 1;
    drawTop(g, x, ys, r, p.ang, th, p.fa + sg * (1.2 * (1 - exp(-t0 * 1.5)) - 0.6), c, 1, 0);
    return;
  }
  if (!p.tn) return;
  const th = p.ld ? tiltOf(p) : 0.35;
  const hop = act(p, 2) ? sin(PI * (1 - p.sT / SPT[2])) * 34 : 0;
  const al = p.ghost > 0 ? 0.4 + 0.15 * sin(S.t * 50) : p.out ? 0.75 : 1;
  const by = ys - r * 1.5 - hop;
  // bailando: remolino de tiza en el piso
  if (p.brace && !p.out) {
    for (let i = 0; i < 3; i++) {
      const rr = r * (1.3 + i * 0.35) + sin(S.t * 12 + i) * 2;
      g.ls(3 - i * 0.7, i ? c[0] : 0xffffff, 0.7 - i * 0.18);
      g.beginPath();
      g.arc(x, ys, rr, S.t * 9 + i * 2, S.t * 9 + i * 2 + 3.6);
      g.strokePath();
    }
    g.ls(2, 0xffffff, 0.35).se(x, ys, r * 3.4, r * 3.4 * K);
  }
  // aro de tiza del color del jugador
  if (p.ld && !p.out) g.ls(2, p.i ? 0xff8fb8 : 0xffe066, 0.6).se(x, ys, r * 2.5, r * 2.5 * K);
  // puyazo: punta al rojo vivo · remolino: espiral que jala
  if (act(p, 4)) g.fs(0xff3030, 0.5 + 0.4 * sin(S.t * 30)).fe(x, ys, r * 1.3, r * 0.7);
  if (act(p, 5)) {
    for (let i = 0; i < 4; i++) {
      const rr = r * (5 - i) - ((S.t * 160) % r);
      g.ls(3, i % 2 ? c[0] : 0xffffff, 0.15 + i * 0.12).se(x, ys, rr * 2, rr * 2 * K);
    }
  }
  const tr = p.tr;
  for (let i = 0; i < tr.length; i++) {
    const f = (i + 1) / tr.length;
    g.fs(c[i % 3], 0.22 * f * f).fe(tr[i][0], Y(tr[i][1]), r * (0.9 + f), r * (0.9 + f) * K);
  }
  // estelas de velocidad (trompazo, zumbido, loco)
  if (p.dT > 0 || act(p, 1) || p.lT > 0) {
    const sp = hypot(p.vx, p.vy) || 1;
    const ux = p.vx / sp;
    const uy = (p.vy / sp) * K;
    for (let i = 1; i <= 4; i++) g.fs(act(p, 1) ? 0x1fcf6a : c[0], 0.2 / i).fe(x - ux * i * 12, by - uy * i * 12, r * 2 * (1 - i * 0.12), r * 2.2 * (1 - i * 0.12));
    for (let i = 0; i < 5; i++) {
      const o = (i - 2) * r * 0.45;
      const l = 30 + hr(i + floor(S.t * 20)) * 14;
      g.ls(2, 0xffffff, 0.5).lb(x - ux * r - uy * o, by - uy * r + ux * o, x - ux * (r + l) - uy * o, by - uy * (r + l) + ux * o);
    }
  }
  // chupagiro: remolino verde
  if (act(p, 0)) {
    for (let i = 0; i < 10; i++) {
      const a = S.t * 7 + (i * TAU) / 10;
      const rr = r * (1.4 + 0.3 * sin(S.t * 6 + i));
      g.fs(i % 2 ? 0x7dff6a : 0xffffff, 0.8).fc(x + cos(a) * rr, by + sin(a) * rr * 0.6, 2.5);
    }
  }
  // zigzag: copias fantasma
  if (p.ghost > 0) for (let i = 1; i < 3; i++) g.fs(i % 2 ? 0x6ff5ff : 0xff4fb0, 0.18).fe(x - p.vx * 0.04 * i, by - p.vy * 0.04 * i * K, r * 2, r * 2.4);
  drawTop(g, x, ys, r, p.ang, clamp(th, 0, 1.2), p.pr, c, al, p.sn, p.ld ? hop : p.h);
  // ¡TROMPO LOCO!: chispas tricolor alrededor
  if (p.lT > 0) {
    for (let i = 0; i < 12; i++) {
      const a = -S.t * 9 + (i * TAU) / 12;
      const rr = r * 1.6 + sin(S.t * 20 + i) * 3;
      g.fs(TRI[i % 3], 0.9).fc(x + cos(a) * rr, by + sin(a) * rr * 0.55, 3.5);
    }
    g.ls(3, 0xffffff, 0.4 + 0.3 * sin(S.t * 30)).se(x, ys, r * 3.2, r * 3.2 * K);
  }
  if (!p.ld || S.md === 'title') return;
  // indicador de jugador
  const lab = S.dm || p.cpu ? 'CPU' : 'P' + (p.i + 1);
  P(x, ys - hop - r * 2.3 - 14, lab, 12, p.i ? CP : CY1, 0.5, 0.5, p.out ? 0.5 : 0.9);
  if (p.sn < 25 && !p.out && S.ph === 'fight' && sin(S.t * 18) > 0) P(x, ys + 16, '¡SE CAE!', 11, '#ff6060');
}

function drawLauncher(p) {
  if (p.ld && p.tn) return;
  const hx = HX[p.i];
  const hy = CY;
  const d = aimDir(p);
  const s = p.i ? -1 : 1;
  const r = p.r * 0.85;
  // brazo y mano
  g.fs(0x000000, 0.25).fr(p.i ? hx + 10 : 0, hy - 10, p.i ? W - hx : hx - 6, 26);
  g.fs(p.i ? 0xff6f9f : 0xe9c43a).fr(p.i ? hx + 8 : 0, hy - 14, p.i ? W - hx : hx - 8, 28);
  g.fs(0xffffff, 0.3).fr(p.i ? hx + 8 : 0, hy - 14, p.i ? W - hx : hx - 8, 5);
  g.fs(0x8d5a34).fc(hx, hy, 17);
  g.fs(0xa86d42).fc(hx + s * 2, hy - 3, 13);
  g.ls(2, 0xf2e2b6, 1);
  if (!p.tn) {
    // guía de lanzamiento
    const L = landDist(p.ch ? p.c : 0.5);
    const lx = hx + d.x * L;
    const ly = Y(hy + d.y * L);
    const bad = hypot(d.x * L + hx - CX, d.y * L) > S.R;
    const o = other(p);
    const top = o.ld && !o.out && hypot(hx + d.x * L - o.x, hy + d.y * L - o.y) < p.r + o.r + 12;
    for (let i = 1; i < 14; i++) {
      const t = i / 14;
      g.fs(0xffffff, 0.55).fc(hx + d.x * L * t, Y(hy + d.y * L * t) - sin(PI * t) * 40, 2.5);
    }
    g.ls(top ? 6 : 4, bad ? 0xff3030 : top ? 0xffd23f : 0xffffff, 0.9);
    g.lb(lx - 10, ly - 6, lx + 10, ly + 6);
    g.lb(lx + 10, ly - 6, lx - 10, ly + 6);
    if (bad) P(lx, ly - 22, '¡AFUERA!', 12, CR);
    else if (top) P(lx, ly - 24, '¡ARRIBA!', 14, '#ffd23f');
    // trompo en la mano con el pabilo enrollado
    const tx = hx + d.x * 30;
    const ty = Y(hy + d.y * 30) + 12;
    drawTop(g, tx, ty, r, p.ang, 0.12, s > 0 ? PI : 0, p.C, 1, 0, 18);
    const turns = p.ch ? 1 + p.c * 6 : 1;
    g.ls(2, 0xf2e2b6, 1);
    g.beginPath();
    let ex = tx;
    let ey = ty;
    for (let w = 0; w < turns; w++) {
      const u = 0.2 + w * 0.065;
      const rr = prof(u) * r + 1.5;
      const cy = ty - 18 - u * r * 2.8 * KZ;
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * PI * (w % 2 ? -1 : 1) + (w % 2 ? PI : 0);
        ex = tx + cos(a) * rr;
        ey = cy + sin(abs(a % PI)) * rr * K;
        if (!w && !i) g.moveTo(ex, ey);
        else g.lineTo(ex, ey);
      }
    }
    g.lineTo(hx, hy);
    g.strokePath();
    // medidor del pabilo
    const mx = hx - s * 42;
    const my = hy - 70;
    og.fs(0x000000, 0.6).frr(mx - 11, my - 4, 22, 148, 6);
    og.fs(0x2c2b30).fr(mx - 7, my, 14, 140);
    og.fs(0xffd23f, 0.35 + sin(S.t * 14) * 0.2).fr(mx - 7, my, 14, 14);
    const c = p.ch ? p.c : 0;
    og.fs(c >= 0.9 ? 0xffe066 : lerpC(0x7ee08a, 0xff8fb8, c)).fr(mx - 7, my + 140 - c * 140, 14, c * 140);
    og.ls(2, 0xffffff, 0.8).strokeRoundedRect(mx - 11, my - 4, 22, 148, 6);
    P(mx, my + 160, 'PABILO', 11, CK);
    if (!S.dm && !p.cpu && !p.ch) P(hx + s * 10, hy + 62, 'MANTÉN [1]', 13, CW, 0.5, 0.5, 0.6 + sin(S.t * 8) * 0.4);
  } else if (p.whip > 0) {
    // el pabilo se desenrolla detrás del trompo en el aire
    const tx = p.x;
    const ty = Y(p.y) - p.h - r * 0.9;
    const lft = max(0, 1 - p.air / 0.3);
    g.ls(2, 0xf2e2b6, min(1, p.whip * 3));
    g.beginPath();
    g.moveTo(hx, hy);
    for (let i = 1; i <= 14; i++) {
      const t = i / 14;
      const wv = sin(t * 14 - S.t * 50) * 9 * (1 - t) * (1 - lft * 0.5);
      g.lineTo(hx + (tx - hx) * t * (0.4 + 0.6 * lft), hy + (ty - hy) * t * (0.4 + 0.6 * lft) + wv);
    }
    g.strokePath();
    // vueltas que quedan
    for (let w = 0; w < 4 * lft; w++) g.se(tx, ty - w * 4, r * 1.3, r * 0.6);
  }
}

function drawFx() {
  for (const q of S.pt) {
    const a = clamp(q.l / q.ml, 0, 1);
    if (q.t === 2) {
      g.ls(q.s, q.c, a);
      g.lb(q.x, q.y, q.x - q.vx * 0.03, q.y - q.vy * 0.03);
    } else if (q.t === 3) {
      g.fs(q.c, a * 0.8).fc(q.x, q.y, q.s * (1.5 - a));
    } else if (q.t === 4) {
      og.fs(q.c, min(1, q.l)).fr(q.x, q.y, q.s * abs(sin(q.g)) + 1, q.s);
    } else if (q.t === 5) {
      const rr = 8 + q.s * (1 - a);
      g.ls(2 + 6 * a, q.c, a).se(q.x, q.y, rr * 2, rr * 2 * K);
    } else g.fs(q.c, a).fc(q.x, q.y, q.s * (q.t === 1 ? 0.6 + a * 0.6 : a));
  }
}

function drawWorld() {
  drawRing();
  if (S.md === 'select' || S.md === 'vs' || S.md === 'name' || S.md === 'board') {
    drawFx();
    return;
  }
  const c = S.chapa;
  if (c) {
    if (!(c.l < 2 && sin(S.t * 25) > 0)) {
      // chapa de refresco
      const x = c.x;
      const y = Y(c.y) - 6 + sin(S.t * 5) * 3;
      g.fs(0x000000, 0.3).fe(x + 3, Y(c.y) + 4, 26, 11);
      g.fs(0xb07800).fe(x, y + 3, 24, 14);
      g.fs(0xffd23f).fe(x, y, 24, 13);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + S.t;
        g.fs(0xd99a00).fc(x + cos(a) * 12, y + sin(a) * 6.5, 2);
      }
      g.fs(0xfff3a0).fe(x - 3, y - 2, 8, 4);
      g.ls(2, 0xffffff, 0.5 + sin(S.t * 10) * 0.4).se(x, y, 36 + sin(S.t * 6) * 3, 20);
    }
  }
  const ord = S.ps.slice().sort((a, b) => a.y - b.y);
  for (const p of ord) if (p.ld || !p.tn || p.fl) drawPlayer(p);
  for (const p of S.ps) if (S.ph === 'launch' || p.whip > 0) drawLauncher(p);
  for (const p of S.ps) if (p.tn && !p.ld) drawPlayer(p);
  drawFx();
}

// ---------------------------------------------------------------------------
// Interfaz
// ---------------------------------------------------------------------------

function panel(x, y, w, h, al, bc) {
  og.fs(0x1f1e23, al === undefined ? 0.88 : al).frr(x, y, w, h, 10);
  chalkRect(og, x + 5, y + 5, w - 10, h - 10, bc || 0xffe066, 3, 0.9, x + y);
}

function star(x, y, r, col, al) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -PI / 2 + (i * PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    p.push({ x: x + cos(a) * rr, y: y + sin(a) * rr });
  }
  og.fs(col, al === undefined ? 1 : al).fp(p, true);
}

function spinBar(x, y, w, p, right) {
  const k = clamp(p.sn / 100, 0, 1.2);
  og.fs(0x000000, 0.7).frr(x - 3, y - 3, w + 6, 20, 6);
  og.fs(0x2c2b30).fr(x, y, w, 14);
  const col = k > 0.55 ? 0x7ee08a : k > 0.28 ? 0xffe066 : 0xff6f6f;
  const fw = min(w, w * k);
  og.fs(col, k < 0.28 && sin(S.t * 20) > 0 ? 0.5 : 1).fr(right ? x + w - fw : x, y, fw, 14);
  og.fs(0xffffff, 0.3).fr(right ? x + w - fw : x, y, fw, 4);
  if (k > 1) og.fs(0xffe14d, 0.6 + sin(S.t * 15) * 0.3).fr(x, y, w, 14);
  for (let i = 1; i < 10; i++) og.fs(0x000000, 0.35).fr(x + (w * i) / 10, y, 1, 14);
  chalkRect(og, x - 2, y - 2, w + 4, 18, p.i ? 0xff8fb8 : 0xffe066, 2, 0.8, x);
}

// botones de habilidad con su recarga + barra LOCO
function abil(p, x) {
  const col = p.i ? 0xff8fb8 : 0xffe066;
  const full = p.lo >= 100;
  const L = ['1 TROMPAZO', '2 BAILAR', '3 ' + (full ? '¡LOCO!' : p.T.s[0])];
  const A = [p.dT > 0, p.bT > 0, p.sT > 0 || p.lT > 0];
  for (let i = 0; i < 3; i++) {
    const f = full && i === 2 ? 1 : clamp(1 - p.k[i] / CDS[i], 0, 1);
    const xx = x + i * 84;
    const c = full && i === 2 ? (sin(S.t * 16) > 0 ? 0xff6f6f : 0xffffff) : col;
    og.fs(0x000000, 0.75).frr(xx, 42, 80, 15, 4);
    og.fs(f >= 1 ? c : 0x6a6870, f >= 1 ? 0.95 : 0.8).fr(xx + 1, 43, 78 * f, 13);
    if (A[i]) og.ls(2, 0xffffff, 0.6 + sin(S.t * 24) * 0.4).strokeRoundedRect(xx - 1, 41, 82, 17, 5);
    P(xx + 40, 50, L[i], 10, f >= 1 ? '#1d1d22' : '#e6e1d8', 0.5, 0.5, 1, f >= 1 ? hex(c) : '#1d1d22');
  }
  const f = p.lT > 0 ? p.lT / LOCO_T : p.lo / 100;
  og.fs(0x000000, 0.75).fr(x, 61, 248, 11);
  if (full || p.lT > 0) {
    for (let i = 0; i < 3; i++) og.fs(TRI[(i + floor(S.t * 8)) % 3], 0.95).fr(x + 1 + (i * 246 * f) / 3, 62, (246 * f) / 3, 9);
  } else og.fs(0xff6f6f, 0.85).fr(x + 1, 62, 246 * f, 9);
  P(x + 124, 66, p.lT > 0 ? '¡TROMPO LOCO!' : full ? '¡LOCO LISTO! DALE [3]' : 'LOCO', 9, CW);
}

function drawHud() {
  const [a, b] = S.ps;
  og.fs(0x1f1e23, 0.92).fr(0, 0, W, 76);
  chalkLine(og, 0, 77, W / 3, 78, 0xffe066, 4, 0.9, 1);
  chalkLine(og, W / 3, 78, (W * 2) / 3, 77, 0xf4f1ea, 4, 0.9, 2);
  chalkLine(og, (W * 2) / 3, 77, W, 78, 0xff8fb8, 4, 0.9, 3);
  const n1 = (S.dm ? 'CPU · ' : 'P1 · ') + a.T.n;
  const n2 = S.dm ? b.T.n + ' · CPU' : S.tw ? b.T.n + ' · P2' : RIVALS[S.rv][0];
  P(14, 11, n1, 14, CY1, 0, 0.5);
  P(W - 14, 11, n2, 14, CP, 1, 0.5);
  spinBar(14, 22, 248, a, false);
  spinBar(W - 262, 22, 248, b, true);
  P(18, 29, 'GIRO', 10, CW, 0, 0.5);
  P(W - 18, 29, 'GIRO', 10, CW, 1, 0.5);
  abil(a, 14);
  abil(b, W - 262);
  for (let i = 0; i < S.need; i++) {
    star(288 + i * 22, 30, 9, i < a.wins ? 0xffe14d : 0x55535a);
    star(W - 288 - i * 22, 30, 9, i < b.wins ? 0xff8fb8 : 0x55535a);
  }
  if (S.ph === 'fight' || S.ph === 'end') {
    const left = max(0, ceil(25 - S.rt));
    if (S.sd) P(CX, 22, 'SÚBITA', 18, sin(S.t * 10) > 0 ? CR : CW);
    else P(CX, 22, String(left), 26, left <= 5 ? '#ff7050' : CW);
  } else P(CX, 22, 'R' + S.round, 22, CY1);
  if (!S.dm && !S.tw) P(CX, 52, pad(S.score, 6), 14, CG);
  else if (!S.dm) P(CX, 52, 'AL MEJOR DE ' + (S.need * 2 - 1), 10, '#b9b4ab');
  // ayudas abajo
  if (!S.dm && S.md === 'play') {
    og.fs(0x1f1e23, 0.75).fr(0, H - 22, W, 22);
    const tx = S.ph === 'launch' ? 'JOYSTICK ▲▼ APUNTA  ·  MANTÉN [1] ENROLLA EL PABILO  ·  SUELTA EN LO DORADO = ¡PERFECTO!' : '[1] TROMPAZO  ·  [2] BAILAR (RECUPERA GIRO)  ·  [3] ' + a.T.s[1] + '  ·  BARRA LOCO LLENA + [3] = ¡TROMPO LOCO!';
    P(CX, H - 11, tx, 11, CK);
  }
}

function drawPops() {
  for (const q of S.pops) {
    const a = clamp(q.l / 0.4, 0, 1);
    const t = q.ml - q.l;
    const sc2 = t < 0.15 ? 0.5 + (t / 0.15) * 0.8 : 1.3 - min(0.3, (t - 0.15) * 2);
    P(q.x, q.y, q.s, q.sz, q.col, 0.5, 0.5, a).setScale(sc2).setAngle(q.a);
  }
  if (S.msg) {
    const m = S.msg;
    const t = m.ml - m.l;
    const s = t < 0.2 ? 0.3 + (t / 0.2) * 0.9 : 1.2 - min(0.2, t - 0.2);
    const a = clamp(m.l / 0.3, 0, 1);
    // en plena pelea: franja finita debajo del HUD para no tapar la rueda
    const f = S.md === 'play' && S.ph === 'fight';
    const y = f ? 100 : 266;
    og.fs(0x000000, (f ? 0.3 : 0.45) * a).fr(0, y - (f ? 18 : 40), W, f ? (m.sub ? 50 : 36) : m.sub ? 104 : 80);
    P(CX, y, m.s, f ? 26 : 46, m.col, 0.5, 0.5, a).setScale(s);
    if (m.sub) P(CX, y + (f ? 22 : 46), m.sub, f ? 12 : 18, CW, 0.5, 0.5, a);
  }
}

function drawUI() {
  const m = S.md;
  if (m === 'play' || m === 'mend' || m === 'title') drawHud();
  if (m !== 'title') drawPops();
  if (m === 'title') drawTitle();
  else if (m === 'select') drawSelect();
  else if (m === 'vs') drawVs();
  else if (m === 'mend') drawMend();
  else if (m === 'name') drawName();
  else if (m === 'board') drawBoard(true);
  if (m === 'select') drawPops();
  if (S.sup && m === 'play') drawSup();
  if (S.flash > 0) og.fs(0xffffff, S.flash * 0.25).fr(0, 0, W, H);
}

function logo(y, s) {
  for (let i = 0; i < 8; i++) {
    const a = PI + 0.45 + (i / 7) * (PI - 0.9);
    star(CX + cos(a) * 170 * s, y - 22 * s + sin(a) * 40 * s, 7 * s, 0xf4f1ea, 0.95);
  }
  const b = 1 + sin(S.t * 3) * 0.03;
  P(CX, y, '¡TROMPAZO!', 70 * s, CY1, 0.5, 0.5, 1, '#ff4f9a').setScale(b).setAngle(-3);
}

function drawTitle() {
  og.fs(0x000000, 0.35).fr(0, 78, W, H);
  logo(150, 1);
  P(CX, 205, '¡ENROLLA EL PABILO Y ZUMBA ESE TROMPO!', 16, CK);
  if (S.idle > 12) {
    if (floor((S.idle - 12) / 7) % 2 === 0) drawHow(242);
    else drawBoard(false, 250);
  } else {
    const items = ['1 JUGADOR · ESCALERA DEL BARRIO', '2 JUGADORES · MANO A MANO', 'RÉCORDS', 'CÓMO SE JUEGA'];
    panel(170, 240, 460, 212, 0.88);
    items.forEach((s, i) => {
      const on = S.menu === i;
      if (on) {
        og.fs(0xffe066, 0.18).frr(186, 258 + i * 46, 428, 38, 8);
        drawTop(og, 204 + sin(S.t * 8) * 4, 290 + i * 46, 13, S.t * 12, 0.15, S.t * 5, TYPES[i].c, 1, 80);
      }
      P(CX + 10, 277 + i * 46, s, on ? 20 : 17, on ? CY1 : '#b9b4ab');
    });
  }
  if (sin(S.t * 5) > -0.3) P(CX, 500, 'PRESIONA START  ·  P2: START2 PARA EL MANO A MANO', 15, CW);
  P(CX, 584, '© PLATANUS HACK 26 · CARACAS', 10, '#9c8f78');
}

function drawHow(y) {
  panel(70, y - 10, 660, 250, 0.92, 0xff8fb8);
  P(CX, y + 12, 'CÓMO SE JUEGA', 22, CP);
  const L = [
    ['LANZA', 'Apunta ▲▼, MANTÉN [1] y suelta en lo DORADO'],
    ['[1] TROMPAZO', 'Embiste con la punta y le quitas giro'],
    ['[2] BAILAR', 'Te plantas firme y recuperas giro'],
    ['[3] ESPECIAL', 'Cada trompo tiene su maña (míralo al escoger)'],
    ['¡TROMPO LOCO!', 'Llena la barra LOCO a golpes y dale [3]'],
    ['GANA', "Sácalo de la rueda (¡PA' FUERA!) o que se caiga"],
  ];
  L.forEach(([a, b], i) => {
    P(100, y + 44 + i * 31, a, 14, CY1, 0, 0.5);
    P(270, y + 44 + i * 31, b, 13, CW, 0, 0.5);
  });
}

function drawBoard(full, y0) {
  const y = y0 || 120;
  if (full) {
    og.fs(0x000000, 0.55).fr(0, 0, W, H);
    logo(70, 0.7);
  }
  panel(160, y - 10, 480, full ? 330 : 222, 0.92);
  P(CX, y + 16, '★ LOS DUROS DEL BARRIO ★', 22, CY1);
  const b = S.board;
  if (!b.length) P(CX, y + 100, 'NADIE TODAVÍA...\n¡SÉ EL PRIMERO!', 18, '#b9b4ab');
  b.forEach((e, i) => {
    const yy = y + 56 + i * (full ? 40 : 30);
    const hl = full && i === S.hi && sin(S.t * 10) > -0.2;
    const col = hl ? CG : i === 0 ? CY1 : CW;
    P(200, yy, i + 1 + '.', 20, col, 0, 0.5);
    P(240, yy, e.n, 22, col, 0, 0.5);
    P(330, yy, pad(e.s, 6), 22, col, 0, 0.5);
    P(600, yy, e.l >= RIVALS.length ? 'CAMPEÓN' : 'RIVAL ' + (e.l + 1), 13, '#b9b4ab', 1, 0.5);
    drawTop(og, 468, yy + 9, 9, S.t * 9 + i, 0.12, S.t * 4 + i, TYPES[e.t].c, 1, 80);
  });
  if (full) {
    if (S.saveMsg && S.hi >= 0) P(CX, y + 300, S.saveMsg, 14, CG);
    P(CX, 520, 'START / [1] PARA VOLVER', 16, CW, 0.5, 0.5, 0.6 + sin(S.t * 6) * 0.4);
  }
}

function statRow(x, y, lab, v, col) {
  P(x, y, lab, 12, '#b9b4ab', 0, 0.5);
  for (let i = 0; i < 5; i++) og.fs(i < v ? col : 0x2c2b30).frr(x + 100 + i * 22, y - 7, 18, 14, 3);
}

function drawCard(i, x, ti, ready, rivalIdx) {
  const T = TYPES[ti];
  const C = i && ti === S.sel[0] ? [T.c[2], T.c[0], T.c[1]] : T.c;
  const col = i ? 0xff8fb8 : 0xffe066;
  panel(x, 80, 340, 432, 0.9, col);
  P(x + 170, 104, rivalIdx >= 0 ? 'RIVAL ' + (rivalIdx + 1) + '/' + RIVALS.length : 'JUGADOR ' + (i + 1), 18, hex(col));
  const cx = x + 170;
  og.fs(0x3a393c).fe(cx, 236, 160, 160 * K);
  chalkCircle(og, cx, 236, 80, 0xf4f1ea, 4, 0.9, i * 9, K);
  drawTop(og, cx, 250, 40, S.t * 16, 0.1 + sin(S.t * 2 + i) * 0.04, S.t * 3 + i, C, 1, 100, abs(sin(S.t * 4 + i)) * 4);
  P(cx, 300, T.n, 26, CW);
  P(cx, 328, T.d, 12, CK);
  statRow(x + 40, 356, 'VELOCIDAD', T.st[0], col);
  statRow(x + 40, 380, 'PESO', T.st[1], col);
  statRow(x + 40, 404, 'AGUANTE', T.st[2], col);
  P(cx, 432, '[3] ' + T.s[1], 16, hex(col));
  P(cx, 452, T.s[2], 12, CW);
  if (rivalIdx >= 0) {
    const r = RIVALS[rivalIdx];
    P(cx, 476, r[0] + ' · ' + r[1], 15, CP);
    P(cx, 496, '"' + r[4] + '"', 11, CW);
  } else if (ready) P(cx, 486, '¡LISTO!', 28, CG).setScale(1 + sin(S.t * 10) * 0.05);
  else {
    P(cx - 150, 236, '◄', 30, hex(col), 0.5, 0.5, 0.6 + sin(S.t * 8) * 0.4);
    P(cx + 150, 236, '►', 30, hex(col), 0.5, 0.5, 0.6 + sin(S.t * 8) * 0.4);
    P(cx, 486, '◄ ► ELIGE  ·  [1] LISTO', 15, CW);
  }
}

function drawSelect() {
  og.fs(0x000000, 0.5).fr(0, 0, W, H);
  P(CX, 40, 'ESCOGE TU TROMPO', 32, CY1);
  drawCard(0, 40, S.sel[0], S.rdy[0], -1);
  if (S.tw) drawCard(1, 420, S.sel[1], S.rdy[1], -1);
  else drawCard(1, 420, RIVALS[S.lv][2], false, S.lv);
  P(CX, 300, 'VS', 40, '#ff6f9f');
  P(CX, 536, 'EN LA PELEA:  [1] TROMPAZO  ·  [2] BAILAR  ·  [3] ESPECIAL  ·  BARRA LOCO + [3] = ¡TROMPO LOCO!', 12, CY1);
  P(CX, 564, S.tw ? '[2] CANCELAR' : '[2] VOLVER  ·  P2: START2 PARA RETAR', 13, '#b9b4ab');
}

function drawVs() {
  og.fs(0x000000, 0.6).fr(0, 0, W, H);
  const t = clamp((S.tw ? 2.2 : 3.2) - S.vsT, 0, 1);
  const e = 1 - pow(1 - t, 3);
  const a = TYPES[S.sel[0]];
  const b = TYPES[S.tw ? S.sel[1] : RIVALS[S.lv][2]];
  og.fs(0xe9c43a, 0.85).fillTriangle(0, 120, 520 * e, 120, 0, 480);
  og.fs(0xff6f9f, 0.85).fillTriangle(W, 480, W - 520 * e, 480, W, 120);
  for (let i = 0; i < 26; i++) {
    og.ls(2, 0xffffff, 0.12).lb(i * 20 * e, 120, 0, 120 + i * 14 * e);
    og.ls(2, 0xffffff, 0.12).lb(W - i * 20 * e, 480, W, 480 - i * 14 * e);
  }
  const lx = -100 + 300 * e;
  const rx = W + 100 - 300 * e;
  drawTop(og, lx, 318, 52, S.t * 18, 0.12, S.t * 4, a.c, 1, 100);
  drawTop(og, rx, 404, 52, -S.t * 18, 0.12, -S.t * 4, a === b ? [b.c[2], b.c[0], b.c[1]] : b.c, 1, 100);
  P(lx, 352, S.tw ? 'P1' : 'TÚ', 30, CW);
  P(lx, 386, a.n, 18, '#140b04', 0.5, 0.5, 1, CY1);
  if (S.tw) {
    P(rx, 254, 'P2', 30, CW);
    P(rx, 220, b.n, 18, CW);
  } else {
    const r = RIVALS[S.lv];
    P(rx, 240, r[0], 24, CW);
    P(rx, 212, 'DE ' + r[1], 14, CY1);
    P(CX, 520, '"' + r[4] + '"', 16, CW, 0.5, 0.5, e);
    P(CX, 92, 'RIVAL ' + (S.lv + 1) + ' DE ' + RIVALS.length, 20, CY1, 0.5, 0.5, e);
  }
  P(CX, 300, 'VS', 80 * (0.6 + e * 0.4), '#ff6f9f', 0.5, 0.5, 1, CW).setAngle(sin(S.t * 6) * 4);
  P(CX, 560, (S.tw ? 'AL MEJOR DE 5' : 'AL MEJOR DE 3') + (S.tw ? '' : '  ·  EN ' + TER[S.lv % 3].n), 14, '#b9b4ab');
}

function drawMend() {
  const t = min(1, S.mendT * 2);
  og.fs(0x000000, 0.5 * t).fr(0, 78, W, H);
  let a;
  let b;
  let c;
  if (S.tw) {
    a = '¡GANÓ P' + (S.mwin + 1) + '!';
    b = 'CON ' + S.ps[S.mwin].T.n + ' · ' + S.ps[0].wins + ' A ' + S.ps[1].wins;
    c = '[1] / START = REVANCHA   ·   [2] = MENÚ';
  } else if (S.champ) {
    a = '¡ERES EL REY DEL TROMPO!';
    b = 'TE LOS PELASTE A TODOS · PUNTOS: ' + S.score;
    c = 'START PARA CONTINUAR';
  } else if (S.mwin === 0) {
    a = '¡LE GANASTE A ' + RIVALS[S.lv - 1][0] + '!';
    b = 'BONO +' + 1500 * S.lv + ' · SIGUIENTE: ' + RIVALS[S.lv][0] + ' DE ' + RIVALS[S.lv][1];
    c = 'START PARA SEGUIR';
  } else {
    a = '¡TE PELARON, CHAMO!';
    b = 'LLEGASTE AL RIVAL ' + (S.lv + 1) + ' · PUNTOS: ' + S.score;
    c = 'START PARA CONTINUAR';
  }
  const good = S.mwin === 0 || S.tw;
  panel(60, 200, 680, 200, 0.9 * t, good ? 0xffe066 : 0xff6f6f);
  P(CX, 250, a, a.length > 20 ? 34 : 44, good ? CY1 : CR, 0.5, 0.5, t).setScale(1 + sin(S.t * 6) * 0.03);
  P(CX, 310, b, 16, CW, 0.5, 0.5, t);
  if (S.mendT > 1.2) P(CX, 360, c, 16, CG, 0.5, 0.5, 0.6 + sin(S.t * 6) * 0.4);
}

function drawName() {
  og.fs(0x000000, 0.65).fr(0, 0, W, H);
  logo(80, 0.7);
  panel(150, 140, 500, 370, 0.92);
  P(CX, 178, '¡NUEVO RÉCORD!', 34, CG).setScale(1 + sin(S.t * 8) * 0.04);
  P(CX, 222, 'PUNTOS: ' + S.score, 22, CW);
  P(CX, 256, 'ESCRIBE TUS INICIALES', 15, CK);
  for (let i = 0; i < 3; i++) {
    const x = CX - 100 + i * 100;
    const on = S.slot === i;
    og.fs(on ? 0xffcc00 : 0x2c2b30, on ? 0.25 : 1).frr(x - 36, 290, 72, 92, 10);
    og.ls(3, on ? 0xffcc00 : 0x6b5a44).strokeRoundedRect(x - 36, 290, 72, 92, 10);
    P(x, 336, LETTERS[S.name[i]], 54, on ? CY1 : CW);
    if (on) {
      P(x, 278, '▲', 16, CY1, 0.5, 0.5, 0.5 + sin(S.t * 8) * 0.5);
      P(x, 396, '▼', 16, CY1, 0.5, 0.5, 0.5 + sin(S.t * 8) * 0.5);
    }
  }
  P(CX, 440, '▲▼ LETRA  ·  [1] / ► SIGUIENTE  ·  [2] / ◄ ATRÁS', 13, CW);
  P(CX, 470, 'START = GUARDAR', 15, CG);
}

// ---------------------------------------------------------------------------
// Portada (cover.png): abrir con #cover
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Controles del gabinete (no tocar el mapeo)
// ---------------------------------------------------------------------------

function createControls(scene) {
  scene.controls = {
    held: Object.create(null),
    pressed: Object.create(null),
  };

  const onKeyDown = (event) => {
    aInit();
    if (AC && AC.state !== 'running') AC.resume();
    const key = normalizeIncomingKey(event.key);
    if (!key) {
      return;
    }

    const arcadeCode = KEYBOARD_TO_ARCADE[key];
    if (!arcadeCode) {
      return;
    }

    if (!scene.controls.held[arcadeCode]) {
      scene.controls.pressed[arcadeCode] = true;
    }
    scene.controls.held[arcadeCode] = true;
  };

  const onKeyUp = (event) => {
    const key = normalizeIncomingKey(event.key);
    if (!key) {
      return;
    }

    const arcadeCode = KEYBOARD_TO_ARCADE[key];
    if (!arcadeCode) {
      return;
    }

    scene.controls.held[arcadeCode] = false;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  scene.events.once('shutdown', () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  });
}

function normalizeIncomingKey(key) {
  if (typeof key !== 'string' || key.length === 0) {
    return '';
  }

  if (key === ' ') {
    return 'space';
  }

  return key.toLowerCase();
}

// ---------------------------------------------------------------------------
// Récords persistentes
// ---------------------------------------------------------------------------

async function persistHighScore(entry) {
  const existing = await loadHighScores();
  const nextScores = existing
    .concat(entry)
    .sort((left, right) => right.s - left.s)
    .slice(0, MAX_HIGH_SCORES);

  await storageSet(STORAGE_KEY, nextScores);
  return nextScores;
}

async function loadHighScores() {
  const result = await storageGet(STORAGE_KEY);
  if (!result || !result.found || !Array.isArray(result.value)) {
    return [];
  }

  return result.value
    .filter(isHighScoreEntry)
    .map((e) => ({
      n: e.n.toUpperCase().replace(/[^A-Z0-9*.-]/g, '-').slice(0, 3).padEnd(3, '-'),
      s: floor(e.s),
      l: clamp(floor(e.l) || 0, 0, RIVALS.length),
      t: clamp(floor(e.t) || 0, 0, TYPES.length - 1),
    }))
    .sort((a, b) => b.s - a.s)
    .slice(0, MAX_HIGH_SCORES);
}

function isHighScoreEntry(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.n === 'string' &&
    typeof value.s === 'number' &&
    isFinite(value.s) &&
    value.s >= 0 &&
    value.s < 1e8
  );
}

function getStorage() {
  if (window.platanusArcadeStorage) {
    return window.platanusArcadeStorage;
  }

  return {
    async get(key) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null
          ? { found: false, value: null }
          : { found: true, value: JSON.parse(raw) };
      } catch {
        return { found: false, value: null };
      }
    },
    async set(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // sin almacenamiento disponible
      }
    },
  };
}

async function storageGet(key) {
  return getStorage().get(key);
}

async function storageSet(key, value) {
  return getStorage().set(key, value);
}
})();
