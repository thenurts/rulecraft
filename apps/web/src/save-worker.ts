import { encodeSociety, loadSociety } from '@rulecraft/simulation';
import type { CodecReply, CodecRequest } from './save-codec.ts';

self.onmessage = ({ data }: MessageEvent<CodecRequest>) => {
  let reply: CodecReply;
  try {
    const result = data.operation === 'encode' ? encodeSociety(data.game) : loadSociety(data.payload);
    reply = { id: data.id, result };
  } catch (error) {
    reply = { id: data.id, error: error instanceof Error ? error.message : 'Save verification failed.' };
  }
  self.postMessage(reply);
};
