import { canonicalJson } from '@rulecraft/simulation';
import { verifiedSetup, type RunSetup } from './profiles.ts';
import type { SaveCodec } from './save-codec.ts';
import type { GameSession, Selection } from './world.ts';

const slot = 'village';

interface Generation extends Selection { id: string; at: number; payload: string; setup?: RunSetup; sessionFormat?: 'scenario-v1' }
interface Head { revision: number; current: Generation; previous: Generation | null }

export interface LoadedSave {
  revision: number;
  generation: number | null;
  session: GameSession | null;
  recovered: boolean;
}

export const emptySave: LoadedSave = { revision: 0, generation: null, session: null, recovered: false };

export class SaveConflict extends Error {
  constructor() { super('The saved village changed in another tab. Reload the saved village to continue.'); }
}

export interface GameSaveStore {
  load(): Promise<LoadedSave>;
  commit(expected: LoadedSave, session: GameSession): Promise<LoadedSave>;
}

function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('The save transaction was interrupted.'));
  });
}

export class BrowserDatabase {
  private opened?: Promise<IDBDatabase>;
  constructor(private readonly name = 'rulecraft-village', private readonly factory?: IDBFactory) {}

  async open() {
    this.opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const source = this.factory ?? globalThis.indexedDB;
      if (!source) {
        reject(new Error('Device storage is unavailable.'));
        return;
      }
      const request = source.open(this.name, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('world');
        request.result.createObjectStore('draft');
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Another tab has locked device storage.'));
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          this.opened = undefined;
        };
        resolve(request.result);
      };
    }).catch((error: unknown) => {
      this.opened = undefined;
      throw error;
    });
    return this.opened;
  }

  async request<T>(name: 'world' | 'draft', mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    const transaction = db.transaction(name, mode);
    const done = completed(transaction);
    try {
      const request = action(transaction.objectStore(name));
      await done;
      return request.result;
    } catch (error) {
      // Wait for completion or abort even when the request could not be started.
      await done.catch(() => undefined);
      throw error;
    }
  }
}

export function deviceSaveStore(database: BrowserDatabase, codec: SaveCodec): GameSaveStore {
  return {
    async load() {
      const start = performance.now();
      const head = await database.request<Head | undefined>('world', 'readonly', (store) => store.get(slot));
      if (!head) {
        performance.measure('rulecraft.load', { start });
        return emptySave;
      }
      if (!Number.isSafeInteger(head.revision) || head.revision < 1) throw new Error('Save revision is invalid.');
      let error: unknown;
      for (const [index, generation] of [head.current, head.previous].entries()) {
        if (!generation) continue;
        try {
          const { id, mode, track, payload, at } = generation;
          if (typeof id !== 'string' || (mode !== 'junior' && mode !== 'full') ||
              (track !== 'campaign' && track !== 'sandbox') || typeof payload !== 'string' ||
              !Number.isSafeInteger(at) || at < 1 || at > head.revision) throw new Error('Save metadata is invalid.');
          // The format marker is stored outside the engine snapshot. A missing setup
          // must not silently convert a versioned run into a historical preview.
          if (generation.sessionFormat !== undefined && generation.sessionFormat !== 'scenario-v1') {
            throw new Error('Unsupported session metadata format.');
          }
          if (generation.sessionFormat === 'scenario-v1' && generation.setup === undefined) {
            throw new Error('Versioned scenario setup is missing.');
          }
          const game = await codec.decode(payload);
          const setup = verifiedSetup({ mode, track }, game, generation.setup);
          performance.measure('rulecraft.load', { start, detail: { bytes: payload.length, day: game.state.turn } });
          return { revision: head.revision, generation: at, session: { id, mode, track, game, ...(setup && { setup }) }, recovered: index > 0 };
        } catch (failure) {
          error = failure;
        }
      }
      const detail = error instanceof Error && error.message === 'UNSUPPORTED_SOCIETY_SAVE_VERSION'
        ? 'This save uses an unsupported engine version.' : 'No verified generation could be opened.';
      throw new Error(detail);
    },
    async commit(expected, session) {
      const start = performance.now();
      const setup = verifiedSetup(session, session.game, session.setup);
      const current = expected.session;
      if (current?.id === session.id && (current.mode !== session.mode || current.track !== session.track ||
          current.game.seed !== session.game.seed || current.game.versions.schemaVersion !== session.game.versions.schemaVersion ||
          canonicalJson(current.game.fixture) !== canonicalJson(session.game.fixture) ||
          canonicalJson(current.setup ?? null) !== canonicalJson(setup ?? null))) {
        throw new Error('Starting setup is fixed for this saved village.');
      }
      const payload = await codec.encode(session.game);
      const db = await database.open();
      const revision = expected.revision + 1;
      const generation: Generation = { id: session.id, mode: session.mode, track: session.track, payload, at: revision, ...(setup && { setup, sessionFormat: 'scenario-v1' as const }) };
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('world', 'readwrite', { durability: 'strict' });
        let failure: unknown;
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('The save was interrupted.'));
        const store = transaction.objectStore('world');
        const read = store.get(slot);
        read.onsuccess = () => {
          const head = read.result as Head | undefined;
          if ((head?.revision ?? 0) !== expected.revision) {
            failure = new SaveConflict();
            transaction.abort();
            return;
          }
          const previous = [head?.current, head?.previous].find((record) => record?.at === expected.generation) ?? null;
          try {
            store.put({ revision, current: generation, previous } satisfies Head, slot);
          } catch (error) {
            failure = error;
            transaction.abort();
          }
        };
      });
      performance.measure('rulecraft.save', { start, detail: { bytes: payload.length, day: session.game.state.turn } });
      return { revision, generation: revision, session, recovered: false };
    },
  };
}
