import test from 'node:test';
import assert from 'node:assert/strict';
import {MORSE,cwProfile,normalizeCW,cwSegments,cwDuration,synthesizeCW,detectCW,CWReceiver} from '../cw.js';
function feed(rx,a) {for(let i=0;i<a.length;i+=2048)rx.push(a.subarray(i,i+2048));}
function receive(a,rate=48000,p=cwProfile()) {const events=[],rx=new CWReceiver(rate,e=>events.push(e),p,true);feed(rx,a);return {events,rx};}
const messages=r=>r.events.filter(e=>e.type==='message').map(e=>e.text);
function runs(parts,rate=48000,p=cwProfile()) {
  const n=Math.round(rate*p.seconds),a=new Float32Array(parts.reduce((s,[,u])=>s+Math.round(u*n),0));let at=0;
  for(const [on,u] of parts){const length=Math.round(u*n);if(on)for(let i=0;i<length;i++)a[at+i]=.2*Math.sin(2*Math.PI*700*i/rate);at+=length;}return a;
}
test('CW mapping, normalization, support limits and exact standard spacing',()=>{
  assert.equal(MORSE.S,'...');assert.equal(MORSE.O,'---');assert.equal(MORSE['?'],'..--..');assert.equal(MORSE['@'],'.--.-.');assert.equal(new Set(Object.values(MORSE)).size,44);
  assert.equal(normalizeCW(' \tcq\n cq  de test '),'CQ CQ DE TEST');
  for(const input of ['','  ','Café','ß','🙂','HELLO!','A'.repeat(65)])assert.throws(()=>normalizeCW(input));
  assert.equal(normalizeCW('A'.repeat(64)).length,64);assert.throws(()=>cwProfile(30));
  assert.deepEqual(cwSegments('E E').map(s=>[s.on,s.units]),[[false,1],[true,1],[false,7],[true,1],[false,14]]);
  assert.deepEqual(cwSegments('A').map(s=>[s.on,s.units]),[[false,1],[true,1],[false,1],[true,3],[false,14]]);
  assert.ok(Math.abs(cwDuration('PARIS')-5.8)<1e-12); // PARIS = 50 units including its standard 7-unit word gap; here lead 1 + tail 14 replace that gap.
  for(const rate of [44100,48000])assert.equal(synthesizeCW('CQ CQ',rate).length,Math.round(cwDuration('CQ CQ',cwProfile(),rate)*rate));
});
test('all CW characters round trip at supported speeds/sample rates with bounded plain-text trace',()=>{
  const text='ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 . , ? / = + - @';
  for(const rate of [44100,48000])for(const wpm of [8,12,16]) {
    const p=cwProfile(wpm),r=receive(synthesizeCW(text,rate,p),rate,p);assert.deepEqual(messages(r),[text],JSON.stringify({rate,wpm,events:r.events}));
    assert.equal(r.events.at(-1).verified,false);assert.ok(r.rx.trace.marks.length<=64);assert.match(r.rx.trace.state,/no CRC/);
  }
});
test('CW tolerates arbitrary onset, quiet gain, noise, phase inversion and modest resampling stretch',()=>{
  for(const rate of [44100,48000])for(const wpm of [8,12,16]) {
    const p=cwProfile(wpm),src=synthesizeCW('CQ TEST 599?',48000,p),lead=Math.round(rate*.137),a=new Float32Array(lead+Math.ceil(src.length*rate/48000*1.02)+rate);let seed=17;
    for(let i=lead;i<a.length;i++) {const x=(i-lead)*48000/rate/1.02,j=Math.floor(x);seed=(Math.imul(seed,1664525)+1013904223)>>>0;a[i]=-.005*((src[j]||0)*(1-x+j)+(src[j+1]||0)*(x-j))+.00001*(seed/2**32-.5);}
    assert.deepEqual(messages(receive(a,rate,p)),['CQ TEST 599?']);
  }
});
test('CW silence, noise and ambiguous tone/mark/gap patterns reject without delivery',()=>{
  let seed=4;const noise=Float32Array.from({length:48000*3},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return .05*(seed/2**32-.5);});
  assert.deepEqual(messages(receive(noise)),[]);assert.deepEqual(messages(receive(new Float32Array(48000*3))),[]);
  const mixed=Float32Array.from({length:480},(_,i)=>.1*(Math.sin(2*Math.PI*700*i/48000)+Math.sin(2*Math.PI*900*i/48000)));assert.equal(detectCW(mixed,48000),false);
  for(const parts of [[[false,1],[true,2],[false,14]],[[false,1],[true,1],[false,2],[true,1],[false,14]],[[false,1],[true,8],[false,14]],[[false,1],[true,.3],[false,14]]]) {
    const r=receive(runs(parts));assert.deepEqual(messages(r),[]);assert.ok(r.events.some(e=>e.type==='error'));
  }
  const unknown=[[false,1],...[1,1,1,1,1,1].flatMap(()=>[[true,1],[false,1]]),[false,14]];assert.deepEqual(messages(receive(runs(unknown))),[]);
});
test('CW gap classes, silence finalization, repeated transmissions and reset',()=>{
  for(const [gap,expected] of [[1,'I'],[3,'EE'],[7,'E E']])assert.deepEqual(messages(receive(runs([[false,1],[true,1],[false,gap],[true,1],[false,14]]))),[expected]);
  const p=cwProfile(),events=[],rx=new CWReceiver(48000,e=>events.push(e),p,true),a=synthesizeCW('TEST',48000,p);
  feed(rx,a.subarray(0,a.length-14*4800));assert.equal(events.some(e=>e.type==='message'),false);
  rx.reset();feed(rx,new Float32Array(48000*2));assert.equal(events.some(e=>e.type==='message'),false);assert.equal(rx.trace.marks,'');
  feed(rx,a);feed(rx,a);assert.deepEqual(events.filter(e=>e.type==='message').map(e=>e.text),['TEST','TEST']);
  assert.throws(()=>rx.push(new Float32Array(48001)),/too large/);
  feed(rx,new Float32Array(48000));assert.ok(rx.run<=160);
});
