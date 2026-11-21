import { BrowserDatabase, SaveConflict } from '../../apps/web/src/save-store.ts';

const key = 'village';
const empty = { revision: 0, generation: null, session: null, recovered: false };
const validGeneration = (entry, revision) => entry && typeof entry.id === 'string' &&
  ['junior', 'full'].includes(entry.mode) && ['campaign', 'sandbox'].includes(entry.track) &&
  Number.isSafeInteger(entry.at) && entry.at >= 1 && entry.at <= revision;

export function openResearchDatabase(name) {
  if (!name.startsWith('rulecraft-save-research-')) throw new Error('Research database prefix required.');
  return new BrowserDatabase(name);
}

export function saveStore(database, codec, { gzip = false, observe = () => {}, inject } = {}) {
  return {
    async load() {
      const start = performance.now();
      const head = await database.request('world', 'readonly', (store) => store.get(key));
      const readMs = performance.now() - start;
      if (!head) return empty;
      if (!Number.isSafeInteger(head.revision) || head.revision < 1) throw new Error('Invalid research save revision.');
      const errors = [];
      for (const [index, record] of [head.current, head.previous].entries()) {
        if (!validGeneration(record, head.revision)) continue;
        try {
          const { result: game, stages } = await codec.call('decode', record.payload, gzip);
          observe('load', { readMs, ...stages, totalMs: performance.now() - start });
          return { revision: head.revision, generation: record.at, recovered: index === 1,
            session: { id: record.id, mode: record.mode, track: record.track, game } };
        } catch (error) {
          errors.push(error.message);
        }
      }
      throw new Error(`No verified generation in research save. ${errors.join(' ')}`);
    },
    async commit(expected, session) {
      const start = performance.now();
      const { result: payload, stages } = await codec.call('encode', session.game, gzip);
      const db = await database.open();
      const beginWrite = performance.now();
      const revision = expected.revision + 1;
      const current = { id: session.id, mode: session.mode, track: session.track, at: revision, payload };
      let readBeforeWriteMs;
      await new Promise((resolve, reject) => {
        const tx = db.transaction('world', 'readwrite', { durability: 'strict' });
        let error;
        tx.oncomplete = resolve;
        tx.onabort = () => reject(error ?? tx.error ?? new Error('Interrupted research save.'));
        const store = tx.objectStore('world');
        const reading = store.get(key);
        reading.onsuccess = () => {
          readBeforeWriteMs = performance.now() - beginWrite;
          const head = reading.result;
          try {
            if ((head?.revision ?? 0) !== expected.revision) throw new SaveConflict();
            const previous = [head?.current, head?.previous].find((entry) => entry && entry.at === expected.generation) ?? null;
            if (head && !previous) throw new Error('Last verified generation is missing.');
            store.put({ revision, current, previous }, key);
            inject?.(tx);
          } catch (failure) {
            error = failure;
            tx.abort();
          }
        };
      });
      const idbMs = performance.now() - beginWrite;
      observe('save', { ...stages, idbMs, readBeforeWriteMs, commitAfterReadMs: idbMs - readBeforeWriteMs,
        totalMs: performance.now() - start, bytes: typeof payload === 'string' ? payload.length : payload.bytes.byteLength });
      return { revision, generation: revision, recovered: false, session };
    },
  };
}
