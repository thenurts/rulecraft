import {
  advanceLawGame, confirmLaw, encodeLawGame, loadLawGame, notifyLaw,
} from '@rulecraft/simulation';
import { readCheckpoint, writeCheckpoint } from './task-01-file.mjs';

export function createLawCheckpoint(path, game) {
  return writeCheckpoint(path, encodeLawGame(game), null, { create: true });
}

export function readLawCheckpoint(path) {
  return readCheckpoint(path, loadLawGame);
}

async function commit(path, change, options) {
  const previous = await readLawCheckpoint(path);
  const result = change(previous.snapshot);
  if (result.game !== previous.snapshot) {
    await writeCheckpoint(path, encodeLawGame(result.game), previous.encoded,
      { beforePromote: options?.beforePromote });
  }
  return result;
}

export function commitLawCommand(path, command, options) {
  return commit(path, (game) => confirmLaw(game, command), options);
}

export function commitLawNotice(path, citizenId, lawId, version) {
  return commit(path, (game) => ({ game: notifyLaw(game, citizenId, lawId, version) }));
}

export function commitLawTurn(path) {
  return commit(path, (game) => ({ game: advanceLawGame(game) }));
}
