import { muzzlePoint } from './geometry';
import { WEAPONS } from './weapons';
import { MISSILES, PLANE } from './missiles';
import { PETS } from './pets';
import { ALIEN_WAVES, ENEMIES, TITAN_WAVES, TUNING, cashFor, hpMultiplier, maxEnemies, spawnGap, spawnGroup, waveInfo, zoomFor, type EnemyKind } from './enemies';

export const WORLD = { width: 1440, height: 810, ground: 635 };
export const MAX_BULLETS = 1600;
const TAU = Math.PI * 2;
const BUCKET = 64, BUCKET_ORIGIN = 4000;

export type Mode = 'ready' | 'playing' | 'paused' | 'over';
export interface Input { move: number; jump: boolean; dash: boolean; shoot: boolean; aimX: number; aimY: number; plane?: boolean; }
export interface Enemy {
  id: number; kind: EnemyKind; x: number; y: number; vy: number;
  hp: number; maxHp: number; speed: number;
  hit: number; attack: number; slow: number; orb: number; timer: number;
  lane: number; off: number;
  /** Boss state machine: 0 hover, 1 telegraph, 2 dive, 3 rise. t2/t3 are its attack timers. */
  st: number; t2: number; t3: number; tx: number;
}
export interface Bullet {
  id: number; x: number; y: number; px: number; py: number; vx: number; vy: number;
  life: number; damage: number; color: number; pierce: number; weapon: number;
  hit: Set<number> | null; bounces: number; spin: number; max: number;
  /** Per-bullet values so missile ammo can change them: missile sprite (0 = none), blast radius and damage, homing, slow. */
  skin: number; radius: number; splash: number; homing: number; slow: number;
}
export interface EnemyShot { x: number; y: number; vx: number; vy: number; life: number; dmg: number; color?: number; }
export interface Bomb { x: number; y: number; vx: number; vy: number; skin: number; radius: number; dmg: number; color: number; rot: number; }
export interface PetState { id: number; x: number; y: number; vy: number; dir: number; cd: number; t: number; st: number; hit: Set<number>; bite: number; anim: number; }
export interface Plane { x: number; y: number; vx: number; dropped: number; total: number; timer: number; gap: number; skin: number; radius: number; dmg: number; color: number; }
export interface PendingStrike { x: number; t: number; total: number; r: number; dmg: number; color: number; weapon: number; }
export interface GameEvent {
  type: 'shot' | 'hit' | 'kill' | 'hurt' | 'dash' | 'wave' | 'boom' | 'arc' | 'buy' | 'spit' | 'plane' | 'alien' | 'stomp' | 'pickup';
  x: number; y: number; color: number; value?: number; cash?: number; weapon?: number; x2?: number; y2?: number;
}

export class Simulation {
  mode: Mode = 'ready';
  player = { x: 420, y: WORLD.ground, vx: 0, vy: 0, hp: 100, invulnerable: 0, dash: 0, dashCooldown: 0, facing: 1 };
  score = 0; kills = 0; wave = 1; combo = 0; comboTime = 0; elapsed = 0; shots = 0;
  zoom = zoomFor(1);
  /** Camera centre. When zoomed in, it follows the hero. */
  camX = 720;
  /** Money earned per kill buys mods for the super weapon. `owned` = installed, `active` = switched on. */
  cash = 12;
  ammo: number[] = WEAPONS.map((_,i)=>i===0?90:0);
  heat = WEAPONS.map(()=>0); overheated = WEAPONS.map(()=>false);
  pickups: {id:number;x:number;y:number;kind:'health'|'ammo';life:number}[] = [];
  dropTimer=9;
  get energyWeapon(){return WEAPONS[this.primary].shape==='beam';}
  get ammoCapacity(){return 150;}
  buyAmmo(){if(this.ammo[this.primary]>=150||!this.spend(8))return false;this.ammo[this.primary]=Math.min(150,this.ammo[this.primary]+60);return true;}
  buyHeal(){if(this.player.hp>=100||!this.spend(25))return false;this.player.hp=Math.min(100,this.player.hp+35);return true;}
  owned: boolean[] = WEAPONS.map((_, i) => i === 0);
  active: boolean[] = WEAPONS.map((_, i) => i === 0);
  cd: number[] = WEAPONS.map(() => 0);
  spin: number[] = WEAPONS.map(() => 0);
  bullets: Bullet[] = []; enemies: Enemy[] = []; enemyShots: EnemyShot[] = [];
  /** Missiles, airstrike and companions, all bought with the same cash. */
  missilesOwned: boolean[] = MISSILES.map(() => false);
  gunAmmo = -1; payload = -1;
  planeOwned = false; planeCd = 0; plane: Plane | null = null; bombs: Bomb[] = [];
  petsOwned: boolean[] = PETS.map(() => false); pets: PetState[] = [];
  strikes: PendingStrike[] = []; blades: { x: number; y: number; color: number }[] = [];
  events: GameEvent[] = [];

  private id = 0; private spawnTime = 1.2; private jumped = false; private dashed = false;
  private pending: Enemy[] = []; private volleys: { t: number; i: number }[] = [];
  private planeHeld = false; private orbitAngle = 0; private grid: Enemy[][] = [];
  private lastInput: Input = { move: 0, jump: false, dash: false, shoot: false, aimX: 1200, aimY: 600 };

  constructor(private random: () => number = Math.random) {}

  start() { this.mode = 'playing'; this.camX = this.camTarget(); this.spawnEnemy(1100, 'runner'); }
  restart() { const rng = this.random; Object.assign(this, new Simulation(rng)); this.start(); }

