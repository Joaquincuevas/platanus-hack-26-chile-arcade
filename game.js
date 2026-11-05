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
  carCarRest: 0.3, // restitución auto–auto
  carCarMinPush: 120, // px/s, empuje mínimo entre autos al tocarse
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
function onBallBounce(b, impact, s) {
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
    canDouble: false, boost: CFG.boostStart, boosting: false,
  });
}

function readInput(c) {
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

// Render de objetos dinámicos (a tasa de pantalla).
function render(scene, dt) {
  const b = G.ball;
  G.ballGfx.setVisible(b.active).setPosition(b.x, b.y).setRotation(b.rot);
  const fx = G.fx;
  fx.clear();
  for (const c of G.cars) {
    // Ángulo mostrado: directo en el aire, suavizado en superficie (aterrizajes).
    c.da = c.ground ? c.da + wrapAngle(c.a - c.da) * Math.min(1, 30 * dt) : c.a;
    // Giro visual al cambiar de sentido (escala X pasa por 0).
    c.dface += clamp(c.face - c.dface, -14 * dt, 14 * dt);
    c.gfx.setPosition(c.x, c.y).setRotation(c.da).setScale(c.dface, 1);
    if (c.boosting && !c.frozen) drawFlame(fx, c);
    engineUpdate(c);
  }
  drawParticles(fx, dt);
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
  if (name === 'jump') tone(260, 520, 0.1, 'square', 0.05);
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
  const on = !c.frozen;
  L.o.frequency.setTargetAtTime(45 + sp * 0.14 + (c.id ? 8 : 0), t, 0.05);
  L.g.gain.setTargetAtTime(on ? 0.015 + Math.min(sp, 900) * 0.00004 : 0, t, 0.08);
  L.bg.gain.setTargetAtTime(on && c.boosting ? 0.1 : 0, t, 0.04);
}

// ============================== UI ==================================
const FONT = 'monospace';

function createUI(scene) {
  const st = (size, color) => ({ fontFamily: FONT, fontSize: size + 'px', fontStyle: 'bold', color });
  G.ui = {
    score: [
      scene.add.text(340, 36, '0', st(40, '#e1ff00')).setOrigin(0.5).setDepth(30),
      scene.add.text(460, 36, '0', st(40, '#ff6ec7')).setOrigin(0.5).setDepth(30),
    ],
    big: scene.add.text(W / 2, 250, '', st(96, '#ffffff')).setOrigin(0.5).setDepth(40).setAlpha(0),
    hud: scene.add.graphics().setDepth(30),
    dbg: scene.add.text(26, 82, '', { fontFamily: FONT, fontSize: '11px', color: '#00ffff' }).setDepth(51),
  };
  G.dbg = scene.add.graphics().setDepth(50);
  scene.add.text(W / 2, 36, 'VS', st(18, '#6b6bff')).setOrigin(0.5).setDepth(30);
  scene.add.text(30, 14, 'P1', st(14, '#e1ff00')).setDepth(30);
  scene.add.text(W - 30, 14, 'P2', st(14, '#ff6ec7')).setOrigin(1, 0).setDepth(30);
  scene.add.text(W / 2, 6, 'TURBO GOL', st(12, '#e1ff00')).setOrigin(0.5, 0).setDepth(30);
}

// Texto grande central con "pop".
function showBig(txt, color, ms) {
  const t = G.ui.big;
  G.scene.tweens.killTweensOf(t);
  t.setText(txt).setColor(color).setAlpha(1).setScale(1.6);
  G.scene.tweens.add({ targets: t, scale: 1, duration: 250, ease: 'Back.Out' });
  G.scene.tweens.add({ targets: t, alpha: 0, delay: ms * 0.6, duration: ms * 0.4 });
}

// Barras de boost.
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
    'FPS ' + scene.game.loop.actualFps.toFixed(0) + '  modo ' + G.mode + '  pasos ' + G.steps,
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
// Estado global de la partida (un solo partido a la vez).
const G = {
  acc: 0, // s, acumulador del paso fijo
  timeScale: 1, // cámara lenta en goles
  hitStop: 0, // s, congelamiento por golpe fuerte
  steps: 0, // contador de pasos de física (debug)
  time: 0, // s, tiempo real acumulado
  lastHit: -1, // s, último sonido de golpe (evita spam)
  lastStop: -1, // s, último hit-stop (evita tartamudeo con pelota atrapada)
  mode: 'countdown', // 'countdown' | 'play' | 'goal'
  modeT: 0, // s, tiempo restante del modo
  lastCount: 0,
  score: [0, 0],
  debug: false, // overlay de debug (toggle con P1_6)
};

// Reinicia posiciones y arranca la cuenta regresiva.
function kickoff() {
  placeCar(G.cars[0], CFG.arenaL + CFG.kickoffX, 1);
  placeCar(G.cars[1], CFG.arenaR - CFG.kickoffX, -1);
  for (const c of G.cars) c.frozen = true;
  Object.assign(G.ball, { x: A.cx, y: CFG.ballSpawnY, vx: 0, vy: 0, spin: 0, rot: 0, active: true, trail: [] });
  G.mode = 'countdown';
  G.modeT = CFG.countdown;
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
  G.cam.flash(250, scorer ? 255 : 225, scorer ? 110 : 255, scorer ? 199 : 0);
  sfx('goal');
  const t = G.ui.score[scorer];
  t.setText(String(G.score[scorer]));
  G.scene.tweens.add({ targets: t, scale: { from: 2.2, to: 1 }, duration: 500, ease: 'Back.Out' });
  showBig(scorer ? '¡GOL P2!' : '¡GOL P1!', scorer ? '#ff6ec7' : '#e1ff00', 1500);
}

// Gol si el centro de la pelota pasó bajo el travesaño hasta cerca del fondo del arco.
function checkGoal() {
  const b = G.ball;
  if (!b.active || b.y < A.barY) return;
  if (b.x < CFG.arenaL + CFG.goalD - CFG.goalLine) goal(1);
  else if (b.x > CFG.arenaR - CFG.goalD + CFG.goalLine) goal(0);
}

// Máquina de estados de la partida (tiempo real, no escala con cámara lenta).
function tickMode(dt) {
  G.modeT -= dt;
  if (G.mode === 'countdown') {
    const n = Math.ceil(G.modeT);
    if (n !== G.lastCount && n > 0) {
      G.lastCount = n;
      showBig(String(n), '#ffffff', 700);
      sfx('beep');
    }
    if (G.modeT <= 0) {
      G.mode = 'play';
      for (const c of G.cars) c.frozen = false;
      for (const k in pressed) pressed[k] = false;
      showBig('¡YA!', '#e1ff00', 600);
      sfx('go');
    }
  } else if (G.mode === 'goal') {
    if (G.modeT < CFG.goalPause - CFG.goalSlowMoTime) G.timeScale = Math.min(1, G.timeScale + dt * 2);
    if (G.modeT <= 0) kickoff();
  }
}

// Un paso fijo de física, subdividido si algo se mueve rápido (anti-túnel).
function step(dt) {
  G.steps++;
  const b = G.ball;
  let vmax = len(b.vx, b.vy);
  for (const c of G.cars) {
    readInput(c);
    vmax = Math.max(vmax, len(c.vx, c.vy));
  }
  const n = clamp(Math.ceil((vmax * dt) / CFG.maxSubStep), 1, 8);
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    // El flanco de salto se aplica solo en el primer sub-paso.
    for (const c of G.cars) carStep(c, h, i === 0 && c.inp.jump);
    ballStep(b, h);
    for (const c of G.cars) carBall(c, b);
    if (G.cars.length > 1) carCar(G.cars[0], G.cars[1]);
    if (G.mode === 'play') checkGoal();
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
  G.cam = this.cameras.main;
  G.fx = this.add.graphics().setDepth(6);
  G.scene = this;
  G.ball = makeBall();
  G.ballGfx = makeBallGfx(this);
  G.cars = [makeCar(0), makeCar(1)];
  for (const c of G.cars) c.gfx = makeCarGfx(this, c);
  audioInit(this);
  createUI(this);
  kickoff();
}

// Loop: tiempo real → acumulador → pasos fijos de CFG.dt. Render a la tasa del monitor.
function update(time, deltaMs) {
  const dt = Math.min(deltaMs / 1000, CFG.maxFrame);
  G.time += dt;
  if (consume('P1_6')) G.debug = !G.debug;
  tickMode(dt);
  if (G.hitStop > 0) {
    G.hitStop -= dt;
  } else if (G.mode !== 'countdown') {
    G.acc += dt * G.timeScale;
    while (G.acc >= CFG.dt) {
      step(CFG.dt);
      G.acc -= CFG.dt;
    }
  }
  render(this, dt);
  drawHud();
  drawDebug(this);
}
