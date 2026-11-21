import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  citizenLabel, homeScreen, modeLabel, newSession, occupations, previous, trackLabel, villageReadModel, villageScreen, visit,
  type GameSession, type Screen, type Selection,
} from './world.ts';
import './styles.css';

function PageHeading({ children }: { children: ReactNode }) {
  return <h1 id="page-heading" tabIndex={-1}>{children}</h1>;
}

function Home({ session, onStart, onResume }: {
  session: GameSession | null; onStart: (selection: Selection) => void; onResume: () => void;
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
      <button className="primary" onClick={onResume}>Resume village</button>
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
          <button className="primary" onClick={() => onStart(selection)}>Replace and start</button>
          <button onClick={() => setReplace(false)}>Cancel</button>
        </div>
      </div> : <button className={session ? '' : 'primary'} onClick={() => session ? setReplace(true) : onStart(selection)}>Start village</button>}
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

function App() {
  const [session, setSession] = useState<GameSession | null>(null);
  const [history, setHistory] = useState<readonly Screen[]>([homeScreen]);
  const screen = history[history.length - 1];
  const initialRender = useRef(true);
  const go = (destination: Screen) => setHistory((before) => visit(before, destination));
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    document.getElementById('page-heading')?.focus({ preventScroll: true });
  }, [screen]);
  function start(selection: Selection) {
    setSession(newSession(selection, crypto.randomUUID()));
    go(villageScreen);
  }
  return <>
    <a className="skip" href="#main-content">Skip to content</a>
    <header className="masthead">
      <div className="masthead-inner">
        <button className="wordmark" onClick={() => go(homeScreen)}><span aria-hidden="true">R</span>Rulecraft</button>
        {screen.name !== 'home' && <button className="quiet" onClick={() => setHistory(previous)}>Back</button>}
      </div>
    </header>
    <main id="main-content" className="shell">
      {screen.name === 'village' && session
        ? <Village session={session} />
        : <Home session={session} onStart={start} onResume={() => go(villageScreen)} />}
    </main>
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
