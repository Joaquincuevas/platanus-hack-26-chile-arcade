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
  glow: false, // bool, postFX glow real (WebGL). Caro: ~3x menos FPS en GPU débil

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

  // --- Auto ---
  carR: 18, // px, radio de colisión contra la arena
  gravity: 1250, // px/s²
  driveAccel: 950, // px/s², aceleración con joystick
  brakeAccel: 2000, // px/s², al acelerar en sentido contrario
  coastDecel: 380, // px/s², frenado sin input
  maxDrive: 480, // px/s, velocidad máxima sin boost
  maxBoostSpeed: 840, // px/s, velocidad máxima con boost en superficie
  maxCarSpeed: 1050, // px/s, tope absoluto
  stickNormalY: -0.45, // si n.y > esto la superficie es pared/techo (y exige velocidad)
  stickMinSpeed: 190, // px/s, vel. tangencial mínima para seguir pegado en pared/techo
  landAlign: 0.2, // dot(arriba del auto, normal) mínimo para aterrizar en pared/techo
  stickGrace: 0.25, // s, tras aterrizar no se despega aunque vaya lento
  wallRedirect: 0.35, // fracción del impacto contra pared/techo convertida en avance hacia la nariz
  jumpSpeed: 480, // px/s, impulso del salto según la normal
  doubleJumpSpeed: 400, // px/s, segundo salto vertical
  doubleWindow: 1.2, // s, ventana para el segundo salto/flip
  flipImpulse: 580, // px/s, impulso del flip en la dirección del joystick
  flipTime: 0.42, // s, duración de la vuelta de 360°
  flipFallCut: 0.25, // factor que deja de la caída al iniciar flip (cancela caída)
  landLock: 0.12, // s, tras saltar no puede re-aterrizar (evita re-pegarse)
  airRotAccel: 26, // rad/s², rotación en el aire con ←/→
  airRotMax: 6.5, // rad/s
  airRotDamp: 7, // 1/s, frenado de rotación sin input
  boostAccel: 1500, // px/s² (mayor que gravity: permite volar)
  boostUse: 33, // unidades/s
  boostRegen: 6, // unidades/s, recarga pasiva
  boostStart: 34, // unidades al inicio de cada kickoff

  // --- Golpes ---
  carHitHalf: 13, // px, medio largo del segmento de la cápsula de golpe del auto
  carHitR: 10, // px, radio de la cápsula (cápsula total ≈ 46×20)
  carMass: 2.5, // masa relativa del auto (pelota = 1)
  hitRest: 0.55, // restitución auto–pelota
  minHit: 240, // px/s, velocidad mínima de salida de la pelota tras cualquier toque
  flipHitBonus: 420, // px/s extra a la pelota si el auto está en flip (una vez por flip)
  boostHitMul: 1.2, // multiplicador del golpe si el auto usa boost
  hitFeelMin: 500, // px/s de cambio de velocidad para hit-stop + shake
  hitStop: 0.05, // s, congelamiento en golpes fuertes
  shakeMax: 0.018, // intensidad máx. de screen shake (fracción de pantalla)

  // --- Partido ---
  countdown: 3, // s, cuenta regresiva del kickoff
  goalPause: 2.4, // s, celebración tras un gol antes del kickoff
  goalSlowMo: 0.3, // escala de tiempo durante la celebración
  goalSlowMoTime: 0.9, // s, duración de la cámara lenta
  kickoffX: 200, // px, distancia de cada auto a su pared en el kickoff
  ballSpawnY: 300, // px, altura desde donde cae la pelota en el kickoff
  matchTime: 120, // s, reloj del partido (solo corre en PLAY)
  finalCount: 10, // s, últimos segundos mostrados en grande con tick
  otMax: 90, // s, tope del tiempo extra (si nadie marca: empate, evita estado sin salida)
  mercyGoals: 5, // goles de diferencia que terminan el partido antes de tiempo
  matchIdle: 45, // s sin ningún input humano durante un partido → vuelve al MENU
  attractIdle: 20, // s sin input en el MENU → ATTRACT (demo CPU vs CPU)
  endIdle: 15, // s sin input en END → MENU
  endDelay: 1.2, // s antes de aceptar input en END (evita saltarlo sin querer)
  nameIdle: 30, // s sin input al escribir nombre → guarda lo que haya
  musicBpm: 132, // tempo de la música de partido (sube 15% en los últimos 10 s)
  musicVol: 0.6, // multiplicador de volumen de la música (0 = sin música)
  replayFrames: 90, // cuadros guardados para la repetición (~1.5 s a 60 fps)
  replaySpeed: 0.4, // velocidad de la repetición (cámara lenta)
  replayDelay: 0.9, // s de celebración antes de la repetición
  timeBonus: 2, // pts por segundo de reloj restante (si gana por diferencia antes del final)
  demoBonus: 50, // pts por demolición hecha por P1
  shotSpeed: 450, // px/s hacia el arco rival tras un toque para contar como tiro
  // --- Boost pads (en el suelo, simétricos) ---
  padSmallX: [250, 340, 460, 550], // px, posiciones de pads chicos
  padBigX: [140, 660], // px, posiciones de pads grandes
  padSmall: 12, // boost que da un pad chico
  padBig: 100, // boost que da un pad grande
  padSmallRespawn: 4, // s
  padBigRespawn: 10, // s
  padPick: 24, // px, distancia horizontal para recoger (grande: x1.3)
  padPickH: 55, // px, altura máx. del auto sobre el piso para recoger
  carCarRest: 0.3, // restitución auto–auto
  carCarMinPush: 120, // px/s, empuje mínimo entre autos al tocarse
  // --- CPU ---
  cpuReact: 0.16, // s, retardo medio entre decisiones (lo fija el preset de dificultad)
  cpuSkill: 0.6, // 0..1: ruido en salto/impacto, predicción y boost (lo fija el preset)
  cpuLook: 1.2, // s, horizonte de predicción de la pelota (simulada con ballStep)
  cpuDefendT: 1.2, // s, si la predicción entra a su arco antes de esto → DEFENDER
  cpuGuardX: 45, // px delante del extremo del travesaño donde se para a defender
  cpuRotateX: 150, // px por detrás de la pelota a donde vuelve al ROTAR
  cpuKickWait: 0, // probabilidad de que una CPU (al azar) espere defendiendo en el kickoff
  cpuKickWaitT: 1.2, // s que espera en la guardia antes de salir
  cpuShadowLead: 0, // px de ventaja del rival hacia la pelota para pasar a SOMBRA
  cpuShadowK: 0.4, // fracción de la distancia arco→pelota donde se para en SOMBRA
  cpuPassH: 130, // px: si la pelota está más alta que esto sobre el piso, pasa por debajo al rotar
  cpuShadowX: 130, // px que mantiene delante de una pelota baja mientras rota
  cpuFrontDot: 0.35, // dot mínimo (golpe hacia el arco rival) para saltar/flipear a la pelota
  cpuBehind: 25, // px que debe estar detrás de la pelota para ATACAR
  cpuReachH: 200, // px sobre el piso hasta donde intenta alcanzar la pelota
  cpuOwnDot: 0.15, // si el golpe apunta a su arco (dot > esto) no golpea: esquiva/salta
  cpuJumpNoise: 0.2, // s, retraso máx. aleatorio del salto con skill 0 (escala con 1-skill)
  cpuAimNoise: 40, // px, error máx. del punto de impacto con skill 0
  // Presets [nombre, letra, cpuReact, cpuSkill, multiplicador de puntaje]
  cpuPresets: [
    ['FÁCIL', 'F', 0.36, 0.1, 0.75],
    ['MEDIA', 'M', 0.16, 0.6, 1],
    ['DIFÍCIL', 'D', 0.09, 0.95, 1.5],
  ],
  demoSpeed: 800, // px/s del atacante para demoler (≈95% de maxBoostSpeed: supersónico)
  demoAim: 0.8, // cos del ángulo máx. entre la velocidad del atacante y la víctima
  demoRespawn: 2, // s hasta que reaparece la víctima en su lado
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
    G.lastInput = G.time;
    if (SND.ctx && SND.ctx.state === 'suspended') SND.ctx.resume();
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

// --- Tabla de puntajes (top 5) ---
const LB_KEY = 'turbogol.top5.v1';

