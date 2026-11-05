// TURBO GOL — Platanus Hack 26
// Fútbol de autos 1v1 en vista lateral. Física propia, Phaser solo para loop/render/input/audio.

// ============================== CONFIG ==============================
const W = 800;
const H = 600;

// Todos los parámetros ajustables. Unidades: px, s, px/s, px/s², rad/s.
const CFG = {
  // --- Simulación ---
  dt: 1 / 120, // s, paso fijo de física
  maxFrame: 0.1, // s, máximo tiempo de frame acumulable (evita espiral de la muerte)
  maxSubStep: 6, // px, desplazamiento máximo por sub-paso (anti-túnel)

  // --- Arena ---
  arenaL: 20, // px, pared izquierda
  arenaR: 780, // px, pared derecha
  arenaT: 76, // px, techo
  arenaB: 584, // px, piso
  cornerR: 90, // px, radio de las 4 esquinas (las inferiores son rampas)
  goalH: 150, // px, alto de la boca del arco (a ras de suelo)
  goalD: 90, // px, profundidad del arco = largo del travesaño
  barR: 7, // px, radio (grosor/2) del travesaño
  goalLine: 10, // px, cuánto debe pasar el centro de la pelota el extremo del travesaño para ser gol
  glow: true, // bool, usa postFX glow si hay WebGL

  // --- Pelota ---
  ballR: 32, // px
  ballGravity: 820, // px/s² (menor que la del auto: se siente "flotante")
  ballRest: 0.75, // restitución contra la arena
  ballRestV: 45, // px/s, bajo esta velocidad normal no rebota (reposo estable)
  ballImpactFric: 0.06, // fracción de vel. tangencial perdida en cada impacto
  ballRollFric: 0.35, // 1/s, resistencia al rodar mientras está en contacto
  ballDrag: 0.1, // 1/s, fricción del aire
  ballMax: 1500, // px/s, velocidad máxima
  ballSpinDamp: 0.3, // 1/s, amortiguación del giro visual en el aire
};

// ============================== MATH ================================
// Vectores como {x, y} o como pares de números sueltos para no generar basura.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const len = (x, y) => Math.sqrt(x * x + y * y);
// Ángulo envuelto a (-PI, PI].
const wrapAngle = (a) => {
  a %= Math.PI * 2;
  if (a > Math.PI) a -= Math.PI * 2;
  if (a <= -Math.PI) a += Math.PI * 2;
  return a;
};
// Normaliza (x, y); si es ~0 devuelve el fallback (fx, fy). Nunca produce NaN.
function norm(x, y, fx, fy) {
  const l = len(x, y);
  return l > 1e-6 ? { x: x / l, y: y / l } : { x: fx, y: fy };
}

// ============================== INPUT ===============================
// DO NOT replace existing keys — they match the physical arcade cabinet wiring.
// To add local testing shortcuts, append extra keys to any array.
const CABINET_KEYS = {
  P1_U: ['w'],
  P1_D: ['s'],
  P1_L: ['a'],
  P1_R: ['d'],
  P1_1: ['u', ' '],
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

function normalizeIncomingKey(key) {
  if (typeof key !== 'string' || key.length === 0) return '';
  if (key === ' ') return 'space';
  return key.toLowerCase();
}

// held[code]: tecla mantenida. pressed[code]: flanco de bajada pendiente de consumir.
const held = Object.create(null);
const pressed = Object.create(null);

function createControls(scene) {
  const onKeyDown = (event) => {
    const code = KEYBOARD_TO_ARCADE[normalizeIncomingKey(event.key)];
    if (!code) return;
    if (!held[code]) pressed[code] = true;
    held[code] = true;
  };
  const onKeyUp = (event) => {
    const code = KEYBOARD_TO_ARCADE[normalizeIncomingKey(event.key)];
    if (code) held[code] = false;
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  scene.events.once('shutdown', () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  });
}

// Consume un flanco de botón (true una sola vez por pulsación).
function consume(code) {
  if (pressed[code]) {
    pressed[code] = false;
    return true;
  }
  return false;
}

// ============================== STORAGE =============================
function getStorage() {
  if (window.platanusArcadeStorage) return window.platanusArcadeStorage;
  return {
    async get(key) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? { found: false, value: null } : { found: true, value: JSON.parse(raw) };
      } catch {
        return { found: false, value: null };
      }
    },
    async set(key, value) {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
  };
}

