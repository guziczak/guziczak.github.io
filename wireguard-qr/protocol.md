# WGQR binary optical transfer

The site preserves raw file bytes in QR byte segments. A small ordinary configuration QR contains the configuration itself and remains suitable for WireGuard's native QR importer. Framed animations and feedback are a custom protocol between instances of this site, not a WireGuard, UR, or general QR-scanner format.

`assets/qr-resilient.js` exposes `WGResilient`: a version-2 sender by default, an opt-in compact version-3 sender, a receiver for v3/v2/v1/plain QR, and offline feedback. The unchanged `assets/qr-transfer.js` exposes `WGTransfer` and is retained as the v1 receiver. Load it before `qr-resilient.js`.

Both helpers work in browser memory without network requests, workers, persistence, compression, or new dependencies. Web Crypto provides random session IDs and SHA-256, so framed transfer completion needs HTTPS or localhost. ZIP compression is a separate application feature.

## Compact version 3

`await createTransfer(bytes, filename, {chunkBytes: 384, compact: true})` selects v3. Omitting `compact`, or setting it to `false`, preserves the v2 sender and wire layout. Chunk sizes remain **384 or 600 bytes**, with the same maximum file size, 32-chunk generations, explicit XOR masks, bounded Gaussian elimination, SHA-256 verification, and owned-buffer cleanup as v2. Display lanes have no protocol identity: symbols shown side by side belong to one session and may arrive in either order.

A v3 transfer adds `manifestFrame()` and `manifestInterval: 16` to the existing sender API. `frame(index)` and `repairFrame(blockIndex, serial)` still produce fresh caller-owned binary QR payloads, but the frequently sent data symbols omit the filename, whole-file digest, original size, and sender serial. The serial still selects a deterministic repair mask; the receiver needs only that explicit mask.

The application sends a manifest **before the first data symbols and again at least every 16 data symbols**, including during repairs. It must count symbols, not display changes: two data symbols shown together consume two of those 16. Manifest repetition also continues if sending starts partway through the original source sequence. Calling these helpers alone does not schedule manifests.

### Source ordering and framing cost

`WGPlayback.create(transfer, {lanes: 1, startIndex: 0, initialManifest: true, interleave: true})` plans the display stream separately from the wire format. Compact v3 transfers default to interleaving; v2 remains sequential by default. Passing `{interleave:false}` restores sequential order for controlled comparisons.

Interleaving visits the same local chunk position in successive blocks before advancing that position: for three full blocks the order starts `0, 32, 64, 1, 33, 65, …`. Missing positions in a short final block are skipped. The permutation is rotated so the **first source symbol is exactly the requested `startIndex`**, and every source appears once before fountain repairs. The implementation converts between permutation positions and source indices in constant time, without retaining a file-sized order array. Checkpoints preserve the permutation cursor, so pausing after precomputation does not skip sources. Manifests, paired display lanes, and targeted feedback retain their existing semantics.

This spreads a contiguous optical dropout across generations instead of erasing most of one generation. It can shorten the no-feedback repair tail because the existing round-robin repair scheduler then advances several similarly incomplete blocks in parallel. It does not reduce the number of lost source bytes, guarantee a gain for every loss pattern, or remove the need for feedback. More blocks can remain partially open at once, so the receiver may retain more equation rows earlier in the transfer; the existing maximum of one row per source chunk and capped output buffer is unchanged.

Systematic symbols and one-bit repair masks copy their source slice directly into the zero-initialized payload. Mixed equations use a shared source `Uint32Array` view and one aligned payload view when possible; unaligned v2 payloads retain bytewise XOR. A final partial word is handled bytewise and untouched padding stays zero. Both word views use the same native byte order, which leaves the bytewise XOR result unchanged. No extra source copy, wire-format change, new chunk size, or receiver-specific interpretation is introduced by these framing optimizations.

`collector.accept(bytes)` adds these outcomes:

