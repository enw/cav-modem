import test from 'node:test';
import assert from 'node:assert/strict';
import {encode,synthesize} from '../modem.js';
const elements=new Map(['message','status','count','send','listen','stop','received','checksum','diagnostics','input-level','input-meter'].map(id=>[id,{value:id==='message'?'Hello':'',textContent:'',disabled:false}]));
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
const {stop}=await import('../app.js');
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
