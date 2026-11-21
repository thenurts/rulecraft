import { encodeSociety, loadSociety } from '@rulecraft/simulation';

export const envelopeVersion = 1;
const maxBytes = 64 * 1024 * 1024;
const tag = 'rulecraft-storage';
const checksumOf = (payload) => {
  const checksum = /^\{"checksum":"([\da-f]{16})","snapshot":/.exec(payload)?.[1];
  if (!checksum) throw new Error('Invalid canonical snapshot header.');
  return checksum;
};

export function gzipAvailable(facilities = globalThis) {
  return typeof facilities.CompressionStream === 'function' && typeof facilities.DecompressionStream === 'function';
}

export async function pack(payload, preferGzip, facilities = globalThis) {
  if (!preferGzip || !gzipAvailable(facilities)) return payload;
  const canonical = new TextEncoder().encode(payload);
  if (canonical.byteLength > maxBytes) throw new Error('Snapshot exceeds research format limit.');
  const bytes = await new Response(new Blob([canonical]).stream()
    .pipeThrough(new facilities.CompressionStream('gzip'))).arrayBuffer();
  return { tag, version: envelopeVersion, algorithm: 'gzip', canonicalBytes: canonical.byteLength,
    checksum: checksumOf(payload), bytes };
}

export async function unpack(payload, facilities = globalThis) {
  if (typeof payload === 'string') return payload;
  if (payload?.tag !== tag || payload.version !== envelopeVersion || payload.algorithm !== 'gzip') {
    throw new Error('Unsupported compressed storage format.');
  }
  if (!(payload.bytes instanceof ArrayBuffer) || !Number.isSafeInteger(payload.canonicalBytes) ||
      payload.canonicalBytes <= 0 || payload.canonicalBytes > maxBytes || payload.bytes.byteLength > maxBytes) {
    throw new Error('Invalid compressed payload.');
  }
  if (typeof facilities.DecompressionStream !== 'function') throw new Error('Gzip decoder unavailable.');
  const reader = new Blob([payload.bytes]).stream().pipeThrough(new facilities.DecompressionStream('gzip')).getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let length = 0;
  let decoded = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > payload.canonicalBytes) throw new Error('Decompressed payload exceeds declared length.');
      decoded += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  decoded += decoder.decode();
  if (length !== payload.canonicalBytes || checksumOf(decoded) !== payload.checksum) {
    throw new Error('Compressed snapshot length or checksum differs.');
  }
  return decoded;
}

export async function runCodec(operation, data, gzip, facilities = globalThis) {
  const start = performance.now();
  if (operation === 'encode') {
    const canonical = encodeSociety(data);
    const encodeMs = performance.now() - start;
    const began = performance.now();
    const result = await pack(canonical, gzip, facilities);
    return { result, stages: { encodeMs, compressMs: typeof result === 'string' ? 0 : performance.now() - began } };
  }
  const canonical = await unpack(data, facilities);
  const decompressMs = typeof data === 'string' ? 0 : performance.now() - start;
  const began = performance.now();
  const result = loadSociety(canonical);
  return { result, stages: { decompressMs, verifyMs: performance.now() - began } };
}
