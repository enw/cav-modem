const FSK_PREAMBLE = [0,3,0,3,0,3,0,3,1,2,3,0,2,1,0,3,2,2,0,1,3,1,2,0];
const DUAL_PREAMBLE = [3,0,3,0,3,0,3,0,2,1,0,3,1,2,3,0,1,1,3,2,0,2,1,3];
function profile(id,name,version,dictionary,preamble) {
  return Object.freeze({id,name,version,seconds:.04,maxBytes:64,
    dictionary:Object.freeze(dictionary.map(pair=>Object.freeze(pair))),
    tones:Object.freeze(dictionary.map(pair=>pair[0])),preamble:Object.freeze(preamble)});
}
export const PROFILE = profile('fsk','Four-tone FSK',1,[[1200],[1600],[2000],[2400]],FSK_PREAMBLE);
export const DUAL_PROFILE = profile('dual','Dual-tone pairs',2,[[900,1900],[900,2300],[1300,1900],[1300,2300]],DUAL_PREAMBLE);
export const PROFILES = Object.freeze({fsk:PROFILE,dual:DUAL_PROFILE});
export const PREAMBLE = PROFILE.preamble;
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i=0;i<8;i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function encode(text,profile=PROFILE) {
  const payload = new TextEncoder().encode(text);
  if (!payload.length || payload.length > 64) throw new Error('Enter 1–64 UTF-8 bytes.');
  const bytes = new Uint8Array(payload.length + 7);
  bytes.set([profile.version,0,payload.length]); bytes.set(payload,3);
  new DataView(bytes.buffer).setUint32(bytes.length-4,crc32(bytes.subarray(0,-4)));
  return bytes;
}
export function decode(bytes,profile=PROFILE) {
  if (bytes.length < 7) throw new Error('Truncated frame');
  if (bytes[0] !== profile.version) throw new Error('Unsupported version or wrong mode');
  const length = bytes[1]*256+bytes[2];
  if (length < 1 || length > 64) throw new Error('Invalid payload length');
  if (bytes.length !== length+7) throw new Error('Truncated or excess frame');
  const expected = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(bytes.length-4);
  if (expected !== crc32(bytes.subarray(0,-4))) throw new Error('Checksum failed');
  try { return new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(3,-4)); }
  catch { throw new Error('Invalid UTF-8'); }
}
export function symbols(bytes,profile=PROFILE) {
  return [...profile.preamble,...Array.from(bytes).flatMap(b=>[b>>>6,(b>>>4)&3,(b>>>2)&3,b&3])];
}
export function synthesize(bytes,rate,profile=PROFILE) {
  const tones=symbols(bytes,profile), n=Math.round(rate*0.04), ramp=Math.round(rate*0.002);
  const samples=new Float32Array(tones.length*n);
  for (let s=0;s<tones.length;s++) for(let i=0;i<n;i++) {
    const gain=Math.min(1,i/ramp,(n-1-i)/ramp);
    const pair=profile.dictionary[tones[s]];
    samples[s*n+i]=pair.reduce((sum,frequency)=>sum+Math.sin(2*Math.PI*frequency*i/rate),0)*0.45*gain/pair.length;
  }
  return samples;
}
export function detectTone(samples,rate,begin=0,count=Math.round(rate*.02),profile=PROFILE) {
  if(begin<0||begin+count>samples.length) return -1;
  let energy=0; const power=[];
  for(let i=0;i<count;i++) energy+=samples[begin+i]**2;
  // Reject digital silence, not quiet microphones. Tone purity below is gain-relative.
  if (energy/count < 1e-10) return -1;
  const frequencies=profile.id==='dual'?[900,1300,1900,2300]:profile.tones;
  for(const frequency of frequencies) {
    const coefficient=2*Math.cos(2*Math.PI*frequency/rate);
    let a=0,b=0;
    for(let i=0;i<count;i++) { const next=samples[begin+i]+coefficient*a-b; b=a; a=next; }
    power.push(a*a+b*b-coefficient*a*b);
  }
  if(profile.id==='dual') {
    const low=power[0]>power[1]?0:1, high=power[2]>power[3]?2:3;
    const a=power[low],b=power[high],normalized=energy*count;
    // Require both groups, dominant peaks, balanced pair, and joint spectral purity.
    if(a<=power[1-low]*3 || b<=power[5-high]*3 ||
      Math.min(a,b)<normalized*.08 || Math.max(a,b)>Math.min(a,b)*9 || a+b<normalized*.30) return -1;
    return low*2+high-2;
  }
  const best=Math.max(...power), index=power.indexOf(best);
  const second=Math.max(...power.filter((_,i)=>i!==index));
  return best > second*3 && best > energy*count*.20 ? index : -1;
}
// Sample-clock receiver: scan every 10 ms; inspect the central 20 ms of each symbol.
export class Receiver {
  constructor(rate,onEvent,profile=PROFILE) { this.profile=profile; this.rate=rate; this.onEvent=onEvent; this.n=Math.round(rate*.04); this.hop=Math.round(rate*.01); this.reset(); }
  reset() { this.samples=new Float32Array(0); this.scan=0; this.lock=null; }
  tone(start) {
    return detectTone(this.samples,this.rate,start+Math.round(this.n*.25),Math.round(this.n*.5),this.profile);
  }
  readBytes(start,count) {
    const bytes=new Uint8Array(count);
    for(let b=0;b<count;b++) for(let j=0;j<4;j++) {
      const tone=this.tone(start+(b*4+j)*this.n);
      if(tone<0) throw new Error('Signal lost or truncated frame');
      bytes[b]=(bytes[b]<<2)|tone;
    }
    return bytes;
  }
  push(chunk) {
    // Browser batches are small; callers must stream rather than enqueue an entire recording.
    if(chunk.length > this.rate) throw new Error('Audio chunk too large');
    const next=new Float32Array(this.samples.length+chunk.length);
    next.set(this.samples); next.set(chunk,this.samples.length); this.samples=next;
    const pre=this.profile.preamble.length*this.n;
    while(true) {
      if(this.lock===null) {
        let found=false;
        while(this.scan+pre<=this.samples.length) {
          if(this.profile.preamble.every((tone,i)=>this.tone(this.scan+i*this.n)===tone)) { found=true; break; }
          this.scan+=this.hop;
        }
        if(!found) {
          this.samples=this.samples.slice(this.scan); this.scan=0; return;
        }
        this.lock=this.scan; this.onEvent({type:'receiving'});
      }
      const start=this.lock+pre;
      if(start+12*this.n>this.samples.length) return;
      try {
        const header=this.readBytes(start,3);
        if(header[0]!==this.profile.version) throw new Error('Unsupported version or wrong mode');
        const length=header[1]*256+header[2];
        if(length<1||length>64) throw new Error('Invalid payload length');
        const end=start+(length+7)*4*this.n;
        if(end>this.samples.length) return;
        const text=decode(this.readBytes(start,length+7),this.profile);
        this.onEvent({type:'message',text});
        this.samples=this.samples.slice(end); this.scan=0; this.lock=null;
      } catch(error) {
        this.onEvent({type:'error',message:error.message});
        this.scan=this.lock+this.hop; this.lock=null;
      }
    }
  }
}
