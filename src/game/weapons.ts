/** Mods from this index on are the legendary tier. */
export const BONUS_FROM = 30;

export type Shape = 'bolt' | 'beam' | 'orb' | 'rocket' | 'grenade' | 'saw' | 'fire' | 'nail' | 'blade';

export interface Strike { count: number; spread: number; gap: number; delay: number; r: number; dmg: number; rain?: boolean; }
export interface Sfx { n: number; hz: number; d: number; t: OscillatorType; v: number; }

export interface Weapon {
  id: string; name: string; tag: string;
  /** Mod of the super weapon. Price in $; every installed mod fires together with the rest. */
  price: number; group: string;
  /** Gun artwork number (public/assets/guns) and, for rocket mods, the default missile sprite (1-12). */
  art: number; missile: number;
  rate: number; speed: number; damage: number; pellets: number; spread: number;
  color: number; recoil: number; pierce: number; life: number;
  shape: Shape; size: number; len: number;
  scatter: boolean; ring: boolean; spiral: number; burst: number; burstGap: number; speedVar: number;
  grav: number; bounce: number; rehit: boolean; homing: number;
  explode: number; splash: number; chain: number; chainRange: number; slow: number; knock: number;
  orbit: number; strike: Strike | null; sfx: Sfx;
}

type Spec = Partial<Weapon> & { id: string; name: string; tag: string; rate: number; speed: number; damage: number; color: number };

const DEFAULTS = {
  pellets: 1, spread: 0, recoil: 3, pierce: 1, life: 1.3, shape: 'bolt' as Shape, size: 1, len: 26,
  scatter: false, ring: false, spiral: 0, burst: 1, burstGap: .06, speedVar: 0,
  grav: 0, bounce: 0, rehit: false, homing: 0, explode: 0, splash: 0, chain: 0, chainRange: 240,
  slow: 0, knock: 1.2, orbit: 0, strike: null, missile: 0,
  sfx: { n: 1600, hz: 180, d: .08, t: 'triangle' as OscillatorType, v: 1 },
};

/** Score thresholds, one per weapon, strictly increasing. The final five are the late-game rewards. */
const PRICE_BASE = 25, PRICE_STEP = 2.8;
const GUN_ART = [1, 7, 4, 9, 18, 3, 12, 6, 10, 11, 17, 5, 31, 42, 19, 38, 39, 20, 34, 37, 22, 21, 14, 13, 41, 36, 35, 16, 30, 29, 24, 44, 40, 23, 43];
const LEGENDARY_PRICES = [5000, 7500, 11000, 16000, 24000];
const nice = (v: number) => v < 100 ? Math.round(v / 5) * 5 : v < 1000 ? Math.round(v / 10) * 10 : Math.round(v / 50) * 50;
/** Dollars. The first mod costs a real grind; the curve then steepens, and the legendary tier is a long-run goal. */
const PRICES = Array.from({ length: 35 }, (_, i) => i === 0 ? 0 : i < 30 ? nice(PRICE_BASE + PRICE_STEP * i * i) : LEGENDARY_PRICES[i - 30]);

