import * as THREE from 'three';

/**
 * The four colony structures — fuel depot, trade post, garage, assay office.
 *
 * Styled as retro-futurist miniatures after the reference plates: cream
 * enamel bodies, burnt-orange dome caps and stripe bands, gunmetal pipework,
 * warm rounded windows, and railings everywhere a person could stand. Every
 * builder returns a group centered on its dock (x=0, ground y=0) with all
 * geometry kept behind z ≈ -0.5 so the pod never clips a wall.
 */

// ---------- shared palette ----------
const CREAM = new THREE.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.55 });
const ORANGE = new THREE.MeshStandardMaterial({ color: 0xc4571f, roughness: 0.5 });
const ORANGE_DK = new THREE.MeshStandardMaterial({ color: 0x9c431c, roughness: 0.55 });
// modest metalness only — with no environment map, high metalness reads as
// pitch black; these still catch the key light as brushed steel
const GUNMETAL = new THREE.MeshStandardMaterial({ color: 0x4b545e, roughness: 0.45, metalness: 0.35 });
const DARKPIPE = new THREE.MeshStandardMaterial({ color: 0x363d45, roughness: 0.5, metalness: 0.3 });
const SLATE = new THREE.MeshStandardMaterial({ color: 0x53646c, roughness: 0.7, metalness: 0.15 });
const SLATE_DK = new THREE.MeshStandardMaterial({ color: 0x39454d, roughness: 0.65, metalness: 0.2 });
const RED_PAINT = new THREE.MeshStandardMaterial({ color: 0xa83a24, roughness: 0.6 });
const TEAL_GLASS = new THREE.MeshStandardMaterial({
  color: 0x2f8a78, roughness: 0.25, metalness: 0.1, emissive: 0x0d4034, emissiveIntensity: 1.0,
});
const TEAL_PAINT = new THREE.MeshStandardMaterial({ color: 0x2e6e64, roughness: 0.6 });
const PLINTH = new THREE.MeshStandardMaterial({ color: 0x272b31, roughness: 0.8, metalness: 0.3 });

const WARM_GLOW = new THREE.MeshBasicMaterial({ color: 0xffc06a, toneMapped: false });
const WARM_BRIGHT = new THREE.MeshBasicMaterial({ color: 0xffdfae, toneMapped: false });
const RED_GLOW = new THREE.MeshBasicMaterial({ color: 0xff4d29, toneMapped: false });
const TEAL_GLOW = new THREE.MeshBasicMaterial({ color: 0x3ce6c8, toneMapped: false });

// ---------- small-part helpers ----------
function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function cyl(r: number, h: number, mat: THREE.Material, x: number, y: number, z: number, seg = 20): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  m.position.set(x, y, z);
  return m;
}

function dome(r: number, mat: THREE.Material, x: number, y: number, z: number, squash = 1): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  m.position.set(x, y, z);
  m.scale.y = squash;
  return m;
}

function glowDot(mat: THREE.MeshBasicMaterial, x: number, y: number, z: number, s = 0.07): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 8), mat);
  m.position.set(x, y, z);
  return m;
}

/** thin ring band wrapped around a tank body — crisp painted stripe */
function stripeBand(r: number, h: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28, 1, true), mat);
  m.position.set(x, y, z);
  return m;
}

/** circular catwalk railing: top rail torus + evenly spaced posts */
function ringRail(r: number, x: number, y: number, z: number, posts = 10): THREE.Group {
  const g = new THREE.Group();
  const rail = new THREE.Mesh(new THREE.TorusGeometry(r, 0.022, 6, 32), DARKPIPE);
  rail.rotation.x = Math.PI / 2;
  rail.position.set(x, y + 0.26, z);
  g.add(rail);
  const mid = rail.clone();
  mid.position.y = y + 0.14;
  g.add(mid);
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * Math.PI * 2;
    g.add(cyl(0.016, 0.28, DARKPIPE, x + Math.cos(a) * r, y + 0.14, z + Math.sin(a) * r, 5));
  }
  return g;
}

/** straight run of railing along x */
function straightRail(w: number, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.035, 0.035, DARKPIPE, x, y + 0.28, z));
  g.add(box(w, 0.028, 0.028, DARKPIPE, x, y + 0.15, z));
  const n = Math.max(2, Math.round(w / 0.55));
  for (let i = 0; i <= n; i++) {
    g.add(cyl(0.016, 0.29, DARKPIPE, x - w / 2 + (i / n) * w, y + 0.145, z, 5));
  }
  return g;
}

/** side-mounted access ladder */
function ladder(h: number, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    g.add(box(0.03, h, 0.03, DARKPIPE, x + s * 0.11, y + h / 2, z));
  }
  const rungs = Math.floor(h / 0.24);
  for (let i = 1; i <= rungs; i++) {
    g.add(box(0.22, 0.025, 0.03, DARKPIPE, x, y + (i / (rungs + 1)) * h, z));
  }
  return g;
}

/** porthole window: gunmetal ring + warm glowing glass */
function porthole(r: number, x: number, y: number, z: number, mat: THREE.MeshBasicMaterial = WARM_GLOW): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.28, 8, 20), GUNMETAL);
  ring.position.set(x, y, z);
  g.add(ring);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(r * 0.92, 20), mat);
  glass.position.set(x, y, z + 0.005);
  g.add(glass);
  return g;
}

