import Phaser from 'phaser';
import { Simulation, WORLD, type Bullet, type Enemy, type Input } from '../game/simulation';
import { gunGeometry,muzzlePoint } from '../game/geometry';
import { WEAPONS } from '../game/weapons';
import { ENEMIES } from '../game/enemies';
import { PETS } from '../game/pets';
import { TEXTURES } from '../game/assets';
import { Sound } from '../game/audio';
import { environment } from './environment';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: number; size: number; }
interface Ring { x: number; y: number; r: number; life: number; max: number; color: number; }
interface Arc { pts: number[]; life: number; color: number; }
interface Palette { coat: number; skin: number; leg: number; hi: number; belly: number; hair: number; boot: number; accent: number; }

const HERO: Palette = { coat: 0xd4cbd0, skin: 0xd8a18d, leg: 0x34445a, hi: 0x807a94, belly: 0xe5d8d5, hair: 0x25202a, boot: 0x9d90a3, accent: 0xf17aa5 };
const CX = 720, CY = 405;

/** Reusable sprites: one image per request, grown on demand and hidden when unused. */
class Pool {
  private items: Phaser.GameObjects.Image[] = []; private n = 0;
  constructor(private scene: Phaser.Scene, private depth: number) {}
  begin() { this.n = 0; }
  get(key: string) {
    let im = this.items[this.n];
    if (!im) { im = this.scene.add.image(0, 0, key).setDepth(this.depth); this.items.push(im); }
    else if (im.texture.key !== key) im.setTexture(key);
    im.setVisible(true); this.n++; return im;
  }
  end() { for (let i = this.n; i < this.items.length; i++) this.items[i].setVisible(false); }
}
interface MissileReq { skin: number; x: number; y: number; rot: number; len: number; }

export class StreetScene extends Phaser.Scene {
  sim: Simulation; soundFX: Sound;
  touch = { left: false, right: false, jump: false, dash: false, shoot: false, plane: false };
  onHud: () => void = () => {};
  onToast: (title: string, sub?: string, kind?: string) => void = () => {};

  private actors!: Phaser.GameObjects.Graphics; private fx!: Phaser.GameObjects.Graphics;
  private rain!: Phaser.GameObjects.Graphics; private aim!: Phaser.GameObjects.Graphics;
  private particles: Particle[] = []; private rings: Ring[] = []; private arcs: Arc[] = [];
  private drops = Array.from({ length: 260 }, () => ({ u: Math.random(), v: Math.random(), s: .35 + Math.random() * .5 }));
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private accumulator = 0; private hudTime = 0; private visualTime = 0; private recoil = 0;
  private pickupPool!: Pool; private explosionPool!: Pool;
  private explosions:{x:number;y:number;t:number;size:number;variant:number}[]=[];
  private labels = 0; private lastLabel = 0;
  private heroGun!: Phaser.GameObjects.Image; private planeImg!: Phaser.GameObjects.Image;
  private petPool!: Pool; private missilePool!: Pool; private alienPool!: Pool;
  private missileReq: MissileReq[] = []; private heroPose = { x: 0, y: 0, angle: 0, show: false };
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(sim: Simulation, sound: Sound) { super('street'); this.sim = sim; this.soundFX = sound; }

  preload() { this.load.image('medkit','assets/fx/medkit.png');for(let v=0;v<2;v++)for(let i=0;i<10;i++)this.load.image(`blast-${v}-${i}`,`assets/fx/explosion-${v}-${i}.png`);for (const [key, url] of TEXTURES) this.load.image(key, url); }

  create() {
    environment(this);this.pickupPool=new Pool(this,4.1);this.explosionPool=new Pool(this,6.2);
    this.actors = this.add.graphics().setDepth(4); this.fx = this.add.graphics().setDepth(5);
    this.rain = this.add.graphics().setDepth(6); this.aim = this.add.graphics().setDepth(10);
    this.heroGun = this.add.image(0, 0, 'gun-1').setDepth(4.6).setOrigin(.3, .55);
    this.planeImg = this.add.image(0, 0, 'plane').setDepth(9).setVisible(false);
    this.petPool = new Pool(this, 4.2); this.missilePool = new Pool(this, 5.5); this.alienPool = new Pool(this, 3.8);
    this.keys = this.input.keyboard!.addKeys('A,D,W,SPACE,SHIFT,LEFT,RIGHT,UP,Q') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.mouse!.disableContextMenu(); this.input.addPointer(2);
    this.game.events.on('blur', () => {
      if (this.sim.mode === 'playing') { this.sim.mode = 'paused'; this.touch = { left: false, right: false, jump: false, dash: false, shoot: false, plane: false }; this.onHud(); }
    });
    this.onHud();
  }

