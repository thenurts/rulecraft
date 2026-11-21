import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { authoritativeLaws, startLawGame, villageScope } from '@rulecraft/simulation';
import fixture from '../fixtures/task-01-village.json';
import { commitLawCommand, commitLawNotice, commitLawTurn, createLawCheckpoint, readLawCheckpoint } from './task-02-file.mjs';

const command = {
  operation: 'CREATE', commandId: 'confirm-harvest', lawId: 'harvest',
  ast: { ...villageScope, actionId: 'harvest-food', targetSelector: 'farmer', modality: 'MUST', priority: 0 },
};

test('interrupted confirmation keeps the old save; confirmed law and notice survive close before advancement', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rulecraft-law-checkpoint-'));
  const path = join(dir, 'village.json');
  try {
    const game = startLawGame(fixture, 42);
    await createLawCheckpoint(path, game);
    await expect(commitLawCommand(path, command, {
      beforePromote() { throw new Error('interrupted before confirmation'); },
    })).rejects.toThrow('interrupted before confirmation');
    expect((await readLawCheckpoint(path)).snapshot).toEqual(game);
    await commitLawCommand(path, command);
    const committed = await readLawCheckpoint(path);
    expect(committed.snapshot.state).toEqual(game.state);
    expect(committed.snapshot.state.turn).toBe(0);
    expect(authoritativeLaws(committed.snapshot.book, 0)).toHaveLength(0);
    expect(authoritativeLaws(committed.snapshot.book, 1)).toMatchObject([{ lawId: 'harvest', version: 1 }]);
    await commitLawCommand(path, command);
    expect((await readLawCheckpoint(path)).encoded).toBe(committed.encoded);
    await commitLawNotice(path, 'citizen.0001', 'harvest', 1);
    expect((await readLawCheckpoint(path)).snapshot.book.notices).toHaveLength(1);
    await commitLawTurn(path);
    const advanced = (await readLawCheckpoint(path)).snapshot;
    expect(advanced.state.turn).toBe(1);
    expect(advanced.book.versions[0].commandId).toBe(command.commandId);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
