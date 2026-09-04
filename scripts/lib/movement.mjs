// THE BODY, HEADLESS.
//
// A faithful port of `VaultRun.step` + `moveX`/`moveY` from src/game/vault.ts,
// so a level can be proved solvable without a browser, a renderer, or a human.
//
// THE CONSTANTS ARE NOT COPIED. They are parsed out of src/game/vault.ts at
// load, because a simulator with its own private copy of JUMP is a simulator
// that silently stops describing the game the day someone retunes it.
//
// What IS duplicated is the integration — the shape of the loop. That is a
// real risk and it is NOT yet guarded. The nearest thing to a check today is
// `movement metrics` in scripts/vaults.mjs, which measures a jump in the live
// game and lands within about 10 % of this simulator; but it samples on wall
// clock rather than driving a fixed tape, so it is a smell test and not a
// drift guard. A proper one — same tape here and in the browser, trajectories
// compared frame by frame — is the next thing this file needs.
//
// Units are TILES and SECONDS throughout, matching the game. The body is
// 0.30 x 1.04 tiles at BODY 2.
import { readFileSync } from 'fs';

const SRC = readFileSync('src/game/vault.ts', 'utf8');

/** pull `const NAME = <number>;` out of the controller — one source of truth */
function K(name) {
  const m = SRC.match(new RegExp(`^const ${name} = ([-0-9.]+)`, 'm'));
  if (!m) throw new Error(`movement constant ${name} not found in src/game/vault.ts`);
  return Number(m[1]);
}

export const C = {
  BODY: K('BODY'), WALK: K('WALK'), AIR_CTRL: K('AIR_CTRL'), JUMP: K('JUMP'),
  GRAV: K('GRAV'), MAX_FALL: K('MAX_FALL'), DASH_V: K('DASH_V'), DASH_T: K('DASH_T'),
  DASH_KEEP: K('DASH_KEEP'), DASH_CARRY: K('DASH_CARRY'), FREEZE_T: K('FREEZE_T'),
  FAST_FALL: K('FAST_FALL'), APEX_BAND: K('APEX_BAND'), CORNER: K('CORNER'),
  CURRENT_RISE: K('CURRENT_RISE'),
  DASH_POP: K('DASH_POP'), WJ_NEAR: K('WJ_NEAR'), WJ_LATCH: K('WJ_LATCH'),
  WALL_SLIDE: K('WALL_SLIDE'), WALL_JUMP_UP: K('WALL_JUMP_UP'),
  WALL_JUMP_OUT: K('WALL_JUMP_OUT'), COYOTE: K('COYOTE'), BUFFER: K('BUFFER'),
  THIN_BAND: K('THIN_BAND'),
};
C.HW = 0.15 * C.BODY;
C.HH = 0.26 * C.BODY;
export const EPS = 0.001;
export const DT = 1 / 60;

/** tiles a body may stand in, matching vaultfit's AIR set */
const AIR = new Set(['.', 'd', 'S', '@', 'M', 'X', '_', 'A', 'b', 'R', '^', '>', '<',
  'K', 'F', 'C', 'N', '1', '2', 'o', '*']);
/** ...and the ones that are floor to stand ON */
const THIN = new Set(['A', 'b', 'R']);

export const VOID_PAD = 8;