const SPECS: Spec[] = [
  // ── The original five ─────────────────────────────────────────────
  { id: 'pistol', name: 'SIDEKICK', tag: 'Semi-auto pistol', rate: 3.8, speed: 1100, damage: 38, spread: .012, color: 0xffda91, sfx: { n: 1600, hz: 180, d: .08, t: 'triangle', v: 1 } },
  { id: 'shotgun', name: 'ROOM SERVICE', tag: '8-pellet shotgun', rate: 1.6, speed: 1350, damage: 18, pellets: 8, spread: .24, color: 0xffb78c, recoil: 7, knock: 5, sfx: { n: 800, hz: 95, d: .18, t: 'triangle', v: 1.2 } },
  { id: 'smg', name: 'AFTERHOURS', tag: 'Rapid-fire SMG', rate: 12, speed: 1800, damage: 17, spread: .065, color: 0xff82b2, recoil: 2, sfx: { n: 2200, hz: 230, d: .07, t: 'triangle', v: .8 } },
  { id: 'ak', name: 'AK–47', tag: 'High-velocity rifle', rate: 16, speed: 2600, damage: 24, spread: .035, color: 0xffc46e, pierce: 2, len: 48, sfx: { n: 1300, hz: 145, d: .08, t: 'triangle', v: 1 } },
  { id: 'laser', name: 'LIGHTSPEED', tag: 'Piercing pulse laser', rate: 25, speed: 4200, damage: 20, color: 0x8bfff2, recoil: 1, pierce: 5, shape: 'beam', len: 95, size: 1.6, life: 1, sfx: { n: 0, hz: 950, d: .06, t: 'sine', v: .55 } },
  // ── Street arsenal ────────────────────────────────────────────────
  { id: 'revolver', name: 'BLOCKBUSTER', tag: 'Hand cannon, punches through three', rate: 2.4, speed: 3200, damage: 130, color: 0xffc15e, recoil: 8, pierce: 3, len: 44, size: 1.7, knock: 7, sfx: { n: 900, hz: 80, d: .16, t: 'triangle', v: 1.2 } },
  { id: 'sweeper', name: 'STREET SWEEPER', tag: 'Auto-shotgun', rate: 5, speed: 1500, damage: 16, pellets: 6, spread: .2, color: 0xff9d6e, recoil: 6, knock: 3, sfx: { n: 900, hz: 100, d: .12, t: 'triangle', v: 1.1 } },
  { id: 'fangs', name: 'TWIN FANGS', tag: 'Dual SMGs', rate: 15, speed: 2000, damage: 15, pellets: 2, spread: .05, color: 0xff6f9c, recoil: 2, sfx: { n: 2400, hz: 250, d: .06, t: 'triangle', v: .75 } },
  { id: 'burst', name: 'BURST-O-MATIC', tag: '4-round burst rifle', rate: 3.2, speed: 2800, damage: 30, spread: .03, color: 0xffa54a, pierce: 2, burst: 4, burstGap: .055, len: 40, sfx: { n: 1500, hz: 160, d: .07, t: 'triangle', v: .9 } },
  { id: 'sniper', name: 'LONGWAY', tag: 'Anti-armor sniper', rate: .9, speed: 7000, damage: 300, color: 0xe6f0ff, recoil: 12, pierce: 8, shape: 'beam', len: 170, size: 2.6, life: .6, knock: 10, sfx: { n: 500, hz: 70, d: .28, t: 'sawtooth', v: 1.3 } },
  { id: 'flame', name: 'CINDERMOUTH', tag: 'Flamethrower', rate: 38, speed: 650, damage: 7, spread: .22, scatter: true, speedVar: .3, color: 0xff7a3a, pierce: 4, life: .38, shape: 'fire', recoil: 1, knock: .4, sfx: { n: 700, hz: 110, d: .05, t: 'sawtooth', v: .45 } },
  { id: 'nails', name: 'NAIL RIOT', tag: 'Ricocheting nailgun', rate: 20, speed: 1600, damage: 13, spread: .1, color: 0xc9d3ff, grav: 650, bounce: 2, life: 1.6, shape: 'nail', len: 14, recoil: 1, sfx: { n: 3000, hz: 330, d: .04, t: 'square', v: .35 } },
  { id: 'rocket', name: 'BOOMSTICK', tag: 'Rocket launcher', rate: 1.3, speed: 900, damage: 40, color: 0xff5a4e, shape: 'rocket', size: 1.4, len: 40, life: 2, explode: 125, splash: 90, knock: 6, recoil: 9, missile: 1, sfx: { n: 500, hz: 90, d: .22, t: 'sawtooth', v: 1 } },
  { id: 'grenade', name: 'PINEAPPLE EXPRESS', tag: 'Bouncing grenades', rate: 1.5, speed: 820, damage: 30, color: 0xb6ff6a, grav: 1100, bounce: 2, life: .95, shape: 'grenade', explode: 150, splash: 100, recoil: 5, sfx: { n: 600, hz: 120, d: .12, t: 'triangle', v: .9 } },
  { id: 'arc', name: 'ARC LIGHT', tag: 'Chain lightning', rate: 6, speed: 2600, damage: 24, color: 0x8fb8ff, shape: 'beam', len: 60, size: 1.2, chain: 4, chainRange: 240, sfx: { n: 0, hz: 520, d: .09, t: 'sawtooth', v: .5 } },
  { id: 'seeker', name: 'SEEKER SWARM', tag: 'Homing micro-missiles', rate: 2.6, speed: 700, damage: 22, pellets: 3, spread: .5, color: 0xff89d0, homing: 5.5, explode: 55, splash: 28, life: 2.4, shape: 'rocket', missile: 2, size: .8, len: 22, sfx: { n: 1800, hz: 300, d: .1, t: 'triangle', v: .8 } },
  { id: 'rail', name: 'MEGAWATT', tag: 'Railgun, pierces everything', rate: .75, speed: 9000, damage: 380, color: 0xb8fff6, pierce: 99, shape: 'beam', size: 5, len: 380, life: .45, knock: 14, recoil: 12, sfx: { n: 0, hz: 1400, d: .3, t: 'sine', v: 1 } },
  { id: 'haze', name: 'PURPLE HAZE', tag: 'Plasma orbs', rate: 3, speed: 560, damage: 45, color: 0xb07bff, pierce: 3, shape: 'orb', size: 1.6, life: 2, explode: 70, splash: 32, sfx: { n: 0, hz: 280, d: .14, t: 'sine', v: .8 } },
  { id: 'hail', name: 'HAILSTORM', tag: 'Gatling gun', rate: 28, speed: 2200, damage: 14, spread: .1, color: 0xffe27a, recoil: 2, sfx: { n: 2400, hz: 210, d: .05, t: 'triangle', v: .55 } },
  { id: 'saw', name: 'BUZZSAW', tag: 'Bouncing saw blades', rate: 1.8, speed: 900, damage: 34, color: 0xdfe6ee, pierce: 99, grav: 400, bounce: 7, rehit: true, life: 3, shape: 'saw', size: 1.3, sfx: { n: 2800, hz: 420, d: .12, t: 'sawtooth', v: .5 } },
  { id: 'halo', name: 'HALO', tag: 'Orbiting blades. Always on.', rate: 0, speed: 0, damage: 26, color: 0x7dffd9, orbit: 3, sfx: { n: 0, hz: 0, d: 0, t: 'sine', v: 0 } },
  { id: 'nova', name: 'SHOCKLEY', tag: 'Radial shock ring', rate: .9, speed: 900, damage: 40, pellets: 24, ring: true, color: 0x7ec8ff, pierce: 3, life: .55, knock: 4, sfx: { n: 500, hz: 150, d: .22, t: 'sine', v: .9 } },
  { id: 'spin', name: 'SPIN CYCLE', tag: 'Spiral spray, all around', rate: 14, speed: 1100, damage: 18, pellets: 3, ring: true, spiral: .38, color: 0xff8ff0, life: .9, sfx: { n: 0, hz: 460, d: .05, t: 'square', v: .35 } },
  { id: 'break', name: 'BREAKPOINT', tag: 'Explosive shard cannon', rate: 1.4, speed: 2000, damage: 48, pellets: 5, spread: .2, color: 0xffb26b, pierce: 3, explode: 38, splash: 30, recoil: 8, sfx: { n: 700, hz: 90, d: .18, t: 'triangle', v: 1 } },
  { id: 'dragon', name: "DRAGON'S BREATH", tag: 'Burning shotgun', rate: 2.2, speed: 1100, damage: 14, pellets: 14, spread: .32, scatter: true, speedVar: .35, color: 0xff4b2e, pierce: 2, life: .55, shape: 'fire', size: 1.3, recoil: 6, sfx: { n: 700, hz: 85, d: .2, t: 'sawtooth', v: .9 } },
  { id: 'grinder', name: 'MEAT GRINDER', tag: 'Minigun', rate: 44, speed: 2400, damage: 11, spread: .14, color: 0xff6a5a, recoil: 2, sfx: { n: 2600, hz: 190, d: .04, t: 'triangle', v: .45 } },
  { id: 'frost', name: 'FROSTBITE', tag: 'Slowing ice rounds', rate: 9, speed: 1900, damage: 20, spread: .03, color: 0x9fe9ff, pierce: 2, slow: 1.6, sfx: { n: 2600, hz: 600, d: .07, t: 'sine', v: .55 } },
  { id: 'orbital', name: 'ORBITAL RAIN', tag: 'Airstrike on your cursor', rate: .8, speed: 0, damage: 90, color: 0xffd36a, strike: { count: 5, spread: 130, gap: .16, delay: .55, r: 95, dmg: 90 }, sfx: { n: 500, hz: 700, d: .25, t: 'sine', v: .7 } },
  { id: 'pinball', name: 'HOUSE EDGE', tag: 'Pinball ricochet', rate: 5, speed: 1300, damage: 36, color: 0xff9bf0, pierce: 2, grav: 500, bounce: 6, rehit: true, life: 2.6, shape: 'orb', size: 1, sfx: { n: 0, hz: 620, d: .08, t: 'square', v: .4 } },
  { id: 'katana', name: 'KILOWATT KATANA', tag: 'Wide energy slash', rate: 3, speed: 1500, damage: 70, pellets: 5, spread: .35, color: 0xf6faff, pierce: 99, life: .22, shape: 'blade', size: 2, len: 50, knock: 6, sfx: { n: 3500, hz: 900, d: .12, t: 'sawtooth', v: .6 } },
  // ── Late-game five ────────────────────────────────────────────────
  { id: 'aurora', name: 'AURORA', tag: 'Twin piercing beams', rate: 30, speed: 5000, damage: 30, pellets: 2, spread: .06, color: 0x6dffb0, pierce: 99, shape: 'beam', len: 150, size: 2.4, life: .6, sfx: { n: 0, hz: 1100, d: .05, t: 'sine', v: .45 } },
  { id: 'doom', name: 'DOOMSDAY DEVICE', tag: 'Tactical nuke', rate: .45, speed: 700, damage: 200, color: 0xff3030, shape: 'rocket', size: 2.6, len: 60, life: 2.4, explode: 430, splash: 400, knock: 20, recoil: 16, missile: 3, sfx: { n: 400, hz: 55, d: .5, t: 'sawtooth', v: 1.4 } },
  { id: 'storm', name: 'STORM CALLER', tag: 'Nine-jump lightning', rate: 7, speed: 3200, damage: 55, color: 0xd7b8ff, shape: 'beam', len: 70, size: 1.6, chain: 9, chainRange: 320, sfx: { n: 0, hz: 400, d: .1, t: 'sawtooth', v: .55 } },
  { id: 'sun', name: 'BLACK SUN', tag: 'Collapsing star', rate: .9, speed: 380, damage: 60, color: 0x8b5bff, pierce: 99, life: 3.2, shape: 'orb', size: 3.2, explode: 260, splash: 150, knock: 3, recoil: 10, sfx: { n: 0, hz: 60, d: .4, t: 'sine', v: 1.2 } },
  { id: 'rain', name: 'NEON RAIN', tag: 'The sky opens up', rate: .9, speed: 0, damage: 80, color: 0xff4fd8, strike: { count: 26, spread: 0, gap: .035, delay: .5, r: 75, dmg: 80, rain: true }, sfx: { n: 900, hz: 200, d: .3, t: 'sawtooth', v: 1 } },
];

