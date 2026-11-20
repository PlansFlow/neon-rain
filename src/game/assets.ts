import { MISSILES } from './missiles';
import { PETS } from './pets';
import { WEAPONS } from './weapons';

/** Static art lives in public/assets. UI-only module: depends on Vite's BASE_URL, so the simulation never imports it. */
export const asset = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;
export const gunUrl = (art: number) => asset(`guns/gun-${art}.png`);
export const missileUrl = (img: number) => asset(`missiles/missile-${img}.png`);
export const petUrl = (img: number) => asset(`pets/pet-${img}.png`);
export const PLANE_URL = asset('fx/plane.png');
export const ALIEN_URL = asset('fx/alien-boss.png');

/** Every texture the Phaser scene needs: [key, url]. */
export const TEXTURES: [string, string][] = [
  ...WEAPONS.map(w => [`gun-${w.art}`, gunUrl(w.art)] as [string, string]),
  ...MISSILES.map(m => [`missile-${m.img}`, missileUrl(m.img)] as [string, string]),
  ...PETS.map(p => [`pet-${p.img}`, petUrl(p.img)] as [string, string]),
  ['plane', PLANE_URL], ['alien', ALIEN_URL],
];
