export interface Weapon { id: string; name: string; tag: string; rate: number; speed: number; damage: number; pellets: number; spread: number; color: number; recoil: number; pierce: number; }
export const WEAPONS: Weapon[] = [
 {id:'pistol',name:'SIDEKICK',tag:'Semi-auto pistol',rate:3.8,speed:1100,damage:38,pellets:1,spread:.012,color:0xffda91,recoil:3,pierce:1},
 {id:'shotgun',name:'ROOM SERVICE',tag:'8-pellet shotgun',rate:1.6,speed:1350,damage:18,pellets:8,spread:.24,color:0xffb78c,recoil:7,pierce:1},
 {id:'smg',name:'AFTERHOURS',tag:'Rapid-fire SMG',rate:12,speed:1800,damage:17,pellets:1,spread:.065,color:0xff82b2,recoil:2,pierce:1},
 {id:'ak',name:'AK–47',tag:'High-velocity rifle',rate:16,speed:2600,damage:24,pellets:1,spread:.035,color:0xffc46e,recoil:3,pierce:2},
 {id:'laser',name:'LIGHTSPEED',tag:'Piercing pulse laser',rate:25,speed:4200,damage:20,pellets:1,spread:0,color:0x8bfff2,recoil:1,pierce:5},
];
