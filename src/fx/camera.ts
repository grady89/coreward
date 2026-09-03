import * as THREE from 'three';
import { WORLD_W } from '../config';

// Damped follow camera with velocity look-ahead, speed zoom, surface pull-back,
// and a decaying shake channel. Reduced-motion kills shake.

/**
 * How far shake actually throws the camera. Every source (drilling, impacts,
 * explosions, the Long One's rumble) funnels through here, so this is the one
 * dial for overall intensity.
 */
const SHAKE_AMPLITUDE = 0.8;

export class FollowCam {
  camera: THREE.PerspectiveCamera;
  private shake = 0;
  private cx = WORLD_W / 2;
  private cy = 4;
  private cz = 17;
  reducedMotion = false;
  /** extra camera distance: vault runs hold it at 4, the dev sandbox pushes
   *  it further so a big creature fits the frame. 0 in the mines. */
  zoomBias = 0;
  /** horizontal follow clamp — vault levels are their own width, not the world's */
  xMax = WORLD_W;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(52, aspect, 0.1, 200);
    this.camera.position.set(this.cx, this.cy, this.cz);
  }

  addShake(a: number): void {
    if (!this.reducedMotion) this.shake = Math.min(0.6, this.shake + a);
  }

  /** hard snap (title pose / respawn / a chamber cut) */
  snap(x: number, y: number, z: number): void {
    this.cx = x; this.cy = y; this.cz = z;
    this.camera.position.set(x, y, z);
  }

  /** half the frame's height in world units at distance z */
  halfH(z = this.cz): number {
    return z * Math.tan((this.camera.fov * Math.PI) / 360);
  }

  /** half the frame's width in world units at distance z */
  halfW(z = this.cz): number {
    return this.halfH(z) * this.camera.aspect;
  }

  /** the distance at which `cols` tiles of width fit the frame */
  distanceForWidth(cols: number): number {
    return cols / (2 * Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect);
  }

  /**
   * F11 — the camera-locked chamber. `cx`/`cz` frame ONE chamber and are
   * never interpolated toward a moving body, so the frame cannot pan
   * sideways: it either holds still or it cuts (`snap`). Vertically it still
   * follows, because chambers are column splits and the rooms are tall.
   *
   * `cz` eases rather than snapping so the sconce chord's push-out (§VI) has
   * somewhere to live; a chamber CHANGE is a cut, and the caller snaps.
   */
  followChamber(dt: number, cx: number, cz: number, y: number, vy: number, yMin: number, yMax: number): void {
    this.cx = cx;
    this.cz += (cz - this.cz) * Math.min(1, dt * 3.4);
    const ty = Math.min(yMax, Math.max(yMin, y + vy * 0.14));
    this.cy += (ty - this.cy) * Math.min(1, dt * 4.6);
    this.apply(dt);
    this.camera.lookAt(this.cx, this.cy, 0);
  }

  follow(dt: number, x: number, y: number, vx: number, vy: number, close = false): void {
    const atSurface = y > -5 && !close;
    const speed = Math.hypot(vx, vy);
    const tx = Math.min(this.xMax - 9, Math.max(9, x + vx * 0.22));
    const ty = atSurface ? Math.max(y + 1.4, 1.8) : y + vy * 0.16 + (close ? 0.5 : 0);
    const tz = (close ? 8.5 : atSurface ? 14 : 12.5) + speed * 0.12 + this.zoomBias;

    const k = Math.min(1, dt * 4.2);
    this.cx += (tx - this.cx) * k;
    this.cy += (ty - this.cy) * k;
    this.cz += (tz - this.cz) * Math.min(1, dt * 2);

    this.apply(dt);
    this.camera.lookAt(this.cx, this.cy + (atSurface ? -0.6 : 0), 0);
  }

  /**
   * The Communion framing: starts as the EVA close-follow, then blends the
   * frame toward the midpoint of pilot and fragment as the walk crescendo
   * (t) rises, and pushes in once the touch (touch) takes over. Distance-
   * driven like everything else in the finale, so backing away recedes.
   */
  finaleFollow(dt: number, px: number, py: number, ex: number, ey: number, t: number, touch: number): void {
    const mix = 0.3 * t + 0.45 * touch;
    const tx = px + (ex - px) * mix;
    const ty = py + 0.6 + (ey - py) * (0.25 * t + 0.45 * touch);
    const tz = 8.5 + t * 1.6 - touch * 3.2;
    const k = Math.min(1, dt * (2.2 + touch * 1.5));
    this.cx += (tx - this.cx) * k;
    this.cy += (ty - this.cy) * k;
    this.cz += (tz - this.cz) * Math.min(1, dt * 1.6);
    this.apply(dt);
    this.camera.lookAt(this.cx, this.cy, 0);
  }

  /** cinematic pose used by the title screen; drift + mouse parallax */
  titlePose(time: number, mouseX: number, mouseY: number): void {
    const ox = Math.sin(time * 0.11) * 1.6 + mouseX * 1.2;
    const oy = Math.cos(time * 0.09) * 0.7 + mouseY * 0.7;
    this.cx = 22 + ox;
    this.cy = 3.4 + oy;
    this.cz = 18;
    this.camera.position.set(this.cx, this.cy, this.cz);
    this.camera.lookAt(22, 2.4, 0);
  }

  /** blend from title pose toward gameplay framing during the intro dive */
  introBlend(t: number, podX: number, podY: number): void {
    const e = 1 - Math.pow(1 - t, 3);
    const x = this.cx + (podX - this.cx) * e;
    const y = this.cy + (podY + 1.8 - this.cy) * e;
    const z = 18 + (15.5 - 18) * e;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(x, y - 0.6, 0);
    if (t >= 1) { this.cx = x; this.cy = y; this.cz = z; }
  }

  private apply(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const s = this.shake * this.shake;
    this.camera.position.set(
      this.cx + (Math.random() - 0.5) * s * SHAKE_AMPLITUDE,
      this.cy + (Math.random() - 0.5) * s * SHAKE_AMPLITUDE,
      this.cz
    );
  }

  /** world → screen px for HUD popups */
  screenPos(x: number, y: number, out: { sx: number; sy: number }): void {
    const v = new THREE.Vector3(x, y, 0).project(this.camera);
    out.sx = (v.x * 0.5 + 0.5) * window.innerWidth;
    out.sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
  }
}
