import { USE_ALL, type Simulation } from '../game/simulation';
import type { Sound } from '../game/audio';
import { BONUS_FROM, MOD_GROUPS, WEAPONS, modDps } from '../game/weapons';
import { MISSILES, PLANE, type Missile } from '../game/missiles';
import { PETS } from '../game/pets';
import { gunGeometry } from '../game/geometry';
import { PLANE_URL, asset, gunUrl, missileUrl, petUrl } from '../game/assets';
import { HERO_ORIGIN, IDLE_FRAME } from '../game/hero';

type Tab = 'armory' | 'ammo' | 'pets' | 'air';
const TABS: { id: Tab; label: string; sub: string }[] = [
  { id: 'armory', label: 'ARMORY', sub: 'ONE WEAPON EQUIPPED' },
  { id: 'ammo', label: 'ORDNANCE', sub: 'MISSILES' },
  { id: 'pets', label: 'COMPANIONS', sub: 'FIGHT AT YOUR SIDE' },
  { id: 'air', label: 'AIRSTRIKE', sub: 'CALL IN THE JET' },
];

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
const money = (n: number) => '$' + n.toLocaleString();
const tierOf = (i: number) => i >= BONUS_FROM ? 4 : i >= 25 ? 3 : i >= 15 ? 2 : i >= 6 ? 1 : 0;
const TIER_NAME = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];
const missileTier = (price: number) => price >= 10000 ? 4 : price >= 3000 ? 3 : price >= 1000 ? 2 : price >= 300 ? 1 : 0;

const images = new Map<string, HTMLImageElement>();
function img(url: string, onLoad: () => void): HTMLImageElement {
  let im = images.get(url);
  if (!im) { im = new Image(); im.onload = onLoad; im.src = url; images.set(url, im); }
  return im;
}

const hx0 = (W: number) => W * .5;

export class ShopUI {
  tab: Tab = 'armory';
  private preview: number | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private t = 0; private raf = 0;
  /** Card that was just bought (flashes once) and whether cash just changed. */
  private flash = ''; private paid = false;