export const WEAPONS: Weapon[] = SPECS.map((s, i) => {
  const w = { ...DEFAULTS, ...s, price: PRICES[i], group: '', art: GUN_ART[i] } as Weapon;
  // Ascending price tiers guarantee increasing per-hit damage AND sustained output.
  w.damage = Math.round(26 * 1.145 ** i);
  if (w.strike) w.strike = { ...w.strike, dmg: w.damage };
  w.splash = w.explode ? w.damage * 1.25 : 0;
  w.size = Math.min(w.size, 2);
  w.group = i >= BONUS_FROM ? 'LEGENDARY' : w.strike || w.orbit || w.ring ? 'SPECIAL' : w.explode ? 'EXPLOSIVES' : w.chain || w.shape === 'beam' ? 'ENERGY' : w.pellets > 1 ? 'SPREAD' : 'BALLISTIC';
  return w;
});

// Tier power is deliberate: rising per-hit damage, rising sustained DPS,
// without runaway numbers when alternating shotguns and sniper weapons.
for(let i=0;i<WEAPONS.length;i++){
 const w=WEAPONS[i];w.damage=Math.round(26+4*i+4*i**1.5);
 w.pellets=Math.min(8,w.pellets);w.burst=Math.min(3,w.burst);
 if(w.orbit){w.orbit=0;w.shape='blade';w.speed=1500;}
 if(w.strike)w.strike={...w.strike,count:Math.min(8,w.strike.count),dmg:w.damage};
 w.rate=1;const unit=Math.max(1,modDps(w));const target=i===0?99:Math.max(110*1.14**i,modDps(WEAPONS[i-1])*1.12);
 w.rate=Math.max(w.shape==='beam'?12:.25,target/unit);
 if(w.explode)w.splash=w.damage*1.25;
}

export const MOD_GROUPS = ['BALLISTIC', 'SPREAD', 'EXPLOSIVES', 'ENERGY', 'SPECIAL', 'LEGENDARY'];

export function shortMoney(n: number): string {
  return n >= 1000 ? '$' + (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'K' : '$' + n;
}

/** Rough damage per second of one mod, for the shop's stat line. */
export function modDps(w: Weapon): number {
  if (w.orbit) return Math.round(w.damage * w.orbit / .14);
  if (w.strike) return Math.round(w.strike.dmg * w.strike.count * w.rate);
  return Math.round(w.damage * w.pellets * w.burst * w.rate * (w.chain ? 1 + w.chain * .6 : 1) * (w.explode ? 1.6 : 1));
}
