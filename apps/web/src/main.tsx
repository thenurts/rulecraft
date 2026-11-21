import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { advanceSociety, confirmLaw, type LawCommand, type LawVersion } from '@rulecraft/simulation';
import { isMission, MissionOverview, MissionReview } from './Mission.tsx';
import { checkpointDay } from './mission.ts';
import { ExperimentReport, isExperiment } from './Sandbox.tsx';
import { RetryPanel } from './Retry.tsx';
import { ChoiceSelect } from './ChoiceSelect.tsx';
import { Book, Composer, newDraft, usableDraft } from './decrees.tsx';
import { deviceDraftStore, type DecreeDraft } from './draft-store.ts';
import { AdvancePanel, DayResults, Gazette, Inquiry, TrialSummary } from './results.tsx';
import { Chronicle, ShareView, StoryCard } from './narrative/StoryViews.tsx';
import { projectNarrative, type Incident } from './narrative/projection.ts';
import { editorProfile, modeProfiles, scenarios, presets, readSeed, type PresetId, type StartSelection, type Selection } from './profiles.ts';
import { workerCodec } from './save-codec.ts';
import { BrowserDatabase, deviceSaveStore, emptySave, SaveConflict, type LoadedSave } from './save-store.ts';
import { createRoot } from 'react-dom/client';
import {
  browserId, citizenLabel, homeScreen, newSession, occupations, previous, sessionLabel, setupLabel, villageReadModel, villageScreen, visit,
  type GameSession, type Screen,
} from './world.ts';
import './styles.css';

function PageHeading({ children }: { children: ReactNode }) {
  return <h1 id="page-heading" tabIndex={-1}>{children}</h1>;
}

