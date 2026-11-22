import {test} from 'node:test';import assert from 'node:assert/strict';
import {Simulation,segmentHit} from '../src/game/simulation';import {WEAPONS,modDps} from '../src/game/weapons';import {PETS} from '../src/game/pets';import {muzzlePoint,gunGeometry} from '../src/game/geometry';import {waveInfo} from '../src/game/enemies';
const input={move:0,jump:false,dash:false,shoot:false,aimX:1100,aimY:601};
const fresh=()=>{const s=new Simulation(()=>.5);s.start();s.enemies=[];(s as unknown as {spawnTime:number}).spawnTime=999;return s;};
const run=(s:Simulation,n=120,i=input)=>{for(let t=0;t<n;t++)s.tick(1/120,i);};
test('every higher priced tier has strictly increasing hit damage and DPS',()=>{for(let i=1;i<35;i++){assert.ok(WEAPONS[i].price>WEAPONS[i-1].price);assert.ok(WEAPONS[i].damage>WEAPONS[i-1].damage,WEAPONS[i].name);assert.ok(modDps(WEAPONS[i])>modDps(WEAPONS[i-1]),WEAPONS[i].name);}});
test('purchase equips exactly one gun, ownership persists, switching never disables all',()=>{const s=fresh();s.cash=1e6;for(let i=1;i<35;i++){assert.ok(s.buy(i));assert.equal(s.activeCount,1);assert.equal(s.primary,i);}s.select(0);assert.equal(s.primary,0);s.select(0);assert.equal(s.activeCount,1);assert.equal(s.ownedCount,35);});
test('unowned and invalid guns cannot equip or buy',()=>{const s=fresh();s.select(20);s.select(99);s.select(-1);assert.equal(s.primary,0);assert.equal(s.buy(99),false);s.cash=0;assert.equal(s.buy(2),false);});
test('ordinary fire spends finite ammo and stops on empty; switching cancels queued burst',()=>{const s=fresh();s.ammo[0]=3;run(s,240,{...input,shoot:true});assert.equal(s.shots,3);assert.equal(s.ammo[0],0);s.cash=1e6;s.buy(3);s.select(0);run(s,60,{...input,shoot:true});assert.equal(s.shots,3);});
test('laser overheats then cools without consuming rounds',()=>{const s=fresh();s.cash=1e6;s.buy(4);let locked=false;for(let i=0;i<300;i++){s.tick(1/120,{...input,shoot:true});locked ||= s.overheated[4];}assert.ok(locked);assert.equal(s.ammo[4],90);run(s,600);assert.equal(s.heat[4],0);assert.equal(s.overheated[4],false);});
test('all 35 barrels have shared geometry inside hero scale, including left aim',()=>{for(const w of WEAPONS){const g=gunGeometry(w.art);assert.ok(g.length<=46&&g.length>5);for(const a of [0,Math.PI,.6,-2]){const m=muzzlePoint(w.art,100,200,a);assert.ok(Math.hypot(m.x-100,m.y-200)<48);assert.ok(Number.isFinite(m.y));}}});
test('swept collisions catch ultra-fast bullets',()=>{assert.equal(segmentHit(0,20,1000,20,500,0,30,60),.5);assert.equal(segmentHit(0,80,1000,80,500,0,30,60),null);});
test('medkit heals 30 and is consumed, ammo supplies replenish current gun',()=>{const s=fresh();s.player.hp=40;s.dropPickup(s.player.x,'health');s.tick(1/120,input);assert.equal(s.player.hp,70);assert.equal(s.pickups.length,0);s.ammo[0]=0;s.dropPickup(s.player.x,'ammo');s.tick(1/120,input);assert.equal(s.ammo[0],45);});
test('shop supplies respect funds and capacity',()=>{const s=fresh();s.cash=8;s.ammo[0]=0;assert.ok(s.buyAmmo());assert.equal(s.cash,0);assert.equal(s.ammo[0],60);assert.equal(s.buyAmmo(),false);s.cash=100;assert.equal(s.buyHeal(),false);s.player.hp=50;assert.ok(s.buyHeal());assert.equal(s.player.hp,85);});
test('all five companions independently attack enemies',()=>{for(let id=0;id<PETS.length;id++){const s=fresh();s.cash=1e6;s.buyPet(id);const e=s.spawnEnemy(600,'heavy');e.hp=e.maxHp=10000;e.speed=0;run(s,900);assert.ok(e.hp<10000,PETS[id].name);}});
test('purchased special attack drops bombs, cooldown prevents repeated use',()=>{const s=fresh();s.cash=1e6;assert.equal(s.callPlane(),false);s.buyPlane();assert.ok(s.callPlane());assert.equal(s.callPlane(),false);run(s,150);assert.ok(s.bombs.length>0||s.plane?.dropped);assert.ok(s.planeCd>0);});
test('pause freezes all simulation; restart resets ammo and ownership',()=>{const s=fresh();s.mode='paused';const before=s.elapsed;run(s,120,{...input,shoot:true});assert.equal(s.elapsed,before);s.restart();assert.equal(s.ammo[0],90);assert.equal(s.ownedCount,1);assert.equal(s.player.hp,100);});
test('stage progression grants cash and ammo, not automatic healing',()=>{const s=fresh();s.kills=12;s.player.hp=40;s.ammo[0]=1;s.tick(1/120,input);assert.equal(s.wave,2);assert.equal(s.player.hp,40);assert.equal(s.ammo[0],31);assert.equal(waveInfo(0).quota,12);});

