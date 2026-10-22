let context;
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