// Filtra entradas con forma inválida (el storage persiste entre versiones).
function validTop(v) {
  if (!Array.isArray(v)) return [];
  return v
    .filter((e) => e && typeof e.n === 'string' && /^[A-Z]{3}$/.test(e.n) && Number.isFinite(e.s) && e.s > 0)
    .map((e) => ({ n: e.n, s: Math.round(e.s), d: /^[FMD]$/.test(e.d) ? e.d : '' }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 5);
}

async function loadTop() {
  try {
    const r = await storageGet(LB_KEY);
    G.top = r && r.found ? validTop(r.value) : [];
  } catch {
    G.top = [];
  }
  refreshTop();
}

function qualifies(p) {
  return G.top.length < 5 || p > G.top[G.top.length - 1].s;
}

async function saveScore(n, sc) {
  G.top = validTop([...G.top, { n, s: sc, d: CFG.cpuPresets[G.diff][1] }]);
  refreshTop();
  try {
    await storageSet(LB_KEY, G.top);
  } catch {
    // Sin storage disponible: el récord vive solo en memoria.
  }
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
  b.onFloor = false;
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
    if (c.s.ny < -0.7) b.onFloor = true;
    if (c.impact > 250) onBallBounce(b, c.impact, c.s);
  } else {
    b.spin *= Math.max(0, 1 - CFG.ballSpinDamp * dt);
  }
  b.rot += b.spin * dt;
}

// Hook de feedback para rebotes fuertes contra la arena (se completa en game feel).
function onBallBounce(b, impact, s) {
  if (G.sim) return; // predicción de la CPU: sin efectos
  const k = Math.min(1, impact / 1200);
  sfx('bounce', k);
  if (impact > 600) burst(s.px, s.py, 6 + 10 * k, 0xffffff, 120 + 200 * k, 0.3, 2);
}

// ============================== CAR =================================
// Orientación: ángulo `a` define el vector "arriba" del auto u=(sin a, -cos a) y el eje
// r=(cos a, sin a). `face` (±1) espeja el auto: la nariz apunta a face*r.
// En superficie u = normal, r = tangente t=(-n.y, n.x) y la velocidad es t*vt.
function makeCar(id) {
  return {
    id,
    color: id ? COL.p2 : COL.p1,
    keys: id ? 'P2_' : 'P1_',
    x: 0, y: 0, vx: 0, vy: 0,
    a: 0, av: 0, face: 1,
    ground: false, nx: 0, ny: -1, groundT: 0,
    latchKey: null, latch: 0,
    airT: 0, landLock: 0, canDouble: false,
    flipT: 0, spin: 0, flipHit: false,
    boost: CFG.boostStart, boosting: false,
    inp: { sx: 0, sy: 0, boost: false, jump: false },
    da: 0, dface: 1, // ángulo/escala mostrados (suavizados)
    frozen: false,
  };
}

function placeCar(c, x, face) {
  Object.assign(c, {
    x, y: CFG.arenaB - CFG.carR, vx: 0, vy: 0, a: 0, av: 0, face, dface: face, da: 0,
    ground: true, nx: 0, ny: -1, latchKey: null, latch: 0, flipT: 0,
    canDouble: false, boost: CFG.boostStart, boosting: false, dead: 0, frozen: false,
  });
}

function readInput(c, dt) {
  if (c.cpu) {
    cpuThink(c, dt);
    return;
  }
  const k = c.keys;
  c.inp.sx = (held[k + 'R'] ? 1 : 0) - (held[k + 'L'] ? 1 : 0);
  c.inp.sy = (held[k + 'D'] ? 1 : 0) - (held[k + 'U'] ? 1 : 0);
  c.inp.boost = !!held[k + '2'];
  c.inp.jump = consume(k + '1');
}

function carStep(c, dt, jumpNow) {
  if (c.frozen) return;
  c.boosting = c.inp.boost && c.boost > 0;
  if (c.boosting) c.boost = Math.max(0, c.boost - CFG.boostUse * dt);
  else c.boost = Math.min(100, c.boost + CFG.boostRegen * dt);
  if (c.ground) groundStep(c, dt, jumpNow);
  else airStep(c, dt, jumpNow);
  c.a = wrapAngle(c.a);
}

function groundStep(c, dt, jumpNow) {
  const s = closestSurface(c.x, c.y);
  const tx = -s.ny;
  const ty = s.nx;
  c.nx = s.nx;
  c.ny = s.ny;
  if (jumpNow) {
    jump(c);
    airStep(c, dt, false);
    return;
  }
  let vt = c.vx * tx + c.vy * ty;
  // Dirección del joystick proyectada a la tangente, "latcheada" mientras no cambien las
  // teclas: mantener → recorre rampa, pared y techo sin cambiar de tecla.
  const key = c.inp.sx * 3 + c.inp.sy;
  if (key !== c.latchKey) {
    c.latchKey = key;
    const d = c.inp.sx * tx + c.inp.sy * ty;
    c.latch = Math.abs(d) > 0.3 ? sign(d) : 0;
  }
  const th = c.latch;
  if (th) {
    c.face = th;
    const along = vt * th;
    if (along < 0) vt += th * CFG.brakeAccel * dt;
    else if (along < CFG.maxDrive) vt = th * Math.min(along + CFG.driveAccel * dt, CFG.maxDrive);
    else if (!c.boosting) vt = th * Math.max(CFG.maxDrive, along - CFG.coastDecel * dt);
  } else if (!c.boosting) {
    const dec = CFG.coastDecel * dt;
    vt = Math.abs(vt) <= dec ? 0 : vt - sign(vt) * dec;
  }
  if (c.boosting) {
    const along = vt * c.face;
    if (along < CFG.maxBoostSpeed) vt = c.face * Math.min(along + CFG.boostAccel * dt, CFG.maxBoostSpeed);
  }
  vt += CFG.gravity * ty * dt; // componente tangencial de la gravedad (rampas)
  vt = clamp(vt, -CFG.maxCarSpeed, CFG.maxCarSpeed);
  // Pared/techo sin velocidad suficiente → se despega.
  c.groundT += dt;
  if (s.ny > CFG.stickNormalY && Math.abs(vt) < CFG.stickMinSpeed && c.groundT > CFG.stickGrace) {
    c.ground = false;
    c.vx = tx * vt + s.nx * 60;
    c.vy = ty * vt + s.ny * 60;
    leaveGround(c, false);
    return;
  }
  // Avanzar por la tangente y re-proyectar sobre la superficie.
  c.x += tx * vt * dt;
  c.y += ty * vt * dt;
  attach(c, vt);
}

// Pega el auto a la superficie más cercana conservando la velocidad tangencial vt.
function attach(c, vt) {
  const s = closestSurface(c.x, c.y);
  c.x += s.nx * (CFG.carR - s.dist);
  c.y += s.ny * (CFG.carR - s.dist);
  c.nx = s.nx;
  c.ny = s.ny;
  c.vx = -s.ny * vt;
  c.vy = s.nx * vt;
  c.a = Math.atan2(s.nx, -s.ny);
}

function leaveGround(c, jumped) {
  c.ground = false;
  c.airT = 0;
  c.av = 0;
  c.canDouble = true; // el segundo salto también sirve si cayó sin saltar
  c.landLock = jumped ? CFG.landLock : 0.05;
}

function jump(c) {
  c.vx += c.nx * CFG.jumpSpeed;
  c.vy += c.ny * CFG.jumpSpeed;
  leaveGround(c, true);
  sfx('jump');
  burst(c.x - c.nx * CFG.carR, c.y - c.ny * CFG.carR, 8, 0xffffff, 140, 0.3, 3);
}

// Segundo salto: sin dirección = doble salto vertical; con dirección = flip/dodge.
function secondJump(c) {
  c.canDouble = false;
  const { sx, sy } = c.inp;
  if (!sx && !sy) {
    c.vy = Math.min(c.vy, 0) - CFG.doubleJumpSpeed;
    sfx('jump2');
    burst(c.x, c.y + 10, 10, c.color, 160, 0.35, 3);
    return;
  }
  const d = norm(sx, sy, 0, -1);
  if (c.vy > 0) c.vy *= CFG.flipFallCut;
  c.vx += d.x * CFG.flipImpulse;
  c.vy += d.y * CFG.flipImpulse;
  c.flipT = CFG.flipTime;
  c.flipHit = false;
  c.spin = sx ? sign(sx) : sy < 0 ? -c.face : c.face;
  c.av = 0;
  sfx('flip');
  burst(c.x, c.y, 14, c.color, 220, 0.4, 3);
}

function airStep(c, dt, jumpNow) {
  c.airT += dt;
  c.landLock -= dt;
  if (jumpNow && c.canDouble && c.airT < CFG.doubleWindow) secondJump(c);
  if (c.flipT > 0) {
    c.flipT -= dt;
    c.a += ((c.spin * Math.PI * 2) / CFG.flipTime) * dt;
  } else {
    // Pitch: ← antihorario, → horario.
    if (c.inp.sx) c.av += c.inp.sx * CFG.airRotAccel * dt;
    else c.av *= Math.max(0, 1 - CFG.airRotDamp * dt);
    c.av = clamp(c.av, -CFG.airRotMax, CFG.airRotMax);
    c.a += c.av * dt;
  }
  c.vy += CFG.gravity * dt;
  if (c.boosting) {
    c.vx += c.face * Math.cos(c.a) * CFG.boostAccel * dt;
    c.vy += c.face * Math.sin(c.a) * CFG.boostAccel * dt;
  }
  const sp = len(c.vx, c.vy);
  if (sp > CFG.maxCarSpeed) {
    c.vx *= CFG.maxCarSpeed / sp;
    c.vy *= CFG.maxCarSpeed / sp;
  }
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  const s = closestSurface(c.x, c.y);
  if (s.dist >= CFG.carR) return;
  const up = Math.sin(c.a) * s.nx - Math.cos(c.a) * s.ny; // dot(arriba, normal)
  const vn = c.vx * s.nx + c.vy * s.ny;
  // Aterriza si las ruedas miran a la superficie (en el piso siempre: arcade).
  if (c.landLock <= 0 && vn <= 1 && (up > CFG.landAlign || s.ny < -0.7)) {
    land(c, -vn, s);
  } else {
    resolveCircle(c, CFG.carR, s, 0.25, 0.1, 30);
    c.av += sign(c.vx * -s.ny + c.vy * s.nx) * 2;
  }
}

