import { GameState } from '../game/state';
import { stratumIndex, LOW_FUEL_FRAC, EVA_O2, fmtMoney, CUR_NAME, SPILL_WARN } from '../config';
import { def } from '../world/tiles';
import { ACTIVE, worldById } from '../world/worlds';
import { oreIcon } from './icons';
import { glyphs, glyph } from '../input/prompts';

// DOM HUD: bars, depth, money, cargo, prompt, toasts, popups, damage flash.

export class Hud {
  private root: HTMLElement;
  private fuelFill!: HTMLElement;
  private fuelBar!: HTMLElement;
  private fuelVal!: HTMLElement;
  private hullFill!: HTMLElement;
  private hullVal!: HTMLElement;
  private heatWrap!: HTMLElement;
  private heatFill!: HTMLElement;
  private o2Wrap!: HTMLElement;
  private o2Fill!: HTMLElement;
  private o2Val!: HTMLElement;
  private o2Bar!: HTMLElement;
  private heatLabel!: HTMLElement;
  private spillEl!: HTMLElement;
  private spillTime!: HTMLElement;
  private contractEl!: HTMLElement;
  private ctName!: HTMLElement;
  private ctReward!: HTMLElement;
  private ctFill!: HTMLElement;
  private ctMeta!: HTMLElement;
  private fpsEl!: HTMLElement;
  private lampEl!: HTMLElement;
  private kitEl!: HTMLElement;
  private kitFlares!: HTMLElement;
  private kitCharges!: HTMLElement;
  private kitArrestors!: HTMLElement;
  private moneyEl!: HTMLElement;
  private depthEl!: HTMLElement;
  private stratumEl!: HTMLElement;
  private cargoCount!: HTMLElement;
  private cargoList!: HTMLElement;
  private promptEl!: HTMLElement;
  private toastsEl!: HTMLElement;
  private flashEl!: HTMLElement;
  private whiteEl!: HTMLElement;
  private coldEl!: HTMLElement;
  private hazeEl!: HTMLElement;
  private hudEl!: HTMLElement;
  private shownMoney = 0;

  constructor(ui: HTMLElement) {
    this.root = ui;
    ui.insertAdjacentHTML('beforeend', `
      <div id="vignette" class="fx-layer"></div>
      <div id="heat-haze" class="fx-layer"></div>
      <div id="damage-flash" class="fx-layer"></div>
      <div id="cold-flash" class="fx-layer"></div>
      <div id="white-flash" class="fx-layer"></div>
      <div id="hud">
        <div id="hud-status" class="hud-corner">
          <div class="bar" id="bar-fuel"><div class="bar-fill fuel"></div><span class="bar-label">FUEL</span><span class="bar-value"></span></div>
          <div class="bar" id="bar-hull"><div class="bar-fill hull"></div><span class="bar-label">HULL</span><span class="bar-value"></span></div>
          <div id="bar-heat-wrap"><div class="bar" id="bar-heat"><div class="bar-fill heat"></div><span class="bar-label" id="heat-label">HEAT</span><span class="bar-value"></span></div></div>
          <div id="bar-o2-wrap"><div class="bar" id="bar-o2"><div class="bar-fill o2"></div><span class="bar-label">OXYGEN</span><span class="bar-value"></span></div></div>
          <div id="spill-claim"><span>◈ SPILL CLAIM</span><span class="sc-time"></span></div>
        </div>
        <div id="hud-depth-wrap" class="hud-corner">
          <div id="hud-depth">0m</div>
          <div id="hud-stratum">TOPSOIL</div>
        </div>
        <div id="hud-money-wrap" class="hud-corner">
          <div id="hud-money"></div>
          <div class="hud-sub">${CUR_NAME}</div>
        </div>
        <div id="fps"></div>
        <div id="lamp-pip"><span class="pip-dot"></span>LAMP OFF · F</div>
        <div id="kit"><span id="kit-flares"></span><span id="kit-charges"></span><span id="kit-arrestors"></span></div>
        <div id="hud-contract">
          <div class="ct-title"><span id="ct-name"></span><span id="ct-reward"></span></div>
          <div class="c-bar"><div class="c-bar-fill" id="ct-fill" style="width:0%"></div></div>
          <div class="ct-meta" id="ct-meta"></div>
        </div>
        <div id="hud-cargo" class="hud-corner">
          <div id="hud-cargo-count">0 / 10</div>
          <div class="hud-sub">CARGO</div>
          <div id="hud-cargo-list"></div>
        </div>
      </div>
      <div id="prompt"></div>
      <div id="toasts"></div>
    `);
    const $ = (s: string) => ui.querySelector(s) as HTMLElement;
    this.hudEl = $('#hud');
    this.fuelBar = $('#bar-fuel');
    this.fuelFill = $('#bar-fuel .bar-fill');
    this.fuelVal = $('#bar-fuel .bar-value');
    this.hullFill = $('#bar-hull .bar-fill');
    this.hullVal = $('#bar-hull .bar-value');
    this.heatWrap = $('#bar-heat-wrap');
    this.heatFill = $('#bar-heat .bar-fill');
    this.o2Wrap = $('#bar-o2-wrap');
    this.o2Fill = $('#bar-o2 .bar-fill');
    this.o2Val = $('#bar-o2 .bar-value');
    this.o2Bar = $('#bar-o2');
    this.heatLabel = $('#heat-label');
    this.spillEl = $('#spill-claim');
    this.spillTime = $('#spill-claim .sc-time');
    this.moneyEl = $('#hud-money');
    this.depthEl = $('#hud-depth');
    this.stratumEl = $('#hud-stratum');
    this.cargoCount = $('#hud-cargo-count');
    this.cargoList = $('#hud-cargo-list');
    this.promptEl = $('#prompt');
    this.toastsEl = $('#toasts');
    this.flashEl = $('#damage-flash');
    this.whiteEl = $('#white-flash');
    this.coldEl = $('#cold-flash');
    this.hazeEl = $('#heat-haze');
    this.contractEl = $('#hud-contract');
    this.ctName = $('#ct-name');
    this.ctReward = $('#ct-reward');
    this.ctFill = $('#ct-fill');
    this.ctMeta = $('#ct-meta');
    this.fpsEl = $('#fps');
    this.lampEl = $('#lamp-pip');
    this.kitEl = $('#kit');
    this.kitFlares = $('#kit-flares');
    this.kitCharges = $('#kit-charges');
    this.kitArrestors = $('#kit-arrestors');
    this.applyWorld();
  }

