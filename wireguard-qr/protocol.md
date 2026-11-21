# WGQR animated transfer, version 1

`assets/qr-transfer.js` exposes the classic-script global `WGTransfer`. Everything happens in browser memory. It uses no requests, persistence, compression, external libraries, or forward error correction. SHA-256 and random session IDs use Web Crypto, so the animated-transfer feature needs a secure context such as HTTPS or localhost.

## API

- `MAX_FILE_BYTES = 262144` (256 KiB).
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

## Binary frame

All integers are unsigned and **big-endian**. Wire indices are zero-based. Every frame repeats the full metadata so scanning may start at any point in the animation.

| Byte offset | Length | Field |
| --- | --- | --- |
| 0 | 8 | ASCII magic `WGQR-XFR` |
| 8 | 1 | Version: `1` |
| 9 | 1 | Reserved flags: `0` |
| 10 | 2 | Header length: `72 + filenameLength` |
| 12 | 16 | Random transfer ID |
| 28 | 4 | Total original file bytes, `1..262144` |
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

A frame is at most **796 bytes**, comfortably within the QR core's correction-level M capacity. A 256 KiB file uses **437 frames**. The animation may loop at approximately five frames per second; receivers retain valid chunks across loops, skip identical duplicates, and report missing indices. The helper does not schedule the animation or read the camera.

## Validation and interoperability

Receivers check frame bounds, all exact lengths/counts, version, flags, filename, and CRC before buffering. Only one session is retained. Metadata must remain identical for a given ID, duplicate chunk content must match, and the final SHA-256 must agree before releasing a completed file.

CRC and SHA-256 detect corrupted or inconsistent transfer data; they do not authenticate the sender or encrypt the content. Someone able to photograph the complete animation can reconstruct the file. Use this page's collector to receive framed animations: a WireGuard app or ordinary QR scanner does not understand this custom multi-frame format. A small, ordinary raw configuration QR remains compatible with WireGuard's direct QR import.

## Verification

From `development/`, run `npm test`. Tests include shuffled/missing/repeated frames, a foreign session, malformed metadata, corruption, duplicate conflicts, oversized declarations, final digest failure, cancellation during asynchronous hashing, the full size limit, and more than five frames passing through the actual bundled QR encoder, PNG encoding/decoding, and jsQR decoder.
