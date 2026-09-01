import {
  GRAVITY, MAX_FALL, MAX_RISE, MAX_SIDE, SIDE_DRAG, POD_W, POD_H,
  FALL_SAFE, FALL_DMG, FUEL_IDLE, FUEL_THRUST, FUEL_SIDE, FUEL_DRILL,
  HEAT_FULL_ROW, HEAT_DMG, GAS_DMG,
  TILE_M, boulderTierNeeded, stratumIndex, CORE_ROW, WORLD_W,
  DASH_SPEED, DASH_COOLDOWN, PAD_X0, PAD_X1, PAD_ROWS, SPAWN_X, VEINLIGHT_FUEL,
  WRECK_SPOT_RANGE,
} from '../config';
import { T, def, oreValue } from '../world/tiles';
import { ACTIVE } from '../world/worlds';
import { Terrain } from '../world/terrain';
import { GameState } from '../game/state';
import { DOCKS, Dock } from '../world/backdrop';
import { DrillDir } from './pod';

export interface Input { left: boolean; right: boolean; up: boolean; down: boolean; }

export interface PodEvents {
  onCollect(t: T, value: number, full: boolean): void;
  onBlockBroken(t: T, x: number, y: number): void;
  onDamage(amount: number, cause: string): void;
  onDeath(cause: string): void;
  onStranded(): void;
  onDockChange(dock: Dock | null): void;
  onStratum(idx: number): void;
  onGasBurst(x: number, y: number): void;
  onLanded(impact: number): void;
  onDrillBlocked(msg: string): void;
  onDash(): void;
  onVeinlight(fuel: number): void;
  onNative(total: number): void;
  onGlyph(x: number, y: number): void;
  onRuinSighted(): void;
  /** an arrestor absorbed a fall that would otherwise have hurt */
  onArrested(impact: number): void;
}

interface Drilling { x: number; y: number; dir: DrillDir; progress: number; hardness: number; }

const EPS = 0.001;
const HW = POD_W / 2;
const HH = POD_H / 2;

export class PodController {
  px: number; py: number;
  vx = 0; vy = 0;
  grounded = false;
  drilling: Drilling | null = null;
  thrust = 0;       // 0..1 visual
  sideThrust = 0;   // -1..1 visual
  heatFrac = 0;     // 0..1 for HUD
  inLava = false;
  dock: Dock | null = null;
  /** EVA hooks: set each frame; main renders prompts and handles E */
  coreNear = false;
  wreckNear = -1;
  /** tiles to the wreck the pod has spotted */
  wreckDist = 0;
  looted = new Set<number>();
  facing = 1;
  private dashCd = 0;
  private lastStratum = 0;
  private strandedFired = false;
  private blockedMsgAt = 0;

  constructor(
    private terrain: Terrain,
    private state: GameState,
    private ev: PodEvents,
    spawnX = SPAWN_X,
  ) {
    this.px = spawnX;
    this.py = HH + 0.01;
  }

  get row(): number { return Math.floor(-this.py); }
  get depthM(): number { return Math.max(0, Math.round(-(this.py - HH) * TILE_M)); }
  get drillDir(): DrillDir { return this.drilling?.dir ?? 'down'; }

  /** always lands ON the pad — its plating can't be dug out from under you */
  respawnAtSurface(): void {
    this.px = SPAWN_X; this.py = HH + 0.01;
    this.vx = 0; this.vy = 0;
    this.drilling = null;
    this.strandedFired = false;
  }

