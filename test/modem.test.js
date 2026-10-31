import test from 'node:test';
import assert from 'node:assert/strict';
import {crc32,encode,decode,synthesize,Receiver,PREAMBLE} from '../modem.js';
function run(bytes,rate=48000,tail=[]) {
  const events=[],rx=new Receiver(rate,e=>events.push(e));
  const sound=synthesize(bytes,rate);
  const input=new Float32Array(137+sound.length+rate+tail.length); input.set(sound,137);input.set(tail,137+sound.length+rate);
  for(let i=0;i<input.length;i+=2048) rx.push(input.subarray(i,i+2048));
  return {events,rx};
}
test('CRC standard vector and frozen frame bytes',()=>{
  assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);
  assert.equal(Buffer.from(encode('A')).toString('hex'),'010001418138f83e');
  assert.equal(Buffer.from(encode('Café 🙂')).toString('hex'),'01000a436166c3a920f09f9982c96797fa');
});
test('UTF-8 exact round trips and bounds',()=>{
  for(const text of ['Hello, world!','Café — 🛰️','a'.repeat(64),'🙂'.repeat(16)]) assert.equal(decode(encode(text)),text);
  for(const text of ['', 'a'.repeat(65),'🙂'.repeat(17)]) assert.throws(()=>encode(text));
});
test('corrupt, unsupported, excessive, truncated and invalid UTF-8 rejected',()=>{
  for(const index of [0,1,3,7]) { const b=encode('test');b[index]^=0x80;assert.throws(()=>decode(b)); }
  assert.throws(()=>decode(encode('test').slice(0,-1)));
  const b=encode('A');b[3]=0xff;new DataView(b.buffer).setUint32(4,crc32(b.subarray(0,4)));assert.throws(()=>decode(b),/UTF-8/);
});
test('sample loopback at both common rates, arbitrary onset and maximum payload',()=>{
  for(const rate of [44100,48000]) for(const text of ['Café — 🙂','x'.repeat(64)]) {
    const {events}=run(encode(text),rate);assert.deepEqual(events.filter(e=>e.type==='message').map(e=>e.text),[text]);
  }
});
test('recovers after corrupt frame and noise; no false success',()=>{
  const bad=encode('bad');bad[4]^=1;
  const tail=synthesize(encode('next'),48000);
  const {events}=run(bad,48000,tail);
  assert.ok(events.some(e=>e.type==='error'));assert.deepEqual(events.filter(e=>e.type==='message').map(e=>e.text),['next']);
  const rx=new Receiver(48000,()=>assert.fail('silence should not sync'));
  for(let i=0;i<100;i++) rx.push(new Float32Array(2048));
  assert.ok(rx.samples.length<48000);
});
test('truncated acoustic frame rejected and reset discards state',()=>{
  const events=[],rx=new Receiver(48000,e=>events.push(e));
  const audio=synthesize(encode('truncated'),48000).slice(0,(PREAMBLE.length+16)*1920);
  const input=new Float32Array(audio.length+48000*3);input.set(audio);
  for(let i=0;i<input.length;i+=2048)rx.push(input.subarray(i,i+2048));
  assert.ok(events.some(e=>e.type==='error'));assert.ok(!events.some(e=>e.type==='message'));
  rx.reset();assert.equal(rx.samples.length,0);assert.equal(rx.lock,null);
});
test('deterministic background noise and attenuated signal',()=>{
  const rate=48000, audio=synthesize(encode('noise check'),rate);
  const input=new Float32Array(rate+audio.length+rate);input.set(audio,rate);
  let seed=12345;
  for(let i=0;i<input.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;input[i]=input[i]*.35+(seed/2**32-.5)*.02;}
  const events=[],rx=new Receiver(rate,e=>events.push(e));
  for(let i=0;i<input.length;i+=2048)rx.push(input.subarray(i,i+2048));
  assert.deepEqual(events.filter(e=>e.type==='message').map(e=>e.text),['noise check']);
});
