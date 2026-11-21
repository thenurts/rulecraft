import { useEffect, useRef, useState, type ReactNode } from 'react';
import { confirmLaw, type LawCommand, type LawVersion } from '@rulecraft/simulation';
import { Book, Composer, newDraft, usableDraft } from './decrees.tsx';
import { deviceDraftStore, type DecreeDraft } from './draft-store.ts';
import { workerCodec } from './save-codec.ts';
import { BrowserDatabase, deviceSaveStore, emptySave, SaveConflict, type LoadedSave } from './save-store.ts';
import { createRoot } from 'react-dom/client';
import {
  citizenLabel, homeScreen, modeLabel, newSession, occupations, previous, trackLabel, villageReadModel, villageScreen, visit,
  type GameSession, type Screen, type Selection,
} from './world.ts';
import './styles.css';

function PageHeading({ children }: { children: ReactNode }) {
  return <h1 id="page-heading" tabIndex={-1}>{children}</h1>;
}

function Home({ session, onStart, onResume, busy }: {
  session: GameSession | null; onStart: (selection: Selection) => void; onResume: () => void; busy: boolean;
}) {
  const [selection, setSelection] = useState<Selection>({ mode: 'junior', track: 'campaign' });
  const [replace, setReplace] = useState(false);
  return <>
    <section className="hero">
      <p className="eyebrow">The village charter</p>
      <PageHeading>Rulecraft</PageHeading>
      <p>Write decrees for a village that makes its own decisions.</p>
    </section>
    {session && <section className="panel">
      <h2>Your village</h2>
      <p>{modeLabel[session.mode]} · {trackLabel[session.track]} · Day {session.game.state.turn}</p>
      <p className="muted">Saved on this device · Engine v{session.game.versions.schemaVersion}</p>
      <button className="primary" disabled={busy} onClick={onResume}>Resume village</button>
    </section>}
    <section className="panel">
      <h2>Start a village</h2>
      <div className="two-col">
        <label>Complexity
          <select value={selection.mode} onChange={(event) => setSelection({ ...selection, mode: event.target.value as Selection['mode'] })}>
            <option value="junior">Junior</option><option value="full">Full</option>
          </select>
        </label>
        <label>Play option
          <select value={selection.track} onChange={(event) => setSelection({ ...selection, track: event.target.value as Selection['track'] })}>
            <option value="campaign">Campaign preview</option><option value="sandbox">12-day Sandbox trial</option>
          </select>
        </label>
      </div>
      <p>{selection.track === 'campaign' ? 'Try The Hungry Village with provisional food targets.' :
        'Try decrees for 12 days with no campaign target.'}</p>
      {replace ? <div className="notice" role="group" aria-label="Replace current village">
        <p>Starting a new village replaces the current one.</p>
        <div className="actions">
          <button className="primary" disabled={busy} onClick={() => onStart(selection)}>Replace and start</button>
          <button onClick={() => setReplace(false)}>Cancel</button>
        </div>
      </div> : <button className={session ? '' : 'primary'} disabled={busy} onClick={() => session ? setReplace(true) : onStart(selection)}>Start village</button>}
    </section>
  </>;
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return <div className="metric"><dt>{label}</dt><dd>{value}</dd></div>;
}

