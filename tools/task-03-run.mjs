import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { advanceSociety, auditSnapshot, encodeSociety, loadSociety, societyHashes } from '@rulecraft/simulation';
import { readCheckpoint, writeCheckpoint } from './task-01-file.mjs';
import { societyExample } from './task-03-scenario.mjs';

const fixture = JSON.parse(await readFile(new URL('../fixtures/task-01-village.json', import.meta.url), 'utf8'));
const directory = await mkdtemp(join(tmpdir(), 'rulecraft-society-'));
const timing = [];
function advance(game, turn) {
  while (game.state.turn < turn) {
    const start = performance.now();
    game = advanceSociety(game);
    timing.push(performance.now() - start);
  }
  return game;
}
try {
  const path = join(directory, 'society.json');
  const initial = societyExample(fixture);
  const five = advance(initial, 5);
  const six = advance(five, 6);
  const seven = advanceSociety(six);
  const encodedSix = encodeSociety(six);
  await writeCheckpoint(path, encodedSix, encodeSociety(five), { create: true });
  await assert.rejects(writeCheckpoint(path, encodeSociety(seven), encodedSix, {
    beforePromote() { throw new Error('interrupted before promotion'); },
  }), /interrupted before promotion/);
  const startLoad = performance.now();
  const restored = await readCheckpoint(path, loadSociety);
  const loadMs = performance.now() - startLoad;
  assert.equal(restored.snapshot.state.turn, 6);
  assert.equal(restored.encoded, encodedSix);

  const full = advance(six, 12);
  const replayed = advance(restored.snapshot, 12);
  assert.equal(encodeSociety(full), encodeSociety(replayed));
  const audit = auditSnapshot(replayed);
  const dispositions = replayed.societyDays.flatMap(({ patrol }) => patrol.investigations);
  assert.ok(dispositions.some(({ disposition }) => disposition === 'education'));
  assert.ok(dispositions.some(({ disposition }) => disposition === 'warning'));
  const daily = replayed.societyDays.map(({ turn, news, patrol, experiences, metrics }) => ({
    turn, learnedAtDawn: news.filter(({ type, noticeId }) => type === 'learning' && noticeId).length,
    learnedByChannel: ['bulletin', 'peer'].map((channel) =>
      news.filter((entry) => entry.type === 'learning' && entry.learnedFrom?.channel === channel).length),
    experiencedAttitudeUpdates: experiences.filter(({ component }) => component === 'exertion').length,
    patrols: patrol.presence.length, prohibitedActs: patrol.prohibitedActs.length,
    investigations: patrol.investigations.length,
    education: patrol.investigations.filter(({ disposition }) => disposition === 'education').length,
    warnings: patrol.investigations.filter(({ disposition }) => disposition === 'warning').length,
    food: metrics.food, compliance: metrics.compliance,
  }));
  const withHistory = encodeSociety(replayed);
  const totalEvents = replayed.events.length + replayed.societyDays.reduce((sum, day) =>
    sum + day.news.length + day.experiences.length + day.allocations.length + day.patrol.investigations.length +
    day.patrol.presence.length + day.patrol.prohibitedActs.length, 0);
  const ranges = (values) => ({ min: Math.min(...values), max: Math.max(...values) });
  console.log(JSON.stringify({
    seed: replayed.seed, turn: replayed.state.turn, hashes: societyHashes(replayed), audit, daily,
    trust: ranges(replayed.state.citizens.map(({ trust }) => trust)),
    hunger: ranges(replayed.state.citizens.map(({ hunger }) => hunger)),
    attitudes: { records: replayed.attitudes.length, ...ranges(replayed.attitudes.map(({ score }) => score)) },
    storage: { villageEvents: replayed.events.length, totalEventRecords: totalEvents,
      day6TwoSnapshotFileBytes: (await stat(path)).size, day12PayloadBytes: Buffer.byteLength(withHistory) },
  }, null, 2));
  timing.sort((a, b) => a - b);
  console.error(JSON.stringify({ day6LoadMs: Math.round(loadMs * 100) / 100, samples: timing.length,
    turnMedianMs: Math.round(timing[Math.floor(timing.length / 2)] * 100) / 100 }));
} finally {
  await rm(directory, { recursive: true, force: true });
}