function land(c, impact, s) {
  c.ground = true;
  c.flipT = 0;
  c.av = 0;
  c.canDouble = false;
  c.latchKey = null;
  c.groundT = 0;
  let vt = c.vx * -s.ny + c.vy * s.nx;
  if (s.ny > CFG.stickNormalY) vt += c.face * impact * CFG.wallRedirect;
  attach(c, vt);
  if (impact > 120) {
    const k = Math.min(1, impact / 900);
    burst(s.px, s.py, 4 + k * 14, 0x9aa0ff, 80 + 200 * k, 0.35, 3);
    sfx('land', k);
  }
}

// ============================== COLLISIONS ==========================
// Auto (cápsula a lo largo de su eje) contra pelota (círculo).
function carBall(c, b) {
  if (c.frozen || !b.active) return;
  const ax = Math.cos(c.a);
  const ay = Math.sin(c.a);
  const k = clamp((b.x - c.x) * ax + (b.y - c.y) * ay, -CFG.carHitHalf, CFG.carHitHalf);
  const px = c.x + ax * k;
  const py = c.y + ay * k;
  const rr = CFG.carHitR + CFG.ballR;
  const d = len(b.x - px, b.y - py);
  if (d >= rr) return;
  const n = norm(b.x - px, b.y - py, Math.sin(c.a), -Math.cos(c.a));
  // Separar: la pelota (liviana) se mueve más.
  const pen = rr - d;
  const mc = CFG.carMass;
  b.x += n.x * pen * (mc / (mc + 1));
  b.y += n.y * pen * (mc / (mc + 1));
  c.x -= n.x * pen * (1 / (mc + 1));
  c.y -= n.y * pen * (1 / (mc + 1));
  const rel = (b.vx - c.vx) * n.x + (b.vy - c.vy) * n.y;
  if (rel >= CFG.minHit) return; // ya se separan rápido
  // Impulso por velocidad relativa normal (masa pelota = 1).
  const j = rel < 0 ? (-(1 + CFG.hitRest) * rel) / (1 + 1 / mc) : 0;
  let dvb = j;
  const after = rel + j * (1 + 1 / mc);
  if (after < CFG.minHit) dvb += CFG.minHit - after; // todo toque se siente
  if (c.boosting) dvb *= CFG.boostHitMul;
  let bx = n.x * dvb;
  let by = n.y * dvb;
  if (c.flipT > 0 && !c.flipHit) {
    c.flipHit = true;
    bx += n.x * CFG.flipHitBonus;
    by += n.y * CFG.flipHitBonus;
  }
  b.vx += bx;
  b.vy += by;
  // Estadísticas: último toque (posesión) y tiro = pelota sale fuerte hacia el arco rival.
  G.lastTouch = c.id;
  const dir = c.id ? -1 : 1;
  if (G.mode === 'play' && b.vx * dir > CFG.shotSpeed && G.time - (c.lastShot || 0) > 0.5) {
    c.lastShot = G.time;
    G.st.shots[c.id]++;
  }
  c.vx -= (n.x * j) / mc;
  c.vy -= (n.y * j) / mc;
  if (c.ground) {
    // En superficie solo conserva la componente tangencial.
    const vt = c.vx * -c.ny + c.vy * c.nx;
    c.vx = -c.ny * vt;
    c.vy = c.nx * vt;
  }
  hitFeel(b.x - n.x * CFG.ballR, b.y - n.y * CFG.ballR, len(bx, by), c.color);
}

// Auto contra auto: círculos con empuje simple.
function carCar(c1, c2) {
  if (c1.frozen || c2.frozen) return;
  const rr = CFG.carR * 2;
  const d = len(c2.x - c1.x, c2.y - c1.y);
  if (d >= rr) return;
  const n = norm(c2.x - c1.x, c2.y - c1.y, c1.x < A.cx ? 1 : -1, 0);
  // Demolición: el atacante va supersónico y apuntando a la víctima.
  for (const [att, vic, sg] of [
    [c1, c2, 1],
    [c2, c1, -1],
  ]) {
    const sp = len(att.vx, att.vy);
    if (sp >= CFG.demoSpeed && ((att.vx * n.x + att.vy * n.y) * sg) / sp > CFG.demoAim) {
      demolish(vic, att);
      return;
    }
  }
  const pen = (rr - d) / 2;
  c1.x -= n.x * pen;
  c1.y -= n.y * pen;
  c2.x += n.x * pen;
  c2.y += n.y * pen;
  const rel = (c2.vx - c1.vx) * n.x + (c2.vy - c1.vy) * n.y;
  if (rel >= CFG.carCarMinPush) return;
  const j = Math.max((-(1 + CFG.carCarRest) * rel) / 2, (CFG.carCarMinPush - rel) / 2);
  for (const [c, sg] of [
    [c1, -1],
    [c2, 1],
  ]) {
    c.vx += n.x * j * sg;
    c.vy += n.y * j * sg;
    if (c.ground) {
      const vt = c.vx * -c.ny + c.vy * c.nx;
      c.vx = -c.ny * vt;
      c.vy = c.nx * vt;
    }
  }
  if (j > 150) {
    sfx('bump', Math.min(1, j / 600));
    burst((c1.x + c2.x) / 2, (c1.y + c2.y) / 2, 8, 0xffffff, 200, 0.25, 2);
  }
}

// La víctima explota y reaparece en su lado tras CFG.demoRespawn.
function demolish(v, att) {
  v.dead = CFG.demoRespawn;
  v.frozen = true;
  v.boosting = false;
  if (G.st) G.st.demos[att.id]++;
  burst(v.x, v.y, 70, v.color, 600, 1, 4);
  burst(v.x, v.y, 40, 0xff8a30, 400, 0.8, 4);
  burst(v.x, v.y, 20, 0xffffff, 250, 0.6, 3);
  shake(400, 0.03);
  G.hitStop = 0.09;
  G.lastStop = G.time;
  sfx('boom');
  showBig('¡DEMOLIDO!', att.id ? '#ff6ec7' : '#e1ff00', 1000);
}

function respawnStep(dt) {
  for (const c of G.cars) {
    if (c.dead > 0 && (c.dead -= dt) <= 0) {
      placeCar(c, c.id ? CFG.arenaR - CFG.kickoffX : CFG.arenaL + CFG.kickoffX, c.id ? -1 : 1);
      burst(c.x, c.y, 16, c.color, 200, 0.5, 3);
    }
  }
}

// Feedback de golpe: hit-stop, shake, partículas y sonido según la fuerza (px/s).
function hitFeel(x, y, f, color) {
  const k = Math.min(1, f / 1400);
  if (G.time - G.lastHit > 0.06) {
    sfx('hit', k);
    G.lastHit = G.time;
  }
  burst(x, y, 6 + 26 * k, color, 150 + 400 * k, 0.45, 3);
  burst(x, y, 4 + 10 * k, 0xffffff, 100 + 300 * k, 0.3, 2);
  if (f > CFG.hitFeelMin && G.time - G.lastStop > 0.2) {
    G.lastStop = G.time;
    G.hitStop = CFG.hitStop * (0.6 + 0.4 * k);
    shake(80 + 160 * k, CFG.shakeMax * k);
  }
}

function shake(ms, intensity) {
  if (G.cam) G.cam.shake(ms, intensity, true);
}

// ============================== PADS ================================
const PADS = [
  ...CFG.padSmallX.map((x) => ({ x, big: false, t: 0 })),
  ...CFG.padBigX.map((x) => ({ x, big: true, t: 0 })),
];

