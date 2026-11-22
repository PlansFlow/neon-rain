import { MISSILES } from './missiles';
import { PETS } from './pets';
import { WEAPONS } from './weapons';
import { HERO_FRAMES } from './hero';

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
  ['street-25', asset('ui/street-25.jpg')],
  ['arena-50', asset('final/arena-50.jpg')],
  ...[1, 2, 3, 4].map(n => [`applicant-${n}`, asset(`final/applicant-${n}.png`)] as [string, string]),
  ['jetpack', asset('player/jetpack.png')],
  ...HERO_FRAMES.map(f => [`hero-${f}`, asset(`player/hero-${f}.png`)] as [string, string]),
  // aligned, right-facing truck frames (cab front + wheel line pinned): drive 2/3, hopper open 5, dump 6
  ...[2, 3, 5, 6].map(n => [`boss-truck-${n}`, asset(`garbage-boss/boss-truck-${n}.png`)] as [string, string]),
  ...[1, 2, 3, 4, 5].map(n => [`bag-${n}`, asset(`garbage-boss/garbage-bag-${n}.png`)] as [string, string]),
];
