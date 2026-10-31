# Audio wire profile 1

This freezes the first implemented profile. Acoustic performance remains unvalidated on physical device pairs.

- Symbol values 0, 1, 2, 3 map to 1200, 1600, 2000, 2400 Hz respectively. One sine tone at a time.
- Each symbol occupies `round(sampleRate × 0.04)` samples, including a 2 ms linear amplitude ramp at each edge. Peak amplitude is 0.45. No guard interval is inserted.
- Each byte becomes four symbols, most significant two bits first.
- The fixed 24-symbol preamble is `030303031230210322013120` (0.96 seconds at standard sample rates).
- The header is version `01`, followed by an unsigned 16-bit big-endian payload byte count. Only lengths 1–64 are accepted.
- Payload is untouched UTF-8, followed by a four-byte big-endian CRC-32/ISO-HDLC of header plus payload. CRC parameters: normal polynomial `04C11DB7` (reflected implementation `EDB88320`), initial `FFFFFFFF`, reflected input/output, final XOR `FFFFFFFF`. The ASCII check string `123456789` yields `CBF43926`.
- No acknowledgement, addressing, retries, encryption, FEC, or network message channel.

At 64 payload bytes, total duration is 12.32 seconds. At one byte it is 2.24 seconds.

## Frozen vectors

For text `A`, payload hex is `41`, complete frame bytes excluding preamble are `010001418138f83e`, and full symbols including preamble are:

```text
03030303123021032201312000010000000110012001032033200332
```

For text `Café 🙂`, payload hex is `436166c3a920f09f9982`, complete frame bytes are `01000a436166c3a920f09f9982c96797fa`, and full symbols are:

```text
03030303123021032201312000010000002210031201121230032221020033002133212120023021121321133322
```

Automated boundary tests use 64 ASCII `a` bytes and 16 four-byte `🙂` characters; 65 ASCII bytes and 17 of those emoji are rejected.

## Receiver rules

Scan candidate starts every 10 ms. Classify each symbol from its central 20 ms using four Goertzel energy estimates. Reject only digital silence below mean-square energy `1e-10`; require winning tone power greater than three times runner-up power, and winning power greater than 0.20 times window energy times window sample count. All preamble symbols must match.

After synchronization, read the three-byte header and reject unsupported versions or lengths before buffering further. Wait only for the declared bounded frame duration in captured samples; the longest frame is 12.32 seconds from its start. Silence is processed as samples, so a truncated frame eventually fails signal classification. A suspended audio context stops the UI session explicitly. No wall-clock receipt guarantee is made for a stalled or backgrounded browser.

Validate every payload/checksum symbol, exact length, checksum, and strict UTF-8 before publishing text. On failure, scan again starting one 10 ms step after the failed preamble candidate. On success, consume the frame and resume scanning. Search retains less than a preamble plus the incoming batch; locked state retains at most one maximum frame plus a batch. Input batches larger than one second are rejected. Stop discards all receive state.

Receiver build `rx2` lowers the old absolute energy cutoff (`1e-5`, about −50 dBFS RMS), which rejected clean quiet microphone signals. Tone-purity ratios and all preamble/frame/CRC validation remain unchanged. This is a receiver-only change; transmitted bytes and tones are compatible with the original profile.

The first receiver does not track oscillator drift during a frame. Detection thresholds, frequency choice, and timing tolerance need physical qualification before any broader compatibility claims.

## Receive diagnostics

Build `rx2` shows a live RMS input meter (dBFS) every quarter second while listening, plus a label when the latest sample window contains a tone near one of the four modem frequencies. Ordinary sound can move the meter; a frequency match alone is not synchronization or receipt. The main status changes on full preamble synchronization, frame rejection, and valid CRC/UTF-8 receipt. Details include selected microphone, actual capture settings, sample rate, build, and counts of synchronized, rejected, and received frames. Stop clears the meter.

For a retest, check `rx2` in details, start Listen before Send, and observe: no input audio suggests the selected input or audio route; input without modem-frequency tones suggests noise or tone filtering; tones without synchronization suggest timing/noise or a missed preamble; a synchronized rejected frame indicates a decode/integrity failure. These are diagnostic clues, not established physical causes. Microphone mute/disconnect and suspended audio get explicit status messages.

Validation: 11 Node tests pass, including quiet signals at gains 0.005 and 0.001 (previously no sync), maximum frames with 44.1/48 kHz resampling, arbitrary onset/phase, ±500/1000 ppm clock drift and short echoes, noise rejection, and UI input-meter/frame status/Stop cleanup. Chrome offline audio through the real AudioWorklet passed at gain 0.005. This does not establish physical reliability for the new receiver.
