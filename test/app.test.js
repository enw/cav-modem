import test from 'node:test';
import assert from 'node:assert/strict';
const elements=new Map(['message','status','count','send','listen','stop','received','checksum','diagnostics'].map(id=>[id,{value:id==='message'?'Hello':'',textContent:'',disabled:false}]));
globalThis.document={getElementById:id=>elements.get(id)};
let contexts=[],tracks=[],getMedia;
class Context {
  constructor(){this.state='running';this.sampleRate=48000;this.audioWorklet={addModule:async()=>{}};contexts.push(this);}
  async resume(){} async close(){this.closed=true;}
  createBuffer(){return {copyToChannel(){}};}
  createBufferSource(){this.source={connect(){},disconnect(){},start(){},stop(){this.stopped=true;}};return this.source;}
  createMediaStreamSource(){return {connect(){}};}
}
globalThis.window={AudioContext:Context,isSecureContext:true,addEventListener(){}};
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia:()=>getMedia()}}});
globalThis.AudioWorkletNode=class {constructor(){this.port={};}connect(){}disconnect(){}};
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
  getMedia=async()=>makeStream();el('listen').onclick();await flush();assert.match(el('status').textContent,/Listening/);tracks.at(-1).onended();assert.match(el('status').textContent,/disconnected/);assert.equal(tracks.at(-1).stopped,true);
  el('listen').onclick();await flush();stop();assert.equal(tracks.at(-1).stopped,true);
  window.isSecureContext=false;el('listen').onclick();await flush();assert.match(el('status').textContent,/HTTPS/);
});