import { ABILITY } from '../src/game/simulation';
import { hpMultiplier, cashFor } from '../src/game/enemies';
const dummy = (s: Simulation, x: number) => { const e = s.spawnEnemy(x, 'runner'); e.speed = 0; return e; };

test('abilities: G throws a grenade that recharges, F fires the shop missile on a cooldown', () => {
  const sim = fresh();
  for (const x of [700, 730, 760]) { const e = dummy(sim, x); e.hp = e.maxHp = 60; }
  sim.tick(1 / 120, { ...input, grenade: true, aimX: 730, aimY: 600 });
  assert.equal(sim.grenades, ABILITY.grenadeMax - 1);
  sim.tick(1 / 120, { ...input, grenade: true, aimX: 730, aimY: 600 });
  assert.equal(sim.grenades, ABILITY.grenadeMax - 1, 'holding G throws once');
  run(sim, 240, { ...input, aimX: 730, aimY: 600 });
  assert.ok(sim.kills >= 2, `grenade kills: ${sim.kills}`);
  run(sim, 120 * (ABILITY.grenadeRegen + 1));
  assert.equal(sim.grenades, ABILITY.grenadeMax, 'grenades recharge');

  assert.equal(sim.fireMissile({ ...input }), false, 'no missile until one is bought');
  sim.cash = 1e6; sim.buyMissile(0);
  const e = dummy(sim, 900); e.hp = e.maxHp = 80;
  sim.tick(1 / 120, { ...input, missile: true, aimX: 900, aimY: e.y - 30 });
  assert.ok(sim.missileCd > 0 && !sim.missileReady);
  run(sim, 200, { ...input, aimX: 900, aimY: e.y - 30 });
  assert.ok(e.hp <= 0, 'missile kills');
});

test('each wave adds health and pays more', () => {
  for (let w = 2; w <= 50; w++) { assert.ok(hpMultiplier(w) > hpMultiplier(w - 1) * (w <= 10 ? 1.2 : 1.05), `wave ${w}`); assert.ok(cashFor('runner', w) >= cashFor('runner', w - 1)); }
  assert.ok(cashFor('runner', 10) > cashFor('runner', 1) * 5);
});

import { USE_ALL, STREAK, WORLD } from '../src/game/simulation';
import { FINAL_WAVE, WAVE_QUOTA, TRUCK_WAVES } from '../src/game/enemies';
import { handPoint, heroFrame, RUN_FRAMES } from '../src/game/hero';

test('hero frames: idle, run cycle both ways, jump/fall; gun sits on the front hand on either side', () => {
  const g = 635, base = { x: 500, y: g, vx: 0, vy: 0, facing: 1 };
  assert.equal(heroFrame(base, 0, g), 10);
  const seen = new Set<number>(); for (let t = 0; t < 1; t += .02) seen.add(heroFrame({ ...base, vx: 280 }, t, g));
  assert.deepEqual([...seen].sort(), [...RUN_FRAMES].sort());
  assert.equal(heroFrame({ ...base, y: g - 80, vy: -300 }, 0, g), 7); assert.equal(heroFrame({ ...base, y: g - 80, vy: 300 }, 0, g), 8);
  const r = handPoint(base, 0, g), l = handPoint({ ...base, facing: -1 }, 0, g);
  assert.ok(r.x > 500 && l.x < 500 && Math.abs((r.x - 500) + (l.x - 500)) < 1e-9, 'hand mirrors with facing');
  assert.ok(r.y < g - 20 && r.y > g - 45, 'hand at chest height');
});

