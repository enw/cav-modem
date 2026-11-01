// Fixed procedural percussion dictionaries: no assets or runtime randomness.
export const DRUM_NAMES=Object.freeze(['kick','snare','hi-hat','tom']);
const bands=[145,1800,6000,550];
export const MIDRANGE_NAMES=Object.freeze(['woodblock','rim-click','high tom','short snare']);
export const MIDRANGE_BANDS=Object.freeze([1100,1550,2100,2800]);
function paletteSettings(palette) {
  if(palette==='original')return {bands,q:1.2};
  if(palette==='midrange')return {bands:MIDRANGE_BANDS,q:8};
  throw new Error('Unsupported drum palette');
}
function bandpass(rate,hz,q=1.2) {
  const w=2*Math.PI*hz/rate,alpha=Math.sin(w)/(2*q),a0=1+alpha;
  const b=alpha/a0,a1=-2*Math.cos(w)/a0,a2=(1-alpha)/a0;
  let x1=0,x2=0,y1=0,y2=0;
  return x=>{const y=b*(x-x2)-a1*y1-a2*y2;x2=x1;x1=x;y2=y1;y1=y;return y;};
}
export function drumSample(id,rate,seconds=.25,palette='original') {
  if(!Number.isInteger(id)||id<0||id>3)throw new Error('Invalid drum');
  if(![.25,.2].includes(seconds))throw new Error('Unsupported drum speed');
  const config=paletteSettings(palette),mid=palette==='midrange';
  const out=new Float32Array(Math.round(rate*seconds)),hit=Math.round(rate*.16);
  const filter=bandpass(rate,config.bands[id],mid?10:1.2);let seed=(0x43415644+id)>>>0,peak=0;
  for(let i=0;i<hit;i++) {
    const t=i/rate,decay=mid?[.035,.018,.05,.025][id]:id===0||id===3?.05:.035;
    let value;
    if(mid?id!==3:id===0||id===3) {
      const low=mid?config.bands[id]*.98:id===0?100:450,high=mid?config.bands[id]*1.03:id===0?180:700;
      const phase=2*Math.PI*(low*t+(high-low)*.03*(1-Math.exp(-t/.03)));
      value=Math.sin(phase);
    } else {
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      value=filter(seed/2**32*2-1);
    }
    out[i]=value*Math.exp(-t/decay)*Math.min(1,t/.002,(hit-1-i)/(rate*.004));
    peak=Math.max(peak,Math.abs(out[i]));
  }
  for(let i=0;i<hit;i++)out[i]=out[i]/peak*.45;
  return out;
}
// Phase-insensitive normalized band energy and decay. Reject ambiguous/steady input.
export function inspectDrum(samples,rate,begin=0,count=Math.round(rate*.14),palette='original') {
  if(begin<0||begin+count>samples.length)return {id:-1,reason:"incomplete window"};
  const config=paletteSettings(palette);
  const filters=config.bands.map(hz=>bandpass(rate,hz,config.q)),power=[0,0,0,0];let early=0,late=0;
  for(let i=0;i<count;i++) {
    const x=samples[begin+i];if(i<count/2)early+=x*x;else late+=x*x;
    for(let b=0;b<4;b++)power[b]+=filters[b](x)**2;
  }
  const meanSquare=(early+late)/count,best=Math.max(...power),id=power.indexOf(best),second=Math.max(...power.filter((_,i)=>i!==id));
  const ratio=best/Math.max(second,1e-30),decay=early/Math.max(late,1e-30),share=best/Math.max(power.reduce((a,b)=>a+b,0),1e-30);
  const reason=meanSquare<1e-10?'below energy floor':early<late*1.5?'insufficient decay':!(best>second*2.5&&best>power.reduce((a,b)=>a+b,0)*.6)?'ambiguous bands':'accepted';
  return {id:reason==='accepted'?id:-1,reason,meanSquare,bandMeanSquares:power.map(x=>x/count),ratio,decay,share};
}
export function detectDrum(samples,rate,begin=0,count=Math.round(rate*.14),palette='original') {
  return inspectDrum(samples,rate,begin,count,palette).id;
}
// Optional main-thread observer. It never feeds symbols into the decoder.
export class DrumProbe {
  constructor(rate,report=()=>{},palette='original') {paletteSettings(palette);this.palette=palette;this.rate=rate;this.report=report;this.window=new Float32Array(Math.round(rate*.14));this.reset();}
  reset() {this.window.fill(0);this.used=0;this.samples=0;this.nextReport=Math.round(this.rate*.25);this.best=null;this.rows=[];this.logs=0;}
  push(chunk) {
    for(const x of chunk) {
      this.window[this.used++]=x;this.samples++;
      if(this.used===this.window.length) {
        const reading=inspectDrum(this.window,this.rate,0,this.window.length,this.palette);
        reading.seconds=(this.samples-this.window.length)/this.rate;
        // Keep the strongest window in each reporting interval, not just the last silent tail.
        if(!this.best||reading.meanSquare>this.best.meanSquare)this.best=reading;
        const hop=Math.round(this.rate*.02);this.window.copyWithin(0,hop);this.used-=hop;
      }
      if(this.samples>=this.nextReport) {
        if(this.best) {
          const row={...this.best,observedSeconds:this.samples/this.rate};this.rows.push(row);this.rows=this.rows.slice(-12);
          if(this.logs<120){this.report(row);this.logs++;}this.best=null;
        }
        this.nextReport+=Math.round(this.rate*.25);
      }
    }
  }
}
