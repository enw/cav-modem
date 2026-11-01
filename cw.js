// International Morse subset, ITU-R M.1677-1. Plain text: no frame or checksum.
const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ',codes='.- -... -.-. -.. . ..-. --. .... .. .--- -.- .-.. -- -. --- .--. --.- .-. ... - ..- ...- .-- -..- -.-- --..'.split(' ');
export const MORSE=Object.freeze(Object.fromEntries([
  ...Array.from(letters,(c,i)=>[c,codes[i]]),
  ...'----- .---- ..--- ...-- ....- ..... -.... --... ---.. ----.'.split(' ').map((s,i)=>[String(i),s]),
  ['.','.-.-.-'],[',','--..--'],['?','..--..'],['/','-..-.'],['=','-...-'],['+','.-.-.'],['-','-....-'],['@','.--.-.']
]));
const CHARACTERS=Object.fromEntries(Object.entries(MORSE).map(([c,s])=>[s,c]));
export function cwProfile(wpm=12) {
  if(![8,12,16].includes(wpm))throw new Error('Unsupported CW speed');
  return {id:'cw',name:`CW Morse · ${wpm} WPM`,wpm,seconds:1.2/wpm,tone:700};
}
export function normalizeCW(input) {
  for(const c of input)if(!/\s/u.test(c)&&!/[a-z]/i.test(c)&&!Object.hasOwn(MORSE,c))throw new Error(`Unsupported CW character: ${JSON.stringify(c)}`);
  const text=input.toUpperCase().trim().replace(/\s+/gu,' ');
  if(text.length<1||text.length>64)throw new Error('CW needs 1–64 normalized characters.');
  return text;
}
export function cwSegments(input) {
  const text=normalizeCW(input),segments=[{on:false,units:1}];
  for(let i=0;i<text.length;i++) {
    if(text[i]===' ')continue;
    const code=MORSE[text[i]];
    for(let j=0;j<code.length;j++) {
      segments.push({on:true,units:code[j]==='.'?1:3});
      if(j<code.length-1)segments.push({on:false,units:1});
    }
    if(i<text.length-1)segments.push({on:false,units:text[i+1]===' '?7:3});
  }
  segments.push({on:false,units:14});return segments;
}
export function cwDuration(text,profile=cwProfile(),rate) {
  return cwSegments(text).reduce((sum,s)=>sum+(rate?Math.round(s.units*profile.seconds*rate)/rate:s.units*profile.seconds),0);
}
export function synthesizeCW(text,rate,profile=cwProfile()) {
  const parts=cwSegments(text).map(s=>({...s,n:Math.round(s.units*profile.seconds*rate)}));
  const out=new Float32Array(parts.reduce((sum,s)=>sum+s.n,0)),ramp=Math.round(rate*.005);let at=0;
  for(const s of parts) {
    if(s.on)for(let i=0;i<s.n;i++)out[at+i]=.45*Math.min(1,i/ramp,(s.n-1-i)/ramp)*Math.sin(2*Math.PI*profile.tone*i/rate);
    at+=s.n;
  }
  return out;
}
export function detectCW(samples,rate,tone=700) {
  let energy=0;for(const x of samples)energy+=x*x;
  if(energy/samples.length<1e-10)return false;
  const power=[tone-200,tone,tone+200].map(hz=>{
    const c=2*Math.cos(2*Math.PI*hz/rate);let a=0,b=0;
    for(const x of samples){const next=x+c*a-b;b=a;a=next;}
    return a*a+b*b-c*a*b;
  });
  return power[1]>.30*energy*samples.length&&power[1]>4*Math.max(power[0],power[2]);
}
export class CWReceiver {
  constructor(rate,onEvent,profile=cwProfile(),traceEnabled=false) {
    if(!Number.isFinite(rate)||rate<8000)throw new Error('Unsupported CW sample rate');
    this.rate=rate;this.onEvent=onEvent;this.profile=profile;this.traceEnabled=traceEnabled;
    this.block=new Float32Array(Math.round(rate*.01));this.reset();
  }
  reset() {this.used=0;this.on=false;this.run=0;this.active=false;this.bad=false;this.code='';this.text='';this.trace={state:'Waiting for keyed Morse · no CRC',marks:'',text:'',code:''};}
  setTracing(enabled) {this.traceEnabled=enabled;this.trace.marks='';}
  reject(reason) {if(!this.bad)this.onEvent({type:'error',message:`CW rejected: ${reason}`});this.bad=true;this.trace.state=`Rejected: ${reason} · waiting for silence`;}
  letter() {
    if(!this.code)return;
    const c=CHARACTERS[this.code];
    if(!c)this.reject('unknown Morse character');
    else if(this.text.length>=64)this.reject('message exceeds 64 characters');
    else this.text+=c;
    this.code='';
  }
  finish() {
    this.letter();
    if(!this.bad&&this.text) {this.onEvent({type:'message',text:this.text,verified:false});this.trace.state='Plain Morse finalized · unverified / no CRC';}
    this.trace.text=this.text;this.trace.code='';this.active=false;this.text='';this.code='';this.bad=false;
  }
  step(on) {
    const unit=this.block.length/this.rate/this.profile.seconds;
    if(on!==this.on) {
      const duration=this.run*unit;
      if(this.on&&!this.bad) {
        const mark=duration>=.55&&duration<=1.5?'.':duration>=2.4&&duration<=3.6?'-':null;
        if(!mark)this.reject('ambiguous mark duration');
        else {this.code+=mark;if(this.code.length>6)this.reject('too many marks');if(this.traceEnabled)this.trace.marks=(this.trace.marks+mark).slice(-64);}
      } else if(on) {
        if(!this.active) {this.active=true;this.bad=false;this.trace={state:'Receiving plain Morse · unverified',marks:'',text:'',code:''};this.onEvent({type:'receiving'});}
        else if(!this.bad) {
          if(duration>=2.2&&duration<=4.2)this.letter();
          else if(duration>=5.5&&duration<=9) {this.letter();if(this.text.length>=64)this.reject('message exceeds 64 characters');else this.text+=' ';}
          else if(duration<.5||duration>1.6)this.reject('ambiguous gap duration');
        }
      }
      this.on=on;this.run=0;
    }
    this.run=Math.min(this.run+1,Math.ceil(16/unit));
    if(this.on&&this.run*unit>3.6)this.reject('mark too long');
    if(!this.on&&this.active&&this.run*unit>=12)this.finish();
    if(this.active) {this.trace.text=this.text;this.trace.code=this.code;}
  }
  push(chunk) {
    if(chunk.length>this.rate)throw new Error('Audio chunk too large');
    for(const x of chunk) {
      this.block[this.used++]=x;
      if(this.used===this.block.length) {this.step(detectCW(this.block,this.rate,this.profile.tone));this.used=0;}
    }
  }
}
