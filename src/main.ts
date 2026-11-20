import Phaser from 'phaser';
import { Simulation } from './game/simulation';
import { BONUS_FROM, WEAPONS, shortMoney } from './game/weapons';
import { PLANE } from './game/missiles';
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
  $('dash-label').textContent = sim.player.dashCooldown > 0 ? 'DASH ' + sim.player.dashCooldown.toFixed(1) + 's' : 'DASH READY';
  const bosses = sim.enemies.filter(e => e.kind === 'titan' || e.kind === 'alien');
  $('boss').classList.toggle('hidden', bosses.length === 0);
  if (bosses.length) {
    $('boss-name').textContent = ENEMIES[bosses.some(e => e.kind === 'alien') ? 'alien' : 'titan'].label + (bosses.length > 1 ? ' ×' + bosses.length : '');
    $('boss-fill').style.width = bosses.reduce((a, e) => a + e.hp, 0) / bosses.reduce((a, e) => a + e.maxHp, 0) * 100 + '%';
  }
  $('air').classList.toggle('hidden', !sim.planeOwned);
  if (sim.planeOwned) {
    $('air-state').textContent = sim.plane ? 'INBOUND' : sim.planeCd > 0 ? Math.ceil(sim.planeCd) + 's' : 'READY';
    $('air-fill').style.width = (sim.plane ? 100 : (1 - sim.planeCd / PLANE.cooldown) * 100) + '%';
    $('air').classList.toggle('ready', sim.planeReady);
  }
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
    $('overlay').classList.toggle('hidden', sim.mode === 'playing' || shopOpen);
    $('pause').textContent = sim.mode === 'paused' ? '▶' : 'Ⅱ'; $('pause').setAttribute('aria-label', sim.mode === 'paused' ? 'Resume game' : 'Pause game');
    if (sim.mode === 'paused') {
      $('overline').textContent = 'TAKE A BREATHER'; $('headline').innerHTML = 'RAIN<br/><em>CHECK.</em>'; $('message').textContent = 'Your street will be right here.';
      $('start').innerHTML = 'BACK TO IT <span>↵</span>'; $('intro-hint').textContent = 'ESC TO RESUME';
    } else if (sim.mode === 'over') {
      $('overline').textContent = 'ONE MORE RUN?'; $('headline').innerHTML = 'NICE<br/><em>RUN.</em>';
      $('message').textContent = `${format(sim.score)} POINTS · ${sim.kills} ELIMINATED · WAVE ${sim.wave} · ${sim.ownedCount}/${WEAPONS.length} MODS`;
      $('start').innerHTML = 'RUN IT BACK <span>↵</span>'; $('intro-hint').textContent = 'ONE WEAPON. YOUR COMPANIONS. ONE MORE RUN.';
    }
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

function start() {
  audio.unlock();
  if (sim.mode === 'ready') sim.start(); else if (sim.mode === 'over') { closeShop(false); sim.restart(); lastSig = ''; } else if (sim.mode === 'paused') sim.mode = 'playing';
  $('start').blur(); hud();
}
function pause() { if (sim.mode === 'playing') sim.mode = 'paused'; else if (sim.mode === 'paused') sim.mode = 'playing'; hud(); }

$('start').addEventListener('click', start);
$('shop-btn').addEventListener('click', () => { toggleShop(); $('shop-btn').blur(); });
$('pause').addEventListener('click', () => { pause(); $('pause').blur(); });
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
  if(shopOpen&&!['e','b','Escape'].includes(e.key))return;
  if (/^[0-9]$/.test(e.key)) { sim.select(e.key === '0' ? 9 : Number(e.key) - 1); lastSig = ''; hud(); }
  if (e.key.toLowerCase() === 'e') { e.preventDefault();toggleShop(); }
  if (e.key.toLowerCase() === 'b') toggleShop();
  if (e.key === 'Escape') { if (shopOpen) closeShop(); else pause(); }
  if (e.key === 'Enter' && sim.mode !== 'playing' && !shopOpen) { e.preventDefault(); start(); }
  if (e.key.toLowerCase() === 'm') $('sound').click();
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-control]')) {
  const control = button.dataset.control as keyof typeof scene.touch;
  button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); scene.touch[control] = true; audio.unlock(); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => { scene.touch[control] = false; });
}
document.addEventListener('visibilitychange', () => { if (document.hidden && sim.mode === 'playing' && !shopOpen) { sim.mode = 'paused'; hud(); } });

scene.onHud = hud; hud();
new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: 1440, height: 810, backgroundColor: '#20192f',
  render: { antialias: true, pixelArt: false, roundPixels: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  fps: { target: 120, smoothStep: true }, scene: [scene], audio: { noAudio: true }, input: { activePointers: 3 },
});
// Explicit opt-in introspection for local smoke tests; absent in production.
if (import.meta.env.DEV) (window as unknown as { __neon: { sim: Simulation; scene: StreetScene } }).__neon = { sim, scene };
