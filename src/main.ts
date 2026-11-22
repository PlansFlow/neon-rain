import Phaser from 'phaser';
import { ABILITY, STREAK, USE_ALL, Simulation } from './game/simulation';
import { asset } from './game/assets';
import { BONUS_FROM, WEAPONS, shortMoney } from './game/weapons';
import { MISSILES, PLANE } from './game/missiles';
import { ShopUI } from './ui/shop';
import { ENEMIES, FINAL_WAVE } from './game/enemies';
import { Sound } from './game/audio';
import { StreetScene } from './phaser/StreetScene';
import './ui/style.css';

const sim = new Simulation(), audio = new Sound(), scene = new StreetScene(sim, audio);
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

// 35 compact tiles. Locked guns stay a mystery until the score reaches them.
$('weapons').innerHTML = WEAPONS.map((w, i) =>
  `<button class="gun locked${i >= BONUS_FROM ? ' legend' : ''}" data-weapon="${i}" style="--c:${hex(w.color)}"><i class="sw"></i><span class="gn">${String(i + 1).padStart(2, '0')}</span><span class="nm"></span></button>`).join('');
const tiles = [...document.querySelectorAll<HTMLButtonElement>('.gun')];

let best = 0; try { best = Number(localStorage.getItem('neon-rain-best')) || 0; } catch { /* storage may be blocked */ }
let lastMode = '', lastSig = '';
const format = (n: number) => String(n).padStart(6, '0');

function renderTiles() {
  tiles.forEach((tile, i) => {
    const w = WEAPONS[i], open = sim.owned[i], on = open && sim.active[i];
    tile.classList.toggle('locked', !open); tile.classList.toggle('on', on); tile.classList.toggle('off', open && !on);
    tile.title = open ? `${w.name} — ${w.tag} (${on ? 'equipped' : 'click to equip'})` : `${w.name}: ${shortMoney(w.price)} in the shop`;
    tile.setAttribute('aria-pressed', String(on)); tile.setAttribute('aria-label', open ? `${i + 1}: ${w.name}, ${on ? 'equipped' : 'owned'}` : `${i + 1}: ${w.name}, not installed, ${w.price} dollars`);
  });
}

