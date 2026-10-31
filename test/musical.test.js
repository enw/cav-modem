import test from 'node:test';
import assert from 'node:assert/strict';
import {musicalProfile,PROFILE,DUAL_PROFILE,encode,decode,synthesize,Receiver,detectTone,packSymbols,unpackSymbols,symbols,frameDuration} from '../modem.js';
const configurations=[];
for(const count of [4,8,16,32,64])for(const scale of ['major','minor'])for(const order of ['ascending','shuffled'])configurations.push({count,scale,order});
function receive(audio,profile,rate=24000) {
  const events=[],rx=new Receiver(rate,e=>events.push(e),profile);
  rx.push(new Float32Array(173));
  for(let i=0;i<audio.length;i+=2048)rx.push(audio.subarray(i,i+2048));
  for(let i=0;i<Math.ceil(rate*2/2048);i++)rx.push(new Float32Array(2048));
  return events;
}
const messages=events=>events.filter(e=>e.type==='message').map(e=>e.text);

test('all 240 musical dictionaries have exact descriptors, deterministic permutations and guarded timing',()=>{
  for(const options of configurations)for(let tonic=0;tonic<12;tonic++) {
    const p=musicalProfile({...options,tonic}),q=musicalProfile({...options,tonic});
    assert.deepEqual(p,q);assert.equal(p.bits,Math.log2(options.count));
    assert.deepEqual(p.prefix,[3,p.bits,tonic,options.scale==='minor'?1:0,options.order==='shuffled'?1:0]);
    assert.equal(new Set(p.tones).size,options.count);assert.ok(p.seconds*.5*p.minGap>=2);
    const sorted=p.tones.toSorted((a,b)=>a-b);assert.equal(sorted[0],440*2**((60+tonic-69)/12));
    assert.deepEqual(sorted,musicalProfile({...options,tonic,order:'ascending'}).tones);
    if(options.order==='shuffled')assert.notDeepEqual(p.tones,sorted);
    for(const text of ['A','Café 🙂','🙂'.repeat(16)])assert.equal(decode(encode(text,p),p),text);
    assert.throws(()=>encode('x'.repeat(65),p));
  }
  assert.equal(Buffer.from(encode('A',musicalProfile())).toString('hex'),'0303000000000141c2858250');
  assert.equal(Buffer.from(encode('A',musicalProfile({count:64,scale:'minor',order:'shuffled'}))).toString('hex'),'03060001010001411561e322');
  assert.throws(()=>musicalProfile({count:128}));assert.throws(()=>musicalProfile({tonic:12}));
});

test('3-bit, 5-bit and 6-bit packing preserves byte boundaries and requires zero tail padding',()=>{
  for(const bits of [2,3,4,5,6])for(let n=1;n<=75;n++) {
    const bytes=Uint8Array.from({length:n},(_,i)=>(i*137+n*31)&255),values=packSymbols(bytes,bits);
    assert.deepEqual(unpackSymbols(values,n,bits),bytes);
    const unused=values.length*bits-n*8;
    if(unused) { const bad=values.slice();bad[bad.length-1]|=1;assert.throws(()=>unpackSymbols(bad,n,bits),/padding/); }
  }
  assert.deepEqual(packSymbols(Uint8Array.of(0xff),3),[7,7,6]);
  assert.deepEqual(packSymbols(Uint8Array.of(0xff),5),[31,28]);
  assert.deepEqual(packSymbols(Uint8Array.of(0xff),6),[63,48]);
});

test('every musical symbol is classified at its documented frequency, across all tonics',()=>{
  const rate=24000;
  for(const options of configurations)for(let tonic=0;tonic<12;tonic++) {
    const p=musicalProfile({...options,tonic}),n=Math.round(rate*p.seconds*.5);
    for(let symbol=0;symbol<p.tones.length;symbol++) {
      const audio=Float32Array.from({length:n},(_,i)=>.001*Math.sin(2*Math.PI*p.tones[symbol]*i/rate+.73));
      assert.equal(detectTone(audio,rate,0,n,p),symbol,JSON.stringify({...options,tonic,symbol}));
    }
  }
});

