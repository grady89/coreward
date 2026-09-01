import { GameState } from '../game/state';
import { AudioEngine } from '../audio/audio';
import {
  FUEL_PRICE, REPAIR_PRICE, TRACKS, GAME_NAME, FORGE, WRECK_LOGS,
  DEATH_FEE_FRAC, RESCUE_FEE_FRAC, RESCUE_MIN_MONEY, fmtMoney, SCANNER_PRICE,
  DEEP_ARRAY_PRICE, BEACON_PRICE, CUR, FLARE_PRICE, CHARGE_PRICE,
  MAX_FLARES_HELD, MAX_CHARGES_HELD,
  GLYPHS_TO_TRANSLATE, ARRESTOR_PRICE, MAX_ARRESTORS,
} from '../config';
import { T, def, oreValue } from '../world/tiles';
import { ACTIVE, WORLDS, nextWorld } from '../world/worlds';
import { oreIcon, oreGlow } from './icons';
import { Settings } from '../game/settings';
import {
  Contract, offers, evaluate, timeLeft, fuelLeft, accept as acceptContract,
} from '../game/contracts';

/** one-line statement of a contract's terms, priced against this pod */
function describe(c: Contract, maxFuel: number): string {
  const scale = c.fuelCapFrac !== undefined ? maxFuel / 100 : 1;
  const target = Math.round(c.target * scale);
  const bits: string[] = [];
  if (c.kind === 'depth' || c.kind === 'speed') bits.push(`reach ${target}m`);
  if (c.kind === 'haul' || c.kind === 'frugal') bits.push(`earn ${CUR}${target.toLocaleString()}`);
  if (c.kind === 'ore') bits.push(`mine ${target} ${def(c.oreType!).name}`);
  if (c.limitSec) bits.push(`in ${c.limitSec}s`);
  if (c.fuelCapFrac) bits.push(`on ${Math.round(maxFuel * c.fuelCapFrac)} fuel`);
  return bits.join(' · ');
}

export type PanelKind = 'fuel' | 'trade' | 'garage' | 'assay' | 'pause' | 'death' | 'rescue' | 'ending' | 'settings' | 'contracts';

interface PanelCtx {
  state: GameState;
  audio: AudioEngine;
  settings: Settings;
  saveNow(): void;
  toast(msg: string, cls?: string): void;
  onRespawn(): void;
  onRescued(): void;
  onQuitToTitle(): void;
  onTravel(worldId: string): void;
  onSettingsChanged(): void;
}

const fmt = fmtMoney;

export class Panels {
  current: PanelKind | null = null;
  private scrim: HTMLElement | null = null;
  private deathCause = '';
  private deathFee = 0;
  private lostCargo = 0;

  constructor(private ui: HTMLElement, private ctx: PanelCtx) {}

  get isOpen(): boolean { return this.current !== null; }

  close(): void {
    this.scrim?.remove();
    this.scrim = null;
    this.current = null;
  }

  open(kind: PanelKind, opts?: { cause?: string }): void {
    this.close();
    this.current = kind;
    if (kind === 'death' && opts?.cause) this.prepareDeath(opts.cause);
    this.scrim = document.createElement('div');
    this.scrim.className = 'panel-scrim';
    this.scrim.innerHTML = `<div class="panel" id="panel-body"></div>`;
    this.ui.appendChild(this.scrim);
    // click outside closes shop panels (not fate panels)
    if (kind === 'fuel' || kind === 'trade' || kind === 'garage' || kind === 'assay' ||
      kind === 'pause' || kind === 'settings' || kind === 'contracts') {
      this.scrim.addEventListener('pointerdown', e => {
        if (e.target === this.scrim) { this.ctx.audio.click(); this.close(); }
      });
    }
    this.render();
  }

  private body(): HTMLElement {
    return this.scrim!.querySelector('#panel-body') as HTMLElement;
  }

  private render(): void {
    switch (this.current) {
      case 'fuel': this.renderFuel(); break;
      case 'trade': this.renderTrade(); break;
      case 'garage': this.renderGarage(); break;
      case 'assay': this.renderAssay(); break;
      case 'pause': this.renderPause(); break;
      case 'death': this.renderDeath(); break;
      case 'rescue': this.renderRescue(); break;
      case 'ending': this.renderEnding(); break;
      case 'settings': this.renderSettings(); break;
      case 'contracts': this.renderContracts(); break;
    }
  }

  private header(title: string): string {
    return `<h2><span>${title}<span class="accent"> ▮</span></span><span class="panel-money">${fmt(this.ctx.state.money)}</span></h2>`;
  }