| Kind | Meaning |
| --- | --- |
| `pending` | A valid v3 data symbol arrived before its manifest. Returns `{kind, version:3, id, reason:'manifest', packetType}`. The payload is discarded, no session or output buffer is allocated, `state` remains `null`, and no progress or successful delivery is claimed. |
| `manifest` | A valid manifest started or repeated the active v3 session. Returns the ordinary detached state fields plus `{kind, packetType:'manifest'}`. The first manifest has `received:0`; repeats do not add rank or replace accepted data. |

Data symbols discarded before a manifest can be recovered by subsequent source or repair symbols. This allows late joining and recovery from a lost initial manifest without retaining an unbounded queue. There is no fixed completion-time guarantee if manifests continue to be lost. A different ID or data protocol version remains `foreign`, even when that symbol is a manifest or has no full metadata. Compact foreign data has an empty `foreignName`, because it does not contain a name.

Matching manifests must keep exactly the same original size, chunk size, sanitized name, and digest. Data symbols must match the active manifest's chunk length, block range, and exact source count in that block. Malformed/foreign symbols do not replace the session. The final padded chunk and original unpadded SHA-256 are checked before releasing any file. Repeated matching data or manifests can retry a transient digest failure; reset invalidates any pending digest just as for v2.

All data `progress` and `complete` results now include `packetType: 'single' | 'mixed'` for v2/v3, or `'legacy'` for v1. Single means a one-bit mask, including a repair mask that happens to select one source chunk. Mixed means two or more selected chunks. A manifest that retries/finalizes hashing can return `complete` with `packetType:'manifest'`.

### Version 3 data symbol

All multibyte integers are unsigned **big-endian**. Block indices are zero-based.

| Byte offset | Length | Field |
| --- | --- | --- |
| 0 | 8 | ASCII `WGQR-XFR` |
| 8 | 1 | Data version `3` |
| 9 | 1 | Symbol flags `0` (data) |
| 10 | 2 | Header length, exactly `36` |
| 12 | 16 | Cryptographically random transfer ID |
| 28 | 2 | Block index |
| 30 | 4 | Nonzero XOR mask within the block |
| 34 | 2 | Actual source count in this block, `1..32` |
| 36 | chunkBytes | XOR equation payload, always 384 or 600 bytes |
| 36 + chunkBytes | 4 | CRC-32/ISO-HDLC over all preceding symbol bytes |

The nominal chunk length is inferred from the exact symbol length and then checked against the manifest. Before a manifest, block indices are bounded by the maximum block count for the inferred chunk length, and the mask may not refer to a bit outside the declared count. These checks and CRC validation happen before any session allocation.

Data symbols are exactly **424 or 640 bytes**, independent of filename length. Their protocol overhead is 40 bytes; v2 uses `84 + filenameLength` bytes. Thus each data symbol saves `44 + filenameLength` bytes. This is a reduction in encoded binary length, not a claim about physical camera throughput. Periodic manifests consume additional display capacity, and QR version/size changes are discrete.

### Version 3 manifest

| Byte offset | Length | Field |
| --- | --- | --- |
| 0 | 8 | ASCII `WGQR-XFR` |
| 8 | 1 | Data version `3` |
| 9 | 1 | Symbol flags `1` (manifest) |
| 10 | 2 | Header length, `76 + filenameLength` |
| 12 | 16 | Transfer ID, identical to data symbols |
| 28 | 4 | Original unpadded file length, `1..10485760` |
| 32 | 2 | Source chunk length, `384` or `600` |
| 34 | 2 | Block count, derived exactly from size and chunk length |
| 36 | 4 | Source chunk count, derived exactly from size and chunk length |
| 40 | 2 | UTF-8 filename byte length, `1..120` |
| 42 | 2 | Reserved `0` |
| 44 | 32 | SHA-256 of the original unpadded file |
| 76 | filenameLength | Sanitized UTF-8 basename, using the unchanged v1/v2 rules |
| headerLength | 4 | CRC-32/ISO-HDLC over all preceding manifest bytes |

