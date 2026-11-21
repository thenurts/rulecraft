import type { SocietyGame } from '@rulecraft/simulation';

export interface SaveCodec {
  encode(game: SocietyGame): Promise<string>;
  decode(payload: string): Promise<SocietyGame>;
}

export type CodecRequest = { id: number } &
  ({ operation: 'encode'; game: SocietyGame } | { operation: 'decode'; payload: string });
export type CodecReply = { id: number } & ({ result: string | SocietyGame } | { error: string });

export function workerCodec(): SaveCodec {
  let worker: Worker | undefined;
  let sequence = 0;
  const pending = new Map<number, { resolve: (reply: string | SocietyGame) => void; reject: (error: Error) => void }>();

  function getWorker() {
    if (worker) return worker;
    worker = new Worker(new URL('./save-worker.ts', import.meta.url), { type: 'module' });
    const active = worker;
    active.onmessage = ({ data }: MessageEvent<CodecReply>) => {
      const request = pending.get(data.id);
      pending.delete(data.id);
      if (!request) return;
      if ('error' in data) request.reject(new Error(data.error));
      else request.resolve(data.result);
    };
    active.onerror = () => {
      for (const request of pending.values()) request.reject(new Error('The save worker stopped.'));
      pending.clear();
      active.terminate();
      if (worker === active) worker = undefined;
    };
    return active;
  }

  function send<T extends SocietyGame | string>(create: (id: number) => CodecRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      const active = getWorker();
      const id = ++sequence;
      pending.set(id, { resolve: (reply) => resolve(reply as T), reject });
      try { active.postMessage(create(id)); } catch (error) {
        pending.delete(id);
        reject(error);
      }
    });
  }
  return {
    encode: (game) => send((id) => ({ id, operation: 'encode', game })),
    decode: (payload) => send((id) => ({ id, operation: 'decode', payload })),
  };
}