  get activeCount() { let n = 0; for (let i = 0; i < WEAPONS.length; i++) if (this.active[i]) n++; return n; }
  get ownedCount() { let n = 0; for (const o of this.owned) if (o) n++; return n; }
  /** Newest active weapon: drawn in the hero's hands. */
  get primary() { for (let i = WEAPONS.length - 1; i >= 0; i--) if (this.active[i]) return i; return 0; }
  get multiplier() { return Math.min(5, 1 + Math.floor(this.combo / 4)); }
  /** Every extra gun on the stack makes each kill worth a bit more. */
  get arsenalBonus() { return 1 + TUNING.arsenalBonus * (this.activeCount - 1); }
  get waveProgress() { return waveInfo(this.kills); }
  /** Cheapest mod not yet installed. */
  get nextMod() { let best = -1; for (let i = 0; i < WEAPONS.length; i++) if (!this.owned[i] && (best < 0 || WEAPONS[i].price < WEAPONS[best].price)) best = i; return best < 0 ? null : best; }
  /** Half the visible world width at the current zoom. */
  get viewHalf() { return 720 / this.zoom; }
  private camTarget() { const h = this.viewHalf; return h >= 720 ? 720 : Math.max(h, Math.min(WORLD.width - h, this.player.x + this.player.facing * 70)); }

  /** Buy a mod with cash; it is installed and switched on straight away. */
  buy(i: number): boolean {
    const w = WEAPONS[i];
    if (!w || this.owned[i] || this.cash < w.price) return false;
    this.cash -= w.price; this.owned[i] = true; this.ammo[i] = 90; this.select(i);
    this.events.push({ type: 'buy', x: this.player.x, y: this.player.y - 40, color: w.color, value: w.price, weapon: i });
    return true;
  }

  /** Exactly one weapon equipped; pending bursts from the old gun are cancelled. */
  select(i:number){if(!this.owned[i])return;this.active=WEAPONS.map((_,n)=>n===i);this.cd[i]=0;this.volleys=[];}
  enableAll(){this.select(this.primary);}

  // ── Missiles, airstrike, companions ──────────────────────────────
  private spend(price: number, x = this.player.x, color = 0xffffff, value = price): boolean {
    if (this.cash < price) return false;
    this.cash -= price; this.events.push({ type: 'buy', x, y: this.player.y - 40, color, value }); return true;
  }
  /** Buying a missile equips it in every slot it fits, unless a better one already sits there. */
  buyMissile(i: number): boolean {
    const m = MISSILES[i]; if (!m || this.missilesOwned[i] || !this.spend(m.price, this.player.x, m.color)) return false;
    this.missilesOwned[i] = true;
    if (m.use !== 'plane' && (this.gunAmmo < 0 || MISSILES[this.gunAmmo].price < m.price)) this.gunAmmo = i;
    if (m.use !== 'gun' && (this.payload < 0 || MISSILES[this.payload].price < m.price)) this.payload = i;
    return true;
  }
  /** Equip an owned missile as gun ammo or plane payload; passing the equipped one again unequips it. */
  equipMissile(i: number, slot: 'gun' | 'plane') {
    const m = MISSILES[i]; if (!m || !this.missilesOwned[i]) return;
    if (slot === 'gun' && m.use !== 'plane') this.gunAmmo = this.gunAmmo === i ? -1 : i;
    if (slot === 'plane' && m.use !== 'gun') this.payload = this.payload === i ? -1 : i;
  }
  buyPlane(): boolean { if (this.planeOwned || !this.spend(PLANE.price, this.player.x, 0x9fb7ff)) return false; this.planeOwned = true; return true; }
  buyPet(i: number): boolean {
    const p = PETS[i]; if (!p || this.petsOwned[i] || !this.spend(p.price, this.player.x, p.color)) return false;
    this.petsOwned[i] = true;
    this.pets.push({ id: i, x: this.player.x - 80, y: WORLD.ground, vy: 0, dir: 1, cd: 0, t: 0, st: 0, hit: new Set(), bite: 0, anim: 0 });
    return true;
  }
  get planeReady() { return this.planeOwned && this.planeCd <= 0 && !this.plane; }
  /** The bomber makes one pass over the street and carpet-bombs everything ahead of it. */
  callPlane(): boolean {
    if (!this.planeReady || this.mode !== 'playing') return false;
    const m = this.payload >= 0 ? MISSILES[this.payload] : null, z = this.zoom, half = this.viewHalf;
    const total = m ? m.salvo : PLANE.baseSalvo, span = half * 1.7, speed = (half * 2 + 900) / 2.5;
    this.plane = {
      x: this.camX - half - 460, y: WORLD.ground * (1 - 1 / z) + 150 / z, vx: speed, dropped: 0, total,
      timer: 0, gap: span / total / speed, skin: m ? m.img : 1,
      radius: PLANE.baseRadius * (m?.radius ?? 1), dmg: PLANE.baseDmg * (m?.dmg ?? 1), color: m?.color ?? 0xc9d0d8,
    };
    this.planeCd = PLANE.cooldown;
    this.events.push({ type: 'plane', x: this.player.x, y: this.player.y, color: 0x9fb7ff });
    return true;
  }

  pickKind(): EnemyKind {
    const pool = (Object.keys(ENEMIES) as EnemyKind[]).filter(k => ENEMIES[k].weight > 0 && ENEMIES[k].min <= this.wave);
    let total = 0; for (const k of pool) total += ENEMIES[k].weight;
    let r = this.random() * total;
    for (const k of pool) { r -= ENEMIES[k].weight; if (r <= 0) return k; }
    return 'runner';
  }