Manifest size is **81..200 bytes**. Unknown flags, inconsistent dimensions/lengths, invalid UTF-8 or filenames, and CRC failures are rejected before creating a session. A manifest can allocate only the same capped output and block-index structures used by a validated v2 frame.

### Version 3 feedback and targeted repairs

V3 uses **ACK format 2**, retaining the common ACK fields and completed-block bitmap described below. Byte 8 is `2`, byte 9 is data version `3`, and the two bytes at offset 74 contain a target-record count from **0 to 16**. Immediately after the bitmap are that many six-byte records; the trailing CRC follows the records and covers the whole ACK.

| Record offset | Length | Field |
| --- | --- | --- |
| 0 | 2 | Incomplete block index |
| 2 | 4 | Nonzero bitmap of missing Gaussian-elimination pivots in that block |

Records are strictly increasing by block index, refer only to incomplete blocks, and cannot set bits beyond the block's actual count. The receiver reports the first at most 16 incomplete blocks, so even the largest 10 MiB transfer has an ACK no larger than **283 bytes**. The full completed-block bitmap still covers every block. The ACK remains bound to the data version, random transfer ID, original file size, chunk/block dimensions, and whole-file digest.

For v3, `sender.acceptFeedback(bytes)` returns the usual `{missingBlocks, complete, suggestedRate}` plus `repairTargets: [{blockIndex, missingFrames}]`. Each `missingFrames` array contains at most 32 **global zero-based source indices**, suitable for `sender.frame(index)`. These are missing pivots, not a claim that those original QR symbols were never seen. Sending each of those systematic unit vectors increases the rank relative to the reported basis. If further data has arrived since the ACK, some targets can already be redundant; stale ACKs remain harmless. The sender should prioritize these targets, then continue fountain repair for incomplete blocks and request newer feedback when useful.

For v3 only, `suggestedRate` accepts **1, 2, 5, 10, 15, or 20 display changes per second**. This is the rate of a whole display, including a paired layout, not the count of individual QR symbols. The higher rates do not alter the ACK header or field widths, but an older v3 sender that only accepted rates up to 10 must be refreshed before consuming a 15/20 ACK. Existing v3 ACKs at 1/2/5/10 remain compatible; v1/v2 continue to reject 15/20. The application must select a rate supported by both ends rather than treating a higher advertised number as measured throughput.

ACKs with all blocks solved but `complete:false` still do not confirm delivery; only the successful whole-file digest sets the completion flag. V1/v2 continue to use ACK format 1, with no target records and no change to their wire layout or default sender API.

## Version 2 API

- `MAX_FILE_BYTES = 10485760` (10 MiB); `DEFAULT_CHUNK_BYTES = 384`; `BLOCK_CHUNKS = 32`.
- `SUPPORTED_CHUNK_BYTES` is `[384, 600]`.
- `isReserved(bytes)` recognizes the complete eight-byte prefixes `WGQR-XFR` and `WGQR-ACK`. A real file beginning with either prefix must be framed rather than sent as a plain QR.
- `await createTransfer(bytes, filename, {chunkBytes: 384})` copies the input before hashing and returns `{version:2, id, name, size, total, blockCount, chunkBytes, digest, frame, repairFrame, acceptFeedback, dispose}`. `id` and `digest` are lowercase hex strings. `total` means **source chunks**, not a finite number of emitted repair frames.
- `frame(index)` returns a systematic source frame, with `index` in `0..total-1`.
- `repairFrame(blockIndex, serial)` returns a repair equation for one block. Blocks are zero-based; serial is an integer in `0..4294967295`. A given transfer/block/serial produces the same equation. Rotate among incomplete blocks and vary serial numbers; repeating the same serial cannot add rank.
- Each frame is created lazily and is a **fresh caller-owned `Uint8Array`**. It may be zeroed after QR encoding. The sender retains one copy of the source, not a precomputed array of QR frames or matrices.
- `acceptFeedback(bytes)` synchronously returns `{missingBlocks, complete, suggestedRate}`. `missingBlocks` is zero-based. Wrong sessions, changed dimensions/digests, and malformed feedback throw. The result describes a receiver report, not authenticated proof of delivery.
- `dispose()` zeros the sender's owned source and metadata buffers. Later frame/feedback operations throw `TRANSFER_DISPOSED`. Already returned frames belong to the caller and are not mutated.
- `createCollector()` returns `{accept, reset, dispose, state, createFeedback}`. `reset()` and `dispose()` clear the active receiver and leave it usable for a new transfer.