  // ---------- FUEL ----------
  private renderFuel(): void {
    const st = this.ctx.state;
    const space = st.maxFuel - st.fuel;
    const quarter = Math.min(space, st.maxFuel * 0.25);
    const costQ = quarter * FUEL_PRICE;
    const costFull = space * FUEL_PRICE;
    this.body().innerHTML = `
      ${this.header('FUEL DEPOT')}
      <div class="row"><span class="r-name">Tank</span><span class="r-val">${Math.ceil(st.fuel)} / ${st.maxFuel}</span></div>
      <div class="row"><span class="r-name">Price</span><span class="r-val">${fmt(FUEL_PRICE)} / unit</span></div>
      <div class="btn-row">
        <button class="btn" id="buy-q" ${quarter < 1 || st.money < 1 ? 'disabled' : ''}>+25% · ${fmt(Math.min(costQ, st.money))}</button>
        <button class="btn primary" id="buy-f" ${space < 1 || st.money < 1 ? 'disabled' : ''}>FILL · ${fmt(Math.min(costFull, st.money))}</button>
      </div>
      <div class="forge-head">KIT</div>
      <div class="row">
        <span><span class="r-name">FLARES</span><div class="r-sub">Q — thrown light. Something else to look at.</div></span>
        <span class="r-right">
          <span class="r-val">×${st.flares}</span>
          <button class="btn" id="buy-flare" ${st.money < FLARE_PRICE || st.flares >= MAX_FLARES_HELD ? 'disabled' : ''}>${fmt(FLARE_PRICE)}</button>
        </span>
      </div>
      <div class="row">
        <span><span class="r-name">SEISMIC CHARGES</span><div class="r-sub">G — seals a tunnel with rubble. Mind the blast.</div></span>
        <span class="r-right">
          <span class="r-val">×${st.charges}</span>
          <button class="btn" id="buy-charge" ${st.money < CHARGE_PRICE || st.charges >= MAX_CHARGES_HELD ? 'disabled' : ''}>${fmt(CHARGE_PRICE)}</button>
        </span>
      </div>
      <div class="hint">Press E or Esc to leave</div>
    `;
    this.body().querySelector('#buy-q')?.addEventListener('click', () => this.buyFuel(quarter));
    this.body().querySelector('#buy-f')?.addEventListener('click', () => this.buyFuel(space));
    this.body().querySelector('#buy-flare')?.addEventListener('click', () => {
      if (st.money < FLARE_PRICE || st.flares >= MAX_FLARES_HELD) { this.ctx.audio.denied(); return; }
      st.money -= FLARE_PRICE; st.flares++;
      this.ctx.audio.buy(); this.ctx.saveNow(); this.renderFuel();
    });
    this.body().querySelector('#buy-charge')?.addEventListener('click', () => {
      if (st.money < CHARGE_PRICE || st.charges >= MAX_CHARGES_HELD) { this.ctx.audio.denied(); return; }
      st.money -= CHARGE_PRICE; st.charges++;
      this.ctx.audio.buy(); this.ctx.saveNow(); this.renderFuel();
    });
  }

  private buyFuel(units: number): void {
    const st = this.ctx.state;
    const affordable = Math.min(units, st.money / FUEL_PRICE);
    if (affordable < 1) { this.ctx.audio.denied(); return; }
    st.money -= affordable * FUEL_PRICE;
    st.fuel = Math.min(st.maxFuel, st.fuel + affordable);
    this.ctx.audio.buy();
    this.ctx.saveNow();
    this.renderFuel();
  }

