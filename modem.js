export const PROFILE = Object.freeze({tones:[1200,1600,2000,2400], seconds:0.04, maxBytes:64, version:1});
export const PREAMBLE = [0,3,0,3,0,3,0,3,1,2,3,0,2,1,0,3,2,2,0,1,3,1,2,0];
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i=0;i<8;i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function encode(text) {
  const payload = new TextEncoder().encode(text);
  if (!payload.length || payload.length > 64) throw new Error('Enter 1–64 UTF-8 bytes.');
  const bytes = new Uint8Array(payload.length + 7);
  bytes.set([1,0,payload.length]); bytes.set(payload,3);
  new DataView(bytes.buffer).setUint32(bytes.length-4,crc32(bytes.subarray(0,-4)));
  return bytes;
}
export function decode(bytes) {
  if (bytes.length < 7) throw new Error('Truncated frame');
  if (bytes[0] !== 1) throw new Error('Unsupported version');
  const length = bytes[1]*256+bytes[2];
  if (length < 1 || length > 64) throw new Error('Invalid payload length');
  if (bytes.length !== length+7) throw new Error('Truncated or excess frame');
  const expected = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(bytes.length-4);
  if (expected !== crc32(bytes.subarray(0,-4))) throw new Error('Checksum failed');
  try { return new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(3,-4)); }
  catch { throw new Error('Invalid UTF-8'); }
}
export function symbols(bytes) {
  return [...PREAMBLE,...Array.from(bytes).flatMap(b=>[b>>>6,(b>>>4)&3,(b>>>2)&3,b&3])];
}
export function synthesize(bytes,rate) {
  const tones=symbols(bytes), n=Math.round(rate*0.04), ramp=Math.round(rate*0.002);
  const samples=new Float32Array(tones.length*n);
  for (let s=0;s<tones.length;s++) for(let i=0;i<n;i++) {
    const gain=Math.min(1,i/ramp,(n-1-i)/ramp);
    samples[s*n+i]=0.45*gain*Math.sin(2*Math.PI*PROFILE.tones[tones[s]]*i/rate);
  }
  return samples;
}
export function detectTone(samples,rate,begin=0,count=Math.round(rate*.02)) {
  if(begin<0||begin+count>samples.length) return -1;
  let energy=0; const power=[];
  for(let i=0;i<count;i++) energy+=samples[begin+i]**2;
  // Reject digital silence, not quiet microphones. Tone purity below is gain-relative.
  if (energy/count < 1e-10) return -1;
  for(const frequency of PROFILE.tones) {
    const coefficient=2*Math.cos(2*Math.PI*frequency/rate);
    let a=0,b=0;
    for(let i=0;i<count;i++) { const next=samples[begin+i]+coefficient*a-b; b=a; a=next; }
    power.push(a*a+b*b-coefficient*a*b);
  }
  const best=Math.max(...power), index=power.indexOf(best);
  const second=Math.max(...power.filter((_,i)=>i!==index));
  return best > second*3 && best > energy*count*.20 ? index : -1;
}
// Sample-clock receiver: scan every 10 ms; inspect the central 20 ms of each symbol.
export class Receiver {
  constructor(rate,onEvent) { this.rate=rate; this.onEvent=onEvent; this.n=Math.round(rate*.04); this.hop=Math.round(rate*.01); this.reset(); }
  reset() { this.samples=new Float32Array(0); this.scan=0; this.lock=null; }
  tone(start) {
    return detectTone(this.samples,this.rate,start+Math.round(this.n*.25),Math.round(this.n*.5));
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
    const pre=PREAMBLE.length*this.n;
    while(true) {
      if(this.lock===null) {
        let found=false;
        while(this.scan+pre<=this.samples.length) {
          if(PREAMBLE.every((tone,i)=>this.tone(this.scan+i*this.n)===tone)) { found=true; break; }
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
        if(header[0]!==1) throw new Error('Unsupported version');
        const length=header[1]*256+header[2];
        if(length<1||length>64) throw new Error('Invalid payload length');
        const end=start+(length+7)*4*this.n;
        if(end>this.samples.length) return;
        const text=decode(this.readBytes(start,length+7));
        this.onEvent({type:'message',text});
        this.samples=this.samples.slice(end); this.scan=0; this.lock=null;
      } catch(error) {
        this.onEvent({type:'error',message:error.message});
        this.scan=this.lock+this.hop; this.lock=null;
      }
    }
  }
}
