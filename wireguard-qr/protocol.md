# WGQR binary optical transfer

The site preserves raw file bytes in QR byte segments. A small ordinary configuration QR contains the configuration itself and remains suitable for WireGuard's native QR importer. Framed animations and feedback are a custom protocol between instances of this site, not a WireGuard, UR, or general QR-scanner format.

`assets/qr-resilient.js` exposes `WGResilient`: a version-2 sender by default, an opt-in compact version-3 sender, a receiver for v3/v2/v1/plain QR, and offline feedback. The unchanged `assets/qr-transfer.js` exposes `WGTransfer` and is retained as the v1 receiver. Load it before `qr-resilient.js`.

Both helpers work in browser memory without network requests, workers, persistence, compression, or new dependencies. Web Crypto provides random session IDs and SHA-256, so framed transfer completion needs HTTPS or localhost. ZIP compression is a separate application feature.

## Segmented version 4 for large files

`assets/qr-large.js` adds `WGLarge`, a separate large-file transport with a maximum of **209,715,200 bytes (200 MiB)**. It preserves any selected single file or existing ZIP without extracting or recompressing it. Existing v1/v2/v3 limits and wire formats are unchanged. Both devices must support v4; an ordinary QR scanner cannot assemble this protocol.

The file is divided into **2,097,152-byte (2 MiB) segments**, with a shorter final segment when needed. There are 1–100 segments. Each segment uses the existing compact v3 source symbols, 32-source XOR generations, fountain repairs and SHA-256 check. A new outer envelope binds every symbol to the identity of the whole file and a zero-based segment index. Interleaving operates only inside the current segment.

The sender reads the source `File` in sequential slices during preparation, retaining only the segment digests. `loadSegment(index)` reads and retains one segment, checks its digest against preparation, and releases the preceding segment. The receiver retains one inner collector and writes a segment only after its SHA-256 has passed. It discards an incomplete inner session when a manifest selects a different segment or a new inner session for the same segment. Already committed segments remain available. Partial equations are not persisted in v4; an interrupted segment may need to be sent again.

The active source/equation buffers are bounded by the segment size, not the total file size. Durable files, final assembly, temporary browser buffers, camera frames and QR matrices have separate storage/memory costs. This framing does not guarantee that every device can receive or export a 200 MiB file, or shorten the optical transmission time. The application must verify that its storage adapter is available before starting the large-file receiver.

### Stable identity: ordered segment-hash root

The descriptor is exactly:

```js
{ version: 4, id, name, size, segmentBytes: 2097152, segmentCount }
```

`name` is the same canonical sanitized UTF-8 basename used by v3, at most 120 encoded bytes. `segmentCount` must equal `ceil(size/2097152)`. `id` is a lowercase 64-character hex encoding of SHA-256 over this canonical byte sequence, in the order shown:

| Length | Input to the root hash |
| --- | --- |
| 16 | ASCII `WGQR-LARGE-ROOT` followed by one zero byte |
| 1 | Version `4` |
| 4 | Original file length, unsigned big-endian |
| 4 | Segment size `2097152`, unsigned big-endian |
| 2 | Segment count, unsigned big-endian |
| 2 | UTF-8 filename byte length, unsigned big-endian |
| nameLength | Canonical filename bytes |
| 32 × segmentCount | SHA-256 digests of the unpadded segments, in ascending segment-index order |

This is an **ordered segment-hash root**, not the ordinary SHA-256 of the whole file. Reopening the same bytes with the same canonical name produces the same descriptor, regardless of source chunk size, display lanes, QR ECC, rate or fresh inner v3 session IDs. A changed filename or changed file contents produces a different root. After loading a segment, the sender compares its new digest against the preparation digest before exposing any symbols for that segment.

The receiver recomputes the root from the descriptor and the digests of all durably committed segments before asking the store to finish. A mismatched root never produces a completion flag or a downloadable result. The store independently verifies the actual segment bytes during write, reopening and final assembly. Checksums detect corruption and inconsistent content; they do not authenticate the sender.

### Version 4 outer data and manifest envelopes

All integer fields are unsigned **big-endian**. Both outer and inner CRCs use CRC-32/ISO-HDLC. The inner v3 frame is retained verbatim, including its CRC and random 16-byte inner session ID.