export class World {
  constructor(rows, openEdges = false, currents = []) {
    this.rows = rows;
    this.h = rows.length;
    this.w = Math.max(...rows.map(r => r.length));
    // CURRENTS — rising updraft columns. Without these the simulator cannot
    // see a room whose route goes up a wind channel: it reports the stone
    // unreachable and every shaft as a wall, which is a harness lying about a
    // mechanic rather than measuring it.
    // seated the way the game seats them: the def names the columns and a
    // point inside them, the ROOM decides how far the wind reaches
    this.currents = currents.map(cu => {
      const openRow = (y) => {
        for (let x = cu.x0; x <= cu.x1; x++) if (this.solid(x, y)) return false;
        return true;
      };
      let top = Math.min(cu.y0, cu.y1), bot = Math.max(cu.y0, cu.y1);
      while (top > 1 && openRow(top - 1)) top--;
      while (bot < this.h - 2 && openRow(bot + 1)) bot++;
      return { ...cu, y0: top, y1: bot };
    });
    // an open-edged room has sky past its edge, not stone. The simulator has
    // to know, or it verifies a room with walls the game does not have.
    this.openEdges = openEdges;
  }
  at(x, y) {
    if (y < 0 || y >= this.h || x < 0 || x >= this.w) return this.openEdges ? '.' : '#';
    return this.rows[y][x] ?? '#';
  }
  /** past the pad, the body has fallen */
  voided(px, py) {
    if (!this.openEdges) return false;
    return py < -(this.h + VOID_PAD) || px < -VOID_PAD || px > this.w + VOID_PAD;
  }
  /** solid to the WORLD — doors and bridges count as stone here */
  solid(x, y) {
    const c = this.at(x, y);
    return !AIR.has(c) || THIN.has(c);
  }
  thin(x, y) { return THIN.has(this.at(x, y)); }
  /** solid to a BODY whose centre is at world-y `cy` (the THIN_BAND rule) */
  bodySolid(x, y, cy) {
    if (!this.solid(x, y)) return false;
    if (!this.thin(x, y)) return true;
    const top = -y;
    return cy + C.HH > top - C.THIN_BAND && cy - C.HH < top;
  }
}

export function spawn(world, tx, ty) {
  return {
    px: tx + 0.5, py: -(ty + 0.5), vx: 0, vy: 0,
    grounded: false, facing: 1, spark: true,
    dashT: 0, dashVX: 0, dashVY: 0, dashCarryT: 0,
    coyoteT: 0, bufferT: 0, wallCoyote: 0, wallJumpT: 0,
    jumpHeld: false, jumpCut: false, dead: false, world,
  };
}

const clone = (s) => ({ ...s });

// ---- collision, ported from moveX / moveY -------------------------------
function moveX(s, dx) {
  if (dx === 0) return;
  s.px += dx;
  const top = Math.floor(-(s.py + C.HH - EPS));
  const bot = Math.floor(-(s.py - C.HH + EPS));
  const dir = Math.sign(dx);
  const c = Math.floor(s.px + dir * C.HW);
  let hit = false;
  for (let r = top; r <= bot; r++) if (s.world.bodySolid(c, r, s.py)) { hit = true; break; }
  if (!hit) return;
  s.px = dir > 0 ? c - C.HW - EPS : c + 1 + C.HW + EPS;
  s.vx = 0;
  if (s.dashT > 0) s.dashVX = 0;
}

function moveY(s, dy) {
  s.py += dy;
  const left = Math.floor(s.px - C.HW + EPS);
  const right = Math.floor(s.px + C.HW - EPS);
  if (dy < 0) {
    const r = Math.floor(-(s.py - C.HH));
    for (let c = left; c <= right; c++) {
      if (!s.world.solid(c, r)) continue;
      if (s.world.thin(c, r) && s.py - C.HH < -r - C.THIN_BAND) continue;
      s.py = -r + C.HH + EPS;
      s.vy = 0;
      if (s.dashT > 0) s.dashVY = 0;
      s.grounded = true;
      break;
    }
  } else if (dy > 0) {
    const r = Math.floor(-(s.py + C.HH));
    if (r >= 0) {
      for (let c = left; c <= right; c++) {
        if (!s.world.solid(c, r)) continue;
        const thin = s.world.thin(c, r);
        const plane = thin ? -r - C.THIN_BAND : -(r + 1);
        if (thin && s.py + C.HH <= plane) continue;
        s.py = plane - C.HH - EPS;
        s.vy = 0;
        if (s.dashT > 0) s.dashVY = 0;
        break;
      }
    }
  }
}

function wallAt(s, side, reach) {
  const top = Math.floor(-(s.py + C.HH - EPS));
  const bot = Math.floor(-(s.py - C.HH + EPS));
  const c = Math.floor(s.px + side * (C.HW + reach));
  for (let r = top; r <= bot; r++) if (s.world.bodySolid(c, r, s.py)) return true;
  return false;
}

