import test from 'node:test';
import assert from 'node:assert/strict';
import {PROFILE,DUAL_PROFILE as D,encode,decode,symbols,synthesize,detectTone,Receiver,crc32} from '../modem.js';
function receive(audio,profile=D,rate=48000) {
  const input=new Float32Array(173+audio.length+rate*2);input.set(audio,173);
  const events=[],rx=new Receiver(rate,e=>events.push(e),profile);
  for(let i=0;i<input.length;i+=2048)rx.push(input.subarray(i,i+2048));
  return events;
}
const messages=events=>events.filter(e=>e.type==='message').map(e=>e.text);

test('dual profile byte, dictionary, CRC, UTF-8 and limits',()=>{
  assert.equal(Buffer.from(encode('A',D)).toString('hex'),'02000141938d57d0');
  assert.equal(Buffer.from(encode('Café 🙂',D)).toString('hex'),'02000a436166c3a920f09f998274adfb34');
  assert.equal(D.preamble.join(''),'303030302103123011320213');
  assert.deepEqual(D.dictionary,[[900,1900],[900,2300],[1300,1900],[1300,2300]]);
  for(const text of ['A','Café — 🙂','🙂'.repeat(16)]) {
    const bytes=encode(text,D);assert.equal(bytes[0],2);assert.equal(decode(bytes,D),text);
    assert.throws(()=>decode(bytes,PROFILE),/wrong mode/);
    assert.deepEqual(messages(receive(synthesize(bytes,48000,D))),[text]);
  }
  assert.throws(()=>decode(encode('A'),D),/wrong mode/);
  for(const text of ['','x'.repeat(65)])assert.throws(()=>encode(text,D));
  assert.equal(synthesize(encode('x'.repeat(64),D),48000,D).length/48000,12.32);
  assert.deepEqual(symbols(Uint8Array.of(0x1b),D).slice(-4),[0,1,2,3]);
});

test('both tones required: single frequencies, strong imbalance and out-of-dictionary pairs rejected',()=>{
  const rate=48000,n=960;
  const signal=(hz,gains=hz.map(()=>1))=>Float32Array.from({length:n},(_,i)=>hz.reduce((sum,f,j)=>sum+gains[j]*Math.sin(2*Math.PI*f*i/rate),0)*.1);
  for(let i=0;i<4;i++)assert.equal(detectTone(signal(D.dictionary[i]),rate,0,n,D),i);
  for(const hz of [900,1300,1900,2300])assert.equal(detectTone(signal([hz]),rate,0,n,D),-1);
  assert.equal(detectTone(signal([900,2300],[1,.1]),rate,0,n,D),-1);
  assert.equal(detectTone(signal([900,1300]),rate,0,n,D),-1);
  assert.equal(detectTone(signal([1900,2300]),rate,0,n,D),-1);
});

test('wrong acoustic mode and wrong CRC-covered profile byte cannot succeed',()=>{
  assert.deepEqual(messages(receive(synthesize(encode('FSK'),48000),D)),[]);
  assert.deepEqual(messages(receive(synthesize(encode('dual',D),48000,D),PROFILE)),[]);
  // Even a valid FSK header/CRC modulated with the dual preamble and tones is rejected.
  const events=receive(synthesize(encode('wrong header'),48000,D));
  assert.deepEqual(messages(events),[]);assert.ok(events.some(e=>e.type==='error'));
});

test('dual corruption, malformed headers, truncated audio and recovery',()=>{
  const good=synthesize(encode('next',D),48000,D);
  for(const index of [0,1,3,7]) {
    const bytes=encode('test',D);bytes[index]^=0x80;
    assert.throws(()=>decode(bytes,D));
    const bad=synthesize(bytes,48000,D), joined=new Float32Array(bad.length+48000+good.length);
    joined.set(bad);joined.set(good,bad.length+48000);
    const events=receive(joined);assert.deepEqual(messages(events),['next']);assert.ok(events.some(e=>e.type==='error'));
  }
  const bytes=encode('test',D);assert.throws(()=>decode(bytes.slice(0,-1),D));
  const invalid=encode('A',D);invalid[3]=0xff;new DataView(invalid.buffer).setUint32(4,crc32(invalid.subarray(0,4)));assert.throws(()=>decode(invalid,D),/UTF-8/);
  const events=receive(synthesize(bytes,48000,D).slice(0,48000*1.6));
  assert.deepEqual(messages(events),[]);assert.ok(events.some(e=>e.type==='error'));
});