| Byte offset | Length | Common field |
| --- | --- | --- |
| 0 | 8 | ASCII `WGQR-LRG` |
| 8 | 1 | Version `4` |
| 9 | 1 | `0` for a data symbol, `1` for a manifest; other values invalid |
| 10 | 2 | Outer header length |
| 12 | 32 | Whole-file ordered segment-hash root |
| 44 | 2 | Zero-based segment index, less than segmentCount |
| 46 | 2 | Exact inner-frame byte length |

For data, the header length is exactly **48**. A complete inner v3 data symbol of **424 or 640 bytes** follows at offset 48. The final four bytes contain the outer CRC over every preceding outer-packet byte. Total QR payload length is therefore **476 or 692 bytes**, adding 52 bytes to the corresponding v3 symbol.

For a manifest, the common header is followed by:

| Byte offset | Length | Manifest field |
| --- | --- | --- |
| 48 | 4 | Whole-file original length, `1..209715200` |
| 52 | 4 | Segment size, exactly `2097152` |
| 56 | 2 | Whole-file segment count, exactly `ceil(size/2097152)` |
| 58 | 2 | Canonical UTF-8 filename byte length, `1..120` |
| 60 | 32 | SHA-256 of this original unpadded segment |
| 92 | nameLength | Whole-file canonical UTF-8 basename |
| headerLength | 91 | Complete inner v3 manifest |
| headerLength + 91 | 4 | Outer CRC |

The outer manifest header length is `92 + nameLength`. Its inner manifest uses the fixed name **`segment.bin`**, has the exact length of this segment, and repeats the same segment digest as the outer header. Its chunk count, block count and 384/600-byte chunk size must all match. The outer filename is the final output name. Manifest packets are **188–307 bytes**.

Repeat a manifest initially and after at most 16 data symbols, including repairs, as with v3. A valid data symbol before the appropriate manifest is `pending` and is discarded without allocating an output segment. Data bearing a different inner session ID cannot reset a partial segment by itself; a matching outer manifest is required. Matching manifests cannot change the whole-file descriptor or an already-known segment digest. A different whole-file root is `foreign`, including when a stored transfer is resumed before the first new camera frame.

The parser validates exact lengths, versions, flags, canonical UTF-8 names, both CRCs, segment limits and inner dimensions before creating an inner collector. A maximum-sized or malformed declared length cannot allocate an arbitrary buffer. `isFrame`, `isFeedback` and `isReserved` recognize their eight-byte prefixes even when the rest of a packet is malformed; an ACK or a corrupted framed packet must never become a raw downloaded file.

### Version 4 durable feedback

The v4 ACK reports only **committed, verified segments**. It has no list of partial FEC pivots. Segment `i` uses bit `i % 8` in bitmap byte `floor(i / 8)`; unused high bits must be zero.

| Byte offset | Length | Field |
| --- | --- | --- |
| 0 | 8 | ASCII `WGQR-LAK` |
| 8 | 1 | Version `4` |
| 9 | 1 | Completion flag: `0` or `1` |
| 10 | 1 | Suggested display changes/s: `1, 2, 5, 10, 15, 20` |
| 11 | 1 | Reserved `0` |
| 12 | 32 | Whole-file ordered segment-hash root |
| 44 | 4 | Whole-file length |
| 48 | 4 | Segment size `2097152` |
| 52 | 2 | Segment count |
| 54 | 2 | Bitmap length, exactly `ceil(segmentCount/8)` |
| 56 | bitmapLength | Durable completed-segment bitmap |
| 56 + bitmapLength | 4 | CRC over all preceding ACK bytes |

ACK length is **61–73 bytes**. The sender checks identity and dimensions, and returns `{complete, missingSegments, suggestedRate}`. All-complete bitmap bits with a zero completion flag mean that final root verification/assembly has not been confirmed; an empty missing list alone is not proof of completion. A completion flag with any missing segment is invalid.

The sender can cycle through segments and use an occasional aggregate ACK to skip committed ones. No per-symbol or per-segment return channel is required by the protocol. A bounded repair pass can still leave a segment incomplete; only the receiver's durable bitmap confirms that it can be skipped. The ACK is an unauthenticated receiver report, as with the earlier protocols.

### Version 4 JavaScript and storage contract

