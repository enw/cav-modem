# Browser audio modem proposal

Status: proposed design, 31 October 2026. Documentation only; implementation and physical validation are future work.

Build a small TypeScript web app that transfers short text between two devices through their speakers and microphones. The first milestone is straightforward: type on device A, play audible tones, decode on device B, and show the exact text with checksum status. Swap roles to reply. This establishes whether the acoustic link is useful before adding other transports or integrating a messaging system.

## First user experience

1. Open the app on two awake devices with their browser tabs in the foreground. Start with a desktop or laptop pair; qualify phones separately.
2. On B, choose **Listen** and grant microphone permission. Show whether capture actually started.
3. On A, enter 1–64 UTF-8 bytes of nonsecret text. Show the byte count and estimated transmission duration, then choose **Send**.
4. A plays the frame. B finds its start, decodes it, validates it, and displays the received text and checksum result.
5. Stop listening on B and swap roles for a reply. Each device operates in one role at a time.

Keep the main UI to a message box, **Send**, **Listen**, **Stop**, byte count, duration, current status, and received text. Expandable details can show signal levels, detected tones, frame fields, and failure reasons. A failed frame must never appear as a successfully received message.

Use explicit statuses such as idle, listening, receiving, transmitting, playback complete, valid message received, checksum failure, and stopped. **Playback complete means only that local audio finished; it does not mean the other device received anything.** Stop must cancel queued playback, release microphone capture, and discard an incomplete frame. Permission denial, missing or disconnected devices, and audio startup failures must be visible and recoverable.

## Proposed acoustic profile

Transmit one sine tone at a time, changing frequency for each symbol. Four frequencies encode two bits per symbol. Both devices use the same fixed profile; there is no negotiation in the first version.

| Setting | Initial proposal |
| --- | --- |
| Frequencies | 1200, 1600, 2000, 2400 Hz |
| Symbol duration | 40 ms |
| Bits per symbol | 2 |
| Raw rate | 25 symbols/s × 2 = 50 bits/s |
| Text payload | 1–64 UTF-8 bytes |
| Maximum transmission target | About 13 seconds including framing |
| Tone transitions | Short ramps to reduce clicks, within the symbol timing budget |

These are tunable, unvalidated starting values. They are not a claim of range, throughput, browser compatibility, or reliability. A 64-byte payload plus the proposed 3-byte header and 4-byte checksum takes 11.36 seconds at 50 bits/s, leaving about 1.64 seconds for the preamble and any guards if the total is to stay near 13 seconds. Final duration depends on the frozen framing profile.

Schedule synthesis against the audio engine's clock, rather than UI timers. Keep receive processing independent of UI rendering; derive symbol timing from captured samples and the preamble. A receiver would compare energy at the four candidate frequencies, acquire symbol boundaries, and reject uncertain or incomplete frames. Detection thresholds, clock tolerance, ramp length, and synchronization rules still need design and validation. Web Audio provides the synthesis and processing primitives; it does not establish modem performance. [W3C Web Audio API](https://www.w3.org/TR/webaudio/)

## Frame and integrity

The proposed wire order is:

**Fixed sync preamble → version byte → two-byte payload length → payload bytes → CRC-32**

The length counts UTF-8 bytes, not characters. Preserve the payload bytes exactly: no trimming, Unicode normalization, newline conversion, or silent truncation. Reject empty or oversized text before transmission and reject malformed UTF-8 on receipt rather than silently replacing invalid sequences. Accents and emoji may occupy multiple bytes.

CRC-32 covers the version, length, and payload in their transmitted order; it excludes the preamble and checksum field itself. Validate the complete frame before publishing received text. CRC detects accidental corruption; it provides neither encryption nor authentication, and a passing CRC is not proof of sender identity.

Before implementation acceptance, freeze a single interoperable specification with:

- The mapping of each two-bit value to a frequency, bit order within bytes, and byte order for length and checksum.
- The exact preamble sequence and length, any guard intervals, and synchronization acquisition and recovery rules.
- The supported version value and the exact CRC-32 variant: polynomial, initial value, reflection rules, final XOR, and transmitted byte order.
- Frame deadlines, bounded buffering, and rejection behavior for invalid lengths, unsupported versions, uncertain symbols, and truncated frames.
- Shared test vectors containing source text, exact UTF-8 bytes, header, checksum, and complete symbol sequence, including a multibyte example and the 64-byte boundary.