// ---------- canvas textures ----------
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** rounded window with gunmetal frame, warm panes, mullion bars */
function roundWindow(w: number, h: number, x: number, y: number, z: number, mullions = true): THREE.Mesh {
  const tex = canvasTex(256, Math.round(256 * (h / w)), g => {
    const W = 256, H = g.canvas.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#22272c';
    rr(g, 0, 0, W, H, Math.min(W, H) * 0.24); g.fill();
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#ffe0a8');
    grad.addColorStop(0.55, '#ffb85e');
    grad.addColorStop(1, '#e08a3a');
    g.fillStyle = grad;
    rr(g, 18, 18, W - 36, H - 36, Math.min(W, H) * 0.16); g.fill();
    if (mullions) {
      g.strokeStyle = '#2b3036'; g.lineWidth = 10;
      g.beginPath();
      g.moveTo(W * 0.5, 18); g.lineTo(W * 0.5, H - 18);
      g.moveTo(18, H * 0.42); g.lineTo(W - 18, H * 0.42);
      g.stroke();
    }
  });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
  );
  m.position.set(x, y, z);
  return m;
}

/** glowing roller door: horizontal slats, hot at center, like a lit hangar mouth */
function rollerDoor(w: number, h: number, x: number, y: number, z: number): THREE.Mesh {
  const tex = canvasTex(256, 256, g => {
    const grad = g.createRadialGradient(128, 150, 20, 128, 150, 210);
    grad.addColorStop(0, '#ffbb6e');
    grad.addColorStop(0.55, '#e07830');
    grad.addColorStop(1, '#a34a1e');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(60,26,10,0.55)'; g.lineWidth = 4;
    for (let yy = 12; yy < 256; yy += 16) {
      g.beginPath(); g.moveTo(0, yy); g.lineTo(256, yy); g.stroke();
    }
    g.strokeStyle = 'rgba(255,224,170,0.25)'; g.lineWidth = 2;
    for (let yy = 6; yy < 256; yy += 16) {
      g.beginPath(); g.moveTo(0, yy); g.lineTo(256, yy); g.stroke();
    }
  });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
  );
  m.position.set(x, y, z);
  return m;
}

/** corrugated end-wall sheeting */
function corrugatedTex(base: string, dark: string): THREE.CanvasTexture {
  return canvasTex(256, 256, g => {
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 10) {
      g.fillStyle = dark;
      g.fillRect(x, 0, 3, 256);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(x + 6, 0, 2, 256);
    }
  });
}

/** stencilled unit number decal */
function decal(text: string, color: string, w: number, x: number, y: number, z: number): THREE.Mesh {
  const tex = canvasTex(128, 64, g => {
    g.clearRect(0, 0, 128, 64);
    g.font = '700 44px "Chakra Petch", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = color;
    g.fillText(text, 64, 34);
  });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, w * 0.5),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, opacity: 0.9 })
  );
  m.position.set(x, y, z);
  return m;
}

/** warm-lit doorway with frame — every building needs a way in */
function doorway(w: number, h: number, x: number, y: number, z: number, frameMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w + 0.14, h + 0.1, 0.08, frameMat, x, y + h / 2, z - 0.04));
  const tex = canvasTex(128, 256, g2 => {
    g2.clearRect(0, 0, 128, 256);
    g2.fillStyle = '#1d2126';
    rr(g2, 0, 0, 128, 256, 26); g2.fill();
    const grad = g2.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#ffd89a'); grad.addColorStop(1, '#e8933f');
    g2.fillStyle = grad;
    rr(g2, 14, 14, 100, 228, 18); g2.fill();
    g2.fillStyle = '#2b3036';
    g2.fillRect(14, 150, 100, 10);
  });
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
  );
  door.position.set(x, y + h / 2, z + 0.01);
  g.add(door);
  return g;
}

/** flanged pipe run along x, with joint discs */
function pipeRun(len: number, r: number, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const p = cyl(r, len, DARKPIPE, x, y, z, 12);
  p.rotation.z = Math.PI / 2;
  g.add(p);
  for (const f of [-0.35, 0.35]) {
    const disc = cyl(r * 1.5, 0.05, GUNMETAL, x + f * len, y, z, 12);
    disc.rotation.z = Math.PI / 2;
    g.add(disc);
  }
  return g;
}

/** hand valve wheel */
function valve(x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 6, 14), RED_PAINT);
  wheel.rotation.x = Math.PI / 2;
  wheel.position.set(x, y, z);
  g.add(wheel);
  g.add(cyl(0.025, 0.12, DARKPIPE, x, y - 0.07, z, 6));
  return g;
}

// ---------- signage (shared with backdrop) ----------
export function textSign(text: string, color: string): THREE.Mesh {
  const tex = canvasTex(512, 96, g => {
    g.fillStyle = 'rgba(10,8,18,0.92)';
    g.fillRect(0, 0, 512, 96);
    g.font = '700 52px "Chakra Petch", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 26;
    g.fillStyle = color;
    g.fillText(text, 256, 52);
  });
  return new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 0.64),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true })
  );
}

/**
 * A sign hung from a real gantry: two legs joined by a crossbar overhead,
 * with the panel suspended on hanger straps. However wide the legs stand,
 * everything stays physically connected — nothing floats.
 */