`state` is `null` or a detached snapshot:

| Field | Meaning |
| --- | --- |
| `version`, `id`, `name`, `size` | Active transfer metadata |
| `total`, `chunkBytes`, `blockCount` | Source-chunk and block dimensions |
| `received` | Sum of independent equation ranks, from zero to `total` |
| `recovered` | Number of source chunks in completely solved blocks; v1 already exposes original chunks, so its value equals received chunks |
| `blocksComplete` | Number of solved blocks |
| `missing` | First **18** incomplete block numbers, **one-based**, for bounded UI display |
| `missingCount` | Full count of incomplete blocks, not just the displayed subset |
| `complete` | True only after the original file's SHA-256 has matched |

`await collector.accept(bytes)` returns:

| `kind` | Result |
| --- | --- |
| `plain` | `{kind, bytes}` for a non-reserved QR. Bytes are copied without text decoding, and an existing session is retained. The application decides whether plain input may replace an incomplete displayed transfer. |
| `progress` | Snapshot plus `{kind, duplicate}`; `duplicate` means no independent rank was gained, including dependent equations and already solved blocks. |
| `foreign` | The active snapshot plus `{kind, foreignId, foreignName, foreignVersion}`. A different ID **or protocol version** cannot mix into the active transfer. |
| `complete` | Snapshot plus `{kind, bytes}` after SHA-256 verification. The output is a fresh caller-owned copy. |

The v1 path validates the frame, delegates reception to `WGTransfer`, and maps its state into the block-oriented snapshot above. A complete `WGQR-ACK` prefix is always rejected by the file collector with `FEEDBACK_FRAME`, including malformed ACK content; it can never become an accidental downloaded file. Unknown data versions are rejected.

## Version 2 equations and memory bounds

The file is split into 384-byte source chunks by default, or 600-byte chunks when explicitly requested. Consecutive groups of up to 32 chunks form independent blocks (generations). Only the last source chunk may be short; the encoded representation pads it with zero bytes to the selected chunk length.

A frame carries a nonzero 32-bit mask. Bit `i` selects source chunk `i` within its block, and the payload is the bytewise XOR of the selected padded chunks. A systematic frame selects one bit. Repair masks can select **any nonempty subset**, including one bit; consequently a one-chunk block can recover entirely from repair frames. Bits outside a final block's actual source count must be zero.

The sender deterministically derives repair masks from the random transfer ID, block index, and serial with a 32-bit mixing function. Masks are explicit on the wire: the receiver does not have to reproduce that generator. This is bounded binary-linear fountain-style coding, not an implementation of the Multipart UR/LT distribution. More equations than source chunks may be needed because equations can be linearly dependent. No fixed number of repair frames guarantees successful reception.

The receiver maintains at most one pivot row per source chunk, hence **32 rows per block**. Incoming equations are reduced over GF(2). A zero mask with nonzero reduced payload is contradictory and is rejected without replacing accepted rows. At full block rank, back-substitution recovers the source chunks, validates final padding, copies them into the bounded output buffer, and immediately zeroes/frees that block's equation rows. Further frames for a solved block are CRC/metadata-checked but do not allocate or reduce another equation.