function hud() {
  $('score').textContent = format(sim.score);
  if (sim.score > best) { best = sim.score; try { localStorage.setItem('neon-rain-best', String(best)); } catch { /* ignore */ } }
  $('best').textContent = 'BEST ' + format(best);

  const wp = sim.waveProgress, endless = sim.wave > FINAL_WAVE;
  $('wave').textContent = sim.wave === FINAL_WAVE ? 'FINAL WAVE' : 'WAVE ' + String(sim.wave).padStart(2, '0') + (endless ? ' · ENDLESS' : '');
  $('wave-fill').style.width = Math.min(100, wp.into / wp.quota * 100) + '%';
  $('wave-kills').textContent = `${wp.into}/${wp.quota}`;
  $('health-fill').style.width = sim.player.hp + '%'; $('health-label').textContent = sim.player.hp + ' HP';
  // compact combat HUD: wave, alive, kills, HP
  const boss = sim.boss, wp2 = sim.waveProgress;
  $('hw-num').textContent = String(Math.min(sim.wave, 99)).padStart(2, '0');
  $('hud-wave').classList.toggle('final', sim.wave >= FINAL_WAVE && !sim.endless);
  $('hw-fill').style.width = (boss ? boss.hp / boss.maxHp * 100 : Math.min(100, wp2.into / wp2.quota * 100)) + '%';
  $('hw-alive').textContent = String(sim.enemies.length);
  $('hw-kills').textContent = sim.kills.toLocaleString();
  const lull = $('hw-next'); lull.textContent = sim.lull > 0 && sim.mode === 'playing' ? `NEXT WAVE ${Math.ceil(sim.lull)}` : ''; lull.classList.toggle('on', sim.lull > 0);
  const hp = Math.max(0, Math.ceil(sim.player.hp));
  $('jet-fill').style.width = Math.round(sim.jetFuel * 100) + '%'; const jr = $('jet-row'); jr.classList.toggle('on', sim.jetOn); jr.classList.toggle('full', sim.jetFuel >= 1 && !sim.jetOn); jr.classList.toggle('empty', sim.jetFuel <= .02);
  $('hp-now').textContent = String(hp); $('hp-fill').style.width = hp + '%'; $('hp-trail').style.width = hp + '%';
  $('hud-hp').classList.toggle('low', hp <= 30 && hp > 15); $('hud-hp').classList.toggle('critical', hp <= 15);
  $('hp-dash').textContent = sim.player.dashCooldown > 0 ? 'DASH ' + sim.player.dashCooldown.toFixed(1) + 's' : 'DASH READY';
  $('hp-dash').classList.toggle('ready', sim.player.dashCooldown <= 0);
  $('dash-label').textContent = sim.player.dashCooldown > 0 ? 'DASH ' + sim.player.dashCooldown.toFixed(1) + 's' : 'DASH READY';
  const bosses = sim.enemies.filter(e => e.kind === 'titan' || e.kind === 'alien' || e.kind === 'truck' || e.kind === 'applicant');
  $('boss').classList.toggle('hidden', bosses.length === 0);
  $('boss').classList.toggle('final', bosses.some(e => e.kind === 'applicant'));
  if (bosses.length) {
    const final = bosses.find(e => e.kind === 'applicant');
    const top = final ? 'applicant' : bosses.some(e => e.kind === 'truck') ? 'truck' : bosses.some(e => e.kind === 'alien') ? 'alien' : 'titan';
    $('boss-name').textContent = final ? `${ENEMIES.applicant.label}  ·  PHASE ${sim.bossPhase(final)} / 3` : ENEMIES[top].label + (bosses.length > 1 ? ' ×' + bosses.length : '');
    const tracked = final ? [final] : bosses;
    $('boss-fill').style.width = tracked.reduce((a, e) => a + e.hp, 0) / tracked.reduce((a, e) => a + e.maxHp, 0) * 100 + '%';
  }
  // ability bar: grenade, missile, jet. Locked ones say where to unlock them.
  const ab = (id: string, state: string, fill: number, cls: 'ready' | 'cool' | 'locked') => {
    const el = $(id); el.classList.toggle('ready', cls === 'ready'); el.classList.toggle('cool', cls === 'cool'); el.classList.toggle('locked', cls === 'locked');
    $(id === 'air' ? 'air-state' : id + '-state').textContent = state; $(id === 'air' ? 'air-fill' : id + '-fill').style.width = Math.max(0, Math.min(100, fill)) + '%';
  };
  ab('ab-grenade', `${sim.grenades}/${ABILITY.grenadeMax}`, sim.grenades >= ABILITY.grenadeMax ? 100 : sim.grenadeRegen / ABILITY.grenadeRegen * 100, sim.grenades > 0 ? 'ready' : 'cool');
  if (sim.gunAmmo < 0) ab('ab-missile', 'BUY IN ORDNANCE', 0, 'locked');
  else ab('ab-missile', sim.missileCd > 0 ? Math.ceil(sim.missileCd) + 's' : MISSILES[sim.gunAmmo].name, (1 - sim.missileCd / ABILITY.missileCd) * 100, sim.missileReady ? 'ready' : 'cool');
  if (!sim.planeOwned) ab('air', `ARMORY ${shortMoney(PLANE.price)}`, 0, 'locked');
  else ab('air', sim.plane ? 'INBOUND' : sim.planeCd > 0 ? Math.ceil(sim.planeCd) + 's' : 'READY', sim.plane ? 100 : (1 - sim.planeCd / PLANE.cooldown) * 100, sim.planeReady ? 'ready' : 'cool');
  $('ab-useall').classList.toggle('hidden', !sim.allWeaponsOwned && !sim.useAllOwned);
  if (!sim.useAllOwned) ab('ab-useall', `ARMORY ${shortMoney(USE_ALL.price)}`, 0, 'locked');
  else ab('ab-useall', sim.useAll > 0 ? 'FIRING ' + Math.ceil(sim.useAll) + 's' : sim.useAllCd > 0 ? Math.ceil(sim.useAllCd) + 's' : 'READY', sim.useAll > 0 ? sim.useAll / USE_ALL.duration * 100 : (1 - sim.useAllCd / USE_ALL.cooldown) * 100, sim.useAllReady || sim.useAll > 0 ? 'ready' : 'cool');
  $('streak').textContent = sim.overdrive > 0 ? `OVERDRIVE ${Math.ceil(sim.overdrive)}s` : sim.streak >= 10 ? `STREAK ${sim.streak} · ${Math.max(0, STREAK.overdriveAt - sim.streak) || 'MAX'}${sim.streak < STREAK.overdriveAt ? ' TO OVERDRIVE' : ''}` : '';
  $('streak').classList.toggle('od', sim.overdrive > 0);
  $('danger').classList.toggle('on', sim.mode === 'playing' && sim.player.hp <= 30);
  $('combo').textContent = sim.combo > 1 ? `${sim.combo} CHAIN / ×${sim.multiplier}` : '';

  $('cash').textContent = '$' + sim.cash.toLocaleString();
  const w=WEAPONS[sim.primary],heat=sim.heat[sim.primary],ammo=sim.ammo[sim.primary];
  $('ammo-number').textContent=sim.energyWeapon?(sim.overheated[sim.primary]?'COOLING':Math.round(heat)+'%'):String(ammo).padStart(3,'0');
  $('ammo-kind').textContent=sim.energyWeapon?'HEAT / AUTO COOL':'ROUNDS / 150';
  $('ammo-bar').style.width=(sim.energyWeapon?heat:ammo/150*100)+'%';
  $('ammo-readout').classList.toggle('low',sim.energyWeapon?sim.overheated[sim.primary]:ammo<15);
  $('equipped-name').textContent=w.name;
  $('objective').textContent='ELIMINATE '+Math.max(0,wp.quota-wp.into)+' HOSTILES TO ADVANCE';
  const sig = sim.owned.map(Number).join('') + ':' + sim.active.map(Number).join('');
  if (sig !== lastSig) {
    lastSig = sig; renderTiles();
    $('arsenal-count').textContent = `${String(sim.ownedCount).padStart(2, '0')} / ${WEAPONS.length}`;
    $('stack').textContent = `EQUIPPED · ${WEAPONS[sim.primary].name}`; $('stack').classList.toggle('hot', sim.activeCount >= 10);
  }
  const nextIdx = sim.nextMod, next = nextIdx === null ? null : WEAPONS[nextIdx];
  if (next) {
    $('next-label').textContent = `NEXT WEAPON: ${next.name} ${shortMoney(next.price)}`;
    $('next-fill').style.width = Math.min(100, sim.cash / next.price * 100) + '%';
    $('shop-btn').classList.toggle('afford', sim.cash >= next.price);
  } else { $('next-label').textContent = 'ARSENAL COMPLETE'; $('next-fill').style.width = '100%'; $('shop-btn').classList.remove('afford'); }

  if (lastMode !== sim.mode) {
    lastMode = sim.mode; $('stage').className = sim.mode;
    $('overlay').classList.toggle('hidden', sim.mode === 'playing' || sim.mode === 'won' || shopOpen);
    $('pause').textContent = sim.mode === 'paused' ? '▶' : 'Ⅱ'; $('pause').setAttribute('aria-label', sim.mode === 'paused' ? 'Resume game' : 'Pause game');
    if (sim.mode === 'paused') {
      $('overline').textContent = 'TAKE A BREATHER'; $('headline').innerHTML = 'RAIN<br/><em>CHECK.</em>'; $('message').textContent = 'Your street will be right here.';
      $('start').innerHTML = 'BACK TO IT <span>↵</span>'; $('intro-hint').textContent = 'ESC TO RESUME';
    } else if (sim.mode === 'over') {
      $('overline').textContent = 'ONE MORE RUN?'; $('headline').innerHTML = 'NICE<br/><em>RUN.</em>';
      $('message').textContent = `${format(sim.score)} POINTS · ${sim.kills} ELIMINATED · WAVE ${sim.wave} · ${sim.ownedCount}/${WEAPONS.length} MODS`;
      $('start').innerHTML = 'RUN IT BACK <span>↵</span>'; $('intro-hint').textContent = 'ONE WEAPON. YOUR COMPANIONS. ONE MORE RUN.';
    }
    if (sim.mode === 'won') showEnding(); else $('ending').classList.add('hidden');
  }
}

