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
import { ACTIVE, WORLDS, nextWorld, worldById } from '../world/worlds';
import { oreIcon, oreGlow } from './icons';
import { Settings } from '../game/settings';
import {
  Contract, offers, evaluate, timeLeft, fuelLeft, accept as acceptContract,
} from '../game/contracts';
import { ENDING_PAGES, EndingKind, transmissionById } from '../game/narrative';
import { EXTRACT_OFFER } from '../config';
import { GLYPHS, glyphSvg } from '../world/glyphs';
import { DISPATCH_VOICED, LAMPLIGHTERS_VOICED, dispatchVoiceUrl, lamplightersVoiceUrl } from '../audio/voice-manifest';

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

export type PanelKind = 'fuel' | 'trade' | 'garage' | 'assay' | 'pause' | 'death' | 'rescue' | 'ending' | 'settings' | 'contracts' | 'finale' | 'transcript';

interface PanelCtx {
  state: GameState;
  audio: AudioEngine;
  settings: Settings;
  saveNow(): void;
  toast(msg: string, cls?: string): void;
  onRespawn(): void;
  onRescued(): void;
  /** free lift home after a core is met — no fee, no fuss */
  onReturnSurface(): void;
  /** the fragment in the hold is sold to Cindral at the trade post */
  onDeliverFragment(): void;
  /** an ending's epilogue closed with CONTINUE: rewind to the moment before */
  onEndingContinue(): void;
  /** an ending's epilogue chose a fresh start */
  onNewExpedition(): void;
  onQuitToTitle(): void;
  onOpenStarmap(): void;
  onSettingsChanged(): void;
}

const fmt = fmtMoney;

export class Panels {
  current: PanelKind | null = null;
  private scrim: HTMLElement | null = null;
  private deathCause = '';
  private deathFee = 0;
  private lostCargo = 0;
  private endingKind: EndingKind = 'extract';

  constructor(private ui: HTMLElement, private ctx: PanelCtx) {}

  get isOpen(): boolean { return this.current !== null; }

  close(): void {
    this.scrim?.remove();
    this.scrim = null;
    this.current = null;
  }

