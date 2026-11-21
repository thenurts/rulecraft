import {
  advanceSociety, auditSnapshot, confirmLaw, encodeSociety, loadSociety, societyHashes, startSociety, startSocietyV3, villageScope,
} from '@rulecraft/simulation';
import fixture from '../../fixtures/task-01-village.json' with { type: 'json' };
import { deviceDraftStore } from '../../apps/web/src/draft-store.ts';
import { inquiryEvidence } from '../../apps/web/src/evidence.ts';
import { projectNarrative } from '../../apps/web/src/narrative/projection.ts';
import { buildShareCard, cardAsText, renderSharePng } from '../../apps/web/src/narrative/share.ts';
import { societyExample } from '../../tools/task-03-scenario.mjs';
import { completedCompetingDutiesDay } from '../../tests/fixtures/task-05-competing-duties.ts';
import { researchWorker } from './codec.mjs';
import { pack, runCodec, unpack } from './format.mjs';
import { openResearchDatabase, saveStore } from './store.mjs';

const localCodec = { call: (operation, data, gzip) => runCodec(operation, data, gzip, {}) };
const context = (suffix, options, codec = researchWorker()) => {
  const db = openResearchDatabase(`rulecraft-save-research-${suffix}`);
  return { db, codec, store: saveStore(db, codec, options), drafts: deviceDraftStore(db) };
};
const head = (db) => db.request('world', 'readonly', (store) => store.get('village'));
const put = (db, world) => db.request('world', 'readwrite', (store) => store.put(world, 'village'));
const session = (game) => ({ id: 'research-fixture', mode: 'full', track: 'sandbox', game });
const draft = { commandId: 'research-draft', lawId: null, baseVersion: null, wording: { targetSelector: 'farmer' } };
const same = (a, b, name) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${name} differs.`);
};
function check(value, message) {
  if (!value) throw new Error(message);
}
async function rejects(action, message) {
  try { await action(); } catch (error) {
    check(message.test(error.message), `Unexpected error: ${error.message}`);
    return;
  }
  throw new Error('Operation should have failed.');
}

function advance(game, day) {
  while (game.state.turn < day) game = advanceSociety(game);
  return game;
}

async function faultChecks() {
  const { db, codec, store, drafts } = context('faults', { gzip: true });
  try {
    const initial = startSociety(fixture, 42);
    const first = advance(initial, 1);
    const second = advance(first, 2);
    const legacy = saveStore(db, codec);
    let token = await legacy.commit(await legacy.load(), session(initial));
    token = await legacy.commit(token, session(first));
    const original = await head(db);
    same(typeof original.current.payload, 'string', 'legacy payload');
    await drafts.put('research-fixture', draft);
    await rejects(() => saveStore(db, codec, { gzip: true, inject: () => {
      throw new DOMException('Injected quota abort', 'QuotaExceededError');
    } }).commit(token, session(second)), /Injected quota/);
    same(await head(db), original, 'interrupted legacy-to-binary commit');
    same(await drafts.load('research-fixture'), draft, 'draft after quota');
    await rejects(() => saveStore(db, codec, { gzip: true, inject: (tx) => tx.abort() })
      .commit(token, session(second)), /Interrupted/);
    same(await head(db), original, 'explicit abort');

    const committed = await store.commit(token, session(second));
    const mixed = await head(db);
    same(typeof mixed.previous.payload, 'string', 'legacy last good preserved');
    same(await unpack(mixed.current.payload), encodeSociety(second), 'binary canonical bytes');
    const noGzip = saveStore(db, localCodec, { gzip: true });
    const unsupported = await noGzip.load();
    check(unsupported.recovered && unsupported.generation === token.generation, 'No-gzip fallback should recover exact old data.');
    same(encodeSociety(unsupported.session.game), encodeSociety(first), 'no-gzip checkpoint');
    const alternatives = [
      [{ bytes: mixed.current.payload.bytes.slice(0, 10) }, 'truncated gzip'],
      [{ checksum: '0000000000000000' }, 'outer checksum'],
      [{ version: 999 }, 'unsupported version'],
      [{ algorithm: 'unknown' }, 'unsupported algorithm'],
      [{ canonicalBytes: 10 }, 'expansion length'],
    ];
    for (const [patch, name] of alternatives) {
      await put(db, { ...mixed, current: { ...mixed.current, payload: { ...mixed.current.payload, ...patch } } });
      const recovered = await store.load();
      check(recovered.recovered && recovered.generation === token.generation, name);
      same(encodeSociety(recovered.session.game), encodeSociety(first), `${name} recovery`);
    }
    const badEngine = encodeSociety(second).replace('"turn":2', '"turn":1');
    await put(db, { ...mixed, current: { ...mixed.current, payload: await pack(badEngine, true) } });
    check((await store.load()).recovered, 'Inner checksum mismatch should recover.');
    await put(db, { ...mixed, current: { ...mixed.current, payload: { tag: 'partially-converted' } } });
    const recovery = await store.load();
    const repaired = await store.commit(recovery, session(second));
    same((await head(db)).previous.payload, original.current.payload, 'repair keeps verified previous');
    await rejects(() => store.commit(committed, session(second)), /changed in another tab/);
    check(repaired.revision > committed.revision, 'repair increments revision');
    same(await drafts.load('research-fixture'), draft, 'draft after repair');
    await put(db, { ...mixed, previous: null });
    await rejects(() => noGzip.load(), /Gzip decoder unavailable/);
    const raw = await localCodec.call('encode', second, true);
    same(raw.result, encodeSociety(second), 'no-gzip legacy write');
    same(await unpack(raw.result, {}), raw.result, 'legacy read without streams');
    return { checked: ['legacy bytes', 'quota abort', 'explicit abort', 'independent draft', 'mixed generations',
      'truncated gzip', 'outer checksum', 'inner checksum', 'version and algorithm', 'expanded length', 'missing streams',
      'partial conversion', 'repair', 'stale generation'] };
  } finally { codec.close(); }
}

async function provenance() {
  const { db, codec, store } = context('history', { gzip: true });
  try {
    const versions = [];
    let token = await store.load();
    for (const start of [startSocietyV3, startSociety]) {
      const initial = societyExample(fixture, start);
      const example = advance(initial, 6);
      const uninterrupted = advance(initial, 12);
      token = await store.commit(token, session(example));
      const raw = (await head(db)).current.payload;
      same(await unpack(raw), encodeSociety(example), 'decompressed source bytes');
      const restored = await store.load();
      const resumed = advance(restored.session.game, 12);
      same(encodeSociety(resumed), encodeSociety(uninterrupted), 'continued canonical history');
      same(auditSnapshot(resumed), auditSnapshot(uninterrupted), 'ledger audit');
      const original = projectNarrative(uninterrupted, 'full');
      const chronology = projectNarrative(resumed, 'full');
      same(chronology, original, 'Chronicle and narrative template IDs');
      let links = 0;
      for (const incident of chronology.incidents) {
        const decreeIds = incident.lawVersionRefs.map((ref) => resumed.book.versions
          .find(({ lawId, version }) => ref.lawId === lawId && ref.version === version)?.eventId);
        for (const id of [...incident.witnessEventIds, ...incident.relatedEventIds, ...decreeIds]) {
          check(id && inquiryEvidence(resumed, id), `Missing Inquiry witness ${id}`);
          same(inquiryEvidence(resumed, id), inquiryEvidence(uninterrupted, id), 'Inquiry evidence');
          links++;
        }
      }
      versions.push({ version: initial.versions.schemaVersion, hashes: societyHashes(resumed), incidents: chronology.incidents.length, links });
    }
    let duties = completedCompetingDutiesDay();
    duties = advanceSociety(confirmLaw(duties, { operation: 'ABOLISH', lawId: 'harvest-food', commandId: 'archive-harvest' }).game);
    await store.commit(token, session(duties));
    const restored = (await store.load()).session.game;
    const incident = projectNarrative(duties, 'full').incidents.find(({ facts, turn }) =>
      facts.family === 'COMPETING_KNOWN_DUTIES' && turn === 1);
    const original = buildShareCard(duties, 'full', incident.id);
    const reopened = buildShareCard(restored, 'full', incident.id);
    same(cardAsText(reopened), cardAsText(original), 'share-card source text');
    check(reopened.sections[0].paragraphs.length === 2, 'Both statute versions must survive.');
    const canvas = () => document.createElement('canvas');
    const pngA = await renderSharePng(canvas(), original);
    const pngB = await renderSharePng(canvas(), reopened);
    const a = new Uint8Array(await pngA.arrayBuffer());
    const b = new Uint8Array(await pngB.arrayBuffer());
    check(a.length === b.length && a.every((value, index) => value === b[index]), 'PNG bytes differ.');
    const view = new DataView(a.buffer);
    check(view.getUint32(16) === 1080 && view.getUint32(20) === 1350, 'PNG shape differs');
    same([...a.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'PNG signature');
    return { versions, pngBytes: a.byteLength, shareText: cardAsText(reopened) };
  } finally { codec.close(); }
}

const tabs = new Map();
async function tabOpen(name, seed) {
  const active = context(name, { gzip: true });
  const opening = await active.store.load();
  active.token = opening.session ? opening : await active.store.commit(opening, session(startSociety(fixture, seed)));
  tabs.set(name, active);
  return active.token.revision;
}
async function tabAdvance(name) {
  const active = tabs.get(name);
  try {
    active.token = await active.store.commit(active.token, session(advanceSociety(active.token.session.game)));
    return { committed: true, revision: active.token.revision };
  } catch (error) {
    return { committed: false, error: error.message };
  }
}

function performanceFixture(horizon) {
  const policy = { changesPerTurn: null, mustWeight: 60, mustNotWeight: 55 };
  let game = startSociety({ ...fixture, days: horizon }, 42, undefined, policy);
  for (const [targetSelector, actionId] of [
    ['farmer', 'harvest-food'], ['forester', 'cut-timber'], ['merchant', 'market-delivery'], ['guard', 'patrol'], ['all-citizens', 'rest'],
  ]) {
    for (const value of [0, 20, 40, 60, 80]) {
      const lawId = `benchmark-${actionId}-${value}`;
      game = confirmLaw(game, { operation: 'CREATE', lawId, commandId: `confirm-${lawId}`,
        ast: { ...villageScope, targetSelector, actionId, modality: 'MUST', when: { operand: 'fatigue', operator: 'GTE', value } } }).game;
    }
  }
  const previous = advance(game, horizon - 1);
  return { previous, current: advanceSociety(previous) };
}
const LongTasks = globalThis.PerformanceObserver?.supportedEntryTypes.includes('longtask');
const longTasks = [];
const recordTasks = (entries) => longTasks.push(...entries.map(({ startTime, duration }) => ({ startTime, duration })));
const taskObserver = LongTasks ? new PerformanceObserver((list) => recordTasks(list.getEntries())) : null;
taskObserver?.observe({ type: 'longtask', buffered: true });

async function benchmark(horizon, samples) {
  const { previous, current } = performanceFixture(horizon);
  auditSnapshot(current);
  const expected = encodeSociety(current);
  const cases = [false, true].map((gzip) => {
    const measurements = { save: [], load: [] };
    const active = context(`bench-${horizon}-${gzip}`, { gzip, observe: (kind, row) => measurements[kind].push(row) });
    return { ...active, gzip, measurements };
  });
  try {
    for (const branch of cases) {
      branch.token = await branch.store.commit(await branch.store.load(), session(previous));
      branch.previous = (await head(branch.db)).current;
      // Verify and warm up both paths, including allocating the worker and storage.
      branch.token = await branch.store.commit(branch.token, session(current));
      await branch.store.load();
      branch.measurements.save.length = 0;
      branch.measurements.load.length = 0;
      branch.windows = [];
      branch.heapBytes = [];
    }
    for (let index = 0; index < samples; index++) {
      for (const branch of index % 2 ? [...cases].reverse() : cases) {
        await put(branch.db, { revision: branch.token.revision, current: branch.previous, previous: null });
        branch.token = { ...branch.token, generation: branch.previous.at };
        const start = performance.now();
        branch.token = await branch.store.commit(branch.token, session(current));
        const decoded = await branch.store.load();
        const end = performance.now();
        branch.windows.push({ start, end });
        branch.heapBytes.push(performance.memory?.usedJSHeapSize ?? null);
        same(societyHashes(decoded.session.game), societyHashes(current), 'measured reload replay');
      }
    }
    // The observer can deliver a task after its measured window ends.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (taskObserver) recordTasks(taskObserver.takeRecords());
    const arms = [];
    for (const branch of cases) {
      const stored = await head(branch.db);
      const size = (entry) => typeof entry.payload === 'string' ? entry.payload.length : entry.payload.bytes.byteLength;
      same(await unpack(stored.current.payload), expected, 'benchmark canonical bytes');
      same(await unpack(stored.previous.payload), encodeSociety(previous), 'benchmark previous canonical bytes');
      check((typeof stored.current.payload !== 'string') === branch.gzip, 'Requested benchmark codec was unavailable.');
      const overlappingTasks = longTasks.filter(({ startTime, duration }) => branch.windows.some(({ start, end }) =>
        startTime < end && startTime + duration > start));
      arms.push({ gzip: branch.gzip, samples: branch.measurements, longTasksMs: LongTasks
        ? overlappingTasks.map(({ duration }) => duration) : null,
        heapBytes: branch.heapBytes, rawPayloadPairBytes: size(stored.current) + size(stored.previous),
        serializedPlainHeadBytes: branch.gzip ? null : new TextEncoder().encode(JSON.stringify(stored)).length });
    }
    return { horizon, citizens: 40, laws: 25, canonicalCurrentBytes: expected.length, arms,
      storageEstimate: await navigator.storage.estimate?.() ?? null };
  } finally {
    for (const branch of cases) branch.codec.close();
  }
}

globalThis.research = { faultChecks, provenance, tabOpen, tabAdvance, benchmark };