let toastTimer = 0;
function toast(title: string, sub = '', kind = 'wave') {
  const el = $('toast');
  el.className = ''; void el.offsetWidth;
  el.innerHTML = `<b>${title}</b><span>${sub}</span>`; el.className = 'show ' + kind;
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => { el.className = ''; }, 2200);
}
scene.onToast = toast;


// ── The Rainmaker shop (see ui/shop.ts) ───────────────────────────────
let shopOpen = false, resumeAfterShop = false;
const shop = $('shop');
const shopUI = new ShopUI(shop, sim, audio, { close: () => closeShop(), change: () => { lastSig = ''; hud(); } });

function openShop() {
  if (shopOpen || (sim.mode !== 'playing' && sim.mode !== 'paused')) return;
  resumeAfterShop = sim.mode === 'playing'; sim.mode = 'paused'; shopOpen = true;
  shop.classList.remove('hidden'); shopUI.render();(shop.querySelector('[data-act=close]') as HTMLElement)?.focus(); shopUI.startAnimation(); hud();
}
function closeShop(resume = true) {
  if (!shopOpen) return;
  shopOpen = false; shop.classList.add('hidden');$('shop-btn').focus(); shopUI.stopAnimation();
  if (resume && resumeAfterShop) sim.mode = 'playing';
  lastMode = ''; hud();
}
function toggleShop() { if (shopOpen) closeShop(); else openShop(); }