  /** Keep the street's baseline pinned on screen while the camera pulls back around it. */
  private frame(z: number) {
    this.cameras.main.setZoom(z);
    this.cameras.main.setScroll(this.sim.camX - CX, (WORLD.ground - CY) * (1 - 1 / z));
  }
  private toWorld(px: number, py: number, z: number) {
    return { x: this.sim.camX + (px - CX) / z, y: CY + (WORLD.ground - CY) * (1 - 1 / z) + (py - CY) / z };
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, .05); this.visualTime += dt;
    if (!this.actors) return;
    const sim = this.sim, p = sim.player, z = sim.zoom, k = 1 / z;
    this.frame(z);

    const pointer = this.input.activePointer;
    const world = this.toWorld(pointer.x, pointer.y, z);
    let aimX = world.x, aimY = world.y;
    if (!pointer.isDown && pointer.x === 0) { aimX = p.x + 300; aimY = p.y - 32; }
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (isTouch) {
      let best: Enemy | undefined, bd = 1e9;
      for (const e of sim.enemies) { const d = Math.abs(e.x - p.x); if (d < bd) { bd = d; best = e; } }
      aimX = best?.x ?? p.x + p.facing * 300; aimY = best ? best.y - 30 : p.y - 34;
    }
    const input: Input = {
      move: Number(this.keys.D.isDown || this.keys.RIGHT.isDown || this.touch.right) - Number(this.keys.A.isDown || this.keys.LEFT.isDown || this.touch.left),
      jump: this.keys.W.isDown || this.keys.UP.isDown || this.keys.SPACE.isDown || this.touch.jump,
      dash: this.keys.SHIFT.isDown || this.touch.dash, plane: this.keys.Q.isDown || this.touch.plane,
      shoot: (pointer.isDown && pointer.downElement === this.game.canvas) || this.touch.shoot,
      aimX, aimY,
    };

    this.accumulator += dt;
    while (this.accumulator >= 1 / 120) { sim.tick(1 / 120, input); this.handleEvents(); this.accumulator -= 1 / 120; }
    this.recoil = Math.max(0, this.recoil - dt * 45);

    this.drawActors(input);
    this.drawFx(dt);
    this.drawRain(dt);
    this.syncSprites(input);

