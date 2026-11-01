import {drumSample,detectDrum,DRUM_NAMES} from './drums.js?rev=drum2';
const FSK_PREAMBLE = [0,3,0,3,0,3,0,3,1,2,3,0,2,1,0,3,2,2,0,1,3,1,2,0];
const DUAL_PREAMBLE = [3,0,3,0,3,0,3,0,2,1,0,3,1,2,3,0,1,1,3,2,0,2,1,3];
function profile(id,name,version,dictionary,preamble,options={}) {
  return Object.freeze({id,name,version,seconds:.04,maxBytes:64,bits:Math.log2(dictionary.length),
    prefix:Object.freeze([version]),headerBytes:3,...options,
    dictionary:Object.freeze(dictionary.map(pair=>Object.freeze(pair))),
    tones:Object.freeze(dictionary.map(pair=>pair[0])),preamble:Object.freeze(preamble)});
}
export const PROFILE = profile('fsk','Four-tone FSK',1,[[1200],[1600],[2000],[2400]],FSK_PREAMBLE);
export const DUAL_PROFILE = profile('dual','Dual-tone pairs',2,[[900,1900],[900,2300],[1300,1900],[1300,2300]],DUAL_PREAMBLE);
export const DRUM_PROFILE=profile('drums','Drum samples',4,[[145],[1800],[6000],[550]],Array.from('012303122301321001322103',Number),{seconds:.25,prefix:Object.freeze([4,1]),headerBytes:4,names:DRUM_NAMES});
export const FAST_DRUM_PROFILE=profile('drums','Drum samples · 200 ms (experimental)',5,DRUM_PROFILE.dictionary,DRUM_PROFILE.preamble.map(id=>3-id),{seconds:.2,prefix:Object.freeze([5,1]),headerBytes:4,names:DRUM_NAMES});
export function drumProfile(milliseconds=250) {
  if(milliseconds===250)return DRUM_PROFILE;
  if(milliseconds===200)return FAST_DRUM_PROFILE;
  throw new Error('Unsupported drum speed');
}
export const PROFILES = Object.freeze({fsk:PROFILE,dual:DUAL_PROFILE,drums:DRUM_PROFILE});
export const PREAMBLE = PROFILE.preamble;
export const TONICS = Object.freeze(['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B']);
export const SHUFFLE_SEED = 0x43415631;
export function musicalProfile({count=8,tonic=0,scale='major',order='ascending'}={}) {
  if(![4,8,16,32,64].includes(count)||!Number.isInteger(tonic)||tonic<0||tonic>11||
    !['major','minor'].includes(scale)||!['ascending','shuffled'].includes(order)) throw new Error('Unsupported musical profile');
  const steps=scale==='major'?[0,2,4,5,7,9,11]:[0,2,3,5,7,8,10];
  const degree=index=>12*Math.floor(index/7)+steps[index%7];
  const pitches=Array.from({length:count},(_,i)=>{
    const at=count===64?i/2:i,whole=Math.floor(at);
    const semitone=degree(whole)+(at-whole)*(degree(whole+1)-degree(whole));
    return 440*2**((60+tonic+semitone-69)/12);
  });
  const minGap=Math.min(...pitches.slice(1).map((hz,i)=>hz-pitches[i]));
  const seconds=Math.ceil(Math.max(.04,4/minGap)*100)/100;
  const dictionary=pitches.map(hz=>[hz]);
  if(order==='shuffled') {
    let state=SHUFFLE_SEED;
    for(let i=count-1;i>0;i--) {
      state=(Math.imul(state,1664525)+1013904223)>>>0;
      const j=Math.floor((state/2**32)*(i+1));
      [dictionary[i],dictionary[j]]=[dictionary[j],dictionary[i]];
    }
  }
  const bits=Math.log2(count), prefix=Object.freeze([3,bits,tonic,scale==='minor'?1:0,order==='shuffled'?1:0]);
  // Fixed 24-symbol template spanning the selected alphabet, distinct from old modes.
  const preamble=[0,count-1,0,count-1,1,count-2,1,count-2,0,2,1,3,2,0,3,1,1,0,2,3,0,3,1,2];
  return profile('musical',`${count}-tone ${TONICS[tonic]}4 ${scale==='minor'?'natural minor':'major'} · ${order}${count===64?' · microtonal':''}`,
    3,dictionary,preamble,{microtonal:count===64,seconds,prefix,headerBytes:7,minGap,range:Object.freeze([pitches[0],pitches.at(-1)]),
      config:Object.freeze({count,tonic,scale,order})});
}
export function symbolCount(byteCount,profile=PROFILE) { return Math.ceil(byteCount*8/profile.bits); }
export function frameDuration(payloadBytes,profile=PROFILE,rate) {
  const total=profile.preamble.length+symbolCount(payloadBytes+profile.headerBytes+4,profile);
  return rate?total*Math.round(rate*profile.seconds)/rate:total*profile.seconds;
}
export function packSymbols(bytes,bits) {
  const result=[];let value=0,used=0;
  for(const byte of bytes) for(let shift=7;shift>=0;shift--) {
    value=(value<<1)|((byte>>shift)&1);
    if(++used===bits) { result.push(value);value=0;used=0; }
  }
  if(used) result.push(value<<(bits-used));
  return result;
}
export function unpackSymbols(values,byteCount,bits,checkPadding=true) {
  if(values.length!==Math.ceil(byteCount*8/bits)) throw new Error('Truncated symbol stream');
  const bytes=new Uint8Array(byteCount);let at=0;
  for(const value of values) {
    if(!Number.isInteger(value)||value<0||value>=2**bits) throw new Error('Invalid symbol');
    for(let shift=bits-1;shift>=0;shift--,at++) {
      const bit=(value>>shift)&1;
      if(at<byteCount*8) bytes[at>>3]|=bit<<(7-(at%8));
      else if(checkPadding&&bit) throw new Error('Nonzero frame padding');
    }
  }
  return bytes;
}
function payloadLength(bytes,profile) {
  if(bytes.length<profile.headerBytes) throw new Error('Truncated header');
  if(profile.prefix.some((value,i)=>bytes[i]!==value)) throw new Error('Unsupported version or wrong mode/profile');
  const at=profile.prefix.length,length=bytes[at]*256+bytes[at+1];
  if(length<1||length>64) throw new Error('Invalid payload length');
  return length;
}
function checkSampleRate(rate,profile) {
  if(!Number.isFinite(rate)||rate<=0||Math.max(...profile.dictionary.flat())>=rate*.45)
    throw new Error('Sample rate too low for the selected tone range');
}
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
  const bytes = new Uint8Array(payload.length + profile.headerBytes+4);
  bytes.set([...profile.prefix,0,payload.length]);bytes.set(payload,profile.headerBytes);
  new DataView(bytes.buffer).setUint32(bytes.length-4,crc32(bytes.subarray(0,-4)));
  return bytes;
}
export function decode(bytes,profile=PROFILE) {
  const length=payloadLength(bytes,profile);
  if(bytes.length!==length+profile.headerBytes+4) throw new Error('Truncated or excess frame');
  const expected=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(bytes.length-4);
  if(expected!==crc32(bytes.subarray(0,-4))) throw new Error('Checksum failed');
  try { return new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(profile.headerBytes,-4)); }
  catch { throw new Error('Invalid UTF-8'); }
}
export function symbols(bytes,profile=PROFILE) {
  return [...profile.preamble,...packSymbols(bytes,profile.bits)];
}
export function synthesize(bytes,rate,profile=PROFILE) {
  checkSampleRate(rate,profile);
  const tones=symbols(bytes,profile), n=Math.round(rate*profile.seconds), ramp=Math.round(rate*0.002);
  const samples=new Float32Array(tones.length*n);
  if(profile.id==='drums') {const hits=profile.names.map((_,id)=>drumSample(id,rate,profile.seconds));tones.forEach((id,i)=>samples.set(hits[id],i*n));return samples;}
  for (let s=0;s<tones.length;s++) for(let i=0;i<n;i++) {
    const gain=Math.min(1,i/ramp,(n-1-i)/ramp);
    const pair=profile.dictionary[tones[s]];
    samples[s*n+i]=pair.reduce((sum,frequency)=>sum+Math.sin(2*Math.PI*frequency*i/rate),0)*0.45*gain/pair.length;
  }
  return samples;
}
export function detectTone(samples,rate,begin=0,count=Math.round(rate*.02),profile=PROFILE) {
  if(profile.id==='drums')return detectDrum(samples,rate,begin,count);
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
// Scan quarter-symbol steps; analyze the central half. Buffer growth is bounded by frame length.
export class Receiver {
  constructor(rate,onEvent,profile=PROFILE,traceEnabled=false) {
    this.traceEnabled=traceEnabled;
    checkSampleRate(rate,profile);this.profile=profile;this.rate=rate;this.onEvent=onEvent;
    this.n=Math.round(rate*profile.seconds);this.hop=Math.round(this.n/(profile.id==='drums'?16:4));this.reset();
  }
  resetTrace(state='Searching for sync') {
    this.trace={state,symbols:[],bytes:[],symbolCount:0,pendingBits:0};this.traceValue=0;this.traceRead=0;this.traceLost=false;
  }
  setTracing(enabled) { this.traceEnabled=enabled;this.traceResult='No completed frame';this.resetTrace(this.lock===null?'Searching for sync':'Synchronized · provisional / unverified'); }
  collectTrace(start) {
    if(!this.traceEnabled||this.traceLost)return;
    const limit=symbolCount((this.length??64)+this.profile.headerBytes+4,this.profile);
    while(this.traceRead<limit&&start+(this.traceRead+1)*this.n<=this.samples.length) {
      const symbol=this.tone(start+this.traceRead*this.n);
      if(symbol<0) {this.traceLost=true;this.trace.state='Signal lost; awaiting frame rejection';break;}
      this.traceRead++;this.trace.symbolCount++;
      this.trace.symbols.push(symbol);if(this.trace.symbols.length>32)this.trace.symbols.shift();
      for(let shift=this.profile.bits-1;shift>=0;shift--) {
        this.traceValue=(this.traceValue<<1)|((symbol>>shift)&1);
        if(++this.trace.pendingBits===8) {this.trace.bytes.push(this.traceValue);this.traceValue=0;this.trace.pendingBits=0;}
      }
    }
  }
  reset() { this.traceResult='No completed frame';this.resetTrace();this.buffer=new Float32Array(0);this.samples=this.buffer;this.scan=0;this.lock=null;this.length=null; }
  append(chunk) {
    const used=this.samples.length,total=used+chunk.length;
    if(total>this.buffer.length) {
      const capacity=Math.max(total,this.buffer.length*2,4096);
      const buffer=new Float32Array(capacity);buffer.set(this.samples);this.buffer=buffer;
    }
    this.buffer.set(chunk,used);this.samples=this.buffer.subarray(0,total);
  }
  consume(count) {
    this.buffer.copyWithin(0,count,this.samples.length);
    this.samples=this.buffer.subarray(0,this.samples.length-count);
  }
  tone(start) {
    if(this.profile.id==='drums')return detectDrum(this.samples,this.rate,start+Math.round(this.rate*.008),Math.round(this.rate*.14));
    return detectTone(this.samples,this.rate,start+Math.round(this.n*.25),Math.round(this.n*.5),this.profile);
  }
  readBytes(start,count,checkPadding=true) {
    const values=[];
    for(let i=0;i<symbolCount(count,this.profile);i++) {
      const tone=this.tone(start+i*this.n);
      if(tone<0) throw new Error('Signal lost or truncated frame');
      values.push(tone);
    }
    return unpackSymbols(values,count,this.profile.bits,checkPadding);
  }
  push(chunk) {
    // Browser batches are small; callers must stream rather than enqueue an entire recording.
    if(chunk.length > this.rate) throw new Error('Audio chunk too large');
    this.append(chunk);
    const pre=this.profile.preamble.length*this.n;
    while(true) {
      if(this.lock===null) {
        let found=false;
        while(this.scan+pre<=this.samples.length) {
          if(this.profile.preamble.every((tone,i)=>this.tone(this.scan+i*this.n)===tone)) { found=true; break; }
          this.scan+=this.hop;
        }
        if(!found) {
          this.consume(this.scan); this.scan=0; return;
        }
        this.lock=this.scan; this.resetTrace('Synchronized · provisional / unverified');this.onEvent({type:'receiving'});
      }
      const start=this.lock+pre;
      if(start+symbolCount(this.profile.headerBytes,this.profile)*this.n>this.samples.length) {this.collectTrace(start);return;}
      try {
        if(this.length===null) this.length=payloadLength(this.readBytes(start,this.profile.headerBytes,false),this.profile);
        this.collectTrace(start);
        const byteCount=this.length+this.profile.headerBytes+4;
        const end=start+symbolCount(byteCount,this.profile)*this.n;
        if(end>this.samples.length) return;
        const text=decode(this.readBytes(start,byteCount),this.profile);
        if(this.traceEnabled) {this.trace.bytes=this.trace.bytes.slice(0,byteCount);this.trace.pendingBits=0;this.trace.state='CRC-32 passed · verified frame';this.traceResult=this.trace.state;}
        this.onEvent({type:'message',text});
        this.consume(end); this.scan=0; this.lock=null;this.length=null;
      } catch(error) {
        this.collectTrace(start);
        if(this.traceEnabled) {this.trace.state=`Rejected: ${error.message} · unverified bytes discarded on next sync`;this.traceResult=this.trace.state;}
        this.onEvent({type:'error',message:error.message});
        this.scan=this.lock+this.hop; this.lock=null;this.length=null;
      }
    }
  }
}
