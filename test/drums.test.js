import test from 'node:test';
import assert from 'node:assert/strict';
import {DRUM_PROFILE,FAST_DRUM_PROFILE,drumProfile,PROFILE,encode,decode,synthesize,Receiver,frameDuration} from '../modem.js';
import {drumSample,detectDrum} from '../drums.js';
function receive(a,rate=48000,profile=DRUM_PROFILE) {
  const events=[],rx=new Receiver(rate,e=>events.push(e),profile,true);
  for(let i=0;i<a.length;i+=2048)rx.push(a.subarray(i,i+2048));
  return {events,rx};
}
const messages=r=>r.events.filter(e=>e.type==='message').map(e=>e.text);
for(const p of [DRUM_PROFILE,FAST_DRUM_PROFILE]) {
test('drum dictionary, fixed framing, UTF-8 limits and deterministic samples',()=>{
  assert.equal(frameDuration(64,p).toFixed(2),p===DRUM_PROFILE?'78.00':'62.40');assert.deepEqual(p.prefix,[p===DRUM_PROFILE?4:5,1]);
  assert.equal(Buffer.from(encode('hi',p)).toString('hex'),p===DRUM_PROFILE?'0401000268698dfd2638':'05010002686946a1f59d');
  for(const text of ['hi','Café 🙂','🙂'.repeat(16)])assert.equal(decode(encode(text,p),p),text);
  assert.throws(()=>encode('x'.repeat(65),p));assert.throws(()=>decode(encode('hi',p),PROFILE));
  for(const rate of [44100,48000])for(let id=0;id<4;id++) {
    const sample=drumSample(id,rate);assert.deepEqual(sample,drumSample(id,rate));
    assert.equal(detectDrum(sample,rate,Math.round(rate*.008),Math.round(rate*.14)),id);
    assert.ok(sample.slice(Math.round(rate*.16)).every(x=>x===0));
  }
});
test('drum channel: onset, gain, noise, filtering, short echo, resampling and clock drift',()=>{
  for(const rate of [44100,48000])for(const gain of [.005,.5]) {
    const txRate=48000,a=synthesize(encode('Café 🙂',p),txRate,p),lead=Math.round(rate*.137);
    const out=new Float32Array(lead+Math.ceil(a.length*rate/txRate*1.00015)+rate);
    let seed=81,low=0;const delay=Math.round(rate*.018);
    for(let i=lead;i<out.length;i++) {
      const at=(i-lead)*txRate/rate/1.00015,j=Math.floor(at),v=(a[j]||0)*(1-at+j)+(a[j+1]||0)*(at-j);
      low+=.65*(v-low);seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      out[i]=gain*low+(out[i-delay]||0)*.15+gain*.0005*(seed/2**32-.5);
    }
    const r=receive(out,rate,p);assert.deepEqual(messages(r),['Café 🙂'],JSON.stringify({rate,gain,events:r.events}));
    assert.match(r.rx.traceResult,/CRC-32 passed/);assert.deepEqual(r.rx.trace.bytes,Array.from(encode('Café 🙂',p)));
  }
});
test('drum maximum frame, corruption, unsupported dictionary, truncation, reset and recovery',()=>{
  assert.deepEqual(messages(receive(synthesize(encode('🙂'.repeat(16),p),48000,p),48000,p)),['🙂'.repeat(16)]);
  for(const position of [1,3,4,9]) {
    const bytes=encode('hello',p);bytes[position]^=128;
    const a=synthesize(bytes,48000,p),good=synthesize(encode('next',p),48000,p),joined=new Float32Array(a.length+48000+good.length);
    joined.set(a);joined.set(good,a.length+48000);assert.deepEqual(messages(receive(joined,48000,p)),['next']);
  }
  const a=synthesize(encode('hello',p),48000,p),cut=a.slice(0,-24000),tail=new Float32Array(a.length+48000);tail.set(cut);
  const r=receive(tail,48000,p);assert.deepEqual(messages(r),[]);assert.ok(r.events.some(e=>e.type==='error'));
  r.rx.reset();assert.equal(r.rx.trace.bytes.length,0);assert.equal(r.rx.lock,null);
  assert.deepEqual(messages(receive(a,48000,PROFILE)),[]);
});
test('silence, steady tones, noise and uncertain mixtures do not invent drum frames',()=>{
  assert.equal(detectDrum(new Float32Array(8000),48000),-1);
  const steady=Float32Array.from({length:8000},(_,i)=>.2*Math.sin(2*Math.PI*550*i/48000));assert.equal(detectDrum(steady,48000),-1);
  let seed=12;const noise=Float32Array.from({length:48000*8},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed/2**32-.5)*.01;});
  assert.deepEqual(messages(receive(noise)),[]);
  const mix=drumSample(0,48000),tom=drumSample(3,48000);for(let i=0;i<mix.length;i++)mix[i]+=tom[i];
  assert.equal(detectDrum(mix,48000,384,6720),-1);
});

}

test('drum speed mismatch cannot deliver text; default selection and samples remain compatible',()=>{
  assert.equal(drumProfile(),DRUM_PROFILE);assert.equal(drumProfile(250),DRUM_PROFILE);assert.equal(drumProfile(200),FAST_DRUM_PROFILE);assert.throws(()=>drumProfile(100));
  for(const rate of [44100,48000])for(let id=0;id<4;id++) {
    const slow=drumSample(id,rate),fast=drumSample(id,rate,.2);
    assert.deepEqual(slow.slice(0,fast.length),fast);assert.ok(fast.slice(Math.round(rate*.16)).every(x=>x===0));
  }
  for(const [tx,rx] of [[DRUM_PROFILE,FAST_DRUM_PROFILE],[FAST_DRUM_PROFILE,DRUM_PROFILE]]) {
    const bytes=encode('hi',tx);
    assert.throws(()=>decode(bytes,rx),/wrong mode/);
    assert.deepEqual(messages(receive(synthesize(bytes,48000,tx),48000,rx)),[]);
    // Even if transported at the receiver's slot timing, the header is rejected.
    assert.deepEqual(messages(receive(synthesize(bytes,48000,rx),48000,rx)),[]);
  }
});