/** the killing tiles: unlight studs. Hazard defs are handled by the caller. */
function touchingKill(s) {
  for (const [x, y] of [
    [s.px - C.HW, s.py - C.HH], [s.px + C.HW, s.py - C.HH],
    [s.px - C.HW, s.py + C.HH], [s.px + C.HW, s.py + C.HH],
  ]) {
    // `_` is unlight you cannot see -- the bottom of a bottomless pit. It
    // kills exactly as `X` does; the only difference is that nothing is drawn
    const t = s.world.at(Math.floor(x), Math.floor(-y));
    if (t === 'X' || t === '_') return true;
  }
  return false;
}

/**
 * One frame. `input` is { left, right, up, down, jump, dash, dashDX, dashDY }
 * where `jump` is HELD state (the press edge is derived by the caller feeding
 * a rising edge through `press`).
 */
export function step(s, input, dt = DT) {
  if (input.press) { s.bufferT = C.BUFFER; s.jumpHeld = true; s.jumpCut = false; }
  if (input.release) s.jumpHeld = false;
  if (input.dash && s.spark && s.dashT <= 0) {
    const dx = input.dashDX ?? 0, dy = input.dashDY ?? 0;
    const len = Math.hypot(dx, dy) || 1;
    s.spark = false;
    s.dashT = C.DASH_T;
    s.dashVX = (dx / len) * C.DASH_V;
    s.dashVY = (dy / len) * C.DASH_V;
    s.vx = s.dashVX; s.vy = s.dashVY;
    if (dx !== 0) s.facing = Math.sign(dx);
  }

  s.coyoteT = Math.max(0, s.coyoteT - dt);
  if (s.dashT <= 0) s.bufferT = Math.max(0, s.bufferT - dt);
  s.wallCoyote = Math.max(0, s.wallCoyote - dt);
  s.wallJumpT = Math.max(0, s.wallJumpT - dt);
  s.dashCarryT = Math.max(0, s.dashCarryT - dt);

  if (s.dashT > 0) {
    s.dashT -= dt;
    s.vx = s.dashVX; s.vy = s.dashVY;
    if (s.dashT <= 0) {
      s.vx = Math.sign(s.vx) * Math.min(Math.abs(s.vx), C.DASH_KEEP);
      s.vy = Math.sign(s.vy) * Math.min(Math.abs(s.vy), C.DASH_KEEP);
      s.dashCarryT = C.DASH_CARRY;
    }
  } else {
    let move = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    if (s.wallJumpT > 0 && move !== 0 && move === -Math.sign(s.vx)) move = 0;
    if (move !== 0) {
      const accel = s.grounded ? 34 : C.AIR_CTRL;
      s.vx += move * accel * dt;
      const carrying = s.dashCarryT > 0;
      if (!carrying && Math.abs(s.vx) > C.WALK && Math.sign(s.vx) === move && s.grounded) s.vx = move * C.WALK;
      if (!carrying && !s.grounded && Math.sign(s.vx) === move && Math.abs(s.vx) > 5) s.vx = move * 5;
      s.facing = move;
    } else if (s.grounded && s.dashCarryT <= 0) {
      s.vx -= s.vx * Math.min(1, 14 * dt);
    }
    if (s.dashCarryT > 0 && Math.abs(s.vx) > C.WALK) {
      const bleed = (C.DASH_KEEP - C.WALK) / C.DASH_CARRY * dt;
      s.vx = Math.sign(s.vx) * Math.max(C.WALK, Math.abs(s.vx) - bleed);
    }

    const crowned = s.jumpHeld && !s.jumpCut && Math.abs(s.vy) < C.APEX_BAND;
    s.vy += -C.GRAV * (crowned ? 0.5 : 1) * dt;

    let wallNear = 0, wallDir = 0;
    if (!s.grounded) {
      if (wallAt(s, -1, C.WJ_NEAR)) wallNear = -1;
      else if (wallAt(s, 1, C.WJ_NEAR)) wallNear = 1;
      if (move === -1 && wallAt(s, -1, 0.06)) wallDir = -1;
      else if (move === 1 && wallAt(s, 1, 0.06)) wallDir = 1;
      if (wallDir !== 0) {
        s.wallCoyote = C.COYOTE;
        if (s.vy < 0 && s.vy < -C.WALL_SLIDE) s.vy = -C.WALL_SLIDE;
      }
    }

    if (s.bufferT > 0) {
      if (s.grounded || s.coyoteT > 0) {
        s.vy = C.JUMP; s.grounded = false; s.coyoteT = 0; s.bufferT = 0; s.jumpCut = false;
      } else if (wallDir !== 0 || wallNear !== 0 || s.wallCoyote > 0) {
        const off = wallDir !== 0 ? wallDir : wallNear;
        const away = off !== 0 ? -off : -Math.sign(s.facing);
        s.vy = C.WALL_JUMP_UP;
        s.vx = away * C.WALL_JUMP_OUT;
        s.facing = away;
        s.bufferT = 0; s.wallCoyote = 0; s.wallJumpT = C.WJ_LATCH; s.jumpCut = false;
      }
    }
    if (!s.jumpHeld && !s.jumpCut && s.vy > 0) { s.vy *= 0.45; s.jumpCut = true; }
  }

  // the updraft carries, before the fall governor: it lifts like a breath and
  // is capped so it can never outrun the spark (P5)
  for (const cu of s.world.currents ?? []) {
    if (s.px > cu.x0 && s.px < cu.x1 + 1
      && -s.py > cu.y0 && -s.py < cu.y1 + 1 && s.vy < C.CURRENT_RISE) {
      s.vy = Math.min(C.CURRENT_RISE, s.vy + cu.force * dt);
    }
  }

  const falling = s.vy < 0;
  const maxFall = input.down && !s.grounded && falling ? C.FAST_FALL : C.MAX_FALL;
  s.vy = Math.max(-maxFall, Math.min(maxFall, s.vy));
  s.vx = Math.max(-C.MAX_FALL, Math.min(C.MAX_FALL, s.vx));

  const wasGrounded = s.grounded;
  s.grounded = false;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(s.vx), Math.abs(s.vy)) * dt / 0.2));
  const sdt = dt / steps;
  for (let i = 0; i < steps; i++) { moveX(s, s.vx * sdt); moveY(s, s.vy * sdt, ); }
  if (wasGrounded && !s.grounded) s.coyoteT = C.COYOTE;
  // stone underfoot relights the breath; drank stone (`=`) never does
  if (s.grounded) {
    const ft = s.world.at(Math.floor(s.px), Math.floor(-(s.py - C.HH - 0.05)));
    if (ft !== '=') s.spark = true;
  }
  if (touchingKill(s) || s.world.voided(s.px, s.py)) s.dead = true;
  return s;
}