    this.aim.clear();
    if (sim.mode === 'playing' && !isTouch) {
      const g = this.aim, r = 7 * k;
      g.lineStyle(Math.max(1, k * .9), 0xffeddd, .8).strokeCircle(aimX, aimY, r);
      for (const [x, y, xx, yy] of [[-12, 0, -8, 0], [8, 0, 12, 0], [0, -12, 0, -8], [0, 8, 0, 12]])
        g.lineBetween(aimX + x * k, aimY + y * k, aimX + xx * k, aimY + yy * k);
      g.fillStyle(WEAPONS[sim.primary].color).fillRect(aimX - k, aimY - k, 2 * k, 2 * k);
    }
    this.hudTime += dt; if (this.hudTime > .06) { this.onHud(); this.hudTime = 0; }
  }

  // ── Event → feedback ─────────────────────────────────────────────
  private handleEvents() {
    const sim = this.sim, crowded = sim.enemies.length > 90;
    for (const e of sim.events) {
      switch (e.type) {
        case 'shot': {
          const w = WEAPONS[e.weapon!];
          this.recoil = Math.max(this.recoil, w.recoil * .8);
          if (this.particles.length < 450) this.burst(e.x, e.y, e.color, w.pellets > 4 ? 5 : 2, 110);
          this.soundFX.play('shot', e.weapon!, sim.activeCount);
          break;
        }
        case 'kill':
          this.rings.push({x:e.x,y:e.y,r:24,life:.18,max:.18,color:0xffeed4});
          this.burst(e.x, e.y, e.color, crowded ? 5 : 14, 220);
          this.soundFX.play('kill');
          this.floatText(e.x, e.y - 32, '+$' + e.cash);
          break;
        case 'pickup': this.floatText(e.x,e.y,e.value===30?'+30 HP':'+45 AMMO');this.soundFX.play('unlock');break;
        case 'hit': if (this.particles.length < 350) this.burst(e.x, e.y, e.color, 2, 100); break;
        case 'hurt':
          this.soundFX.play('hurt');
          if (!this.reduced) this.cameras.main.shake(110, .002);
          this.burst(e.x, e.y, e.color, 14, 150);
          break;
        case 'dash': this.burst(e.x, e.y, e.color, 16, 90); break;
        case 'plane': this.soundFX.play('plane'); this.onToast('AIRSTRIKE INBOUND', 'CLEAR THE STREET', 'unlock'); break;
        case 'stomp': this.rings.push({ x: e.x, y: e.y - 10, r: 190, life: .4, max: .4, color: e.color }); this.soundFX.play('boom', 0, 1, 170); break;
        case 'alien':
          this.soundFX.play('alien');
          if (e.value === 0) this.onToast('ALIEN CARRIER', 'BOSS INBOUND FROM THE RIGHT', 'final');
          else this.burst(e.x, e.y, e.color, 24, 220);
          break;
        case 'spit': this.burst(e.x, e.y, e.color, 4, 80); this.soundFX.play('spit'); break;
        case 'boom': {
          const r = e.value ?? 100;
          if(this.explosions.length<12&&(Math.random()<.65||sim.plane))this.explosions.push({x:e.x,y:e.y+25,t:0,size:Math.min(240,Math.max(95,r*1.3)),variant:Math.random()<.5?0:1});
          this.rings.push({ x: e.x, y: e.y, r, life: .35, max: .35, color: e.color });
          this.burst(e.x, e.y, e.color, Math.min(34, 8 + r / 10), 120 + r);
          this.soundFX.play('boom', 0, 1, r);
          if (!this.reduced && r >= 120) this.cameras.main.shake(130, Math.min(.007, r / 60000));
          break;
        }
        case 'arc': this.arcs.push({ pts: this.bolt(e.x, e.y, e.x2!, e.y2!), life: .13, color: e.color }); this.soundFX.play('arc'); break;
        case 'wave': {
          const w = e.value!;
          this.soundFX.play('wave');
          this.onToast(w === 10 ? 'FINAL WAVE' : `WAVE ${String(w).padStart(2, '0')}`,
            w === 10 ? 'EVERYTHING IS COMING' : w > 10 ? 'ENDLESS' : w >= 7 ? 'THE STREET IS FULL' : w >= 4 ? 'THEY KEEP COMING' : 'HOLD THE LINE', w >= 10 ? 'final' : 'wave');
          break;
        }
      }
    }
  }

  private bolt(x: number, y: number, x2: number, y2: number) {
    const pts = [x, y], n = 5;
    for (let i = 1; i < n; i++) pts.push(x + (x2 - x) * i / n + (Math.random() - .5) * 26, y + (y2 - y) * i / n + (Math.random() - .5) * 26);
    pts.push(x2, y2); return pts;
  }

  private burst(x: number, y: number, color: number, n: number, speed: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 20 + Math.random() * speed, life = .15 + Math.random() * .35;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: 1 + Math.random() * 3 });
    }
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  }

  /** Score pops are throttled: in a big wave dozens of enemies die per second. */
  private floatText(x: number, y: number, text: string) {
    if (this.visualTime - this.lastLabel < .09 || this.labels > 14) return;
    this.lastLabel = this.visualTime; this.labels++;
    const k = Math.max(1, 1 / this.sim.zoom);
    const label = this.add.text(x, y, text, { fontFamily: 'monospace', fontSize: Math.round(16 * k), color: '#b9ff9e', fontStyle: 'bold', stroke: '#21192b', strokeThickness: 3 }).setOrigin(.5).setDepth(7);
    this.tweens.add({ targets: label, y: y - 38 * k, alpha: 0, duration: 750, onComplete: () => { label.destroy(); this.labels--; } });
  }

  // ── Rendering ────────────────────────────────────────────────────
  private drawRain(dt: number) {
    const g = this.rain, z = this.sim.zoom, k = 1 / z, half = CX * k, cx = this.sim.camX;
    const top = WORLD.ground * (1 - k), span = WORLD.ground + 30 - top;
    g.clear();
    const slant = .16, lw = Math.sqrt(k);
    for (const d of this.drops) {
      d.v += d.s * dt * 1.1; d.u -= d.s * slant * dt * .4;
      if (d.v > 1) { d.v = 0; d.u = Math.random() * 1.1; }
      if (d.u < -.05) d.u += 1.1;
      const x = cx - half + d.u * 2 * half, y = top + d.v * span, fast = d.s > .6;
      g.lineStyle((fast ? 1.2 : .7) * lw, 0xc9c6df, fast ? .18 : .08).lineBetween(x, y, x - 2 * k, y + (8 + d.s * 12) * k);
    }
    for (let i = 0; i < 16; i++) {
      const x = cx - half + (((i * 107 + this.visualTime * 19) * k) % (2 * half));
      g.lineStyle(lw, 0xb1a3bd, .13).strokeEllipse(x, 637 + Math.sin(i) * 7, (4 + ((this.visualTime * 30 + i * 13) % 20)) * k, 2 * k);
    }
  }

  private drawActors(input: Input) {
    const g = this.actors, sim = this.sim, p = sim.player, z = sim.zoom, k = 1 / z, lod = z < .72;
    g.clear();
    for (const e of sim.enemies) {
      const d = ENEMIES[e.kind];
      const hit = e.hit > 0;
      if (e.kind === 'alien') { g.fillStyle(0x100e1d, .3).fillEllipse(e.x, 640, 260, 18); this.bossBar(e); continue; }
      g.fillStyle(0x100e1d, .35).fillEllipse(e.x, 638, 36 * d.s, 6);
      if (e.kind === 'drone') this.drone(e, hit);
      else if (lod) this.simple(e, hit);
      else {
        const pal: Palette = { coat: e.slow > 0 ? 0x6fa8c8 : d.coat, skin: d.skin, leg: d.leg, hi: 0x302a40, belly: 0x635371, hair: 0x51465e, boot: 0x51415c, accent: d.accent };
        this.person(e.x, e.y, d.s, Math.sign(p.x - e.x) || 1, pal, false, hit, this.visualTime * 8 + e.id, 0);
        this.decorate(e, d.s, hit);
      }
      if (e.hp < e.maxHp) {
        const w = 34 * Math.max(1, d.s * .9);
        g.fillStyle(0x1a1726).fillRect(e.x - w / 2, e.y + d.top - 14, w, 3 * Math.max(1, k * .6));
        g.fillStyle(e.kind === 'titan' ? 0xff3f7f : 0xf581ac).fillRect(e.x - w / 2, e.y + d.top - 14, w * e.hp / e.maxHp, 3 * Math.max(1, k * .6));
      }
    }

    for (const pet of sim.pets) if (pet.id !== 0) g.fillStyle(0x100e1d, .35).fillEllipse(pet.x, 639, PETS[pet.id].height * .8, 6);
    g.fillStyle(0x100e1d, .35).fillEllipse(p.x, 639, 42, 7);
    if (z < .9) {
      g.lineStyle(2 * k, 0x9effef, .55).strokeEllipse(p.x, 640, 70 * (.8 + .2 * k), 12 * k);
      const my = p.y - 92 - 10 * k;
      g.fillStyle(0x9effef, .9).fillTriangle(p.x - 8 * k, my - 12 * k, p.x + 8 * k, my - 12 * k, p.x, my);
    }
    if (p.dash > 0) for (let i = 1; i < 5; i++) g.fillStyle(0xa6ffeb, .14 / i).fillRect(p.x - Math.sign(p.vx) * i * 20 - 11, p.y - 48, 22, 45);
    this.stackAura(p.x, p.y - 34);
    if (p.invulnerable <= 0 || Math.floor(this.visualTime * 18) % 2 === 0) {
      const moving = Math.abs(p.vx) > 25;
      this.person(p.x, p.y, 1, p.facing, HERO, true, false, moving ? this.visualTime * 13 : 0, Math.atan2(input.aimY - (p.y - 34), input.aimX - p.x));
    }
  }

  private bossBar(e: Enemy) {
    const g = this.actors, w = 280, y = e.y - 130, k = Math.max(1, 1 / this.sim.zoom * .7);
    g.fillStyle(0x1a1726).fillRect(e.x - w / 2, y, w, 5 * k).fillStyle(0x62f0ff).fillRect(e.x - w / 2, y, w * e.hp / e.maxHp, 5 * k);
  }

  /** One glowing node per active gun circles the hero: the stack is visible at a glance. */
  private stackAura(x: number, y: number) {
    const g = this.actors, sim = this.sim, list: number[] = [];
    for (let i = 0; i < WEAPONS.length; i++) if (sim.active[i]) list.push(i);
    const n = Math.min(list.length, 18); if (n < 2) return;
    const k = Math.max(1, 1 / sim.zoom * .8);
    for (let j = 0; j < n; j++) {
      const a = this.visualTime * 1.8 + (j / n) * Math.PI * 2, c = WEAPONS[list[Math.floor(j * list.length / n)]].color;
      const px = x + Math.cos(a) * 42, py = y + Math.sin(a) * 46;
      g.fillStyle(c, .22).fillCircle(px, py, 5 * k).fillStyle(c, .95).fillCircle(px, py, 1.8 * k);
    }
  }

  private drone(e: Enemy, hit: boolean) {
    const g = this.actors, y = e.y + Math.sin(this.visualTime * 5 + e.id) * 4, x = e.x;
    g.fillStyle(hit ? 0xffffff : 0x1c1a2b).fillRect(x - 20, y - 23, 40, 22);
    g.fillStyle(e.slow > 0 ? 0x6fa8c8 : 0x685778).fillRect(x - 14, y - 26, 28, 8);
    g.fillStyle(0xff729d).fillRect(x - 11, y - 14, 22, 4);
    g.fillStyle(0xff769e, .2).fillEllipse(x, y - 10, 60, 22);
    g.fillStyle(0xa497b1, .5).fillRect(x - 29, y - 29, 58, 2);
  }

  /** Cheap silhouette used when the camera is far out and the screen is full of enemies. */
  private simple(e: Enemy, hit: boolean) {
    const g = this.actors, d = ENEMIES[e.kind], s = d.s, x = e.x, y = e.y, st = Math.sin(this.visualTime * 8 + e.id) * 4 * s;
    const coat = hit ? 0xffffff : e.slow > 0 ? 0x6fa8c8 : d.coat;
    g.fillStyle(hit ? 0xffffff : d.leg).fillRect(x - 8 * s, y - 18 * s, 7 * s, 18 * s + st).fillRect(x + 2 * s, y - 18 * s, 7 * s, 18 * s - st);
    g.fillStyle(coat).fillRect(x - 11 * s, y - 52 * s, 22 * s, 36 * s);
    g.fillStyle(hit ? 0xffffff : d.skin).fillRect(x - 7 * s, y - 64 * s, 14 * s, 13 * s);
    g.fillStyle(d.accent).fillRect(x - 2 * s, y - 45 * s, 5 * s, 5 * s);
    if (e.kind === 'titan') g.fillStyle(d.accent, .1).fillCircle(x, y - 60, 75);
    if (e.kind === 'bomber' && Math.floor(this.visualTime * 6) % 2) g.fillStyle(0xff4040).fillRect(x - 14 * s, y - 46 * s, 6 * s, 6 * s);
  }

  /** Kind-specific details on top of the shared body. */
  private decorate(e: Enemy, s: number, hit: boolean) {
    const g = this.actors, x = e.x, y = e.y, dir = Math.sign(this.sim.player.x - e.x) || 1, d = ENEMIES[e.kind];
    const r = (a: number, b: number, w: number, h: number, c: number, al = 1) => g.fillStyle(hit ? 0xffffff : c, al).fillRect(Math.round(x + (dir > 0 ? a : -a - w) * s), Math.round(y + b * s), w * s, h * s);
    switch (e.kind) {
      case 'armored': r(-13, -53, 8, 30, 0x9fb3d0); r(-10, -64, 22, 8, 0x6f7e99); r(-1, -34, 14, 18, 0x8aa0c0, .9); break;
      case 'bomber': r(-17, -46, 9, 22, 0x7a1f1f); if (Math.floor(this.visualTime * 6 + e.id) % 2) r(-15, -44, 5, 5, 0xff5050); break;
      case 'splitter': g.fillStyle(d.accent, .22).fillEllipse(x, y - 34 * s, 56 * s, 62 * s); break;
      case 'spitter': g.fillStyle(0xb6ff6a, .25).fillCircle(x + dir * 22 * s, y - 32 * s, 12); break;
      case 'sprinter': for (let i = 1; i < 4; i++) g.fillStyle(d.accent, .1 / i).fillRect(x - dir * (14 + i * 14), y - 48 * s, 12, 40 * s); break;
      case 'titan':
        g.fillStyle(d.accent, .12).fillCircle(x, y - 70, 120);
        r(-14, -75, 4, 9, 0xd9a3c0); r(8, -75, 4, 9, 0xd9a3c0); r(-16, -59, 6, 9, 0x2a1626); r(12, -59, 6, 9, 0x2a1626);
        break;
      case 'leaper': if (e.y < WORLD.ground - 6) for (let i = 1; i < 3; i++) g.fillStyle(d.accent, .12).fillRect(x - dir * i * 12, e.y - 46 * s, 16, 40); break;
    }
    if (e.slow > 0) g.fillStyle(0x9fe9ff, .18).fillCircle(x, y - 28 * s, 26 * s);
  }

  private person(x: number, y: number, s: number, dir: number, pal: Palette, hero: boolean, hit: boolean, walk: number, angle: number) {
    const g = this.actors, bob = walk ? Math.sin(walk * 2) * 1.5 : Math.sin(this.visualTime * 2) * .5; y += hero?0:bob;
    const r = (a: number, b: number, w: number, h: number, c: number) => g.fillStyle(hit ? 0xffffff : c).fillRect(Math.round(x + (dir > 0 ? a : -a - w) * s), Math.round(y + b * s), w * s, h * s);
    const step = Math.sin(walk) * 6;
    r(-12, -51, 24, 33, 0x141321); r(-10, -37, 20, 20, pal.coat); r(-10, -36, 5, 21, pal.hi); r(-5, -29, 11, 13, pal.belly); r(-12, -19, 23, 6, 0x1a1a2b);
    r(-9, -14, 8, 11 + step, pal.leg); r(3, -14, 8, 11 - step, pal.leg); r(-12, -4 + step, 13, 5, 0x161422); r(2, -4 - step, 14, 5, 0x161422);
    r(-11, -2 + step, 12, 2, pal.boot); r(4, -2 - step, 12, 2, pal.boot);
    r(-9, -62, 19, 23, 0x181523); r(-4, -57, 15, 15, pal.skin); r(-9, -62, 17, 7, hero ? 0x25202a : pal.hair); r(-9, -57, 5, 15, 0x25202a); r(5, -53, 3, 4, 0x17151e); r(8, -48, 5, 4, pal.skin);
    if (hero) { this.heroPose = { x, y: y - 34, angle, show: true }; this.muzzle(x, y - 34, angle); }
    else { r(8, -35, 12, 8, pal.coat); r(16, -34, 7, 6, pal.skin); r(20, -35, 6, 13, 0x2a2637); r(21, -36, 3, 5, pal.accent); }
  }

  /** Muzzle flash at the end of whichever gun art the hero is holding. */
  private muzzle(x: number, y: number, angle: number) {
    if (this.recoil <= 0) return;
    const g=this.actors,w=WEAPONS[this.sim.primary],tip=muzzlePoint(w.art,x,y,angle);
    g.fillStyle(w.color,.12).fillCircle(tip.x,tip.y,9);
    g.lineStyle(2,w.color,.9).lineBetween(tip.x,tip.y,tip.x+Math.cos(angle)*8,tip.y+Math.sin(angle)*8);
  }
  private gunLength(){return gunGeometry(WEAPONS[this.sim.primary].art).length;}

  private drawBullet(g: Phaser.GameObjects.Graphics, b: Bullet, rich: boolean, kk: number) {
    const w = WEAPONS[b.weapon], c = b.color, sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp;
    switch (w.shape) {
      case 'orb': {
        const r = 5 * w.size * kk;
        g.fillStyle(c, .12).fillCircle(b.x, b.y, r * 2.6).fillStyle(c, .3).fillCircle(b.x, b.y, r * 1.6).fillStyle(c).fillCircle(b.x, b.y, r).fillStyle(0xffffff, .9).fillCircle(b.x, b.y, r * .45);
        return;
      }
      case 'grenade': {
        const blink = b.life < .3 && Math.floor(this.visualTime * 20) % 2;
        g.fillStyle(blink ? 0xffffff : 0x25301c).fillCircle(b.x, b.y, 6 * kk).lineStyle(2 * kk, c, 1).strokeCircle(b.x, b.y, 6 * kk);
        return;
      }
      case 'saw': {
        const r = 11 * w.size * kk;
        g.fillStyle(c, .16).fillCircle(b.x, b.y, r * 1.7).lineStyle(2 * kk, c, 1).strokeCircle(b.x, b.y, r * .8);
        for (let i = 0; i < 6; i++) { const a = b.spin + i * Math.PI / 3; g.lineBetween(b.x + Math.cos(a) * r * .6, b.y + Math.sin(a) * r * .6, b.x + Math.cos(a) * r * 1.15, b.y + Math.sin(a) * r * 1.15); }
        return;
      }
      case 'fire': {
        const f = b.life / b.max, r = (4 + (1 - f) * 11) * w.size * kk;
        g.fillStyle(f > .6 ? 0xffe29a : c, .12 + .45 * f).fillCircle(b.x, b.y, r);
        if (rich) g.fillStyle(c, .1 * f).fillCircle(b.x, b.y, r * 2);
        return;
      }
      case 'blade': {
        const half = 10 * w.size * kk, nx = -uy, ny = ux;
        g.lineStyle(9 * kk, c, .12).lineBetween(b.x - nx * half, b.y - ny * half, b.x + nx * half, b.y + ny * half);
        g.lineStyle(3 * kk, c, 1).lineBetween(b.x - nx * half, b.y - ny * half, b.x + nx * half, b.y + ny * half);
        return;
      }
      case 'rocket': {
        if (b.skin > 0) {
          const len = 27, tx = b.x - ux * len * .9, ty = b.y - uy * len * .9;
          g.lineStyle(7 * kk, 0xff9a3c, .22).lineBetween(tx - ux * 70, ty - uy * 70, tx, ty).lineStyle(2.5 * kk, 0xffe0a0, .85).lineBetween(tx - ux * 34, ty - uy * 34, tx, ty);
          this.missileReq.push({ skin: b.skin, x: b.x, y: b.y, rot: Math.atan2(b.vy, b.vx), len: 27 });
          return;
        }
        const len = w.len * w.size, x = b.x - ux * len, y = b.y - uy * len;
        g.lineStyle(7 * w.size * kk, 0xff9a3c, .25).lineBetween(x, y, b.x, b.y).lineStyle(3 * w.size * kk, 0xffd89a, .9).lineBetween(b.x - ux * len * .5, b.y - uy * len * .5, b.x, b.y);
        g.fillStyle(c).fillCircle(b.x, b.y, 4 * w.size * kk);
        return;
      }
      default: {
        const len = w.len, x = b.x - ux * len, y = b.y - uy * len, th = (w.shape === 'beam' ? 5 : 3) * w.size * kk;
        if (rich) g.lineStyle(th * 2, c, .08).lineBetween(x, y, b.x, b.y);
        g.lineStyle(th, c, .25).lineBetween(x, y, b.x, b.y).lineStyle(th * .5, c, 1).lineBetween(x, y, b.x, b.y);
        g.lineStyle(Math.max(1, kk * .7), 0xfffbef, 1).lineBetween(b.x - ux * 8, b.y - uy * 8, b.x, b.y);
      }
    }
  }

  /** Image-based things: hero gun, pets, missiles, airstrike jet and alien carriers. */
  private syncSprites(input: Input) {
    const sim = this.sim, k = 1 / sim.zoom;
    // hero gun
    const hp = this.heroPose, gun = this.heroGun, w = WEAPONS[sim.primary];
    const show = sim.mode !== 'ready' && hp.show && (sim.player.invulnerable <= 0 || Math.floor(this.visualTime * 18) % 2 === 0);
    gun.setVisible(show);
    if (show) {
      if (gun.texture.key !== `gun-${w.art}`) gun.setTexture(`gun-${w.art}`);
      const back = 0, c = Math.cos(hp.angle), sn = Math.sin(hp.angle);
      gun.setScale(this.gunLength() / gun.width).setPosition(hp.x - c * back, hp.y - sn * back).setRotation(hp.angle).setFlipY(c < 0);
    }
    hp.show = false;
    // pets
    this.petPool.begin();
    for (const pet of sim.pets) {
      const def = PETS[pet.id], im = this.petPool.get(`pet-${def.img}`);
      im.setOrigin(.5, pet.id === 0 ? .5 : 1);
      const moving = pet.st === 1 || pet.anim > 0 || pet.vy !== 0 || Math.abs(pet.x-(sim.player.x-70))>10, bob = pet.id === 0 ? 0 : moving ? Math.abs(Math.sin(pet.t * 14)) * 4 : Math.sin(pet.t * 2) * .8;
      const stride=moving?Math.sin(pet.t*15):0,attack=pet.anim>0;
      im.setScale(def.height / im.height*(1+(attack?.1:Math.abs(stride)*.025)),def.height / im.height*(1-(attack?.07:Math.abs(stride)*.04))).setFlipX(pet.dir < 0).setPosition(pet.x, pet.y + (pet.id === 0 ? 0 : 3) - bob);
      im.setRotation(pet.st === 1 && pet.id === 2 ? pet.dir * .1 : pet.anim > 0 ? pet.dir * .12 : 0);
    }
    this.petPool.end();
    // alien carriers
    this.alienPool.begin();
    for (const e of sim.enemies) {
      if (e.kind !== 'alien') continue;
      const im = this.alienPool.get('alien');
      im.setPosition(e.x, e.y).setScale(460 / im.width).setFlipX(e.x > sim.player.x).setRotation(e.st === 2 ? (e.x > sim.player.x ? -.18 : .18) : 0);
      if (e.hit > 0) im.setTintFill(0xffffff); else if (e.st === 1 && Math.floor(this.visualTime * 14) % 2) im.setTint(0xff7a9a); else im.clearTint();
    }
    this.alienPool.end();
    // missiles
    this.missilePool.begin();
    for (const r of this.missileReq) {
      const im = this.missilePool.get(`missile-${r.skin}`);
      im.setScale(r.len / im.width).setPosition(r.x, r.y).setRotation(r.rot);
    }
    this.missilePool.end(); this.missileReq.length = 0;
    this.pickupPool.begin();
    for(const drop of sim.pickups){const bob=Math.sin(this.visualTime*3+drop.id)*3;
      if(drop.kind==='health'){const im=this.pickupPool.get('medkit');im.setOrigin(.5,1).setDisplaySize(26,22).setPosition(drop.x,drop.y-bob);}
      else {const g=this.actors;g.fillStyle(0x282c36).fillRect(drop.x-11,drop.y-16-bob,22,15);g.lineStyle(1,0xffd08b).strokeRect(drop.x-11,drop.y-16-bob,22,15);for(let i=0;i<3;i++)g.fillStyle(0xffd08b).fillRect(drop.x-7+i*5,drop.y-12-bob,3,9);}
    }this.pickupPool.end();
    this.explosionPool.begin();
    for(const e of this.explosions){if(sim.mode==='playing')e.t+=this.game.loop.delta/1000;const index=Math.floor(e.t*30);if(index<10){const im=this.explosionPool.get(`blast-${e.variant}-${index}`);im.setOrigin(.5,1).setPosition(e.x,e.y).setDisplaySize(e.size,e.size);im.setAlpha(index>7?(10-index)/3:1);}}
    this.explosions=this.explosions.filter(e=>e.t<10/30);this.explosionPool.end();
    // jet
    const pl = sim.plane;
    this.planeImg.setVisible(!!pl);
    if (pl) this.planeImg.setScale(Math.max(1, k * .75) * 440 / this.planeImg.width).setPosition(pl.x, pl.y).setRotation(.04);
  }

  private drawFx(dt: number) {
    const g = this.fx, sim = this.sim, z = sim.zoom, k = 1 / z, kk = Math.max(1, k * .75);
    g.clear();

    // Airstrikes: a falling streak plus a ground marker.
    const top = WORLD.ground * (1 - k) - 120;
    for (const s of sim.strikes) {
      const q = 1 - s.t / s.total, y = top + (WORLD.ground - 30 - top) * q * q;
      g.lineStyle(Math.max(1, 2 * kk), s.color, .3 + .4 * q).strokeEllipse(s.x, WORLD.ground + 4, s.r * 2 * (1 - q * .35), 9 * kk);
      g.lineStyle(7 * kk, s.color, .12).lineBetween(s.x, y - 380 * kk, s.x, y);
      g.lineStyle(2.4 * kk, s.color, .95).lineBetween(s.x, y - 220 * kk, s.x, y).lineStyle(1.2 * kk, 0xffffff, 1).lineBetween(s.x, y - 60 * kk, s.x, y);
    }

    for (const b of sim.bombs) {
      const ux = Math.cos(b.rot), uy = Math.sin(b.rot);
      g.lineStyle(6 * kk, 0xff9a3c, .25).lineBetween(b.x - ux * 120, b.y - uy * 120, b.x - ux * 40, b.y - uy * 40);
      this.missileReq.push({ skin: b.skin, x: b.x, y: b.y, rot: b.rot, len: 86 });
    }
    if (sim.plane) {
      const pl = sim.plane, k2 = Math.max(1, k * .75);
      g.fillStyle(0xffa05a, .55).fillTriangle(pl.x - 215 * k2, pl.y, pl.x - 150 * k2, pl.y - 9 * k2, pl.x - 150 * k2, pl.y + 9 * k2);
      g.fillStyle(0xfff0c8, .8).fillTriangle(pl.x - 175 * k2, pl.y, pl.x - 150 * k2, pl.y - 4 * k2, pl.x - 150 * k2, pl.y + 4 * k2);
      if (this.particles.length < 500) this.burst(pl.x - 170 * k2, pl.y, 0xaad4ff, 2, 30);
    }

    const rich = sim.bullets.length < 350;
    for (const b of sim.bullets) this.drawBullet(g, b, rich, kk);

    for (const s of sim.enemyShots) g.fillStyle(0xb6ff6a, .22).fillCircle(s.x, s.y, 12 * kk).fillStyle(0xe6ffbf).fillCircle(s.x, s.y, 4.5 * kk);

    for (const b of sim.blades) {
      g.fillStyle(b.color, .16).fillCircle(b.x, b.y, 22 * kk).fillStyle(b.color, .9).fillCircle(b.x, b.y, 8 * kk).fillStyle(0xffffff).fillCircle(b.x, b.y, 3 * kk);
    }

    for (const r of this.rings) {
      r.life -= dt; const q = 1 - r.life / r.max;
      g.lineStyle((4 * (1 - q) + 1) * kk, r.color, (1 - q) * .85).strokeCircle(r.x, r.y, r.r * (.15 + .85 * Math.sqrt(q)));
      g.fillStyle(r.color, .14 * (1 - q)).fillCircle(r.x, r.y, r.r * (.15 + .85 * Math.sqrt(q)));
    }
    this.rings = this.rings.filter(r => r.life > 0);

    for (const a of this.arcs) {
      a.life -= dt;
      for (const [w, al] of [[8, .12], [3.2, .55], [1.3, 1]] as const) {
        g.lineStyle(w * kk, a.color, al); g.beginPath(); g.moveTo(a.pts[0], a.pts[1]);
        for (let i = 2; i < a.pts.length; i += 2) g.lineTo(a.pts[i], a.pts[i + 1]);
        g.strokePath();
      }
    }
    this.arcs = this.arcs.filter(a => a.life > 0);

    const glow = this.particles.length < 380;
    for (const a of this.particles) {
      a.life -= dt; a.x += a.vx * dt; a.y += a.vy * dt; a.vy += 260 * dt;
      g.fillStyle(a.color, a.life / a.max).fillRect(a.x, a.y, a.size * kk, a.size * kk);
      if (glow) g.fillStyle(a.color, .06).fillCircle(a.x, a.y, a.size * 3 * kk);
    }
    this.particles = this.particles.filter(a => a.life > 0);
  }
}
