# Browser modem tickets

- [x] 01 Freeze wire profile and implement byte codec and acoustic DSP. Evidence: WIRE-FORMAT.md and deterministic Node tests, including 44.1/48 kHz loopback.
- [x] 02 Build Send, Listen, Stop page with permission requests, bounded receive processing, and explicit errors. Evidence: app.js, capture-worklet.js, UI lifecycle tests, browser Send/Stop checks.
- [x] 03 Verify browser page and local loopback; document launch and manual acceptance. Evidence: Chrome offline AudioWorklet pass and README instructions. No dependencies installed or publication performed.
- [ ] 04 Physical qualification: 10 messages each direction, at least 9 exact CRC-passing successes per direction, zero incorrect successes, acoustic isolation check, and recorded conditions. Requires two physical devices and user-granted microphone access. Phone qualification remains separate.

Software tickets are complete. Physical two-device acceptance remains open; simulated results do not close it.

- [x] 05 Diagnose quiet reception and add live input diagnostics. Build `rx2` accepts quiet clear signals formerly rejected by the absolute volume gate; 11 automated tests and synthetic browser checks cover the change. Live level meter separates input activity, modem-frequency tones, synchronization, and frame validation. Physical user failure remains unconfirmed pending retest.

Physical progress: the user reported that a short `hello world` message crossed the acoustic path successfully after increasing sender playback volume on 31 October 2026, using the existing deployed baseline before `rx2` was published. Device/browser details, conditions, and repeated reliability measurements were not recorded. This single reported success does not close ticket 04.

- [x] 06 Add selectable dual-tone pairs with a fixed dictionary, distinct preamble/profile byte, shared frame/CRC, cross-mode rejection and regression tests. Four-tone FSK remains the default. Evidence: 18 passing Node tests and Chrome offline AudioWorklet loopback for both modes. Local implementation only; no publication authorized for this experiment.
- [ ] 07 Compare dual-tone and FSK on physical device pairs using identical messages and recorded conditions. Include wrong-mode and muted-path checks; do not infer success from synthetic loopback.
- [x] 08 Implement musical FSK dictionaries: 4/8/16/32 notes, major/natural minor with tonic selection, deterministic shuffle, and explicitly microtonal 64-tone extension. Shared frame/CRC with exact profile descriptors and variable-width bit packing; timing derives from minimum pitch separation. Physical beauty and reliability remain unqualified.
- [ ] 09 Evaluate musical dictionaries on real devices and with listeners. Start at 4/8; compare key, scale and shuffle; treat 32/64 as experimental. Record results against the FSK baseline.

Musical implementation evidence: 29 Node tests and 22 Chrome synthetic AudioWorklet profiles pass. Musical configuration/individual-tone checks cover all 240 combinations. No physical microphone or listening test performed by the agent. Build `music1`; publication pending.
