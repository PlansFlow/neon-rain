import Phaser from 'phaser';
export function environment(scene:Phaser.Scene){
 const canvas=scene.textures.createCanvas('atmosphere',1440,810)!;const c=canvas.context;
 const sky=c.createLinearGradient(0,0,0,810);sky.addColorStop(0,'#151326');sky.addColorStop(.65,'#4b465f');sky.addColorStop(1,'#171426');c.fillStyle=sky;c.fillRect(0,0,1440,810);
 const haze=c.createRadialGradient(750,460,5,750,460,620);haze.addColorStop(0,'#9b97b035');haze.addColorStop(1,'#81829c00');c.fillStyle=haze;c.fillRect(0,0,1440,810);canvas.refresh();scene.add.image(0,0,'atmosphere').setOrigin(0);
 const g=scene.add.graphics();const rect=(x:number,y:number,w:number,h:number,color:number,a=1)=>g.fillStyle(color,a).fillRect(x,y,w,h);
 let seed=361;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
 for(let i=0;i<17;i++){let x=i*105-40,y=115+rand()*190;rect(x,y,80+rand()*60,380,0x29283c,.52);rect(x+15,y-20,4,20,0x242337,.6);for(let j=0;j<6;j++)for(let k=0;k<4;k++)if(rand()>.45)rect(x+12+k*16,y+22+j*32,5,11,0x9b839b,.08+rand()*.12);}
 rect(300,380,840,245,0x363344);rect(328,405,784,210,0x4b465b);rect(337,413,766,200,0x494356);
 for(let y=418;y<610;y+=9){rect(338,y,764,2,0x252234,.22);rect(338,y+2,764,1,0x827487,.13);}rect(695,412,5,208,0x302c40);rect(319,385,800,12,0x656071,.4);
 for(const x of [370,1070]){rect(x,424,3,177,0x9e8c9e,.14);rect(x,600,20,5,0x242032);}
 // Side architecture: deep shopfronts and worn shutters.
 for(const right of [false,true]){const x=right?1140:0,w=right?300:305;rect(x,0,w,630,0x211c31);rect(x+7,0,w-15,330,0x30243c);rect(x+19,0,4,322,0x534056,.45);rect(x+w-30,0,7,625,0x120f22,.6);
 for(let y=25;y<300;y+=92){rect(x+40,y,w-84,60,0x181627);rect(x+46,y+7,w-96,46,0x51415a,.5);for(let k=0;k<3;k++){if(rand()>.55)rect(x+47+k*62,y+8,52,41,0xf2bb89,.65);rect(x+103+k*62,y,6,60,0x181626);}rect(x+40,y+30,w-84,6,0x211a30);}
 rect(x,333,w,17,0x120e23);rect(x,322,w+9,9,0x695067);rect(x,350,w-20,14,0x4f344e);rect(x+14,366,w-43,243,0x483448);
 for(let y=368;y<609;y+=8){rect(x+14,y,w-43,3,0x211b30,.5);rect(x+14,y+3,w-43,1,0x79516c,.35);}rect(x,608,w,19,0x282030);
 for(let i=0;i<50;i++){let px=x+rand()*w,py=rand()*320;rect(px,py,3+rand()*12,2,0x887386,.1);}
 rect(x+6,305,w-28,5,0x735369,.3);
 }
 rect(282,70,32,225,0x171426);rect(279,65,28,216,0xdd689e);rect(283,70,20,207,0xa94376);for(let j=0;j<6;j++){rect(287,80+j*31,11,4,0xf28ab5);rect(287,80+j*31,4,22,0xf28ab5);rect(287,98+j*31,12,4,0xf28ab5);rect(295,85+j*31,4,8,0xf28ab5);}
 rect(1151,318,289,5,0xef84b5);rect(1160,313,280,2,0x8f3a70);rect(1140,325,8,25,0xffa3c7);
 // Street bed and wet asphalt.
 rect(0,622,1440,29,0x5c5364);rect(0,650,1440,12,0x282537);rect(0,662,1440,5,0x898090,.5);rect(0,667,1440,143,0x181526);
 for(let x=0;x<1440;x+=80){rect(x,651,2,11,0x9c8a9c,.25);rect(x+8,657,12,2,0x191725);}
 for(let i=0;i<180;i++){const x=rand()*1440,y=624+rand()*26;rect(x,y,2+rand()*26,1,0xb4a7b6,rand()*.22);}
 for(let i=0;i<140;i++){const x=rand()*1440,y=673+rand()*137;rect(x,y,2+rand()*8,2+rand()*20,i%3?0x6d4b6a:0xe77eac,rand()*.09);}
 for(const x of [293,1160])for(let j=0;j<28;j++)rect(x-65+rand()*100,675+j*4,rand()*85,2,0xe975ab,.13*(1-j/30));
 // Street objects.
 rect(339,556,38,68,0x252234);rect(343,560,30,58,0x4a4051);rect(338,550,40,7,0x716071);for(let x=350;x<375;x+=7)rect(x,566,2,48,0x201d2d,.5);
 rect(1030,569,45,54,0x292534);rect(1027,565,50,7,0x655867);rect(1049,575,4,44,0x4f4656);rect(1040,554,21,10,0x161423);
 for(const [x,y] of [[416,626],[911,626],[1060,630],[182,631]]){rect(x,y,12,4,0xb4a1a6,.4);rect(x+4,y-4,8,4,0x74606c);}
 // Two warm street lamps.
 for(const x of [420,1014]){rect(x,338,8,294,0x1c192b);rect(x+7,350,3,279,0x67556a,.6);rect(x-8,623,27,10,0x1a1827);rect(x-3,611,16,14,0x282236);rect(x,330,17,9,0x1c192b);rect(x+14,320,48,9,0x1c192b);rect(x+52,324,8,14,0x211a2c);rect(x+43,336,25,5,0x392937);rect(x+46,340,19,17,0xffd48b);rect(x+50,344,11,10,0xffe9ac);
 const key='lamp'+x;const tex=scene.textures.createCanvas(key,400,500)!;const ctx=tex.context;let glow=ctx.createRadialGradient(200,160,3,200,160,125);glow.addColorStop(0,'#ffcb6b42');glow.addColorStop(.3,'#ffc76a16');glow.addColorStop(1,'#ffca7000');ctx.fillStyle=glow;ctx.fillRect(0,0,400,500);const cone=ctx.createLinearGradient(0,180,0,450);cone.addColorStop(0,'#ffcf760b');cone.addColorStop(1,'#ffcf7600');ctx.fillStyle=cone;ctx.beginPath();ctx.moveTo(195,170);ctx.lineTo(70,450);ctx.lineTo(330,450);ctx.closePath();ctx.fill();tex.refresh();scene.add.image(x+55,348,key).setOrigin(.5,.32);g.fillStyle(0xffcd87,.13).fillEllipse(x+55,635,120,8);}
 const neon=scene.textures.createCanvas('neon',400,400)!;const nc=neon.context;let ng=nc.createRadialGradient(200,200,5,200,200,190);ng.addColorStop(0,'#f16baa20');ng.addColorStop(1,'#f16baa00');nc.fillStyle=ng;nc.fillRect(0,0,400,400);neon.refresh();scene.add.image(295,210,'neon');scene.add.image(1310,390,'neon').setScale(1.7,.8);
 // Pixel foreground silhouettes frame the action without covering it.
 const f=scene.add.graphics().setDepth(8);for(const x of [-20,1400]){f.fillStyle(0x100e1d).fillRect(x,709,70,101);for(let i=0;i<22;i++){f.fillRect(x-45+rand()*130,706+rand()*60,10+rand()*12,65);}}f.fillStyle(0x100e1d).fillRect(0,803,1440,7);
 // Bake static geometry once; combat frames only redraw actors, rain and projectiles.
 g.generateTexture('street-art',1440,810);const baked=scene.add.image(0,0,'street-art').setOrigin(0);scene.children.moveTo(baked,1);g.destroy();
}
