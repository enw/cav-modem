// Dictionary 01: procedural samples, no assets or runtime randomness.
export const DRUM_NAMES=Object.freeze(['kick','snare','hi-hat','tom']);
const bands=[145,1800,6000,550];
function bandpass(rate,hz,q=1.2) {
  const w=2*Math.PI*hz/rate,alpha=Math.sin(w)/(2*q),a0=1+alpha;
  const b=alpha/a0,a1=-2*Math.cos(w)/a0,a2=(1-alpha)/a0;
  let x1=0,x2=0,y1=0,y2=0;
  return x=>{const y=b*(x-x2)-a1*y1-a2*y2;x2=x1;x1=x;y2=y1;y1=y;return y;};
}
export function drumSample(id,rate) {
  if(!Number.isInteger(id)||id<0||id>3)throw new Error('Invalid drum');
  const out=new Float32Array(Math.round(rate*.25)),hit=Math.round(rate*.16);
  const filter=bandpass(rate,bands[id]);let seed=(0x43415644+id)>>>0,peak=0;
  for(let i=0;i<hit;i++) {
    const t=i/rate,decay=id===0||id===3?.05:.035;
    let value;
    if(id===0||id===3) {
      const low=id===0?100:450,high=id===0?180:700;
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
export function detectDrum(samples,rate,begin=0,count=Math.round(rate*.14)) {
  if(begin<0||begin+count>samples.length)return -1;
  const filters=bands.map(hz=>bandpass(rate,hz)),power=[0,0,0,0];let early=0,late=0;
  for(let i=0;i<count;i++) {
    const x=samples[begin+i];if(i<count/2)early+=x*x;else late+=x*x;
    for(let b=0;b<4;b++)power[b]+=filters[b](x)**2;
  }
  if((early+late)/count<1e-10||early<late*1.5)return -1;
  const best=Math.max(...power),id=power.indexOf(best),second=Math.max(...power.filter((_,i)=>i!==id));
  return best>second*2.5&&best>power.reduce((a,b)=>a+b,0)*.6?id:-1;
}