  constructor(private root: HTMLElement, private sim: Simulation, private audio: Sound, private hooks: { close: () => void; change: () => void }) {
    root.addEventListener('click', e => this.click(e));root.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&(e.target as HTMLElement).matches('[role=button]')){e.preventDefault();(e.target as HTMLElement).click();}});
    window.addEventListener('keydown', e => {
      if (this.root.classList.contains('hidden') || !/^[1-4]$/.test(e.key)) return;
      e.stopImmediatePropagation(); this.tab = TABS[Number(e.key) - 1].id; this.flash = ''; this.render();
    }, true);
    root.addEventListener('pointerover', e => {
      const c = (e.target as HTMLElement).closest<HTMLElement>('[data-preview]');
      const next = c ? Number(c.dataset.preview) : null;
      if (next !== this.preview) { this.preview = next; this.drawShowcase(); }
    });
  }

  /** Redraw everything; keeps the scroll position of the item list. */
  render() {
    const keep = this.root.querySelector<HTMLElement>('.sx-main')?.scrollTop ?? 0;
    const sim = this.sim;
    const dps = WEAPONS.reduce((a, w, i) => a + (sim.active[i] ? modDps(w) : 0), 0);
    this.root.innerHTML = `<div class="sx">
      <div class="sx-head"><div class="sx-title"><span class="eyebrow pink">THE RAINMAKER</span><h2>THE ARMORY</h2></div>
        <nav class="sx-tabs" role="tablist">${TABS.map((t, n) => { const k = this.affordable(t.id); return `<button role="tab" aria-selected="${t.id === this.tab}" class="${t.id === this.tab ? 'on' : ''}" data-act="tab" data-tab="${t.id}"><i class="sx-key">${n + 1}</i><b>${t.label}</b><small>${t.sub}</small>${k ? `<span class="sx-dot" title="${k} affordable">${k}</span>` : ''}</button>`; }).join('')}</nav>
        <div class="sx-cash${this.paid ? ' paid' : ''}"><span>CASH</span><b>${money(sim.cash)}</b></div>
        <button class="sx-close" data-act="close">BACK TO THE STREET <kbd>E</kbd></button></div>
      <div class="sx-body">
        <aside class="sx-side"><div class="sx-stage"><canvas aria-label="Your hero with the current loadout"></canvas><span class="sx-badge" id="sx-badge"></span></div>
          <dl class="sx-stats"><div><dt>OWNED</dt><dd>${sim.ownedCount}<i>/${WEAPONS.length}</i></dd></div><div><dt>EQUIPPED</dt><dd>×${sim.activeCount}</dd></div><div><dt>DPS</dt><dd>~${dps.toLocaleString()}</dd></div><div><dt>PETS</dt><dd>${sim.pets.length}<i>/${PETS.length}</i></dd></div></dl>
          <div class="sx-loadout"><span>ROCKET AMMO <b>${sim.gunAmmo >= 0 ? MISSILES[sim.gunAmmo].name : 'STANDARD'}</b></span><span>JET PAYLOAD <b>${!sim.planeOwned ? 'NO JET' : sim.payload >= 0 ? MISSILES[sim.payload].name : 'BASIC BOMBS'}</b></span></div></aside>
        <main class="sx-main">${this.panel()}</main></div></div>`;
    const main = this.root.querySelector<HTMLElement>('.sx-main'); if (main) main.scrollTop = keep;
    this.canvas = this.root.querySelector('canvas'); this.drawShowcase();
  }

  /** How many things on a tab you can buy right now: the little badge on each tab. */
  private affordable(tab: Tab): number {
    const sim = this.sim, c = sim.cash;
    if (tab === 'armory') return WEAPONS.filter((w, i) => !sim.owned[i] && w.price <= c).length;
    if (tab === 'ammo') return MISSILES.filter((m, i) => !sim.missilesOwned[i] && m.price <= c).length;
    if (tab === 'pets') return PETS.filter((p, i) => !sim.petsOwned[i] && p.price <= c).length;
    return !sim.planeOwned && PLANE.price <= c ? 1 : 0;
  }
  private just(key: string) { return this.flash === key ? ' just' : ''; }

  private panel(): string {
    switch (this.tab) {
      case 'armory': return this.armory();
      case 'ammo': return this.ammo();
      case 'pets': return this.petsPanel();
      default: return this.air();
    }
  }

  private priceTag(owned: boolean, can: boolean, price: number, ownedText: string) {
    if (owned) return `<span class="sx-pr own"><i>✓</i>${ownedText}</span>`;
    if (can) return `<span class="sx-pr buy"><span>BUY</span><b>${money(price)}</b></span>`;
    const pct = Math.max(4, Math.min(100, this.sim.cash / price * 100));
    return `<span class="sx-pr poor"><span>🔒 ${money(price)}</span><small>NEED ${money(price - this.sim.cash)}</small><i class="sx-need"><i style="width:${pct}%"></i></i></span>`;
  }

  private useAllCard() {
    const sim = this.sim, all = sim.allWeaponsOwned, can = all && sim.cash >= USE_ALL.price;
    const state = sim.useAllOwned ? 'own on' : can ? 'can' : 'cant';
    const pr = sim.useAllOwned ? '<span class="sx-pr own"><i>✓</i>UNLOCKED · PRESS X</span>' : !all ? `<span class="sx-pr poor"><span>🔒 OWN ALL ${WEAPONS.length} WEAPONS</span><small>${sim.ownedCount}/${WEAPONS.length}</small><i class="sx-need"><i style="width:${sim.ownedCount / WEAPONS.length * 100}%"></i></i></span>` : this.priceTag(false, can, USE_ALL.price, '');
    return `<button class="sx-card sx-useall t4 ${state}${this.just('useall')}" data-act="buy-useall" style="--c:#ffd36a"><span class="sx-tier">ULTIMATE</span><b>USE ALL</b><em>Every weapon you own fires at once for ${USE_ALL.duration} seconds. ${USE_ALL.cooldown}s cooldown.</em>${pr}</button>`;
  }

  private armory() {
    const sim = this.sim; let out = this.useAllCard();
    for (const g of MOD_GROUPS) {
      const cards = WEAPONS.map((w, i) => ({ w, i })).filter(({ w }) => w.group === g).sort((a, b) => a.w.price - b.w.price).map(({ w, i }) => {
        const own = sim.owned[i], on = own && sim.active[i], can = sim.cash >= w.price, tier = tierOf(i);
        const stat = w.orbit ? `${w.orbit} BLADES` : w.strike ? `${w.strike.count} STRIKES` : `${(w.rate * w.burst).toFixed(1).replace(/\.0$/, '')}/S`;
        return `<button class="sx-card t${tier} ${own ? (on ? 'own on' : 'own off') : can ? 'can' : 'cant'}${this.just('mod' + i)}" data-act="${own ? 'toggle-mod' : 'buy-mod'}" data-i="${i}" data-preview="${i}" style="--c:${hex(w.color)}">
          <span class="sx-tier">${TIER_NAME[tier]}</span>${on ? '<span class="sx-flag">EQUIPPED</span>' : ''}<span class="sx-art"><img src="${gunUrl(w.art)}" alt="" loading="lazy"/></span>
          <b>${w.name}</b><em>${w.tag}</em><span class="sx-st">${Math.round(w.damage)} DMG · ${stat} · ${modDps(w).toLocaleString()} DPS</span>
          ${this.priceTag(own, can, w.price, on ? 'EQUIPPED' : 'EQUIP WEAPON')}</button>`;
      }).join('');
      out += `<h3 class="sx-h">${g}${g === 'LEGENDARY' ? ' <small>ENDGAME</small>' : ''}</h3><div class="sx-grid">${cards}</div>`;
    }
    return out;
  }

  private missileCard(m: Missile, i: number) {
    const sim = this.sim, own = sim.missilesOwned[i], can = sim.cash >= m.price, tier = missileTier(m.price);
    const useText = m.use === 'gun' ? 'ROCKET MODS' : m.use === 'plane' ? 'AIRSTRIKE' : 'ROCKETS + JET';
    const chips = `<span class="sx-st">DMG ×${m.dmg} · BLAST ×${m.radius}${m.homing ? ' · HOMING' : ''}${m.pierce ? ' · PIERCE' : ''}${m.slow ? ' · FREEZE' : ''}${m.salvo ? ` · ${m.salvo} BOMBS` : ''}</span>`;
    const equip = own ? `<span class="sx-equip">${m.use !== 'plane' ? `<button data-act="equip-gun" data-i="${i}" class="${sim.gunAmmo === i ? 'on' : ''}">${sim.gunAmmo === i ? '✓ ON GUN' : 'EQUIP ON GUN'}</button>` : ''}${m.use !== 'gun' ? `<button data-act="equip-jet" data-i="${i}" class="${sim.payload === i ? 'on' : ''}">${sim.payload === i ? '✓ ON JET' : 'LOAD ON JET'}</button>` : ''}</span>` : '';
    return `<div role="group" class="sx-card sx-missile t${tier} ${own ? 'own on' : can ? 'can' : 'cant'}${this.just('missile' + i)}" style="--c:${hex(m.color)}" ${own ? '' : `role="button" tabindex="0" data-act="buy-missile" data-i="${i}"`}>
      <span class="sx-tier">${useText}</span><span class="sx-art wide"><img src="${missileUrl(m.img)}" alt="" loading="lazy"/></span><b>${m.name}</b><em>${m.tag}</em>${chips}
      ${own ? '<span class="sx-pr own">OWNED</span>' + equip : this.priceTag(false, can, m.price, '')}</div>`;
  }

  private ammo() {
    return `<div class="supply-row"><button data-act="buy-ammo" ${this.sim.cash<8||this.sim.ammo[this.sim.primary]>=150?'disabled':''}><b>AMMO SUPPLY</b><span>+60 rounds · $8</span></button><button data-act="buy-heal" ${this.sim.cash<this.sim.healPrice||this.sim.healCd>0||this.sim.player.hp>=100?'disabled':''}><b>FIELD MEDIC</b><span>+35 HP · ${money(this.sim.healPrice)}${this.sim.healCd > 0 ? ` · READY IN ${Math.ceil(this.sim.healCd)}s` : ' · price rises every wave'}</span></button></div><p class="sx-note">Gun missiles upgrade the rocket mods (Boomstick, Seeker Swarm, Doomsday). Jet missiles become the payload of your airstrike. Some fit both.</p>
      <h3 class="sx-h">ROCKET AMMO <small>FOR THE GUN</small></h3><div class="sx-grid wide">${MISSILES.map((m, i) => ({ m, i })).filter(({ m }) => m.use !== 'plane').map(({ m, i }) => this.missileCard(m, i)).join('')}</div>
      <h3 class="sx-h">JET PAYLOAD <small>FOR THE AIRSTRIKE</small></h3><div class="sx-grid wide">${MISSILES.map((m, i) => ({ m, i })).filter(({ m }) => m.use === 'plane').map(({ m, i }) => this.missileCard(m, i)).join('')}</div>`;
  }

  private petsPanel() {
    const sim = this.sim;
    return `<p class="sx-note">Companions follow you, never die, and fight on their own. Their damage grows with the waves.</p><div class="sx-grid wide">${PETS.map((p, i) => {
      const own = sim.petsOwned[i], can = sim.cash >= p.price;
      return `<button class="sx-card sx-pet t${Math.min(4, i)} ${own ? 'own on' : can ? 'can' : 'cant'}${this.just('pet' + i)}" data-act="buy-pet" data-i="${i}" style="--c:${hex(p.color)}"><span class="sx-tier">${p.role}</span><span class="sx-art tall"><img src="${petUrl(p.img)}" alt="" loading="lazy"/></span><b>${p.name}</b><em>${p.tag}</em>${this.priceTag(own, can, p.price, 'ON THE TEAM')}</button>`;
    }).join('')}</div>`;
  }

  private air() {
    const sim = this.sim, can = sim.cash >= PLANE.price;
    const loaded = sim.payload >= 0 ? MISSILES[sim.payload] : null;
    const planeMissiles = MISSILES.map((m, i) => ({ m, i })).filter(({ m, i }) => m.use !== 'gun' && sim.missilesOwned[i]);
    return `<div class="sx-air"><div class="sx-jet"><img src="${PLANE_URL}" alt="Airstrike jet"/></div>
      <div class="sx-air-info"><span class="eyebrow pink">SPECIAL ATTACK</span><h3>STRIKE FIGHTER</h3>
        <p>One pass over the street, carpet-bombing everything ahead of it. Press <kbd>Q</kbd> to call it in. ${PLANE.cooldown} second cooldown.</p>
        <p class="sx-hint">${loaded ? `PAYLOAD: ${loaded.name} · ${loaded.salvo} bombs · DMG ×${loaded.dmg} · BLAST ×${loaded.radius}` : `PAYLOAD: BASIC BOMBS · ${PLANE.baseSalvo} bombs`}</p>
        ${sim.planeOwned ? '<span class="sx-pr own">JET ON CALL</span>' : `<button class="sx-card sx-buy-big ${can ? 'can' : 'cant'}" data-act="buy-plane" style="--c:#9fb7ff">${this.priceTag(false, can, PLANE.price, '')}</button>`}</div></div>
      <h3 class="sx-h">PAYLOAD <small>OWNED JET MISSILES</small></h3>
      <div class="sx-grid wide">${planeMissiles.length ? planeMissiles.map(({ m, i }) => this.missileCard(m, i)).join('') : '<p class="sx-note">No jet missiles yet. Buy some in ORDNANCE: Bunker Buster, Cruise, Hellfire, Ion Lance, Crystal Shard, Reaper.</p>'}</div>`;
  }

  // ── Showcase: the hero with the current loadout ──────────────────
  private drawShowcase = () => {
    const cv = this.canvas; if (!cv) return;
    const box = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(200, Math.round(box.width * dpr)), ch = Math.max(200, Math.round(box.height * dpr));
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    const ctx = cv.getContext('2d')!, W = cv.width, H = cv.height, sim = this.sim, ground = H * .86, U = Math.min(W / 560, H / 560);
    const redraw = () => this.drawShowcase();
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#171127'); bg.addColorStop(.6, '#2a1d3d'); bg.addColorStop(1, '#0f0b19'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(hx0(W), ground - H * .27, 10, hx0(W), ground - H * .27, Math.max(W, H) * .6); glow.addColorStop(0, '#a2f4db2e'); glow.addColorStop(1, '#a2f4db00'); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#c9c6df22'; ctx.lineWidth = 1;
    for (let i = 0; i < 46; i++) { const x = (i * 97 + this.t * 40) % (W + 40) - 20, y = (i * 53 + this.t * 220) % H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 14); ctx.stroke(); }
    const floor = ctx.createLinearGradient(0, ground, 0, H); floor.addColorStop(0, '#3b2b4f'); floor.addColorStop(1, '#120d1d'); ctx.fillStyle = floor; ctx.fillRect(0, ground, W, H - ground);
    ctx.fillStyle = '#a2f4db55'; ctx.fillRect(0, ground, W, 2 * U);
    // jet
    if (sim.planeOwned) { const p = img(PLANE_URL, redraw); if (p.complete && p.naturalWidth) { ctx.globalAlpha = .9; const pw = W * .62; ctx.drawImage(p, W * .3 + Math.sin(this.t) * 6 * U, H * .06, pw, pw * p.naturalHeight / p.naturalWidth); ctx.globalAlpha = 1; } }
    // companions stand in a loose group behind the hero, tallest at the back
    const hx = W * .42, s = Math.min(H * .0068, W / 92);
    const crew = sim.pets.map(p => PETS[p.id]).sort((a, b) => b.height - a.height);
    crew.forEach((def, n) => {
      const im = img(petUrl(def.img), redraw); if (!im.complete || !im.naturalWidth) return;
      const h = def.height * s * .55, w = im.naturalWidth * h / im.naturalHeight, flying = def.id === 'parakeet';
      const cx = W * .05 + (n + .5) * (W * .28 / Math.max(1, crew.length)), row = (n % 2 ? 10 : -4) * U;
      const y = flying ? ground - 230 * U + Math.sin(this.t * 2 + n) * 8 * U : ground + row;
      if (!flying) { ctx.fillStyle = '#0b081266'; ctx.beginPath(); ctx.ellipse(cx, ground + row + 4 * U, w * .42, 6 * U, 0, 0, 7); ctx.fill(); }
      ctx.drawImage(im, cx - w / 2, flying ? y : y - h, w, h);
    });
    // hero
    ctx.fillStyle = '#0b081288'; ctx.beginPath(); ctx.ellipse(hx, ground + 4 * U, 18 * s, 2.6 * s, 0, 0, 7); ctx.fill();
    // the hooded hero sprite (idle frame), feet on the floor; k = canvas px per sprite px
    const hero = img(asset(`player/hero-${IDLE_FRAME}.png`), redraw), k = s * 62 / 136, bob = Math.sin(this.t * 2) * 1.2 * U;
    if (hero.complete && hero.naturalWidth) { ctx.imageSmoothingEnabled = true; ctx.drawImage(hero, hx - HERO_ORIGIN.x * k, ground - HERO_ORIGIN.y * k + bob, hero.naturalWidth * k, hero.naturalHeight * k); }
    const gi = this.preview !== null ? WEAPONS[this.preview].art : WEAPONS[sim.primary].art;
    const gun = img(gunUrl(gi), redraw);
    if (gun.complete && gun.naturalWidth) {
      const len = gunGeometry(gi).length * s, sc = len / gun.naturalWidth;
      ctx.save(); ctx.translate(hx + 40 * k, ground - 56 * k + bob); ctx.rotate(-.06); ctx.drawImage(gun, -gun.naturalWidth * .3 * sc, -gun.naturalHeight * .55 * sc, gun.naturalWidth * sc, gun.naturalHeight * sc); ctx.restore();
    }
    const badge = this.root.querySelector<HTMLElement>('#sx-badge');
    if (badge) badge.textContent = this.preview !== null ? `PREVIEW · ${WEAPONS[this.preview].name}` : `EQUIPPED · ${WEAPONS[sim.primary].name}`;
  };

  /** Gentle idle animation while the shop is open. */
  startAnimation() { cancelAnimationFrame(this.raf); const loop = () => { this.t += .016; this.drawShowcase(); this.raf = requestAnimationFrame(loop); }; loop(); }
  stopAnimation() { cancelAnimationFrame(this.raf); }

  // ── Actions ──────────────────────────────────────────────────────
  private click(e: MouseEvent) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]'); if (!el) return;
    const sim = this.sim, i = Number(el.dataset.i), act = el.dataset.act;
    let ok = true;
    switch (act) {
      case 'close': return this.hooks.close();
      case 'tab': this.tab = el.dataset.tab as Tab; break;
      case 'buy-ammo': ok=sim.buyAmmo();break;
      case 'buy-heal': ok=sim.buyHeal();break;
      case 'buy-mod': ok = sim.buy(i); break;
      case 'toggle-mod': sim.select(i); break;
      case 'buy-missile': ok = sim.buyMissile(i); break;
      case 'equip-gun': sim.equipMissile(i, 'gun'); break;
      case 'equip-jet': sim.equipMissile(i, 'plane'); break;
      case 'buy-pet': if (!sim.petsOwned[i]) ok = sim.buyPet(i); break;
      case 'buy-plane': ok = sim.buyPlane(); break;
      case 'buy-useall': ok = sim.buyUseAll(); break;
    }
    const bought = ok && act?.startsWith('buy');
    if (act !== 'tab' && ok) this.audio.play('unlock');
    this.flash = bought ? (act === 'buy-useall' ? 'useall' : (act === 'buy-mod' ? 'mod' : act === 'buy-missile' ? 'missile' : act === 'buy-pet' ? 'pet' : act ?? '') + (Number.isFinite(i) ? i : '')) : '';
    this.paid = !!bought;
    this.render(); this.hooks.change();
    this.paid = false;
  }
}
