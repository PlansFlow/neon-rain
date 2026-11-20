/**
 * Missile types. Every type can be bought once in the shop. Types marked `gun` upgrade the rocket-type
 * mods (Boomstick, Seeker Swarm, Doomsday); types marked `plane` become the payload of the airstrike.
 * `both` can fill either slot.
 */
export type MissileUse = 'gun' | 'plane' | 'both';
export interface Missile {
  id: string; name: string; tag: string; price: number; use: MissileUse;
  /** Sprite number, public/assets/missiles/missile-N.png. */
  img: number; color: number;
  /** Multipliers over the base rocket / bomb. */
  dmg: number; radius: number; speed: number;
  /** Extra homing turn rate, extra piercing, slow seconds applied on hit. */
  homing: number; pierce: number; slow: number;
  /** Bombs dropped per airstrike sortie when used as payload. */
  salvo: number;
}

const m = (img: number, id: string, name: string, tag: string, price: number, use: MissileUse, color: number, o: Partial<Missile>): Missile =>
  ({ id, name, tag, price, use, img, color, dmg: 1, radius: 1, speed: 1, homing: 0, pierce: 0, slow: 0, salvo: 0, ...o });

export const MISSILES: Missile[] = [
  m(1, 'stinger', 'STINGER', 'Light dart rocket', 60, 'gun', 0xc9d0d8, { dmg: 1.15, speed: 1.2 }),
  m(2, 'hornet', 'HORNET', 'Light seeker', 150, 'gun', 0xd8c9a0, { dmg: 1.3, homing: 3 }),
  m(3, 'buster', 'BUNKER BUSTER', 'Heavy payload for the jet', 420, 'plane', 0xff5a4e, { dmg: 2.2, radius: 1.5, salvo: 8 }),
  m(4, 'lightning', 'WHITE LIGHTNING', 'Fast piercing missile', 700, 'gun', 0xf2f6ff, { dmg: 1.6, speed: 1.5, pierce: 1 }),
  m(5, 'cruise', 'CRUISE', 'Long-range carpet bombs', 1100, 'plane', 0xb9c1cc, { dmg: 2, radius: 1.4, salvo: 12 }),
  m(6, 'hellfire', 'HELLFIRE', 'Gold-banded all-rounder', 1700, 'both', 0xffc34a, { dmg: 2.4, radius: 1.6, salvo: 12 }),
  m(7, 'skyspear', 'SKYSPEAR', 'Blue seeker, hunts targets', 2500, 'gun', 0x5aa8ff, { dmg: 2.8, radius: 1.3, speed: 1.2, homing: 4 }),
  m(8, 'ion', 'ION LANCE', 'Freezing plasma warhead', 3600, 'both', 0x62f0ff, { dmg: 3, radius: 1.7, slow: 1.6, salvo: 14 }),
  m(9, 'shard', 'STEEL SHARD', 'Armor-piercing spike', 5000, 'gun', 0xaab7cf, { dmg: 3.6, radius: 1.2, pierce: 3 }),
  m(10, 'parasite', 'PARASITE', 'Bio-missile, huge blast', 7000, 'gun', 0x57d99b, { dmg: 3.4, radius: 2, homing: 5 }),
  m(11, 'crystal', 'CRYSTAL SHARD', 'Shattering airstrike payload', 10000, 'plane', 0x9fa8ff, { dmg: 5, radius: 2.2, salvo: 18 }),
  m(12, 'reaper', 'REAPER', 'The end of the street', 15000, 'plane', 0xff4f8b, { dmg: 7, radius: 2.6, salvo: 22 }),
];

/** Airstrike without any payload bought: a modest run of basic bombs. */
export const PLANE = { price: 750, cooldown: 45, baseSalvo: 6, baseDmg: 110, baseRadius: 115 };