function Village({ session, children }: { session: GameSession; children?: ReactNode }) {
  const village = villageReadModel(session.game);
  return <>
    <header className="page-header">
      <p className="eyebrow">{modeLabel[session.mode]} · {trackLabel[session.track]}</p>
      <PageHeading>Village</PageHeading>
      <p>Day {village.day} of {village.limit} · {village.remaining} days remaining</p>
      {session.game.versions.schemaVersion === 3 && <p>Historical engine v3 · original replay rules</p>}
    </header>
    {children}
    <section className="panel">
      <h2>Village resources</h2>
      <dl className="metrics">
        <Metric label="Market food" value={village.marketFood} />
        <Metric label="Field food reserve" value={village.fieldFood} />
        <Metric label="Forest timber" value={village.forestTimber} />
        <Metric label="Market coins" value={village.marketCoin} />
        <Metric label="Treasury coins" value={village.treasury} />
        <Metric label="Average trust" value={village.trust === null ? 'Unavailable' : `${village.trust}/100`} />
      </dl>
    </section>
    {session.track === 'campaign' && <section className="panel">
      <h2>The Hungry Village</h2>
      <p>Provisional targets by day 12. Feed residents on at least 90% of citizen-days and finish with 40 units of market food.</p>
      <p>{village.mealOpportunities ? `${village.fed} of ${village.mealOpportunities} citizen-days fed so far.` : 'Food access will be measured after the first day.'}</p>
    </section>}
    <section className="panel">
      <h2>Food access</h2>
      {village.latest && village.social ? <>
        <p>{village.latest.residentsFed} of {village.latest.residentsFed + village.latest.residentsUnmet} residents fully fed on day {village.day}.</p>
        <p>{village.social.metrics.food.unableToAffordUnits} food units unaffordable · {village.social.metrics.food.unavailableMarketUnits} unavailable at the market.</p>
      </> : <p>There are no completed meals to report yet.</p>}
    </section>
    <section className="panel">
      <h2>Residents <span className="small-count">{village.count}</span></h2>
      {Object.entries(occupations).map(([occupation, label]) => {
        const residents = village.households.filter((person) => person.occupation === occupation);
        return <details key={occupation}>
          <summary>{label} ({residents.length})</summary>
          {!residents.length && <p>No residents in this occupation.</p>}
          <ul className="list">{residents.map((person) =>
            <li key={person.id}><strong>{citizenLabel(person.id)}</strong>
              <span>Coins {person.coin} · Hunger {person.hunger} · Fatigue {person.fatigue} · Trust {person.trust}/100</span>
              {occupation === 'forester' && <span>Timber {person.timber} · This trial has no timber buyer.</span>}
            </li>)}</ul>
        </details>;
      })}
    </section>
  </>;
}

const database = new BrowserDatabase();
const saves = deviceSaveStore(database, workerCodec());
const drafts = deviceDraftStore(database);
const bookScreen: Screen = { name: 'book' };

function message(error: unknown): string {
  if (error instanceof Error && error.name === 'QuotaExceededError') {
    return 'Device storage is full. Your last complete save is still available.';
  }
  return error instanceof Error ? error.message : 'Device storage did not respond.';
}

