/**
 * Hooded hero animation. Frames are pre-aligned PNGs (public/assets/player/hero-N.png, 146×175) with the
 * feet centred at HERO_ORIGIN. Shared by the simulation (muzzle position) and the renderer (sprite + gun),
 * so bullets always leave from the barrel that is drawn.
 */
export const HERO_SIZE = { w: 146, h: 175 };
export const HERO_ORIGIN = { x: 73, y: 171 };
/** World pixels per sprite pixel. */
export const HERO_SCALE = .53;

/** Front-fist position per frame, sprite pixels relative to the feet origin, facing right. */
const HAND: Record<number, [number, number]> = {
  10: [40, -56], 2: [34, -56], 3: [32, -58], 4: [36, -59], 9: [42, -56], 7: [49, -46], 8: [32, -53],
};
/** Stride, passing, stride, passing. */
export const RUN_FRAMES = [2, 3, 4, 9];
export const IDLE_FRAME = 10, JUMP_FRAME = 7, FALL_FRAME = 8;
export const HERO_FRAMES = [IDLE_FRAME, ...RUN_FRAMES, JUMP_FRAME, FALL_FRAME];

export interface HeroBody { x: number; y: number; vx: number; vy: number; facing: number; }

/** Which frame the hero shows. Running backwards (aiming against the motion) plays the cycle in reverse. */
export function heroFrame(p: HeroBody, t: number, ground: number): number {
  if (p.y < ground - 2) return p.vy < 0 ? JUMP_FRAME : FALL_FRAME;
  if (Math.abs(p.vx) > 25) {
    const step = Math.floor(t * 11) * (Math.sign(p.vx) === p.facing ? 1 : -1);
    return RUN_FRAMES[((step % 4) + 4) % 4];
  }
  return IDLE_FRAME;
}

/** Where the gun is held, in world coordinates. */
export function handPoint(p: HeroBody, t: number, ground: number) {
  const [hx, hy] = HAND[heroFrame(p, t, ground)];
  return { x: p.x + p.facing * hx * HERO_SCALE, y: p.y + hy * HERO_SCALE };
}