At 10 MiB, the default gives **27,307 source chunks in 854 blocks**. With 600-byte chunks there are **17,477 chunks in 547 blocks**. Counts and dimensions are derived from the validated byte size; no attacker-provided count can enlarge the buffers. Frame size, metadata, masks, and CRC are checked before allocating a session. Receiver-owned output and unsolved rows grow linearly with the capped file size.

`reset()` zeros v2 output, retained rows, and owned byte metadata, and increments a session epoch. A pending asynchronous digest cannot revive the old session or replace a new one. V1 delegates reset to the unchanged legacy helper; the wrapper also clears its own metadata. These operations are best-effort memory cleanup, not forensic erasure of browser/Web Crypto internals. SHA failure or invalid recovered padding clears the failed transfer. A transient digest service error retains solved data and may be retried by a matching frame.

## Version 2 data frame

All multibyte integers are unsigned **big-endian**. Wire block indices are zero-based. Every frame repeats metadata, so receiving can begin with a repair frame and no separate manifest.

| Byte offset | Length | Field |
| --- | --- | --- |
| 0 | 8 | ASCII `WGQR-XFR` |
| 8 | 1 | Data version `2` |
| 9 | 1 | Reserved flags `0` |
| 10 | 2 | Header length, `80 + filenameLength` |
| 12 | 16 | Cryptographically random transfer ID |
| 28 | 4 | Original file bytes, `1..10485760` |
| 32 | 2 | Source chunk length, `384` or `600` |
| 34 | 2 | Block index |
| 36 | 4 | Nonzero XOR mask within the block |
| 40 | 4 | Sender serial; informative because the XOR mask is explicit |
| 44 | 2 | UTF-8 filename byte length, `1..120` |
| 46 | 2 | Actual source count in this block, exactly `min(32, total-blockIndex*32)` |
| 48 | 32 | SHA-256 of the unpadded original file |
| 80 | filenameLength | Safe UTF-8 basename |
| headerLength | chunkBytes | XOR equation payload, always the full padded chunk length |
| headerLength + chunkBytes | 4 | CRC-32/ISO-HDLC of all preceding frame bytes |

A default 384-byte frame has at most **588 bytes**; a 600-byte frame at most **804 bytes**, both within the current QR encoder's correction-level M capacity. CRC uses reflected polynomial `0xEDB88320`, initial state `0xFFFFFFFF`, final XOR `0xFFFFFFFF`. File bytes are never converted to text or Base64. Filename sanitization follows the same rules as v1 below.

## Offline feedback QR

For v1/v2, `collector.createFeedback({suggestedRate: 2})` creates a fresh caller-owned ACK, with suggested rate `1`, `2`, `5`, or `10`. The default is `2`. It contains a bitmap of completely solved blocks, even if many equations were received for other blocks. It is valid before and after full-file verification. No transfer produces `NO_TRANSFER`. V3 uses the extended format and allowed rates specified above.

V1/v2 ACKs are at most **187 bytes** for the largest supported file. Every ACK is bound to the data protocol version, random session ID, original byte length, chunk/block dimensions, and whole-file digest. The sender rejects an ACK from another or earlier transfer. Re-reading an ACK from the same active transfer is harmless; it may cause extra repairs if it describes older progress. ACKs have no sequence counter so resetting a receiver can request all blocks again without creating a different source transfer.

| Byte offset | Length | Field |
| --- | --- | --- |
| 0 | 8 | ASCII `WGQR-ACK` |
| 8 | 1 | ACK format version `1` |
| 9 | 1 | Data protocol version `1` or `2` |
| 10 | 1 | Flags: bit zero = file SHA-256 verified; all other bits zero |
| 11 | 1 | Suggested frames/s: `1`, `2`, `5`, or `10` |
| 12 | 16 | Data transfer ID |
| 28 | 4 | Original file bytes |
| 32 | 2 | Source chunk bytes |
| 34 | 2 | Block count |
| 36 | 4 | Source chunk count |
| 40 | 32 | Original file SHA-256 |
| 72 | 2 | Bitmap length, exactly `ceil(blockCount/8)` |
| 74 | 2 | Reserved `0` |
| 76 | bitmapLength | Block bitmap: block `i` uses bit `i%8` of byte `floor(i/8)`; 1 means solved |
| 76 + bitmapLength | 4 | CRC-32/ISO-HDLC over every preceding ACK byte |