export function gantrySign(text: string, color: string, x: number, y: number, z: number, span = 1.5): THREE.Group {
  const g = new THREE.Group();
  const sign = textSign(text, color);
  sign.position.set(x, y, z);
  g.add(sign);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x241d33, roughness: 0.7, metalness: 0.5 });
  const yTop = y + 0.52;  // crossbar rides above the panel
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, yTop, 6), legMat);
    leg.position.set(x + s * span, yTop / 2, z);
    g.add(leg);
    // gusset where the leg meets the crossbar
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.05), legMat);
    brace.position.set(x + s * (span - 0.17), yTop - 0.26, z);
    brace.rotation.z = s * 0.6;
    g.add(brace);
  }
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(span * 2 + 0.16, 0.09, 0.09), legMat);
  crossbar.position.set(x, yTop, z);
  g.add(crossbar);
  // hanger straps from the crossbar down to the panel's top edge
  const hangSpread = Math.min(1.35, span - 0.12);
  for (const s of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.24, 0.045), legMat);
    strap.position.set(x + s * hangSpread, y + 0.42, z);
    g.add(strap);
  }
  return g;
}

// =====================================================================
// FUEL DEPOT — a tank farm of three bullet silos: cream enamel bodies,
// orange dome caps and stripe bands, coiled pipe skirts, a pump kiosk.
// =====================================================================
export function buildFuelDepot(): THREE.Group {
  const g = new THREE.Group();

  // shared ground plinth with an orange safety stripe on its front face
  g.add(box(5.6, 0.12, 2.7, PLINTH, 0, 0.06, -1.75));
  g.add(box(5.6, 0.05, 0.01, ORANGE, 0, 0.095, -0.398));

  interface TankSpec { x: number; z: number; r: number; body: number; stripes: number[]; }
  const tanks: TankSpec[] = [
    { x: -1.8, z: -1.7, r: 0.6, body: 1.55, stripes: [0.72] },
    { x: 0, z: -2.0, r: 0.85, body: 2.3, stripes: [0.62, 0.76] },
    { x: 1.8, z: -1.6, r: 0.55, body: 1.35, stripes: [0.68] },
  ];

  for (const t of tanks) {
    // orange base skirt + coiled pipe wrap (the greebled foot of each silo)
    g.add(cyl(t.r * 1.08, 0.4, ORANGE_DK, t.x, 0.2, t.z, 24));
    for (let i = 0; i < 3; i++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(t.r * 1.06, 0.045, 8, 26), DARKPIPE);
      coil.rotation.x = Math.PI / 2;
      coil.position.set(t.x, 0.44 + i * 0.11, t.z);
      g.add(coil);
    }
    // cream body
    const y0 = 0.72;
    g.add(cyl(t.r, t.body, CREAM, t.x, y0 + t.body / 2, t.z, 28));
    // painted stripe bands
    for (const [i, frac] of t.stripes.entries()) {
      g.add(stripeBand(t.r + 0.006, i === 0 ? 0.16 : 0.07, ORANGE, t.x, y0 + t.body * frac, t.z));
    }
    // porthole, lit from inside
    g.add(porthole(0.13, t.x, y0 + t.body * 0.42, t.z + t.r + 0.01));
    // shoulder catwalk ring + railing
    const shoulderY = y0 + t.body;
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(t.r + 0.14, t.r + 0.14, 0.05, 28), GUNMETAL);
    deck.position.set(t.x, shoulderY + 0.02, t.z);
    g.add(deck);
    g.add(ringRail(t.r + 0.12, t.x, shoulderY + 0.05, t.z, 12));
    // orange dome cap + vent cap + finial
    g.add(dome(t.r, ORANGE, t.x, shoulderY + 0.04, t.z, 0.8));
    g.add(cyl(t.r * 0.28, 0.08, GUNMETAL, t.x, shoulderY + t.r * 0.8 + 0.05, t.z, 12));
    g.add(cyl(0.02, 0.28, DARKPIPE, t.x, shoulderY + t.r * 0.8 + 0.2, t.z, 6));
  }

  // center tank wears the depot's unit number and a red masthead beacon
  g.add(decal('03', '#c4571f', 0.42, 0, 1.35, -2.0 + 0.85 + 0.012));
  g.add(glowDot(RED_GLOW, 0, 3.02 + 0.68 + 0.34, -2.0, 0.05));
  // right tank: instrument mast with a teal marker lamp
  g.add(cyl(0.018, 0.5, DARKPIPE, 1.95, 2.68, -1.6, 5));
  g.add(glowDot(TEAL_GLOW, 1.95, 2.96, -1.6, 0.045));

  // access ladder up the center silo
  g.add(ladder(2.3, -0.55, 0.7, -1.32));

  // linking pipework: one fat flanged main at knee height, risers, valves
  g.add(pipeRun(3.4, 0.09, 0, 0.62, -1.05));
  g.add(cyl(0.07, 0.62, DARKPIPE, -1.8, 0.31, -1.05, 10));
  g.add(cyl(0.07, 0.62, DARKPIPE, 1.8, 0.31, -1.05, 10));
  g.add(valve(-0.9, 0.82, -1.05));
  g.add(valve(0.9, 0.82, -1.05));
  g.add(glowDot(TEAL_GLOW, 0, 0.82, -0.98, 0.05));

  // pump kiosk: the little orange booth where the meter runs
  g.add(box(0.72, 0.78, 0.6, ORANGE, -2.45, 0.51, -1.05));
  g.add(box(0.8, 0.06, 0.68, GUNMETAL, -2.45, 0.93, -1.05));
  g.add(roundWindow(0.4, 0.3, -2.45, 0.62, -0.74, false));
  g.add(box(0.1, 0.22, 0.1, GUNMETAL, -2.2, 1.06, -1.05));
  g.add(glowDot(WARM_GLOW, -2.2, 1.2, -1.05, 0.05));

  // spare fuel drums by the kiosk
  g.add(cyl(0.15, 0.34, RED_PAINT, -2.75, 0.29, -0.7, 12));
  g.add(cyl(0.13, 0.3, ORANGE_DK, -2.5, 0.27, -0.62, 12));

  // wide gantry so the legs frame the tank farm instead of piercing it
  g.add(gantrySign('FUEL', '#3ce6c8', 0, 4.55, -0.55, 2.6));
  return g;
}

