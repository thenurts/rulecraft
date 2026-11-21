import { randomUUID } from 'node:crypto';
import { link, open, readFile, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { loadSnapshot } from '@rulecraft/simulation';

/**
 * Local single-writer checkpoint. Staging in the target directory keeps rename atomic.
 * The injectable hook lets the test interrupt the write immediately before promotion.
 */
export async function writeCheckpoint(path, current, previous, { create = false, beforePromote } = {}) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  const file = await open(temporary, 'wx', 0o600);
  try {
    try {
      await file.writeFile(JSON.stringify({ current, previous }), 'utf8');
      await file.sync();
    } finally {
      await file.close();
    }
    await beforePromote?.();
    if (create) await link(temporary, path);
    else await rename(temporary, path);
    if (process.platform !== 'win32') {
      const directory = await open(dirname(path), 'r');
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    }
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function readCheckpoint(path, decode = loadSnapshot) {
  const envelope = JSON.parse(await readFile(path, 'utf8'));
  const failures = [];
  for (const source of ['current', 'previous']) {
    const encoded = envelope?.[source];
    if (typeof encoded !== 'string') continue;
    try {
      return { snapshot: decode(encoded), encoded, source };
    } catch (error) {
      failures.push(error);
    }
  }
  throw new AggregateError(failures, 'No valid committed snapshot in checkpoint file.');
}