test('fifty waves; the garbage truck closes the acts', () => {
  assert.equal(FINAL_WAVE, 50); assert.equal(WAVE_QUOTA.length, 50);
  for (const w of [10, 20, 30, 40, 48]) assert.ok(TRUCK_WAVES[w] >= 1);
  const s = fresh(); s.player.hp = 100;
  const t = s.spawnTruck(); assert.equal(t.kind, 'truck'); assert.ok(t.x > s.player.x + 400, 'enters from the right');
  let bags = 0, rammed = false;
  for (let i = 0; i < 120 * 14; i++) { s.player.hp = 100; s.player.invulnerable = 1; s.tick(1 / 120, input); bags = Math.max(bags, s.bags.length); if (t.st === 4) rammed = true; }
  assert.ok(bags >= 3, 'throws garbage bags'); assert.ok(rammed, 'rams'); assert.ok(s.splats.length >= 0);
  const cash = s.cash; s.damage(t, 1e9, 0xffffff, 1, 0); assert.ok(s.cash - cash >= 300, 'pays big'); assert.equal(s.mode, 'playing', 'a normal truck is not the finale');
  assert.ok(!TRUCK_WAVES[50], 'wave 50 belongs to the final boss');
});

test('USE ALL needs all 35 weapons and $100K, then fires every weapon at once', () => {
  const s = fresh(); s.cash = 1e7; assert.equal(s.buyUseAll(), false, 'locked until all owned');
  for (let i = 1; i < 35; i++) s.buy(i); assert.ok(s.allWeaponsOwned);
  const before = s.cash; assert.ok(s.buyUseAll()); assert.equal(before - s.cash, USE_ALL.price);
  assert.ok(s.activateUseAll()); s.shots = 0; run(s, 60);
  assert.ok(s.shots > 30, `fired ${s.shots}`); assert.equal(s.activateUseAll(), false, 'cooldown');
});

test('OP check: heal price rises per wave with a cooldown; a clean streak triggers OVERDRIVE', () => {
  const s = fresh(); s.cash = 1e6; s.player.hp = 10; const p1 = s.healPrice; assert.ok(s.buyHeal()); assert.equal(s.buyHeal(), false, 'cooldown');
  s.wave = 10; assert.ok(s.healPrice > p1 * 5);
  const t = fresh(); for (let i = 0; i < STREAK.overdriveAt; i++) { const e = t.spawnEnemy(900, 'runner'); t.damage(e, 1e9, 0xffffff, 1, 0); }
  assert.ok(t.overdrive > 0); t.hurtPlayer(1); assert.equal(t.streak, 0);
});


import { CRIT_MULT, WEAK_POINTS } from '../src/game/enemies';
import { FINAL_BOSS } from '../src/game/simulation';
import { damageFontSize, formatDamage } from '../src/phaser/damageNumbers';

test('headshots: weak point hits crit by a fixed multiplier, body hits do not; events carry real damage', () => {
  const s = fresh(); const e = s.spawnEnemy(900, 'runner'); e.speed = 0; e.hp = e.maxHp = 1e6;
  const top = e.y - 57;
  assert.equal(s.isWeakPoint(e, 900, top + 5), true); assert.equal(s.isWeakPoint(e, 900, top + 45), false);
  s.damage(e, 100, 0xffffff, 1, 0, 0, true); const crit = s.events.at(-1)!;
  s.damage(e, 100, 0xffffff, 1, 0, 0, false); const body = s.events.at(-1)!;
  assert.equal(crit.value, 100 * CRIT_MULT); assert.equal(crit.crit, true); assert.equal(body.value, 100); assert.equal(body.crit, false);
  // a real head-height shot from the hero crits, a chest-height one does not
  const shoot = (y: number) => { const t = fresh(); const r = t.spawnEnemy(900, 'runner'); r.speed = 0; r.hp = r.maxHp = 1e6; let c = 0, n = 0; for (let i = 0; i < 240; i++) { t.tick(1 / 120, { ...input, shoot: true, aimX: 900, aimY: y }); for (const ev of t.events) if (ev.type === 'hit') { n++; if (ev.crit) c++; } } return { c, n }; };
  const head = shoot(top + 6), chest = shoot(top + 40);
  assert.ok(head.n > 0 && head.c === head.n, `head ${head.c}/${head.n}`); assert.ok(chest.n > 0 && chest.c === 0, `chest ${chest.c}/${chest.n}`);
  assert.ok(WEAK_POINTS.applicant && WEAK_POINTS.alien && WEAK_POINTS.truck);
  assert.ok(damageFontSize(5000, false) > damageFontSize(20, false) && damageFontSize(1e9, true) <= 46);
  assert.equal(formatDamage(1234), '1.2K'); assert.equal(formatDamage(2500000), '2.5M');
});

