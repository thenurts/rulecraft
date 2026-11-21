import { useEffect, useRef, useState } from 'react';
import { presets, readSeed, type StartSelection } from './profiles.ts';
import type { GameSession } from './world.ts';

export function RetryPanel({ session, start, busy }: {
  session: GameSession; start(selection: StartSelection): Promise<void>; busy: boolean;
}) {
  const [request, setRequest] = useState<'same' | 'different' | null>(null);
  const [text, setText] = useState('');
  const confirmGroup = useRef<HTMLDivElement>(null);
  const same = useRef<HTMLButtonElement>(null);
  const different = useRef<HTMLButtonElement>(null);
  const cancelled = useRef<'same' | 'different' | null>(null);
  useEffect(() => {
    if (request) confirmGroup.current?.focus();
    else if (cancelled.current) {
      (cancelled.current === 'same' ? same : different).current?.focus();
      cancelled.current = null;
    }
  }, [request]);
  const { setup, mode, track } = session;
  if (!setup) return null;
  const seed = request === 'same' ? setup.seed : readSeed(text);
  const valid = seed !== undefined && (request === 'same' || seed !== setup.seed);
  return <section className="panel">
    <h2>Try another run</h2>
    {request ? <div className="notice" ref={confirmGroup} tabIndex={-1} role="group" aria-label="Replace current village">
      <p>This starts a new village with the {presets[setup.preset].label} preset and replaces the current save.</p>
      {request === 'same' ? <p>Seed {setup.seed}</p> : <label>New seed
        <input type="text" inputMode="numeric" value={text} disabled={busy} aria-invalid={!valid}
          aria-describedby="retry-seed-help" onChange={({ target }) => setText(target.value)} />
      </label>}
      {request === 'different' && <p id="retry-seed-help">Choose a different whole number from 0 to 4,294,967,295.</p>}
      <div className="actions">
        <button className="primary" disabled={busy || !valid} onClick={() => {
          if (valid) void start({ mode, track, preset: setup.preset, seed });
        }}>Replace and retry</button>
        <button disabled={busy} onClick={() => { cancelled.current = request; setRequest(null); }}>Cancel retry</button>
      </div>
    </div> : <div className="actions">
      <button ref={same} disabled={busy} onClick={() => setRequest('same')}>Retry same seed</button>
      <button ref={different} disabled={busy} onClick={() => {
        const draw = crypto.getRandomValues(new Uint32Array(1))[0];
        setText(String(draw === setup.seed ? (draw + 1) >>> 0 : draw));
        setRequest('different');
      }}>Choose a new seed</button>
    </div>}
  </section>;
}
