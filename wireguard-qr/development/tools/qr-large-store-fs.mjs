// Disk-backed OPFS-shaped fixture. No full-file Blob or eager file materialization.
import { open, stat, mkdir, readdir, rename, unlink, rm } from 'node:fs/promises';
import { dirname, basename, join } from 'node:path';

const locksByPath = new Map();
let serial = 0;
const notFound = () => new DOMException('Missing file', 'NotFoundError');
const normalise = error => error?.code === 'ENOENT' ? notFound() : error;
const validName = name => typeof name === 'string' && name !== '.' && name !== '..' && name.length && !/[\\/\0]/.test(name);
const makeAudit = () => ({ reads: [], writes: [], closes: [], aborts: [], removes: [], getFiles: [] });

export async function openDiskFile(path, { audit = makeAudit(), faults = {} } = {}) {
  const details = await stat(path);
  return new DiskFile(path, 0, details.size, details.mtimeMs, audit, faults);
}

export class DiskFile {
  constructor(path, start, size, modified, audit = makeAudit(), faults = {}) {
    this.path = path; this.start = start; this.size = size; this.lastModified = modified;
    this.name = basename(path); this.type = this.name.endsWith('.zip') ? 'application/zip' : 'application/octet-stream';
    this.audit = audit; this.faults = faults;
  }
  slice(start = 0, end = this.size) {
    const clamp = value => Math.min(this.size, Math.max(0, value < 0 ? this.size + value : value));
    const from = clamp(start), to = Math.max(from, clamp(end));
    return new DiskFile(this.path, this.start + from, to - from, this.lastModified, this.audit, this.faults);
  }
  async arrayBuffer() {
    await this.faults.before?.({ op: 'read', path: this.path, bytes: this.size, offset: this.start });
    this.audit.reads.push({ path: this.path, bytes: this.size, offset: this.start });
    if (this.size > 2 * 1024 * 1024) throw new Error('Fixture forbids materializing more than one 2 MiB segment.');
    const bytes = new Uint8Array(this.size);
    const handle = await open(this.path, 'r').catch(error => { throw normalise(error); });
    try {
      let offset = 0;
      while (offset < bytes.length) {
        const result = await handle.read(bytes, offset, bytes.length - offset, this.start + offset);
        if (!result.bytesRead) return bytes.slice(0, offset).buffer;
        offset += result.bytesRead;
      }
      return bytes.buffer;
    } finally { await handle.close(); }
  }
  async text() { return new TextDecoder().decode(await this.arrayBuffer()); }
  stream() {
    let offset = 0;
    const file = this;
    return new ReadableStream({
      async pull(controller) {
        if (offset >= file.size) { controller.close(); return; }
        const part = new Uint8Array(await file.slice(offset, Math.min(file.size, offset + 256 * 1024)).arrayBuffer());
        offset += part.length;
        controller.enqueue(part);
      }
    });
  }
}

export async function createDiskBackend(path) {
  await mkdir(path, { recursive: true });
  const audit = makeAudit();
  const faults = {};
  let estimate = null;
  let persistent = false;
  const before = async event => { await faults.before?.(event); };
  class Directory {
    constructor(path) { this.path = path; this.name = basename(path); this.kind = 'directory'; }
    async getDirectoryHandle(name, { create = false } = {}) {
      if (!validName(name)) throw new TypeError('Invalid path component');
      const child = join(this.path, name);
      try {
        if (create) await mkdir(child, { recursive: true });
        if (!(await stat(child)).isDirectory()) throw new TypeError('Not a directory');
      } catch (error) { throw normalise(error); }
      return new Directory(child);
    }
    async getFileHandle(name, { create = false } = {}) {
      if (!validName(name)) throw new TypeError('Invalid path component');
      const child = join(this.path, name);
      try {
        if (create) { const file = await open(child, 'a'); await file.close(); }
        if (!(await stat(child)).isFile()) throw new TypeError('Not a file');
      } catch (error) { throw normalise(error); }
      return new FileHandle(child);
    }
    async *entries() {
      for (const item of await readdir(this.path, { withFileTypes: true })) {
        if (item.name.startsWith('.write-')) continue;
        yield [item.name, item.isDirectory() ? new Directory(join(this.path, item.name)) : new FileHandle(join(this.path, item.name))];
      }
    }
    async removeEntry(name, { recursive = false } = {}) {
      if (!validName(name)) throw new TypeError('Invalid path component');
      const child = join(this.path, name);
      await before({ op: 'remove', path: child });
      audit.removes.push(child);
      try {
        const details = await stat(child);
        if (details.isDirectory()) await rm(child, { recursive, force: false });
        else await unlink(child);
      } catch (error) { throw normalise(error); }
    }
  }
  class FileHandle {
    constructor(path) { this.path = path; this.name = basename(path); this.kind = 'file'; }
    async getFile() {
      await before({ op: 'getFile', path: this.path });
      audit.getFiles.push(this.path);
      try { return await openDiskFile(this.path, { audit, faults }); }
      catch (error) { throw normalise(error); }
    }
    async createWritable({ keepExistingData = false } = {}) {
      if (keepExistingData) throw new Error('The store must not copy an existing full file before writing.');
      await before({ op: 'createWritable', path: this.path });
      const target = this.path;
      const temporary = join(dirname(target), `.write-${++serial}`);
      const file = await open(temporary, 'wx');
      let stopped = false, offset = 0;
      return {
        async write(value) {
          if (stopped) throw new DOMException('Stream closed', 'InvalidStateError');
          const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
          await before({ op: 'write', path: target, bytes: bytes.byteLength, offset });
          if (stopped) throw new DOMException('Stream closed', 'InvalidStateError');
          audit.writes.push({ path: target, bytes: bytes.byteLength, offset });
          let written = 0;
          while (written < bytes.byteLength) {
            const result = await file.write(bytes, written, bytes.byteLength - written, offset + written);
            written += result.bytesWritten;
          }
          offset += written;
        },
        async close() {
          if (stopped) throw new DOMException('Stream closed', 'InvalidStateError');
          await before({ op: 'close', path: target, bytes: offset });
          if (stopped) throw new DOMException('Stream aborted', 'InvalidStateError');
          await file.sync();
          await file.close();
          await rename(temporary, target);
          stopped = true;
          audit.closes.push({ path: target, bytes: offset });
        },
        async abort() {
          if (stopped) return;
          stopped = true;
          await before({ op: 'abort', path: target });
          await file.close().catch(() => {});
          await unlink(temporary).catch(() => {});
          audit.aborts.push(target);
        }
      };
    }
  }
  const backend = {
    audit, faults,
    storage: {
      async getDirectory() { return new Directory(path); },
      async estimate() { return estimate || {}; },
      async persisted() { return persistent; }
    },
    locks: {
      async request(name, options, callback) {
        if (options.mode !== 'exclusive' || !options.ifAvailable) throw new Error('Only bounded exclusive locks are supported.');
        const key = `${path}:${name}`;
        if (locksByPath.has(key)) return callback(null);
        const token = {};
        locksByPath.set(key, token);
        try { return await callback({ name, mode: 'exclusive' }); }
        finally { if (locksByPath.get(key) === token) locksByPath.delete(key); }
      }
    },
    setEstimate(value) { estimate = value; },
    setPersistent(value) { persistent = value; }
  };
  return backend;
}