```js
const sender = await WGLarge.createSender(file, { chunkBytes: 600, onProgress, isCurrent });
const transfer = await sender.loadSegment(index);
const planner = WGPlayback.create(transfer, { lanes: 2 });
const receiver = WGLarge.createCollector({ store, onProgress });
const resumed = await receiver.resume();
const result = await receiver.accept(qrBytes);
```

`createSender` reports hash preparation using `{phase:'hash', completedBytes, totalBytes, segmentIndex, segmentCount}`. The sender exposes its frozen `.descriptor`, whole-file `.id/.name/.size`, segment dimensions, `loadSegment`, synchronous `acceptFeedback`, and `dispose`. A loaded transfer has `.version:4`, `.descriptor`, `.segmentIndex`, `.id` equal to the whole-file root, `.name`, segment `.size/.digest`, `.total/.blockCount/.chunkBytes`, `.manifestInterval:16`, and fresh owned `manifestFrame()/frame()/repairFrame()` buffers. It is compatible with `WGPlayback`; switching or reloading a segment invalidates the previous transfer. The application must also invalidate its prepared displays and QR matrix cache at that transition, including when reloading the same segment under a new inner session ID.

The receiver exposes `.state`, `accept`, synchronous `createFeedback({suggestedRate})`, asynchronous `resume`, `reset`, and `dispose`. Results are `pending`, `foreign`, `manifest`, `progress` or `complete`. A newly committed segment returns `segmentComplete:true` and its `segmentIndex`. The final `complete` result contains a disk-backed **`file`**, never a whole-file `.bytes` array. `packetType` is `manifest`, `single`, `mixed`, or `unknown` before any optical packet has been accepted.

State contains the descriptor fields and `.descriptor`, plus:

| Field | Meaning |
| --- | --- |
| `completedSegments` | Number of durably committed segments |
| `savedBytes`, `receivedBytes` | Bytes in those committed segments; neither includes partial equations |
| `pendingBytes` | Active inner rank × chunkBytes, capped at that segment's length; provisional progress only |
| `currentSegment`, `segmentSize`, `chunkBytes` | Active inner segment information, or null/zero when none is retained |
| `received`, `total`, `recovered` | Active inner source/equation counters; separate from whole-file durable progress |
| `complete` | True only after ordered-root verification and successful durable final assembly |

Stored descriptor/progress and a durable feedback bitmap are available immediately after creating a collector, before a new manifest. `await resume()` rechecks the ordered root when all segments are present and returns the existing finished file, or retries final assembly if it had not completed. Until that check, all durable segments may be present while the completion flag is false. A later manifest also retries finalization.

The supplied store has `.state = {descriptor, completed, digests, savedBytes, complete}`, asynchronous `begin(descriptor)`, `putSegment(index, bytes, digestHex)`, `finish({onProgress})`, and `file()`. `begin` resumes only the same complete descriptor. The store verifies segment SHA and length, commits completion after durable write/close, and revalidates stored data on reopening. `finish` sequentially rechecks and assembles the file without returning a full byte array. The caller owns storage permissions, disk availability, explicit deletion, and store disposal.

Collector reset/disposal invalidates in-flight replies and releases partial equations without calling `store.clear()` or `store.dispose()`. An already-started correct disk write can finish durably during reset; its stale reply cannot update a replacement collector session, and the segment will be checked when resumed. Sender cancellation and superseded loads likewise cannot return a segment from an older selection. All temporary source/decoded byte arrays owned by the transport are cleared after hashing or storage consumption.

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

`WGCalibration.create({large:true})` measures the larger v4 envelope without transmitting the selected file. It adds 52 synthetic bytes, so profile packets have exactly **476/692 bytes**; the end marker stays 40 bytes. In CAL byte 9, the flags are ended=`1`, ECC L=`2`, and large=`4`. In SET byte 11, ECC L=`1` and large=`2`. The large flag is part of the trial identity: observers and the sender reject a changed value within the same session. Standard trials retain their previous bytes and default `large:false`. Earlier clients reject the new flag bits and must be refreshed for a large-file trial; both calibration versions 1 and 2 can carry the flag.