async function storageGet(key) {
  return getStorage().get(key);
}

async function storageSet(key, value) {
  return getStorage().set(key, value);
}

// ============================== ARENA ===============================
// La arena es el INTERIOR de un rectángulo con esquinas redondeadas, descrito por una
// SDF analítica. Los arcos son la zona a ras de suelo bajo un travesaño (cápsula) que
// sale de cada pared; la rampa inferior queda dentro del arco. El travesaño solo
// colisiona con la pelota: los autos pasan "por delante" y pueden subir rampa→pared→techo.
const A = {
  cx: (CFG.arenaL + CFG.arenaR) / 2,
  cy: (CFG.arenaT + CFG.arenaB) / 2,
  hx: (CFG.arenaR - CFG.arenaL) / 2,
  hy: (CFG.arenaB - CFG.arenaT) / 2,
  barY: CFG.arenaB - CFG.goalH,
};
// Travesaños: segmento (x0..x1, barY). Índice 0 = arco izquierdo (de P1), 1 = derecho (de P2).
const BARS = [
  { x0: CFG.arenaL, x1: CFG.arenaL + CFG.goalD },
  { x0: CFG.arenaR - CFG.goalD, x1: CFG.arenaR },
];

// Superficie de arena más cercana a p.
// dist: distancia a la pared (positiva dentro, negativa si p quedó afuera).
// nx, ny: normal unitaria que apunta HACIA EL INTERIOR. px, py: punto sobre la pared.
function closestSurface(x, y) {
  const R = CFG.cornerR;
  const lx = x - A.cx;
  const ly = y - A.cy;
  const sx = lx >= 0 ? 1 : -1;
  const sy = ly >= 0 ? 1 : -1;
  const qx = Math.abs(lx) - (A.hx - R);
  const qy = Math.abs(ly) - (A.hy - R);
  let d, ox, oy; // d = SDF (positivo afuera), (ox, oy) = normal hacia afuera
  if (qx > 0 && qy > 0) {
    const l = len(qx, qy);
    d = l - R;
    ox = (qx / l) * sx;
    oy = (qy / l) * sy;
  } else if (qx > qy) {
    d = qx - R;
    ox = sx;
    oy = 0;
  } else {
    d = qy - R;
    ox = 0;
    oy = sy;
  }
  return { dist: -d, nx: -ox, ny: -oy, px: x + ox * -d, py: y + oy * -d };
}

// Distancia de p a un travesaño (cápsula). Misma forma de retorno que closestSurface.
function barSurface(bar, x, y) {
  const cx = clamp(x, bar.x0, bar.x1);
  const n = norm(x - cx, y - A.barY, 0, y < A.barY ? -1 : 1);
  const d = len(x - cx, y - A.barY) - CFG.barR;
  return { dist: d, nx: n.x, ny: n.y, px: cx + n.x * CFG.barR, py: A.barY + n.y * CFG.barR };
}

// Resuelve penetración de un círculo (body: x, y, vx, vy) contra una superficie.
// e: restitución, fr: fracción de velocidad tangencial perdida en impacto.
// Devuelve la velocidad de impacto (>0 si chocó acercándose), o -1 si no hay contacto.
function resolveCircle(b, r, s, e, fr, restV) {
  if (s.dist >= r) return -1;
  const pen = r - s.dist;
  b.x += s.nx * pen;
  b.y += s.ny * pen;
  const vn = b.vx * s.nx + b.vy * s.ny;
  if (vn >= 0) return 0;
  const tx = -s.ny;
  const ty = s.nx;
  let vt = b.vx * tx + b.vy * ty;
  const impact = -vn;
  const rest = impact < restV ? 0 : e; // por debajo de restV no rebota (evita temblor en reposo)
  if (impact >= restV) vt *= 1 - fr;
  const nvn = -vn * rest;
  b.vx = tx * vt + s.nx * nvn;
  b.vy = ty * vt + s.ny * nvn;
  return impact;
}