// =====================================================================
// TRADE POST — a bulbous cream hut under a burnt-orange dome, with the
// glowing halo band between them, a red door under an awning, a lit shop
// window annex, and cargo crates stacked on the deck.
// =====================================================================
export function buildTradePost(): THREE.Group {
  const g = new THREE.Group();

  // raised trading deck with railing and front steps
  g.add(box(5.4, 0.14, 2.9, PLINTH, 0, 0.07, -1.85));
  g.add(straightRail(1.6, -2.6 + 0.8, 0.14, -0.55));
  g.add(straightRail(1.6, 2.6 - 0.8, 0.14, -0.55));
  g.add(box(0.9, 0.05, 0.28, GUNMETAL, 0, 0.1, -0.35));
  g.add(box(0.9, 0.05, 0.28, GUNMETAL, 0, 0.045, -0.2));

  // main body: a pressure hull that bulges like a kettle
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 20), CREAM);
  body.position.set(0, 1.18, -2.0);
  body.scale.set(1.15, 0.85, 0.94);
  g.add(body);
  g.add(cyl(1.62, 0.22, GUNMETAL, 0, 0.24, -2.0, 32));

  // the signature halo: a glowing lantern band between body and dome
  g.add(cyl(1.06, 0.05, GUNMETAL, 0, 2.14, -2.0, 28));
  g.add(stripeBand(1.02, 0.13, WARM_BRIGHT, 0, 2.23, -2.0));
  g.add(cyl(1.1, 0.06, GUNMETAL, 0, 2.32, -2.0, 28));
  const halo = new THREE.PointLight(0xffd9a0, 6, 6, 2);
  halo.position.set(0, 2.3, -1.6);
  g.add(halo);

  // burnt-orange dome, capped and finialed
  g.add(dome(1.04, ORANGE, 0, 2.33, -2.0, 0.85));
  g.add(cyl(0.16, 0.1, GUNMETAL, 0, 3.24, -2.0, 12));
  g.add(cyl(0.02, 0.34, DARKPIPE, 0, 3.44, -2.0, 6));
  g.add(glowDot(WARM_GLOW, 0, 3.63, -2.0, 0.04));
  // dome portholes — raised bezels so the rings sit proud of the curve
  for (const s of [-1, 1]) {
    const bezel = cyl(0.1, 0.12, GUNMETAL, s * 0.42, 2.72, -1.13, 14);
    bezel.rotation.x = Math.PI / 2;
    g.add(bezel);
    g.add(porthole(0.09, s * 0.42, 2.72, -1.06, WARM_GLOW));
  }

  // stovepipe chimney and a little comms whip on the shoulder
  g.add(cyl(0.06, 0.9, DARKPIPE, -0.85, 2.6, -2.35, 10));
  g.add(cyl(0.08, 0.1, GUNMETAL, -0.85, 3.06, -2.35, 10));
  g.add(cyl(0.014, 0.85, DARKPIPE, 0.95, 2.95, -2.5, 5));
  g.add(glowDot(RED_GLOW, 0.95, 3.4, -2.5, 0.035));

  // entry vestibule: a porch that steps OUT of the curved hull, so the door
  // sits on a flat face instead of clipping into the sphere
  g.add(box(0.95, 1.15, 0.55, CREAM, 0, 0.715, -0.86));
  g.add(box(1.05, 0.07, 0.62, GUNMETAL, 0, 1.32, -0.87));
  g.add(doorway(0.62, 0.98, 0, 0.14, -0.57, RED_PAINT));
  g.add(glowDot(WARM_GLOW, 0, 1.24, -0.57, 0.045));
  // orange awning canopy seated on the porch roof, leaning back to the hull
  const awning = box(1.05, 0.06, 0.52, ORANGE, 0, 1.41, -0.72);
  awning.rotation.x = -0.28;
  g.add(awning);

  // body portholes flanking the door — on raised bezels welded to the hull,
  // standing proud of the curve rather than sunk into it
  for (const s of [-1, 1]) {
    const bezel = cyl(0.16, 0.18, GUNMETAL, s * 0.95, 1.25, -0.79, 16);
    bezel.rotation.x = Math.PI / 2;
    g.add(bezel);
    g.add(porthole(0.14, s * 0.95, 1.25, -0.69));
  }

  // shop-window annex: the vending counter, warm and stocked
  g.add(box(1.5, 1.15, 1.15, CREAM, -2.05, 0.72, -1.5));
  g.add(box(1.6, 0.08, 1.25, GUNMETAL, -2.05, 1.33, -1.5));
  g.add(roundWindow(1.0, 0.62, -2.05, 0.82, -0.91));
  g.add(box(0.08, 0.5, 0.08, DARKPIPE, -2.72, 1.62, -1.5));
  g.add(glowDot(TEAL_GLOW, -2.72, 1.92, -1.5, 0.045));

  // cargo on the deck: strapped crates and a barrel, freshly landed
  const crate = (w: number, h: number, mat: THREE.Material, x: number, y: number, z: number): void => {
    g.add(box(w, h, w, mat, x, y + h / 2, z));
    g.add(box(w + 0.02, 0.05, w + 0.02, DARKPIPE, x, y + h * 0.3, z));
    g.add(box(w + 0.02, 0.05, w + 0.02, DARKPIPE, x, y + h * 0.75, z));
  };
  crate(0.52, 0.42, TEAL_PAINT, 2.05, 0.14, -1.15);
  crate(0.44, 0.38, ORANGE_DK, 2.55, 0.14, -0.95);
  crate(0.4, 0.34, TEAL_PAINT, 2.25, 0.56, -1.1);
  g.add(cyl(0.16, 0.36, RED_PAINT, 1.6, 0.32, -0.85, 12));

  g.add(gantrySign('TRADE', '#ff9a3c', 0, 4.1, -0.55, 1.6));
  return g;
}

