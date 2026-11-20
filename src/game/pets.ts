/** Companions. They follow the hero, never die and fight on their own. Damage scales with the wave. */
export interface Pet {
  id: string; name: string; tag: string; role: string; price: number;
  /** Sprite number, public/assets/pets/pet-N.png, and its on-screen height in world pixels. */
  img: number; height: number; color: number;
}

export const PETS: Pet[] = [
  { id: 'parakeet', name: 'PARAKEET', tag: 'Hovers overhead and pecks targets with seed bolts', role: 'RANGED', price: 120, img: 1, height: 24, color: 0x9cff7a },
  { id: 'amstaff', name: 'AMSTAFF', tag: 'Loyal bruiser. Charges in and bites', role: 'MELEE', price: 380, img: 2, height: 36, color: 0x8fb4d8 },
  { id: 'boar', name: 'WAR BOAR', tag: 'Charges through the crowd and sends it flying', role: 'CHARGER', price: 900, img: 3, height: 35, color: 0xff9a7a },
  { id: 'wolf', name: 'MUTANT WOLF', tag: 'Leaps on enemies and shreds them at speed', role: 'ASSASSIN', price: 2200, img: 4, height: 46, color: 0x62f0ff },
  { id: 'bunny', name: 'BUNNY MUTANT', tag: 'Gentle giant. Stomps the ground in a shockwave', role: 'TANK', price: 4800, img: 5, height: 65, color: 0xc9a4ff },
];