  spawnEnemy(x?: number, kind: EnemyKind = this.pickKind()): Enemy {
    const d = ENEMIES[kind];
    const hp = Math.round(d.hp * hpMultiplier(this.wave));
    const edge = this.viewHalf + 70;
    // They only ever come from the right, and never spawn close enough to be unfair.
    const spawnX = Math.max(this.camX, this.player.x) + edge;
    const lane = Math.round(this.random() * 14 - 4);
    const e: Enemy = {
      id: ++this.id, kind, x: x ?? spawnX, vy: 0, lane,
      y: kind === 'alien' ? WORLD.ground - 260 : d.fly ? WORLD.ground - 105 - this.random() * 90 : WORLD.ground + lane,
      hp, maxHp: hp, hit: 0, attack: 0, slow: 0, orb: 0, timer: 1 + this.random() * 1.5,
      off: (this.random() - .5) * 180, st: 0, t2: 4, t3: 8, tx: 0,
      speed: d.speed * (1 + (this.wave - 1) * .045) * (1 + Math.max(0, 1 / this.zoom - 1) * .45),
    };
    this.enemies.push(e);
    return e;
  }

  tick(dt: number, input: Input) {
    this.events = [];
    if (this.mode !== 'playing') return;
    dt = Math.min(dt, .0334); this.elapsed += dt; this.lastInput = input;
    this.updatePlayer(dt, input);
    for(let i=0;i<this.heat.length;i++){this.heat[i]=Math.max(0,this.heat[i]-dt*(this.overheated[i]?26:20));if(this.overheated[i]&&this.heat[i]<=15)this.overheated[i]=false;}
    this.updatePickups(dt);
    this.zoom += (zoomFor(this.wave) - this.zoom) * Math.min(1, dt * .9);
    this.camX += (this.camTarget() - this.camX) * Math.min(1, dt * 5);
    this.buildGrid();
    this.fireWeapons(dt, input);
    this.updateOrbit(dt);
    this.updateStrikes(dt);
    this.updateEnemies(dt);
    this.updateEnemyShots(dt);
    this.updateBullets(dt);
    this.updatePets(dt);
    this.updatePlane(dt, input);

    for (const e of this.pending) this.enemies.push(e);
    this.pending.length = 0;
    this.enemies = this.enemies.filter(e => e.hp > 0);
    const reach = this.viewHalf + 300;
    this.bullets = this.bullets.filter(b => b.life > 0 && b.pierce > 0 && Math.abs(b.x - this.camX) < reach && b.y > -2600 && b.y < 900);

    this.comboTime -= dt; if (this.comboTime <= 0) this.combo = 0;
    this.advanceWave();
    this.spawnWave(dt);
  }

  dropPickup(x:number,kind:'health'|'ammo'){if(this.pickups.length<16)this.pickups.push({id:++this.id,x,y:WORLD.ground,kind,life:20});}
  private updatePickups(dt:number){
    this.dropTimer-=dt;if(this.dropTimer<=0){this.dropPickup(Math.max(60,Math.min(1380,this.player.x+100)),'ammo');this.dropTimer=10;}
    for(const drop of this.pickups){drop.life-=dt;if(Math.abs(drop.x-this.player.x)<35&&Math.abs(this.player.y-drop.y)<55){
      if(drop.kind==='health'&&this.player.hp<100){this.player.hp=Math.min(100,this.player.hp+30);drop.life=0;}
      else if(drop.kind==='ammo'&&this.ammo[this.primary]<150){this.ammo[this.primary]=Math.min(150,this.ammo[this.primary]+45);drop.life=0;}
      if(drop.life===0)this.events.push({type:'pickup',x:drop.x,y:drop.y-30,color:drop.kind==='health'?0x94ffd0:0xffdc99,value:drop.kind==='health'?30:45});
    }}this.pickups=this.pickups.filter(d=>d.life>0);
  }

  // ── Player ───────────────────────────────────────────────────────
  private updatePlayer(dt: number, input: Input) {
    const p = this.player;
    p.invulnerable = Math.max(0, p.invulnerable - dt); p.dashCooldown = Math.max(0, p.dashCooldown - dt); p.dash = Math.max(0, p.dash - dt);
    p.facing = input.aimX >= p.x ? 1 : -1;
    if (input.jump && !this.jumped && p.y >= WORLD.ground) p.vy = -590;
    this.jumped = input.jump;
    if (input.dash && !this.dashed && p.dashCooldown <= 0) {
      p.dash = .18; p.invulnerable = .28; p.dashCooldown = 1.15; p.vx = (input.move || p.facing) * 850;
      this.events.push({ type: 'dash', x: p.x, y: p.y - 25, color: 0x9effef });
    }
    this.dashed = input.dash;
    if (p.dash <= 0) p.vx += (input.move * 280 - p.vx) * Math.min(1, dt * 18);
    p.x = Math.max(45, Math.min(WORLD.width - 45, p.x + p.vx * dt));
    p.vy += 1500 * dt; p.y += p.vy * dt;
    if (p.y >= WORLD.ground) { p.y = WORLD.ground; p.vy = 0; }
  }

  hurtPlayer(dmg: number, invuln = .75): boolean {
    const p = this.player;
    if (p.invulnerable > 0 || this.mode !== 'playing') return false;
    p.hp = Math.max(0, p.hp - dmg); p.invulnerable = invuln; this.combo = 0;
    this.events.push({ type: 'hurt', x: p.x, y: p.y - 30, color: 0xff5f82 });
    if (p.hp <= 0) this.mode = 'over';
    return true;
  }

