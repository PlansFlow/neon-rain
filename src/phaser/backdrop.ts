import Phaser from 'phaser';
import { WORLD } from '../game/simulation';

/**
 * Painted stage backdrops locked to the camera and pinned to the existing ground line, brought to life with cheap,
 * time-based layers: flickering lights, drifting fog, particles, road reflections and ripples. Nothing allocates per
 * frame. Each stage fades in over ~3 s when its wave arrives; below the painting the wet road continues as a mirrored,
 * darkened reflection so the street never ends in a hard edge at extreme zoom.
 */
const IMG_W = 2000, IMG_H = 1121;

interface Light { x: number; y: number; r: number; color: number; base: number; neon: boolean; ph: number; refl: boolean; }
export interface StageConfig {
  key: string; from: number; until?: number;
  /** Image row where characters' feet sit, screen pixels per image pixel, max parallax in screen pixels. */
  ground: number; scale: number; parallax: number; depth: number;
  lights: Light[]; fogTint: number; fogRows: number[]; fogAlpha: number;
  motes: { color: number; count: number; fall: boolean; size: number; alpha: number };
  sun?: { x: number; y: number; r: number; color: number };
}

export const STREET_25: StageConfig = {
  key: 'street-25', from: 25, until: 50, ground: 985, scale: .9, parallax: 110, depth: 1.5,
  lights: [
    { x: 360, y: 410, r: 150, color: 0xffa24a, base: .5, neon: false, ph: 0, refl: true },
    { x: 1645, y: 480, r: 150, color: 0xffa24a, base: .5, neon: false, ph: 2.1, refl: true },
    { x: 1365, y: 600, r: 120, color: 0x5dffb0, base: .42, neon: true, ph: 1.3, refl: true },
    { x: 1265, y: 720, r: 70, color: 0x7dffc8, base: .4, neon: true, ph: 3.7, refl: false },
    { x: 420, y: 800, r: 120, color: 0x52ffb8, base: .38, neon: true, ph: .7, refl: true },
    { x: 1430, y: 790, r: 110, color: 0x62e4ff, base: .36, neon: true, ph: 4.4, refl: true },
    { x: 1690, y: 720, r: 90, color: 0xff8a4a, base: .44, neon: true, ph: 5.2, refl: true },
  ],
  fogTint: 0x8fb0e8, fogRows: [850, 878, 906], fogAlpha: .13,
  motes: { color: 0x6dff9a, count: 40, fall: false, size: 2, alpha: .7 },
};

/** The final arena: an overgrown city at dawn, warm windows, mist at the end of the avenue, leaves on the wind. */
export const ARENA_50: StageConfig = {
  key: 'arena-50', from: 50, ground: 1050, scale: .78, parallax: 50, depth: 1.52,
  lights: [
    { x: 1600, y: 470, r: 230, color: 0xffb070, base: .28, neon: false, ph: .4, refl: false },
    { x: 1570, y: 640, r: 150, color: 0xffa25a, base: .3, neon: false, ph: 1.7, refl: true },
    { x: 610, y: 770, r: 140, color: 0xffa25a, base: .3, neon: false, ph: 2.9, refl: true },
    { x: 625, y: 880, r: 110, color: 0xffb070, base: .28, neon: false, ph: 4.1, refl: false },
    { x: 1440, y: 745, r: 70, color: 0xffd9a0, base: .45, neon: true, ph: 3.3, refl: true },
    { x: 1895, y: 735, r: 80, color: 0xffe2b0, base: .45, neon: true, ph: 5.6, refl: true },
  ],
  fogTint: 0xa8bedc, fogRows: [900, 935, 965], fogAlpha: .16,
  motes: { color: 0x9fd47a, count: 26, fall: true, size: 3, alpha: .75 },
  sun: { x: 1000, y: 430, r: 520, color: 0xffc89a },
};