// ── Abilities: keys (any layout) and the clickable ability buttons share one path with clear feedback ──
type Ability = 'plane' | 'grenade' | 'missile' | 'useAll';
const ABILITY_NAME: Record<Ability, string> = { plane: 'AIRSTRIKE', grenade: 'GRENADE', missile: 'MISSILE', useAll: 'USE ALL' };
let hintAt = 0;
function hint(title: string, sub: string) { const t = performance.now(); if (t - hintAt < 900) return; hintAt = t; toast(title, sub, 'unlock'); }
/** Explains why an ability can't fire right now; returns true when it can. */
function abilityCheck(kind: Ability, fromClick: boolean): boolean {
  if (sim.mode !== 'playing') return false;
  const locked = kind === 'plane' ? !sim.planeOwned : kind === 'missile' ? sim.gunAmmo < 0 : kind === 'useAll' ? !sim.useAllOwned : false;
  if (locked) {
    const where = kind === 'plane' ? 'AIRSTRIKE' : kind === 'missile' ? 'ORDNANCE' : 'ARMORY';
    const price = kind === 'plane' ? ' · ' + shortMoney(PLANE.price) : kind === 'useAll' ? ' · ' + shortMoney(USE_ALL.price) : '';
    if (fromClick) { shopUI.tab = kind === 'plane' ? 'air' : kind === 'missile' ? 'ammo' : 'armory'; openShop(); }
    else hint(`${ABILITY_NAME[kind]} LOCKED`, `BUY IT IN THE ARMORY → ${where} TAB${price}   ·   RIGHT-CLICK / E`);
    return false;
  }
  const wait = kind === 'plane' ? (sim.plane ? -1 : sim.planeCd) : kind === 'missile' ? sim.missileCd : kind === 'useAll' ? (sim.useAll > 0 ? -1 : sim.useAllCd) : (sim.grenades > 0 ? 0 : ABILITY.grenadeRegen - sim.grenadeRegen);
  if (wait !== 0) { hint(`${ABILITY_NAME[kind]} ${wait < 0 ? 'ALREADY ACTIVE' : 'RECHARGING'}`, wait < 0 ? '' : `READY IN ${Math.ceil(wait)}s`); return false; }
  return true;
}
document.querySelectorAll<HTMLButtonElement>('[data-ability]').forEach(b => {
  b.addEventListener('pointerdown', e => e.preventDefault()); // keep focus (and Space = jump) on the game
  b.addEventListener('click', () => { const k = b.dataset.ability as Ability; audio.unlock(); if (abilityCheck(k, true)) scene.trigger(k); b.blur(); });
});
// Right click anywhere on the stage opens the Armory straight away (and closes it again); no browser menu.
$('stage').addEventListener('contextmenu', e => { e.preventDefault(); toggleShop(); });