The observer deduplicates sequence numbers and waits for the end symbol before selecting a profile or emitting SET. A candidate needs at least three distinct display steps. Its score is unique accepted payload bytes divided by the full four-second period, including missed frames; an already-running profile observed after a late join is scored conservatively. Entirely missed profiles have zero samples and cannot win. In the largest profile, two lanes at 20 changes/s produce at most 160 unique symbols and **24,000 B/s**, within SET's unsigned 16-bit rate field. This synthetic result selects a candidate configuration; it is not a measured completed-file throughput and does not account for manifests, fountain dependence or later changes in camera conditions.

## Synthetic grid calibration versions 3 and 4

Grid calibration describes both the QR layout and the complete measurement plan. Existing v1/v2 callers and the wire bytes of v1/v2/v3 are preserved. This section describes calls with the default `landscapeOnly:false`; version 5 is defined separately below. Calibration version 4 has the `WGQR-CAL`/`WGQR-SET` magic; it is distinct from the large-file data protocol's version 4.

### Plans and API

`WGCalibration.create()` accepts `grid:{columns,rows}`, `compareLayouts`, `allLayouts`, `extended`, `ecc` and `large`. The two comparison flags are booleans and mutually exclusive; `allLayouts:true,compareLayouts:true` is invalid. A comparison plan ignores the requested current grid. Every grid runs the unchanged six basic profiles or ten extended profiles listed above, with the grid as the outer loop. The basic order is 384 B at 2/5/10 Hz, then 600 B at 2/5/10 Hz. Extended plans append 384 B at 15/20 Hz and 600 B at 15/20 Hz to that six-profile prefix.

| Requested plan | Emitted CAL version | Grids | Basic / extended profiles |
| --- | --- | --- | --- |
| No grid and neither comparison flag | 1 / 2 | Fixed legacy lane count | 6 / 10 |
| Current grid, 1–3 columns and 1–3 rows | 3 | Requested grid | 6 / 10 |
| `compareLayouts:true` | 3 | 1×1, 2×1, 1×2, 2×2, in this order | 24 / 40 |
| Current grid, 4–5 columns and 1–3 rows | 4 | Requested grid | 6 / 10 |
| `allLayouts:true` | 4 | Every combination of 1–5 columns and 1–3 rows | 90 / 150 |

Version 3 still rejects grids wider than three columns. Its comparison flag continues to mean exactly four grids. Version 4 permits up to 15 independent QR symbols per display. The all-layout order is fixed by increasing symbol count, then columns, then rows:

| Grid | Symbols | First basic profile | First extended profile |
| --- | --- | --- | --- |
| 1×1 | 1 | 0 | 0 |
| 1×2 | 2 | 6 | 10 |
| 2×1 | 2 | 12 | 20 |
| 1×3 | 3 | 18 | 30 |
| 3×1 | 3 | 24 | 40 |
| 2×2 | 4 | 30 | 50 |
| 4×1 | 4 | 36 | 60 |
| 5×1 | 5 | 42 | 70 |
| 2×3 | 6 | 48 | 80 |
| 3×2 | 6 | 54 | 90 |
| 4×2 | 8 | 60 | 100 |
| 3×3 | 9 | 66 | 110 |
| 5×2 | 10 | 72 | 120 |
| 4×3 | 12 | 78 | 130 |
| 5×3 | 15 | 84 | 140 |

`WGCalibration.allGrids` exposes this frozen array of frozen `{columns,rows}` objects and remains the 15-grid legacy list. Versions 3 and 4 retain their limits of three rows and, for v4, 15 symbols; the current public `limits` object is described under v6 below. A sender exposes its immutable `profiles`, plus `alignmentIndex` and `alignmentLanes`: the first profile of the largest grid and its symbol count. These are 84/140 and 15 for all-layout plans, 18/30 and 4 for the four-grid comparison, or 0 and the selected grid's area for a current-grid plan. The `allLayouts` boolean is included in the sender, parsed CAL, observer snapshot and accepted SET result.

Each profile measures exactly four seconds. Preparation is outside that interval: with one second of settling before each profile, the v4 all-layout sequence lasts nominally 450 or 750 seconds, plus an initial setup period controlled by the user. These times are plan durations, not promised transfer rates.

### CAL header and preparation

All multibyte integer fields use big-endian order. Grid CAL keeps the existing 40-byte header/CRC overhead:

| Offset | Length | Meaning |
| --- | --- | --- |
| 0 | 8 | ASCII `WGQR-CAL` |
| 8 | 1 | Calibration version |
| 9 | 1 | Flags described below |
| 10 | 1 | Profile index, 0–89 or 0–149 in an all-layout plan |
| 11 | 1 | `(columns << 4) \| rows`; v1/v2 instead contain their fixed lane count |
| 12 | 16 | Random trial ID |
| 28 | 2 | Sequence number, setup slot, or 65535 for END |
| 30 | 2 | Reserved, zero |
| 32 | 2 | Measurement duration, exactly 4000 ms |
| 34 | 1 | Payload code: 0 = 384 B, 1 = 600 B |
| 35 | 1 | Rate index in `[2,5,10,15,20]` |
| 36 | Variable | Reproducible synthetic bytes, omitted from 40-byte markers |
| Final 4 | 4 | CRC32 of every preceding byte |

CAL byte 9 uses ended=`1`, ECC L=`2`, large=`4`, alignment=`8`, extended=`16`, four-grid comparison=`32`, setup-preview=`64`, and all-layout comparison=`128`. The final bit is allowed only in v4; flags `32` and `128` cannot coexist. Bits `8`/`16`/`32`/`64` require v3 or later. Setup requires alignment, and alignment cannot be END. Every frame's grid, profile, payload code, rate code, duration and sequence range must agree with its declared plan.

`alignmentFrame(slot,index,setup=false)` emits a stationary preparation code for one slot. Slots range from zero through `columns*rows-1`, with distinct sequence fields and CRCs. In v3, both setup-preview and ordinary settling frames have the full measurement length. In v4, **only setup-preview frames are 40 bytes**: this lets the receiver learn a plan even when its 15 dense measurement codes cannot all be read. They retain the profile metadata and the `large` flag for the coming measurements. V4 settling frames remain full-sized. A shortened non-setup measurement or settling frame is invalid.

Measurement and ordinary settling lengths remain 424/640 bytes, or 476/692 with `large:true`. END is always 40 bytes, names the plan's final profile, and uses sequence 65535. A single small END code therefore does not describe how many QR symbols were displayed during the trial. Initial setup and settling do not contribute any accepted samples, bytes, display steps or throughput.

### Exact coverage, results and SET

A measurement sequence identifies the slot and display step: `slot = sequence % lanes`, `step = floor(sequence / lanes)`, and the one-second window is `floor(sequence / (fps*lanes))`. Expected unique reads are `4*fps*lanes`, with `fps*lanes` reads in each of four windows. The largest v4 profile has 1200 expected reads, uses sequences 0–1199, and contains 300 distinct symbols per second. Duplicate reads do not add coverage; late reads retain their original window.

Observer snapshots retain `phase:'alignment'|'measuring'|'finished'` and expose `setup` and `latestMeasurementIndex` so presentation can distinguish an initial largest-grid preview from a later settling interval. The first setup does not close earlier profiles. Settling and measurement progress cannot be rewound by delayed setup or older settling frames. A later profile closes earlier ones; END closes the entire advertised plan. Consequently, all profiles of a wholly unreadable grid are failed after END, rather than remaining untested or disappearing from the results.

V3/v4 choose `best` only after END and only among profiles with full unique coverage and at least three distinct display steps. Full coverage necessarily fills all four windows. `fastest` may report the highest useful-byte rate with gaps for diagnosis, but cannot produce SET unless it also satisfies the full-coverage rule. Rates are unique synthetic data bytes divided by the full four seconds; ties prefer lower Hz, then fewer symbols, then the earlier profile. Old v1/v2 minimum-sample recommendation semantics remain unchanged.

Grid SET remains 40 bytes. Bytes 0–7 contain `WGQR-SET`; byte 8 is the calibration version; byte 9 is the chosen profile; byte 10 is its packed grid; byte 11 contains ECC L=`1`, large=`2`, four-grid comparison=`4`, extended=`8`, and all-layout comparison=`16` (v4 only). Bytes 12–27 contain the trial ID. Bytes 28–29 contain the accepted sample count, bytes 30–33 an unsigned 32-bit useful-byte rate, bytes 34–35 the distinct display-step count, and bytes 36–39 CRC32. The maximum v4 result is **180,000 B/s** for 600 B × 20 Hz × 15 symbols; this fits the unchanged v3/v4 32-bit field. V1/v2 retain their 16-bit rate and reserved bytes.