  // ── Weapons: every active weapon fires on its own cadence, together ─
  private fireWeapons(dt: number, input: Input) {
    for (let i = 0; i < WEAPONS.length; i++) {
      const w = WEAPONS[i];
      if (i!==this.primary || !this.active[i] || w.rate <= 0) continue;
      this.cd[i] -= dt;
      if (input.shoot) {
        if(this.cd[i]<=0){
          const energy=w.shape==='beam';
          if(energy&&!this.overheated[i]){this.heat[i]=Math.min(100,this.heat[i]+8);if(this.heat[i]>=100)this.overheated[i]=true;this.fire(i,input);}
          else if(!energy&&this.ammo[i]>0){this.ammo[i]--;this.fire(i,input);}
          this.cd[i]=1/w.rate;
        }
      } else this.cd[i] = Math.max(0, this.cd[i]);
    }
    for (const v of this.volleys) {
      v.t -= dt;
      if (v.t <= 0) this.volley(v.i, this.aimAngle(input));
    }
    this.volleys = this.volleys.filter(v => v.t > 0);
  }

  private aimAngle(input: Input) { const p = this.player; return Math.atan2(input.aimY - (p.y - 34), input.aimX - p.x); }

  private fire(i: number, input: Input) {
    const w = WEAPONS[i];
    if (w.strike) { this.scheduleStrike(i, input); return; }
    this.volley(i, this.aimAngle(input));
    for (let k = 1; k < w.burst; k++) this.volleys.push({ t: k * w.burstGap, i });
  }

  private volley(i: number, angle: number) {
    const w = WEAPONS[i], p = this.player, cy = p.y - 34;
    const arm = w.spiral ? (this.spin[i] += w.spiral) : 0;
    const muzzle=muzzlePoint(w.art,p.x,cy,angle),mx=muzzle.x,my=muzzle.y;
    for (let n = 0; n < w.pellets; n++) {
      if (this.bullets.length >= MAX_BULLETS) break;
      let a: number;
      if (w.ring) a = arm + (n / w.pellets) * TAU;
      else if (w.pellets > 1 && !w.scatter) a = angle + (n / (w.pellets - 1) - .5) * 2 * w.spread;
      else a = angle + (this.random() - .5) * 2 * w.spread;
      const sp = w.speed * (1 + (this.random() - .5) * 2 * w.speedVar);
      const x = w.ring ? p.x : mx, y = w.ring ? cy : my;
      this.bullets.push({
        id: ++this.id, x, y, px: x, py: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: w.life, max: w.life, damage: w.damage, color: w.color, pierce: w.pierce, weapon: i,
        hit: null, bounces: 0, spin: this.random() * TAU,
        skin: 0, radius: w.explode, splash: w.splash, homing: w.homing, slow: w.slow,
      });
      if (w.shape === 'rocket') this.skinRocket(this.bullets[this.bullets.length - 1], w.missile);
    }
    this.shots++;
    this.events.push({ type: 'shot', x: mx, y: my, color: w.color, weapon: i });
  }

  /** Rocket-type mods wear the equipped gun missile: new sprite and stronger stats. */
  private skinRocket(b: Bullet, base: number) {
    const m = this.gunAmmo >= 0 ? MISSILES[this.gunAmmo] : null;
    b.skin = m ? m.img : base;
    if (!m) return;
    b.damage *= m.dmg; b.splash *= m.dmg; b.radius *= m.radius; b.homing += m.homing; b.pierce += m.pierce; b.slow = Math.max(b.slow, m.slow);
    const k = m.speed; b.vx *= k; b.vy *= k; b.color = m.color;
  }

  private scheduleStrike(i: number, input: Input) {
    const w = WEAPONS[i], s = w.strike!;
    for (let k = 0; k < s.count; k++) {
      const x = s.rain ? this.camX + (this.random() * 2 - 1) * this.viewHalf * .95 : input.aimX + (k - (s.count - 1) / 2) * s.spread;
      const t = s.delay + k * s.gap;
      this.strikes.push({ x, t, total: t, r: s.r, dmg: s.dmg, color: w.color, weapon: i });
    }
    this.shots++;
    this.events.push({ type: 'shot', x: this.player.x, y: this.player.y - 34, color: w.color, weapon: i });
  }

  private updateStrikes(dt: number) {
    for (const s of this.strikes) {
      s.t -= dt;
      if (s.t <= 0) this.boom(s.x, WORLD.ground - 30, s.r, s.dmg, s.color, false, s.weapon);
    }
    this.strikes = this.strikes.filter(s => s.t > 0);
  }

  private updateOrbit(dt: number) {
    this.blades.length = 0;
    this.orbitAngle += dt * 5.2;
    const p = this.player, cy = p.y - 35;
    let layer = 0;
    for (let i = 0; i < WEAPONS.length; i++) {
      const w = WEAPONS[i];
      if (!this.active[i] || !w.orbit || !this.lastInput.shoot || this.ammo[i]<=0) continue;
      const radius = 95 + layer * 38;
      for (let k = 0; k < w.orbit; k++) {
        const a = this.orbitAngle * (layer % 2 ? -1 : 1) + (k / w.orbit) * TAU;
        const bx = p.x + Math.cos(a) * radius, by = cy + Math.sin(a) * radius * .8;
        this.blades.push({ x: bx, y: by, color: w.color });
        for (const e of this.enemies) {
          if (e.hp <= 0 || e.orb > 0) continue;
          const d = ENEMIES[e.kind];
          if (Math.abs(e.x - bx) < d.w / 2 + 18 && by > e.y + d.top - 18 && by < e.y + d.top + d.h + 18) {
            e.orb = .14; this.damage(e, w.damage, w.color, Math.sign(e.x - p.x) || 1, 3, i);
          }
        }
      }
      layer++;
    }
  }