// =====================================================================
// GARAGE — a quonset repair bay: slate vault under a heavy gunmetal arch
// rib, a glowing roller door with a tube lamp, an office annex, and a
// derrick crane leaning over the roof.
// =====================================================================
export function buildGarage(): THREE.Group {
  const g = new THREE.Group();

  g.add(box(5.8, 0.1, 3.1, PLINTH, 0, 0.05, -1.95));

  // the vault: half-pipe shell laid along z (thetaStart -90° puts the curve
  // over +Z pre-rotation, so tipping -90° about x rolls it up over +Y)
  const R = 2.05, DEPTH = 2.3, CZ = -1.95;
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, DEPTH, 40, 1, true, -Math.PI / 2, Math.PI), SLATE);
  shell.rotation.x = -Math.PI / 2;
  shell.position.set(-0.3, 0.1, CZ);
  g.add(shell);

  // corrugated end wall, recessed inside the arch
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(R - 0.06, 40, 0, Math.PI),
    new THREE.MeshStandardMaterial({ map: corrugatedTex('#46565e', '#37444b'), roughness: 0.75 })
  );
  face.position.set(-0.3, 0.1, CZ + DEPTH / 2 + 0.01);
  g.add(face);
  g.add(box(3.9, 0.32, 0.06, SLATE_DK, -0.3, 0.16, CZ + DEPTH / 2 + 0.02));

  // signature arch ribs: gunmetal half-tori framing the mouth and the tail
  for (const [zz, tube] of [[CZ + DEPTH / 2 + 0.04, 0.1], [CZ - DEPTH / 2, 0.08]] as const) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(R + 0.02, tube, 10, 34, Math.PI), GUNMETAL);
    rib.position.set(-0.3, 0.1, zz);
    g.add(rib);
  }
  // ridge line greebles along the crown, an antenna seated on the shell
  for (const ox of [-1.0, -0.3, 0.4]) {
    const oy = Math.sqrt(R * R - ox * ox) + 0.1;
    g.add(box(0.14, 0.1, 0.3, DARKPIPE, -0.3 + ox, oy + 0.03, CZ));
  }
  g.add(cyl(0.014, 0.8, DARKPIPE, -1.3, Math.sqrt(R * R - 1.0) + 0.5, CZ, 5));

  // the glowing roller door — the warm mouth of the bay
  g.add(rollerDoor(1.65, 1.5, -0.3, 0.87, -0.78));
  for (const s of [-1, 1]) {
    g.add(box(0.1, 1.56, 0.08, GUNMETAL, -0.3 + s * 0.88, 0.88, -0.79));
  }
  g.add(box(1.86, 0.1, 0.08, GUNMETAL, -0.3, 1.72, -0.79));
  // tube work lamp over the door, with its little hood
  g.add(box(0.9, 0.05, 0.05, WARM_BRIGHT, -0.3, 1.92, -0.72));
  g.add(box(1.0, 0.04, 0.12, DARKPIPE, -0.3, 1.97, -0.76));
  const doorLight = new THREE.PointLight(0xffb066, 5, 5, 2);
  doorLight.position.set(-0.3, 1.5, -0.5);
  g.add(doorLight);

  // stencilled bay number on the shell
  g.add(decal('510', '#c9d4d9', 0.5, 0.98, 1.35, -0.72));

  // office annex, flat-roofed, one warm window
  g.add(box(1.35, 1.05, 1.25, SLATE_DK, -2.35, 0.62, -1.45));
  g.add(box(1.55, 0.07, 1.45, GUNMETAL, -2.35, 1.18, -1.45));
  g.add(roundWindow(0.62, 0.44, -2.35, 0.72, -0.81));
  g.add(cyl(0.04, 0.5, DARKPIPE, -2.85, 1.44, -1.7, 8));
  g.add(straightRail(1.4, -2.35, 1.21, -0.9));

  // derrick crane: a tapering A-frame tower, braced at three heights, with
  // a jib arm reaching out over the bay and a hook on a cable
  const DX = 2.35, DZ = -2.4, DH = 4.2;
  const B = 0.52, T = 0.12;              // half-spread at base and crown
  const lean = Math.atan2(B - T, DH);    // legs lean inward as they climb
  const legLen = DH / Math.cos(lean);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const leg = cyl(0.04, legLen, GUNMETAL, DX + sx * (B + T) / 2, DH / 2, DZ + sz * (B + T) / 2, 6);
    leg.rotation.z = sx * lean;
    leg.rotation.x = -sz * lean;
    g.add(leg);
  }
  for (let i = 0; i < 3; i++) {
    const y = 0.8 + i * 1.35;
    const w = B + (T - B) * (y / DH);   // brace width follows the taper
    g.add(box(w * 2, 0.05, 0.05, GUNMETAL, DX, y, DZ - w));
    g.add(box(w * 2, 0.05, 0.05, GUNMETAL, DX, y, DZ + w));
    g.add(box(0.05, 0.05, w * 2, GUNMETAL, DX - w, y, DZ));
    g.add(box(0.05, 0.05, w * 2, GUNMETAL, DX + w, y, DZ));
  }
  // orange crown block, jib arm pinned to it, cable and hook off the tip
  g.add(box(0.42, 0.24, 0.42, ORANGE, DX, DH + 0.12, DZ));
  const armLen = 1.7, armAng = 0.32;     // radians above horizontal
  const arm = cyl(0.045, armLen, GUNMETAL, DX - Math.cos(armAng) * armLen / 2, DH + 0.24 + Math.sin(armAng) * armLen / 2, DZ, 6);
  arm.rotation.z = Math.PI / 2 - armAng;
  g.add(arm);
  const tipX = DX - Math.cos(armAng) * armLen;
  const tipY = DH + 0.24 + Math.sin(armAng) * armLen;
  const cableLen = 1.15;
  g.add(cyl(0.012, cableLen, DARKPIPE, tipX, tipY - cableLen / 2, DZ, 4));
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 12, Math.PI * 1.4), ORANGE);
  hook.position.set(tipX, tipY - cableLen - 0.06, DZ);
  hook.rotation.z = Math.PI;
  g.add(hook);
  g.add(glowDot(RED_GLOW, DX, DH + 0.32, DZ, 0.05));

  // yard props: drums, a toolbox crate, a spare wheel against the shell
  g.add(cyl(0.16, 0.36, RED_PAINT, 1.32, 0.28, -0.72, 12));
  g.add(cyl(0.16, 0.42, ORANGE_DK, 1.6, 0.31, -0.85, 12));
  g.add(box(0.5, 0.34, 0.4, ORANGE, -1.7, 0.27, -0.8));
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.08, 8, 18), DARKPIPE);
  wheel.position.set(0.98, 0.3, -0.68);
  g.add(wheel);

  // wide gantry: legs clear of the door and the derrick both
  g.add(gantrySign('GARAGE', '#e8e2d5', -0.3, 3.55, -0.55, 2.6));
  return g;
}

