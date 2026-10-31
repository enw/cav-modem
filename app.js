import {encode,synthesize,Receiver} from './modem.js';
const $=id=>document.getElementById(id);
let context,stream,source,capture,receiver,epoch=0,active=false;
function status(text) { $('status').textContent=text; }
function update() {
  const bytes=new TextEncoder().encode($('message').value).length;
  $('count').textContent=`${bytes} / 64 UTF-8 bytes${bytes>0&&bytes<=64 ? ` · ${(0.96+(bytes+7)*.16).toFixed(2)} seconds` : ''}`;
  $('send').disabled=active||bytes<1||bytes>64; $('listen').disabled=active; $('stop').disabled=!active;
}
export function stop(message='Stopped. Incomplete frame discarded.') {
  epoch++; active=false;
  if(source) { source.onended=null; try { source.stop(); } catch {} source.disconnect(); source=null; }
  if(capture) { capture.port.onmessage=null; capture.disconnect(); capture=null; }
  stream?.getTracks().forEach(track=>track.stop());stream=null;receiver?.reset();receiver=null;
  const old=context;context=null;old?.close().catch(()=>{});
  status(message);update();
}
async function start(mode) {
  stop('Starting audio…');active=true;update();const token=epoch;
  try {
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext) throw new Error('Web Audio is unavailable in this browser.');
    const audio=new AudioContext();context=audio;
    await audio.resume(); if(token!==epoch) return;
    if(audio.state!=='running') throw new Error('Audio is suspended. Try again from a button click.');
    audio.onstatechange=()=>{if(token===epoch && audio.state==='suspended') stop('Audio suspended. Keep the tab awake and try again.');};
    if(mode==='send') {
      const samples=synthesize(encode($('message').value),audio.sampleRate);
      const buffer=audio.createBuffer(1,samples.length,audio.sampleRate);buffer.copyToChannel(samples,0);
      source=audio.createBufferSource();source.buffer=buffer;source.connect(audio.destination);
      source.onended=()=>{if(token===epoch) stop('Playback complete. Remote receipt is not confirmed.');};
      source.start();status('Transmitting audible tones…');
      $('diagnostics').textContent=`Output sample rate: ${audio.sampleRate} Hz`;return;
    }
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone needs HTTPS or localhost. Ordinary LAN HTTP will not work.');
    status('Waiting for microphone permission…');
    const acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
    if(token!==epoch) { acquired.getTracks().forEach(track=>track.stop());return; }
    stream=acquired;
    const track=stream.getAudioTracks()[0];
    track.onended=()=>{if(token===epoch) stop('Microphone disconnected. Choose Listen to retry.');};
    await audio.audioWorklet.addModule('./capture-worklet.js');if(token!==epoch) return;
    receiver=new Receiver(audio.sampleRate,event=>{
      if(event.type==='message') { $('received').textContent=event.text; $('checksum').textContent='CRC-32 passed · exact UTF-8 frame';status('Valid message received. Still listening…'); }
      else if(event.type==='error') { $('checksum').textContent=`Latest frame rejected: ${event.message}. Prior received text is unchanged.`;status(`${event.message}. Listening for the next frame…`); }
      else status('Receiving frame…');
    });
    capture=new AudioWorkletNode(audio,'capture');
    capture.onprocessorerror=()=>{if(token===epoch) stop('Audio processor failed. Choose Listen to retry.');};
    capture.port.onmessage=event=>{if(token===epoch) {try {receiver.push(event.data);} catch(error) {stop(`Receive error: ${error.message}`);} }};
    const input=audio.createMediaStreamSource(stream);input.connect(capture);capture.connect(audio.destination);
    $('diagnostics').textContent=JSON.stringify({audioSampleRate:audio.sampleRate,capture:track.getSettings()},null,2);
    status('Listening. Send from the other device.');
  } catch(error) { if(token===epoch) stop(`Unable to ${mode}: ${error.message} (${error.name}). Retry when ready.`); }
}
$('send').onclick=()=>start('send');$('listen').onclick=()=>start('listen');$('stop').onclick=()=>stop();$('message').oninput=update;
window.addEventListener('pagehide',()=>stop());update();