The sender accepts SET only for its exact version, trial ID, comparison plan, extended flag, ECC, large flag, profile and grid. V3/v4 also require samples to equal the profile's full expected count, steps to equal `4*fps`, and the rate to equal `samples*chunkBytes/4`. A different layout with the same number of symbols is still a mismatch. Unsupported versions, out-of-range grids/indices/sequences, inconsistent sizes or flags, and CRC failures cannot replace an observer's active session.

### Presentation model

`WGCalibrationView.create({encodeBytes}).compute(snapshot,{fromImages:false})` returns groups by data size, layout rows and frequency columns, with `pending`, `running`, `passed` or `failed` cells. A running profile is not marked passed until it closes. The model handles 90/150-profile plans without changing the protocol. A reset or null snapshot clears the model's scalar dimension cache.

The table's module counts come from the real byte-mode encoder with the measurement payload length and selected ECC, without the quiet zone. There are two cached measurement dimensions per session. V4 setup adds one cached 40-byte dimension: `current` then describes the actual header-only QR (`chunkBytes:0`, `payloadBytes:40`, `headerOnly:true`), while `plannedChunkBytes`/`plannedModules` and the table retain measurement parameters. Temporary matrices are cleared. Image-derived observations retain packet coverage but expose no measured byte rates or recommended camera settings.

## Landscape calibration version 5

Calibration version 5 introduced landscape-only plans. Its only multi-QR layouts have **more columns than rows**; 1×1 remains the baseline. The individual QR matrices remain square. This section specifies the retained v5 wire format; the current `WGCalibration.create({landscapeOnly:true,...})` emits v6 as described below. No existing plan is redefined: v1–v5 retain their original wire bytes, grid lists and profile indices, including portrait and square grids in older comparison plans.

The version field itself identifies the landscape restriction. CAL and SET add no flag bits. Their existing all-layout and quick-comparison flags select version-5 lists instead of the earlier lists, and remain mutually exclusive. The sender, parsed CAL, observer snapshot, accepted SET result and presentation model expose `landscapeOnly:true`; older versions expose `false`. Session and SET validation still require the exact version as well as the ID and all existing options.

| Version-5 scope | Options in addition to `landscapeOnly:true` | Grids | Basic / extended profiles |
| --- | --- | --- | --- |
| All landscape layouts | `allLayouts:true` | Ten grids in the table below | 60 / 100 |
| Quick comparison | `compareLayouts:true` | 1×1, 2×1, 3×1, 3×2, in this order | 24 / 40 |
| Current layout | `grid:{columns,rows}`; both comparison flags false | One valid landscape grid, or 1×1 | 6 / 10 |

For a current-layout trial, version 5 rejects portrait grids and square multi-QR grids instead of silently changing them. Column and row bounds remain 1–5 and 1–3. A comparison plan ignores the requested current grid, as in older versions. Omitting `grid` and both comparison flags selects the 1×1 baseline. `landscapeOnly` must be a boolean.

All-layout order remains increasing by symbol count, then columns and rows, after filtering out non-landscape multi-QR grids:

| Grid | Symbols | First basic profile | First extended profile |
| --- | --- | --- | --- |
| 1×1 | 1 | 0 | 0 |
| 2×1 | 2 | 6 | 10 |
| 3×1 | 3 | 12 | 20 |
| 4×1 | 4 | 18 | 30 |
| 5×1 | 5 | 24 | 40 |
| 3×2 | 6 | 30 | 50 |
| 4×2 | 8 | 36 | 60 |
| 5×2 | 10 | 42 | 70 |
| 4×3 | 12 | 48 | 80 |
| 5×3 | 15 | 54 | 90 |

The v5 parser retains this separate frozen ten-grid list; the current public `landscapeGrids` instead describes v6. `landscapeComparedGrids` exposes the frozen quick-comparison list shared by v5 and v6. Existing `allGrids` continues to expose all 15 v4 grids. The version-5 all-layout sender has `alignmentIndex` 54 or 90 and `alignmentLanes` 15; quick comparison has index 18 or 30 and six lanes. A current-layout trial starts at index zero. END names the last profile, 59/99 for all layouts or 23/39 for quick comparison, rather than any earlier version's final index.