function Home({ session, onStart, onResume, busy }: {
  session: GameSession | null; onStart: (selection: StartSelection) => void; onResume: () => void; busy: boolean;
}) {
  const [selection, setSelection] = useState<Selection>({ mode: 'junior', track: 'campaign' });
  const [sandboxPreset, setSandboxPreset] = useState<PresetId>(scenarios.sandbox.defaultPreset);
  const [sandboxSeed, setSandboxSeed] = useState(String(scenarios.sandbox.defaultSeed));
  const [pending, setPending] = useState<StartSelection | null>(null);
  const scenario = scenarios[selection.track];
  const experiment = scenario.track === 'sandbox';
  const preset = experiment ? sandboxPreset : scenario.defaultPreset;
  const seed = experiment ? readSeed(sandboxSeed) : scenario.defaultSeed;
  const starting = presets[preset];
  const locked = busy || pending !== null;
  function requestStart() {
    if (seed === undefined) return;
    const next = { ...selection, seed, preset };
    if (session) setPending(next);
    else onStart(next);
  }
  return <>
    <section className="hero">
      <p className="eyebrow">The village charter</p>
      <PageHeading>Rulecraft</PageHeading>
      <p>Write decrees for a village that makes its own decisions.</p>
    </section>
    {session && <section className="panel">
      <h2>Your village</h2>
      <p>{sessionLabel(session)} · Day {session.game.state.turn}</p>
      <p className="muted">Saved on this device · Engine v{session.game.versions.schemaVersion}</p><p>{setupLabel(session)}</p>
      <button className="primary" disabled={busy} onClick={onResume}>Resume village</button>
    </section>}
    <section className="panel">
      <h2>Start a village</h2>
      <div className="two-col">
        <ChoiceSelect label="Complexity" value={selection.mode} disabled={locked}
          choices={Object.values(modeProfiles).map(({ id, label }) => ({ value: id, label }))}
          onChange={(mode) => setSelection({ ...selection, mode: mode as Selection['mode'] })} />
        <ChoiceSelect label="Play option" value={selection.track} disabled={locked}
          choices={[
            { value: 'campaign', label: 'Campaign · The Hungry Village' },
            { value: 'sandbox', label: scenarios.sandbox.label },
          ]}
          onChange={(track) => setSelection({ ...selection, track: track as Selection['track'] })} />
      </div>
      <p>{modeProfiles[selection.mode].explanation}</p>
      {experiment && <>
        <div className="two-col">
          <ChoiceSelect label="Starting preset" value={sandboxPreset} disabled={locked}
            choices={scenario.presets.map((id) => ({ value: id, label: presets[id].label }))}
            onChange={(id) => setSandboxPreset(id as PresetId)} />
          <label>Seed
            <input type="text" inputMode="numeric" aria-describedby="start-seed-help" aria-invalid={seed === undefined}
              value={sandboxSeed} disabled={locked} onChange={({ target }) => setSandboxSeed(target.value)} />
          </label>
        </div>
        <p id="start-seed-help">Enter a whole number from 0 to 4,294,967,295. Use the same seed and preset to repeat the same start.</p>
        <p>The experiment lasts 12 days and has no victory target.</p>
      </>}
      <p>{starting.label} preset · Scenario v{scenario.version} · {starting.fixture.days} days
        {!experiment && ` · Seed ${scenario.defaultSeed}`}</p>
      <details><summary>Starting conditions</summary>
        <p>{starting.fixture.population.farmer} farmers · {starting.fixture.population.merchant} merchants · {starting.fixture.population.forester} foresters · {starting.fixture.population.guard} guards.</p>
        <p>{starting.fixture.opening.marketFood} market food · {starting.fixture.opening.fieldFood} field food · {starting.fixture.opening.citizenCoin} coins per resident.</p>
      </details>
      {pending ? <div className="notice" role="group" aria-label="Replace current village">
        <p>Starting a new village replaces the current one.</p>
        <p>{modeProfiles[pending.mode].label} · {starting.label} · Seed {pending.seed}</p>
        <div className="actions">
          <button className="primary" disabled={busy} onClick={() => onStart(pending)}>Replace and start</button>
          <button disabled={busy} onClick={() => setPending(null)}>Cancel</button>
        </div>
      </div> : <button className={session ? '' : 'primary'} disabled={busy || seed === undefined} onClick={requestStart}>Start village</button>}
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
      <p className="eyebrow">{sessionLabel(session)}</p>
      <PageHeading>Village</PageHeading>
      <p>Day {village.day} of {village.limit} · {village.remaining} days remaining</p>
      <p>{setupLabel(session)}</p>
      {session.game.versions.schemaVersion === 3 ? <p>Historical engine v3 · original replay rules</p> : <p>Engine v4</p>}
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
    {session.track === 'campaign' && !session.setup && <section className="panel">
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
            <li key={person.id}><details><summary>{citizenLabel(person.id)}</summary>
              <span>Coins {person.coin} · Hunger {person.hunger} · Fatigue {person.fatigue} · Trust {person.trust}/100</span>
              {occupation === 'forester' && <span>Timber {person.timber} · This trial has no timber buyer.</span>}
              <span>{session.game.book.notices.filter(({ citizenId }) => citizenId === person.id).length} recorded decree-version notices.</span>
            </details></li>)}</ul>
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
  const narrative = useMemo(() => {
    if (!session) return { incidents: [], diagnostics: [] };
    try {
      const start = performance.now();
      const projection = projectNarrative(session.game, session.mode);
      performance.measure('rulecraft.narrative', { start, detail: { day: session.game.state.turn } });
      return projection;
    } catch {
      return { incidents: [], diagnostics: ['projection-failed'] };
    }
  }, [session]);

  useEffect(() => {
    if (narrative.diagnostics.length) console.warn('Rulecraft narrative diagnostics', narrative.diagnostics);
  }, [narrative]);
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

  async function start(selection: StartSelection) {
    await persist(async () => {
      const next = newSession(selection, browserId());
      accept(await saves.commit(saveRef.current, next));
      setDraft(null);
      setDraftProblem('');
      setFeedback('Village saved on this device.');
      setHistory([homeScreen, villageScreen]);
    });
  }

  function openComposer(version?: LawVersion) {
    if (!session) return;
    const next = draft && usableDraft(session.game, draft) && (version ? draft.lawId === version.lawId : true)
      ? draft : newDraft(browserId(), version);
    if (next !== draft) storeDraft(session.id, next);
    setFeedback('');
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

  async function advance() {
    return persist(async () => {
      const current = saveRef.current;
      if (!current.session || current.session.game.state.turn >= current.session.game.fixture.days) return;
      // Give the progress state one paint before running the synchronous turn.
      await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
      const start = performance.now();
      const game = advanceSociety(current.session.game);
      performance.measure('rulecraft.turn', { start, detail: { day: game.state.turn } });
      accept(await saves.commit(current, { ...current.session, game }));
      setFeedback(`Day ${game.state.turn} saved on this device.`);
      go({ name: 'results', id: String(game.state.turn) });
    });
  }

  const inspect = (id: string) => go({ name: 'inquiry', id });
  const share = (id: string) => go({ name: 'share', id });
  const reportDay = Number(screen.id);
  const today = narrative.incidents.filter(({ turn }) => turn === reportDay);
  const openResults = (day: number) => go({ name: 'results', id: String(day) });
  const openChronicle = () => go({ name: 'chronicle' });
  function story(incident: Incident, compact = false) {
    return session && <StoryCard key={incident.id} incident={incident} game={session.game} compact={compact} inspect={inspect} share={share} />;
  }
  const openGazette = (day = session?.game.state.turn ?? 0) => go({ name: 'gazette', id: String(day) });
  const blocked = busy || stale || !storageReady;
  return <>
    <a className="skip" href="#main-content">Skip to content</a>
    <header className="masthead">
      <div className="masthead-inner">
        <button className="wordmark" disabled={busy} onClick={() => go(homeScreen)}><span aria-hidden="true">R</span>Rulecraft</button>
        {screen.name !== 'home' && <button className="quiet" disabled={busy} onClick={() => setHistory(previous)}>Back</button>}
      </div>
    </header>
    <main id="main-content" className="shell" tabIndex={-1}>
      {problem && <div className="notice" role="alert"><p>{problem}</p>
        <button disabled={busy} onClick={() => void load()}>Reload saved village</button></div>}
      {draftProblem && <p className="notice" role="status">{draftProblem}</p>}
      {screen.name === 'composer' && draftSaved && <p className="muted draft-status" role="status">Draft saved separately on this device.</p>}
      {busy && <p className="notice" role="status">Working with your saved village…</p>}
      {feedback && !busy && <p className="notice" role="status">{feedback}</p>}
      {screen.name !== 'home' && session && <nav className="tabs" aria-label="Village navigation">
        <button disabled={busy} aria-current={screen.name === 'village' ? 'page' : undefined} onClick={() => go(villageScreen)}>Village</button>
        <button disabled={busy} aria-current={screen.name === 'book' || screen.name === 'composer' ? 'page' : undefined} onClick={() => go(bookScreen)}>Decree Book</button>
        <button disabled={busy} aria-current={screen.name === 'gazette' ? 'page' : undefined} onClick={() => openGazette()}>Gazette</button>
        <button disabled={busy} aria-current={screen.name === 'chronicle' ? 'page' : undefined}
          onClick={openChronicle}>Chronicle</button>
      </nav>}
      {screen.name === 'village' && session && <Village session={session}>
        <AdvancePanel key={session.id} day={session.game.state.turn} limit={session.game.fixture.days} busy={blocked} onAdvance={advance} />
        {session.game.state.turn > 0 && <button className="recent-results" onClick={() => openResults(session.game.state.turn)}>Latest day results</button>}
        {isMission(session)
          ? <MissionOverview session={session} openDay={openResults} openBook={() => go(bookScreen)} />
          : isExperiment(session) ? <>
            <ExperimentReport session={session} day={session.game.state.turn} openGazette={openGazette} />
            <RetryPanel key={session.id} session={session} start={start} busy={blocked} />
          </> : <TrialSummary session={session} />}
      </Village>}
      {screen.name === 'results' && session && <DayResults session={session} day={reportDay}
        inspect={inspect} openGazette={() => openGazette(reportDay)} story={today[0] ? story(today[0], true) : null}
        review={isMission(session) && (reportDay === checkpointDay || reportDay === session.game.fixture.days) ?
          <MissionReview session={session} day={reportDay} inspect={inspect} openBook={() => go(bookScreen)}
            openChronicle={openChronicle} hasStory={narrative.incidents.some(({ turn }) => turn <= reportDay)} />
          : isExperiment(session) && reportDay === session.game.fixture.days &&
            <ExperimentReport session={session} day={reportDay} openGazette={openGazette} />}
        next={session.setup && reportDay === session.game.fixture.days &&
          <RetryPanel key={session.id} session={session} start={start} busy={blocked} />} />}
      {screen.name === 'gazette' && session && <Gazette game={session.game} day={Number(screen.id)}
        onDay={(day) => setHistory((previous) => [...previous.slice(0, -1), { name: 'gazette', id: String(day) }])} inspect={inspect}
        stories={today.length ? today.map((incident) => story(incident))
          : <section className="panel"><h2>A quieter day in the village</h2><p>Browse the factual records below.</p></section>} />}
      {screen.name === 'chronicle' && session && <Chronicle game={session.game} incidents={narrative.incidents} inspect={inspect} share={share} />}
      {screen.name === 'share' && session && screen.id &&
        <ShareView key={screen.id} game={session.game} mode={session.mode} id={screen.id} />}
      {screen.name === 'inquiry' && session && screen.id && <Inquiry game={session.game} id={screen.id} inspect={inspect} />}
      {screen.name === 'book' && session &&
        <Book game={session.game} draft={draft} busy={blocked} onCompose={openComposer} onCommit={enact} />}
      {screen.name === 'composer' && session && draft &&
        <Composer key={draft.commandId} game={session.game} profile={editorProfile(session, session.setup)} draft={draft} busy={blocked}
          onChange={(next) => storeDraft(session.id, next)} onCommit={enact}
          onDiscard={() => { storeDraft(session.id, null); setHistory(previous); }} />}
      {screen.name === 'home' && <Home session={session} busy={blocked} onStart={start} onResume={() => go(villageScreen)} />}
    </main>
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
