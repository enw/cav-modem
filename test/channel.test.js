import test from 'node:test';
import assert from 'node:assert/strict';
import {encode,symbols,PROFILE,DUAL_PROFILE,Receiver} from '../modem.js';

// Deterministic acoustic-channel approximation, not physical acceptance.
function channel(text,{txRate=48000,rate=48000,gain=1,onset=.107,ppm=0,phase=.73,echo=0,delay=.012,noise=0,profile=PROFILE}={}) {
  const sequence=symbols(encode(text,profile),profile), n=Math.round(txRate*.04), ramp=Math.round(txRate*.002);
  const source=new Float32Array(sequence.length*n);
  for(let s=0;s<sequence.length;s++) for(let i=0;i<n;i++) {
    const pair=profile.dictionary[sequence[s]];
    source[s*n+i]=.45*Math.min(1,i/ramp,(n-1-i)/ramp)*pair.reduce((sum,hz)=>sum+Math.sin(2*Math.PI*hz*i/txRate+phase),0)/pair.length;
  }
  const ratio=txRate/rate*(1+ppm/1e6), lead=Math.round(rate*onset);
  const output=new Float32Array(lead+Math.ceil(source.length/ratio)+rate);
  const sample=x=>{
    if(x<0||x>=source.length-1)return 0;
    const i=Math.floor(x),f=x-i;return source[i]*(1-f)+source[i+1]*f;
  };
  let seed=7;
  for(let i=0;i<output.length;i++) {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const x=(i-lead)*ratio;
    output[i]=gain*(sample(x)+echo*sample(x-delay*txRate))+(seed/2**32-.5)*noise;
  }
  const events=[],receiver=new Receiver(rate,event=>events.push(event),profile);
  for(let i=0;i<output.length;i+=2048)receiver.push(output.subarray(i,i+2048));
  return events;
}

test('quiet clear acoustic signal is not rejected by an absolute volume gate',()=>{
  for(const gain of [.005,.001]) {
    const text='quiet Café 🙂';
    const events=channel(text,{gain,noise:gain*.01});
    assert.deepEqual(events.filter(e=>e.type==='message').map(e=>e.text),[text],`gain ${gain}: ${JSON.stringify(events)}`);
  }
});

test('maximum frames survive differing sample rates, onset, phase, clock drift and short echo',()=>{
  const text='0123456789abcdef'.repeat(4);
  for(const options of [
    {txRate:44100,rate:48000,ppm:500,onset:.103,phase:2.4},
    {txRate:48000,rate:44100,ppm:-500,onset:.115,phase:1.2},
    {ppm:1000,onset:.107,echo:.65,gain:.03,noise:.0002},
    {ppm:-1000,onset:.103,echo:.65,gain:.03,noise:.0002},
  ]) {
    const events=channel(text,options);
    assert.deepEqual(events.filter(e=>e.type==='message').map(e=>e.text),[text],JSON.stringify(options));
  }
});

test('ambient noise alone and tones too buried in noise never yield a successful frame',()=>{
  for(const options of [{gain:0,noise:.001},{gain:0,noise:.1},{gain:.001,noise:.1}]) {
    assert.equal(channel('not a valid reception',options).filter(e=>e.type==='message').length,0);
  }
});


test('dual-tone maximum frames survive quiet gain, noise, onset, phase, resampling and drift',()=>{
  const text='0123456789abcdef'.repeat(4);
  for(const options of [
    {gain:.001,noise:.00001},
    {txRate:44100,rate:48000,ppm:500,onset:.103,phase:2.4},
    {txRate:48000,rate:44100,ppm:-500,onset:.115,phase:1.2},
    {ppm:500,echo:.3,gain:.03,noise:.0002},
    {ppm:-500,echo:.3,gain:.03,noise:.0002},
  ]) {
    const events=channel(text,{...options,profile:DUAL_PROFILE});
    assert.deepEqual(events.filter(e=>e.type==='message').map(e=>e.text),[text],JSON.stringify(options));
  }
});

test('dual-tone noise-only and buried signals produce no successful messages',()=>{
  for(const options of [{gain:0,noise:.001},{gain:0,noise:.1},{gain:.001,noise:.1}]) {
    assert.equal(channel('noise',{...options,profile:DUAL_PROFILE}).filter(e=>e.type==='message').length,0);
  }
});