V5 setup-preview codes are 40-byte headers, as in v4. Ordinary settling and measurement frames retain their full 424/640-byte length, or 476/692 bytes with `large:true`. Setup carries no measured data and never contributes coverage or throughput. Four-second windows, sequence-to-slot mapping, complete-coverage selection, late-frame handling and 32-bit SET rates are unchanged. The largest profile still has 1200 unique reads and a maximum synthetic useful rate of 180,000 B/s. A full all-layout run with one second of settling before each profile lasts nominally 300 or 500 seconds, plus the user-controlled initial setup.

The presentation model shows 60/100 cells for the full landscape plan or 24/40 for quick comparison. Initial setup leaves all cells pending; END closes the entire plan, including every unreadable multi-QR layout. Actual 40-byte setup dimensions remain separate from planned measurement dimensions. A version-5 grid may not be inferred by reusing an older profile index: for example, basic all-layout index 12 is 2×1 in v4 but 3×1 in v5, so the version, grid and profile must agree before a frame is accepted.

## Landscape calibration version 6: 5×4 and 20 symbols

The current `WGCalibration.create({landscapeOnly:true,...})` emits CAL/SET version 6. It appends **5×4** to the v5 all-layout list, preserving the order of the preceding ten grids. This is the only new four-row layout: current-layout trials still require either 1×1 or strictly more columns than rows, within five columns and four rows. Four rows with `landscapeOnly:false` are rejected rather than placed in an older protocol version. Comparison plans continue to ignore the requested current grid.

| Version-6 scope | Grids | Basic / extended profiles | Initial setup index / slots |
| --- | --- | --- | --- |
| `allLayouts:true` | The ten v5 grids followed by 5×4 | 66 / 110 | 60 or 100 / 20 slots |
| `compareLayouts:true` | 1×1, 2×1, 3×1, 3×2 | 24 / 40 | 18 or 30 / 6 slots |
| Current layout | One permitted grid, including 5×4 | 6 / 10 | 0 / selected grid area |

The new 5×4 group occupies basic indices 60–65 or extended indices 100–109. The all-layout END marker therefore names index 65 or 109. All profile durations remain four seconds; with the UI's one-second settling interval, the full plan lasts nominally **330 or 550 seconds**, plus the user-controlled initial setup. Quick-comparison durations and indices do not change.

`WGCalibration.landscapeGrids` is now a frozen list of eleven frozen grid objects. `landscapeComparedGrids` stays the same four-grid list. The frozen public `limits` object is `{columns:5,rows:4,lanes:20}`. `allGrids` intentionally remains the legacy v4 list of fifteen grids. The parser has separate version-specific plans: **v4 all-layout remains 90/150 profiles, v5 landscape all-layout remains 60/100, and every version from v1 through v5 rejects a fourth row**. A larger current grid registry does not expand any older wire format.

Version 6 adds no flag bits or header fields. It retains `landscapeOnly:true`, the mutually exclusive all-layout and quick-comparison flags, 40-byte setup headers, full-sized settling and measurement frames, and exact version/session/plan validation. A 5×4 setup has distinct slots 0–19. Its largest measurement profile has **1600 expected symbols** over four seconds, sequences **0–1599**, 80 display steps and 400 expected symbols per one-second window. At 600 useful bytes per symbol, its synthetic rate is **240,000 B/s**. The existing unsigned 16-bit sample count and unsigned 32-bit SET rate safely represent these values; a v6 sender does not accept a v5 SET.

The map renders 66/110 profiles for v6 all-layout trials. It keeps all 20 setup slots outside measurement statistics and shows actual 40-byte setup density separately from planned measurement density. END closes the full advertised plan, including every unreadable 5×4 profile. Older v5 snapshots continue to show ten layouts ending at 5×3.

The test fixture `development/tools/qr-calibration-v5-fixtures.json` records synthetic CAL setup/measurement/END and SET packets from the PR14 v5 implementation before v6 was added. It also records full-corpus hashes for current, all-layout and quick-comparison trials, allowing tests to verify old indices, parsing and exact receiver-produced SET bytes independently of the new default sender.

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