  // ---------- TRADE ----------
  private renderTrade(): void {
    const st = this.ctx.state;
    const entries = [...st.cargo.entries()].sort((a, b) => oreValue(b[0]) - oreValue(a[0]));
    const rows = entries.length
      ? entries.map(([t, c], i) => `
        <div class="row">
          <span class="r-left">
            <img class="ore-icon" src="${oreIcon(t)}" alt="" style="--glow:${oreGlow(t)}; animation-delay:${-(i * 0.7)}s" />
            <span><span class="r-name">${def(t).name}</span><div class="r-sub">${fmt(oreValue(t))} each${t === T.EMBERSHARD ? ' · ◆ feeds the EMBER FORGE' : ''}</div></span>
          </span>
          <span class="r-right">
            <span class="r-val">× ${c} · ${fmt(oreValue(t) * c)}</span>
            <button class="btn sell-one" data-sell="${t}">SELL</button>
          </span>
        </div>`).join('')
      : `<div class="row"><span class="r-sub">Your hold is empty. The crust is not.</span></div>`;
    this.body().innerHTML = `
      ${this.header('TRADE POST')}
      ${rows}
      <div class="sell-total"><span>TOTAL</span><b>${fmt(st.cargoValue)}</b></div>
      <button class="btn primary wide" id="sell" ${st.cargoCount === 0 ? 'disabled' : ''}>SELL ALL</button>
      <button class="btn wide" id="to-contracts">CONTRACT BOARD${st.contract ? ' · 1 ACTIVE' : ''}</button>
      <div class="hint">Press E or Esc to leave</div>
    `;
    this.body().querySelector('#to-contracts')?.addEventListener('click', () => {
      this.ctx.audio.click();
      this.open('contracts');
    });
    this.body().querySelectorAll('button[data-sell]').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = Number((btn as HTMLElement).dataset.sell);
        const total = st.sellStack(t);
        this.ctx.audio.sell(2);
        this.ctx.toast(`SOLD FOR ${fmt(total)}`, 'stratum');
        this.ctx.saveNow();
        this.renderTrade();
      });
    });
    this.body().querySelector('#sell')?.addEventListener('click', () => {
      const kinds = st.cargo.size;
      const total = st.sellAll();
      this.ctx.audio.sell(kinds + 2);
      this.ctx.toast(`SOLD FOR ${fmt(total)}`, 'stratum');
      this.ctx.saveNow();
      this.renderTrade();
    });
  }

  // ---------- GARAGE ----------
  private renderGarage(): void {
    const st = this.ctx.state;
    const missing = st.maxHull - st.hull;
    const repairCost = Math.ceil(missing * REPAIR_PRICE);
    const upgradeRows = TRACKS.map(tr => {
      const tier = st.upgrades[tr.key];
      const cur = tr.tiers[tier];
      const next = tr.tiers[tier + 1];
      const maxed = !next;
      return `
        <div class="row">
          <span>
            <span class="r-name">${tr.name}</span>
            <div class="r-sub">${maxed ? cur.label + ' — maxed' : cur.label + ' → ' + next.label + ' (' + next.v + tr.unit + ')'}</div>
          </span>
          ${maxed
            ? `<span class="r-val">MAX</span>`
            : `<button class="btn" data-track="${tr.key}" ${st.money < next.price ? 'disabled' : ''}>${fmt(next.price)}</button>`}
        </div>`;
    }).join('');
    // Ember Forge: lit after the first core is touched; paid in embershards
    const shards = st.cargo.get(T.EMBERSHARD) ?? 0;
    const forgeRows = st.forgeUnlocked ? `
      <div class="forge-head">EMBER FORGE<span class="forge-shards">◆ ${shards} embershard${shards === 1 ? '' : 's'} aboard</span></div>
      ${FORGE.map(f => `
        <div class="row">
          <span><span class="r-name">${f.name}</span><div class="r-sub">${f.desc}</div></span>
          ${st.emberTech[f.key]
            ? '<span class="r-val">INSTALLED</span>'
            : `<button class="btn forge-btn" data-forge="${f.key}" ${shards < f.cost ? 'disabled' : ''}>◆ ${f.cost}</button>`}
        </div>`).join('')}` : '';
    this.body().innerHTML = `
      ${this.header('GARAGE')}
      <div class="row">
        <span><span class="r-name">HULL REPAIR</span><div class="r-sub">${Math.ceil(st.hull)} / ${st.maxHull} HP</div></span>
        <button class="btn" id="repair" ${missing < 1 || st.money < 1 ? 'disabled' : ''}>${missing < 1 ? 'INTACT' : fmt(Math.min(repairCost, st.money))}</button>
      </div>
      ${upgradeRows}
      <div class="row">
        <span><span class="r-name">ARRESTORS</span><div class="r-sub">B — deploy a landing pad in your own shaft. Drop at full speed, land clean. Recoverable.</div></span>
        <span class="r-right">
          <span class="r-val">×${st.arrestors}</span>
          <button class="btn" id="buy-arrestor" ${st.money < ARRESTOR_PRICE || st.arrestors >= MAX_ARRESTORS ? 'disabled' : ''}>${fmt(ARRESTOR_PRICE)}</button>
        </span>
      </div>
      ${forgeRows}
      <div class="hint">Press E or Esc to leave</div>
    `;
    this.body().querySelector('#buy-arrestor')?.addEventListener('click', () => {
      if (st.money < ARRESTOR_PRICE || st.arrestors >= MAX_ARRESTORS) { this.ctx.audio.denied(); return; }
      st.money -= ARRESTOR_PRICE;
      st.arrestors++;
      this.ctx.audio.buy();
      this.ctx.saveNow();
      this.renderGarage();
    });
    this.body().querySelectorAll('button[data-forge]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = (btn as HTMLElement).dataset.forge as keyof typeof st.emberTech;
        const item = FORGE.find(f => f.key === key)!;
        if (st.emberTech[key] || !st.spendShards(item.cost, T.EMBERSHARD)) {
          this.ctx.audio.denied();
          return;
        }
        st.emberTech[key] = true;
        this.ctx.audio.buy();
        this.ctx.toast(`${item.name} INSTALLED`, 'stratum');
        this.ctx.saveNow();
        this.renderGarage();
      });
    });
    this.body().querySelector('#repair')?.addEventListener('click', () => {
      const afford = Math.min(missing, st.money / REPAIR_PRICE);
      if (afford < 1) { this.ctx.audio.denied(); return; }
      st.money -= afford * REPAIR_PRICE;
      st.hull = Math.min(st.maxHull, st.hull + afford);
      this.ctx.audio.buy();
      this.ctx.saveNow();
      this.renderGarage();
    });
    this.body().querySelectorAll('button[data-track]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = (btn as HTMLElement).dataset.track as keyof typeof st.upgrades;
        const tr = TRACKS.find(t => t.key === key)!;
        const next = tr.tiers[st.upgrades[key] + 1];
        if (!next || st.money < next.price) { this.ctx.audio.denied(); return; }
        st.money -= next.price;
        st.upgrades[key]++;
        // hull/tank upgrades top you up to the new max delta
        if (key === 'hull') st.hull = Math.min(st.maxHull, st.hull + (next.v - tr.tiers[st.upgrades[key] - 1].v));
        this.ctx.audio.buy();
        this.ctx.toast(`${tr.name}: ${next.label}`, 'stratum');
        this.ctx.saveNow();
        this.renderGarage();
      });
    });
  }

  // ---------- ASSAY ----------
  private renderAssay(): void {
    const st = this.ctx.state;

    // starmap: dig sites, unlock chain, travel
    const starmap = WORLDS.map(w => {
      const unlocked = w.unlockAfter === null || st.endedWorlds.has(w.unlockAfter);
      const current = w.id === st.activeWorld;
      const done = st.endedWorlds.has(w.id);
      let action: string;
      if (current) action = '<span class="r-val">YOU ARE HERE</span>';
      else if (unlocked) action = `<button class="btn" data-travel="${w.id}">TRAVEL</button>`;
      else action = '<span class="r-val" style="color:var(--ink-dim)">NO SIGNAL</span>';
      return `
        <div class="row">
          <span>
            <span class="r-name">${unlocked ? w.name : '█████-█'}</span>
            <div class="r-sub">${unlocked ? (done ? w.coreName + ' — reached · ore ×' + w.valueMul : 'ore ×' + w.valueMul) : 'the dish is still listening'}</div>
          </span>
          ${action}
        </div>`;
    }).join('');

    // this world's assay logs, unlocked by descent
    const notes = ACTIVE.lore.map((text, i) => {
      const unlocked = st.milestones.has(`${ACTIVE.id}:${i + 1}`);
      const title = `ASSAY LOG 0${i + 1} — ${ACTIVE.strata[i + 1]}`;
      return `<div class="lore-note ${unlocked ? '' : 'locked'}">
        <h4>${unlocked ? title : '???'}</h4>
        <p>${unlocked ? text : '· · · DESCEND FURTHER · · ·'}</p>
      </div>`;
    }).join('');

    // logs salvaged from wrecks (shared pool)
    const found = [...st.foundLogs].sort((a, b) => a - b).map(i => `
      <div class="lore-note">
        <h4>${WRECK_LOGS[i].title}</h4>
        <p>${WRECK_LOGS[i].text}</p>
      </div>`).join('');

    this.body().innerHTML = `
      ${this.header('ASSAY OFFICE')}
      <div class="stat-grid">
        <div class="row"><span class="r-name">Record depth</span><span class="r-val">${st.bestDepthM}m</span></div>
        <div class="row"><span class="r-name">Lifetime earnings</span><span class="r-val">${fmt(st.totalEarned)}</span></div>
        <div class="row"><span class="r-name">Blocks cut</span><span class="r-val">${st.blocksDug.toLocaleString()}</span></div>
        <div class="row"><span class="r-name">Hold value</span><span class="r-val">${fmt(st.cargoValue)}</span></div>
      </div>
      <div class="forge-head">SURVEY — ${ACTIVE.name}<span class="forge-shards">fitted per dig site</span></div>
      <div class="row">
        <span><span class="r-name">SURVEY SCANNER</span><div class="r-sub">${st.hasScanner ? 'Installed — TAB toggles the map · + / − to zoom' : 'A live map of every tunnel you cut · toggled with TAB'}</div></span>
        ${st.hasScanner
          ? '<span class="r-val">INSTALLED</span>'
          : `<button class="btn" id="buy-scanner" ${st.money < SCANNER_PRICE ? 'disabled' : ''}>${fmt(SCANNER_PRICE)}</button>`}
      </div>
      ${st.hasScanner ? `
      <div class="row">
        <span><span class="r-name">DEEP ARRAY</span><div class="r-sub">${st.hasDeepArray ? 'Installed — the map reads ore, not just voids' : 'Scanner upgrade: paints every ore deposit on the map'}</div></span>
        ${st.hasDeepArray
          ? '<span class="r-val">INSTALLED</span>'
          : `<button class="btn" id="buy-array" ${st.money < DEEP_ARRAY_PRICE ? 'disabled' : ''}>${fmt(DEEP_ARRAY_PRICE)}</button>`}
      </div>
      <div class="row">
        <span><span class="r-name">SALVAGE BEACONS</span><div class="r-sub">${st.hasBeacons ? 'Installed — registered wrecks marked on the map' : 'Tunes the scanner to distress registries. Somebody should read what they left.'}</div></span>
        ${st.hasBeacons
          ? '<span class="r-val">INSTALLED</span>'
          : `<button class="btn" id="buy-beacons" ${st.money < BEACON_PRICE ? 'disabled' : ''}>${fmt(BEACON_PRICE)}</button>`}
      </div>` : ''}
      <div class="forge-head">STARMAP</div>
      ${starmap}
      ${st.glyphs > 0 ? `
      <div class="forge-head">CODEX<span class="forge-shards">${st.glyphs} / ${GLYPHS_TO_TRANSLATE} carved stones</span></div>
      <div class="lore-note ${st.glyphs >= GLYPHS_TO_TRANSLATE ? '' : 'locked'}">
        <h4>${st.glyphs >= GLYPHS_TO_TRANSLATE ? 'THE LAMPLIGHTERS' : 'UNTRANSLATED'}</h4>
        <p>${st.glyphs >= GLYPHS_TO_TRANSLATE
          ? 'We were not thieves. We were the last shift, and the light was going out, and we did the only thing anyone could think of: we put it somewhere it would keep. Under a world, where weather could not reach it. We are sorry for the dark we left you standing in. It was meant to be temporary. Everything is meant to be temporary. If you have read this far, then you can put it back — and we are sorry, again, for what that will cost you.'
          : 'The marks repeat but the sense will not come. More stones. There must be more stones.'}</p>
      </div>` : ''}
      <div class="forge-head">ASSAY LOGS — ${ACTIVE.name}</div>
      ${notes}
      ${found ? `<div class="forge-head">FOUND LOGS</div>${found}` : ''}
      <div class="hint">Press E or Esc to leave</div>
    `;
    this.body().querySelector('#buy-beacons')?.addEventListener('click', () => {
      if (st.money < BEACON_PRICE) { this.ctx.audio.denied(); return; }
      st.money -= BEACON_PRICE;
      st.buyGear('beacons');
      this.ctx.audio.buy();
      this.ctx.toast('SALVAGE BEACONS TUNED', 'stratum');
      this.ctx.saveNow();
      this.renderAssay();
    });
    this.body().querySelector('#buy-scanner')?.addEventListener('click', () => {
      if (st.money < SCANNER_PRICE) { this.ctx.audio.denied(); return; }
      st.money -= SCANNER_PRICE;
      st.buyGear('scanner');
      this.ctx.audio.buy();
      this.ctx.toast('SURVEY SCANNER ONLINE — TAB', 'stratum');
      this.ctx.saveNow();
      this.renderAssay();
    });
    this.body().querySelector('#buy-array')?.addEventListener('click', () => {
      if (st.money < DEEP_ARRAY_PRICE) { this.ctx.audio.denied(); return; }
      st.money -= DEEP_ARRAY_PRICE;
      st.buyGear('array');
      this.ctx.audio.buy();
      this.ctx.toast('DEEP ARRAY ONLINE — ORE VISIBLE ON SURVEY', 'stratum');
      this.ctx.saveNow();
      this.renderAssay();
    });
    this.body().querySelectorAll('button[data-travel]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.ctx.audio.buy();
        this.ctx.onTravel((btn as HTMLElement).dataset.travel!);
      });
    });
  }

  // ---------- PAUSE ----------
  private renderPause(): void {
    this.body().innerHTML = `
      <div class="screen-title good">PAUSED</div>
      <div class="screen-sub">
        ← → steer · ↑ / SPACE thrust · ↓ drill down<br/>
        hold ← / → against a wall to drill sideways<br/>
        E dock / EVA · TAB survey map · R recall (EVA) · M mute · ESC pause<br/>
        <span style="color:var(--amber)">forge tech:</span> SHIFT dash · hold ↑ at a ceiling to drill up · C warp-sell
      </div>
      <button class="btn primary wide" id="resume">RESUME</button>
      <button class="btn wide" id="to-settings">SETTINGS</button>
      <button class="btn wide" id="quit">QUIT TO TITLE</button>
      <div class="hint">Progress saves automatically at the surface</div>
    `;
    this.body().querySelector('#resume')?.addEventListener('click', () => { this.ctx.audio.click(); this.close(); });
    this.body().querySelector('#to-settings')?.addEventListener('click', () => { this.ctx.audio.click(); this.open('settings'); });
    this.body().querySelector('#quit')?.addEventListener('click', () => {
      this.ctx.saveNow();
      this.close();
      this.ctx.onQuitToTitle();
    });
  }

  // ---------- DEATH ----------
  private prepareDeath(cause: string): void {
    const st = this.ctx.state;
    this.deathCause = cause;
    this.deathFee = Math.round(st.money * DEATH_FEE_FRAC);
    this.lostCargo = st.cargoValue;
    st.money -= this.deathFee;
    st.cargo.clear();
  }

  private renderDeath(): void {
    this.body().innerHTML = `
      <div class="screen-title bad">POD DESTROYED</div>
      <div class="screen-sub">
        Lost to ${this.deathCause}.<br/>
        Cargo lost: <b style="color:var(--magma)">${fmt(this.lostCargo)}</b> ·
        Salvage fee: <b style="color:var(--magma)">${fmt(this.deathFee)}</b><br/>
        A recovery crew hauled the wreck back to the rig.
      </div>
      <button class="btn primary wide" id="respawn">BACK TO THE SURFACE</button>
    `;
    this.body().querySelector('#respawn')?.addEventListener('click', () => {
      this.ctx.audio.click();
      this.close();
      this.ctx.onRespawn();
    });
  }

  // ---------- RESCUE ----------
  private renderRescue(): void {
    const st = this.ctx.state;
    const free = st.money < RESCUE_MIN_MONEY;
    const fee = free ? 0 : Math.round(st.money * RESCUE_FEE_FRAC);
    this.body().innerHTML = `
      <div class="screen-title bad">OUT OF FUEL</div>
      <div class="screen-sub">
        The pod is dark. Thrusters cold.<br/>
        ${free ? 'The rig crew will tow you up — this one is on the house.' : `A recovery tow costs <b style="color:var(--amber)">${fmt(fee)}</b>. Cargo stays aboard.`}
      </div>
      <button class="btn primary wide" id="rescue">${free ? 'ACCEPT THE TOW' : 'PAY ' + fmt(fee) + ' — TOW ME UP'}</button>
      <button class="btn wide" id="stay">SIT IN THE DARK</button>
    `;
    this.body().querySelector('#rescue')?.addEventListener('click', () => {
      st.money -= fee;
      st.fuel = st.maxFuel * 0.35;
      this.ctx.audio.buy();
      this.close();
      this.ctx.onRescued();
    });
    this.body().querySelector('#stay')?.addEventListener('click', () => { this.ctx.audio.click(); this.close(); });
  }

  // ---------- CONTRACTS ----------
  private renderContracts(): void {
    const st = this.ctx.state;

    if (st.contract) {
      const p = evaluate(st.contract, {
        bestDepthM: st.bestDepthM, totalEarned: st.totalEarned,
        fuelSpent: st.fuelSpent, contractOre: st.contractOre, now: st.playTime,
      });
      const tl = timeLeft(st.contract, st.playTime);
      const fl = fuelLeft(st.contract, st.fuelSpent);
      const done = p.met && !p.failed;
      const pct = Math.min(100, Math.round((p.have / p.need) * 100));
      this.body().innerHTML = `
        ${this.header('CONTRACT BOARD')}
        <div class="contract active">
          <div class="c-title">${st.contract.c.title}<span class="c-reward">${fmt(st.contract.c.reward)}</span></div>
          <div class="c-flavor">${st.contract.c.flavor}</div>
          <div class="c-bar"><div class="c-bar-fill" style="width:${pct}%"></div></div>
          <div class="c-meta">
            <span>${p.label}: <b>${p.have.toLocaleString()}</b> / ${p.need.toLocaleString()}</span>
            ${tl !== null ? `<span class="${tl < 30 ? 'c-warn' : ''}">TIME ${Math.ceil(tl)}s</span>` : ''}
            ${fl !== null ? `<span class="${fl < 15 ? 'c-warn' : ''}">FUEL ${Math.ceil(fl)}</span>` : ''}
          </div>
        </div>
        ${p.failed
          ? '<div class="screen-sub" style="color:var(--magma);margin-top:12px">TERMS BROKEN — this contract has lapsed.</div>'
          : done
            ? '<div class="screen-sub" style="color:var(--teal);margin-top:12px">TERMS MET — collect your payment.</div>'
            : ''}
        ${done && !p.failed
          ? '<button class="btn primary wide" id="c-claim">CLAIM ' + fmt(st.contract.c.reward) + '</button>'
          : '<button class="btn wide danger" id="c-abandon">' + (p.failed ? 'CLEAR LAPSED CONTRACT' : 'ABANDON CONTRACT') + '</button>'}
        <div class="hint">Press E or Esc to leave</div>
      `;
      this.body().querySelector('#c-claim')?.addEventListener('click', () => {
        st.money += st.contract!.c.reward;
        st.totalEarned += st.contract!.c.reward;
        st.contractsDone++;
        st.contract = null;
        st.contractOre = 0;
        st.contractDay++;
        this.ctx.audio.sell(6);
        this.ctx.toast('CONTRACT COMPLETE', 'stratum');
        this.ctx.saveNow();
        this.renderContracts();
      });
      this.body().querySelector('#c-abandon')?.addEventListener('click', () => {
        st.contract = null;
        st.contractOre = 0;
        this.ctx.audio.denied();
        this.ctx.saveNow();
        this.renderContracts();
      });
      return;
    }

    const list = offers(st.bestDepthM, st.activeWorld, st.contractDay);
    this.body().innerHTML = `
      ${this.header('CONTRACT BOARD')}
      <div class="c-sub">${st.contractsDone} completed · one active at a time</div>
      ${list.map((c, i) => `
        <div class="contract">
          <div class="c-title">${c.title}<span class="c-reward">${fmt(c.reward)}</span></div>
          <div class="c-flavor">${c.flavor}</div>
          <div class="c-meta">
            <span>${describe(c, st.maxFuel)}</span>
            <button class="btn" data-accept="${i}">ACCEPT</button>
          </div>
        </div>`).join('')}
      <div class="hint">Press E or Esc to leave</div>
    `;
    this.body().querySelectorAll('button[data-accept]').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = list[Number((btn as HTMLElement).dataset.accept)];
        st.contract = acceptContract(c, {
          maxFuel: st.maxFuel,
          bestDepthM: st.bestDepthM,
          totalEarned: st.totalEarned,
          fuelSpent: st.fuelSpent,
          playTime: st.playTime,
        });
        st.contractOre = 0;
        this.ctx.audio.buy();
        this.ctx.toast(`CONTRACT ACCEPTED — ${c.title}`, 'stratum');
        this.ctx.saveNow();
        this.renderContracts();
      });
    });
  }

  // ---------- SETTINGS ----------
  private renderSettings(): void {
    const s = this.ctx.settings;
    const slider = (key: 'master' | 'sfx' | 'music', label: string) => `
      <div class="row">
        <span class="r-name">${label}</span>
        <span class="r-right">
          <input type="range" min="0" max="100" value="${Math.round(s[key] * 100)}" data-vol="${key}" />
          <span class="r-val" id="v-${key}">${Math.round(s[key] * 100)}</span>
        </span>
      </div>`;
    const toggle = (key: 'shake' | 'hitstop' | 'showFps', label: string, sub: string) => `
      <div class="row">
        <span><span class="r-name">${label}</span><div class="r-sub">${sub}</div></span>
        <button class="btn" data-toggle="${key}">${s[key] ? 'ON' : 'OFF'}</button>
      </div>`;
    this.body().innerHTML = `
      <h2><span>SETTINGS<span class="accent"> ▮</span></span></h2>
      <div class="forge-head">AUDIO</div>
      ${slider('master', 'Master volume')}
      ${slider('sfx', 'Effects')}
      ${slider('music', 'Ambience')}
      <div class="forge-head">MOTION</div>
      ${toggle('shake', 'Screen shake', 'Camera kick on impacts and drilling')}
      ${toggle('hitstop', 'Impact freeze', 'Momentary pause when ore breaks')}
      <div class="forge-head">THREATS</div>
      <div class="row">
        <span><span class="r-name">Creatures</span><div class="r-sub">${
          s.threats === 'off' ? 'The deep is empty. Hazards only.'
          : s.threats === 'reduced' ? 'Fewer, and gentler.'
          : 'Something lives down there.'}</div></span>
        <button class="btn" id="s-threats">${s.threats.toUpperCase()}</button>
      </div>
      <div class="forge-head">DISPLAY</div>
      ${toggle('showFps', 'Performance counter', 'Show frames per second')}
      <button class="btn wide" id="s-close">BACK</button>
    `;
    this.body().querySelector('#s-threats')?.addEventListener('click', () => {
      const order: Settings['threats'][] = ['full', 'reduced', 'off'];
      s.threats = order[(order.indexOf(s.threats) + 1) % order.length];
      this.ctx.audio.click();
      this.ctx.onSettingsChanged();
      this.renderSettings();
    });
    this.body().querySelectorAll('input[data-vol]').forEach(el => {
      const input = el as HTMLInputElement;
      const key = input.dataset.vol as 'master' | 'sfx' | 'music';
      input.addEventListener('input', () => {
        s[key] = Number(input.value) / 100;
        (this.body().querySelector('#v-' + key) as HTMLElement).textContent = input.value;
        this.ctx.onSettingsChanged();
      });
      input.addEventListener('change', () => this.ctx.audio.click());
    });
    this.body().querySelectorAll('button[data-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = (btn as HTMLElement).dataset.toggle as 'shake' | 'hitstop' | 'showFps';
        s[key] = !s[key];
        btn.textContent = s[key] ? 'ON' : 'OFF';
        this.ctx.audio.click();
        this.ctx.onSettingsChanged();
      });
    });
    this.body().querySelector('#s-close')?.addEventListener('click', () => {
      this.ctx.audio.click();
      this.open('pause');
    });
  }

  // ---------- ENDING ----------
  private renderEnding(): void {
    const st = this.ctx.state;
    const next = nextWorld(ACTIVE.id);
    const firstEnding = st.endedWorlds.size === 1;
    const unlocks = [
      next ? `NEW SITE TRIANGULATED — <b style="color:var(--teal)">${next.name}</b>. Travel from the ASSAY office.` : 'The dish is quiet. Three fragments. Three chambers. All yours.',
      firstEnding ? 'THE EMBER FORGE IS LIT — spend embershards at the GARAGE.' : '',
    ].filter(Boolean).join('<br/>');
    this.body().innerHTML = `
      <div class="screen-title good">${ACTIVE.ending.title}</div>
      <div class="screen-sub" style="font-style:italic">${ACTIVE.ending.text}</div>
      <div class="screen-sub" style="margin-top:10px">${unlocks}</div>
      <div class="stat-grid" style="margin-top:14px">
        <div class="row"><span class="r-name">Record depth</span><span class="r-val">${st.bestDepthM}m</span></div>
        <div class="row"><span class="r-name">Lifetime earnings</span><span class="r-val">${fmt(st.totalEarned)}</span></div>
        <div class="row"><span class="r-name">Blocks cut</span><span class="r-val">${st.blocksDug.toLocaleString()}</span></div>
        <div class="row"><span class="r-name">Cores reached</span><span class="r-val">${st.endedWorlds.size} / ${WORLDS.length}</span></div>
      </div>
      <button class="btn primary wide" id="keep">KEEP DIGGING</button>
    `;
    this.body().querySelector('#keep')?.addEventListener('click', () => {
      this.ctx.audio.click();
      this.ctx.saveNow();
      this.close();
    });
  }
}