Unused bitmap bits must be zero. A verified-completion flag with any incomplete block is invalid. All blocks may be solved with the flag still zero while SHA-256 is pending; `{missingBlocks:[], complete:false}` must **not** be reported as successful delivery. The receiver sets the flag only after successful hashing. V1 ACKs can describe legacy reception, but the unchanged v1 sender has no feedback API; the v2 sender rejects their version.

The page must explicitly show the receiver's ACK to a sender camera; these helpers do not schedule scans or provide a return network channel. Front/rear-camera placement remains an application concern. Feedback is intended for occasional batches, not a round trip for every frame.

## Synthetic calibration versions 1 and 2

Calibration is separate from file transfer. `WGCalibration.create({lanes: 1, ecc: 'M'})` preserves the six-profile version-1 trial: 384-byte then 600-byte payloads, each at 2, 5 and 10 display changes/s. `extended:true` selects calibration version 2, retaining those first six profile indices and appending:

| Profile index | Synthetic payload | Display changes/s |
| --- | --- | --- |
| 6 | 384 bytes | 15 |
| 7 | 384 bytes | 20 |
| 8 | 600 bytes | 15 |
| 9 | 600 bytes | 20 |

Each profile lasts four seconds: a full legacy trial takes 24 seconds, and an extended trial takes 40 seconds. The sender retains the selected lane count and QR error-correction level for the whole trial. `WGQR-CAL` data symbols contain only reproducible synthetic bytes and a fresh random trial ID, never the selected file. They have exactly the same 424/640-byte binary lengths as compact data symbols. The rate-code field uses `[2,5,10]` in v1 and `[2,5,10,15,20]` in v2; profile index, payload code, rate code, sequence range, duration and flags must all agree.

Both `WGQR-CAL` and its 40-byte `WGQR-SET` result carry calibration version 1 or 2 at byte 8, keeping their existing field positions. A trial's end symbol is 40 bytes, uses sequence 65535, and must name its version's final profile (5 or 9). Observers reject mixing versions even if the trial ID matches. SET acceptance also requires the original version, ID, lane count, ECC and a valid profile, sample count and measured rate. An older receiver must be refreshed before an extended trial; version-1 trials remain available through the default API.

The observer deduplicates sequence numbers and waits for the end symbol before selecting a profile or emitting SET. A candidate needs at least three distinct display steps. Its score is unique accepted payload bytes divided by the full four-second period, including missed frames; an already-running profile observed after a late join is scored conservatively. Entirely missed profiles have zero samples and cannot win. In the largest profile, two lanes at 20 changes/s produce at most 160 unique symbols and **24,000 B/s**, within SET's unsigned 16-bit rate field. This synthetic result selects a candidate configuration; it is not a measured completed-file throughput and does not account for manifests, fountain dependence or later changes in camera conditions.

## Integrity, interoperability and errors

Neither CRC, SHA-256, fountain coding nor feedback encrypts or authenticates the content. Anyone who can photograph sufficient independent equations can reconstruct the file. An adversarial observer can forge an unauthenticated ACK; the sender interprets it as a receiver report, not a cryptographic delivery certificate. Final SHA-256 prevents an inconsistent reconstructed file from being offered for download, but does not establish sender identity.