// =====================================================================
// ASSAY OFFICE — the listening post: a tall slate tower with warm rounded
// windows, a railed catwalk crown, and the burnt-orange dish gantry that
// hears colonies going quiet. A caged teal greenhouse glows at its foot.
// =====================================================================
export function buildAssay(): THREE.Group {
  const g = new THREE.Group();
  const TX = 0.5, TZ = -1.8;

  // base platform with railing and steps — reaching left past the greenhouse
  // to the sign posts, so the whole yard stands on one pad
  g.add(box(5.6, 0.14, 2.7, PLINTH, -0.4, 0.07, -1.7));
  g.add(straightRail(1.3, -1.75, 0.14, -0.5));
  g.add(box(0.8, 0.05, 0.26, GUNMETAL, TX, 0.1, -0.42));

  // ground floor: a wider gunmetal-trimmed story with the entry door
  g.add(box(2.0, 0.95, 1.85, SLATE_DK, TX, 0.62, TZ));
  g.add(box(2.12, 0.08, 1.97, GUNMETAL, TX, 1.13, TZ));
  g.add(doorway(0.5, 0.8, TX, 0.14, -0.85, GUNMETAL));
  g.add(glowDot(WARM_GLOW, TX, 1.06, -0.82, 0.04));

  // the tower shaft: slate panels, gunmetal corner trim, seam lines
  const SH = 3.5, SY = 1.17;
  g.add(box(1.35, SH, 1.35, SLATE, TX, SY + SH / 2, TZ));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    g.add(box(0.09, SH, 0.09, GUNMETAL, TX + sx * 0.67, SY + SH / 2, TZ + sz * 0.67));
  }
  g.add(box(1.44, 0.07, 1.44, GUNMETAL, TX, SY + SH * 0.36, TZ));
  g.add(box(1.44, 0.07, 1.44, GUNMETAL, TX, SY + SH * 0.72, TZ));

  // two storeys of warm rounded windows, a vent grille above
  g.add(roundWindow(0.68, 0.52, TX, 2.45, TZ + 0.69));
  g.add(roundWindow(0.68, 0.52, TX, 3.65, TZ + 0.69));
  const grille = canvasTex(128, 64, gg => {
    gg.fillStyle = '#262c31'; gg.fillRect(0, 0, 128, 64);
    gg.fillStyle = '#3c464d';
    for (let y = 6; y < 64; y += 10) gg.fillRect(8, y, 112, 4);
  });
  const vent = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.26),
    new THREE.MeshStandardMaterial({ map: grille, roughness: 0.8 }));
  vent.position.set(TX, 4.35, TZ + 0.69);
  g.add(vent);
  g.add(decal('143', '#c4571f', 0.4, TX + 0.3, 1.75, TZ + 0.69));

  // side plumbing: a strapped sample tank and a pipe run to the ground
  g.add(cyl(0.24, 0.66, GUNMETAL, TX - 0.85, 2.0, TZ - 0.2, 14));
  g.add(dome(0.24, SLATE_DK, TX - 0.85, 2.33, TZ - 0.2, 0.7));
  g.add(stripeBand(0.25, 0.05, DARKPIPE, TX - 0.85, 2.1, TZ - 0.2));
  g.add(cyl(0.05, 3.1, DARKPIPE, TX + 0.82, 1.75, TZ - 0.35, 8));
  g.add(cyl(0.05, 2.2, DARKPIPE, TX + 0.94, 1.3, TZ + 0.1, 8));
  g.add(valve(TX + 0.94, 2.44, TZ + 0.1));

  // catwalk crown: deck, railings, corner brackets
  const DY = SY + SH;
  g.add(box(2.35, 0.12, 2.35, GUNMETAL, TX, DY + 0.06, TZ));
  g.add(straightRail(2.35, TX, DY + 0.12, TZ - 1.17));
  g.add(straightRail(2.35, TX, DY + 0.12, TZ + 1.17));
  for (const s of [-1, 1]) {
    const side = straightRail(2.35, 0, DY + 0.12, 0);
    side.rotation.y = Math.PI / 2;
    side.position.set(TX + s * 1.17, 0, TZ);
    g.add(side);
  }
  // dish gantry: four splayed legs up from the deck to the mount
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const leg = cyl(0.035, 0.95, GUNMETAL, TX + sx * 0.32, DY + 0.55, TZ + sz * 0.32, 6);
    leg.rotation.z = -sx * 0.3;
    leg.rotation.x = sz * 0.3;
    g.add(leg);
  }
  g.add(box(0.5, 0.06, 0.5, GUNMETAL, TX, DY + 0.98, TZ));
  g.add(cyl(0.08, 0.3, DARKPIPE, TX, DY + 1.12, TZ, 10));

  // the dish itself: a burnt-orange bowl tipped skyward, listening off-world
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2.6),
    new THREE.MeshStandardMaterial({ color: 0xc4571f, roughness: 0.5, side: THREE.DoubleSide })
  );
  bowl.position.set(TX, DY + 1.46, TZ + 0.1);
  bowl.rotation.x = -2.45;
  g.add(bowl);
  // rim ring sits in the plane of the bowl's opening — offset from the bowl
  // center along its pole (down-back), not along the opening direction
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.035, 8, 30), GUNMETAL);
  rim.position.set(TX, DY + 1.2, TZ - 0.12);
  rim.rotation.x = -2.45 + Math.PI / 2;
  g.add(rim);
  // single feed boom out along the dish axis, horn red-tipped
  const boom = cyl(0.02, 0.85, DARKPIPE, TX, DY + 1.79, TZ + 0.37, 6);
  boom.rotation.x = -2.45;   // aligned with the bowl's axis
  g.add(boom);
  g.add(cyl(0.045, 0.14, GUNMETAL, TX, DY + 2.13, TZ + 0.65, 8));
  g.add(glowDot(RED_GLOW, TX, DY + 2.21, TZ + 0.72, 0.05));

  // the red service mast — a slim painted lattice against the sky
  const MX = TX - 1.0;
  for (const s of [-1, 1]) {
    g.add(box(0.035, 1.5, 0.035, RED_PAINT, MX + s * 0.09, DY + 0.75, TZ - 0.8));
  }
  for (let i = 0; i < 5; i++) {
    g.add(box(0.18, 0.028, 0.035, RED_PAINT, MX, DY + 0.25 + i * 0.28, TZ - 0.8));
  }
  g.add(glowDot(RED_GLOW, MX, DY + 1.58, TZ - 0.8, 0.045));

  // the caged teal greenhouse at the tower's foot — living light, kept close
  const GX = -1.7, GZ = -1.45;
  g.add(cyl(0.82, 0.12, GUNMETAL, GX, 0.2, GZ, 24));
  g.add(dome(0.75, TEAL_GLASS, GX, 0.26, GZ));
  for (const ry of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    const ribArc = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.025, 6, 20, Math.PI), DARKPIPE);
    ribArc.position.set(GX, 0.26, GZ);
    ribArc.rotation.y = ry;
    g.add(ribArc);
  }
  g.add(glowDot(TEAL_GLOW, GX, 0.62, GZ + 0.62, 0.05));
  const glow = new THREE.PointLight(0x3ce6c8, 3, 4, 2);
  glow.position.set(GX, 0.7, GZ + 0.5);
  g.add(glow);

  // the sign stands beside the tower, over the greenhouse — a roadside
  // marker rather than a billboard strapped across the facade
  g.add(gantrySign('ASSAY', '#7a5cff', -1.55, 2.7, -0.6, 1.5));
  return g;
}

