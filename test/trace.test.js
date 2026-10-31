import test from 'node:test';
import assert from 'node:assert/strict';
import {Receiver,PROFILE,DUAL_PROFILE,musicalProfile,encode,synthesize,symbols,symbolCount} from '../modem.js';
const rate=48000;
function feed(rx,audio) {for(let i=0;i<audio.length;i+=2048)rx.push(audio.subarray(i,i+2048));}
const profiles=[PROFILE,DUAL_PROFILE,...[4,8,16,32,64].map(count=>musicalProfile({count}))];
test('trace streams complete provisional bytes, retains pending bits and removes final padding in every mode',()=>{
  for(const profile of profiles) {
    const bytes=encode('Café 🙂',profile),audio=synthesize(bytes,rate,profile),events=[];
    const rx=new Receiver(rate,e=>events.push(e),profile,true),n=Math.round(rate*profile.seconds);
    const cut=(profile.preamble.length+3)*n;
    feed(rx,audio.subarray(0,cut));
    assert.match(rx.trace.state,/provisional/);
    assert.equal(rx.trace.symbolCount,3);
    assert.equal(rx.trace.pendingBits,3*profile.bits%8);
    assert.deepEqual(rx.trace.bytes,Array.from(bytes.slice(0,Math.floor(3*profile.bits/8))));
    assert.equal(events.some(e=>e.type==='message'),false);
    feed(rx,audio.subarray(cut));
    assert.match(rx.trace.state,/CRC-32 passed/);
    assert.deepEqual(rx.trace.bytes,Array.from(bytes));
    assert.equal(rx.trace.pendingBits,0);
    assert.equal(rx.trace.symbolCount,symbolCount(bytes.length,profile));
    assert.ok(rx.trace.symbols.length<=32);
    rx.reset();assert.equal(rx.trace.bytes.length,0);assert.equal(rx.trace.symbolCount,0);
  }
});
test('trace marks checksum failures and truncated frames rejected and resets for the next frame',()=>{
  for(const profile of profiles) {
    const bytes=encode('hello',profile);bytes[profile.headerBytes]^=1;
    const events=[],rx=new Receiver(rate,e=>events.push(e),profile,true);
    feed(rx,synthesize(bytes,rate,profile));assert.match(rx.traceResult,/Rejected: Checksum failed/);
    assert.equal(events.some(e=>e.type==='message'),false);
    const good=encode('next',profile),audio=synthesize(good,rate,profile);
    feed(rx,new Float32Array(rate));feed(rx,audio);
    assert.deepEqual(rx.trace.bytes,Array.from(good));assert.match(rx.trace.state,/CRC-32 passed/);
    rx.reset();feed(rx,audio.subarray(0,Math.floor(audio.length*.75)));
    for(let i=0;i<Math.ceil(audio.length/rate)+1;i++)feed(rx,new Float32Array(rate));
    assert.match(rx.traceResult,/Rejected: Signal lost/);
    rx.setTracing(false);assert.equal(rx.trace.bytes.length,0);
    rx.reset();feed(rx,audio);assert.equal(rx.trace.bytes.length,0);
  }
});

test('trace never labels nonzero tail padding as verified',()=>{
  for(const count of [8,32,64]) {
    const p=musicalProfile({count}),bytes=encode('AB',p),audio=synthesize(bytes,rate,p),n=Math.round(rate*p.seconds);
    const invalid=symbols(bytes,p).at(-1)|1;
    for(let i=0;i<n;i++)audio[audio.length-n+i]=.45*Math.sin(2*Math.PI*p.tones[invalid]*i/rate);
    const rx=new Receiver(rate,()=>{},p,true);feed(rx,audio);
    assert.match(rx.traceResult,/Rejected: Nonzero frame padding/);
  }
});