// ── Wave 50 finale: the plot twist ───────────────────────────────────
const ENDING: { k: string; t: string; p: string; img?: string; stamp?: boolean }[] = [
  { k: 'WAVE 50 · CLEARED', t: 'THE LAST PAGE FALLS.', p: 'It drifts down through the rain and lands at your feet, face up. It is not a weapon. It never was. It is a form, filled in by hand.' },
  { k: 'POSITION APPLIED FOR', t: '“SOMEONE ON YOUR SIDE.”', p: 'Experience: fifty waves of trying to reach you. Every runner, every drone, every rumbling truck, every carrier in the clouds was carrying a copy. The whole city was a queue, and you kept turning it away.' },
  { k: 'REFERENCES', t: 'THE RAIN.', p: 'Under “why do you want this job” there is one line: “Nobody should hold the street alone.” The rain over East District thins, then stops. Somewhere behind the towers, the sun is coming up.', img: 'applicant-4' },
  { k: 'YOUR DECISION', t: 'HIRED.', p: 'You sign it. The page uncurls, blinks, and smiles. For the first time since wave one, the hero of NEON RAIN has a colleague.', img: 'applicant-1', stamp: true },
];
let endingStep = 0;
function showEnding() { endingStep = 0; renderEnding(); $('ending').classList.remove('hidden'); }
function renderEnding() {
  const el = $('ending');
  if (endingStep < ENDING.length) {
    const s = ENDING[endingStep];
    el.innerHTML = `<div class="end-card">${s.img ? `<div class="end-art"><img src="${asset('final/' + s.img + '.png')}" alt=""/>${s.stamp ? '<span class="end-stamp">HIRED</span>' : ''}</div>` : ''}<span class="eyebrow">${s.k}</span><h2>${s.t}</h2><p>${s.p}</p><button class="primary" data-end="next">CONTINUE <span>↵</span></button></div>`;
  } else {
    el.innerHTML = `<div class="end-card"><span class="eyebrow">THE END</span><h2>NEON RAIN</h2><p>${format(sim.score)} POINTS · ${sim.kills.toLocaleString()} ELIMINATED · ${sim.ownedCount}/${WEAPONS.length} WEAPONS</p><p class="end-note">Your new colleague is waiting by the curb.</p><div class="end-actions"><button class="primary" data-end="endless">KEEP FIGHTING, TOGETHER <span>ENDLESS</span></button><button class="secondary" data-end="new">NEW RUN</button></div></div>`;
  }
  el.querySelector<HTMLButtonElement>('button')?.focus();
}

function start() {
  audio.unlock();
  if (sim.mode === 'ready') { sim.start(); window.setTimeout(() => toast('HOLD SPACE · JETPACK   ·   G · GRENADE', 'F · MISSILE   ·   Q · AIRSTRIKE   ·   E / RIGHT-CLICK · ARMORY', 'unlock'), 1200); } else if (sim.mode === 'over') { closeShop(false); sim.restart(); lastSig = ''; } else if (sim.mode === 'paused') sim.mode = 'playing';
  else if (sim.mode === 'won') { if (endingStep < ENDING.length) { endingStep++; renderEnding(); return; } }
  $('start').blur(); hud();
}
function pause() { if (sim.mode === 'playing') sim.mode = 'paused'; else if (sim.mode === 'paused') sim.mode = 'playing'; hud(); }

