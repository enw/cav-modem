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

Scan candidate starts every 10 ms. Classify each symbol from its central 20 ms using four Goertzel energy estimates. Require mean-square signal energy of at least 0.00001, winning tone power greater than three times runner-up power, and winning power greater than 0.20 times window energy times window sample count. All preamble symbols must match.

After synchronization, read the three-byte header and reject unsupported versions or lengths before buffering further. Wait only for the declared bounded frame duration in captured samples; the longest frame is 12.32 seconds from its start. Silence is processed as samples, so a truncated frame eventually fails signal classification. A suspended audio context stops the UI session explicitly. No wall-clock receipt guarantee is made for a stalled or backgrounded browser.

Validate every payload/checksum symbol, exact length, checksum, and strict UTF-8 before publishing text. On failure, scan again starting one 10 ms step after the failed preamble candidate. On success, consume the frame and resume scanning. Search retains less than a preamble plus the incoming batch; locked state retains at most one maximum frame plus a batch. Input batches larger than one second are rejected. Stop discards all receive state.

The first receiver does not track oscillator drift during a frame. Detection thresholds, frequency choice, and timing tolerance need physical qualification before any broader compatibility claims.