// t > 0: en cooldown. Un auto que pasa por encima recoge si no tiene el boost lleno.
function padsStep(dt) {
  for (const p of PADS) {
    if (p.t > 0) {
      p.t -= dt;
      continue;
    }
    for (const c of G.cars) {
      if (c.frozen || c.boost >= 100) continue;
      if (Math.abs(c.x - p.x) > CFG.padPick * (p.big ? 1.3 : 1) || c.y < CFG.arenaB - CFG.padPickH) continue;
      c.boost = Math.min(100, c.boost + (p.big ? CFG.padBig : CFG.padSmall));
      p.t = p.big ? CFG.padBigRespawn : CFG.padSmallRespawn;
      burst(p.x, CFG.arenaB - 6, p.big ? 26 : 10, COL.accent, p.big ? 260 : 150, 0.5, 3);
      if (c.id === 0 || !c.cpu) sfx('pad', p.big ? 1 : 0.5);
      break;
    }
  }
}

function drawPads(fx) {
  const y = CFG.arenaB - 4;
  for (const p of PADS) {
    const r = p.big ? 14 : 8;
    if (p.t > 0) {
      // Cooldown: anillo tenue que se completa
      const k = 1 - p.t / (p.big ? CFG.padBigRespawn : CFG.padSmallRespawn);
      fx.lineStyle(2, 0x555a80, 0.8);
      fx.beginPath();
      fx.arc(p.x, y, r, Math.PI, Math.PI + Math.PI * k);
      fx.strokePath();
    } else {
      const pulse = 0.5 + 0.5 * Math.sin(G.time * 6 + p.x);
      fx.fillStyle(COL.accent, 0.12 + 0.1 * pulse);
      fx.fillCircle(p.x, y, r * 2.2);
      fx.fillStyle(COL.accent, 0.35);
      fx.fillCircle(p.x, y, r * 1.4);
      fx.fillStyle(p.big ? 0xffffff : COL.accent, 1);
      fx.fillCircle(p.x, y, r * 0.7);
    }
  }
}

// ============================== CPU =================================
// Genera inputs virtuales en c.inp (las mismas acciones que un jugador); no toca la física.
// Cada ~cpuReact s planifica con una predicción de la pelota y elige un rol:
//  DEFENDER si la pelota entra a su arco pronto, ATACAR si está detrás de la pelota,
//  ROTAR (volver hacia su arco sin tocarla) en otro caso.

// Simula una copia de la pelota con la misma física; puntos cada 1/30 s.
function predictBall(T) {
  const p = { ...G.ball, trail: null };
  const pts = [];
  G.sim = true;
  for (let t = 1 / 60, n = 0; t <= T; t += 1 / 60, n++) {
    ballStep(p, 1 / 60);
    if (n & 1) pts.push({ x: p.x, y: p.y, t });
  }
  G.sim = false;
  return pts;
}

function cpuPlan(c, ai, dir, k) {
  ai.t = CFG.cpuReact * (0.6 + Math.random() * 0.8);
  const b = G.ball;
  const path = predictBall(CFG.cpuLook * (0.5 + 0.5 * k));
  const mouth = (c.id ? CFG.arenaR : CFG.arenaL) + dir * CFG.goalD;
  const guard = mouth + dir * CFG.cpuGuardX;
  const into = path.find((p) => p.y > A.barY && (p.x - mouth) * dir < 0);
  const speed = CFG.maxDrive + (c.boost > 20 ? 250 : 0);
  // Primer punto alcanzable a tiempo y a altura de golpe.
  const P =
    path.find((p) => Math.abs(p.x - c.x) / speed <= p.t + 0.1 && p.y > CFG.arenaB - CFG.cpuReachH) ||
    path[path.length - 1] ||
    b;
  ai.def = (into && into.t < CFG.cpuDefendT) || G.time < ai.wait;
  const goalSide = (P.x - c.x) * dir > CFG.cpuBehind;
  let tx;
  // SOMBRA: el rival llega antes a la pelota y ataca hacia mi arco → no disputarla,
  // quedarse entre la pelota y el arco propio, más cerca del arco.
  const o = G.cars[1 - c.id];
  const shadow =
    !o.dead && Math.abs(o.x - b.x) < Math.abs(c.x - b.x) - CFG.cpuShadowLead && (b.x - o.x) * dir < 0;
  if (shadow && goalSide && !ai.def) {
    ai.role = 'SHD';
    tx = guard + dir * clamp((b.x - guard) * dir * CFG.cpuShadowK, 0, 260);
  } else if (G.time < ai.wait) {
    ai.role = 'DEF'; // kickoff defensivo
    tx = guard;
  } else if (goalSide) {
    // ATACAR (o despejar defendiendo): llegar por detrás del punto de impacto.
    ai.role = ai.def ? 'DEF' : 'ATK';
    tx = P.x - dir * CFG.ballR * 0.5 + (Math.random() - 0.5) * CFG.cpuAimNoise * (1 - k);
  } else {
    // ROTAR: volver detrás de la pelota pasando por debajo si va alta; si va baja,
    // acompañarla a distancia sin tocarla. Con peligro, directo a la guardia del arco.
    ai.role = ai.def ? 'DEF' : 'ROT';
    tx = ai.def
      ? guard
      : b.y < CFG.arenaB - CFG.cpuPassH
        ? P.x - dir * CFG.cpuRotateX
        : b.x + dir * CFG.cpuShadowX;
    if ((tx - guard) * dir < 0) tx = guard;
  }
  ai.tx = clamp(tx, CFG.arenaL + 40, CFG.arenaR - 40);
  ai.urgent = ai.def || Math.abs(ai.tx - c.x) > 300 - 140 * k;
}

function cpuThink(c, dt) {
  const i = c.inp;
  const ai = c.ai || (c.ai = { t: 0, tx: c.x, jt: -9, over: -9, rev: 0, jq: -1, wait: 0 });
  const b = G.ball;
  const k = CFG.cpuSkill;
  const dir = c.id ? -1 : 1; // hacia el arco rival
  i.jump = false;
  i.sy = 0;
  i.boost = false;
  ai.t -= dt;
  if (ai.t <= 0) cpuPlan(c, ai, dir, k);
  const dx = b.x - c.x;
  const dy = c.y - b.y; // > 0: pelota arriba del auto
  const d = len(dx, dy) || 1;
  // Hacia dónde saldría la pelota si la toca ahora (normal auto→pelota).
  const own = (-dx / d) * dir > CFG.cpuOwnDot; // apunta a su propio arco
  const front = (dx / d) * dir > CFG.cpuFrontDot; // apunta al arco rival
  // Pelota que viene de frente hacia el auto (tiro rival): se puede bloquear saltando.
  const incoming = b.vx * dir < -100 && dx * dir > -20;
  if (c.ground) {
    const wall = c.ny > -0.5; // en pared/techo no insiste: se deja caer
    const ddx = ai.tx - c.x;
    i.sx = wall || Math.abs(ddx) < 12 ? 0 : sign(ddx);
    i.boost = !wall && ai.urgent && c.boost > 5 && i.sx === c.face;
    // Velocidad de acercamiento a la pelota (relativa) para cronometrar el salto por encima.
    const vr = (c.vx - b.vx) * sign(dx);
    const close = Math.abs(dx) < 0.25 * vr + 75 && dy < 90 && sign(dx) === i.sx;
    if (own && close) {
      // Anti-autogol: saltar por encima si se acerca rápido; si no, retroceder.
      if (vr > 230) {
        i.jump = true;
        ai.over = G.time;
      } else if (Math.abs(dx) < 110) ai.rev = 0.3;
      else i.boost = c.boost > 0; // tomar impulso para el salto
    } else if (!front && Math.abs(dx) < 50 && dy > 60 && b.vy > 0) {
      // Pelota cayendo encima sin ángulo de ataque: apartarse hacia su lado del campo.
      i.sx = -dir;
    } else if (
      (front && Math.abs(dx) < 55 + 50 * k && dy > 30 && dy < 190) ||
      (incoming && dy > 30 && dy < 200 && Math.abs(dx) / (Math.abs(b.vx - c.vx) + 1) < 0.1 + dy / 700)
    ) {
      // Saltar a la pelota con un retraso aleatorio (más error con menos skill).
      if (ai.jq < 0) ai.jq = G.time + Math.random() * CFG.cpuJumpNoise * (1 - k);
      if (G.time >= ai.jq) {
        i.jump = true;
        ai.jt = G.time;
        ai.jq = -1;
      }
    } else ai.jq = -1;
    if ((ai.rev -= dt) > 0) {
      i.sx = -sign(dx);
      i.boost = false;
    }
    return;
  }
  const since = G.time - ai.jt;
  // Saltando por encima de la pelota: doble salto para ganar altura.
  if (G.time - ai.over < 0.6 && c.canDouble && G.time - ai.over > 0.12 && dy < 30) {
    i.sx = 0;
    i.jump = true;
    return;
  }
  // Flip hacia el arco rival si la pelota está delante y a tiro.
  if (c.canDouble && (front || incoming) && since > 0.1 && since < 1 && d < 85 + 35 * k) {
    i.sx = dir;
    i.sy = dy > 45 ? -1 : dy < -30 ? 1 : 0;
    if (dy > 70 && Math.abs(dx) < 30) i.sx = i.sy = 0; // pelota encima: doble salto
    i.jump = true;
    return;
  }
  // Mantenerse derecho para aterrizar sobre las ruedas.
  const err = wrapAngle(c.a);
  i.sx = Math.abs(err) > 0.25 ? -sign(err) : 0;
}

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
  // Halo barato (sustituto del glow)
  g.fillStyle(0xffffff, 0.08);
  g.fillCircle(0, 0, r + 9);
  g.fillStyle(0xffffff, 0.15);
  g.fillCircle(0, 0, r + 4);
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

