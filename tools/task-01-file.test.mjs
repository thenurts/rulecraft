import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { encodeSnapshot, resolveNextTurn, snapshotHashes, startVillage } from '@rulecraft/simulation';
import input from '../fixtures/task-01-village.json';
import { readCheckpoint, writeCheckpoint } from './task-01-file.mjs';

const genesis = startVillage(input, 42);
const dayOne = resolveNextTurn(genesis);
const dayTwo = resolveNextTurn(dayOne);
const previous = encodeSnapshot(dayOne);
const current = encodeSnapshot(dayTwo);

test('an interrupted disk write exposes the old whole turn; retry promotes the next whole turn', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rulecraft-checkpoint-'));
  const path = join(directory, 'checkpoint.json');
  try {
    await writeCheckpoint(path, previous, encodeSnapshot(genesis), { create: true });
    await expect(writeCheckpoint(path, current, previous, { create: true })).rejects.toMatchObject({ code: 'EEXIST' });
    await expect(writeCheckpoint(path, current, previous, {
      beforePromote() { throw new Error('interrupted before rename'); },
    })).rejects.toThrow('interrupted before rename');
    expect(await readdir(directory)).toEqual(['checkpoint.json']);
    const old = await readCheckpoint(path);
    expect(old.source).toBe('current');
    expect(snapshotHashes(old.snapshot)).toEqual(snapshotHashes(dayOne));

    await writeCheckpoint(path, current, previous);
    const next = await readCheckpoint(path);
    expect(next.source).toBe('current');
    expect(snapshotHashes(next.snapshot)).toEqual(snapshotHashes(dayTwo));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a damaged current payload falls back to the independently verified prior turn', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rulecraft-recovery-'));
  const path = join(directory, 'checkpoint.json');
  try {
    await writeFile(path, JSON.stringify({ current: current.slice(0, -15), previous }));
    const restored = await readCheckpoint(path);
    expect(restored.source).toBe('previous');
    expect(snapshotHashes(restored.snapshot)).toEqual(snapshotHashes(dayOne));
    await writeFile(path, JSON.stringify({ current: 'invalid', previous: null }));
    await expect(readCheckpoint(path)).rejects.toThrow(/No valid committed snapshot/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