  /** live contract tracker in the corner (null hides it) */
  setContract(info: { title: string; reward: string; pct: number; meta: string; warn: boolean } | null): void {
    this.contractEl.classList.toggle('on', info !== null);
    if (!info) return;
    if (this.ctName.textContent !== info.title) {
      this.ctName.textContent = info.title;
      this.ctReward.textContent = info.reward;
    }
    this.ctFill.style.width = info.pct + '%';
    this.ctMeta.textContent = info.meta;
    this.ctMeta.classList.toggle('c-warn', info.warn);
  }

  /** lift the contract tracker clear of the dispatch strip */
  pushContract(on: boolean): void {
    this.contractEl.classList.toggle('pushed', on);
  }

  setConsumables(flares: number, charges: number, arrestors = 0): void {
    this.kitEl.classList.toggle('on', flares > 0 || charges > 0 || arrestors > 0);
    this.kitFlares.textContent = flares > 0 ? `✦ FLARE ×${flares} · ${glyph('Q')}` : '';
    this.kitCharges.textContent = charges > 0 ? `◈ CHARGE ×${charges} · ${glyph('G')}` : '';
    this.kitArrestors.textContent = arrestors > 0 ? `▬ ARRESTOR ×${arrestors} · ${glyph('B')}` : '';
  }

  setLamp(on: boolean): void {
    this.lampEl.classList.toggle('on', !on);
    this.lampEl.innerHTML = `<span class="pip-dot"></span>LAMP OFF · ${glyph('F')}`;
  }

  setFps(v: number | null): void {
    this.fpsEl.classList.toggle('on', v !== null);
    if (v !== null) this.fpsEl.textContent = v + ' FPS';
  }

  show(): void { this.hudEl.classList.add('visible'); }
  hide(): void { this.hudEl.classList.remove('visible'); }

  /** re-sync per-world gauge fiction (called again after in-place travel) */
  applyWorld(): void {
    this.heatLabel.textContent = ACTIVE.hazard.label;
    this.heatFill.classList.toggle('cold', ACTIVE.hazard.cold);
    this.hazeEl.classList.toggle('cold', ACTIVE.hazard.cold);
  }