// ---------- title screen ----------
export function createTitle(
  ui: HTMLElement,
  hasSave: boolean,
  cb: { onNew(): void; onContinue(): void; onHover(): void },
): { hide(): void; el: HTMLElement } {
  const el = document.createElement('div');
  el.id = 'title';
  const letters = GAME_NAME.split('').map((c, i) => `<span style="--i:${i}">${c}</span>`).join('');
  el.innerHTML = `
    <div id="wordmark">${letters}</div>
    <div class="tagline">${ACTIVE.tagline}</div>
    <div class="menu">
      ${hasSave ? `<button class="btn primary" id="t-continue">CONTINUE — ${ACTIVE.name}</button>` : ''}
      <button class="btn ${hasSave ? '' : 'primary'}" id="t-new">${hasSave ? 'NEW EXPEDITION' : 'DESCEND'}</button>
    </div>
    <div class="advance-line">CINDRAL ADVANCE · ${CUR}40 · RECOVERABLE AGAINST EARNINGS</div>
    <a class="ghost-link" href="https://store.steampowered.com" target="_blank" rel="noopener">WISHLIST ON STEAM →</a>
    <div class="controls-hint"><span class="key">←→↑↓</span> fly &amp; drill · <span class="key">E</span> dock · <span class="key">ESC</span> pause</div>
  `;
  ui.appendChild(el);
  // two-step confirm in the button itself — native confirm() is blocked in
  // sandboxed iframes (the hosted build), so never rely on it
  const newBtn = el.querySelector('#t-new') as HTMLButtonElement | null;
  let armed = false;
  let armTimer = 0;
  newBtn?.addEventListener('click', () => {
    if (!hasSave || armed) {
      cb.onNew();
      return;
    }
    armed = true;
    newBtn.textContent = 'ERASE SAVE — CLICK AGAIN';
    newBtn.classList.add('danger');
    clearTimeout(armTimer);
    armTimer = window.setTimeout(() => {
      armed = false;
      newBtn.textContent = 'NEW EXPEDITION';
      newBtn.classList.remove('danger');
    }, 3500);
  });
  el.querySelector('#t-continue')?.addEventListener('click', () => cb.onContinue());
  el.querySelectorAll('.btn').forEach(b => b.addEventListener('mouseenter', () => cb.onHover()));
  return {
    el,
    hide() {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 1000);
    },
  };
}
