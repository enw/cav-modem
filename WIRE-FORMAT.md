# Audio wire profiles

Select the same mode on both devices. Four-tone FSK remains the default baseline; dual-tone pairs are an experimental alternative. The user reported one short over-air FSK success after increasing volume. Repeated physical acceptance is still open, and dual-tone physical performance is unvalidated.

## Four-tone FSK baseline

The original profile remains wire-compatible:

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

For a retest of the current experiment, check `music1` and the selected profile in details, start Listen before Send, and observe: no input audio suggests the selected input or audio route; input without modem-frequency tones suggests noise or tone filtering; tones without synchronization suggest timing/noise or a missed preamble; a synchronized rejected frame indicates a decode/integrity failure. These are diagnostic clues, not established physical causes. Microphone mute/disconnect and suspended audio get explicit status messages.

Validation: 11 Node tests pass, including quiet signals at gains 0.005 and 0.001 (previously no sync), maximum frames with 44.1/48 kHz resampling, arbitrary onset/phase, ±500/1000 ppm clock drift and short echoes, noise rejection, and UI input-meter/frame status/Stop cleanup. Chrome offline audio through the real AudioWorklet passed at gain 0.005. This does not establish physical reliability for the new receiver.


## Dual-tone pairs experiment

Build `dual1` adds an explicit mode selector for Send and Listen. There is no automatic detection or negotiation; selecting the wrong mode cannot establish a valid reception in the wrong-mode test fixtures. The selector is locked while audio is active. Received-message status records the selected profile.

Each symbol contains two simultaneous sine tones, one from the low group (900, 1300 Hz) and one from the high group (1900, 2300 Hz):

| Bits | Symbol | Low frequency | High frequency |
| --- | --- | --- | --- |
| 00 | 0 | 900 Hz | 1900 Hz |
| 01 | 1 | 900 Hz | 2300 Hz |
| 10 | 2 | 1300 Hz | 1900 Hz |
| 11 | 3 | 1300 Hz | 2300 Hz |

This is a telephone-touch-tone-like group selection scheme, not a standard DTMF frequency set and not OFDM. The 400 Hz separation within each group and 600 Hz gap between groups are proposed to make a short-window detector straightforward; they are not a physical reliability claim. Lower-group second harmonics are not dictionary entries, but real distortion and room reflections still need testing.

The symbol remains 40 ms with 2 ms ramps and two bits per symbol. Each sine has peak amplitude 0.225 before ramps; their sum cannot exceed 0.45. This preserves the baseline's peak bound, but splits energy between the two tones and gives about 3 dB less total mean-square power than a single baseline sine. It is not an equal-energy physical comparison. There is **no speed increase**: 50 raw bits/s, 0.96-second preamble, and 2.24–12.32-second frames for 1–64 payload bytes in either mode.

The dual-tone preamble is the fixed symbol sequence `303030302103123011320213`. Bytes remain most-significant two bits first, four symbols per byte. The first header byte is `02` (profile/version discriminator), followed by the same big-endian two-byte UTF-8 payload length and unchanged payload/CRC-32 procedure. This byte is covered by CRC. A receiver only accepts its selected profile byte; the baseline requires `01`. Modulation plus a distinct preamble plus header discrimination prevent the tested cross-mode cases from reporting success. CRC is not authentication and does not provide an absolute guarantee against arbitrary deliberately constructed signals.

Frozen dual-tone vectors, excluding preamble:

- `A`: `02000141938d57d0`.
- `Café 🙂`: `02000a436166c3a920f09f998274adfb34`.
- Byte `1b` maps to symbol values `0,1,2,3`, using the table above.

The detector retains the baseline scan cadence and central 20 ms window, but measures all four group frequencies. Require a winner in each group with power greater than three times its group runner-up; each winner must have at least 0.08 times window energy times sample count; their combined power must have at least 0.30 times that quantity. The stronger winner may have at most nine times the weaker winner's power (approximately 9.54 dB imbalance). A missing tone, two tones in one group, or a strongly unbalanced pair is rejected. The digital-silence floor remains `1e-10`. The UI reports a dictionary pair only when these criteria pass; that alone is not frame synchronization or successful receipt.

All length bounds, exact UTF-8 checks, rejection/resynchronization, Stop behavior and 12.32-second maximum sample budget remain shared. No automatic clock tracking is added. Deterministic tests cover both profiles, cross-mode rejection, quiet gain, noise, timing offsets, different sample rates, modest clock drift and short echo; these fixtures are not an acoustic-channel guarantee. Follow the [roadmap](ROADMAP.md) for physical comparison and the next musical dictionary exploration.