/** run a tape of per-frame inputs; returns the final state and the path */
export function run(state, tape, { trace = false } = {}) {
  const s = clone(state);
  const path = [];
  for (const inp of tape) {
    step(s, inp);
    if (trace) path.push({ x: +s.px.toFixed(3), y: +s.py.toFixed(3) });
    if (s.dead) break;
  }
  return { s, path };
}

const HOLD = { left: false, right: false, up: false, down: false };
export const NONE = HOLD;

// ---------------------------------------------------------------------------
// METRICS. Measured by simulation, never by algebra: the apex band, the jump
// cut, the air-speed clamp and the substepped collision all bend the arc away
// from the parabola the constants imply, and a level built on the parabola is
// a level built on a number the game does not use.
// ---------------------------------------------------------------------------

/** fly the body in open air and report the arc */
function arc({ runUp = 0, holdFrames = 999, dash = null, frames = 200 }) {
  // a floor at y = 0 and nothing else for a long way
  const W = 400;
  const rows = [];
  for (let y = 0; y < 60; y++) rows.push(y === 40 ? '#'.repeat(W) : '.'.repeat(W));
  const world = new World(rows);
  const s = spawn(world, 4, 39);
  // settle onto the floor
  for (let i = 0; i < 30; i++) step(s, { ...HOLD });
  // build up run speed FIRST — the run-up is not part of the jump, and
  // measuring from before it inflates every distance by a tile and a half
  for (let i = 0; i < runUp; i++) step(s, { ...HOLD, right: true });
  const x0 = s.px, y0 = s.py;
  const vAtJump = s.vx;
  let peak = s.py, dashedAt = -1, air = 0;
  step(s, { ...HOLD, right: runUp > 0, press: true });
  for (let f = 0; f < frames; f++) {
    const inp = { ...HOLD, right: runUp > 0, jump: f < holdFrames };
    if (f === holdFrames) inp.release = true;
    if (dash && f === dash.at) { inp.dash = true; inp.dashDX = dash.dx; inp.dashDY = dash.dy; dashedAt = f; }
    step(s, inp);
    peak = Math.max(peak, s.py);
    air = f + 1;
    if (s.grounded && f > 4) break;
  }
  return {
    height: +(peak - y0).toFixed(2),
    distance: +(s.px - x0).toFixed(2),
    airFrames: air,
    speedAtJump: +vAtJump.toFixed(2),
    dashedAt,
  };
}

