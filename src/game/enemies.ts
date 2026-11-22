export type EnemyKind =
  | 'runner' | 'heavy' | 'drone' | 'sprinter' | 'spitter' | 'leaper'
  | 'bomber' | 'splitter' | 'armored' | 'titan' | 'mini' | 'alien' | 'truck' | 'applicant';

export interface EnemyDef {
  label: string;
  hp: number; speed: number; dmg: number; pts: number;
  /** Dollars paid for the kill (scaled up a little with the wave). */
  cash: number;
  /** Visual scale; hitbox derives from it. */
  s: number; w: number; h: number; top: number;
  /** First wave this kind can appear in, and its spawn weight. */
  min: number; weight: number;
  fly?: boolean; armor?: number;
  coat: number; skin: number; leg: number; accent: number;
}

const ground = (s: number) => ({ s, w: 30 * s, h: 57 * s, top: -57 * s });

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  runner:   { label: 'RUNNER',   hp: 65,   speed: 92,  dmg: 12, pts: 100, cash: 1,  ...ground(1),    min: 1, weight: 10, coat: 0x473d56, skin: 0x97829e, leg: 0x2a273d, accent: 0xf17aa5 },
  heavy:    { label: 'HEAVY',    hp: 150,  speed: 42,  dmg: 20, pts: 150, cash: 3,  ...ground(1.24), min: 1, weight: 2,  coat: 0x5b3550, skin: 0x8c6d86, leg: 0x2a2036, accent: 0xff6d8e },
  drone:    { label: 'DRONE',    hp: 45,   speed: 70,  dmg: 12, pts: 125, cash: 2,  s: 1, w: 30, h: 35, top: -22, min: 2, weight: 2.2, fly: true, coat: 0x1c1a2b, skin: 0x685778, leg: 0, accent: 0xff729d },
  sprinter: { label: 'SPRINTER', hp: 38,   speed: 150, dmg: 9,  pts: 120, cash: 1,  ...ground(.85),  min: 1, weight: 2,  coat: 0x2f5a5c, skin: 0x8fb5ad, leg: 0x1d3438, accent: 0x7dffd9 },
  spitter:  { label: 'SPITTER',  hp: 55,   speed: 55,  dmg: 8,  pts: 160, cash: 3,  ...ground(1),    min: 3, weight: 1.8, coat: 0x41563a, skin: 0x9bb184, leg: 0x232f26, accent: 0xb6ff6a },
  leaper:   { label: 'LEAPER',   hp: 70,   speed: 70,  dmg: 14, pts: 140, cash: 2,  ...ground(.95),  min: 3, weight: 2,  coat: 0x6a4a2e, skin: 0xb48d6b, leg: 0x3a2a1c, accent: 0xffb35a },
  bomber:   { label: 'BOMBER',   hp: 40,   speed: 95,  dmg: 25, pts: 130, cash: 2,  ...ground(.9),   min: 4, weight: 1.6, coat: 0x5d2a2a, skin: 0xb27c78, leg: 0x2c1a1a, accent: 0xff4040 },
  splitter: { label: 'SPLITTER', hp: 120,  speed: 55,  dmg: 14, pts: 160, cash: 3,  ...ground(1.15), min: 4, weight: 1.6, coat: 0x3f3a6e, skin: 0x8f88c2, leg: 0x232048, accent: 0xb59bff },
  armored:  { label: 'ARMORED',  hp: 210,  speed: 46,  dmg: 16, pts: 220, cash: 5,  ...ground(1.1),  min: 5, weight: 1.4, armor: 12, coat: 0x4c566e, skin: 0x8e97ad, leg: 0x2a3045, accent: 0x9fd2ff },
  titan:    { label: 'TITAN',    hp: 1600, speed: 36,  dmg: 32, pts: 1500, cash: 50, ...ground(2),    min: 99, weight: 0, armor: 6, coat: 0x6a2d4a, skin: 0xa8728f, leg: 0x2a1626, accent: 0xff3f7f },
  alien:    { label: 'ALIEN CARRIER', hp: 6000, speed: 70, dmg: 30, pts: 6000, cash: 150, s: 1, w: 320, h: 150, top: -75, min: 99, weight: 0, fly: true, armor: 8, coat: 0x4b3a5e, skin: 0x7a5d8a, leg: 0, accent: 0x62f0ff },
  truck:    { label: 'GARBAGE TRUCK', hp: 9000, speed: 0, dmg: 30, pts: 12000, cash: 300, s: 1, w: 290, h: 120, top: -122, min: 99, weight: 0, armor: 10, coat: 0x4a5340, skin: 0x6b7560, leg: 0, accent: 0xffb35a },
  applicant:{ label: 'THE APPLICATION', hp: 30000, speed: 0, dmg: 22, pts: 50000, cash: 1000, s: 1, w: 150, h: 222, top: -226, min: 99, weight: 0, coat: 0xf3e2d8, skin: 0x6e8378, leg: 0, accent: 0xff4d5e },
  mini:     { label: 'MINI',     hp: 22,   speed: 130, dmg: 6,  pts: 40, cash: 1,   ...ground(.6),   min: 99, weight: 0, coat: 0x5a4f8a, skin: 0xa59ad6, leg: 0x2a2548, accent: 0xb59bff },
};

/** Titans that roll in at the start of a wave. */
export const TITAN_WAVES: Record<number, number> = { 4: 1, 6: 1, 7: 1, 8: 2, 9: 2, 10: 2, 13: 2, 17: 3, 22: 3, 27: 3, 33: 3, 38: 3, 43: 4, 48: 4 };