test('all counts, scales and orderings round trip exact maximum UTF-8 frames with padded endings',()=>{
  for(const options of configurations) {
    const p=musicalProfile(options),text='🙂'.repeat(16),audio=synthesize(encode(text,p),24000,p);
    assert.deepEqual(messages(receive(audio,p)),[text],JSON.stringify(options));
    assert.equal(audio.length/24000,frameDuration(64,p,24000));
  }
});

test('wrong key, scale, count or shuffle is rejected even when carried on selected profile tones',()=>{
  const p=musicalProfile({count:8}),wrong=[musicalProfile({count:16}),musicalProfile({tonic:1}),musicalProfile({scale:'minor'}),musicalProfile({order:'shuffled'}),PROFILE,DUAL_PROFILE];
  for(const q of wrong) {
    const bytes=encode('A',q);assert.throws(()=>decode(bytes,p),/wrong mode/);
    assert.deepEqual(messages(receive(synthesize(bytes,24000,p),p)),[]);
  }
  const q=musicalProfile({order:'shuffled'});
  assert.deepEqual(messages(receive(synthesize(encode('A',q),24000,q),p)),[]);
});

test('musical corruption, nonzero acoustic padding, truncation and recovery cannot report success',()=>{
  for(const count of [8,32,64]) {
    const p=musicalProfile({count}),bytes=encode('A',p);
    for(const at of [0,1,2,3,4,5,7,bytes.length-1]) {
      const bad=bytes.slice();bad[at]^=0x80;assert.throws(()=>decode(bad,p));
    }
    // A 2-byte payload gives 104 frame bits: nonzero tail padding for 3, 5 and 6 bits/symbol.
    const audio=synthesize(encode('AB',p),24000,p),n=Math.round(24000*p.seconds),values=symbols(encode('AB',p),p);
    const invalid=values.at(-1)|1;
    for(let i=0;i<n;i++)audio[audio.length-n+i]=.45*Math.sin(2*Math.PI*p.tones[invalid]*i/24000);
    const good=synthesize(encode('next',p),24000,p),joined=new Float32Array(audio.length+24000+good.length);
    joined.set(audio);joined.set(good,audio.length+24000);
    const events=receive(joined,p);assert.deepEqual(messages(events),['next']);assert.ok(events.some(e=>e.message==='Nonzero frame padding'));
    assert.throws(()=>decode(bytes.slice(0,-1),p));
    const partial=synthesize(bytes,24000,p).slice(0,-n),tail=new Float32Array(partial.length+n*2);tail.set(partial);
    const truncated=receive(tail,p);assert.deepEqual(messages(truncated),[]);assert.ok(truncated.some(e=>e.type==='error'));
  }
});

test('insufficient sample rates fail explicitly; FSK and dual remain valid',()=>{
  const p=musicalProfile({count:32,tonic:11});assert.throws(()=>synthesize(encode('A',p),16000,p),/Sample rate/);
  assert.throws(()=>new Receiver(16000,()=>{},p),/Sample rate/);
  for(const p of [PROFILE,DUAL_PROFILE])assert.deepEqual(messages(receive(synthesize(encode('A',p),24000,p),p)),['A']);
});


test('64 uses a disclosed microtonal subdivision with unique frequencies, not aliased octaves',()=>{
  const p=musicalProfile({count:64}),q=musicalProfile({count:32});
  assert.equal(p.microtonal,true);assert.equal(p.bits,6);
  for(let i=0;i<32;i++) assert.equal(p.tones[2*i],q.tones[i]);
  for(let i=0;i<31;i++) assert.ok(Math.abs(p.tones[2*i+1]**2-q.tones[i]*q.tones[i+1])<1e-6);
  assert.ok(p.range[1]<6000);assert.ok(p.seconds>.4);
  assert.throws(()=>decode(encode('A',p),q),/wrong mode/);
});