  open(kind: PanelKind, opts?: { cause?: string; ending?: EndingKind }): void {
    this.close();
    this.current = kind;
    if (kind === 'death' && opts?.cause) this.prepareDeath(opts.cause);
    if (kind === 'finale' && opts?.ending) this.endingKind = opts.ending;
    this.scrim = document.createElement('div');
    this.scrim.className = 'panel-scrim';
    this.scrim.innerHTML = `<div class="panel" id="panel-body"></div>`;
    this.ui.appendChild(this.scrim);
    // click outside closes shop panels (not fate panels)
    if (kind === 'fuel' || kind === 'trade' || kind === 'garage' || kind === 'assay' ||
      kind === 'pause' || kind === 'settings' || kind === 'contracts' || kind === 'transcript') {
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
      case 'finale': this.renderFinale(); break;
      case 'settings': this.renderSettings(); break;
      case 'contracts': this.renderContracts(); break;
      case 'transcript': this.renderTranscript(); break;
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
    // Cindral's standing order: posted forever once relayed, so the number
    // sits there every time you sell a load of ordinary ore beside it
    const order = st.extractOrderHeard ? `
      <div class="order-card">
        <div class="order-head">CINDRAL EXTRACTION ORDER 9-1-1</div>
        <div class="order-body">FRAGMENT RECOVERY · <b>${fmt(EXTRACT_OFFER)}</b> PER UNIT ON DELIVERY · ALL DEBTS CLEARED</div>
        ${st.carrying
          ? `<button class="btn primary wide" id="deliver">DELIVER THE FRAGMENT · ${fmt(EXTRACT_OFFER)}</button>`
          : `<div class="order-note">no fragment in hold</div>`}
      </div>` : '';
    this.body().innerHTML = `
      ${this.header('TRADE POST')}
      ${rows}
      <div class="sell-total"><span>TOTAL</span><b>${fmt(st.cargoValue)}</b></div>
      <button class="btn primary wide" id="sell" ${st.cargoCount === 0 ? 'disabled' : ''}>SELL ALL</button>
      ${order}
      <button class="btn wide" id="to-contracts">CONTRACT BOARD${st.contract ? ' · 1 ACTIVE' : ''}</button>
      <div class="hint">Press E or Esc to leave</div>
    `;
    this.body().querySelector('#deliver')?.addEventListener('click', () => {
      this.close();
      this.ctx.onDeliverFragment();
    });
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
    // Stash: long-term storage, off to one side of the hold — stowed ore
    // never counts toward cargoCap and is never touched by SELL ALL or a
    // mimic's grab, so embershards saved for the Forge can ride out a trip
    // to the trade post untouched.
    const bayEntries = [...st.cargo.entries()].sort((a, b) => oreValue(b[0]) - oreValue(a[0]))
      .map(([t, c]) => `
        <div class="row">
          <span class="r-left">
            <img class="ore-icon" src="${oreIcon(t)}" alt="" style="--glow:${oreGlow(t)}" />
            <span><span class="r-name">${def(t).name}</span><div class="r-sub">in hold${t === T.EMBERSHARD ? ' · ◆ feeds the EMBER FORGE' : ''}</div></span>
          </span>
          <span class="r-right">
            <span class="r-val">× ${c}</span>
            <button class="btn" data-stow="${t}">STOW</button>
          </span>
        </div>`).join('')
      + [...st.stored.entries()].sort((a, b) => oreValue(b[0]) - oreValue(a[0]))
      .map(([t, c]) => {
        const full = st.cargoCount >= st.cargoCap;
        return `
        <div class="row">
          <span class="r-left">
            <img class="ore-icon" src="${oreIcon(t)}" alt="" style="--glow:${oreGlow(t)}" />
            <span><span class="r-name">${def(t).name}</span><div class="r-sub">stowed${t === T.EMBERSHARD ? ' · ◆ feeds the EMBER FORGE' : ''}</div></span>
          </span>
          <span class="r-right">
            <span class="r-val">× ${c}</span>
            <button class="btn" data-retrieve="${t}" ${full ? 'disabled' : ''}>RETRIEVE</button>
          </span>
        </div>`;
      }).join('');
    const bayRows = `
      <div class="forge-head">STASH<span class="forge-shards">stowed ore is never sold</span></div>
      ${bayEntries || `<div class="row"><span class="r-sub">Nothing in the hold or the stash.</span></div>`}`;
    // Ember Forge: lit after the first core is touched; paid in embershards
    // aboard OR stowed in the stash
    const shards = (st.cargo.get(T.EMBERSHARD) ?? 0) + (st.stored.get(T.EMBERSHARD) ?? 0);
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
      ${this.acclimationRows()}
      <div class="row">
        <span><span class="r-name">ARRESTORS</span><div class="r-sub">B — deploy a landing pad in your own shaft. Drop at full speed, land clean. Recoverable.</div></span>
        <span class="r-right">
          <span class="r-val">×${st.arrestors}</span>
          <button class="btn" id="buy-arrestor" ${st.money < ARRESTOR_PRICE || st.arrestors >= MAX_ARRESTORS ? 'disabled' : ''}>${fmt(ARRESTOR_PRICE)}</button>
        </span>
      </div>
      ${bayRows}
      ${forgeRows}
      <div class="hint">Press E or Esc to leave</div>
    `;
    this.body().querySelectorAll('button[data-stow]').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = Number((btn as HTMLElement).dataset.stow);
        const n = st.stowStack(t);
        if (n > 0) {
          this.ctx.audio.click();
          this.ctx.toast(`STOWED × ${n}`, 'stratum');
          this.ctx.saveNow();
        }
        this.renderGarage();
      });
    });
    this.body().querySelectorAll('button[data-retrieve]').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = Number((btn as HTMLElement).dataset.retrieve);
        const n = st.retrieveStack(t);
        if (n > 0) {
          this.ctx.audio.click();
          this.ctx.toast(`RETRIEVED × ${n}`, 'stratum');
          this.ctx.saveNow();
        } else {
          this.ctx.audio.denied();
        }
        this.renderGarage();
      });
    });
    this.body().querySelector('#fit-accl')?.addEventListener('click', () => {
      if (!st.fitAcclimation()) { this.ctx.audio.denied(); return; }
      const nat = ACTIVE.native!;
      this.ctx.audio.buy();
      this.ctx.toast(`${nat.tiers[st.acclTier - 1].label.toUpperCase()} FITTED`, 'stratum');
      this.ctx.saveNow();
      this.renderGarage();
    });
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

  /** the world-specific survival rig, built from that world's own material */
  private acclimationRows(): string {
    const st = this.ctx.state;
    const nat = ACTIVE.native;
    if (!nat) return '';
    const tier = st.acclTier;
    const maxed = tier >= nat.tiers.length;
    const next = maxed ? null : nat.tiers[tier];
    const cost = maxed ? 0 : st.nativeCost(tier);
    const held = st.nativeHeld;
    return `
      <div class="forge-head">${nat.gear}<span class="forge-shards">◇ ${held} ${nat.ore}</span></div>
      <div class="row">
        <span>
          <span class="r-name">${maxed ? nat.tiers[tier - 1].label : next!.label}</span>
          <div class="r-sub">${maxed
            ? 'Rated to the core. Nothing down there can touch you.'
            : `${nat.blurb} Survives to ~${Math.round(this.depthFor(next!.resist))}m.`}</div>
        </span>
        ${maxed
          ? '<span class="r-val">FITTED</span>'
          : `<button class="btn" id="fit-accl" ${held < cost ? 'disabled' : ''}>◇ ${cost}</button>`}
      </div>`;
  }

  /** how deep a given resist keeps you alive on this world */
  private depthFor(resist: number): number {
    const start = ACTIVE.hazardStartRow;
    const row = start + (resist / 1.25) * (500 - start);
    return Math.min(1024, Math.round(row * 2));
  }

  // ---------- ASSAY ----------
  private renderAssay(): void {
    const st = this.ctx.state;

    // starmap: site roster; travel itself lives in the 3D Sundering Chart
    const charted = WORLDS.filter(w => w.unlockAfter === null || st.endedWorlds.has(w.unlockAfter)).length;
    const starmap = WORLDS.map(w => {
      const unlocked = w.unlockAfter === null || st.endedWorlds.has(w.unlockAfter);
      const current = w.id === st.activeWorld;
      const done = st.endedWorlds.has(w.id);
      const status = current ? '<span class="r-val" style="color:var(--teal)">YOU ARE HERE</span>'
        : done ? '<span class="r-val">CORE REACHED</span>'
          : unlocked ? '<span class="r-val" style="color:var(--ink-dim)">CHARTED</span>'
            : '<span class="r-val" style="color:var(--ink-dim)">NO SIGNAL</span>';
      return `
        <div class="row">
          <span>
            <span class="r-name">${unlocked ? w.name : '█████-█'}</span>
            <div class="r-sub">${unlocked ? (done ? w.coreName + ' — reached · ore ×' + w.valueMul : 'ore ×' + w.valueMul) : 'the dish is still listening'}</div>
          </span>
          ${status}
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
      ${this.transcriptButton()}
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
      <div class="forge-head">STARMAP<span class="forge-shards">${charted} / ${WORLDS.length} sites charted</span></div>
      ${starmap}
      <button class="btn primary wide" id="open-starmap">OPEN THE SUNDERING CHART</button>
      ${st.glyphs > 0 ? `
      <div class="forge-head">CODEX<span class="forge-shards">${st.glyphs} / ${GLYPHS_TO_TRANSLATE} stones walked</span></div>
      ${GLYPHS.map(g => {
        const got = st.glyphsSet.has(g.id);
        const voiced = got && LAMPLIGHTERS_VOICED.has(g.id);
        return `<div class="codex-row ${got ? '' : 'locked'}">
          ${glyphSvg(g, 'codex-mark')}
          <span class="codex-info"><span class="r-name">${got ? g.name : '· · ·'}</span>
          <div class="r-sub">${got ? g.fragment : '— untranslated. The stone is a door. —'}</div></span>
          ${voiced ? `<button class="tx-play" data-codex-play="${g.id}" aria-label="Play fragment" title="Play fragment">▶</button>` : ''}
        </div>`;
      }).join('')}
      ${st.glyphs >= GLYPHS_TO_TRANSLATE ? `
      <div class="lore-note">
        <h4>THE ASSEMBLED READING</h4>
        <p>We were not thieves. We were the last shift, and the light was going out, and we did the only thing anyone could think of: we put it somewhere it would keep. Under a world, where weather could not reach it. We are sorry for the dark we left you standing in. It was meant to be temporary. Everything is meant to be temporary. If you have read this far, then you can put it back — and we are sorry, again, for what that will cost you.</p>
      </div>` : ''}` : ''}
      <div class="forge-head">ASSAY LOGS — ${ACTIVE.name}</div>
      ${notes}
      ${found ? `<div class="forge-head">FOUND LOGS</div>${found}` : ''}
      <div class="hint">Press E or Esc to leave</div>
    `;
    this.body().querySelector('#open-transcript')?.addEventListener('click', () => {
      this.ctx.audio.click();
      this.open('transcript');
    });
    this.body().querySelectorAll('button[data-codex-play]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const glyphId = (btn as HTMLElement).dataset.codexPlay!;
        this.ctx.audio.playVoice([lamplightersVoiceUrl(glyphId)], 'lamplighters');
      });
    });
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
    this.body().querySelector('#open-starmap')?.addEventListener('click', () => {
      this.ctx.audio.click();
      this.ctx.onOpenStarmap();
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
  // ---------- DISPATCH TRANSCRIPT ----------
  // The dish keeps a record. firedEvents persists transmission ids in the
  // order they played, so a missed dispatch is never lost — walk back to the
  // assay office and read the tape.
  private transmissionLog(): { id: string; world?: string; lines: string[] }[] {
    const log: { id: string; world?: string; lines: string[] }[] = [];
    for (const id of this.ctx.state.firedEvents) {
      const tx = transmissionById(id);
      if (tx) log.push({ id, world: tx.world, lines: tx.lines });
    }
    return log;
  }

  /** transmissions relayed since the tape was last opened */
  private unreadTransmissions(): number {
    return Math.max(0, this.transmissionLog().length - this.ctx.state.transcriptSeen);
  }

  /** which of a transmission's lines have a recorded take, in play order */
  private voicedDispatchUrls(txId: string, lineCount: number): string[] {
    const urls: string[] = [];
    for (let i = 1; i <= lineCount; i++) {
      const clipId = `${txId}-${i}`;
      if (DISPATCH_VOICED.has(clipId)) urls.push(dispatchVoiceUrl(clipId));
    }
    return urls;
  }

  /** the assay office's door to the tape, carrying its unread marker */
  private transcriptButton(): string {
    const total = this.transmissionLog().length;
    const unread = this.unreadTransmissions();
    return `<button class="btn wide ${unread > 0 ? 'has-unread' : ''}" id="open-transcript">
      ${unread > 0 ? '<span class="tx-dot" aria-hidden="true"></span>' : ''}DISPATCH TRANSCRIPT ·
      ${unread > 0 ? `<b>${unread} NEW</b> OF ${total}` : `${total} ON RECORD`}
    </button>`;
  }

  private renderTranscript(): void {
    const log = this.transmissionLog();
    // opening the tape reads it: the unread mark clears from here on
    const unread = this.unreadTransmissions();
    if (this.ctx.state.transcriptSeen !== log.length) {
      this.ctx.state.transcriptSeen = log.length;
      this.ctx.saveNow();
    }
    // newest first: "what did I just miss" is the errand this page exists for
    const entries = log.length
      ? log.map((tx, i) => {
        const world = tx.world ? worldById(tx.world)?.name ?? '' : '';
        // the tail of the log is what arrived since the last visit
        return { tx, n: i + 1, world, fresh: i >= log.length - unread };
      }).reverse().map(({ tx, n, world, fresh }) => {
        const voiced = this.voicedDispatchUrls(tx.id, tx.lines.length);
        return `
        <div class="tx-entry${fresh ? ' fresh' : ''}">
          <div class="tx-head">
            <span class="tx-label">◦ DISPATCH</span>
            <span class="tx-head-right">
              <span class="tx-meta">${fresh ? '<b>NEW</b> · ' : ''}TX ${String(n).padStart(3, '0')}${world ? ' · ' + world : ''}</span>
              ${voiced.length ? `<button class="tx-play" data-tx-play="${tx.id}" aria-label="Play transmission" title="Play transmission">▶</button>` : ''}
            </span>
          </div>
          ${tx.lines.map(l => `<p>${l}</p>`).join('')}
        </div>`;
      }).join('')
      : `<div class="row"><span class="r-sub">The tape is blank. Dispatch will find you — keep digging.</span></div>`;
    this.body().innerHTML = `
      ${this.header('DISPATCH TRANSCRIPT')}
      <div class="tx-sub">Every transmission the dish has relayed, newest first. The tape does not forget, even when you were busy not dying.</div>
      ${entries}
      <button class="btn wide" id="tx-back">BACK TO THE OFFICE</button>
      <div class="hint">Press Esc to leave</div>
    `;
    this.body().querySelectorAll('button[data-tx-play]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const txId = (btn as HTMLElement).dataset.txPlay!;
        const tx = log.find(t => t.id === txId);
        if (!tx) return;
        this.ctx.audio.playVoice(this.voicedDispatchUrls(tx.id, tx.lines.length), 'dispatch');
      });
    });
    this.body().querySelector('#tx-back')?.addEventListener('click', () => {
      this.ctx.audio.click();
      this.ctx.audio.stopVoice();
      this.open('assay');
    });
  }

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
    const slider = (key: 'master' | 'sfx' | 'music' | 'voiceDispatch' | 'voiceLamplighters', label: string) => `
      <div class="row">
        <span class="r-name">${label}</span>
        <span class="r-right">
          <input type="range" min="0" max="100" value="${Math.round(s[key] * 100)}" data-vol="${key}" />
          <span class="r-val" id="v-${key}">${Math.round(s[key] * 100)}</span>
        </span>
      </div>`;
    const toggle = (key: 'shake' | 'hitstop' | 'showFps' | 'vaultAssist', label: string, sub: string) => `
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
      <div class="forge-head">VOICES</div>
      ${slider('voiceDispatch', 'Dispatch')}
      ${slider('voiceLamplighters', 'The Lamplighters')}
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
      ${toggle('vaultAssist', 'Vault assist', 'The Nine Stones, gentler: hazards at six-tenths speed')}
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
      const key = input.dataset.vol as 'master' | 'sfx' | 'music' | 'voiceDispatch' | 'voiceLamplighters';
      input.addEventListener('input', () => {
        s[key] = Number(input.value) / 100;
        (this.body().querySelector('#v-' + key) as HTMLElement).textContent = input.value;
        this.ctx.onSettingsChanged();
      });
      input.addEventListener('change', () => this.ctx.audio.click());
    });
    this.body().querySelectorAll('button[data-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = (btn as HTMLElement).dataset.toggle as 'shake' | 'hitstop' | 'showFps' | 'vaultAssist';
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
  // The epilogue to the Communion: the only bright screen in the game.
  // Every other panel is glass on darkness; this one is bone-white — the
  // player dug toward the light and, for one screen, they are standing in it.
  private renderEnding(): void {
    const st = this.ctx.state;
    const next = nextWorld(ACTIVE.id);
    const firstEnding = st.endedWorlds.size === 1;
    const fragN = WORLDS.findIndex(w => w.id === ACTIVE.id) + 1;
    // the rite already spoke the full text over the white; the epilogue
    // keeps only the last line, as an inscription
    const lines = ACTIVE.ending.text.split(/<br\s*\/?>/).map(s => s.trim()).filter(Boolean);
    const epigraph = lines[lines.length - 1] ?? '';
    const unlocks = [
      next
        ? `NEW SITE TRIANGULATED — <b class="end-site">${next.name}</b> · travel from the ASSAY office`
        : 'THE DISH IS QUIET — three fragments, three chambers, all yours',
      firstEnding ? 'THE EMBER FORGE IS LIT — spend embershards at the GARAGE' : '',
    ].filter(Boolean).map(u => `<div class="end-unlock">${u}</div>`).join('');
    const stats: [string, string][] = [
      ['RECORD DEPTH', `${st.bestDepthM}m`],
      ['LIFETIME EARNINGS', fmt(st.totalEarned)],
      ['BLOCKS CUT', st.blocksDug.toLocaleString()],
      ['CORES REACHED', `${st.endedWorlds.size} / ${WORLDS.length}`],
    ];
    this.scrim!.classList.add('rite');
    this.body().innerHTML = `
      <div class="end-eyebrow">THE SUNDERING · FRAGMENT ${fragN} OF ${WORLDS.length}</div>
      <div class="end-title">${ACTIVE.ending.title}</div>
      <div class="end-rule"></div>
      <div class="end-epigraph">${epigraph}</div>
      ${unlocks}
      <div class="end-stats">
        ${stats.map(([k, v]) => `<div class="end-stat"><b>${v}</b><span>${k}</span></div>`).join('')}
      </div>
      <div class="btn-row">
        <button class="btn primary" id="surface">RETURN TO SURFACE</button>
        <button class="btn" id="keep">KEEP DIGGING</button>
      </div>
    `;
    this.body().querySelector('#surface')?.addEventListener('click', () => {
      this.ctx.audio.click();
      this.close();
      this.ctx.onReturnSurface();
    });
    this.body().querySelector('#keep')?.addEventListener('click', () => {
      this.ctx.audio.click();
      this.ctx.saveNow();
      this.close();
    });
  }

  // ---------- FINALE ----------
  // The epilogue after an ending's page. The choice already happened; this
  // is the record of it — and the door back to the moment before, so one
  // save can stand at the fork and try every road.
  private renderFinale(): void {
    const st = this.ctx.state;
    const page = ENDING_PAGES[this.endingKind];
    const stats: [string, string][] = [
      ['RECORD DEPTH', `${st.bestDepthM}m`],
      ['LIFETIME EARNINGS', fmt(st.totalEarned)],
      ['BLOCKS CUT', st.blocksDug.toLocaleString()],
      ['ENDINGS SEEN', `${GameState.endingsSeen().size} / 3`],
    ];
    this.scrim!.classList.add('rite');
    if (this.endingKind === 'extract') this.scrim!.classList.add('rite-dark');
    this.body().innerHTML = `
      <div class="end-eyebrow">${page.eyebrow}</div>
      <div class="end-title">${page.title}</div>
      <div class="end-rule"></div>
      <div class="end-epigraph">${page.epigraph}</div>
      <div class="end-stats">
        ${stats.map(([k, v]) => `<div class="end-stat"><b>${v}</b><span>${k}</span></div>`).join('')}
      </div>
      <div class="btn-row">
        <button class="btn primary" id="rewind">CONTINUE — THE MOMENT BEFORE</button>
        <button class="btn" id="fresh">NEW EXPEDITION</button>
      </div>
    `;
    this.body().querySelector('#rewind')?.addEventListener('click', () => {
      this.ctx.audio.click();
      this.close();
      this.ctx.onEndingContinue();
    });
    this.body().querySelector('#fresh')?.addEventListener('click', () => {
      this.ctx.audio.click();
      this.close();
      this.ctx.onNewExpedition();
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
  // ending emblems: meta-progress that outlives every save
  const seen = GameState.endingsSeen();
  const emblems = seen.size === 0 ? '' : `
    <div class="emblems">${(['extract', 'return', 'kindle'] as const)
      .filter(k => seen.has(k))
      .map(k => `<span class="emblem em-${k}" title="${k.toUpperCase()}">${
        k === 'extract' ? '◼' : k === 'return' ? '☀' : '✷'}</span>`)
      .join('')}</div>`;
  el.innerHTML = `
    <div id="wordmark">${letters}</div>
    <div class="tagline">${ACTIVE.tagline}</div>
    ${emblems}
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