function App() {
  const [saved, setSaved] = useState<LoadedSave>(emptySave);
  const [draft, setDraft] = useState<DecreeDraft | null>(null);
  const [history, setHistory] = useState<readonly Screen[]>([homeScreen]);
  const [busy, setBusy] = useState(true);
  const [storageReady, setStorageReady] = useState(false);
  const [stale, setStale] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [problem, setProblem] = useState('');
  const [draftProblem, setDraftProblem] = useState('');
  const [draftSaved, setDraftSaved] = useState(false);
  const saveRef = useRef<LoadedSave>(emptySave);
  const locking = useRef(false);
  const initialRender = useRef(true);
  const draftQueue = useRef(Promise.resolve());
  const screen = history[history.length - 1];
  const session = saved.session;
  const go = (destination: Screen) => setHistory((before) => visit(before, destination));

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    document.getElementById('page-heading')?.focus({ preventScroll: true });
  }, [screen]);

  function accept(result: LoadedSave) {
    saveRef.current = result;
    setSaved(result);
  }

  async function load() {
    if (locking.current) return;
    locking.current = true;
    setBusy(true);
    setProblem('');
    setDraftProblem('');
    try {
      const result = await saves.load();
      accept(result);
      setStorageReady(true);
      setStale(false);
      setHistory([homeScreen]);
      setFeedback(result.recovered ? 'Recovered the previous complete save. The latest generation could not be verified.' : '');
      setDraft(null);
      if (result.session) {
        try {
          const stored = await drafts.load(result.session.id);
          if (stored && usableDraft(result.session.game, stored)) {
            setDraft(stored);
            setDraftSaved(true);
          } else if (stored && !result.session.game.book.versions.some(({ commandId }) => commandId === stored.commandId)) {
            setDraftProblem('An obsolete draft was set aside because its decree version changed.');
          }
        } catch (error) {
          setDraftProblem(`The draft could not be opened. ${message(error)}`);
        }
      }
    } catch (error) {
      setStorageReady(false);
      setProblem(`The saved village could not be opened. ${message(error)}`);
    } finally {
      setBusy(false);
      locking.current = false;
    }
  }

  useEffect(() => { void load(); }, []);

  async function persist(operation: () => Promise<void>) {
    if (locking.current || !storageReady || stale) return false;
    locking.current = true;
    setBusy(true);
    setProblem('');
    setFeedback('');
    try {
      await operation();
      return true;
    } catch (error) {
      if (error instanceof SaveConflict) setStale(true);
      setProblem(`Changes were not saved. ${message(error)}`);
      return false;
    } finally {
      setBusy(false);
      locking.current = false;
    }
  }

  function storeDraft(id: string, next: DecreeDraft | null) {
    setDraft(next);
    setDraftProblem('');
    setDraftSaved(false);
    const waiting = draftQueue.current.then(() => next ? drafts.put(id, next) : drafts.clear(id))
      .then(() => { if (draftQueue.current === waiting) setDraftSaved(next !== null); })
      .catch((error: unknown) => setDraftProblem(`The draft could not be stored on this device. ${message(error)}`));
    draftQueue.current = waiting;
  }

  async function start(selection: Selection) {
    await persist(async () => {
      const next = newSession(selection, crypto.randomUUID());
      accept(await saves.commit(saveRef.current, next));
      setDraft(null);
      setDraftProblem('');
      setFeedback('Village saved on this device.');
      go(villageScreen);
    });
  }

  function openComposer(version?: LawVersion) {
    if (!session) return;
    const next = draft && usableDraft(session.game, draft) && (version ? draft.lawId === version.lawId : true)
      ? draft : newDraft(crypto.randomUUID(), version);
    if (next !== draft) storeDraft(session.id, next);
    go({ name: 'composer', id: next.commandId });
  }

  async function enact(command: LawCommand) {
    return persist(async () => {
      const current = saveRef.current;
      if (!current.session) return;
      const { game, version } = confirmLaw(current.session.game, command);
      if (game !== current.session.game) accept(await saves.commit(current, { ...current.session, game }));
      if (draft?.commandId === command.commandId) {
        storeDraft(current.session.id, null);
        setHistory([homeScreen, villageScreen, bookScreen]);
      }
      setFeedback(`Decree saved. Confirmed for day ${version.effectiveFromTurn}.`);
    });
  }

  const blocked = busy || stale || !storageReady;
  return <>
    <a className="skip" href="#main-content">Skip to content</a>
    <header className="masthead">
      <div className="masthead-inner">
        <button className="wordmark" disabled={busy} onClick={() => go(homeScreen)}><span aria-hidden="true">R</span>Rulecraft</button>
        {screen.name !== 'home' && <button className="quiet" disabled={busy} onClick={() => setHistory(previous)}>Back</button>}
      </div>
    </header>
    <main id="main-content" className="shell">
      {problem && <div className="notice" role="alert"><p>{problem}</p>
        <button disabled={busy} onClick={() => void load()}>Reload saved village</button></div>}
      {draftProblem && <p className="notice" role="status">{draftProblem}</p>}
      {screen.name === 'composer' && draftSaved && <p className="muted draft-status" role="status">Draft saved separately on this device.</p>}
      {busy && <p className="notice" role="status">Working with your saved village…</p>}
      {feedback && !busy && <p className="notice" role="status">{feedback}</p>}
      {screen.name !== 'home' && session && <nav className="tabs" aria-label="Village navigation">
        <button disabled={busy} aria-current={screen.name === 'village' ? 'page' : undefined} onClick={() => go(villageScreen)}>Village</button>
        <button disabled={busy} aria-current={screen.name === 'book' ? 'page' : undefined} onClick={() => go(bookScreen)}>Decree Book</button>
      </nav>}
      {screen.name === 'village' && session && <Village session={session} />}
      {screen.name === 'book' && session &&
        <Book game={session.game} draft={draft} busy={blocked} onCompose={openComposer} onCommit={enact} />}
      {screen.name === 'composer' && session && draft &&
        <Composer key={draft.commandId} game={session.game} mode={session.mode} draft={draft} busy={blocked}
          onChange={(next) => storeDraft(session.id, next)} onCommit={enact}
          onDiscard={() => { storeDraft(session.id, null); setHistory(previous); }} />}
      {screen.name === 'home' && <Home session={session} busy={blocked} onStart={start} onResume={() => go(villageScreen)} />}
    </main>
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