The two-byte length field does not authorize larger payloads in the first profile. Reject values outside 1–64 before allocating or waiting for a claimed payload. After corruption, timeout, or noise, discard the partial frame and resume searching for a valid preamble. A subsequent valid frame must be decodable without reloading the page.

There is no handshake, delivery acknowledgement, automatic retry, forward error correction, or addressing in the first version. People coordinate turns and manually resend when needed.

## Browser operation and privacy

Microphone access requires explicit permission and a secure context. Use HTTPS for access from another device. Browsers generally treat localhost as trustworthy for development, but a phone opening an ordinary HTTP LAN address is not equivalent to localhost on that phone. Explain this setup requirement when capture is unavailable. [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

Start or resume audio from a user gesture such as Send or Listen, and handle suspended audio contexts explicitly. Keep both devices awake and foregrounded for the first acceptance runs. Mobile lifecycle and audio behavior require separate qualification. [MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)

Request echo cancellation, noise suppression, and automatic gain control off where supported. Inspect and expose actual capture settings rather than assuming the browser honored the requests. Record capture and audio-context sample rates; do not assume every device runs at the same rate. [MDN MediaTrackConstraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints)

All message encoding and audio decoding happen locally. Do not upload message content or microphone audio, save recordings, or add a network message fallback. Serving the app is separate from carrying messages: the only message path in this demo is speaker → air → microphone. Use nonsecret test text because transmissions are audible and unencrypted. Keep received messages in the current session without persistent history in the first version.

## Acceptance before calling the modem usable

Simulation can verify codec logic, but it cannot replace physical speaker-to-microphone acceptance. Freeze the profile and record the test conditions before measuring results.

| Check | Required evidence |
| --- | --- |
| Physical round trip | Send 10 messages A → B and 10 B → A. Target at least 9 exact, checksum-passing receptions in each direction, with zero incorrect successes. Record every attempt, including failures. |
| Text fidelity | Include punctuation, accented text, emoji, and mixed UTF-8. Compare exact decoded text and bytes. |
| Payload bounds | Accept a valid 64-byte message; explicitly reject empty and oversized input without truncating it. Include multibyte text at the boundary. |
| Corruption | Deterministically corrupt header, payload, and checksum separately. Each invalid frame must be rejected without a success status. |
| Invalid framing | Reject truncated frames, unsupported versions, and excessive declared lengths with bounded memory and waiting time. |
| Synchronization recovery | Feed noise or a failed frame followed by a valid frame. Recover and receive the next valid message without restarting the app. |
| Acoustic path isolation | Mute the transmitting speaker while leaving both apps and any serving network available. The receiver must not obtain the new message. Restore audio and confirm reception. |
| Controls and device failures | Exercise denied permission, unavailable or disconnected microphone, suspended audio, and Stop during transmit and receive. Show explicit outcomes and allow recovery. |

For each physical run, record hardware, OS and browser versions, input and output devices, actual capture settings, sample rates, profile, distance and orientation, ambient noise, volume, expected and actual duration, expected and received text, checksum status, and outcome. Count an unsuccessful first attempt as a failure even if a manual resend succeeds. Report results for that setup only; phone support and longer distances require their own runs.

## Scope after the first milestone

Once the acoustic modem passes physical acceptance, consider optical screen or light transmission to a camera or sensor, reusing byte framing where suitable while designing separate modulation and timing. Selectable frequencies, simultaneous tones, and musical encodings are later experiments; they would change signal processing and require new acceptance runs.

A Reticulum adapter or local helper is a later integration decision, after the modem proves itself. Revisit packet size, framing overhead, throughput, and transport requirements then: the 64-byte text-demo limit is not a claim of Reticulum compatibility. Identity and multi-device message delivery remain separate integration concerns. The first milestone includes no Reticulum, LXMF, or Nomad Network integration and no IP or QUIC stack.

The next authorized phase would be to finalize the wire specification and then implement and validate the desktop demo. This proposal does not initiate that phase.
