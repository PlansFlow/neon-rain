import { WEAPONS } from './weapons';
export const WORLD = { width:1440, height:810, ground:635 };
export type Mode = 'ready'|'playing'|'paused'|'over';
export interface Input { move:number; jump:boolean; dash:boolean; shoot:boolean; aimX:number; aimY:number; }
export interface Enemy {id:number;x:number;y:number;hp:number;maxHp:number;speed:number;kind:'runner'|'heavy'|'drone';hit:number;attack:number;}
export interface Bullet {id:number;x:number;y:number;px:number;py:number;vx:number;vy:number;life:number;damage:number;color:number;pierce:number;hit:Set<number>;weapon:number;}
export interface GameEvent {type:'shot'|'hit'|'kill'|'hurt'|'dash'|'wave';x:number;y:number;color:number;value?:number;weapon?:number;}
export class Simulation {
 mode:Mode='ready'; player={x:650,y:WORLD.ground,vx:0,vy:0,hp:100,invulnerable:0,dash:0,dashCooldown:0,facing:1};
 weapon=0;score=0;kills=0;wave=1;combo=0;comboTime=0;elapsed=0;bullets:Bullet[]=[];enemies:Enemy[]=[];events:GameEvent[]=[];
 shots=0;private id=0;private cooldown=0;private spawnTime=.4;private jumped=false;private dashed=false;
 constructor(private random:()=>number=Math.random){}
 start(){this.mode='playing';this.spawnEnemy(1210);this.spawnEnemy(170);}
 restart(){const rng=this.random;Object.assign(this,new Simulation(rng));this.start();}
 select(i:number){if(i>=0&&i<WEAPONS.length){this.weapon=i;this.cooldown=0;}}
 spawnEnemy(x?:number){const kind=this.wave>1&&this.random()<.22?'drone':this.random()<.2?'heavy':'runner';const maxHp=kind==='heavy'?150:kind==='drone'?45:65;this.enemies.push({id:++this.id,x:x??(this.random()<.5?-35:1475),y:kind==='drone'?WORLD.ground-105-this.random()*90:WORLD.ground,hp:maxHp,maxHp,speed:kind==='heavy'?42:kind==='drone'?70:65+this.wave*7,kind,hit:0,attack:0});}
 tick(dt:number,input:Input){
 this.events=[];if(this.mode!=='playing')return;dt=Math.min(dt,.0334);this.elapsed+=dt;
 const p=this.player;p.invulnerable=Math.max(0,p.invulnerable-dt);p.dashCooldown=Math.max(0,p.dashCooldown-dt);p.dash=Math.max(0,p.dash-dt);
 p.facing=input.aimX>=p.x?1:-1;
 if(input.jump&&!this.jumped&&p.y>=WORLD.ground){p.vy=-590;}this.jumped=input.jump;
 if(input.dash&&!this.dashed&&p.dashCooldown<=0){p.dash=.18;p.invulnerable=.28;p.dashCooldown=1.15;p.vx=(input.move||p.facing)*850;this.events.push({type:'dash',x:p.x,y:p.y-25,color:0x9effef});}this.dashed=input.dash;
 if(p.dash<=0)p.vx+=(input.move*280-p.vx)*Math.min(1,dt*18);
 p.x=Math.max(45,Math.min(WORLD.width-45,p.x+p.vx*dt));p.vy+=1500*dt;p.y+=p.vy*dt;if(p.y>=WORLD.ground){p.y=WORLD.ground;p.vy=0;}
 this.cooldown-=dt;if(input.shoot&&this.cooldown<=0){this.fire(input);this.cooldown+=1/WEAPONS[this.weapon].rate;}else if(!input.shoot)this.cooldown=Math.max(0,this.cooldown);
 for(const e of this.enemies){e.hit=Math.max(0,e.hit-dt);e.attack-=dt;const dir=Math.sign(p.x-e.x);e.x+=dir*e.speed*dt;if(e.kind==='drone')e.y+=(p.y-90-e.y)*dt*.5;
 if(Math.abs(e.x-p.x)<30&&Math.abs(e.y-p.y)<115&&p.invulnerable<=0&&e.attack<=0){p.hp=Math.max(0,p.hp-(e.kind==='heavy'?20:12));p.invulnerable=.75;e.attack=1;e.x-=dir*35;this.combo=0;this.events.push({type:'hurt',x:p.x,y:p.y-30,color:0xff5f82});if(p.hp<=0)this.mode='over';}}
 for(const b of this.bullets){b.px=b.x;b.py=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
 const collisions=this.enemies.filter(e=>e.hp>0&&!b.hit.has(e.id)).map(e=>({e,t:segmentHit(b.px,b.py,b.x,b.y,e.x-(e.kind==='heavy'?20:15),e.y-(e.kind==='drone'?22:57),e.kind==='heavy'?40:30,e.kind==='drone'?35:57)})).filter(v=>v.t!==null).sort((a,b)=>a.t!-b.t!);
 for(const {e} of collisions){if(b.pierce<=0)break;b.hit.add(e.id);b.pierce--;e.hp-=b.damage;e.hit=.085;e.x+=Math.sign(b.vx)*(b.weapon===1?5:1.2);this.events.push({type:'hit',x:e.x,y:e.y-30,color:b.color});if(e.hp<=0){this.kills++;this.combo++;this.comboTime=2.8;const points=(e.kind==='heavy'?150:e.kind==='drone'?125:100)*this.multiplier;this.score+=points;this.events.push({type:'kill',x:e.x,y:e.y-35,color:b.color,value:points});if(this.kills%8===0)p.hp=Math.min(100,p.hp+8);}}
 }
 this.enemies=this.enemies.filter(e=>e.hp>0);this.bullets=this.bullets.filter(b=>b.pierce>0&&b.life>0&&b.x>-150&&b.x<1590&&b.y>-100&&b.y<830);
 this.comboTime-=dt;if(this.comboTime<=0)this.combo=0;const wave=1+Math.floor(this.kills/12);if(wave!==this.wave){this.wave=wave;p.hp=Math.min(100,p.hp+20);this.events.push({type:'wave',x:720,y:300,color:0xff86b8,value:wave});}
 this.spawnTime-=dt;if(this.spawnTime<=0&&this.enemies.length<22){this.spawnEnemy();this.spawnTime=Math.max(.32,1.25-this.wave*.09);}
 }
 get multiplier(){return Math.min(5,1+Math.floor(this.combo/4));}
 private fire(input:Input){const w=WEAPONS[this.weapon],p=this.player;const angle=Math.atan2(input.aimY-(p.y-34),input.aimX-p.x);const x=p.x+Math.cos(angle)*35,y=p.y-34+Math.sin(angle)*35;for(let i=0;i<w.pellets;i++){const a=angle+(w.pellets>1?(i/(w.pellets-1)-.5)*2*w.spread:(this.random()-.5)*2*w.spread);this.bullets.push({id:++this.id,x,y,px:x,py:y,vx:Math.cos(a)*w.speed,vy:Math.sin(a)*w.speed,life:1.3,damage:w.damage,color:w.color,pierce:w.pierce,hit:new Set(),weapon:this.weapon});}this.shots++;this.events.push({type:'shot',x,y,color:w.color,weapon:this.weapon});}
}
// Swept segment vs AABB: high-speed bullets cannot skip over targets between frames.
export function segmentHit(x0:number,y0:number,x1:number,y1:number,x:number,y:number,w:number,h:number):number|null {let near=0,far=1;for(const [origin,delta,min,max] of [[x0,x1-x0,x,x+w],[y0,y1-y0,y,y+h]]){if(Math.abs(delta)<1e-8){if(origin<min||origin>max)return null;}else{let a=(min-origin)/delta,b=(max-origin)/delta;if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return null;}}return near;}
