import Phaser from 'phaser';
import { Simulation, type Input } from '../game/simulation';
import { WEAPONS } from '../game/weapons';
import { Sound } from '../game/audio';
import { environment } from './environment';
interface Particle{x:number;y:number;vx:number;vy:number;life:number;max:number;color:number;size:number;}
export class StreetScene extends Phaser.Scene {
 sim:Simulation;soundFX:Sound;private actors!:Phaser.GameObjects.Graphics;private fx!:Phaser.GameObjects.Graphics;private rain!:Phaser.GameObjects.Graphics;private aim!:Phaser.GameObjects.Graphics;
 private particles:Particle[]=[];private drops=Array.from({length:160},()=>({x:Math.random()*1440,y:Math.random()*810,s:250+Math.random()*350}));private keys!:Record<string,Phaser.Input.Keyboard.Key>;private accumulator=0;private hudTime=0;private visualTime=0;private recoil=0;
 touch={left:false,right:false,jump:false,dash:false,shoot:false};onHud:()=>void=()=>{};private reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 constructor(sim:Simulation,sound:Sound){super('street');this.sim=sim;this.soundFX=sound;}
 create(){environment(this);this.actors=this.add.graphics().setDepth(4);this.fx=this.add.graphics().setDepth(5);this.rain=this.add.graphics().setDepth(6);this.aim=this.add.graphics().setDepth(10);
 this.keys=this.input.keyboard!.addKeys('A,D,W,SPACE,SHIFT,LEFT,RIGHT,UP') as Record<string,Phaser.Input.Keyboard.Key>;this.input.mouse!.disableContextMenu();this.input.addPointer(2);
 this.input.on('wheel',(_p:unknown,_a:unknown,_x:number,y:number)=>{this.sim.select((this.sim.weapon+(y>0?1:4))%5);this.onHud();});
 this.game.events.on('blur',()=>{if(this.sim.mode==='playing'){this.sim.mode='paused';this.touch={left:false,right:false,jump:false,dash:false,shoot:false};this.onHud();}});
 this.onHud();}
 update(_time:number,delta:number){const dt=Math.min(delta/1000,.05);this.visualTime+=dt;
 if(!this.actors)return;const p=this.sim.player,pointer=this.input.activePointer;let aimX=pointer.x,aimY=pointer.y;if(!pointer.isDown&&pointer.x===0){aimX=p.x+300;aimY=p.y-32;}
 const isTouch=window.matchMedia('(pointer: coarse)').matches;if(isTouch){const e=[...this.sim.enemies].sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];aimX=e?.x??p.x+p.facing*300;aimY=e?e.y-30:p.y-34;}
 const input:Input={move:Number(this.keys.D.isDown||this.keys.RIGHT.isDown||this.touch.right)-Number(this.keys.A.isDown||this.keys.LEFT.isDown||this.touch.left),jump:this.keys.W.isDown||this.keys.UP.isDown||this.keys.SPACE.isDown||this.touch.jump,dash:this.keys.SHIFT.isDown||this.touch.dash,shoot:((pointer.isDown&&pointer.downElement===this.game.canvas)||this.touch.shoot),aimX,aimY};
 this.accumulator+=dt;while(this.accumulator>=1/120){this.sim.tick(1/120,input);for(const e of this.sim.events){if(e.type==='shot'){this.recoil=WEAPONS[this.sim.weapon].recoil;this.burst(e.x,e.y,e.color,this.sim.weapon===1?8:3,110);this.soundFX.play('shot',e.weapon);}else if(e.type==='kill'){this.burst(e.x,e.y,e.color,18,220);this.soundFX.play('kill');this.floatText(e.x,e.y-32,'+'+e.value,'#f9e7d8');}else if(e.type==='hit'){this.burst(e.x,e.y,e.color,4,100);}else if(e.type==='hurt'){this.soundFX.play('hurt');if(!this.reduced)this.cameras.main.shake(110,.002);this.burst(e.x,e.y,e.color,14,150);}else if(e.type==='dash'){this.burst(e.x,e.y,e.color,16,90);}else if(e.type==='wave'){this.floatText(720,270,'WAVE '+String(e.value).padStart(2,'0'),'#f69bc2',30);}}this.accumulator-=1/120;}
 this.recoil=Math.max(0,this.recoil-dt*45);this.drawActors(input);this.drawFx(dt);this.drawRain(dt);
 this.aim.clear();if(this.sim.mode==='playing'&&!isTouch){this.aim.lineStyle(1,0xffeddd,.8);this.aim.strokeCircle(aimX,aimY,7);for(const [x,y,xx,yy] of [[-12,0,-8,0],[8,0,12,0],[0,-12,0,-8],[0,8,0,12]])this.aim.lineBetween(aimX+x,aimY+y,aimX+xx,aimY+yy);this.aim.fillStyle(WEAPONS[this.sim.weapon].color).fillRect(aimX-1,aimY-1,2,2);}
 this.hudTime+=dt;if(this.hudTime>.06){this.onHud();this.hudTime=0;}
 }
 private burst(x:number,y:number,color:number,n:number,speed:number){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=20+Math.random()*speed,life=.15+Math.random()*.35;this.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life,max:life,color,size:1+Math.random()*3});}if(this.particles.length>600)this.particles.splice(0,this.particles.length-600);}
 private floatText(x:number,y:number,text:string,color:string,size=16){const label=this.add.text(x,y,text,{fontFamily:'monospace',fontSize:size,color,fontStyle:'bold',stroke:'#21192b',strokeThickness:3}).setOrigin(.5).setDepth(7);this.tweens.add({targets:label,y:y-38,alpha:0,duration:750,onComplete:()=>label.destroy()});}
 private drawRain(dt:number){const g=this.rain;g.clear();for(const d of this.drops){d.y+=d.s*dt;d.x-=d.s*.16*dt;if(d.y>665){d.y=-30;d.x=Math.random()*1550;}g.lineStyle(d.s>490?1.2:.7,0xc9c6df,d.s>490?.18:.08);g.lineBetween(d.x,d.y,d.x-2,d.y+8+d.s*.018);}for(let i=0;i<14;i++){const x=(i*107+this.visualTime*19)%1440;g.lineStyle(1,0xb1a3bd,.13);g.strokeEllipse(x,637+Math.sin(i)*7,4+((this.visualTime*30+i*13)%20),2);}}
 private drawActors(input:Input){const g=this.actors;g.clear();const p=this.sim.player;
 for(const e of this.sim.enemies){g.fillStyle(0x100e1d,.35).fillEllipse(e.x,638,e.kind==='heavy'?54:36,6);if(e.kind==='drone'){const y=e.y+Math.sin(this.visualTime*5+e.id)*4;g.fillStyle(e.hit?0xffffff:0x1c1a2b).fillRect(e.x-20,y-23,40,22);g.fillStyle(0x685778).fillRect(e.x-14,y-26,28,8);g.fillStyle(0xff729d).fillRect(e.x-11,y-14,22,4);g.fillStyle(0xff769e,.2).fillEllipse(e.x,y-10,60,22);g.fillStyle(0xa497b1,.5).fillRect(e.x-29,y-29,58,2);}else this.person(e.x,e.y,e.kind==='heavy'?1.24:1,Math.sign(p.x-e.x),false,e.hit>0,this.visualTime*8+e.id,0);
 if(e.hp<e.maxHp){g.fillStyle(0x1a1726).fillRect(e.x-17,e.y-74,34,3);g.fillStyle(0xf581ac).fillRect(e.x-17,e.y-74,34*e.hp/e.maxHp,3);}}
 g.fillStyle(0x100e1d,.35).fillEllipse(p.x,639,42,7);if(p.dash>0){for(let i=1;i<5;i++)g.fillStyle(0xa6ffeb,.14/i).fillRect(p.x-Math.sign(p.vx)*i*20-11,p.y-48,22,45);}
 if(p.invulnerable<=0||Math.floor(this.visualTime*18)%2===0){const moving=Math.abs(p.vx)>25;this.person(p.x,p.y,1,p.facing,true,false,moving?this.visualTime*13:0,Math.atan2(input.aimY-(p.y-34),input.aimX-p.x));}
 }
 private person(x:number,y:number,s:number,dir:number,hero:boolean,hit:boolean,walk:number,angle:number){const g=this.actors;const bob=walk?Math.sin(walk*2)*1.5:Math.sin(this.visualTime*2)*.5;y+=bob;const r=(a:number,b:number,w:number,h:number,c:number)=>g.fillStyle(hit?0xffffff:c).fillRect(Math.round(x+(dir>0?a:-a-w)*s),Math.round(y+b*s),w*s,h*s);
 const skin=hero?0xd8a18d:0x97829e,coat=hero?0xd4cbd0:0x473d56,leg=hero?0x34445a:0x2a273d;const step=Math.sin(walk)*6;
 r(-12,-51,24,33,0x141321);r(-10,-37,20,20,coat);r(-10,-36,5,21,hero?0x807a94:0x302a40);r(-5,-29,11,13,hero?0xe5d8d5:0x635371);r(-12,-19,23,6,0x1a1a2b);
 r(-9,-14,8,11+step,leg);r(3,-14,8,11-step,leg);r(-12,-4+step,13,5,0x161422);r(2,-4-step,14,5,0x161422);r(-11,-2+step,12,2,hero?0x9d90a3:0x51415c);r(4,-2-step,12,2,hero?0x9d90a3:0x51415c);
 r(-9,-62,19,23,0x181523);r(-4,-57,15,15,skin);r(-9,-62,17,7,hero?0x25202a:0x51465e);r(-9,-57,5,15,0x25202a);r(5,-53,3,4,0x17151e);r(8,-48,5,4,skin);
 if(hero){g.save();g.translateCanvas(x,y-34);g.rotateCanvas(angle);const recoil=this.recoil;const w=WEAPONS[this.sim.weapon];g.fillStyle(0xe0b49e).fillRect(4-recoil,-1,17,6);g.fillStyle(0x181723).fillRect(14-recoil,-7,10,11);g.fillStyle(this.sim.weapon===4?0x85c7c3:0x8a7d86).fillRect(17-recoil,-9,this.sim.weapon===0?17:31,6);g.fillStyle(w.color).fillRect((this.sim.weapon===0?30:43)-recoil,-8,5,3);g.fillStyle(0x282536).fillRect(20-recoil,-3,6,10);if(this.sim.weapon===3)g.fillStyle(0xb27b58).fillRect(26-recoil,-5,12,5);if(this.recoil>0){g.fillStyle(w.color,.18).fillCircle(43,-5,15);g.fillStyle(w.color,.9).fillTriangle(40,-10,57+Math.random()*6,-5,40,1);}g.restore();}else{r(8,-35,12,8,coat);r(16,-34,7,6,skin);r(20,-35,6,13,0x2a2637);r(21,-36,3,5,0xf17aa5);}
 }
 private drawFx(dt:number){const g=this.fx;g.clear();for(const b of this.sim.bullets){const len=b.weapon===4?95:b.weapon===3?48:26;const speed=Math.hypot(b.vx,b.vy);const x=b.x-b.vx/speed*len,y=b.y-b.vy/speed*len;g.lineStyle(b.weapon===4?10:6,b.color,.08).lineBetween(x,y,b.x,b.y);g.lineStyle(b.weapon===4?5:3,b.color,.25).lineBetween(x,y,b.x,b.y);g.lineStyle(b.weapon===4?2:1.6,b.color,1).lineBetween(x,y,b.x,b.y);g.lineStyle(1,0xfffbef,1).lineBetween(b.x-b.vx/speed*8,b.y-b.vy/speed*8,b.x,b.y);}
 for(const a of this.particles){a.life-=dt;a.x+=a.vx*dt;a.y+=a.vy*dt;a.vy+=260*dt;g.fillStyle(a.color,a.life/a.max).fillRect(a.x,a.y,a.size,a.size);g.fillStyle(a.color,.06).fillCircle(a.x,a.y,a.size*3);}this.particles=this.particles.filter(a=>a.life>0);
 }
}
