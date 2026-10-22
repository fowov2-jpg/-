// Fractional game minutes survive pause, dialogs and speed changes without reversing a vehicle.
export class GameClock {
 constructor(now=0){this.last=now;this.carry=0;}
 advance(now,running,speed=1){const elapsed=Math.max(0,now-this.last);this.last=now;if(!running)return 0;this.carry+=elapsed*speed/1000;const minutes=Math.floor(this.carry+1e-9);this.carry=Math.max(0,this.carry-minutes);return minutes;}
 progress(now,running,speed=1){return this.carry+(running?Math.max(0,now-this.last)*speed/1000:0);}
 reset(now){this.last=now;this.carry=0;}
}