// Colisiona un círculo contra toda la arena (y travesaños si withBars).
// Devuelve el mayor impacto y la última superficie tocada (o null).
function collideCircle(b, r, e, fr, restV, withBars) {
  let best = -1;
  let surf = null;
  const s = closestSurface(b.x, b.y);
  let imp = resolveCircle(b, r, s, e, fr, restV);
  if (imp >= 0) {
    best = imp;
    surf = s;
  }
  if (withBars) {
    for (const bar of BARS) {
      const bs = barSurface(bar, b.x, b.y);
      imp = resolveCircle(b, r, bs, e, fr, restV);
      if (imp > best) {
        best = imp;
        surf = bs;
      } else if (imp >= 0 && !surf) surf = bs;
    }
  }
  return { impact: best, s: surf };
}

// ============================== BALL ================================
function makeBall() {
  return { x: A.cx, y: A.cy, vx: 0, vy: 0, spin: 0, rot: 0, active: true, trail: [] };
}

function ballStep(b, dt) {
  if (!b.active) return;
  b.vy += CFG.ballGravity * dt;
  const k = Math.max(0, 1 - CFG.ballDrag * dt);
  b.vx *= k;
  b.vy *= k;
  const sp = len(b.vx, b.vy);
  if (sp > CFG.ballMax) {
    b.vx *= CFG.ballMax / sp;
    b.vy *= CFG.ballMax / sp;
  }
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  const c = collideCircle(b, CFG.ballR, CFG.ballRest, CFG.ballImpactFric, CFG.ballRestV, true);
  if (c.s) {
    // En contacto: resistencia al rodar y giro = velocidad tangencial / radio.
    const tx = -c.s.ny;
    const ty = c.s.nx;
    const vt = (b.vx * tx + b.vy * ty) * Math.max(0, 1 - CFG.ballRollFric * dt);
    const vn = b.vx * c.s.nx + b.vy * c.s.ny;
    b.vx = tx * vt + c.s.nx * vn;
    b.vy = ty * vt + c.s.ny * vn;
    b.spin = vt / CFG.ballR;
    if (c.impact > 250) onBallBounce(b, c.impact, c.s);
  } else {
    b.spin *= Math.max(0, 1 - CFG.ballSpinDamp * dt);
  }
  b.rot += b.spin * dt;
}

// Hook de feedback para rebotes fuertes contra la arena (se completa en game feel).
function onBallBounce(b, impact, s) {}

// ============================== RENDER ==============================
const COL = {
  bg: 0x05060c,
  field: 0x0b0e1c,
  line: 0x6b6bff, // neón de la arena
  accent: 0xe1ff00, // amarillo Platanus
  p1: 0xe1ff00,
  p2: 0xff6ec7,
  ball: 0xf4f4ff,
};

