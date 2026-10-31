class Capture extends AudioWorkletProcessor {
  constructor() { super(); this.batch=new Float32Array(2048); this.used=0; }
  process(inputs,outputs) {
    const input=inputs[0]?.[0];
    for(let i=0;i<(outputs[0]?.[0]?.length||128);i++) {
      this.batch[this.used++]=input?.[i]||0;
      if(this.used===this.batch.length) { this.port.postMessage(this.batch); this.used=0; }
    }
    // Output remains silent: microphone audio is never monitored through the speaker.
    return true;
  }
}
registerProcessor('capture',Capture);
