import {encode,synthesize,Receiver,detectTone,PROFILES,musicalProfile,frameDuration} from './modem.js?rev=drum1';
const $=id=>document.getElementById(id);
const BUILD='drum1';
const profileControls=['mode','tone-count','tonic','scale','order'];
const selectedProfile=()=>$('mode').value==='musical'?musicalProfile({count:Number($('tone-count').value),tonic:Number($('tonic').value),scale:$('scale').value,order:$('order').value}):PROFILES[$('mode').value];
let context,stream,source,capture,receiver,epoch=0,active=false;
function showTrace(tone=-1) {
  if(!$('trace-panel').open||!receiver)return;
  const t=receiver.trace,profile=receiver.profile;
  const symbol=id=>profile.names?`${id}:${profile.names[id]}`:`${id}@${profile.dictionary[id].map(hz=>hz.toFixed(1)).join('+')}Hz`;
  $('trace').textContent=`${t.state}
Last result: ${receiver.traceResult}
Input probe: ${tone<0?'no recognized tone':symbol(tone)} (not synchronized)
Frame symbols: ${t.symbolCount}; last 32: ${t.symbols.map(symbol).join(' ')}
Provisional bytes (${t.bytes.length}): ${t.bytes.map(b=>b.toString(16).padStart(2,'0')).join(' ')}
ASCII preview: ${t.bytes.map(b=>b>=32&&b<=126?String.fromCharCode(b):'.').join('')}
Pending bits: ${t.pendingBits}`;
}
$('trace-panel').ontoggle=()=>{receiver?.setTracing($('trace-panel').open);$('trace').textContent=$('trace-panel').open?'Waiting for input; provisional / unverified.':'Trace off.';};
function status(text) { $('status').textContent=text; }
function update() {
  for(const id of profileControls) $(id).disabled=active;
  $('music-controls').hidden=$('mode').value!=='musical';
  const profile=selectedProfile();
  $('music-summary').textContent=profile.id==='musical'?`Experimental · ${profile.range[0].toFixed(1)}–${profile.range[1].toFixed(1)} Hz · closest gap ${profile.minGap.toFixed(2)} Hz · ${profile.seconds*1000} ms symbols. ${profile.microtonal?'64 uses scale notes plus logarithmic midpoints (microtonal), not 64 consecutive scale notes. ':''}Higher pitches may be weak on speakers or microphones; no physical reliability established.`:'';
  const seconds=context?Math.round(context.sampleRate*profile.seconds)/context.sampleRate:profile.seconds;
  const rate=`${(1/seconds).toFixed(2)} baud · ${(profile.bits/seconds).toFixed(2)} raw bits/s`;
  const dictionary=profile.names?'kick / snare / hi-hat / tom · 160 ms hit + 90 ms guard':profile.dictionary.map(pair=>pair.map(hz=>Number(hz.toFixed(2))).join('+')).join(' / ')+' Hz';
  $('profile-details').textContent=`${profile.name} · ${dictionary} · ${(seconds*1000).toFixed(1)} ms symbols · ${rate} · 64-byte limit · CRC-32`;
  const bytes=new TextEncoder().encode($('message').value).length;
  $('count').textContent=`${bytes} / 64 UTF-8 bytes${bytes>0&&bytes<=64 ? ` · ${frameDuration(bytes,profile,context?.sampleRate).toFixed(2)} seconds` : ''} · ${rate}`;
  $('send').disabled=active||bytes<1||bytes>64; $('listen').disabled=active; $('stop').disabled=!active;
}
export function stop(message='Stopped. Incomplete frame discarded.') {
  epoch++; active=false;
  if(source) { source.onended=null; try { source.stop(); } catch {} source.disconnect(); source=null; }
  if(capture) { capture.port.onmessage=null; capture.disconnect(); capture=null; }
  stream?.getTracks().forEach(track=>track.stop());stream=null;receiver?.reset();receiver=null;
  const old=context;context=null;old?.close().catch(()=>{});
  $('trace').textContent='Trace cleared. Microphone inactive.';
  $('input-level').textContent='Microphone inactive.';
  $('input-meter').value=-100;
  status(message);update();
}
async function start(mode) {
  stop('Starting audio…');active=true;update();const token=epoch,profile=selectedProfile();
  try {
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext) throw new Error('Web Audio is unavailable in this browser.');
    const audio=new AudioContext();context=audio;
    await audio.resume(); if(token!==epoch) return;
    update();
    if(audio.state!=='running') throw new Error('Audio is suspended. Try again from a button click.');
    audio.onstatechange=()=>{if(token===epoch && audio.state==='suspended') stop('Audio suspended. Keep the tab awake and try again.');};
    if(mode==='send') {
      const samples=synthesize(encode($('message').value,profile),audio.sampleRate,profile);
      const buffer=audio.createBuffer(1,samples.length,audio.sampleRate);buffer.copyToChannel(samples,0);
      source=audio.createBufferSource();source.buffer=buffer;source.connect(audio.destination);
      source.onended=()=>{if(token===epoch) stop('Playback complete. Remote receipt is not confirmed.');};
      source.start();status('Transmitting audible tones…');
      $('diagnostics').textContent=`${profile.name} · Output sample rate: ${audio.sampleRate} Hz`;return;
    }
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone needs HTTPS or localhost. Ordinary LAN HTTP will not work.');
    status('Waiting for microphone permission…');
    const acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1},video:false});
    if(token!==epoch) { acquired.getTracks().forEach(track=>track.stop());return; }
    stream=acquired;
    const track=stream.getAudioTracks()[0];
    track.onended=()=>{if(token===epoch) stop('Microphone disconnected. Choose Listen to retry.');};
    await audio.audioWorklet.addModule('./capture-worklet.js?rev=drum1');if(token!==epoch) return;
    let syncs=0, failures=0, frames=0, metered=0, sum=0, peak=0;
    const settings={build:BUILD,mode:profile.name,profilePrefix:profile.prefix,symbolMilliseconds:1000*Math.round(audio.sampleRate*profile.seconds)/audio.sampleRate,audioSampleRate:audio.sampleRate,microphone:track.label||'Default input',capture:track.getSettings()};
    const toneWindow=new Float32Array(Math.round(audio.sampleRate*profile.seconds*.5));let toneFilled=0;
    const showDetails=()=>{ $('diagnostics').textContent=JSON.stringify({...settings,syncs,failures,frames},null,2); };
    receiver=new Receiver(audio.sampleRate,event=>{
      if(event.type==='message') { frames++; $('received').textContent=event.text; $('checksum').textContent=`${profile.name} · CRC-32 passed · exact UTF-8 frame`;status('Valid message received. Still listening…'); }
      else if(event.type==='error') { failures++; $('checksum').textContent=`Latest frame rejected: ${event.message}. Prior received text is unchanged.`;status(`${event.message}. Listening for the next frame…`); }
      else { syncs++; status('Signal synchronized. Receiving frame…'); }
      showDetails();
    },profile,$('trace-panel').open);
    capture=new AudioWorkletNode(audio,'capture');
    capture.onprocessorerror=()=>{if(token===epoch) stop('Audio processor failed. Choose Listen to retry.');};
    capture.port.onmessage=event=>{if(token===epoch) {
      try {
        for(const sample of event.data) { sum+=sample*sample; peak=Math.max(peak,Math.abs(sample)); }
        receiver.push(event.data);
        const chunk=event.data;
        if(chunk.length>=toneWindow.length) toneWindow.set(chunk.subarray(chunk.length-toneWindow.length));
        else { toneWindow.copyWithin(0,chunk.length);toneWindow.set(chunk,toneWindow.length-chunk.length); }
        toneFilled=Math.min(toneWindow.length,toneFilled+chunk.length);
        metered+=chunk.length;
        if(metered>=audio.sampleRate*.25) {
          const rms=Math.sqrt(sum/metered), db=20*Math.log10(Math.max(rms,1e-10));
          const tone=toneFilled===toneWindow.length?detectTone(toneWindow,audio.sampleRate,0,toneWindow.length,profile):-1;
          const level=rms<1e-5?'No input audio':`Input audio: ${db.toFixed(0)} dBFS`;
          const toneLabel=tone<0?'no modem-frequency tone':profile.names?`drum-like ${profile.names[tone]} (not proof of a frame)`:`tone near ${profile.dictionary[tone].map(hz=>Number(hz.toFixed(1))).join(' + ')} Hz (not proof of a frame)`;
          $('input-meter').value=Math.max(-100,Math.min(0,db));
          $('input-level').textContent=`${level} · ${toneLabel}${peak>=.98?' · input near full scale: lower sender volume':''} · ${syncs} syncs · ${failures} rejected · ${frames} received`;
          showTrace(tone);
          metered=0;sum=0;peak=0;
        }
      } catch(error) {stop(`Receive error: ${error.message}`);}
    }};
    const input=audio.createMediaStreamSource(stream);input.connect(capture);capture.connect(audio.destination);
    showDetails();
    $('input-level').textContent='Waiting for microphone samples…';
    track.onmute=()=>{if(token===epoch) status('Microphone input muted or interrupted. Check the selected input.');};
    track.onunmute=()=>{if(token===epoch) status('Microphone input resumed. Listening…');};
    status('Listening. Send from the other device.');
  } catch(error) { if(token===epoch) stop(`Unable to ${mode}: ${error.message} (${error.name}). Retry when ready.`); }
}
$('send').onclick=()=>start('send');$('listen').onclick=()=>start('listen');$('stop').onclick=()=>stop();$('message').oninput=update;for(const id of profileControls) $(id).onchange=()=>{stop('Mode changed. Select the same mode on the other device.');$('diagnostics').textContent=`Receiver build ${BUILD} · ${selectedProfile().name}`;};
window.addEventListener('pagehide',()=>stop());
$('diagnostics').textContent=`Receiver build ${BUILD}. Microphone starts only when you choose Listen.`;
update();
