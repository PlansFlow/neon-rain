import Phaser from 'phaser';
import { Simulation } from './game/simulation';
import { WEAPONS } from './game/weapons';
import { Sound } from './game/audio';
import { StreetScene } from './phaser/StreetScene';
import './ui/style.css';
const sim=new Simulation(),audio=new Sound(),scene=new StreetScene(sim,audio);
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const icons=[
 '<path d="M28 9h56v11H55v5H43l-3 19H26l5-25h-3z"/><path d="M36 6h42v3H36z"/>',
 '<path d="M8 18h28l5-7h78v6H67v6H48l-4 12H32l-4-10H8z"/><path d="M61 20h46v6H61z"/>',
 '<path d="M15 16h20v-6h53v5h25v7H85v4H70v17H57V26H45l-5 16H28l7-19H15z"/><path d="M58 6h18v4H58z"/>',
 '<path d="M3 22l24-6h14v-5h50v5h35v6H85v5H68l6 16-11 5-12-22h-9l-4 15H26l7-18H3z"/><path d="M53 7h21v4H53z"/>',
 '<path d="M9 18h22l7-8h50v5h31v4h9v5h-9v4H87v5H62v-7H48l-6 16H29l5-18H9z"/><path d="M47 6h32v4H47z"/>'];
$('weapons').innerHTML=WEAPONS.map((w,i)=>`<button class="weapon ${i===0?'active':''}" aria-label="${i+1}: ${w.name}, ${w.tag}" aria-pressed="${i===0}" data-weapon="${i}"><span class="num">0${i+1}</span><svg viewBox="0 0 135 50" aria-hidden="true" fill="currentColor">${icons[i]}</svg><span class="name">${w.name}</span></button>`).join('');
let best=0;try{best=Number(localStorage.getItem('neon-rain-best'))||0;}catch{}
let lastMode='',lastWeapon=-1;const format=(n:number)=>String(n).padStart(6,'0');
function hud(){
 $('score').textContent=format(sim.score);if(sim.score>best){best=sim.score;try{localStorage.setItem('neon-rain-best',String(best));}catch{}}$('best').textContent='BEST '+format(best);
 $('wave').textContent='WAVE '+String(sim.wave).padStart(2,'0');$('health-fill').style.width=sim.player.hp+'%';$('health-label').textContent=sim.player.hp+' HP';$('dash-label').textContent=sim.player.dashCooldown>0?'DASH '+sim.player.dashCooldown.toFixed(1)+'s':'DASH READY';$('combo').textContent=sim.combo>1?`${sim.combo} CHAIN / ×${sim.multiplier}`:'';
 if(lastWeapon!==sim.weapon){lastWeapon=sim.weapon;document.querySelectorAll<HTMLButtonElement>('.weapon').forEach((b,i)=>{b.classList.toggle('active',i===sim.weapon);b.setAttribute('aria-pressed',String(i===sim.weapon));});const w=WEAPONS[sim.weapon];$('weapon-detail').textContent=w.tag.toUpperCase()+' · '+w.rate+' RPS';}
 if(lastMode!==sim.mode){lastMode=sim.mode;$('stage').className=sim.mode;$('overlay').classList.toggle('hidden',sim.mode==='playing');$('pause').textContent=sim.mode==='paused'?'▶':'Ⅱ';$('pause').setAttribute('aria-label',sim.mode==='paused'?'Resume game':'Pause game');
 if(sim.mode==='paused'){$('overline').textContent='TAKE A BREATHER';$('headline').innerHTML='RAIN<br/><em>CHECK.</em>';$('message').textContent='Your street will be right here.';$('start').innerHTML='BACK TO IT <span>↵</span>';$('intro-hint').textContent='ESC TO RESUME';}
 else if(sim.mode==='over'){$('overline').textContent='ONE MORE RUN?';$('headline').innerHTML='NICE<br/><em>RUN.</em>';$('message').textContent=`${format(sim.score)} POINTS · ${sim.kills} ELIMINATED · WAVE ${sim.wave}`;$('start').innerHTML='RUN IT BACK <span>↵</span>';$('intro-hint').textContent='TRY A DIFFERENT WEAPON. FIND A NEW RHYTHM.';}}
}
function start(){audio.unlock();if(sim.mode==='ready')sim.start();else if(sim.mode==='over')sim.restart();else if(sim.mode==='paused')sim.mode='playing';$('start').blur();hud();}
function pause(){if(sim.mode==='playing')sim.mode='paused';else if(sim.mode==='paused')sim.mode='playing';hud();}
$('start').addEventListener('click',start);$('pause').addEventListener('click',()=>{pause();$('pause').blur();});
$('sound').addEventListener('click',()=>{audio.unlock();audio.enabled=!audio.enabled;$('sound').textContent=audio.enabled?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-label',audio.enabled?'Mute sound':'Enable sound');$('sound').blur();});
$('weapons').addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-weapon]');if(b){sim.select(Number(b.dataset.weapon));b.blur();hud();}});
window.addEventListener('keydown',e=>{if(e.repeat)return;if(/^[1-5]$/.test(e.key)){sim.select(Number(e.key)-1);hud();}if(e.key==='Escape')pause();if(e.key==='Enter'&&sim.mode!=='playing'){e.preventDefault();start();}if(e.key.toLowerCase()==='m')$('sound').click();});
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-control]')){const control=button.dataset.control as keyof typeof scene.touch;button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);scene.touch[control]=true;audio.unlock();});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>{scene.touch[control]=false;});}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&sim.mode==='playing'){sim.mode='paused';hud();}});
scene.onHud=hud;hud();new Phaser.Game({type:Phaser.AUTO,parent:'game',width:1440,height:810,backgroundColor:'#20192f',render:{antialias:true,pixelArt:false,roundPixels:false},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},fps:{target:120,smoothStep:true},scene:[scene],audio:{noAudio:true},input:{activePointers:3}});
// Explicit opt-in introspection for local smoke tests; absent in production.
if(import.meta.env.DEV)(window as unknown as {__neon:{sim:Simulation;scene:StreetScene}}).__neon={sim,scene};