Current experiment verification: all 18 Node tests pass, including the retained FSK suite, dual-tone frame/CRC vectors, invalid pairs, wrong-mode rejection, corrupt/truncated frames and resynchronization, channel simulations and mode-locking UI behavior. Chrome offline AudioWorklet loopback passes for both modes at gain 0.005. No physical dual-tone microphone test has been performed.

## Musical FSK experiment

Build `music1` preserves the classic and dual-tone profiles and adds single-tone musical FSK with 4, 8, 16, 32 or an explicitly microtonal 64-tone dictionary. Select the same mode, count, root, scale and ordering on both devices. Default musical settings are 8 tones, C4, major, ascending. Classic FSK remains the page's initial mode. All profile controls are locked during Send/Listen.

### Pitches and dictionary ordering

Root choices are the twelve pitch classes C through B in octave 4: MIDI note `60 + tonic`, with tonic codes C=0, C♯=1, D=2, E♭=3, E=4, F=5, F♯=6, G=7, A♭=8, A=9, B♭=10, B=11. Octave is fixed, not negotiated. Equal-tempered frequency is `440 × 2^((midi − 69)/12)` Hz. No frequency rounding is applied on the wire; rounded UI values are display-only.

Major scale semitone steps are `[0,2,4,5,7,9,11]`; natural minor steps are `[0,2,3,5,7,8,10]`. For degree `i`, use `12 × floor(i/7) + steps[i mod 7]` above the root. Counts 4/8/16/32 take the first N consecutive scale degrees, one distinct frequency per symbol. For example, C4 major with 8 tones is C4 D4 E4 F4 G4 A4 B4 C5. The dictionary constrains available pitches; arbitrary payloads do not become composed melodies, and pleasantness is not established by a scale name.

The 64 option uses degrees `i/2` for i=0…63: even indices are scale notes; odd indices are midway in semitone/log-frequency space between consecutive scale notes. Thus a one-semitone scale interval acquires a quarter-tone midpoint. These are **not 64 consecutive major/minor scale notes**; the microtonal option is separately labeled in the UI. It keeps 64 unique tones without octave aliasing. At C4 its range is 261.63–5919.91 Hz; at B4 it is 493.88–11175.30 Hz. High pitches and very close low pitches need physical qualification.

Ascending ordering maps symbol value i to dictionary entry i. Shuffled ordering applies this exact Fisher–Yates permutation to the ascending list:

1. Set unsigned 32-bit state to `0x43415631` each time a profile is derived.
2. For i=N−1 down to 1, set `state = (1664525 × state + 1013904223) mod 2^32` using unsigned integer arithmetic.
3. Set `j = floor((state / 2^32) × (i+1))`; swap entries i and j.

No per-device or per-message randomness is used. The seed and algorithm are fixed by profile version 03. The 8-tone permutation is `[1,4,6,5,7,3,2,0]`. Changing key/scale transposes or changes frequencies, but does not independently reshuffle the indices. A different seed or pitch-generation rule would require a new profile version.

### Timing and sample-rate guard

Compute the minimum adjacent gap Δf from the sorted ascending frequencies, before shuffling. Symbol duration in seconds is `ceil(100 × max(0.04, 4/Δf)) / 100`, rounded up to a 10 ms grid. The central half-symbol analysis window then spans at least two periods of the smallest frequency gap. This is a design safeguard, not a guarantee of acoustic separation. The window is much longer than the classic 20 ms window. Each symbol retains 2 ms edge ramps and 0.45 peak sine amplitude.

Each device uses `n = round(sampleRate × seconds)` samples per symbol; the receiver scans every `round(n/4)` samples and analyzes the central `round(n/2)` samples. The app displays computed baud (`sampleRate/n`), raw bit rate (`bitsPerSymbol × baud`), range, minimum spacing and full message duration. Before an audio context exists, it displays nominal profile timing. It never assumes musical modes work at 25 baud.

C4 examples; ordering does not change these rates:

