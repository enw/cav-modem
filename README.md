# cav-modem

**[Live demo](https://enw.github.io/cav-modem/)** — open on both devices to try the audio modem.

A small browser page that sends short UTF-8 text through a speaker and receives it through a microphone. Single-tone four-frequency modulation, 64-byte payloads, CRC-32, and Send / Listen / Stop. Messages stay local; there is no backend message transport.

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

Open http://localhost:8080/browser-check.html and choose **Run browser audio check** for generated audio through a real browser OfflineAudioContext and AudioWorklet. This test neither captures the microphone nor plays sound.

On 31 October 2026, eight Node tests passed: CRC vectors, exact UTF-8 and boundaries, malformed frames, 44.1/48 kHz sample loopback, corruption recovery, truncation/reset, deterministic added noise, and mocked UI lifecycle/error handling. Chrome's offline AudioWorklet check passed. Browser UI checks confirmed oversized emoji input disables Send, Send enters transmitting state, and Stop restores idle controls. These are software checks, not physical two-device acceptance. Microphone permission and capture were not activated during verification.

## Try two devices

1. Run a local copy on each desktop/laptop and open its own `http://localhost:8080`. This avoids LAN HTTP microphone restrictions. Alternatively use an already trusted HTTPS setup; this project does not provision certificates or publish a site.
2. Keep both tabs foregrounded and devices awake. Start at a short distance with modest speaker volume and nonsecret test text.
3. On B, choose **Listen**, grant microphone permission yourself, and wait for the listening status. Expand details to check actual capture settings and sample rate.
4. On A, enter up to 64 UTF-8 bytes and choose **Send**. Check exact text and CRC-passed status on B. Playback complete on A is not a delivery receipt.
5. Stop B before swapping roles. Perform 10 messages each way; target at least 9 exact successes per direction and zero incorrect successes. Include accents, punctuation, emoji, and a 64-byte payload. Record failures rather than replacing them with resend successes.
6. Mute A and send a new message: B must not receive it. Restore audio and verify reception. Check Stop mid-frame and recovery on the next frame.

Record devices, OS/browser versions, capture settings, sample rates, distance, orientation, noise, volume, duration, and every result. Phones, physical reliability, room echoes, microphone processing, and clock drift remain unqualified. Ordinary HTTP on another device's LAN address is not a secure microphone context.

See the [wire profile](WIRE-FORMAT.md), [tickets](TICKETS.md), and original [proposal](browser-audio-modem-proposal.md).