  // ── Damage, kills, explosions ────────────────────────────────────
  damage(e: Enemy, amount: number, color: number, dir: number, knock: number, weapon = 0) {
    if (e.hp <= 0) return;
    const d = ENEMIES[e.kind];
    const dealt = d.armor ? Math.max(amount * .25, amount - d.armor) : amount;
    e.hp -= dealt; e.hit = .085;
    e.x += dir * knock * (e.kind === 'alien' ? 0 : e.kind === 'titan' ? .15 : 1);
    this.events.push({ type: 'hit', x: e.x, y: e.y + d.top / 2, color });
    if (e.hp <= 0) this.kill(e, color, weapon);
  }

  private kill(e: Enemy, color: number, weapon: number) {
    const d = ENEMIES[e.kind], p = this.player;
    this.kills++; this.combo++; this.comboTime = 2.8;
    const points = Math.round(d.pts * this.multiplier * this.arsenalBonus);
    this.score += points;
    const cash = cashFor(e.kind, this.wave); this.cash += cash;
    this.events.push({ type: 'kill', x: e.x, y: e.y + d.top / 2, color, value: points, cash, weapon });
    if(this.random()<.035)this.dropPickup(e.x,'health');
    else if(this.random()<.25)this.dropPickup(e.x,'ammo');
    if (e.kind === 'splitter') {
      for (const s of [-1, 1]) {
        const m = this.spawnEnemyDetached(e.x + s * 14, 'mini');
        m.vy = -320; m.y = Math.min(m.y, WORLD.ground - 8);
      }
    }
    if (e.kind === 'bomber') this.boom(e.x, e.y - 25, 120, 70, 0xff6a4a, false, weapon);
  }

  /** Spawn without disturbing the array we may be iterating. */
  private spawnEnemyDetached(x: number, kind: EnemyKind) {
    const e = this.spawnEnemy(x, kind);
    this.enemies.pop(); this.pending.push(e);
    return e;
  }