Errors use `name: "QRTransferError"` and a Polish message. Codes include `INVALID_INPUT`, `EMPTY_INPUT`, `FILE_TOO_LARGE`, `CRYPTO_UNAVAILABLE`, `MALFORMED_FRAME`, `UNSUPPORTED_VERSION`, `CRC_MISMATCH`, `METADATA_CONFLICT`, `CHUNK_CONFLICT`, `DIGEST_MISMATCH`, `TRANSFER_RESET`, `TRANSFER_DISPOSED`, `FEEDBACK_FRAME`, `MALFORMED_FEEDBACK`, `FEEDBACK_SESSION_MISMATCH`, `NO_TRANSFER`, and `V1_UNAVAILABLE`. The UI should silently ignore stale `TRANSFER_RESET` results. Rejected malformed/foreign frames do not replace the current session; digest/padding failure clears the failed transfer.

## Version 1 reference (unchanged)

`assets/qr-transfer.js` exposes the classic-script global `WGTransfer`. Everything happens in browser memory. It uses no requests, persistence, compression, external libraries, or forward error correction. SHA-256 and random session IDs use Web Crypto, so the animated-transfer feature needs a secure context such as HTTPS or localhost.

### Version 1 API

- `MAX_FILE_BYTES = 10485760` (10 MiB).
- `CHUNK_BYTES = 600`.
- `await createTransfer(Uint8Array, filename)` returns `{id, name, size, total, frames, digest}`. `id` and `digest` are lowercase hexadecimal strings; every element of `frames` is a binary `Uint8Array` ready for `WGQR.encodeBytes()`. The input is copied before the asynchronous digest.
- `createCollector()` returns an object with `accept(bytes)`, `reset()`, and a read-only `state` getter. `state` is `null` or a detached snapshot containing `{id, name, size, total, received, missing, complete}`. `missing` uses **one-based** frame numbers.

`await collector.accept(bytes)` returns one of:

| kind | Result |
| --- | --- |
| `plain` | `{kind, bytes}` for a QR without the complete eight-byte protocol magic. These raw bytes are copied without text decoding. Existing transfer progress remains intact. |
| `progress` | `{kind, id, name, size, total, received, missing, complete:false, duplicate}`. Repeated matching chunks do not increase `received`. |
| `foreign` | The **active** transfer's snapshot, with `kind`, `foreignId`, and `foreignName` for the incoming session. No state is reset or mixed. |
| `complete` | `{kind, id, name, size, total, bytes}` after whole-file SHA-256 validation. Returned file bytes are a detached copy. |

`reset()` immediately clears the current session. Pending digest work cannot restore it; any pending `accept()` rejects with `TRANSFER_RESET`. The UI should ignore that cancellation error. A final digest mismatch clears the failed session. Other rejected frames leave existing progress unchanged. Once a transfer is complete, matching repeats return the verified complete file again; another session remains `foreign` until reset.

Errors have `name: "QRTransferError"`, a Polish `message`, and one of these `code` values: `INVALID_INPUT`, `EMPTY_INPUT`, `FILE_TOO_LARGE`, `CRYPTO_UNAVAILABLE`, `MALFORMED_FRAME`, `UNSUPPORTED_VERSION`, `CRC_MISMATCH`, `METADATA_CONFLICT`, `CHUNK_CONFLICT`, `DIGEST_MISMATCH`, `TRANSFER_RESET`.

### Version 1 binary frame

All integers are unsigned and **big-endian**. Wire indices are zero-based. Every frame repeats the full metadata so scanning may start at any point in the animation.

| Byte offset | Length | Field |
| --- | --- | --- |
| 0 | 8 | ASCII magic `WGQR-XFR` |
| 8 | 1 | Version: `1` |
| 9 | 1 | Reserved flags: `0` |
| 10 | 2 | Header length: `72 + filenameLength` |
| 12 | 16 | Random transfer ID |
| 28 | 4 | Total original file bytes, `1..10485760` |
| 32 | 2 | Chunk index, `0..count-1` |
| 34 | 2 | Chunk count, exactly `ceil(fileBytes / 600)` |
| 36 | 2 | Nominal chunk size: `600` |
| 38 | 2 | UTF-8 filename length, `1..120` bytes |
| 40 | 32 | SHA-256 of the entire original file |
| 72 | filenameLength | Sanitized UTF-8 basename |
| headerLength | payloadLength | Original file bytes for this chunk |
| headerLength + payloadLength | 4 | CRC-32/ISO-HDLC over every preceding frame byte |

