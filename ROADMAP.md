# CAV modem roadmap

Keep four-tone FSK as a repeatable baseline. Compare experiments using exact messages received, checksum failures, duration, hardware/browser conditions, and listening comfort. A simulated pass is not physical acceptance.

## Current experiment — dual-tone pairs

Implemented locally as a selectable experiment, pending physical comparison and publication. Each symbol combines one of two low frequencies with one of two high frequencies. Four pairs carry two bits per 40 ms symbol: 50 raw bits/s, the same speed as baseline FSK. The frame format and CRC procedure are shared, with a distinct profile byte and preamble. See [wire profiles](WIRE-FORMAT.md).

Next gate: repeat the same messages on the same two devices in both modes, with recorded distance, volume and input levels. Aim for at least 9 exact CRC-passing messages out of 10 in each direction, zero incorrect successes, and no valid reception in the wrong mode. Include UTF-8, maximum length, Stop/restart, and a muted acoustic path. Compare listening comfort without assuming louder means better. Do not retire the baseline based on one successful transfer.

## Active experiment — musical FSK dictionaries

Implemented locally: 4/8/16/32 single-tone dictionaries from a selected octave-4 tonic and major/natural-minor scale, plus a reproducibly shuffled symbol mapping. Symbol duration is derived from the closest pitch spacing; the page shows actual rate and frame duration. Classic FSK and dual-tone remain available for comparison.

The explicitly experimental 64-tone option subdivides each scale interval at its logarithmic midpoint. It is microtonal, not 64 consecutive scale notes. This keeps a finite usable digital range while requiring longer symbols: C4 major is about 2.38 baud/14.29 raw bits/s, not 25 baud/150 bits/s. The B4 upper end reaches about 11.18 kHz, which may be poorly reproduced even when the sample-rate guard permits it. Recommend starting physical experiments at 4/8 tones; treat 32 and especially 64 as bandwidth, drift and listening-comfort investigations.

Next gate: listening evaluation and empirical speaker-to-microphone comparisons of the dictionaries. Record exact-message success, CRC failures, duration, root/scale/count/order, actual input level, device/browser, distance, volume and perceived comfort. Compare ascending versus shuffled mappings with identical payloads. A dictionary of scale notes does not guarantee a beautiful melody: random data selects pitches rather than following musical phrasing.

Further design work may explore consonant intervals/chords, narrower registers, different scales, transitions and symbol timing. Evaluate decoder separation, octave/harmonic confusion and distortion before adding profiles. No claims of beauty or physical reliability follow from synthetic tests alone.

A music-friendly alphabet makes transmitted tones themselves pleasant. It does not hide data, provide encryption, or constitute audio watermarking. Mixing data with existing music or speech remains a separate deferred experiment.

## Later modulation experiments

| Candidate | Question to investigate |
| --- | --- |
| Faster nonmusical 8/16-tone FSK | Musical multi-tone dictionaries now exist; a separate evenly spaced alphabet could explore higher symbol rates. Measure bandwidth, timing and failure rate before claiming net speed gains. |
| PSK / differential PSK | Can phase changes survive independent device clocks and room reflections? Differential detection may simplify phase-reference requirements but needs its own evidence. |
| QAM | Can amplitude and phase be recovered despite gain control, distortion and echoes? Defer until phase and channel estimation are understood. |
| OFDM | Does many-subcarrier transmission justify synchronization, equalization, peak-power and implementation complexity? Two-tone pairs are not OFDM. |
| Data mixed with music or speech | Measure interference, audibility and error rates as an explicit coexistence experiment. Concealment/watermarking is a different goal, not an assumed capability. |

## Later transport and integration phases

- Optical transmission: screen or light to camera/sensor; reuse byte framing where suitable, with separately qualified optical timing and modulation.
- Reticulum adapter or local helper: only after a useful physical modem is demonstrated. Revisit packet size and overhead; a 64-byte text demo does not establish Reticulum compatibility. Keep identity and multi-device delivery separate.

No current work adds IP/QUIC, automatic retries, FEC, hidden network message transport, or a general modulation settings panel.
