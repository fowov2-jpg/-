let context;
let lastRadio=0;
export function radioSound(kind='radio'){
 // Original synthesized dispatch sounds. Text messages carry the information;
 // every cue remains optional, with no dependency on system speech or network.
 if(kind==='incoming'){notifySound();return;}
 if(kind==='critical'){notifySound(true);return;}
 try{
  const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;
  context??=new Audio();context.resume().catch(()=>{});
  const start=context.currentTime;if(start-lastRadio<.25)return;lastRadio=start;
  const tones=kind==='complete'?[523,659,784]:kind==='dispatch'?[440,554]:[370];
  for(const [i,hz] of tones.entries()){
   const o=context.createOscillator(),g=context.createGain();o.type='triangle';o.frequency.value=hz;
   g.gain.setValueAtTime(.001,start+i*.07);g.gain.linearRampToValueAtTime(.025,start+i*.07+.008);g.gain.exponentialRampToValueAtTime(.001,start+i*.07+.065);
   o.connect(g);g.connect(context.destination);o.start(start+i*.07);o.stop(start+i*.07+.07);
  }
 }catch{/* Silent mode does not affect simulation. */}
}
export function notifySound(critical=false){
 try{
  const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;
  context??=new Audio();context.resume().catch(()=>{});
  const start=context.currentTime;
  for(const [i,hz] of (critical?[660,880,660]:[587,784]).entries()){
   const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type='sine';oscillator.frequency.value=hz;
   gain.gain.setValueAtTime(0,start+i*.13);gain.gain.linearRampToValueAtTime(.06,start+i*.13+.02);gain.gain.exponentialRampToValueAtTime(.001,start+i*.13+.18);
   oscillator.connect(gain);gain.connect(context.destination);oscillator.start(start+i*.13);oscillator.stop(start+i*.13+.2);
  }
 }catch{/* Audio is optional; gameplay must remain available. */}
}