// Puntos de un arco (para rellenos de esquina).
function arcPoints(cx, cy, r, a0, a1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

// Dibuja la arena estática (una sola vez).
function drawArena(scene) {
  const { arenaL: L, arenaR: R, arenaT: T, arenaB: B, cornerR: CR } = CFG;
  const g = scene.add.graphics().setDepth(0);
  // Grilla de fondo
  g.lineStyle(1, 0x15183a, 0.6);
  for (let x = 0; x <= W; x += 40) g.lineBetween(x, 0, x, H);
  for (let y = 0; y <= H; y += 40) g.lineBetween(0, y, W, y);
  // Campo
  g.fillStyle(COL.field, 1);
  g.fillRoundedRect(L, T, R - L, B - T, CR);
  // Arcos: red con color del dueño
  const goals = [
    { x: L, c: COL.p1 },
    { x: R - CFG.goalD, c: COL.p2 },
  ];
  for (const gl of goals) {
    g.fillStyle(gl.c, 0.1);
    g.fillRect(gl.x, A.barY, CFG.goalD, CFG.goalH);
    g.lineStyle(1, gl.c, 0.25);
    for (let x = gl.x; x <= gl.x + CFG.goalD; x += 15) g.lineBetween(x, A.barY, x, B);
    for (let y = A.barY; y <= B; y += 15) g.lineBetween(gl.x, y, gl.x + CFG.goalD, y);
  }
  // Tapar lo que sobresale de la red detrás de las rampas
  g.fillStyle(COL.bg, 1);
  g.fillPoints([{ x: L - 2, y: B + 2 }, ...arcPoints(L + CR, B - CR, CR, Math.PI, Math.PI / 2, 16)], true);
  g.fillPoints([{ x: R + 2, y: B + 2 }, ...arcPoints(R - CR, B - CR, CR, 0, Math.PI / 2, 16)], true);
  // Marcas de cancha
  g.lineStyle(2, COL.line, 0.25);
  g.lineBetween(A.cx, T + 10, A.cx, B - 10);
  g.strokeCircle(A.cx, A.cy + 60, 70);
  // Borde neón (glow por capas)
  const layers = [
    [14, 0.06],
    [8, 0.12],
    [4, 0.35],
    [2, 1],
  ];
  for (const [w, a] of layers) {
    g.lineStyle(w, COL.line, a);
    g.strokeRoundedRect(L, T, R - L, B - T, CR);
  }
  // Travesaños (capa superior: los autos pasan por detrás)
  const fg = scene.add.graphics().setDepth(20);
  BARS.forEach((bar, i) => {
    const c = i ? COL.p2 : COL.p1;
    for (const [w, a] of layers) {
      fg.lineStyle(CFG.barR * 2 + w - 2, c, a);
      fg.lineBetween(bar.x0, A.barY, bar.x1, A.barY);
    }
    fg.fillStyle(0xffffff, 1);
    fg.fillCircle(i ? bar.x0 : bar.x1, A.barY, CFG.barR - 2);
  });
}

// Glow opcional (solo WebGL).
function addGlow(obj, color, strength) {
  if (CFG.glow && obj.postFX) obj.postFX.addGlow(color, strength, 0, false, 0.1, 12);
}

// Gráfico de la pelota en coordenadas locales (rota con b.rot).
function makeBallGfx(scene) {
  const r = CFG.ballR;
  const g = scene.add.graphics().setDepth(8);
  g.fillStyle(COL.ball, 1);
  g.fillCircle(0, 0, r);
  g.lineStyle(3, 0x8f95c8, 1);
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    g.lineBetween(Math.cos(a) * 9, Math.sin(a) * 9, Math.cos(a) * r, Math.sin(a) * r);
  }
  g.strokeCircle(0, 0, 9);
  g.lineStyle(3, 0xffffff, 1);
  g.strokeCircle(0, 0, r - 1);
  addGlow(g, 0xffffff, 3);
  return g;
}

// Render de objetos dinámicos (a tasa de pantalla).
function render(scene, dt) {
  const b = G.ball;
  G.ballGfx.setVisible(b.active).setPosition(b.x, b.y).setRotation(b.rot);
  const fx = G.fx;
  fx.clear();
  // Estela de la pelota según velocidad
  b.trail.unshift({ x: b.x, y: b.y });
  if (b.trail.length > 10) b.trail.pop();
  const sp = len(b.vx, b.vy);
  if (b.active && sp > 450) {
    const a = Math.min(1, (sp - 450) / 700);
    b.trail.forEach((p, i) => {
      fx.fillStyle(0xffffff, (0.25 * a * (10 - i)) / 10);
      fx.fillCircle(p.x, p.y, CFG.ballR * (1 - i / 14));
    });
  }
}

// ============================== GAME STATE ==========================
// Estado global de la partida (un solo partido a la vez).
const G = {
  acc: 0, // s, acumulador del paso fijo
  timeScale: 1, // cámara lenta en goles
  hitStop: 0, // s, congelamiento por golpe fuerte
  steps: 0, // contador de pasos de física (debug)
};

// Un paso fijo de física, subdividido si algo se mueve rápido (anti-túnel).
function step(dt) {
  G.steps++;
  const b = G.ball;
  const vmax = len(b.vx, b.vy);
  const n = clamp(Math.ceil((vmax * dt) / CFG.maxSubStep), 1, 8);
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    ballStep(b, h);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game-root',
  backgroundColor: '#05060c',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H,
  },
  scene: { create, update },
});

function create() {
  createControls(this);
  drawArena(this);
  G.fx = this.add.graphics().setDepth(6);
  G.ball = makeBall();
  G.ball.vx = 900;
  G.ball.vy = -500;
  G.ballGfx = makeBallGfx(this);
}

// Loop: tiempo real → acumulador → pasos fijos de CFG.dt. Render a la tasa del monitor.
function update(time, deltaMs) {
  const dt = Math.min(deltaMs / 1000, CFG.maxFrame);
  if (G.hitStop > 0) {
    G.hitStop -= dt;
  } else {
    G.acc += dt * G.timeScale;
    while (G.acc >= CFG.dt) {
      step(CFG.dt);
      G.acc -= CFG.dt;
    }
  }
  render(this, dt);
}