| Count | Bits/symbol | Range Hz | Major symbol ms / raw bits/s | Minor symbol ms / raw bits/s | Maximum frame seconds major / minor |
| --- | --- | --- | --- | --- | --- |
| 4 | 2 | 261.63–349.23 | 210 / 9.52 | 230 / 8.70 | 68.04 / 74.52 |
| 8 | 3 | 261.63–523.25 | 210 / 14.29 | 230 / 13.04 | 47.04 / 51.52 |
| 16 | 4 | 261.63–1174.66 | 210 / 19.05 | 230 / 17.39 | 36.54 / 40.02 |
| 32 | 5 | 261.63–5587.65 | 210 / 23.81 | 230 / 21.74 | 30.24 / 33.12 |
| 64 microtonal | 6 | 261.63–5919.91 | 420 / 14.29 | 470 / 12.77 | 52.08 / 58.28 |

C4 major's minimum gap is about 19.60 Hz (9.66 Hz for the 64 subdivision); C4 minor's is about 17.46 Hz (8.61 Hz for 64). Higher roots change spacing and timing. The 64 mode is slower than 32 under this safeguard. Sixty-four symbol choices at 25 baud would mathematically give 150 raw bits/s, but that rate is **not implemented or validated** here.

Both synthesis and receiver creation reject a profile whose highest frequency is at or above 0.45 × the actual audio-context sample rate. This leaves margin below Nyquist; it does not establish the speaker/microphone passband. A high-root 32/64 profile can be unsupported at a low sample rate even while classic FSK works. The UI reports the error rather than aliasing frequencies. Bluetooth routes, device processing, high-frequency rolloff, harmonics, echoes and clock drift can still prevent reception. Use foreground tabs and compare physical results before increasing count.

### Musical frame and packing

Musical preamble symbol values for alphabet size N are:

```text
0,N−1,0,N−1,1,N−2,1,N−2,0,2,1,3,2,0,3,1,1,0,2,3,0,3,1,2
```

It is followed by a seven-byte header:

| Offset | Meaning |
| --- | --- |
| 0 | Version/profile `03` |
| 1 | Bits per symbol: `02`, `03`, `04`, `05`, or `06` (4 through 64 tones) |
| 2 | Tonic code 0…11, fixed octave 4 |
| 3 | Scale: 0 major, 1 natural minor |
| 4 | Order: 0 ascending, 1 fixed-seed shuffle |
| 5–6 | Big-endian payload byte length, 1…64 |

Untouched UTF-8 payload follows, then the same four-byte big-endian CRC-32/ISO-HDLC of the entire header and payload. A receiver compares every descriptor byte with its selected configuration before accepting the length; unknown/mismatched settings are rejected. Descriptor bytes are CRC-covered, but this is not authentication or negotiation. The 64 algorithm is identified by version 03 plus bits-per-symbol 06.

Concatenate all frame bytes into a single MSB-first bitstream; do not pad individual bytes. Consume k bits per symbol, where k=log2(N). Only the final symbol is padded, with zero bits on its least-significant side. Frame symbol count is `ceil(8 × (payloadBytes + 11) / k)`. The receiver decodes exactly the header-declared bytes and rejects nonzero tail padding as well as excess/truncated byte frames and invalid UTF-8/CRC. Header inspection may end mid-symbol, so those remaining bits are retained as part of the payload stream rather than treated as header padding. Full frame duration is `(24 + frameSymbolCount) × n/sampleRate`.

Frozen frame-byte vectors, excluding preamble and tail padding:

- Text `A`, 8-tone C4 major ascending: `0303000000000141c2858250`.
- Text `A`, 64-tone C4 natural minor shuffled: `03060001010001411561e322`.
- Packing byte `ff`: 3-bit symbols `[7,7,6]`; 5-bit `[31,28]`; 6-bit `[63,48]`. The final low bits are padding.

Musical detection uses the baseline gain-relative winning-tone/purity rules across the whole selected dictionary with the longer analysis window. Receive buffering grows geometrically only up to the bounded declared frame, avoiding a full frame copy on every incoming batch; the validated length is cached during capture. Stop discards all state. Failed frames resume synchronization search. Longer musical frames have longer bounded sample deadlines than the original 12.32-second profiles.

Musical verification: 29 Node tests pass. Configuration/descriptor generation and individual-tone classification cover all 240 count/key/scale/order combinations. Maximum UTF-8 acoustic round trips and channel simulations cover all 20 count/scale/order combinations at C4; tests include 3/5/6-bit padding, wrong profiles, corruption, truncation, noise, gain, resampling and ±250 ppm drift. Chrome offline AudioWorklet checks pass 22 profiles (classic, dual, and those 20 musical combinations) at gain 0.005. These are deterministic software fixtures, not physical microphone or listening tests.
