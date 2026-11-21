import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  advanceLawGame, auditSnapshot, authoritativeLaws, confirmLaw, encodeLawGame,
  lawGameHashes, loadLawGame, notifyLaw, startLawGame, villageScope,
} from '@rulecraft/simulation';
import { commitLawCommand, createLawCheckpoint, readLawCheckpoint } from './task-02-file.mjs';

const fixture = JSON.parse(await readFile(new URL('../fixtures/task-01-village.json', import.meta.url), 'utf8'));
const lawId = 'harvest';
const command = (modality) => ({
  operation: 'CREATE', commandId: 'create-harvest', lawId,
  ast: { ...villageScope, targetSelector: 'farmer', actionId: 'harvest-food', modality },
});
function notifyFarmers(game) {
  for (const actor of game.state.citizens.filter(({ occupation }) => occupation === 'farmer')) {
    game = notifyLaw(game, actor.id, lawId, 1);
  }
  return game;
}
function finish(game, turn = 12) {
  while (game.state.turn < turn) game = advanceLawGame(game);
  return game;
}
function harvestUnits(game) {
  return game.transactions.filter(({ reason }) => reason === 'harvest-food')
    .reduce((sum, { legs }) => sum + legs[0].quantity, 0);
}

const matchedSeeds = 64;
const units = { baseline: 0, MUST: 0, MUST_NOT: 0, MAY: 0 };
for (let seed = 0; seed < matchedSeeds; seed++) {
  const initial = startLawGame(fixture, seed);
  units.baseline += harvestUnits(finish(initial, 1));
  for (const modality of ['MUST', 'MUST_NOT', 'MAY']) {
    const game = notifyFarmers(confirmLaw(initial, command(modality)).game);
    units[modality] += harvestUnits(finish(game, 1));
  }
}
assert.ok(units.MUST > units.baseline && units.MUST_NOT < units.baseline);
assert.equal(units.MAY, units.baseline);

const directory = await mkdtemp(join(tmpdir(), 'rulecraft-law-demo-'));
try {
  const path = join(directory, 'checkpoint.json');
  await createLawCheckpoint(path, startLawGame(fixture, 42));
  await commitLawCommand(path, command('MUST'));
  const { snapshot } = await readLawCheckpoint(path);
  assert.equal(snapshot.state.turn, 0);
  assert.equal(authoritativeLaws(snapshot.book, 0).length, 0);
  assert.equal(authoritativeLaws(snapshot.book, 1)[0].lawId, lawId);
  const informed = notifyFarmers(snapshot);
  const six = finish(informed, 6);
  const suspended = confirmLaw(six, { operation: 'SUSPEND', lawId, commandId: 'suspend-harvest' }).game;
  const uninterrupted = finish(suspended);
  const resumed = finish(loadLawGame(encodeLawGame(suspended)));
  assert.equal(encodeLawGame(resumed), encodeLawGame(uninterrupted));
  const hashes = lawGameHashes(resumed);
  assert.deepEqual(hashes, { state: '6d3f0260b1cde92c', events: 'a9114ded8e11a629' });
  const evidence = resumed.events.find(({ turn, actorId, legalChoice }) =>
    turn === 7 && actorId === 'citizen.0001' && legalChoice)?.legalChoice[0];
  assert.equal(evidence?.actual.status, 'optional');
  assert.equal(evidence?.perceived.status, 'required');

  console.log(JSON.stringify({
    matchedSeeds, dayOneHarvestUnits: units,
    replay: {
      seed: resumed.seed, turn: resumed.state.turn, hashes,
      audit: auditSnapshot(resumed),
      daySeven: { actual: evidence.actual.status, perceived: evidence.perceived.status },
    },
  }, null, 2));
} finally {
  await rm(directory, { recursive: true, force: true });
}