  update(st: GameState, depthM: number, row: number, heatFrac: number, dt: number): void {
    const fuelFrac = st.fuel / st.maxFuel;
    this.fuelFill.style.transform = `scaleX(${fuelFrac})`;
    this.fuelVal.textContent = Math.ceil(st.fuel).toString();
    this.fuelBar.classList.toggle('low', fuelFrac < LOW_FUEL_FRAC);

    this.hullFill.style.transform = `scaleX(${st.hull / st.maxHull})`;
    this.hullVal.textContent = Math.ceil(st.hull).toString();

    this.heatWrap.classList.toggle('on', heatFrac > 0.01);
    this.heatFill.style.transform = `scaleX(${Math.min(1, heatFrac)})`;
    this.hazeEl.style.opacity = (heatFrac * 0.9).toFixed(2);

    // money ticks toward the real value
    const target = st.money;
    if (Math.abs(this.shownMoney - target) > 0.5) {
      this.shownMoney += (target - this.shownMoney) * Math.min(1, dt * 8);
      if (Math.abs(this.shownMoney - target) < 1) this.shownMoney = target;
    } else this.shownMoney = target;
    this.moneyEl.textContent = fmtMoney(this.shownMoney);

    this.depthEl.textContent = depthM + 'm';
    this.stratumEl.textContent = ACTIVE.strata[stratumIndex(Math.max(0, row))];

    // a fragment in the hold IS the hold
    if (st.carrying) {
      this.cargoCount.textContent = '◆ FRAGMENT';
      this.cargoCount.classList.add('full');
      const name = worldById(st.carrying)?.coreName ?? 'THE FRAGMENT';
      const row = `<div class="c-row"><b>${name}</b></div>`;
      if (this.cargoList.innerHTML !== row) this.cargoList.innerHTML = row;
      return;
    }
    const cap = st.cargoCap, n = st.cargoCount;
    this.cargoCount.textContent = `${n} / ${cap}`;
    this.cargoCount.classList.toggle('full', n >= cap);
    // itemized list, most valuable first
    const rows = [...st.cargo.entries()]
      .sort((a, b) => def(b[0]).value - def(a[0]).value)
      .slice(0, 6)
      .map(([t, c]) => `<div class="c-row"><img class="c-ico" src="${oreIcon(t)}" alt="" /><b>${def(t).name}</b> × ${c}</div>`)
      .join('');
    if (this.cargoList.innerHTML !== rows) this.cargoList.innerHTML = rows;
  }

  /**
   * The claim clock for a spilled hold (null hides it). `where` is whatever
   * helps you get back to it — range while you are on that world, a name
   * while you are not.
   */
  setSpill(sec: number | null, where = ''): void {
    this.spillEl.classList.toggle('on', sec !== null);
    if (sec === null) return;
    const s = Math.max(0, Math.ceil(sec));
    const clock = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.spillTime.textContent = where ? `${clock} · ${where}` : clock;
    this.spillEl.classList.toggle('failing', sec <= SPILL_WARN);
  }

  /** show/update the oxygen bar during EVA (null hides it) */
  setEva(o2: number | null): void {
    this.o2Wrap.classList.toggle('on', o2 !== null);
    if (o2 !== null) {
      this.o2Fill.style.transform = `scaleX(${Math.max(0, o2 / EVA_O2)})`;
      this.o2Val.textContent = Math.ceil(o2).toString();
      this.o2Bar.classList.toggle('low', o2 < EVA_O2 * 0.25);
    }
  }

  setPrompt(html: string | null): void {
    if (html) {
      this.promptEl.innerHTML = glyphs(html);
      this.promptEl.classList.add('visible');
    } else {
      this.promptEl.classList.remove('visible');
    }
  }

  toast(msg: string, cls = ''): void {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.textContent = msg;
    this.toastsEl.appendChild(el);
    setTimeout(() => el.classList.add('leaving'), 2600);
    setTimeout(() => el.remove(), 3100);
  }

  /** drop every toast still on screen (a dev stage change carries no story) */
  clearToasts(): void {
    this.toastsEl.replaceChildren();
  }

  popup(text: string, color: string, sx: number, sy: number): void {
    const el = document.createElement('div');
    el.className = 'popup';
    el.style.color = color;
    el.style.left = sx + 'px';
    el.style.top = sy + 'px';
    el.textContent = text;
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 1150);
  }

  damageFlash(): void {
    this.flashEl.classList.add('hit');
    requestAnimationFrame(() => requestAnimationFrame(() => this.flashEl.classList.remove('hit')));
  }

  /** the screen goes white and comes back: light used against you */
  overexpose(strength = 1): void {
    this.whiteEl.classList.add('hit');
    this.whiteEl.style.opacity = String(Math.min(1, strength));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.whiteEl.classList.remove('hit');
      this.whiteEl.style.opacity = '0';
    }));
  }

  /** a frostbloom went off: the edges ice over for a moment */
  coldFlash(): void {
    this.coldEl.classList.add('hit');
    requestAnimationFrame(() => requestAnimationFrame(() => this.coldEl.classList.remove('hit')));
  }
}