test('final boss: wave 50 clears the street, stops spawns, three phases of paper attacks, defeat leads to the ending', () => {
  const s = fresh(); s.wave = 49; s.kills = WAVE_QUOTA.slice(0, 49).reduce((a, b) => a + b, 0);
  for (let i = 0; i < 10; i++) s.spawnEnemy(1000, 'runner');
  (s as unknown as { spawnTime: number }).spawnTime = 0; s.tick(1 / 120, input);
  const boss = s.boss!; assert.ok(boss, 'boss spawned'); assert.equal(s.finale, true);
  run(s, 2); assert.equal(s.enemies.filter(e => e.kind !== 'applicant').length, 0, 'street cleared');
  assert.ok(boss.maxHp >= FINAL_BOSS.minHp);
  let tosses = 0, rains = 0, charged = false; const phases = new Set<number>();
  for (let i = 0; i < 120 * 60; i++) {
    s.player.hp = 100; s.player.invulnerable = 1;
    if (i === 120 * 15) boss.hp = boss.maxHp * .6; if (i === 120 * 32) boss.hp = boss.maxHp * .3;
    s.tick(1 / 120, input); phases.add(s.bossPhase(boss));
    tosses = Math.max(tosses, s.sheets.filter(x => x.kind === 'toss').length); rains = Math.max(rains, s.marks.length); if (boss.st === 5) charged = true;
    assert.equal(s.enemies.filter(e => e.kind !== 'applicant').length, 0, 'no spawns during the finale');
  }
  assert.deepEqual([...phases].sort(), [1, 2, 3]); assert.ok(tosses >= 3, `fan of sheets ${tosses}`); assert.ok(rains >= 5, 'paper rain warnings'); assert.ok(charged, 'charges in phase 3');
  s.player.invulnerable = 0; s.sheets = []; s.sheets.push({ x: s.player.x, y: s.player.y - 36, vx: 0, vy: 0, rot: 0, spin: 0, life: 1, ph: 0, kind: 'toss' });
  s.tick(1 / 120, input); assert.equal(s.player.hp, 100 - FINAL_BOSS.sheetDmg, 'sheets hurt with a fair, fixed amount');
  s.damage(boss, 1e12, 0xffffff, 1, 0); assert.ok(s.defeat); assert.equal(s.mode, 'playing', 'defeat animation plays first');
  run(s, 120 * 3); assert.equal(s.mode, 'won');
  s.hired = true; s.endless = true; s.mode = 'playing'; s.finale = false; const r = s.spawnEnemy(s.player.x + 300, 'runner'); r.speed = 0; r.hp = r.maxHp = 50;
  run(s, 120 * 4); assert.ok(r.hp <= 0, 'the new colleague fights');
});

test('headshots on wide targets: a straight shot through the final boss face crits, one through its belly does not', () => {
  const s = fresh(); s.finale = true; const b = s.spawnEnemy(900, 'applicant'); b.hp = b.maxHp = 1e9; b.st = 6; b.t2 = 1e9; b.t3 = 1;
  const r = s.weakRect(b)!; assert.ok(r.w > 0 && r.h > 0);
  assert.equal(s.isWeakPoint(b, 600, r.y + r.h / 2, 950, r.y + r.h / 2), true, 'face line');
  assert.equal(s.isWeakPoint(b, 600, b.y - 40, 950, b.y - 40), false, 'belly line');
  const shoot = (y: number) => { let c = 0, n = 0; for (let i = 0; i < 180; i++) { s.tick(1 / 120, { ...input, shoot: true, aimX: 900, aimY: y }); for (const ev of s.events) if (ev.type === 'hit') { n++; if (ev.crit) c++; } } return { c, n }; };
  const face = shoot(r.y + r.h / 2); s.bullets = []; const belly = shoot(b.y - 40);
  assert.ok(face.n > 0 && face.c / face.n > .8, `face ${face.c}/${face.n}`); assert.equal(belly.c, 0);
});

test('jetpack: a tap is a normal jump, holding Space flies higher, burns fuel and refills on the ground', () => {
  const peak = (holdTicks: number) => {
    const s = fresh(); let top = WORLD.ground;
    for (let i = 0; i < 360; i++) { s.tick(1 / 120, { ...input, jump: i < holdTicks }); top = Math.min(top, s.player.y); }
    return { s, rise: WORLD.ground - top };
  };
  const tap = peak(3), hold = peak(240);
  assert.equal(tap.s.jetFuel, 1, 'a tap never touches the jetpack');
  assert.ok(hold.rise > tap.rise * 1.8, `holding flies higher (${hold.rise.toFixed(0)} vs ${tap.rise.toFixed(0)})`);
  assert.ok(hold.s.jetFuel < 1, 'flying burns fuel');
  const s = hold.s; for (let i = 0; i < 120 * 4; i++) s.tick(1 / 120, input);
  assert.equal(s.player.y, WORLD.ground); assert.equal(s.jetFuel, 1, 'fuel refills on the ground');
  // an empty tank means no thrust
  s.jetFuel = 0; for (let i = 0; i < 60; i++) s.tick(1 / 120, { ...input, jump: true }); assert.equal(s.jetOn, false);
});
