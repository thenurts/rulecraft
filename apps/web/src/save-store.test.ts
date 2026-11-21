import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { describe, expect, test, vi } from 'vitest';
import { encodeSociety, loadSociety, startSocietyV3 } from '@rulecraft/simulation';
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
    const v3 = { ...session, game: startSocietyV3(fixture, 42) };
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
    expect(authoredCommand(draft, preview.ast!)).toMatchObject({ operation: 'CREATE', commandId: 'test-command' });
    await drafts.clear(session.id);
    expect(await drafts.load(session.id)).toBeNull();
  });
});