  boom(x: number, y: number, r: number, dmg: number, color: number, hurtsPlayer = false, weapon = 0) {
    this.events.push({ type: 'boom', x, y, color, value: r, weapon });
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = ENEMIES[e.kind];
      const d2 = Math.hypot(e.x - x, e.y + d.top / 2 - y);
      if (d2 < r + d.w * .5) this.damage(e, dmg * (1 - .55 * Math.min(1, d2 / r)), color, Math.sign(e.x - x) || 1, r * .05, weapon);
    }
    if (hurtsPlayer) {
      const p = this.player;
      if (Math.hypot(p.x - x, p.y - 35 - y) < r + 20) this.hurtPlayer(25, .9);
    }
  }

  private chain(from: Enemy, damage: number, count: number, range: number, color: number, weapon: number) {
    const used = new Set<number>([from.id]);
    let cur = from;
    for (let k = 0; k < count; k++) {
      let best: Enemy | null = null, bestD = range;
      for (const e of this.enemies) {
        if (e.hp <= 0 || used.has(e.id)) continue;
        const d = Math.hypot(e.x - cur.x, e.y - cur.y);
        if (d < bestD) { bestD = d; best = e; }
      }
      if (!best) return;
      used.add(best.id);
      this.events.push({ type: 'arc', x: cur.x, y: cur.y - 30, x2: best.x, y2: best.y - 30, color });
      this.damage(best, damage * .75, color, Math.sign(best.x - cur.x) || 1, 2, weapon);
      cur = best;
    }
  }

  // ── Enemies ──────────────────────────────────────────────────────
  private updateEnemies(dt: number) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = ENEMIES[e.kind];
      e.hit = Math.max(0, e.hit - dt); e.attack -= dt; e.orb -= dt; e.slow = Math.max(0, e.slow - dt);
      const sm = e.slow > 0 ? .4 : 1;
      const gap = Math.abs(p.x - e.x);
      const tx = p.x + e.off * Math.min(1, Math.max(0, (gap - 60) / 300));
      const dir = Math.sign(tx - e.x) || 1;
      const base = WORLD.ground + e.lane;

      if (e.kind === 'alien') { this.alienAI(e, dt); continue; }
      if (e.kind === 'spitter') {
        const want = 380;
        if (gap > want + 60) e.x += dir * e.speed * sm * dt;
        else if (gap < want - 90) e.x -= dir * e.speed * .8 * sm * dt;
        e.timer -= dt;
        if (e.timer <= 0 && gap < 900) {
          e.timer = 2.1 + this.random() * .8;
          const ox = e.x, oy = e.y - 42, a = Math.atan2(p.y - 36 - oy, p.x - ox);
          this.enemyShots.push({ x: ox, y: oy, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430, life: 2.6, dmg: 9, color: 0xb6ff6a });
          this.events.push({ type: 'spit', x: ox, y: oy, color: d.accent });
        }
      } else if (e.kind === 'leaper') {
        e.timer -= dt;
        const airborne = e.y < base - 1;
        if (airborne) e.x += Math.sign(p.x - e.x) * e.speed * 2.6 * sm * dt;
        else {
          e.x += dir * e.speed * sm * dt;
          if (e.timer <= 0 && gap < 520 && gap > 90) { e.vy = -650; e.timer = 1.8 + this.random() * 1.2; }
        }
      } else if (e.kind === 'drone') {
        e.x += dir * e.speed * sm * dt; e.y += (p.y - 90 - e.y) * dt * .5;
      } else e.x += dir * e.speed * sm * dt;

      if (!d.fly && (e.y < base || e.vy !== 0)) {
        e.vy += 1500 * dt; e.y += e.vy * dt;
        if (e.y >= base) { e.y = base; e.vy = 0; }
      }

      if (e.kind === 'bomber' && gap < 48 && Math.abs(e.y - p.y) < 100) {
        e.hp = 0; this.boom(e.x, e.y - 25, 125, 60, 0xff6a4a, true); continue;
      }
      if (gap < d.w / 2 + 16 && Math.abs(e.y - p.y) < 115 && p.invulnerable <= 0 && e.attack <= 0) {
        if (this.hurtPlayer(d.dmg)) { e.attack = 1; e.x -= (Math.sign(p.x - e.x) || 1) * 35; }
      }
    }
  }

  /** The alien carrier: hovers on the right, fires fans of plasma, summons sprinters and dives at the hero. */
  private alienAI(e: Enemy, dt: number) {
    const p = this.player, rage = e.hp < e.maxHp * .5 ? 1.5 : 1;
    e.timer -= dt; e.t2 -= dt * rage; e.t3 -= dt;
    const hoverY = WORLD.ground - 250 + Math.sin(this.elapsed * 1.6 + e.id) * 18;
    if (e.st === 0) {
      e.x += (p.x + 400 - e.x) * Math.min(1, dt * .9); e.y += (hoverY - e.y) * Math.min(1, dt * 2.2);
      if (e.timer <= 0) {
        e.timer = 2.4 / rage;
        const ox = e.x - 150, oy = e.y + 10, base = Math.atan2(p.y - 36 - oy, p.x - ox);
        for (let k = -2; k <= 2; k++) {
          const a = base + k * .2;
          this.enemyShots.push({ x: ox, y: oy, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, life: 3, dmg: 12, color: 0x62f0ff });
        }
        this.events.push({ type: 'spit', x: ox, y: oy, color: 0x62f0ff });
      }
      if (e.t3 <= 0) {
        e.t3 = 11;
        for (let k = 0; k < 3; k++) { const m = this.spawnEnemyDetached(e.x + k * 40, 'sprinter'); m.y = WORLD.ground - 40; m.vy = 80; }
        this.events.push({ type: 'alien', x: e.x, y: e.y, color: 0x62f0ff, value: 1 });
      }
      if (e.t2 <= 0) { e.st = 1; e.t2 = .9; }
    } else if (e.st === 1) {
      e.y += (hoverY - 30 - e.y) * dt * 3; e.tx = p.x;
      if (e.t2 <= 0) { e.st = 2; e.t2 = 1.25; this.events.push({ type: 'alien', x: e.x, y: e.y, color: 0xff4f8b, value: 2 }); }
    } else if (e.st === 2) {
      const dx = e.tx - e.x, dy = WORLD.ground - 75 - e.y, dist = Math.hypot(dx, dy) || 1, step = Math.min(dist, 980 * dt);
      e.x += dx / dist * step; e.y += dy / dist * step;
      if (e.t2 <= 0 || dist < 24) { e.st = 3; e.t2 = 8 / rage; }
    } else {
      e.y += (hoverY - e.y) * Math.min(1, dt * 2.4); e.x += (p.x + 400 - e.x) * Math.min(1, dt);
      if (Math.abs(e.y - hoverY) < 20) e.st = 0;
    }
    const d = ENEMIES.alien;
    if (e.st === 2 && Math.abs(e.x - p.x) < d.w / 2 + 16 && Math.abs(e.y - p.y) < 130 && p.invulnerable <= 0) this.hurtPlayer(d.dmg, .9);
  }

  private updateEnemyShots(dt: number) {
    const p = this.player;
    for (const s of this.enemyShots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (Math.abs(s.x - p.x) < 20 && Math.abs(s.y - (p.y - 36)) < 48 && this.hurtPlayer(s.dmg, .5)) s.life = 0;
    }
    this.enemyShots = this.enemyShots.filter(s => s.life > 0);
  }

  // ── Projectiles ──────────────────────────────────────────────────
  private buildGrid() {
    for (let k = 0; k < this.grid.length; k++) { const cell = this.grid[k]; if (cell) cell.length = 0; }
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const k = Math.floor((e.x + BUCKET_ORIGIN) / BUCKET);
      if (k >= 0) (this.grid[k] ??= []).push(e);
    }
  }

  private nearest(x: number, y: number, range: number, skip: Set<number> | null): Enemy | null {
    let best: Enemy | null = null, bestD = range;
    for (const e of this.enemies) {
      if (e.hp <= 0 || (skip && skip.has(e.id))) continue;
      const d = Math.hypot(e.x - x, e.y - 30 - y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  private updateBullets(dt: number) {
    const cand: { e: Enemy; t: number }[] = [];
    for (const b of this.bullets) {
      const w = WEAPONS[b.weapon];
      b.px = b.x; b.py = b.y;
      if (b.homing) {
        const t = this.nearest(b.x, b.y, 650, b.hit);
        if (t) {
          const cur = Math.atan2(b.vy, b.vx), want = Math.atan2(t.y - 30 - b.y, t.x - b.x);
          let diff = want - cur; while (diff > Math.PI) diff -= TAU; while (diff < -Math.PI) diff += TAU;
          const turn = Math.max(-b.homing * dt, Math.min(b.homing * dt, diff)), sp = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(cur + turn) * sp; b.vy = Math.sin(cur + turn) * sp;
        }
      }
      if (w.grav) b.vy += w.grav * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; b.spin += dt * 18;
      if (w.bounce && b.vy > 0 && b.y > WORLD.ground - 4 && b.bounces < w.bounce) {
        b.y = WORLD.ground - 4; b.vy *= -.8; b.bounces++;
        if (w.rehit) b.hit = null;
      }

      cand.length = 0;
      const lo = Math.floor((Math.min(b.px, b.x) - 60 + BUCKET_ORIGIN) / BUCKET), hi = Math.floor((Math.max(b.px, b.x) + 60 + BUCKET_ORIGIN) / BUCKET);
      for (let k = Math.max(0, lo); k <= hi; k++) {
        const cell = this.grid[k]; if (!cell) continue;
        for (const e of cell) {
          if (e.hp <= 0 || (b.hit && b.hit.has(e.id))) continue;
          const d = ENEMIES[e.kind];
          const t = segmentHit(b.px, b.py, b.x, b.y, e.x - d.w / 2, e.y + d.top, d.w, d.h);
          if (t !== null) cand.push({ e, t });
        }
      }
      if (cand.length > 1) cand.sort((a, c) => a.t - c.t);
      for (const { e } of cand) {
        if (b.pierce <= 0) break;
        (b.hit ??= new Set()).add(e.id); b.pierce--;
        if (b.slow) e.slow = b.slow;
        this.damage(e, b.damage, b.color, Math.sign(b.vx) || 1, w.knock, b.weapon);
        if (w.chain) this.chain(e, b.damage, w.chain, w.chainRange, b.color, b.weapon);
      }
      if ((b.pierce <= 0 || b.life <= 0) && b.radius > 0) this.boom(b.x, b.y, b.radius, b.splash, b.color, false, b.weapon);
      if (b.pierce <= 0) b.life = 0;
    }
  }

  // ── Companions ───────────────────────────────────────────────────
  /** Pets stay relevant: their damage follows the enemy health curve. */
  get petPower() { return hpMultiplier(this.wave) ** .55; }

  private nearestGround(x: number, range: number): Enemy | null {
    let best: Enemy | null = null, bd = range;
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.kind === 'alien') continue;
      const d = Math.abs(e.x - x); if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  private updatePets(dt: number) {
    const p = this.player, pp = this.petPower;
    this.pets.forEach((pet, slot) => {
      const def = PETS[pet.id];
      pet.t += dt; pet.cd -= dt; pet.bite -= dt;
      const anchor = p.x - 70 - slot * 46, tgt = this.nearestGround(p.x, 620);
      const go = (x: number, speed: number) => { const dx = x - pet.x; if (Math.abs(dx) > 4) { pet.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt); pet.dir = Math.sign(dx); } };
      const hit = (e: Enemy, dmg: number, knock: number) => this.damage(e, dmg * pp, def.color, Math.sign(e.x - pet.x) || 1, knock, 0);
      if (pet.id !== 0) { pet.vy += 1500 * dt; pet.y += pet.vy * dt; if (pet.y >= WORLD.ground) { pet.y = WORLD.ground; pet.vy = 0; } }
      switch (def.id) {
        case 'parakeet': {
          pet.y += (WORLD.ground - 175 + Math.sin(pet.t * 3 + slot) * 14 - pet.y) * Math.min(1, dt * 4);
          go(anchor + 30, 320);
          const t = this.nearest(pet.x, pet.y, 800, null);
          if (t) pet.dir = Math.sign(t.x - pet.x) || 1;
          if (t && pet.cd <= 0 && this.bullets.length < MAX_BULLETS) {
            pet.cd = .7; const a = Math.atan2(t.y - 30 - pet.y, t.x - pet.x);
            this.bullets.push({ id: ++this.id, x: pet.x, y: pet.y, px: pet.x, py: pet.y, vx: Math.cos(a) * 1300, vy: Math.sin(a) * 1300, life: 1, max: 1, damage: 16 * pp, color: def.color, pierce: 1, weapon: 0, hit: null, bounces: 0, spin: 0, skin: 0, radius: 0, splash: 0, homing: 0, slow: 0 });
          }
          break;
        }
        case 'amstaff':
          if (tgt && Math.abs(tgt.x - p.x) < 620) { go(tgt.x - 34 * (Math.sign(tgt.x - pet.x) || 1), 330); if (Math.abs(tgt.x - pet.x) < 70 && pet.bite <= 0) { pet.bite = .45; hit(tgt, 24, 12); pet.anim = .2; } }
          else go(anchor, 280);
          break;
        case 'boar':
          if (pet.st === 1) {
            pet.x += pet.dir * 820 * dt; pet.anim = 1;
            for (const e of this.enemies) if (e.hp > 0 && !pet.hit.has(e.id) && Math.abs(e.x - pet.x) < 55 + ENEMIES[e.kind].w / 2 && e.kind !== 'alien') { pet.hit.add(e.id); hit(e, 55, 70); }
            if (pet.cd <= 0) { pet.st = 0; pet.cd = 2.4; pet.hit.clear(); }
          } else if (tgt && pet.cd <= 0 && Math.abs(tgt.x - pet.x) < 650 && tgt.x > pet.x - 100) { pet.st = 1; pet.dir = Math.sign(tgt.x - pet.x) || 1; pet.cd = .65; }
          else go(anchor, 300);
          break;
        case 'wolf':
          if (tgt && Math.abs(tgt.x - p.x) < 650) {
            if (pet.y >= WORLD.ground && pet.cd <= 0 && Math.abs(tgt.x - pet.x) > 110) { pet.vy = -430; pet.cd = .9; pet.dir = Math.sign(tgt.x - pet.x) || 1; }
            if (pet.y < WORLD.ground) pet.x += pet.dir * 640 * dt; else go(tgt.x - 30 * pet.dir, 380);
            if (Math.abs(tgt.x - pet.x) < 60 && pet.bite <= 0) { pet.bite = .3; hit(tgt, 34, 16); pet.anim = .15; }
          } else go(anchor, 340);
          break;
        case 'bunny':
          if (tgt && Math.abs(tgt.x - p.x) < 620) {
            if (Math.abs(tgt.x - pet.x) > 140) go(tgt.x - 110 * (Math.sign(tgt.x - pet.x) || 1), 190);
            if (pet.cd <= 0 && pet.y >= WORLD.ground && Math.abs(tgt.x - pet.x) < 250) { pet.cd = 3; pet.vy = -330; pet.st = 1; }
          } else go(anchor, 200);
          if (pet.st === 1 && pet.y < WORLD.ground - 4) pet.st = 2;
          if (pet.st === 2 && pet.y >= WORLD.ground - 2) {
            pet.st = 0; this.boom(pet.x, WORLD.ground - 20, 170, 110 * pp, def.color, false, 0);
            this.events.push({ type: 'stomp', x: pet.x, y: WORLD.ground, color: def.color });
          }
          break;
      }
      pet.x = Math.max(30, Math.min(WORLD.width + 600, pet.x));
      pet.anim = Math.max(0, pet.anim - dt);
    });
  }

  // ── Airstrike ────────────────────────────────────────────────────
  private updatePlane(dt: number, input: Input) {
    if (input.plane && !this.planeHeld) this.callPlane();
    this.planeHeld = !!input.plane;
    this.planeCd = Math.max(0, this.planeCd - dt);
    const pl = this.plane;
    if (pl) {
      pl.x += pl.vx * dt; pl.timer -= dt;
      if (pl.dropped < pl.total && pl.x > this.camX - this.viewHalf * .85 && pl.timer <= 0) {
        pl.timer = pl.gap; pl.dropped++;
        this.bombs.push({ x: pl.x, y: pl.y + 30, vx: pl.vx * .7, vy: 120, skin: pl.skin, radius: pl.radius, dmg: pl.dmg, color: pl.color, rot: 0 });
      }
      if (pl.x > this.camX + this.viewHalf + 520) this.plane = null;
    }
    for (const b of this.bombs) {
      b.vy += 1000 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 1 - dt * .35; b.rot = Math.atan2(b.vy, b.vx);
      let boom = b.y >= WORLD.ground - 18;
      if (!boom) for (const e of this.enemies) { const d = ENEMIES[e.kind]; if (e.hp > 0 && Math.abs(e.x - b.x) < d.w / 2 + 10 && b.y > e.y + d.top && b.y < e.y + d.top + d.h) { boom = true; break; } }
      if (boom) { this.boom(b.x, Math.min(b.y, WORLD.ground - 30), b.radius, b.dmg, b.color, false, 0); b.y = 9999; }
    }
    this.bombs = this.bombs.filter(b => b.y < 5000 && Math.abs(b.x - this.camX) < this.viewHalf + 1500);
  }

  // ── Waves, spawning ─────────────────────────────────────
  private advanceWave() {
    const wave = waveInfo(this.kills).wave;
    if (wave === this.wave) return;
    this.wave = wave; this.cash+=25+wave*5;this.ammo[this.primary]=Math.min(150,this.ammo[this.primary]+30);
    this.events.push({ type: 'wave', x: 720, y: 300, color: 0xff86b8, value: wave });
    for (let n = 0; n < (TITAN_WAVES[wave] ?? 0); n++) this.spawnEnemy(undefined, 'titan');
    for (let n = 0; n < (ALIEN_WAVES[wave] ?? 0); n++) { const a = this.spawnEnemy(undefined, 'alien'); a.x += n * 260; this.events.push({ type: 'alien', x: a.x, y: a.y, color: 0x62f0ff, value: 0 }); }
  }

  private spawnWave(dt: number) {
    this.spawnTime -= dt;
    if (this.spawnTime > 0) return;
    const group = spawnGroup(this.wave), cap = maxEnemies(this.wave);
    for (let g = 0; g < group && this.enemies.length < cap; g++) this.spawnEnemy();
    this.spawnTime = spawnGap(this.wave);
  }
}

// Swept segment vs AABB: high-speed bullets cannot skip over targets between frames.
export function segmentHit(x0: number, y0: number, x1: number, y1: number, x: number, y: number, w: number, h: number): number | null {
  let near = 0, far = 1;
  for (const [origin, delta, min, max] of [[x0, x1 - x0, x, x + w], [y0, y1 - y0, y, y + h]]) {
    if (Math.abs(delta) < 1e-8) { if (origin < min || origin > max) return null; }
    else {
      let a = (min - origin) / delta, b = (max - origin) / delta;
      if (a > b) [a, b] = [b, a];
      near = Math.max(near, a); far = Math.min(far, b);
      if (near > far) return null;
    }
  }
  return near;
}