export class Backdrop {
  /** 0 = hidden, 1 = fully shown. */
  mix = 0;
  /** Extra warmth (0..1) the ending can push up; raises the sun and lights. */
  warmth = 0;
  private img: Phaser.GameObjects.Image; private mirror: Phaser.GameObjects.Image; private under: Phaser.GameObjects.Rectangle;
  private glows: Phaser.GameObjects.Image[] = []; private fog: Phaser.GameObjects.Image[] = []; private sun?: Phaser.GameObjects.Image;
  private fx: Phaser.GameObjects.Graphics;
  private motes: { u: number; v: number; s: number; ph: number }[];

  constructor(scene: Phaser.Scene, private cfg: StageConfig, private fadeOut: { setAlpha(a: number): unknown }[] = []) {
    if (!scene.textures.exists('bd-glow')) {
      const c = scene.textures.createCanvas('bd-glow', 128, 128)!, g = c.context.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, '#ffffffff'); g.addColorStop(.25, '#ffffff88'); g.addColorStop(1, '#ffffff00'); c.context.fillStyle = g; c.context.fillRect(0, 0, 128, 128); c.refresh();
      const f = scene.textures.createCanvas('bd-fog', 512, 128)!, x = f.context;
      for (let i = 0; i < 9; i++) { const cx = 40 + i * 55, cy = 64 + Math.sin(i * 1.9) * 14, r = 60 + (i % 3) * 18, gg = x.createRadialGradient(cx, cy, 0, cx, cy, r); gg.addColorStop(0, '#ffffff55'); gg.addColorStop(1, '#ffffff00'); x.fillStyle = gg; x.fillRect(0, 0, 512, 128); }
      f.refresh();
    }
    const d = cfg.depth;
    this.under = scene.add.rectangle(0, 0, 10, 10, 0x070d12).setOrigin(.5, 0).setDepth(d - .01).setVisible(false);
    this.mirror = scene.add.image(0, 0, cfg.key).setOrigin(.5, 0).setFlipY(true).setDepth(d - .005).setTint(0x7d8aa8).setVisible(false);
    this.img = scene.add.image(0, 0, cfg.key).setOrigin(.5, cfg.ground / IMG_H).setDepth(d).setVisible(false);
    if (cfg.sun) this.sun = scene.add.image(0, 0, 'bd-glow').setDepth(d + .04).setTint(cfg.sun.color).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    for (let i = 0; i < 3; i++) this.fog.push(scene.add.image(0, 0, 'bd-fog').setDepth(d + .05).setTint(cfg.fogTint).setVisible(false));
    for (const l of cfg.lights) this.glows.push(scene.add.image(0, 0, 'bd-glow').setDepth(d + .1).setTint(l.color).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
    this.fx = scene.add.graphics().setDepth(d + .15);
    this.motes = Array.from({ length: cfg.motes.count }, (_, i) => ({ u: (i * 523) % IMG_W, v: 120 + ((i * 337) % 760), s: 6 + (i % 5) * 3, ph: i * 1.7 }));
  }

