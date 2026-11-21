export interface DraftStore {
  load(): Promise<string | null>;
  save(encodedDraft: string): Promise<void>;
}

const draftKey = 'rulecraft.task-00.portability-draft';

export const browserDraftStore: DraftStore = {
  async load() {
    return window.localStorage.getItem(draftKey);
  },
  async save(encodedDraft) {
    window.localStorage.setItem(draftKey, encodedDraft);
  },
};