/** Alien carriers that drop in at the start of a wave. */
export const ALIEN_WAVES: Record<number, number> = { 5: 1, 8: 1, 15: 1, 25: 2, 35: 2, 45: 3 };
/** The garbage truck super-boss: end of every act, and the finale on wave 50. */
export const TRUCK_WAVES: Record<number, number> = { 10: 1, 20: 1, 30: 1, 40: 2, 48: 1 };

/** Kills required to clear each of the ten waves. After wave 10 the game goes endless. */
/** Kills required to clear each of the fifty waves. Wave 50 is the finale; after it the game can go endless. */
/** Kills per wave. Past wave 10 the count grows slowly (and caps at 160): late waves get harder through tougher enemies, not endless bodies. */
export const WAVE_QUOTA = [12, 18, 24, 30, 36, 42, 50, 60, 70, 85, ...Array.from({ length: 40 }, (_, k) => Math.min(160, 85 + (k + 1) * 3))];
export const FINAL_WAVE = WAVE_QUOTA.length;
const ENDLESS_STEP = 600;

export function waveInfo(kills: number): { wave: number; into: number; quota: number } {
  let acc = 0;
  for (let i = 0; i < WAVE_QUOTA.length; i++) {
    if (kills < acc + WAVE_QUOTA[i]) return { wave: i + 1, into: kills - acc, quota: WAVE_QUOTA[i] };
    acc += WAVE_QUOTA[i];
  }
  const extra = kills - acc;
  return { wave: FINAL_WAVE + 1 + Math.floor(extra / ENDLESS_STEP), into: extra % ENDLESS_STEP, quota: ENDLESS_STEP };
}

/** The run starts almost on top of the hero and the camera pulls back slowly: the extreme zoom-out only arrives on the final wave. */
const ZOOMS = [1.35, 1.3, 1.25, 1.2, 1.15, 1.1, 1.05, 1, .95, .9];
export function zoomFor(wave: number): number {
  if (wave <= ZOOMS.length) return ZOOMS[Math.max(1, wave) - 1];
  // the long pull-back: from 0.9 at wave 10 to the extreme 0.42 by wave 45
  return Math.max(.42, ZOOMS[ZOOMS.length - 1] - (wave - ZOOMS.length) * (.48 / 35));
}

/** Seconds between spawn groups, and how many enemies come per group. Slow and small early, a flood late. */
export const spawnGap = (wave: number) => Math.max(.28, 1.45 - wave * .115);
export const spawnGroup = (wave: number) => Math.min(6, 1 + Math.floor(wave / 3));
/**
 * Waves breathe. Each wave sends only the enemies it needs, in surges (a few groups, then a short pause), and after the
 * last kill there is a breather before the next wave starts. Late waves get a slightly longer breather.
 */
export const surgeSize = (wave: number) => spawnGroup(wave) * (wave < 10 ? 6 : 7);
export const surgePause = (wave: number) => wave < 6 ? .6 : Math.min(2.4, 1.2 + wave * .03);
export const breather = (wave: number) => wave <= 2 ? 1.5 : Math.min(6, 2.5 + wave * .08);
/** Kill payout grows gently with the wave. */
export const cashFor = (kind: EnemyKind, wave: number) => Math.max(1, Math.round(ENEMIES[kind].cash * 4 * (1 + .65 * (Math.min(wave, 16) - 1) + .3 * Math.max(0, Math.min(wave, 60) - 16))));

/** Most enemies alive at once: the late game is about tougher enemies, not an unreadable wall of 250 bodies. */
export const maxEnemies = (wave: number) => Math.min(90, 22 + (Math.min(wave, 12) - 1) * 6);

/** Enemy health grows geometrically with the wave so late waves stay hard even with a full arsenal. */
/** Every wave adds health on top of the last: gentle early, a real wall by the final waves. */
export const TUNING = { base: 1, early: 1.24, late: 1.32, arsenalBonus: .02 };
export const hpMultiplier = (wave: number) => {
  const w = Math.min(wave, 60) - 1;
  // steep through the first act, then a steady climb so wave 50 is a wall even with everything bought
  return TUNING.base * TUNING.early ** Math.min(w, 5) * TUNING.late ** Math.max(0, Math.min(w, 9) - 5) * 1.1 ** Math.max(0, Math.min(w, 29) - 9) * 1.07 ** Math.max(0, w - 29);
};

/**
 * Weak points for headshots, as fractions of each hitbox (0 = top / left edge). `front` regions are measured
 * from the side facing the hero, `back` from the side facing away; plain x0/x1 are absolute. Kinds missing here have
 * no weak point. Explosions, chains, orbit blades and pets never crit: only bullets do.
 */
export interface WeakPoint { y0: number; y1: number; x0?: number; x1?: number; side?: 'front' | 'back'; }
const HUMANOID: WeakPoint = { y0: 0, y1: .3 };
export const WEAK_POINTS: Partial<Record<EnemyKind, WeakPoint>> = {
  runner: HUMANOID, heavy: HUMANOID, sprinter: HUMANOID, spitter: HUMANOID, leaper: HUMANOID, bomber: HUMANOID,
  splitter: HUMANOID, armored: { y0: 0, y1: .26 }, titan: { y0: 0, y1: .28 }, mini: HUMANOID,
  drone: { y0: .25, y1: .6, x0: .2, x1: .8 },
  alien: { y0: 0, y1: 1, x0: 0, x1: .3, side: 'front' },
  truck: { y0: 0, y1: .5, x0: .68, x1: 1, side: 'back' },
  applicant: { y0: .27, y1: .5, x0: .2, x1: .8 },
};
export const CRIT_MULT = 2;