export function metrics() {
  const standing = arc({ runUp: 0 });
  const running = arc({ runUp: 30 });
  const shortHop = arc({ runUp: 30, holdFrames: 3 });
  const runDashFlat = arc({ runUp: 30, dash: { at: 6, dx: 1, dy: 0 } });
  const runDashUp = arc({ runUp: 30, dash: { at: 6, dx: 0.7, dy: 0.7 } });
  const standDash = arc({ runUp: 0, dash: { at: 4, dx: 1, dy: 0 } });

  // runway: frames and tiles to reach WALK from rest
  const W = 400;
  const rows = [];
  for (let y = 0; y < 60; y++) rows.push(y === 40 ? '#'.repeat(W) : '.'.repeat(W));
  const world = new World(rows);
  const s = spawn(world, 4, 39);
  for (let i = 0; i < 30; i++) step(s, { ...HOLD });
  const rx = s.px;
  let runwayFrames = 0;
  while (s.vx < C.WALK - 0.01 && runwayFrames < 120) { step(s, { ...HOLD, right: true }); runwayFrames++; }
  const runway = +(s.px - rx).toFixed(2);
  // skid: release and coast
  const sx = s.px;
  let skidFrames = 0;
  while (Math.abs(s.vx) > 0.05 && skidFrames < 120) { step(s, { ...HOLD }); skidFrames++; }
  const skid = +(s.px - sx).toFixed(2);

  // wall-jump gain: height won per kick off a wall
  const wr = [];
  for (let y = 0; y < 60; y++) {
    let row = '.'.repeat(W);
    if (y === 40) row = '#'.repeat(W);
    else row = '#' + '.'.repeat(W - 1);
    wr.push(row);
  }
  const ww = new World(wr);
  const ws = spawn(ww, 1, 39);
  for (let i = 0; i < 30; i++) step(ws, { ...HOLD });
  // per kick, not cumulative: what one wall-jump buys is the number a
  // shaft is authored against
  let gain = 0;
  for (let k = 0; k < 3; k++) {
    const base = ws.py;
    step(ws, { ...HOLD, left: true, press: true });
    let top = ws.py;
    for (let f = 0; f < 40; f++) {
      step(ws, { ...HOLD, left: true, jump: true });
      top = Math.max(top, ws.py);
      if (ws.vy < 0 && wallAt(ws, -1, C.WJ_NEAR)) break;
    }
    gain = Math.max(gain, top - base);
  }

  return {
    standing, running, shortHop, runDashFlat, runDashUp, standDash,
    runwayFrames, runway, skidFrames, skid,
    wallJumpGain: +gain.toFixed(2),
    coyoteFrames: +(C.COYOTE * 60).toFixed(1),
    bufferFrames: +(C.BUFFER * 60).toFixed(1),
    latchFrames: +(C.WJ_LATCH * 60).toFixed(1),
  };
}
