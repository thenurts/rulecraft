import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { describe, expect, test, vi } from 'vitest';
import { encodeSociety, loadSociety, societyDefaults, startSociety, startSocietyV3 } from '@rulecraft/simulation';
import fixture from '../../../fixtures/task-01-village.json';
import { authoredCommand, decreePreview, newDraft } from './decrees.tsx';
import { deviceDraftStore } from './draft-store.ts';
import { BrowserDatabase, deviceSaveStore, emptySave, SaveConflict } from './save-store.ts';
import { newSession } from './world.ts';

const codec = { encode: async (game: Parameters<typeof encodeSociety>[0]) => encodeSociety(game),
  decode: async (payload: string) => loadSociety(payload) };
const initialize = () => {
  const db = new BrowserDatabase('rulecraft-test', new IDBFactory());
  return { db, saves: deviceSaveStore(db, codec), drafts: deviceDraftStore(db) };
};
const session = newSession({ mode: 'full', track: 'sandbox' }, 'first');
const changed = newSession({ mode: 'junior', track: 'campaign' }, 'second');

describe('revisioned device storage', () => {
  test('saves a new village and rejects stale writes from a second reader', async () => {
    const { saves } = initialize();
    const one = await saves.load();
    const otherTab = await saves.load();
    expect(one).toEqual(emptySave);
    await saves.commit(one, session);
    await expect(saves.commit(otherTab, changed)).rejects.toBeInstanceOf(SaveConflict);
    expect(await saves.load()).toMatchObject({ revision: 1, session });
  });

  test('aborted promotion leaves the prior generation and revision intact', async () => {
    const { saves } = initialize();
    const one = await saves.commit(emptySave, session);
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(function (this: IDBObjectStore) {
      this.transaction.abort();
      return {} as IDBRequest;
    });
    try {
      await expect(saves.commit(one, changed)).rejects.toThrow(/interrupted/);
      expect(await saves.load()).toEqual(one);
    } finally {
      put.mockRestore();
    }
  });

  test('recovers a verified previous generation and uses it as the next backup', async () => {
    const { db, saves } = initialize();
    const one = await saves.commit(emptySave, session);
    await saves.commit(one, changed);
    const head = await db.request('world', 'readonly', (store) => store.get('village'));
    head.current.payload = 'damaged';
    await db.request('world', 'readwrite', (store) => store.put(head, 'village'));
    const recovered = await saves.load();
    expect(recovered).toMatchObject({ revision: 2, generation: 1, recovered: true, session });
    const final = await saves.commit(recovered, changed);
    expect(final).toMatchObject({ revision: 3, recovered: false, session: changed });
    const saved = await db.request('world', 'readonly', (store) => store.get('village'));
    expect(saved.previous.at).toBe(1);
  });

  test('an unsupported snapshot is explicit, and historical v3 data retains its engine', async () => {
    const { db, saves } = initialize();
    const v3 = { id: session.id, mode: session.mode, track: session.track, game: startSocietyV3(fixture, 42) };
    await saves.commit(emptySave, v3);
    expect((await saves.load()).session?.game.versions.schemaVersion).toBe(3);
    const head = await db.request('world', 'readonly', (store) => store.get('village'));
    head.current.payload = head.current.payload.replace('"schemaVersion":3', '"schemaVersion":300');
    await db.request('world', 'readwrite', (store) => store.put(head, 'village'));
    await expect(saves.load()).rejects.toThrow(/unsupported engine version/);
  });

  test('a draft is independent of the committed world and safe to discard', async () => {
    const { saves, drafts } = initialize();
    await saves.commit(emptySave, session);
    const draft = { ...newDraft('test-command'), wording: { targetSelector: 'all-citizens', modality: 'MUST', actionId: 'rest' } } as const;
    await drafts.put(session.id, draft);
    expect(await drafts.load(session.id)).toEqual(draft);
    expect((await saves.load()).session?.game.book.versions).toEqual([]);
    const preview = decreePreview(session.game, draft);
    expect(preview.issues).toContainEqual({ severity: 'WARNING', code: 'BROAD_REST_DUTY' });
    expect(authoredCommand(draft, preview.ast!, session.game)).toMatchObject({ operation: 'CREATE', commandId: 'test-command' });
    await drafts.clear(session.id);
    expect(await drafts.load(session.id)).toBeNull();
  });
});

test('versioned setup is stored alongside the original payload and cannot silently change mode or seed', async () => {
  const { db, saves } = initialize();
  const current = await saves.commit(emptySave, changed);
  const head = await db.request('world', 'readonly', (store) => store.get('village'));
  expect(head.current.payload).toBe(encodeSociety(changed.game));
  expect(head.current.setup).toEqual(changed.setup);
  await expect(saves.commit(current, { ...changed, mode: 'full' })).rejects.toThrow(/does not match/);
  await expect(saves.commit(current, newSession({ mode: 'junior', track: 'campaign', seed: 0 }, changed.id)))
    .rejects.toThrow(/Starting setup is fixed/);
  head.current.mode = 'full';
  await db.request('world', 'readwrite', (store) => store.put(head, 'village'));
  await expect(saves.load()).rejects.toThrow(/No verified generation/);
});

