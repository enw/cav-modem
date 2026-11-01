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

- [x] 10 Investigate user-reported classic FSK failure after `music1` deployment. User subsequently identified human configuration/testing error; no decoder fix required. Earlier investigation: root cause not reproduced; verify both endpoints use Classic FSK (not musical four-note FSK), inspect input/tones/sync status, and record devices and capture settings. No speculative runtime change made.

Regression evidence (31 October 2026): compared `8bea97e` (`rx2`) with `32f4bc7` (`music1`): 80 randomized channel cases at 44.1/48 kHz decoded on both; encoded bytes, symbols and synthesized samples were identical. Published HTML/modules/worklet matched `music1` when fetched. Added a frozen rx2 `hello world` fixture with 80 randomized gain/noise/onset/chunk-size cases; all 31 Node tests pass. Chrome silent real-time AudioWorklet check passes at 44.1 kHz with quiet gain, noise and 137 ms onset. These checks do not reproduce a microphone/speaker path or exclude stale user tabs, profile mismatch, or acoustic conditions. Physical failure remains unresolved.

- [x] 11 Optional temporary live decode trace: bounded symbols and provisional bytes, safe ASCII preview, pending bits, sync and retained validation result; disabled when collapsed, cleared on Stop/new session, UI limited to 4 Hz. Covers classic, dual and musical packing/padding. Local build `trace1`; deployment not yet authorized.

Trace validation: 35 Node tests pass, including partial bytes/pending bits, 3/5/6-bit padding rejection, checksum/truncation rejection, new-frame reset, Stop and safe preview rendering. Chrome synthetic AudioWorklet validation passes all 22 profiles with exact traced frame bytes. No microphone activation or physical trace test.

- [x] 12 Implement fixed drum-sample profile 04/dictionary 01, 4 baud, normalized spectral/decay detection, bounded trace identities, wire vectors and simulated channel checks. Existing modes retained.
- [ ] 13 Qualify drum mode over real speaker/microphone paths, beginning with short messages and matching profiles; compare kick/hat reproduction and record success/failure both directions. No microphone or audible playback used during implementation. Local experiment only; not published.

User clarification: existing modes reportedly worked acoustically, with the older Mac receiving particularly well. The earlier four-tone issue was a human configuration/testing error, not an established decoder regression.

Drum validation: 40 Node tests pass; Chrome silent OfflineAudioContext → AudioWorklet → receiver/trace passes 23 profiles including drums and all prior modes. UI mode/rate/duration verified locally. Tests cover exact UTF-8/CRC vectors, 64-byte frames, invalid dictionary/length/checksum, truncation/recovery, reset/Stop, gain .005/.5, mild filtering, 18 ms echo, resampling at 44.1/48 kHz with 150 ppm stretch, silence/noise/steady-tone/ambiguous-hit rejection. These checks do not establish physical reliability.

- [x] 14 Add a rotating curated radio-message button beside Your message. Six short ASCII examples, immediate byte/duration refresh, no automatic transmission, disabled while active; typing retained.

- [x] 15 Add 250/200 ms drum-speed selection with separate fast profile/preamble, exact default waveform compatibility, live rates/durations and busy-state locks. Both endpoints must match. Test both speeds through simulated gain/noise/filtering/echo/resampling/drift, corruption/truncation/recovery, wrong-speed rejection and browser AudioWorklet paths. Physical comparison remains open.

Build `drum2`: 47 automated tests pass; Chrome silent AudioWorklet suite passes 24 profiles. Browser checks verify repeated radio-example clicks update text/count/duration immediately, and changing drum speed updates 8→10 raw bits/s. Direct comparison against deployed `drum1` produced identical default PCM for four drums at both 44.1/48 kHz. No microphone or audible playback; no deployment.

- [x] 16 Persist all six dropdown settings in versioned localStorage (`cav-modem.settings.v1`). Validate each saved string against current options; restore before dependent UI; retain hidden-mode choices; swallow read/parse/write failures. No message/audio/activity storage or automatic audio start.

Persistence validation: 49 automated tests, including all supported option values, invalid/stale types and values, malformed JSON, security/quota failures, stored-field whitelist and module reinitialization. Chrome reload checks preserve musical 32/A4/minor/shuffled and drums/200 ms with correct rates/durations and inactive microphone. Local commit only. Previous drum2 publication verified at commit 369b53f; Pages workflow 41319287778 succeeded.

- [x] 17 Add plain CW/Morse transmit/receive, 700 Hz and 8/12/16 WPM, standard timing, explicit supported characters/normalization, unverified text, bounded mark diagnostics, Stop/reset and persisted speed. No changes to existing wire profiles.
- [ ] 18 Qualify physical CW reception in both directions; distinguish character mistakes and incomplete text from CRC-protected frame results.

CW validation: 55 automated tests pass, covering all 44 mapped characters, whitespace/case and unsupported text, exact timing/duration, 44.1/48 kHz at all speeds, quiet gain/noise/phase inversion/resampling stretch, ambiguous marks/gaps, unknown codes, silence, repeated transmissions, reset and UI lifecycle. No microphone or audible playback used. User separately reports iPhone-to-computer classic four-tone FSK success; this is informal physical evidence, not a full reliability benchmark.

CW browser verification: separate Chrome tab passes all 24 framed profiles plus plain CW at all three speeds through silent OfflineAudioContext/AudioWorklet capture. CW mode shows the supported alphabet, normalized radio example and 12.20-second duration for CQ CQ DE TEST at 12 WPM. Existing live drum receiver was not reloaded or reconfigured.
