import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectDrum,detectDrum,drumSample,DrumProbe} from '../drums.js';
import {Receiver,DRUM_PROFILE,FAST_DRUM_PROFILE,encode,synthesize} from '../modem.js';
test('drum diagnostics expose unchanged classifications and rejection measures',()=>{
  for(const rate of [44100,48000])for(let id=0;id<4;id++) {
    const sample=drumSample(id,rate),r=inspectDrum(sample,rate,Math.round(rate*.008));
    assert.equal(r.id,id);assert.equal(detectDrum(sample,rate,Math.round(rate*.008)),id);assert.equal(r.reason,'accepted');
    assert.equal(r.bandMeanSquares.length,4);assert.ok(r.ratio>2.5);assert.ok(r.decay>=1.5);assert.ok(r.share>.6);
  }
  assert.equal(inspectDrum(new Float32Array(6720),48000).reason,'below energy floor');
  assert.equal(inspectDrum(new Float32Array(10),48000).reason,'incomplete window');
  const steady=Float32Array.from({length:6720},(_,i)=>.1*Math.sin(2*Math.PI*550*i/48000));
  assert.equal(inspectDrum(steady,48000).reason,'insufficient decay');
});
test('optional drum observer leaves decoder outcomes identical and bounds diagnostics',()=>{
  for(const profile of [DRUM_PROFILE,FAST_DRUM_PROFILE]) {
    const samples=synthesize(encode('TNX FER CONTACTS 73',profile),48000,profile),off=[],on=[],logs=[];
    const a=new Receiver(48000,e=>off.push(e),profile),b=new Receiver(48000,e=>on.push(e),profile),probe=new DrumProbe(48000,r=>logs.push(r));
    for(let i=0;i<samples.length;i+=2048){const chunk=samples.subarray(i,i+2048);a.push(chunk);b.push(chunk);probe.push(chunk);}
    assert.deepEqual(on,off);assert.equal(on.find(e=>e.type==='message').text,'TNX FER CONTACTS 73');
    assert.ok(probe.rows.length<=12);assert.ok(logs.length<=120);assert.ok(logs.some(r=>r.id>=0));
    for(let i=1;i<logs.length;i++)assert.ok(logs[i].observedSeconds-logs[i-1].observedSeconds>=.25-1e-9);
    for(let i=0;i<40;i++)probe.push(new Float32Array(48000));
    assert.equal(logs.length,120);assert.equal(probe.rows.length,12);
    probe.reset();assert.equal(probe.rows.length,0);assert.equal(probe.logs,0);assert.equal(probe.samples,0);
  }
});