test.each([
  ['v3', startSocietyV3(fixture, 42)],
  ['v4', startSociety(fixture, 42)],
])('a genuine historical %s preview retains its identity and engine on commit', async (_version, game) => {
  const { db, saves } = initialize();
  const legacy = { id: 'preview', mode: 'junior', track: 'campaign', game } as const;
  await saves.commit(emptySave, legacy);
  const loaded = await saves.load();
  expect(loaded.session).toEqual(legacy);
  await saves.commit(loaded, loaded.session!);
  const head = await db.request('world', 'readonly', (store) => store.get('village'));
  expect(head.current).not.toHaveProperty('setup');
  expect(head.current).not.toHaveProperty('sessionFormat');
  expect(head.current.payload).toBe(encodeSociety(game));
});

test('missing modern Campaign setup recovers the prior verified generation without rewriting the corrupt head', async () => {
  const { db, saves } = initialize();
  const first = await saves.commit(emptySave, changed);
  await saves.commit(first, changed);
  const head = await db.request('world', 'readonly', (store) => store.get('village'));
  expect(head.current.sessionFormat).toBe('scenario-v1');
  delete head.current.setup;
  await db.request('world', 'readwrite', (store) => store.put(head, 'village'));

  const recovered = await saves.load();
  expect(recovered).toMatchObject({ revision: 2, generation: 1, recovered: true, session: changed });
  expect(await db.request('world', 'readonly', (store) => store.get('village'))).toEqual(head);

  await saves.commit(recovered, changed);
  const repaired = await db.request('world', 'readonly', (store) => store.get('village'));
  expect(repaired.current.setup).toEqual(changed.setup);
  expect(repaired.current.sessionFormat).toBe('scenario-v1');
  expect(repaired.previous).toEqual(head.previous);
});

test('a modern Hungry Village with missing setup is not a legacy preview even without a format marker', async () => {
  const { db, saves } = initialize();
  await saves.commit(emptySave, changed);
  const head = await db.request('world', 'readonly', (store) => store.get('village'));
  delete head.current.setup;
  delete head.current.sessionFormat; // Simulate an older untagged modern save.
  await db.request('world', 'readwrite', (store) => store.put(head, 'village'));

  await expect(saves.load()).rejects.toThrow(/No verified generation/);
  expect(await db.request('world', 'readonly', (store) => store.get('village'))).toEqual(head);
});

test('a modern alternate Sandbox preset cannot masquerade as an untagged historical preview', async () => {
  const { db, saves } = initialize();
  const alternate = newSession({ mode: 'junior', track: 'sandbox', preset: 'five-merchants-farmers-v1' }, 'alternate');
  await saves.commit(emptySave, alternate);
  const head = await db.request('world', 'readonly', (store) => store.get('village'));
  delete head.current.setup;
  delete head.current.sessionFormat;
  await db.request('world', 'readwrite', (store) => store.put(head, 'village'));

  await expect(saves.load()).rejects.toThrow(/No verified generation/);
  expect(await db.request('world', 'readonly', (store) => store.get('village'))).toEqual(head);
});

test('the modern format marker prevents misidentifying an identical-standard-preset Sandbox save', async () => {
  const { db, saves } = initialize();
  await saves.commit(emptySave, session); // Same engine fixture as the older preview.
  const head = await db.request('world', 'readonly', (store) => store.get('village'));
  expect(head.current.sessionFormat).toBe('scenario-v1');
  delete head.current.setup;
  await db.request('world', 'readwrite', (store) => store.put(head, 'village'));

  await expect(saves.load()).rejects.toThrow(/No verified generation/);
  expect(await db.request('world', 'readonly', (store) => store.get('village'))).toEqual(head);
});

test('an unsupported session format is rejected rather than silently treated as a preview', async () => {
  const { db, saves } = initialize();
  await saves.commit(emptySave, session);
  const head = await db.request('world', 'readonly', (store) => store.get('village'));
  head.current.sessionFormat = 'scenario-v999';
  await db.request('world', 'readwrite', (store) => store.put(head, 'village'));

  await expect(saves.load()).rejects.toThrow(/No verified generation/);
});

test.each([
  ['seed', startSociety(fixture, 43)],
  ['society settings', startSociety(fixture, 42, { ...societyDefaults, bulletinBp: 10_000 })],
  ['law policy', startSociety(fixture, 42, societyDefaults, { changesPerTurn: 1, mustWeight: 60, mustNotWeight: 55 })],
] as const)('an untagged world with different %s is outside the historical preview signature', async (_field, game) => {
  const { db, saves } = initialize();
  const head = { revision: 1, previous: null, current: {
    id: 'untagged', track: 'sandbox', mode: 'full', at: 1, payload: encodeSociety(game),
  } };
  await db.request('world', 'readwrite', (store) => store.put(head, 'village'));
  await expect(saves.load()).rejects.toThrow(/No verified generation/);
  expect(await db.request('world', 'readonly', (store) => store.get('village'))).toEqual(head);
});

test('a modern generation with intact setup can resume without the later format marker', async () => {
  const { db, saves } = initialize();
  await saves.commit(emptySave, changed);
  const head = await db.request('world', 'readonly', (store) => store.get('village'));
  delete head.current.sessionFormat;
  await db.request('world', 'readwrite', (store) => store.put(head, 'village'));

  const loaded = await saves.load();
  expect(loaded).toMatchObject({ recovered: false, session: changed });
  expect(await db.request('world', 'readonly', (store) => store.get('village'))).toEqual(head);
  await saves.commit(loaded, loaded.session!);
  const saved = await db.request('world', 'readonly', (store) => store.get('village'));
  expect(saved.current.sessionFormat).toBe('scenario-v1');
  expect(saved.current.payload).toBe(head.current.payload);
  expect(saved.previous).toEqual(head.current);
});
