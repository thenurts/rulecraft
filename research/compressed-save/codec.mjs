// Runtime boundary used only by the benchmark and research store.
export function researchWorker() {
  const worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
  let sequence = 0;
  const active = new Map();
  let closed = false;
  worker.onmessage = ({ data }) => {
    const request = active.get(data.id);
    if (!request) return;
    active.delete(data.id);
    if (data.error) request.reject(new Error(data.error));
    else {
      const roundTripMs = performance.now() - request.start;
      request.resolve({ result: data.result, stages: { ...data.stages, roundTripMs, postMs: request.postMs,
        workerTransportAndSchedulingMs: Math.max(0, roundTripMs - data.workerMs) } });
    }
  };
  function stop(error) {
    closed = true;
    worker.terminate();
    for (const request of active.values()) request.reject(error);
    active.clear();
  }
  worker.onerror = () => stop(new Error('Research worker stopped.'));
  worker.onmessageerror = () => stop(new Error('Research worker reply could not be read.'));
  return {
    call(operation, data, gzip) {
      if (closed) return Promise.reject(new Error('Research worker closed.'));
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        const request = { start: performance.now(), resolve, reject, postMs: 0 };
        active.set(id, request);
        try {
          // IndexedDB reads return fresh binary data. A sole owner can transfer it.
          const transfer = operation === 'decode' && data?.bytes instanceof ArrayBuffer ? [data.bytes] : [];
          worker.postMessage({ id, operation, data, gzip }, transfer);
          request.postMs = performance.now() - request.start;
        } catch (error) {
          active.delete(id);
          reject(error);
        }
      });
    },
    close: () => stop(new Error('Research worker closed.')),
  };
}
