# cav-modem

**[Live demo](https://enw.github.io/cav-modem/)** — open on both devices to try the audio modem.

A small browser page that sends short UTF-8 text through a speaker and receives it through a microphone. Selectable classic four-tone FSK, dual-tone pairs, or experimental musical FSK, 64-byte payloads, CRC-32, and Send / Listen / Stop. Select the same mode and settings on both devices. Classic and dual-tone run at 50 raw bits/s; musical rates depend on pitch spacing and are displayed on the page. Messages stay local; there is no backend message transport.

## Run locally

With Node.js installed:

```sh
npm start
```

Open **http://localhost:8080**. No package installation or build step is needed. `PORT=8081 npm start` selects another port. The server binds only to loopback.

The initial implementation uses native JavaScript modules rather than the proposal's TypeScript toolchain to keep setup dependency-free. Browser DSP runs through Web Audio and an AudioWorklet. No microphone is opened until you choose Listen and grant permission.

## Checks

```sh
npm test
```

Open http://localhost:8080/browser-check.html and choose **Run browser audio check** for generated audio through a real browser OfflineAudioContext and AudioWorklet. Choose **Run silent real-time classic check** to feed a frozen rx2 waveform through the current real-time AudioWorklet and receiver. Neither check captures the microphone or plays sound.

The current local experiment has 47 passing Node tests, including all 240 musical dictionary configurations and individual-tone classifications, variable-width padding, exact UTF-8 boundaries, wrong profiles, malformed frames, channel simulations, and mocked UI lifecycle/error handling. Chrome's offline AudioWorklet check passes 24 profiles: classic, dual-tone, both drum speeds, and all musical count/scale/order combinations at C4. No microphone is activated by these checks. Physical success has only been user-reported for a short baseline FSK message; repeated acceptance for the new profiles remains open.

## Try two devices

1. Run a local copy on each desktop/laptop and open its own `http://localhost:8080`. This avoids LAN HTTP microphone restrictions. Alternatively use an already trusted HTTPS setup; this project does not provision certificates or publish a site.
2. Keep both tabs foregrounded and devices awake. Start at a short distance with modest speaker volume and nonsecret test text.
3. Select the same mode on both devices. On B, choose **Listen**, grant microphone permission yourself, and wait for the listening status. Expand details to check actual capture settings and sample rate.
4. On A, enter up to 64 UTF-8 bytes and choose **Send**. Check exact text and CRC-passed status on B. Playback complete on A is not a delivery receipt.
5. Stop B before swapping roles. Perform 10 messages each way; target at least 9 exact successes per direction and zero incorrect successes. Include accents, punctuation, emoji, and a 64-byte payload. Record failures rather than replacing them with resend successes.
6. Mute A and send a new message: B must not receive it. Restore audio and verify reception. Check Stop mid-frame and recovery on the next frame.

Record devices, OS/browser versions, capture settings, sample rates, distance, orientation, noise, volume, duration, and every result. Phones, physical reliability, room echoes, microphone processing, and clock drift remain unqualified. Ordinary HTTP on another device's LAN address is not a secure microphone context.

See the [wire profile](WIRE-FORMAT.md), [tickets](TICKETS.md), and original [proposal](browser-audio-modem-proposal.md).

## Musical experiment

Choose Musical FSK, then 4/8/16/32 tones, a root (C4–B4), major or natural minor, and ascending or fixed-seed shuffled mapping. Both devices derive the same dictionary; no independent randomness is used. The 64 option is explicitly microtonal: scale notes plus logarithmic midpoints, not 64 consecutive notes. Range, minimum separation, symbol timing, baud, raw bit rate and duration are shown. It is not a speed upgrade and can reach poorly reproduced high pitches. Low audio sample rates that cannot support a profile fail explicitly.

Start physical comparisons at 4/8 tones. Musical beauty, reception on hardware, and 32/64-tone practicality are unverified. See the [wire specification](WIRE-FORMAT.md) for exact generation, shuffle, frame, padding and timing rules, and the [roadmap](ROADMAP.md) for evaluation and deferred experiments.

Expand **Temporary live decode trace** while listening for a sampled tone ID/frequency, the last 32 synchronized frame symbols, provisional header/payload/checksum bytes in hex, a safe ASCII preview, pending bits, and the last validation result. Updates are limited to four per second; no extra worklet messages, recordings, uploads or persistent logs are added. Stop/new sessions clear the trace. Partial bytes are never delivered as received text. Build `trace1` is local until deployed.

Local build `drum1` adds **Drum samples (experiment)**: kick/snare/hi-hat/tom, one hit per 250 ms slot, 8 raw bits/s. Select it on both devices. Try `hi` first (16 seconds including framing); a 64-byte frame takes 78 seconds. Fixed procedural samples only, no uploads or dependencies. The live trace names detected drums. Physical drum reception remains unqualified; no microphone or audible playback was used for development. Existing FSK modes remain available. This local update is not yet on GitHub Pages.

**Try a radio message** cycles through six short ham-radio-style examples. It replaces the text and recalculates byte count/duration without starting audio. The button is unavailable while sending or listening. No real callsigns or external generation service are used.

Local build `drum2` adds **Drum speed — match on both devices**: 250 ms by default (4 baud / 8 raw bits/s), or experimental 200 ms (5 baud / 10 raw bits/s). The 250 ms setting remains compatible with `drum1`. A `hi` frame takes 16 or 12.8 seconds respectively. Mode, speed and example selection are locked during activity; neither button starts audio. No physical reliability claim applies to either speed. These changes are committed locally until a separate deployment is approved.
