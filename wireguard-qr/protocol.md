# WGQR binary optical transfer

The site preserves raw file bytes in QR byte segments. A small ordinary configuration QR contains the configuration itself and remains suitable for WireGuard's native QR importer. Framed animations and feedback are a custom protocol between instances of this site, not a WireGuard, UR, or general QR-scanner format.

`assets/qr-resilient.js` exposes `WGResilient`: a version-2 sender, a receiver for v2/v1/plain QR, and offline feedback. The unchanged `assets/qr-transfer.js` exposes `WGTransfer` and is retained as the v1 receiver. Load it before `qr-resilient.js`.

Both helpers work in browser memory without network requests, workers, persistence, compression, or new dependencies. Web Crypto provides random session IDs and SHA-256, so framed transfer completion needs HTTPS or localhost. ZIP compression is a separate application feature.

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

`collector.createFeedback({suggestedRate: 2})` creates a fresh caller-owned ACK, with suggested rate `1`, `2`, `5`, or `10`. The default is `2`. It contains a bitmap of completely solved blocks, even if many equations were received for other blocks. It is valid before and after full-file verification. No transfer produces `NO_TRANSFER`.

ACKs are at most **187 bytes** for the largest supported file. Every ACK is bound to the data protocol version, random session ID, original byte length, chunk/block dimensions, and whole-file digest. The sender rejects an ACK from another or earlier transfer. Re-reading an ACK from the same active transfer is harmless; it may cause extra repairs if it describes older progress. ACKs have no sequence counter so resetting a receiver can request all blocks again without creating a different source transfer.

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

These mathematical and image round-trip tests are not a measurement of a physical phone camera's throughput. Transmission rate and completion time still depend on camera capture, decoder cost, frame readability, losses, and the number of independent equations received.