$('start').addEventListener('click', start);
$('play').addEventListener('click', () => { start(); $('play').blur(); });
$('ending').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-end]'); if (!b) return;
  if (b.dataset.end === 'next') { endingStep++; renderEnding(); }
  else if (b.dataset.end === 'endless') { sim.endless = true; sim.hired = true; sim.finale = false; sim.ally.x = sim.player.x - 110; sim.mode = 'playing'; hud(); toast('ENDLESS', 'YOUR NEW COLLEAGUE FIGHTS AT YOUR SIDE', 'legend'); }
  else { closeShop(false); sim.restart(); lastSig = ''; hud(); }
});
$('shop-btn').addEventListener('click', () => { toggleShop(); $('shop-btn').blur(); });
$('pause').addEventListener('click', () => { pause(); $('pause').blur(); });
// Full screen: the whole app (stage + shop + overlays) goes full screen; hidden where the browser can't do it (iPhone Safari).
const fsDoc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void>; webkitFullscreenEnabled?: boolean };
const fsRoot = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
const fsOn = () => !!(document.fullscreenElement || fsDoc.webkitFullscreenElement);
async function toggleFullscreen() {
  try {
    if (fsOn()) await (document.exitFullscreen ? document.exitFullscreen() : fsDoc.webkitExitFullscreen?.());
    else {
      await (fsRoot.requestFullscreen ? fsRoot.requestFullscreen({ navigationUI: 'hide' }) : fsRoot.webkitRequestFullscreen?.());
      try { await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'); } catch { /* desktop / unsupported */ }
    }
  } catch { toast('FULL SCREEN BLOCKED BY BROWSER'); }
}
function syncFullscreen() {
  const on = fsOn();
  for (const id of ['fullscreen', 'home-fullscreen']) { const b = $(id); b.classList.toggle('on', on); b.setAttribute('aria-label', on ? 'Exit full screen' : 'Enter full screen'); b.title = on ? 'Exit full screen (V)' : 'Full screen (V)'; }
  const label = $('home-fullscreen').querySelector('span'); if (label) label.textContent = on ? 'EXIT FULL SCREEN' : 'FULL SCREEN';
}
if (!(document.fullscreenEnabled || fsDoc.webkitFullscreenEnabled)) for (const id of ['fullscreen', 'home-fullscreen']) $(id).hidden = true;
for (const id of ['fullscreen', 'home-fullscreen']) $(id).addEventListener('click', () => { void toggleFullscreen(); $(id).blur(); });
document.addEventListener('fullscreenchange', syncFullscreen); document.addEventListener('webkitfullscreenchange', syncFullscreen);
$('sound').addEventListener('click', () => {
  audio.unlock(); audio.enabled = !audio.enabled;
  $('sound').textContent = audio.enabled ? 'SOUND ON' : 'SOUND OFF'; $('sound').setAttribute('aria-label', audio.enabled ? 'Mute sound' : 'Enable sound'); $('sound').blur();
});
$('weapons').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-weapon]');
  if (!b) return;
  const i = Number(b.dataset.weapon); b.blur();
  if (sim.owned[i]) { sim.select(i); lastSig = ''; hud(); } else openShop();
});
window.addEventListener('keydown', e => {
  if(e.repeat)return;
  if(shopOpen&&e.key==='Tab'){const els=[...shop.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]')];const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}return;}
  if(shopOpen&&!['KeyE','KeyB','Escape'].includes(e.code)&&e.key!=='Escape')return;
  // the scene reads held keys itself; here we only explain locked / recharging abilities
  const abilityKey = ({ KeyQ: 'plane', KeyF: 'missile', KeyX: 'useAll', KeyG: 'grenade' } as Record<string, Ability>)[e.code];
  if (abilityKey && !shopOpen) abilityCheck(abilityKey, false);
  if (/^Digit[0-9]$/.test(e.code)) { const d = e.code.slice(5); sim.select(d === '0' ? 9 : Number(d) - 1); lastSig = ''; hud(); }
  if (e.code === 'KeyE') { e.preventDefault();toggleShop(); }
  if (e.code === 'KeyB') toggleShop();
  if (e.key === 'Escape') { if (shopOpen) closeShop(); else pause(); }
  if (e.key === 'Enter' && sim.mode !== 'playing' && !shopOpen) { e.preventDefault(); start(); }
  if (e.code === 'KeyM') $('sound').click();
  if (e.code === 'KeyV') void toggleFullscreen();
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-control]')) {
  const control = button.dataset.control as keyof typeof scene.touch;
  button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); scene.touch[control] = true; audio.unlock(); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => { scene.touch[control] = false; });
}
document.addEventListener('visibilitychange', () => { if (document.hidden && sim.mode === 'playing' && !shopOpen) { sim.mode = 'paused'; hud(); } });

$('stage').appendChild($('ammo-readout'));
scene.onHud = hud; hud();
new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: 1440, height: 810, backgroundColor: '#20192f',
  render: { antialias: true, pixelArt: false, roundPixels: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  fps: { target: 120, smoothStep: true }, scene: [scene], audio: { noAudio: true }, input: { activePointers: 3 },
});
// Explicit opt-in introspection for local smoke tests; absent in production.
if (import.meta.env.DEV) (window as unknown as { __neon: { sim: Simulation; scene: StreetScene } }).__neon = { sim, scene };