// Gráfico del auto en coordenadas locales: nariz hacia +x, ruedas hacia +y.
// El centro (0,0) es el centro del círculo de colisión; las ruedas tocan y=+carR.
function makeCarGfx(scene, c) {
  const g = scene.add.graphics().setDepth(10);
  const col = c.color;
  // Halo barato
  g.fillStyle(col, 0.07);
  g.fillRoundedRect(-30, -16, 60, 37, 16);
  // Alerón
  g.fillStyle(col, 1);
  g.fillRect(-23, -6, 5, 7);
  // Cabina
  g.fillStyle(0x10121f, 1);
  g.lineStyle(2, col, 1);
  const cab = [
    { x: -12, y: 0 },
    { x: -6, y: -9 },
    { x: 8, y: -9 },
    { x: 15, y: 0 },
  ];
  g.fillPoints(cab, true);
  g.strokePoints(cab, true);
  // Carrocería
  g.fillStyle(col, 1);
  g.fillPoints(
    [
      { x: -22, y: 0 },
      { x: 17, y: 0 },
      { x: 23, y: 5 },
      { x: 23, y: 11 },
      { x: -22, y: 11 },
    ],
    true
  );
  g.fillStyle(0x000000, 0.35);
  g.fillRect(-22, 7, 45, 4);
  // Faro
  g.fillStyle(0xffffff, 1);
  g.fillRect(19, 3, 4, 3);
  // Ruedas
  for (const wx of [-13, 13]) {
    g.fillStyle(0x15161f, 1);
    g.fillCircle(wx, 12, 6);
    g.lineStyle(2, 0xdddddd, 1);
    g.strokeCircle(wx, 12, 3);
  }
  addGlow(g, col, 2);
  return g;
}

// --- Partículas propias (dibujadas en un Graphics compartido) ---
const parts = [];
function burst(x, y, n, color, speed, life, size) {
  for (let i = 0; i < n && parts.length < 400; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: life, life, color, size });
  }
}
// Partícula con velocidad dada (estelas de boost).
function spark(x, y, vx, vy, color, life, size) {
  if (parts.length < 400) parts.push({ x, y, vx, vy, t: life, life, color, size });
}
function drawParticles(fx, dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.t -= dt;
    if (p.t <= 0) {
      parts.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2 * dt;
    p.vy *= 1 - 2 * dt;
    const k = p.t / p.life;
    fx.fillStyle(p.color, k);
    fx.fillRect(p.x - p.size * k, p.y - p.size * k, p.size * 2 * k, p.size * 2 * k);
  }
}

// Llama de boost detrás del auto.
function drawFlame(fx, c) {
  const fx_ = c.face * Math.cos(c.da);
  const fy_ = c.face * Math.sin(c.da);
  const ux = Math.sin(c.da);
  const uy = -Math.cos(c.da);
  const bx = c.x - fx_ * 23 - ux * 3;
  const by = c.y - fy_ * 23 - uy * 3;
  const L = 18 + Math.random() * 14;
  fx.fillStyle(c.color, 0.9);
  fx.fillTriangle(bx + ux * 6, by + uy * 6, bx - ux * 3, by - uy * 3, bx - fx_ * L, by - fy_ * L);
  fx.fillStyle(0xffffff, 0.9);
  fx.fillTriangle(bx + ux * 3, by + uy * 3, bx, by, bx - fx_ * L * 0.5, by - fy_ * L * 0.5);
  spark(bx, by, -fx_ * 260 + (Math.random() - 0.5) * 80, -fy_ * 260 + (Math.random() - 0.5) * 80, c.color, 0.3, 3);
}

// Reproduce un cuadro del buffer con franjas de cine y etiqueta.
function drawReplay(dt) {
  const R = G.replay;
  const f = R.f[Math.min(R.f.length - 1, Math.floor(R.i))];
  G.ballGfx.setVisible(true).setPosition(f[0], f[1]).setRotation(f[2]);
  const fx = G.fx;
  fx.clear();
  G.cars.forEach((c, i) => {
    const o = 3 + i * 6;
    c.gfx.setVisible(!f[o + 4]).setPosition(f[o], f[o + 1]).setRotation(f[o + 2]).setScale(f[o + 3], 1);
    if (f[o + 5]) {
      const ax = Math.cos(f[o + 2]) * f[o + 3];
      const ay = Math.sin(f[o + 2]) * f[o + 3];
      spark(f[o] - ax * 24, f[o + 1] - ay * 24, -ax * 120, -ay * 120, c.color, 0.25, 3);
    }
  });
  drawParticles(fx, dt * CFG.replaySpeed);
  fx.fillStyle(0x000000, 1);
  fx.fillRect(0, 0, W, 62);
  fx.fillRect(0, H - 12, W, 12);
  if (Math.floor(G.time * 2) % 2) {
    fx.fillStyle(0xff3030, 1);
    fx.fillCircle(30, 32, 7);
  }
}

