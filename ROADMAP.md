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

## Active experiment — fixed drum samples

Implemented locally as `drum1`: kick, snare, hi-hat and tom, two bits per 250 ms slot. Deterministic procedural hits and a normalized spectral/decay classifier preserve existing FSK modes and CRC framing. The 160 ms hit/90 ms guard makes this a rhythm/timbre experiment at 8 raw bits/s; arbitrary recordings, sample uploads and overlapping sounds are deferred.

Next gate: test short messages on two devices, especially kick reproduction and transient/noise suppression, then repeat in both directions with recorded volume/distance/browser/settings and trace results. No physical drum success is claimed. User reports the existing modes worked acoustically, particularly with the older Mac receiving; this is encouraging informal evidence, not a recorded reliability benchmark. Instrument dictionaries may follow measured drum results.

### Drum speed comparison

Local `drum2` adds experimental 200 ms slots (160 ms hits, 40 ms guards) beside the compatible 250 ms default (90 ms guards). Compare both endpoints at matching settings, short messages first, recording exact CRC-passing reception and room/device conditions. The extra speed is 10 versus 8 raw bits/s; shorter guards may reduce echo tolerance. Neither speed is physically qualified. Compact alphabets remain out of scope.

## Active experiment — plain CW

`cw1` adds genuine keyed 700 Hz International Morse at 8/12/16 WPM, with explicit normalization, a small supported character set, silence finalization and unverified text diagnostics. All framed FSK/drum modes remain separate and unchanged. Next gate: two-device short-message trials with matching WPM, noting spacing errors and missed marks; no physical CW success claimed. Arbitrary hand-keyed speed detection and Farnsworth timing are deferred.

### Midrange palette comparison

Local `percussion1` adds dictionary 02 at 1100/1550/2100/2800 Hz, with woodblock/rim-click/high-tom/short-snare-like hits, 250/200 ms slots and narrower classifier filters. Original dictionary 01 is retained byte-for-byte for comparison. Hypothesis: moving discriminating energy into this range may help the phone path that already passed four-tone FSK, but the observed original-drum pre-sync failure has not been attributed to any particular sample or hardware limitation. Next: compare CRC-passing short messages and pre-sync debug measurements across palettes under matched volume/distance/speed; do not optimize further without those measurements.
