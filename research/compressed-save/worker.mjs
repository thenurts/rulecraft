import { runCodec } from './format.mjs';

self.onmessage = async ({ data: { id, operation, data, gzip } }) => {
  const start = performance.now();
  try {
    const result = await runCodec(operation, data, gzip);
    const transfer = operation === 'encode' && typeof result.result !== 'string' ? [result.result.bytes] : [];
    self.postMessage({ id, ...result, workerMs: performance.now() - start }, transfer);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
