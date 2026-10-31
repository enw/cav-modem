# Browser modem tickets

- [x] 01 Freeze wire profile and implement byte codec and acoustic DSP. Evidence: WIRE-FORMAT.md and deterministic Node tests, including 44.1/48 kHz loopback.
- [x] 02 Build Send, Listen, Stop page with permission requests, bounded receive processing, and explicit errors. Evidence: app.js, capture-worklet.js, UI lifecycle tests, browser Send/Stop checks.
- [x] 03 Verify browser page and local loopback; document launch and manual acceptance. Evidence: Chrome offline AudioWorklet pass and README instructions. No dependencies installed or publication performed.
- [ ] 04 Physical qualification: 10 messages each direction, at least 9 exact CRC-passing successes per direction, zero incorrect successes, acoustic isolation check, and recorded conditions. Requires two physical devices and user-granted microphone access. Phone qualification remains separate.

Software tickets are complete. Physical two-device acceptance remains open; simulated results do not close it.

- [x] 05 Diagnose quiet reception and add live input diagnostics. Build `rx2` accepts quiet clear signals formerly rejected by the absolute volume gate; 11 automated tests and synthetic browser checks cover the change. Live level meter separates input activity, modem-frequency tones, synchronization, and frame validation. Physical user failure remains unconfirmed pending retest.

Physical progress: the user reported that a short `hello world` message crossed the acoustic path successfully after increasing sender playback volume on 31 October 2026, using the existing deployed baseline before `rx2` was published. Device/browser details, conditions, and repeated reliability measurements were not recorded. This single reported success does not close ticket 04.
