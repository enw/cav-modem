import {cwProfile,synthesizeCW} from '../cw.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {encode,synthesize,DUAL_PROFILE,DRUM_PROFILE,FAST_DRUM_PROFILE,musicalProfile} from '../modem.js';
const elements=new Map(['cw-speed','cw-controls','cw-normalized','received-title','drum-speed','drum-controls','radio-message','trace-panel','trace','message','status','count','send','listen','stop','received','checksum','diagnostics','input-level','input-meter','mode','profile-details','tone-count','tonic','scale','order','music-controls','music-summary'].map(id=>[id,{value:id==='message'?'Hello':id==='mode'?'fsk':({'cw-speed':'12','drum-speed':'250','tone-count':'8',tonic:'0',scale:'major',order:'ascending'}[id]||''),textContent:'',disabled:false}]));
globalThis.document={getElementById:id=>elements.get(id)};
let contexts=[],tracks=[],getMedia,worklet;
class Context {
  constructor(){this.state='running';this.sampleRate=48000;this.audioWorklet={addModule:async()=>{}};contexts.push(this);}
  async resume(){} async close(){this.closed=true;}
  createBuffer(){return {copyToChannel(){}};}
  createBufferSource(){this.source={connect(){},disconnect(){},start(){},stop(){this.stopped=true;}};return this.source;}
  createMediaStreamSource(){return {connect(){}};}
}
globalThis.window={AudioContext:Context,isSecureContext:true,addEventListener(){}};
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia:()=>getMedia()}}});
globalThis.AudioWorkletNode=class {constructor(){this.port={};worklet=this;}connect(){}disconnect(){}};
// Use actual select option values so persistence validation follows the shipped UI.
const {readFileSync}=await import('node:fs');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
for(const [,id,body] of html.matchAll(/<select id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
  const control=elements.get(id);control.id=id;
  control.options=Array.from(body.matchAll(/<option([^>]*)>([^<]*)<\/option>/g),([,attrs,label])=>({value:attrs.match(/value="([^"]*)"/)?.[1]??label,disabled:false}));
}
const {stop,restoreSettings,saveSettings,SETTINGS_KEY}=await import('../app.js');
const el=id=>elements.get(id);
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const makeStream=()=>{const track={stopped:false,stop(){this.stopped=true;},getSettings(){return {sampleRate:48000};}};tracks.push(track);return {getTracks:()=>[track],getAudioTracks:()=>[track]};};
test('UI lifecycle, failure recovery, pending permission cancellation and disconnect',async()=>{
  el('message').value='🙂'.repeat(17);el('message').oninput();assert.equal(el('send').disabled,true);
  el('message').value='Hello';el('message').oninput();el('send').onclick();await flush();
  assert.match(el('status').textContent,/Transmitting/);assert.equal(el('listen').disabled,true);
  const tx=contexts.at(-1);el('stop').onclick();assert.equal(tx.source.stopped,true);assert.equal(tx.closed,true);assert.equal(el('listen').disabled,false);
  el('send').onclick();await flush();contexts.at(-1).source.onended();assert.match(el('status').textContent,/not confirmed/);
  getMedia=async()=>{throw new DOMException('Permission denied','NotAllowedError');};
  el('listen').onclick();await flush();assert.match(el('status').textContent,/Permission denied/);assert.equal(el('listen').disabled,false);
  let resolve;getMedia=()=>new Promise(r=>resolve=r);el('listen').onclick();await flush();stop();resolve(makeStream());await flush();assert.equal(tracks.at(-1).stopped,true);assert.match(el('status').textContent,/Stopped/);
  getMedia=async()=>makeStream();el('listen').onclick();await flush();assert.match(el('status').textContent,/Listening/);
  for(let i=0;i<6;i++)worklet.port.onmessage({data:new Float32Array(2048)});
  assert.match(el('input-level').textContent,/No input audio/);assert.equal(el('input-meter').value,-100);
  const tone=Float32Array.from({length:2048},(_,i)=>.001*Math.sin(2*Math.PI*1600*i/48000));
  for(let i=0;i<6;i++)worklet.port.onmessage({data:tone});
  assert.match(el('input-level').textContent,/tone near 1600 Hz/);assert.ok(el('input-meter').value>-70);assert.equal(el('received').textContent,'');
  const frame=synthesize(encode('hello world'),48000).map(value=>value*.005);
  for(let i=0;i<frame.length;i+=2048)worklet.port.onmessage({data:frame.subarray(i,i+2048)});
  for(let i=0;i<6;i++)worklet.port.onmessage({data:new Float32Array(2048)});
  assert.equal(el('received').textContent,'hello world');assert.match(el('checksum').textContent,/CRC-32 passed/);
  assert.match(el('status').textContent,/Valid message received/);assert.match(el('input-level').textContent,/1 received/);
  tracks.at(-1).onended();assert.match(el('status').textContent,/disconnected/);assert.equal(tracks.at(-1).stopped,true);assert.equal(el('input-meter').value,-100);
  el('listen').onclick();await flush();stop();assert.equal(tracks.at(-1).stopped,true);
  window.isSecureContext=false;el('listen').onclick();await flush();assert.match(el('status').textContent,/HTTPS/);
});


test('mode selection configures both roles and is locked during activity',async()=>{
  window.isSecureContext=true;
  el('mode').value='dual';el('mode').onchange();
  assert.match(el('profile-details').textContent,/900\+1900/);assert.equal(el('mode').disabled,false);
  el('send').onclick();await flush();assert.equal(el('mode').disabled,true);assert.match(el('diagnostics').textContent,/Dual-tone/);stop();
  getMedia=async()=>makeStream();el('listen').onclick();await flush();assert.equal(el('mode').disabled,true);
  const frame=synthesize(encode('pair hello',DUAL_PROFILE),48000,DUAL_PROFILE);
  for(let i=0;i<frame.length;i+=2048)worklet.port.onmessage({data:frame.subarray(i,i+2048)});
  for(let i=0;i<6;i++)worklet.port.onmessage({data:new Float32Array(2048)});
  assert.equal(el('received').textContent,'pair hello');assert.match(el('checksum').textContent,/Dual-tone pairs/);
  stop();assert.equal(el('mode').disabled,false);el('mode').value='fsk';el('mode').onchange();
});


test('musical controls report computed timing, lock together and receive with the selected dictionary',async()=>{
  el('mode').value='musical';el('mode').onchange();assert.equal(el('music-controls').hidden,false);
  el('tone-count').value='32';el('scale').value='minor';el('order').value='shuffled';el('tonic').value='9';el('order').onchange();
  assert.match(el('profile-details').textContent,/32-tone A4 natural minor/);assert.match(el('count').textContent,/baud/);
  el('listen').onclick();await flush();for(const id of ['mode','tone-count','tonic','scale','order'])assert.equal(el(id).disabled,true);
  const p=musicalProfile({count:32,tonic:9,scale:'minor',order:'shuffled'}),audio=synthesize(encode('music',p),48000,p);
  for(let i=0;i<audio.length;i+=2048)worklet.port.onmessage({data:audio.subarray(i,i+2048)});
  for(let i=0;i<6;i++)worklet.port.onmessage({data:new Float32Array(2048)});
  assert.equal(el('received').textContent,'music');assert.match(el('checksum').textContent,/32-tone A4 natural minor/);
  stop();for(const id of ['mode','tone-count','tonic','scale','order'])assert.equal(el(id).disabled,false);
  el('mode').value='fsk';el('mode').onchange();assert.equal(el('music-controls').hidden,true);
});

test('optional trace is throttled, safe text and cleared on Stop',async()=>{
  window.isSecureContext=true;el('mode').value='fsk';el('mode').onchange();
  el('trace-panel').open=true;el('trace-panel').ontoggle();
  getMedia=async()=>makeStream();el('listen').onclick();await flush();
  const frame=synthesize(encode('<b>hi</b>'),48000);
  for(let i=0;i<frame.length;i+=2048)worklet.port.onmessage({data:frame.subarray(i,i+2048)});
  for(let i=0;i<6;i++)worklet.port.onmessage({data:new Float32Array(2048)});
  assert.match(el('trace').textContent,/CRC-32 passed/);assert.match(el('trace').textContent,/3c 62 3e/);
  assert.match(el('trace').textContent,/<b>hi<\/b>/);assert.equal(el('received').textContent,'<b>hi</b>');
  stop();assert.match(el('trace').textContent,/cleared/);
  el('trace-panel').open=false;el('trace-panel').ontoggle();assert.equal(el('trace').textContent,'Trace off.');
});

test('drum UI selects both roles, traces identities and releases on Stop',async()=>{
  window.isSecureContext=true;el('mode').value='drums';el('mode').onchange();
  assert.match(el('profile-details').textContent,/kick.*90 ms guard/);assert.match(el('count').textContent,/8.00 raw bits/);
  el('trace-panel').open=true;el('trace-panel').ontoggle();getMedia=async()=>makeStream();
  el('listen').onclick();await flush();assert.equal(el('mode').disabled,true);
  const a=synthesize(encode('drums',DRUM_PROFILE),48000,DRUM_PROFILE);
  for(let i=0;i<a.length;i+=2048)worklet.port.onmessage({data:a.subarray(i,i+2048)});
  for(let i=0;i<6;i++)worklet.port.onmessage({data:new Float32Array(2048)});
  assert.equal(el('received').textContent,'drums');assert.match(el('trace').textContent,/CRC-32 passed/);assert.match(el('trace').textContent,/kick|snare|hi-hat|tom/);
  stop();assert.match(el('trace').textContent,/cleared/);assert.equal(tracks.at(-1).stopped,true);
});

test('radio examples rotate without audio, refresh counts in every mode and respect busy state',async()=>{
  const before=contexts.length;
  for(const mode of ['fsk','dual','drums','musical']) {
    el('mode').value=mode;el('mode').onchange();const seen=new Set();
    for(let i=0;i<14;i++) {
      const old=el('message').value;el('radio-message').onclick();const text=el('message').value;
      assert.notEqual(text,old);seen.add(text);const size=new TextEncoder().encode(text).length;
      assert.ok(size<=64);assert.ok(el('count').textContent.startsWith(`${size} / 64 UTF-8 bytes`));assert.match(el('count').textContent,/seconds/);
    }
    assert.equal(seen.size,6);
  }
  assert.equal(contexts.length,before);
  el('message').value='Typed text';el('message').oninput();assert.match(el('count').textContent,/10 \/ 64/);
  el('send').onclick();await flush();assert.equal(el('radio-message').disabled,true);
  el('radio-message').onclick();assert.equal(el('message').value,'Typed text');stop();assert.equal(el('radio-message').disabled,false);
});

test('drum speed updates rate/duration, locks while active and receives the selected profile',async()=>{
  el('mode').value='drums';el('mode').onchange();el('drum-speed').value='200';el('drum-speed').onchange();
  el('message').value='hi';el('message').oninput();assert.match(el('count').textContent,/12.80 seconds.*5.00 baud.*10.00 raw bits/);
  assert.match(el('profile-details').textContent,/40 ms guard/);
  el('radio-message').onclick();assert.match(el('count').textContent,/10.00 raw bits/);
  getMedia=async()=>makeStream();el('listen').onclick();await flush();assert.equal(el('drum-speed').disabled,true);
  const a=synthesize(encode('fast',FAST_DRUM_PROFILE),48000,FAST_DRUM_PROFILE);
  for(let i=0;i<a.length;i+=2048)worklet.port.onmessage({data:a.subarray(i,i+2048)});
  assert.equal(el('received').textContent,'fast');stop();assert.equal(el('drum-speed').disabled,false);
  el('drum-speed').value='250';el('drum-speed').onchange();assert.match(el('count').textContent,/8.00 raw bits/);
});

test('settings validate every select, retain defaults and ignore unrelated stored fields',()=>{
  const controls=Array.from(elements.values()).filter(e=>e.options);
  assert.equal(controls.length,7);
  const initial=controls.map(c=>c.value);
  const saved={'cw-speed':'16','mode':'musical','drum-speed':'200','tone-count':'32','tonic':'9','scale':'minor','order':'shuffled',message:'must not save',active:true};
  restoreSettings(controls,()=>({getItem:()=>JSON.stringify(saved)}));
  for(const c of controls)assert.equal(c.value,saved[c.id]);
  let output;saveSettings(controls,()=>({setItem:(key,value)=>{assert.equal(key,SETTINGS_KEY);output=JSON.parse(value);}}));
  assert.deepEqual(Object.keys(output).sort(),controls.map(c=>c.id).sort());
  for(const c of controls)for(const option of c.options) {
    restoreSettings([c],()=>({getItem:()=>JSON.stringify({[c.id]:option.value})}));assert.equal(c.value,option.value);
  }
  for(const raw of ['broken','null','[]','"text"',JSON.stringify(Object.fromEntries(controls.map(c=>[c.id,'obsolete']))),JSON.stringify({mode:3,'drum-speed':200})]) {
    const before=controls.map(c=>c.value);restoreSettings(controls,()=>({getItem:()=>raw}));assert.deepEqual(controls.map(c=>c.value),before);
  }
  restoreSettings(controls,()=>{throw new Error('SecurityError');});
  saveSettings(controls,()=>{throw new Error('SecurityError');});
  saveSettings(controls,()=>({setItem:()=>{throw new Error('QuotaExceededError');}}));
  controls.forEach((c,i)=>c.value=initial[i]);
});
test('page initialization restores settings before dependent UI and never resumes audio',async()=>{
  const memory=new Map();window.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)};
  el('mode').value='musical';el('tone-count').value='32';el('tonic').value='9';el('scale').value='minor';el('order').value='shuffled';el('mode').onchange();
  el('mode').value='drums';el('drum-speed').value='200';el('mode').onchange();
  const saved=JSON.parse(memory.get(SETTINGS_KEY));assert.equal(saved['tone-count'],'32');assert.equal(saved.scale,'minor');
  el('mode').value='fsk';el('drum-speed').value='250';const before=contexts.length;
  await import('../app.js?reload=drums');
  assert.equal(el('mode').value,'drums');assert.equal(el('drum-speed').value,'200');assert.equal(el('drum-controls').hidden,false);assert.match(el('count').textContent,/10.00 raw bits/);
  el('mode').value='musical';el('mode').onchange();el('tone-count').value='8';el('scale').value='major';
  await import('../app.js?reload=musical');
  assert.equal(el('tone-count').value,'32');assert.equal(el('scale').value,'minor');assert.equal(el('music-controls').hidden,false);assert.match(el('profile-details').textContent,/32-tone A4 natural minor.*shuffled/);
  assert.equal(contexts.length,before);assert.equal(el('stop').disabled,true);assert.equal(memory.size,1);
  delete window.localStorage;
});

test('CW UI normalizes explicitly, rejects unsupported text, persists speed and receives without CRC claims',async()=>{
  el('mode').value='cw';el('mode').onchange();assert.equal(el('cw-controls').hidden,false);
  el('message').value='  cq   test  ';el('message').oninput();assert.equal(el('cw-normalized').textContent,'Will send: CQ TEST');assert.match(el('count').textContent,/7 \/ 64 normalized/);
  el('message').value='Café';el('message').oninput();assert.equal(el('send').disabled,true);assert.match(el('count').textContent,/Unsupported/);
  el('radio-message').onclick();assert.equal(el('send').disabled,false);assert.match(el('profile-details').textContent,/no CRC/);
  el('cw-speed').value='8';el('cw-speed').onchange();assert.match(el('count').textContent,/8 WPM/);
  el('trace-panel').open=true;el('trace-panel').ontoggle();getMedia=async()=>makeStream();el('listen').onclick();await flush();assert.equal(el('cw-speed').disabled,true);
  const a=synthesizeCW('CQ TEST',48000,cwProfile(8));for(let i=0;i<a.length;i+=2048)worklet.port.onmessage({data:a.subarray(i,i+2048)});
  assert.equal(el('received').textContent,'CQ TEST');assert.match(el('checksum').textContent,/no CRC/);assert.match(el('received-title').textContent,/unverified/);assert.match(el('trace').textContent,/No checksum/);
  el('stop').onclick();assert.match(el('trace').textContent,/cleared/);assert.equal(el('cw-speed').disabled,false);
  el('mode').value='fsk';el('mode').onchange();assert.equal(el('cw-controls').hidden,true);
});