// Render de objetos dinámicos (a tasa de pantalla).
function render(scene, dt) {
  const b = G.ball;
  if (G.replay) {
    drawReplay(dt);
    return;
  }
  G.ballGfx.setVisible(b.active).setPosition(b.x, b.y).setRotation(b.rot);
  const fx = G.fx;
  fx.clear();
  for (const c of G.cars) {
    // Ángulo mostrado: directo en el aire, suavizado en superficie (aterrizajes).
    c.da = c.ground ? c.da + wrapAngle(c.a - c.da) * Math.min(1, 30 * dt) : c.a;
    // Giro visual al cambiar de sentido (escala X pasa por 0).
    c.dface += clamp(c.face - c.dface, -14 * dt, 14 * dt);
    c.gfx.setVisible(!c.dead).setPosition(c.x, c.y).setRotation(c.da).setScale(c.dface, 1);
    if (c.boosting && !c.frozen) drawFlame(fx, c);
    engineUpdate(c);
  }
  drawPads(fx);
  drawParticles(fx, dt);
  // Buffer para la repetición de goles.
  if (G.mode === 'play' && !G.demo) {
    G.rec.push([b.x, b.y, b.rot, ...G.cars.flatMap((c) => [c.x, c.y, c.da, c.dface, c.dead, c.boosting])]);
    if (G.rec.length > CFG.replayFrames) G.rec.shift();
  }
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

// ============================== AUDIO ===============================
// Todo generado con Web Audio (osciladores + ruido). Silencioso si no hay contexto.
const SND = { ctx: null, out: null, noise: null, loops: [] };

function audioInit(scene) {
  const ctx = scene.sound && scene.sound.context;
  if (!ctx) return;
  SND.ctx = ctx;
  SND.out = ctx.createGain();
  SND.out.gain.value = 0.5;
  SND.out.connect(ctx.destination);
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  SND.noise = buf;
}

function audioOk() {
  return SND.ctx && SND.ctx.state === 'running';
}

// Tono con barrido de frecuencia f0→f1 y envolvente exponencial.
function tone(f0, f1, dur, type, vol, delay = 0) {
  if (!audioOk()) return;
  const c = SND.ctx;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(SND.out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// Ráfaga de ruido filtrado.
function noise(dur, vol, freq, type = 'lowpass', delay = 0) {
  if (!audioOk()) return;
  const c = SND.ctx;
  const t = c.currentTime + delay;
  const s = c.createBufferSource();
  s.buffer = SND.noise;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(SND.out);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

// Efectos con nombre. k: intensidad 0..1.
function sfx(name, k = 1) {
  // En la demo de fondo solo suenan la UI y (en attract) los goles.
  if (G.demo && name !== 'ui' && !(name === 'goal' && G.screen === 'attract')) return;
  if (name === 'ui') tone(660, 990, 0.07, 'square', 0.05);
  else if (name === 'pad') tone(500, 1000 + 600 * k, 0.12, 'sine', 0.07);
  else if (name === 'tick') tone(1200, 1200, 0.06, 'square', 0.06);
  else if (name === 'end') [784, 659, 523, 1047].forEach((f, i) => tone(f, f, 0.3, 'triangle', 0.08, i * 0.15));
  else if (name === 'jump') tone(260, 520, 0.1, 'square', 0.05);
  else if (name === 'jump2') tone(380, 760, 0.1, 'square', 0.05);
  else if (name === 'flip') {
    tone(300, 900, 0.18, 'triangle', 0.08);
    noise(0.2, 0.08, 2500, 'bandpass');
  } else if (name === 'land') {
    tone(110, 45, 0.1, 'sine', 0.15 * k + 0.05);
    noise(0.06, 0.05 + 0.1 * k, 900);
  } else if (name === 'hit') {
    tone(160, 50, 0.16, 'sine', 0.2 + 0.4 * k);
    noise(0.1 + 0.1 * k, 0.12 + 0.3 * k, 1200 + 3000 * k);
  } else if (name === 'bounce') {
    tone(140, 70, 0.08, 'sine', 0.12 * k);
  } else if (name === 'boom') {
    noise(0.8, 0.6, 700);
    tone(120, 25, 0.7, 'sawtooth', 0.35);
  } else if (name === 'bump') {
    noise(0.08, 0.15 * k, 600);
  } else if (name === 'beep') tone(440, 440, 0.15, 'square', 0.06);
  else if (name === 'go') tone(880, 880, 0.35, 'square', 0.07);
  else if (name === 'goal') {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.25, 'square', 0.07, i * 0.09));
    noise(0.9, 0.35, 1800);
    tone(90, 30, 0.6, 'sine', 0.5);
  }
}

// Música de partido: bajo + bombo/caja/hi-hat en 16 corcheas, programada con lookahead.
const BASS = [0, 0, 12, 0, 3, 0, 10, 7, 5, 5, 17, 5, 8, 7, 3, 2];
function musicUpdate() {
  if (!audioOk() || G.screen !== 'match' || !CFG.musicVol) return;
  const now = SND.ctx.currentTime;
  if (!(SND.next > now)) SND.next = now + 0.05;
  const v = CFG.musicVol;
  while (SND.next < now + 0.12) {
    const n = (SND.step = ((SND.step || 0) + 1) % 16);
    const t = SND.next - now;
    if (n % 4 === 0) tone(120, 40, 0.14, 'sine', 0.22 * v, t);
    if (n % 8 === 4) noise(0.09, 0.07 * v, 1600, 'highpass', t);
    else if (n % 2) noise(0.025, 0.025 * v, 7000, 'highpass', t);
    const f = 55 * Math.pow(2, BASS[n] / 12);
    tone(f, f, 0.16, 'triangle', 0.09 * v, t);
    SND.next += 30 / (CFG.musicBpm * (G.clock <= CFG.finalCount && !G.ot ? 1.15 : 1));
  }
}

// Motor + boost continuos por auto (nodos persistentes con ganancia modulada).
function engineUpdate(c) {
  if (!audioOk()) return;
  const ctx = SND.ctx;
  let L = SND.loops[c.id];
  if (!L) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const lp = ctx.createBiquadFilter();
    lp.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(lp).connect(g).connect(SND.out);
    o.start();
    const n = ctx.createBufferSource();
    n.buffer = SND.noise;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = c.id ? 1500 : 1100;
    const bg = ctx.createGain();
    bg.gain.value = 0;
    n.connect(bp).connect(bg).connect(SND.out);
    n.start();
    L = SND.loops[c.id] = { o, g, bg };
  }
  const t = ctx.currentTime;
  const sp = len(c.vx, c.vy);
  const on = !c.frozen && !G.demo;
  L.o.frequency.setTargetAtTime(45 + sp * 0.14 + (c.id ? 8 : 0), t, 0.05);
  L.g.gain.setTargetAtTime(on ? 0.015 + Math.min(sp, 900) * 0.00004 : 0, t, 0.08);
  L.bg.gain.setTargetAtTime(on && c.boosting ? 0.1 : 0, t, 0.04);
}

// ============================== UI ==================================
const FONT = 'monospace';

function createUI(scene) {
  const st = (size, color) => ({ fontFamily: FONT, fontSize: size + 'px', fontStyle: 'bold', color, align: 'center' });
  const tx = (x, y, t, size, color, depth = 30) => scene.add.text(x, y, t, st(size, color)).setOrigin(0.5).setDepth(depth);
  G.ui = {
    score: [tx(330, 36, '0', 40, '#e1ff00'), tx(470, 36, '0', 40, '#ff6ec7')],
    clock: tx(W / 2, 30, '2:00', 22, '#ffffff'),
    ot: tx(W / 2, 54, '', 11, '#ff5050'),
    tag: [tx(40, 20, 'P1', 14, '#e1ff00'), tx(W - 40, 20, 'P2', 14, '#ff6ec7')],
    big: tx(W / 2, 250, '', 96, '#ffffff', 40).setAlpha(0),
    hud: scene.add.graphics().setDepth(30),
    dbg: scene.add.text(26, 82, '', { fontFamily: FONT, fontSize: '11px', color: '#00ffff' }).setDepth(51),
    // Pantallas (menú, attract, fin, nombre)
    dim: scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(60),
    title: tx(W / 2, 140, 'TURBO GOL', 84, '#e1ff00', 61).setStroke('#ff6ec7', 6),
    opts: [tx(W / 2, 265, '', 26, '#ffffff', 61), tx(W / 2, 305, '', 26, '#ffffff', 61)],
    help: tx(W / 2, 385, 'JOYSTICK mover / rotar   BOTÓN 1 saltar / flip   BOTÓN 2 turbo\n<- / -> dificultad (1 jugador)', 13, '#9aa0ff', 61),
    press: tx(W / 2, 270, 'PRESIONA START', 34, '#ffffff', 61),
    top: tx(W / 2, 480, '', 16, '#ffffff', 61),
    panel: tx(W / 2, 300, '', 22, '#ffffff', 61).setLineSpacing(8),
    rep: tx(W / 2, 92, 'REPETICIÓN', 24, '#ff5050', 31).setVisible(false),
  };
  G.dbg = scene.add.graphics().setDepth(50);
  scene.tweens.add({ targets: G.ui.title, scale: 1.07, angle: 2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
}

// Visibilidad/posición de los elementos según la pantalla actual.
function refreshPanels() {
  const u = G.ui;
  const sc = G.screen;
  const menu = sc === 'menu';
  const att = sc === 'attract';
  u.dim.setVisible(sc !== 'match').setAlpha(att ? 0.3 : menu ? 0.6 : 0.78);
  u.title.setVisible(menu || att).setY(att ? 150 : 140);
  u.opts.forEach((t) => t.setVisible(menu));
  u.help.setVisible(menu);
  u.press.setVisible(att);
  u.top.setVisible(menu || att).setY(att ? 400 : 480);
  u.panel.setVisible(sc === 'end' || sc === 'name');
  if (!menu && !att) u.big.setAlpha(0);
  refreshMenu();
}

function refreshMenu() {
  ['1 JUGADOR  < ' + CFG.cpuPresets[G.diff][0] + ' >', '2 JUGADORES'].forEach((t, i) => {
    const on = G.menuSel === i;
    G.ui.opts[i].setText(on ? '> ' + t : t).setColor(on ? '#e1ff00' : '#777a99');
  });
}

function refreshTop() {
  const t = G.top.map((e, i) => i + 1 + '. ' + e.n + '  ' + String(e.s).padStart(5, ' ') + ' ' + (e.d || ' '));
  G.ui.top.setText('- TOP 5 -\n' + (t.length ? t.join('\n') : 'sin récords aún'));
}

// Texto grande central con "pop" (no tapa el menú).
function showBig(txt, color, ms) {
  if (G.screen === 'menu') return;
  const t = G.ui.big;
  G.scene.tweens.killTweensOf(t);
  t.setText(txt).setColor(color).setAlpha(1).setScale(1.6);
  G.scene.tweens.add({ targets: t, scale: 1, duration: 250, ease: 'Back.Out' });
  G.scene.tweens.add({ targets: t, alpha: 0, delay: ms * 0.6, duration: ms * 0.4 });
}

// Barras de boost, reloj y textos que parpadean.
function drawHud() {
  const g = G.ui.hud;
  g.clear();
  G.cars.forEach((c, i) => {
    const w = 200;
    const x = i ? W - 30 - w : 30;
    const y = 36;
    g.fillStyle(0x1a1d3a, 1);
    g.fillRect(x, y, w, 12);
    const f = (w * c.boost) / 100;
    g.fillStyle(c.color, c.boosting ? 1 : 0.8);
    g.fillRect(i ? x + w - f : x, y, f, 12);
    g.lineStyle(1, c.color, 0.6);
    g.strokeRect(x, y, w, 12);
  });
  const t = Math.ceil(G.clock);
  G.ui.clock
    .setText(G.ot ? 'EXTRA' : Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'))
    .setColor(G.ot || t <= CFG.finalCount ? '#ff5050' : '#ffffff');
  G.ui.rep.setVisible(!!G.replay);
  G.ui.clock.setVisible(!G.replay);
  G.ui.ot.setText(G.ot ? 'GOL DE ORO' : G.clock <= 0 && G.mode === 'play' ? 'ÚLTIMA JUGADA' : '');
  G.ui.press.setAlpha(Math.floor(G.time * 2.5) % 2 ? 1 : 0.15);
}

// Overlay de debug (P1_6): hitboxes, normales, velocidades y FPS. Apagado por defecto.
function drawDebug(scene) {
  const g = G.dbg;
  g.clear();
  G.ui.dbg.setVisible(G.debug);
  if (!G.debug) return;
  const b = G.ball;
  g.lineStyle(1, 0x00ffff, 1);
  g.strokeCircle(b.x, b.y, CFG.ballR);
  g.lineStyle(1, 0xff4040, 1);
  g.lineBetween(b.x, b.y, b.x + b.vx * 0.1, b.y + b.vy * 0.1);
  const bs = closestSurface(b.x, b.y);
  g.lineStyle(1, 0x40ff40, 0.6);
  g.lineBetween(bs.px, bs.py, bs.px + bs.nx * 30, bs.py + bs.ny * 30);
  const lines = [
    'FPS ' + scene.game.loop.actualFps.toFixed(0) + '  ' + G.screen + '/' + G.mode + '  pasos ' + G.steps,
    'pelota v=' + len(b.vx, b.vy).toFixed(0) + ' giro=' + b.spin.toFixed(1),
  ];
  for (const c of G.cars) {
    // Círculo de arena + cápsula de golpe
    g.lineStyle(1, 0x00ffff, 1);
    g.strokeCircle(c.x, c.y, CFG.carR);
    const ax = Math.cos(c.a) * CFG.carHitHalf;
    const ay = Math.sin(c.a) * CFG.carHitHalf;
    g.lineStyle(CFG.carHitR * 2, 0xffffff, 0.15);
    g.lineBetween(c.x - ax, c.y - ay, c.x + ax, c.y + ay);
    // Normal de la superficie más cercana y velocidad
    const s = closestSurface(c.x, c.y);
    g.lineStyle(2, c.ground ? 0x40ff40 : 0x408040, 1);
    g.lineBetween(s.px, s.py, s.px + s.nx * 30, s.py + s.ny * 30);
    g.lineStyle(2, 0xff4040, 1);
    g.lineBetween(c.x, c.y, c.x + c.vx * 0.1, c.y + c.vy * 0.1);
    // Nariz
    g.lineStyle(2, 0xffff00, 1);
    g.lineBetween(c.x, c.y, c.x + c.face * ax * 2.5, c.y + c.face * ay * 2.5);
    lines.push(
      'P' + (c.id + 1) + ' ' + (c.ground ? 'SUELO' : 'AIRE') + ' v=' + len(c.vx, c.vy).toFixed(0) +
        ' ang=' + ((c.a * 180) / Math.PI).toFixed(0) + ' boost=' + c.boost.toFixed(0) +
        (c.canDouble ? ' 2do:' + Math.max(0, CFG.doubleWindow - c.airT).toFixed(1) : '') +
        (c.flipT > 0 ? ' FLIP' : '')
    );
  }
  G.ui.dbg.setText(lines.join('\n'));
}

// ============================== GAME STATE ==========================
// Estado global. screen: pantalla ('attract'|'menu'|'match'|'end'|'name').
// mode: fase del partido en curso ('kickoff'|'play'|'goal'); también corre de fondo
// (demo CPU vs CPU) en menu/attract.
const G = {
  acc: 0, // s, acumulador del paso fijo
  timeScale: 1, // cámara lenta en goles
  hitStop: 0, // s, congelamiento por golpe fuerte
  steps: 0, // contador de pasos de física (debug)
  time: 0, // s, tiempo real acumulado
  lastHit: -1, // s, último sonido de golpe (evita spam)
  lastStop: -1, // s, último hit-stop (evita tartamudeo con pelota atrapada)
  lastInput: 0, // s, último input de teclado/gabinete
  screen: 'menu',
  screenT: 0, // s en la pantalla actual
  mode: 'kickoff',
  modeT: 0, // s, tiempo restante del modo
  lastCount: 0,
  score: [0, 0],
  clock: 0, // s restantes de partido
  ot: false, // tiempo extra (gol de oro)
  otT: 0,
  demo: true, // partido CPU vs CPU de fondo
  solo: true, // modo 1 jugador
  menuSel: 0,
  diff: 1, // dificultad elegida para 1P (índice en CFG.cpuPresets)
  top: [], // top 5 [{n, s}]
  st: null, // estadísticas del partido
  lastTouch: -1, // último auto que tocó la pelota
  debug: false, // overlay de debug (toggle con P1_6)
};

function setScreen(sc) {
  G.screen = sc;
  G.screenT = 0;
  G.lastInput = G.time;
  for (const k in pressed) pressed[k] = false;
  refreshPanels();
}

// Nuevo partido. demo: ambos autos CPU (fondo de menú/attract). cpu2: P2 es CPU.
// Fija cpuReact/cpuSkill según el preset (0 FÁCIL, 1 MEDIA, 2 DIFÍCIL).
function setDifficulty(i) {
  const p = CFG.cpuPresets[i];
  CFG.cpuReact = p[2];
  CFG.cpuSkill = p[3];
}

function newMatch(demo, cpu2) {
  setDifficulty(demo ? 1 : G.diff); // la demo es MEDIA vs MEDIA
  G.demo = demo;
  G.cars[0].cpu = demo;
  G.cars[1].cpu = demo || cpu2;
  G.score = [0, 0];
  G.clock = CFG.matchTime;
  G.ot = false;
  G.st = { shots: [0, 0], poss: [0, 0], demos: [0, 0] };
  G.lastTouch = -1;
  for (const p of PADS) p.t = 0;
  G.ui.score[0].setText('0');
  G.ui.score[1].setText('0');
  G.ui.tag[1].setText(cpu2 && !demo ? 'CPU' : 'P2');
  kickoff();
}

function startMatch(solo) {
  G.solo = solo;
  setScreen('match');
  newMatch(false, solo);
  sfx('ui');
}

function toMenu() {
  setScreen('menu');
  newMatch(true);
}

// Reinicia posiciones y arranca la cuenta regresiva.
function kickoff() {
  placeCar(G.cars[0], CFG.arenaL + CFG.kickoffX, 1);
  placeCar(G.cars[1], CFG.arenaR - CFG.kickoffX, -1);
  for (const c of G.cars) c.frozen = true;
  Object.assign(G.ball, { x: A.cx, y: CFG.ballSpawnY, vx: 0, vy: 0, spin: 0, rot: 0, active: true, trail: [] });
  G.mode = 'kickoff';
  G.modeT = CFG.countdown;
  G.rec = [];
  G.replay = null;
  G.replayed = false;
  G.lastCount = 0;
  G.timeScale = 1;
  G.acc = 0;
}

// Gol a favor de `scorer` (0 = P1, 1 = P2).
function goal(scorer) {
  const b = G.ball;
  G.score[scorer]++;
  G.mode = 'goal';
  G.modeT = CFG.goalPause;
  G.timeScale = CFG.goalSlowMo;
  b.active = false;
  const col = scorer ? COL.p2 : COL.p1;
  burst(b.x, b.y, 90, col, 650, 1.1, 4);
  burst(b.x, b.y, 40, 0xffffff, 450, 0.8, 3);
  shake(450, 0.03);
  if (!G.demo) G.cam.flash(250, scorer ? 255 : 225, scorer ? 110 : 255, scorer ? 199 : 0);
  sfx('goal');
  const t = G.ui.score[scorer];
  t.setText(String(G.score[scorer]));
  G.scene.tweens.add({ targets: t, scale: { from: 2.2, to: 1 }, duration: 500, ease: 'Back.Out' });
  showBig('¡GOL!', scorer ? '#ff6ec7' : '#e1ff00', 1500);
}

// Gol si el centro de la pelota pasó bajo el travesaño hasta cerca del fondo del arco.
function checkGoal() {
  const b = G.ball;
  if (!b.active || b.y < A.barY) return;
  if (b.x < CFG.arenaL + CFG.goalD - CFG.goalLine) goal(1);
  else if (b.x > CFG.arenaR - CFG.goalD + CFG.goalLine) goal(0);
}

// Reloj en 0 (y pelota en el suelo): tiempo extra si hay empate, si no fin.
function timeUp() {
  if (G.score[0] === G.score[1]) {
    G.ot = true;
    G.otT = 0;
    showBig('TIEMPO EXTRA', '#ff5050', 1600);
    kickoff();
  } else endMatch();
}

function endMatch() {
  if (G.demo) {
    newMatch(true);
    return;
  }
  const [a, b] = G.score;
  G.winner = a > b ? 0 : b > a ? 1 : -1;
  G.points = 0;
  // Puntaje 1P (solo si gana a la CPU): diferencia + reloj restante + demoliciones.
  if (G.solo && G.winner === 0) {
    G.pts = [(a - b) * 100, Math.ceil(G.clock) * CFG.timeBonus, G.st.demos[0] * CFG.demoBonus];
    G.points = Math.round((G.pts[0] + G.pts[1] + G.pts[2]) * CFG.cpuPresets[G.diff][4]);
  }
  sfx('end');
  if (G.points > 0 && qualifies(G.points)) {
    G.name = { l: [0, 0, 0], i: 0 };
    setScreen('name');
    drawName();
  } else showEnd();
}

function showEnd() {
  setScreen('end');
  const [a, b] = G.score;
  const st = G.st;
  const pt = st.poss[0] + st.poss[1] || 1;
  const p1 = Math.round((100 * st.poss[0]) / pt);
  const n2 = G.solo ? 'CPU' : 'P2';
  const win = G.winner < 0 ? 'EMPATE' : G.winner ? 'GANA ' + n2 : G.solo ? '¡GANASTE!' : 'GANA P1';
  G.ui.panel
    .setText(
      [
        'FINAL',
        'P1  ' + a + ' - ' + b + '  ' + n2 + (G.solo ? '  (' + CFG.cpuPresets[G.diff][0] + ')' : ''),
        win,
        '',
        'TIROS        ' + st.shots[0] + ' - ' + st.shots[1],
        'POSESIÓN   ' + p1 + '% - ' + (100 - p1) + '%',
        'DEMOLICIONES ' + st.demos[0] + ' - ' + st.demos[1],
        G.points ? 'PUNTAJE ' + G.points + '  ((' + G.pts.join(' + ') + ') x' + CFG.cpuPresets[G.diff][4] + ')' : '',
        '',
        'START para revancha',
      ].join('\n')
    )
    .setColor(G.winner === 1 ? '#ff6ec7' : '#e1ff00');
}

// Ingreso de nombre de 3 letras: ↑/↓ cambia letra, botón 1 confirma.
function drawName() {
  const N = G.name;
  const s = N.l.map((v, i) => (i === N.i ? '[' : ' ') + String.fromCharCode(65 + v) + (i === N.i ? ']' : ' ')).join(' ');
  G.ui.panel
    .setText('¡NUEVO RÉCORD!\n' + G.points + ' PTS\n\n' + s + '\n\nARRIBA/ABAJO letra   BOTÓN 1 confirmar')
    .setColor('#e1ff00');
}

function nameInput() {
  const N = G.name;
  const up = consume('P1_U');
  const dn = consume('P1_D');
  if (up || dn) {
    N.l[N.i] = (N.l[N.i] + (up ? 1 : 25)) % 26;
    sfx('ui');
  }
  if (consume('P1_1') || consume('START1')) {
    N.i++;
    sfx('ui');
  }
  if (N.i > 2 || G.time - G.lastInput > CFG.nameIdle) {
    saveScore(N.l.map((v) => String.fromCharCode(65 + v)).join(''), G.points);
    showEnd();
  } else if (up || dn || N.i) drawName();
}

// Pantallas fuera del partido (menú, attract, fin, nombre).
function tickScreen(dt) {
  G.screenT += dt;
  const idle = G.time - G.lastInput;
  const go = () => consume('START1') || consume('START2') || consume('P1_1');
  if (G.screen === 'attract') {
    if (Object.keys(pressed).some((k) => pressed[k])) setScreen('menu');
  } else if (G.screen === 'menu') {
    const lr = ['P1_R', 'P2_R'].filter(consume).length - ['P1_L', 'P2_L'].filter(consume).length;
    if (lr) {
      G.diff = clamp(G.diff + lr, 0, 2);
      refreshMenu();
      sfx('ui');
    }
    const mv = ['P1_U', 'P1_D', 'P2_U', 'P2_D'].filter(consume).length;
    if (mv) {
      G.menuSel ^= mv & 1;
      refreshMenu();
      sfx('ui');
    }
    if (go()) startMatch(G.menuSel === 0);
    else if (idle > CFG.attractIdle) {
      setScreen('attract');
      newMatch(true);
    }
  } else if (G.screen === 'end') {
    if (G.screenT > CFG.endDelay && go()) startMatch(G.solo);
    else if (idle > CFG.endIdle) toMenu();
  } else if (G.screen === 'name') nameInput();
  else if (G.screen === 'match' && idle > CFG.matchIdle) toMenu();
}

// Fases del partido (tiempo real, no escala con cámara lenta).
function tickMode(dt) {
  G.modeT -= dt;
  if (G.mode === 'kickoff') {
    const n = Math.ceil(G.modeT);
    if (n !== G.lastCount && n > 0) {
      G.lastCount = n;
      showBig(String(n), '#ffffff', 700);
      sfx('beep');
    }
    if (G.modeT <= 0) {
      G.mode = 'play';
      // Kickoff: a lo más una CPU (al azar) se queda defendiendo; evita choques simétricos.
      const w = Math.random() < CFG.cpuKickWait ? (Math.random() * 2) | 0 : -1;
      for (const c of G.cars) {
        c.frozen = false;
        if (c.ai) c.ai.wait = c.id === w ? G.time + CFG.cpuKickWaitT : 0;
      }
      if (G.screen === 'match') for (const k in pressed) pressed[k] = false;
      showBig('¡YA!', '#e1ff00', 600);
      sfx('go');
    }
  } else if (G.mode === 'play') {
    if (G.lastTouch >= 0) G.st.poss[G.lastTouch] += dt;
    if (G.ot) {
      G.otT += dt;
      if (G.otT > CFG.otMax) endMatch();
    } else {
      const prev = Math.ceil(G.clock);
      G.clock = Math.max(0, G.clock - dt);
      const n = Math.ceil(G.clock);
      if (n < prev && n > 0 && n <= CFG.finalCount) {
        showBig(String(n), '#ff5050', 600);
        sfx('tick');
      }
      if (G.clock <= 0 && G.ball.onFloor) timeUp();
    }
  } else if (G.mode === 'goal') {
    // Repetición en cámara lenta de los últimos ~1.5 s (saltable con botón 1).
    if (G.replay) {
      G.replay.i += dt * 60 * CFG.replaySpeed;
      if (G.replay.i < G.replay.f.length - 1 && !consume('P1_1') && !consume('P2_1')) return;
      G.replay = null;
      G.modeT = 0;
    } else if (!G.demo && !G.replayed && G.rec.length > 20 && G.modeT < CFG.goalPause - CFG.replayDelay) {
      G.replayed = true;
      G.replay = { f: G.rec, i: 0 };
      G.rec = [];
      G.scene.tweens.killTweensOf(G.ui.big);
      G.ui.big.setAlpha(0);
      return;
    }
    if (G.modeT < CFG.goalPause - CFG.goalSlowMoTime) G.timeScale = Math.min(1, G.timeScale + dt * 2);
    if (G.modeT <= 0) {
      if (G.ot) endMatch();
      else if (Math.abs(G.score[0] - G.score[1]) >= CFG.mercyGoals) endMatch();
      else if (G.clock <= 0) timeUp();
      else kickoff();
    }
  }
}

// Un paso fijo de física, subdividido si algo se mueve rápido (anti-túnel).
function step(dt) {
  G.steps++;
  const b = G.ball;
  let vmax = len(b.vx, b.vy);
  for (const c of G.cars) {
    readInput(c, dt);
    vmax = Math.max(vmax, len(c.vx, c.vy));
  }
  const n = clamp(Math.ceil((vmax * dt) / CFG.maxSubStep), 1, 8);
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    // El flanco de salto se aplica solo en el primer sub-paso.
    for (const c of G.cars) carStep(c, h, i === 0 && c.inp.jump);
    ballStep(b, h);
    for (const c of G.cars) carBall(c, b);
    carCar(G.cars[0], G.cars[1]);
    if (G.mode === 'play') checkGoal();
  }
  padsStep(dt);
  respawnStep(dt);
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
  G.cam = this.cameras.main;
  G.fx = this.add.graphics().setDepth(6);
  G.scene = this;
  G.ball = makeBall();
  G.ballGfx = makeBallGfx(this);
  G.cars = [makeCar(0), makeCar(1)];
  for (const c of G.cars) c.gfx = makeCarGfx(this, c);
  audioInit(this);
  createUI(this);
  toMenu();
  loadTop();
}

// Loop: tiempo real → acumulador → pasos fijos de CFG.dt. Render a la tasa del monitor.
function update(time, deltaMs) {
  const dt = Math.min(deltaMs / 1000, CFG.maxFrame);
  G.time += dt;
  if (consume('P1_6')) G.debug = !G.debug;
  tickScreen(dt);
  const live = G.screen !== 'end' && G.screen !== 'name';
  if (live) tickMode(dt);
  if (G.hitStop > 0) {
    G.hitStop -= dt;
  } else if (live && G.mode !== 'kickoff' && !G.replay) {
    G.acc += dt * G.timeScale;
    while (G.acc >= CFG.dt) {
      step(CFG.dt);
      G.acc -= CFG.dt;
    }
  }
  render(this, dt);
  musicUpdate();
  drawHud();
  drawDebug(this);
}
