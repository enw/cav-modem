import test from 'node:test';
import assert from 'node:assert/strict';
import {PROFILE,encode,symbols,synthesize,Receiver} from '../modem.js';
// Frozen rx2 (8bea97e) wire fixture and synthesis formula, independent of profile helpers.
const bytes=Uint8Array.from(Buffer.from('01000b68656c6c6f20776f726c645beb9cd6','hex'));
const preamble=[0,3,0,3,0,3,0,3,1,2,3,0,2,1,0,3,2,2,0,1,3,1,2,0];
const sequence=[...preamble,...Array.from(bytes).flatMap(b=>[b>>>6,(b>>>4)&3,(b>>>2)&3,b&3])];
function rx2Waveform(rate) {
  const n=Math.round(rate*.04),ramp=Math.round(rate*.002),out=new Float32Array(sequence.length*n);
  for(let s=0;s<sequence.length;s++)for(let i=0;i<n;i++)out[s*n+i]=.45*Math.min(1,i/ramp,(n-1-i)/ramp)*Math.sin(2*Math.PI*[1200,1600,2000,2400][sequence[s]]*i/rate);
  return out;
}
test('classic hello world retains rx2 wire bytes, preamble and waveform',()=>{
  assert.deepEqual(encode('hello world'),bytes);assert.deepEqual(symbols(bytes),sequence);
  assert.equal(PROFILE.version,1);assert.equal(PROFILE.seconds,.04);assert.equal(PROFILE.bits,2);
  for(const rate of [44100,48000]) {
    const old=rx2Waveform(rate),now=synthesize(bytes,rate);assert.equal(now.length,old.length);
    for(let i=0;i<old.length;i++)assert.ok(Math.abs(now[i]-old[i])<1e-7);
  }
});
test('classic receives rx2 waveform under randomized onset, quiet gain, noise and capture chunk sizes',()=>{
  let seed=7001;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
  for(const rate of [44100,48000])for(let trial=0;trial<40;trial++) {
    const audio=rx2Waveform(rate),onset=Math.floor(random()*rate),gain=10**(-3+random()*2.5),noise=gain*random()*.3;
    const input=new Float32Array(onset+audio.length+rate);input.set(audio,onset);
    for(let i=0;i<input.length;i++)input[i]=input[i]*gain+(random()-.5)*noise;
    const events=[],rx=new Receiver(rate,e=>events.push(e));
    for(let i=0;i<input.length;) {const n=1+Math.floor(random()*4096);rx.push(input.subarray(i,i+n));i+=n;}
    assert.deepEqual(events.filter(e=>e.type==='message').map(e=>e.text),['hello world'],JSON.stringify({rate,trial,onset,gain,noise}));
  }
});
