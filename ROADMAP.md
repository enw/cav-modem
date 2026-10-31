# CAV modem roadmap

Keep four-tone FSK as a repeatable baseline. Compare experiments using exact messages received, checksum failures, duration, hardware/browser conditions, and listening comfort. A simulated pass is not physical acceptance.

## Current experiment — dual-tone pairs

Implemented locally as a selectable experiment, pending physical comparison and publication. Each symbol combines one of two low frequencies with one of two high frequencies. Four pairs carry two bits per 40 ms symbol: 50 raw bits/s, the same speed as baseline FSK. The frame format and CRC procedure are shared, with a distinct profile byte and preamble. See [wire profiles](WIRE-FORMAT.md).

Next gate: repeat the same messages on the same two devices in both modes, with recorded distance, volume and input levels. Aim for at least 9 exact CRC-passing messages out of 10 in each direction, zero incorrect successes, and no valid reception in the wrong mode. Include UTF-8, maximum length, Stop/restart, and a muted acoustic path. Compare listening comfort without assuming louder means better. Do not retire the baseline based on one successful transfer.

## Immediately next — a musically beautiful tone dictionary

Design and listening exploration only for now. Explore pitch choices, scales, consonant intervals and chords that make the modem pleasant to hear while retaining an unambiguous fixed symbol dictionary. Start with a few candidate pitch sets, keeping timing, payloads, and test conditions comparable to dual-tone pairs.

Evaluate pitch spacing against decoder resolution, harmonic overlap and speaker/microphone distortion. A pleasing interval may produce harmonics that imitate another symbol; closely spaced notes may require longer symbols. Compare equal-tempered and simpler frequency choices, chord balance, register, transition ramps, and listener comfort. Do not claim beauty or robustness from theory alone: record listening feedback and measured exact-message success, failure rates, duration and input levels across devices. Freeze a new profile only after that evidence.

A music-friendly alphabet makes the transmitted tones themselves pleasant. It does not hide the data, provide encryption, or constitute audio watermarking. Mixing data with existing music or speech is a separate deferred experiment.

## Later modulation experiments

| Candidate | Question to investigate |
| --- | --- |
| 8-tone / 16-tone FSK | Can more separated frequencies carry 3 or 4 bits per symbol reliably within the useful acoustic band? Measure bandwidth, timing and failure rate before claiming net speed gains. |
| PSK / differential PSK | Can phase changes survive independent device clocks and room reflections? Differential detection may simplify phase-reference requirements but needs its own evidence. |
| QAM | Can amplitude and phase be recovered despite gain control, distortion and echoes? Defer until phase and channel estimation are understood. |
| OFDM | Does many-subcarrier transmission justify synchronization, equalization, peak-power and implementation complexity? Two-tone pairs are not OFDM. |
| Data mixed with music or speech | Measure interference, audibility and error rates as an explicit coexistence experiment. Concealment/watermarking is a different goal, not an assumed capability. |

## Later transport and integration phases

- Optical transmission: screen or light to camera/sensor; reuse byte framing where suitable, with separately qualified optical timing and modulation.
- Reticulum adapter or local helper: only after a useful physical modem is demonstrated. Revisit packet size and overhead; a 64-byte text demo does not establish Reticulum compatibility. Keep identity and multi-device delivery separate.

No current work adds IP/QUIC, automatic retries, FEC, hidden network message transport, or a general modulation settings panel.