// =====================================================================
// THE QUARTERS — the driller's own hab, west of the pad: a low cream
// barrel on a slab, orange-banded, one stovepipe, wash on the line.
// The only structure on the row that isn't Cindral's. Walk in.
// =====================================================================
export function buildQuarters(): THREE.Group {
  const g = new THREE.Group();
  const FERN = new THREE.MeshStandardMaterial({ color: 0x6e9668, roughness: 0.8 });

  // slab with a short rail and thin front steps
  g.add(box(4.9, 0.14, 2.6, PLINTH, 0, 0.07, -1.75));
  g.add(straightRail(1.4, -1.6, 0.14, -0.52));
  g.add(box(0.85, 0.05, 0.26, GUNMETAL, 0.15, 0.1, -0.4));
  g.add(box(0.85, 0.05, 0.26, GUNMETAL, 0.15, 0.045, -0.24));

  // hab barrel: a horizontal pressure tube with domed end caps
  const barrel = cyl(1.02, 2.9, CREAM, 0, 1.16, -1.95, 26);
  barrel.rotation.z = Math.PI / 2;
  g.add(barrel);
  for (const s of [-1, 1]) {
    const cap = dome(1.0, CREAM, s * 1.45, 1.16, -1.95);
    cap.rotation.z = s * -Math.PI / 2;
    g.add(cap);
  }
  // painted bands where the tube sections join
  for (const bx of [-0.95, 0.95]) {
    const band = stripeBand(1.04, 0.12, ORANGE, bx, 1.16, -1.95);
    band.rotation.z = Math.PI / 2;
    g.add(band);
  }
  g.add(decal('01', '#c4571f', 0.36, -1.05, 1.55, -0.93));

  // entry vestibule stepping out of the curve, door on a flat face
  g.add(box(0.95, 1.12, 0.5, CREAM, 0.15, 0.7, -0.82));
  g.add(box(1.05, 0.07, 0.58, GUNMETAL, 0.15, 1.29, -0.83));
  g.add(doorway(0.6, 0.96, 0.15, 0.14, -0.56, ORANGE_DK));
  g.add(glowDot(WARM_GLOW, 0.15, 1.21, -0.56, 0.045));
  const porch = new THREE.PointLight(0xffd9a0, 5, 5, 2);
  porch.position.set(0.15, 1.5, -0.4);
  g.add(porch);

  // portholes flanking the vestibule, on raised bezels
  for (const s of [-1, 1]) {
    const bezel = cyl(0.13, 0.16, GUNMETAL, 0.15 + s * 0.98, 1.32, -1.02, 14);
    bezel.rotation.x = Math.PI / 2;
    g.add(bezel);
    g.add(porthole(0.11, 0.15 + s * 0.98, 1.32, -0.94));
  }

  // stovepipe with a rain cap — somebody cooks here
  g.add(cyl(0.055, 0.85, DARKPIPE, -0.7, 2.45, -2.2, 10));
  g.add(cyl(0.09, 0.05, GUNMETAL, -0.7, 2.9, -2.2, 10));
  g.add(dome(0.085, DARKPIPE, -0.7, 2.93, -2.2, 0.6));
  g.add(glowDot(WARM_GLOW, -0.7, 2.87, -2.14, 0.028));

  // wash line from the vestibule roof to a post: two towels drying in dusk,
  // hung forward of the barrel's curve so they actually read from the pad
  g.add(cyl(0.03, 1.35, DARKPIPE, 1.95, 0.815, -0.75, 6));
  const line = cyl(0.008, 1.35, DARKPIPE, 1.28, 1.4, -0.72, 4);
  line.rotation.z = Math.PI / 2 - 0.09;
  g.add(line);
  g.add(box(0.26, 0.3, 0.012, TEAL_PAINT, 1.05, 1.28, -0.72));
  g.add(box(0.2, 0.24, 0.012, ORANGE_DK, 1.5, 1.26, -0.73));

  // planter crate with a fern grown from greenhouse stock
  g.add(box(0.44, 0.26, 0.34, TEAL_PAINT, -1.35, 0.27, -0.72));
  g.add(box(0.48, 0.04, 0.38, DARKPIPE, -1.35, 0.42, -0.72));
  for (const [fx, fh] of [[-1.43, 0.34], [-1.35, 0.44], [-1.27, 0.3]] as const) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.07, fh, 6), FERN);
    frond.position.set(fx, 0.4 + fh / 2, -0.72);
    g.add(frond);
  }

  // a squat reserve tank tucked at the far end, strapped and banded
  g.add(cyl(0.34, 0.72, GUNMETAL, -1.95, 0.5, -2.3, 16));
  g.add(dome(0.34, ORANGE, -1.95, 0.86, -2.3, 0.6));
  g.add(stripeBand(0.35, 0.05, DARKPIPE, -1.95, 0.62, -2.3));

  g.add(gantrySign('QUARTERS', '#ffc06a', 0.1, 3.3, -0.6, 1.7));
  return g;
}

export type StructureKey = 'fuel' | 'trade' | 'garage' | 'assay' | 'quarters';
export const STRUCTURE_BUILDERS: Record<StructureKey, () => THREE.Group> = {
  fuel: buildFuelDepot,
  trade: buildTradePost,
  garage: buildGarage,
  assay: buildAssay,
  quarters: buildQuarters,
};