  /** `keep` holds this stage at full strength (the street under the arena while the arena is still fading in). */
  update(dt: number, wave: number, zoom: number, camX: number, t: number, keep = false) {
    const c = this.cfg, want = keep || (wave >= c.from && (c.until === undefined || wave < c.until)) ? 1 : 0;
    this.mix += (want - this.mix) * Math.min(1, dt * .8);
    if (wave < c.from && wave <= 1) this.mix = 0; // new run: snap back
    if (this.mix < .002) this.mix = 0;
    const on = this.mix > 0, a = this.mix;
    for (const o of this.fadeOut) o.setAlpha(1 - a);
    for (const o of [this.img, this.mirror, this.under, ...this.glows, ...this.fog]) o.setVisible(on);
    this.sun?.setVisible(on);
    this.fx.clear();
    if (!on) return;

    const s = c.scale / zoom, parallax = Phaser.Math.Clamp(-(camX - 720) * .12, -c.parallax, c.parallax) / zoom, cx = camX + parallax;
    const wx = (ix: number) => cx + (ix - IMG_W / 2) * s, wy = (iy: number) => WORLD.ground + (iy - c.ground) * s;
    const bottom = wy(IMG_H), mirrorRows = 320;
    this.img.setPosition(cx, WORLD.ground).setScale(s).setAlpha(a);
    // reflection: the bottom rows of the painting, flipped, continue the wet road downwards
    this.mirror.setCrop(0, IMG_H - mirrorRows, IMG_W, mirrorRows).setOrigin(.5, (IMG_H - mirrorRows) / IMG_H).setPosition(cx, bottom).setScale(s).setAlpha(.62 * a);
    this.under.setPosition(cx, bottom + mirrorRows * s - 1).setSize(IMG_W * s, 1600 / zoom).setAlpha(a);

    const warm = this.warmth;
    if (this.sun && c.sun) this.sun.setPosition(wx(c.sun.x), wy(c.sun.y)).setScale(c.sun.r * 2 * s / 128).setAlpha((.16 + .05 * Math.sin(t * .35) + warm * .32) * a);

    c.lights.forEach((l, i) => {
      let f = .88 + .12 * Math.sin(t * 1.7 + l.ph) * Math.sin(t * .63 + l.ph * 2);
      if (l.neon) { f = .82 + .18 * Math.sin(t * 9 + l.ph); if (Math.sin(t * 2.3 + l.ph * 3) > .97) f *= .3; }
      this.glows[i].setPosition(wx(l.x), wy(l.y)).setScale(l.r * 2 * s / 128).setAlpha(l.base * f * (1 + warm * .6) * a);
    });

    this.fog.forEach((f, i) => {
      const u = ((t * (14 + i * 7) + i * 760) % 2600) - 300;
      f.setPosition(wx(u), wy(c.fogRows[i])).setScale(s * 2.6, s * (1.3 + i * .25)).setAlpha((c.fogAlpha - i * .025) * a * (1 - warm * .5));
    });

    const g = this.fx, m = c.motes;
    for (const mo of this.motes) {
      const span = 780, v = m.fall ? 120 + ((mo.v + t * mo.s * 2.2) % span) : 120 + ((mo.v - t * mo.s) % span + span) % span;
      const u = mo.u + Math.sin(t * .6 + mo.ph) * (m.fall ? 60 : 18) + (m.fall ? t * 9 : 0) % IMG_W, tw = .45 + .55 * Math.max(0, Math.sin(t * 2 + mo.ph));
      const px = wx(u % IMG_W), py = wy(v);
      if (m.fall) {
        const r = Math.sin(t * 3 + mo.ph);
        g.fillStyle(mo.ph % 3 < 1 ? 0xe0a35a : m.color, m.alpha * a).fillRect(px, py, m.size * s * (.4 + .6 * Math.abs(r)), m.size * s * .7);
      } else g.fillStyle(m.color, m.alpha * tw * a).fillRect(px, py, m.size * s, m.size * s).fillStyle(m.color, .12 * tw * a).fillCircle(px + s, py + s, 5 * s);
    }
    for (const l of c.lights) {
      if (!l.refl) continue;
      for (let k = 0; k < 6; k++) {
        const iy = c.ground - 17 + k * 14, wob = Math.sin(t * 3.1 + k * 1.3 + l.ph) * 10, len = (60 - k * 7) * (.8 + .2 * Math.sin(t * 2 + k));
        g.fillStyle(l.color, (.16 - k * .022) * a).fillRect(wx(l.x - len / 2 + wob), wy(iy), len * s, 3 * s);
      }
    }
    for (let i = 0; i < 16; i++) {
      const period = 1.1 + (i % 4) * .23, p = ((t + i * .37) % period) / period, ux = (i * 641 + Math.floor((t + i * .37) / period) * 373) % IMG_W, uy = c.ground - 10 + (i * 29) % 110;
      g.lineStyle(Math.max(1, s), 0xbfd6ff, .2 * (1 - p) * a * (1 - warm)).strokeEllipse(wx(ux), wy(uy), (6 + p * 26) * s, (2 + p * 6) * s);
    }
  }

}
