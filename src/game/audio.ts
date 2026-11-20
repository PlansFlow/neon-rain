export class Sound {
 enabled=true;private ctx:AudioContext|null=null;private noise:AudioBuffer|null=null;
 unlock(){if(!this.ctx){this.ctx=new AudioContext();this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate*.15,this.ctx.sampleRate);const d=this.noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}if(this.ctx.state==='suspended')void this.ctx.resume();}
 play(type:string,weapon=0){if(!this.enabled||!this.ctx)return;const c=this.ctx,t=c.currentTime,g=c.createGain();g.connect(c.destination);const volume=type==='shot'?.075:type==='hurt'?.1:.035;g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+.08+(weapon===1?.1:0));
 if(type==='shot'&&weapon!==4){const n=c.createBufferSource();n.buffer=this.noise;const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=[1600,800,2200,1300][weapon];n.connect(f);f.connect(g);n.start(t);n.stop(t+.14);}
 const o=c.createOscillator();o.type=weapon===4?'sine':'triangle';const hz=type==='shot'?[180,95,230,145,950][weapon]:type==='kill'?640:type==='hurt'?80:350;o.frequency.setValueAtTime(hz,t);o.frequency.exponentialRampToValueAtTime(hz*.35,t+.09);o.connect(g);o.start(t);o.stop(t+.12);
 }
}