  update(dt: number, input: Input, time: number): void {
    const st = this.state;
    const fuelBefore = st.fuel;

    if (this.drilling) {
      this.stepDrilling(dt, time);
      st.fuelSpent += Math.max(0, fuelBefore - st.fuel);
      return;
    }

    // ---- thrust ----
    const hasFuel = st.fuel > 0;
    this.thrust = 0; this.sideThrust = 0;
    if (input.up && hasFuel) {
      this.vy += 52 * st.thrustMul * dt;
      this.thrust = 1;
      st.fuel = Math.max(0, st.fuel - FUEL_THRUST * dt);
    }
    if (input.left && hasFuel) {
      this.vx -= 30 * st.thrustMul * dt;
      this.sideThrust = -1;
      this.facing = -1;
      st.fuel = Math.max(0, st.fuel - FUEL_SIDE * dt);
    } else if (input.right && hasFuel) {
      this.vx += 30 * st.thrustMul * dt;
      this.sideThrust = 1;
      this.facing = 1;
      st.fuel = Math.max(0, st.fuel - FUEL_SIDE * dt);
    } else {
      // damp sideways drift — glazed ice barely grips
      const drag = SIDE_DRAG * (ACTIVE.iceTraction && this.grounded ? 0.28 : 1);
      this.vx -= this.vx * Math.min(1, drag * dt);
    }
    st.fuel = Math.max(0, st.fuel - FUEL_IDLE * dt);
    this.dashCd = Math.max(0, this.dashCd - dt);

    // ---- integrate + collide ----
    this.vy -= GRAVITY * dt;
    this.vy = Math.max(-MAX_FALL, Math.min(MAX_RISE, this.vy));
    this.vx = Math.max(-MAX_SIDE * st.thrustMul, Math.min(MAX_SIDE * st.thrustMul, this.vx));

    // sub-step so fast falls can never cross a whole tile in one integration
    const fallSpeed = -this.vy;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(this.vx), Math.abs(this.vy)) * dt / 0.3));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.moveX(this.vx * sdt);
      this.moveY(this.vy * sdt, fallSpeed);
    }

    // soft flight ceiling above the rig
    if (this.py > 7) { this.py = 7; this.vy = Math.min(0, this.vy); }

    // ---- drilling initiation ----
    if (this.grounded) {
      if (input.down) this.tryDrill(Math.floor(this.px), Math.floor(-(this.py - HH) + 0.1), 'down', time);
      else if (input.left && this.pushingWall(-1)) this.tryDrill(Math.floor(this.px - HW) - 1, this.row, 'left', time);
      else if (input.right && this.pushingWall(1)) this.tryDrill(Math.floor(this.px + HW) + 1, this.row, 'right', time);
    }
    // ascent coil: drill upward while pressed against a ceiling
    if (!this.drilling && input.up && this.state.emberTech.updrill && Math.abs(this.vy) < 0.5) {
      const ry = Math.floor(-(this.py + HH + 0.12));
      if (ry >= 0 && this.terrain.solidAt(Math.floor(this.px), ry)) {
        this.tryDrill(Math.floor(this.px), ry, 'up', time);
      }
    }

    this.hazards(dt);
    this.milestones();
    this.docking();
    this.proximity();
    this.strandedCheck(time);
    st.fuelSpent += Math.max(0, fuelBefore - st.fuel);
  }

  /**
   * Set each frame by the game: -1, or the index of an arrestor positioned to
   * catch the pod right now. Landing on one cancels fall damage outright.
   */
  arrestorCatch = -1;

  /** damage from a creature — routed so death/fx behave identically */
  hurtFromThreat(amount: number, cause: string): void {
    this.applyDamage(amount, cause);
  }

  /** Blink Coil: lateral dash, no fuel */
  dash(): void {
    if (!this.state.emberTech.dash || this.dashCd > 0 || this.drilling) return;
    this.dashCd = DASH_COOLDOWN;
    this.vx = this.facing * DASH_SPEED;
    this.vy += 1.5;
    this.ev.onDash();
  }

  private proximity(): void {
    // close enough to a Lamplighter chamber to see what it is
    if (!this.state.sawRuins) {
      for (const r of this.terrain.ruins) {
        if (Math.abs(r.x - this.px) < 11 && Math.abs(-r.y - this.py) < 9) {
          this.state.sawRuins = true;
          this.ev.onRuinSighted();
          break;
        }
      }
    }
    // the core walk: pod parks in the chamber, the rest is on foot
    this.coreNear = this.grounded && this.row >= CORE_ROW - 1 &&
      Math.abs(this.px - WORLD_W / 2) < 15 && !this.state.endedWorlds.has(ACTIVE.id);
    // wreck salvage EVA — spotted from a distance, so long as the pod is
    // settled. Landing exactly on top of a wreck should never be the price of
    // admission; walking there is the point.
    this.wreckNear = -1;
    this.wreckDist = 0;
    const settled = this.grounded || (Math.abs(this.vy) < 3 && Math.abs(this.vx) < 3);
    if (settled && !this.coreNear) {
      let best = Infinity;
      for (let i = 0; i < this.terrain.wrecks.length; i++) {
        if (this.looted.has(i)) continue;
        const w = this.terrain.wrecks[i];
        const d = Math.hypot(w.x + 0.5 - this.px, -(w.y + 0.5) - this.py);
        if (d < WRECK_SPOT_RANGE && d < best) {
          best = d;
          this.wreckNear = i;
          this.wreckDist = d;
        }
      }
    }
  }

  private pushingWall(dir: number): boolean {
    const c = dir < 0 ? Math.floor(this.px - HW - 0.06) : Math.floor(this.px + HW + 0.06);
    return this.terrain.solidAt(c, this.row);
  }

  private tryDrill(x: number, y: number, dir: DrillDir, time: number): void {
    if (x < 0 || x >= WORLD_W || y < 0) return;
    // the landing pad's plating can't be cut — the start stays a safe perch
    if (y < PAD_ROWS && x >= PAD_X0 && x <= PAD_X1) {
      if (time - this.blockedMsgAt > 2.5) {
        this.blockedMsgAt = time;
        this.ev.onDrillBlocked('PAD PLATING — DIG BESIDE IT');
      }
      return;
    }
    // the row directly under each building is reinforced foundation
    if (y < 1 && DOCKS.some(d => x >= d.x0 && x < d.x1)) {
      if (time - this.blockedMsgAt > 2.5) {
        this.blockedMsgAt = time;
        this.ev.onDrillBlocked('REINFORCED FOUNDATION — DIG BESIDE IT');
      }
      return;
    }
    const t = this.terrain.get(x, y);
    const d = def(t);
    if (!d.solid) return;
    if (t === T.BOULDER && this.state.drillTier < boulderTierNeeded(y)) {
      if (time - this.blockedMsgAt > 2.5) {
        this.blockedMsgAt = time;
        this.ev.onDrillBlocked('BOULDER — DRILL TOO WEAK');
      }
      return;
    }
    if (this.state.fuel <= 0) return;
    const hardness = t === T.BOULDER ? d.hardness * (1 + y / 240) : d.hardness;
    this.drilling = { x, y, dir, progress: 0, hardness };
    this.vx = 0; this.vy = 0;
  }

  private stepDrilling(dt: number, time: number): void {
    const dr = this.drilling!;
    const st = this.state;
    dr.progress += (st.drillPower / dr.hardness) * dt;
    st.fuel = Math.max(0, st.fuel - FUEL_DRILL * dt);

    // pull the pod toward the opening tile
    const tx = dr.x + 0.5;
    const targetY =
      dr.dir === 'down' ? this.py :
      dr.dir === 'up' ? -(dr.y + 1) - HH - EPS :
      -(dr.y + 1) + HH + EPS;
    const pull = Math.min(1, dt * 6);
    this.px += (tx - this.px) * pull * (dr.dir === 'down' ? 1 : 0.35);
    if (dr.dir !== 'down') this.py += (targetY - this.py) * pull;

    if (st.fuel <= 0 && dr.progress < 1) {
      this.drilling = null;
      this.strandedCheck(time);
      return;
    }

    if (dr.progress >= 1) {
      const t = this.terrain.get(dr.x, dr.y);
      this.terrain.carve(dr.x, dr.y);
      st.blocksDug++;
      this.drilling = null;

      if (t === T.GAS) {
        this.ev.onGasBurst(dr.x, dr.y);
        // pressure worlds fling the pod as well as damaging it
        if (ACTIVE.gasImpulse > 0) {
          this.vx += (Math.random() - 0.5) * 2 * ACTIVE.gasImpulse;
          this.vy += ACTIVE.gasImpulse * 0.7;
        }
        this.applyDamage(GAS_DMG * (1 + dr.y / 400), 'a gas pocket');
      } else if (t === T.GLYPH) {
        this.ev.onGlyph(dr.x, dr.y);
      } else if (t === T.NATIVE) {
        st.addNative();
        this.ev.onNative(st.nativeHeld);
      } else if (t === T.FUNGUS) {
        // veinlight burns straight into the tank — no cargo slot, no sale
        const before = st.fuel;
        st.fuel = Math.min(st.maxFuel, st.fuel + VEINLIGHT_FUEL);
        this.ev.onVeinlight(Math.round(st.fuel - before));
      } else if (def(t).ore) {
        const ok = st.addCargo(t);
        if (ok) {
          st.oreMined++;
          if (st.contract?.c.oreType === t) st.contractOre++;
        }
        this.ev.onCollect(t, oreValue(t), !ok);
      }
      this.ev.onBlockBroken(t, dr.x, dr.y);
    }
  }

  // ---- collision ----
  private moveX(dx: number): void {
    this.px += dx;
    const top = Math.floor(-(this.py + HH - EPS));
    const bot = Math.floor(-(this.py - HH + EPS));
    if (dx > 0) {
      const c = Math.floor(this.px + HW);
      for (let r = top; r <= bot; r++) {
        if (this.terrain.solidAt(c, r)) { this.px = c - HW - EPS; this.vx = 0; break; }
      }
    } else if (dx < 0) {
      const c = Math.floor(this.px - HW);
      for (let r = top; r <= bot; r++) {
        if (this.terrain.solidAt(c, r)) { this.px = c + 1 + HW + EPS; this.vx = 0; break; }
      }
    }
  }

  private moveY(dy: number, fallSpeed: number): void {
    this.py += dy;
    const left = Math.floor(this.px - HW + EPS);
    const right = Math.floor(this.px + HW - EPS);
    const wasGrounded = this.grounded;
    this.grounded = false;

    if (dy < 0) {
      const r = Math.floor(-(this.py - HH));
      for (let c = left; c <= right; c++) {
        if (this.terrain.solidAt(c, r)) {
          this.py = -r + HH + EPS;
          this.vy = 0;
          this.grounded = true;
          if (!wasGrounded && this.arrestorCatch >= 0 && fallSpeed > 4) {
            // the pad takes it — no damage at any speed
            this.ev.onArrested(fallSpeed);
          } else if (!wasGrounded && fallSpeed > FALL_SAFE) {
            const dmg = (fallSpeed - FALL_SAFE) * FALL_DMG;
            this.applyDamage(dmg, 'a hard landing');
            this.ev.onLanded(fallSpeed);
          } else if (!wasGrounded && fallSpeed > 4) {
            this.ev.onLanded(fallSpeed);
          }
          break;
        }
      }
      // ground level (surface) — the world above row 0 is open air with an implicit floor at y=0 only where terrain remains
    } else if (dy > 0) {
      const r = Math.floor(-(this.py + HH));
      if (r >= 0) {
        for (let c = left; c <= right; c++) {
          if (this.terrain.solidAt(c, r)) {
            this.py = -(r + 1) - HH - EPS;
            this.vy = 0;
            break;
          }
        }
      }
    } else {
      // resting check
      const r = Math.floor(-(this.py - HH - 0.04));
      for (let c = left; c <= right; c++) {
        if (this.terrain.solidAt(c, r)) { this.grounded = true; break; }
      }
    }
  }

  // ---- hazards ----
  private hazards(dt: number): void {
    // lava overlap
    const left = Math.floor(this.px - HW), right = Math.floor(this.px + HW);
    const top = Math.floor(-(this.py + HH)), bot = Math.floor(-(this.py - HH));
    this.inLava = false;
    for (let r = Math.max(0, top); r <= bot; r++) {
      for (let c = left; c <= right; c++) {
        if (this.terrain.get(c, r) === T.LAVA) { this.inLava = true; break; }
      }
    }
    if (this.inLava) {
      this.applyDamage(ACTIVE.fluid.dmg * dt, ACTIVE.fluid.name.toLowerCase());
      if (ACTIVE.fluid.fuelDrain > 0) {
        this.state.fuel = Math.max(0, this.state.fuel - ACTIVE.fluid.fuelDrain * dt);
      }
    }

    // depth gauge (heat / frost / pressure — same math, different fiction).
    // Later worlds bite shallower, and only that world's own rig answers it.
    const row = this.row;
    const start = ACTIVE.hazardStartRow;
    const heat = Math.min(1.25, Math.max(0, (row - start) / (HEAT_FULL_ROW - start) * 1.25));
    let excess = Math.max(0, heat - this.state.hazardResist);
    // pyro exchanger: halves the damage and converts it to fuel
    if (excess > 0 && this.state.emberTech.converter) {
      this.state.fuel = Math.min(this.state.maxFuel, this.state.fuel + excess * 2.4 * dt);
      excess *= 0.5;
    }
    this.heatFrac = heat > 0.02 ? Math.min(1, excess / 0.6) : 0;
    if (excess > 0) this.applyDamage(excess * HEAT_DMG * dt, ACTIVE.hazard.cause);
  }

  private applyDamage(amount: number, cause: string): void {
    if (amount <= 0) return;
    const st = this.state;
    st.hull = Math.max(0, st.hull - amount);
    this.ev.onDamage(amount, cause);
    if (st.hull <= 0) this.ev.onDeath(cause);
  }

  private milestones(): void {
    const st = this.state;
    const d = this.depthM;
    if (d > st.bestDepthM) st.bestDepthM = d;
    if (this.row > st.worldBestRow) st.worldBestRow = this.row;
    const s = stratumIndex(Math.max(0, this.row));
    if (s !== this.lastStratum) {
      this.lastStratum = s;
      this.ev.onStratum(s);
    }
  }

  private docking(): void {
    let found: Dock | null = null;
    // tolerant: grounded OR hovering just above the apron about to settle
    const nearGround = this.grounded || (Math.abs(this.vy) < 4.5 && this.py < 1.3);
    if (nearGround && this.py > -0.5 && this.py < 1.3) {
      for (const d of DOCKS) {
        if (this.px >= d.x0 - 0.35 && this.px <= d.x1 + 0.35) { found = d; break; }
      }
    }
    if (found !== this.dock) {
      this.dock = found;
      this.ev.onDockChange(found);
    }
  }

  private strandedAt = -1e9;
  private strandedCheck(time: number): void {
    // re-offers the tow every few seconds — declining once must never softlock
    if (this.state.fuel <= 0 && this.grounded) {
      if (!this.strandedFired || time - this.strandedAt > 6) {
        this.strandedFired = true;
        this.strandedAt = time;
        this.ev.onStranded();
      }
    }
    if (this.state.fuel > 0) this.strandedFired = false;
  }
}