The payload is exactly `min(600, fileBytes - index * 600)` bytes. CRC uses the reflected polynomial `0xEDB88320`, initial value `0xFFFFFFFF`, and final XOR `0xFFFFFFFF` (the conventional CRC-32). No padding, Base64, text conversion, or file-byte normalization is performed.

The filename is reduced to its final path component; controls, bidirectional override/isolate characters, and BOM are removed; characters unsuitable for common filesystems are replaced; trailing spaces/dots are removed; reserved or empty names fall back to `plik.bin`. It is capped at 120 UTF-8 bytes without splitting a Unicode code point. Receivers reject invalid UTF-8 or a name that is not already in this safe form. Filename changes never alter the file bytes.

A frame is at most **796 bytes**, comfortably within the QR core's correction-level M capacity. A 10 MiB file uses **17,477 frames**, which fits the unchanged unsigned 16-bit count/index fields. The animation may loop at approximately five frames per second; receivers retain valid chunks across loops, skip identical duplicates, and report missing indices. The helper does not schedule the animation or read the camera. A complete uninterrupted cycle at that maximum size takes about 58 minutes at five frames per second; capture losses may require further cycles.

Version 1 and the wire layout are unchanged. Small transfers produced by the earlier 256 KiB implementation remain valid. Older receivers retain their original size cap and must be updated to receive larger files.

### Version 1 validation and interoperability

Receivers check frame bounds, all exact lengths/counts, version, flags, filename, and CRC before buffering. Only one session is retained. Metadata must remain identical for a given ID, duplicate chunk content must match, and the final SHA-256 must agree before releasing a completed file.

CRC and SHA-256 detect corrupted or inconsistent transfer data; they do not authenticate the sender or encrypt the content. Someone able to photograph the complete animation can reconstruct the file. Use this page's collector to receive framed animations: a WireGuard app or ordinary QR scanner does not understand this custom multi-frame format. A small, ordinary raw configuration QR remains compatible with WireGuard's direct QR import.

## Verification

From `development/`, run `npm test`, or run the focused v2 suite with `node --test tools/qr-resilient.test.mjs`.

V2 tests cover an independently constructed invertible equation basis; repair-only reception with one-, two-, and 32-chunk blocks; more than 50% source-frame loss with additional repair loss, arbitrary order and duplicates; rank and bounded progress; CRC and malicious dimensions/masks; mixed protocol versions; zero padding and final SHA; reset while hashing; owned-buffer cleanup; detached outputs; selective repair driven by feedback; malformed and foreign ACKs; the exact 10 MiB boundary; frozen v1 compatibility; and binary repair/feedback through the actual QR encoder, PNG pipeline, and jsQR decoder.

The compact and playback suites also cover independent v3 wire bytes; missing/repeated manifests; paired out-of-order delivery and a permanently unreadable lane; targeted missing pivots; partial final blocks; rotated interleaving through the 27,307-chunk boundary; checkpoint rewind in sequential and interleaved modes; and v3-only 15/20 feedback. Aligned and unaligned framing is compared with an independent bytewise XOR calculation, including borrowed transport buffers and partial-word padding. A deterministic burst-loss fixture reports both sequential and interleaved recovery counts, with and without targeted feedback, rather than assuming interleaving always improves completion time.

These mathematical and image round-trip tests are not a measurement of a physical phone camera's throughput. Transmission rate and completion time still depend on camera capture, decoder cost, frame readability, losses, and the number of independent equations received.
