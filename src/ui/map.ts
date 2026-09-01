import { WORLD_W, WORLD_ROWS, TILE_M, BAND_FROM, PAD_X0, PAD_X1 } from '../config';
import { T, def } from '../world/tiles';
import { ACTIVE } from '../world/worlds';
import { Terrain } from '../world/terrain';
import { DOCKS } from '../world/backdrop';

// Survey Scanner: a live column map of the dig site — carved tunnels, caves,
// fluids and your position. No ores shown; the scanner reads voids, not value.

const css = (hex: number, mul = 1): string => {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * mul));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * mul));
  const b = Math.min(255, Math.round((hex & 255) * mul));
  return `rgb(${r},${g},${b})`;
};

// zoom steps: rows of world shown in the viewport (whole column → close-up)
const ZOOMS = [WORLD_ROWS, 220, 96, 44];

export class SurveyMap {
  visible = false;
  zoom = 0;
  private wrap: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private depthEl: HTMLElement;
  private zoomEl: HTMLElement;
  private lastDraw = -9;

  constructor(ui: HTMLElement) {
    this.wrap = document.createElement('div');
    this.wrap.id = 'survey';
    this.wrap.innerHTML = `
      <div class="survey-head">SURVEY<span id="survey-world"></span></div>
      <canvas width="${WORLD_W}" height="${WORLD_ROWS}"></canvas>
      <div class="survey-foot">
        <span id="survey-depth"></span> · <span id="survey-zoom"></span>
        <div class="survey-keys">+ / −  zoom · scroll · TAB closes</div>
      </div>
    `;
    ui.appendChild(this.wrap);
    this.canvas = this.wrap.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.depthEl = this.wrap.querySelector('#survey-depth')!;
    this.zoomEl = this.wrap.querySelector('#survey-zoom')!;
    // wheel over the panel zooms
    this.wrap.addEventListener('wheel', e => {
      e.preventDefault();
      this.zoomBy(e.deltaY < 0 ? 1 : -1);
    }, { passive: false });
  }

  zoomBy(dir: number): void {
    const z = Math.max(0, Math.min(ZOOMS.length - 1, this.zoom + dir));
    if (z === this.zoom) return;
    this.zoom = z;
    this.lastDraw = -9;
  }

  toggle(): boolean {
    this.visible = !this.visible;
    this.wrap.classList.toggle('open', this.visible);
    this.lastDraw = -9;
    return this.visible;
  }

  close(): void {
    if (this.visible) this.toggle();
  }

  /** cheap redraw of the visible window, throttled while open */
  refresh(terrain: Terrain, px: number, py: number, time: number, revealRow: number, deepArray: boolean): void {
    if (!this.visible || time - this.lastDraw < 0.35) return;
    this.lastDraw = time;
    (this.wrap.querySelector('#survey-world') as HTMLElement).textContent = ' — ' + ACTIVE.name;

    // viewport: the whole column at zoom 0, otherwise a window centered on you
    const rows = ZOOMS[this.zoom];
    const row = Math.max(0, Math.floor(-py));
    let y0 = this.zoom === 0 ? 0 : Math.round(row - rows / 2);
    y0 = Math.max(0, Math.min(WORLD_ROWS - rows, y0));
    const y1 = y0 + rows;
    if (this.canvas.height !== rows) this.canvas.height = rows;

    const g = this.ctx;
    const air = '#04060c';
    // the scanner only reads as deep as you have taken it (+ sensor margin)
    const limit = Math.min(WORLD_ROWS, revealRow + 8);

    for (let y = y0; y < y1; y++) {
      const cy = y - y0;
      if (y >= limit) {
        // dead static below the survey frontier
        for (let x = 0; x < WORLD_W; x++) {
          g.fillStyle = (x * 7 + y * 13) % 41 === 0 ? '#101520' : '#05060b';
          g.fillRect(x, cy, 1, 1);
        }
        continue;
      }
      let band = 0;
      for (let i = 0; i < BAND_FROM.length; i++) if (y >= BAND_FROM[i]) band = i;
      const rock = css(ACTIVE.rockColors[Math.min(band, 4)], 0.55);
      for (let x = 0; x < WORLD_W; x++) {
        const t = terrain.get(x, y);
        const d = def(t);
        if (deepArray && d.ore && t !== T.FUNGUS) {
          g.fillStyle = css(d.gem, 1);      // the Deep Array reads value, not just voids
        } else {
          g.fillStyle =
            t === T.AIR ? air :
            t === T.LAVA ? css(ACTIVE.fluid.base, 0.8) :
            t === T.BOULDER ? '#4a4d55' : rock;
        }
        g.fillRect(x, cy, 1, 1);
      }
    }
    // dashed survey frontier
    if (limit > y0 && limit < y1) {
      g.fillStyle = '#3ce6c8';
      for (let x = 0; x < WORLD_W; x += 5) g.fillRect(x, limit - y0, 3, 1);
    }
    // surface markers: docks teal, pad amber
    if (y0 === 0) {
      g.fillStyle = '#3ce6c8';
      for (const d of DOCKS) g.fillRect(Math.floor(d.x0), 0, Math.ceil(d.x1 - d.x0), 1);
      g.fillStyle = '#ff9a3c';
      g.fillRect(PAD_X0, 0, PAD_X1 - PAD_X0 + 1, 1);
    }
    // you are here — a crosshair at close zoom, a dot at column scale
    const cy = row - y0;
    if (cy >= 0 && cy < rows) {
      g.fillStyle = '#ffffff';
      if (this.zoom >= 2) {
        g.fillRect(Math.floor(px) - 3, cy, 7, 1);
        g.fillRect(Math.floor(px), cy - 3, 1, 7);
      } else {
        g.fillRect(Math.floor(px) - 1, cy - 1, 3, 3);
      }
      g.fillStyle = '#ff9a3c';
      g.fillRect(Math.floor(px), cy, 1, 1);
    }

    this.depthEl.textContent = Math.max(0, Math.round(-py * TILE_M)) + 'm';
    this.zoomEl.textContent = this.zoom === 0 ? 'FULL COLUMN' : `×${this.zoom + 1}`;
  }
}
