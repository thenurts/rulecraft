import type { LawDraft } from '@rulecraft/simulation';
import type { BrowserDatabase } from './save-store.ts';

export interface DecreeDraft {
  commandId: string;
  lawId: string | null;
  baseVersion: number | null;
  wording: LawDraft;
}

export interface DraftStore {
  load(id: string): Promise<DecreeDraft | null>;
  put(id: string, draft: DecreeDraft): Promise<void>;
  clear(id: string): Promise<void>;
}

export function deviceDraftStore(database: BrowserDatabase): DraftStore {
  return {
    async load(id) {
      return await database.request<DecreeDraft | undefined>('draft', 'readonly', (store) => store.get(id)) ?? null;
    },
    async put(id, draft) {
      await database.request('draft', 'readwrite', (store) => store.put(draft, id));
    },
    async clear(id) {
      await database.request('draft', 'readwrite', (store) => store.delete(id));
    },
  };
}
