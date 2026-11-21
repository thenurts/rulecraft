import { useMemo, useRef, useState } from 'react';
import { authoritativeLaws, type SocietyGame } from '@rulecraft/simulation';
import { lawRefLabel } from '../decrees.tsx';
import { advisers, type Adviser, type ReadingMode } from './copy.ts';
import { families, type Family } from './facts.ts';
import type { Incident } from './projection.ts';
import { buildShareCard, cardAsText, renderSharePng } from './share.ts';

type Open = (id: string) => void;
interface StoryLinks { game: SocietyGame; inspect: Open; share: Open }

export function StoryCard({ incident, game, inspect, share, compact = false }: StoryLinks & {
  incident: Incident; compact?: boolean;
}) {
  const current = authoritativeLaws(game.book, game.state.turn);
  return <article className="panel story-card" data-incident-id={incident.id} data-narrative-version={incident.narrativeVersion}>
    <p className="eyebrow">Day {incident.turn} · {families[incident.facts.family]}</p>
    <h2>{incident.headline}</h2>
    <p>{incident.summary}</p>
    <p className="story-response"><strong className="adviser-name">{advisers[incident.adviserId]}</strong>{' '}{incident.response}</p>
    {!compact && incident.caption && <p className="storybook"><strong>Storybook caption</strong>{' '}{incident.caption}</p>}
    <div className="actions">
      <button className="primary" onClick={() => inspect(incident.witnessEventIds[0])}>View evidence</button>
      <button onClick={() => share(incident.id)}>Open share card</button>
    </div>
    {!compact && <>
      {!!incident.lawVersionRefs.length && <div className="story-laws">
        {incident.lawVersionRefs.map(({ lawId, version }) => {
          const law = game.book.versions.find((record) => record.lawId === lawId && record.version === version);
          if (!law) return null;
          const active = current.some((record) => record.lawId === lawId && record.version === version && record.status === 'active');
          return <button key={law.eventId} onClick={() => inspect(law.eventId)}>
            {lawRefLabel(game, lawId, version)} · {active ? 'Operative' : 'Historical'}
          </button>;
        })}
      </div>}
      <details>
        <summary>{incident.strength === 'direct' ? 'Direct evidence' : 'Recorded circumstances'} · {incident.witnessEventIds.length} witnesses</summary>
        <ul className="list story-links">
          {[...incident.witnessEventIds, ...incident.relatedEventIds].map((id) =>
            <li key={id}><button className="record" onClick={() => inspect(id)}><code>{id}</code></button></li>)}
        </ul>
      </details>
    </>}
  </article>;
}

export function Chronicle({ incidents, ...links }: StoryLinks & { incidents: readonly Incident[] }) {
  const [day, setDay] = useState('');
  const [family, setFamily] = useState('');
  const [adviser, setAdviser] = useState('');
  const visible = incidents.filter((incident) =>
    (!day || incident.turn === Number(day)) && (!family || incident.facts.family === family) &&
    (!adviser || incident.adviserId === adviser));
  return <>
    <header className="page-header narrative-heading">
      <h1 id="page-heading" tabIndex={-1}>Royal Chronicle</h1>
      <p>Selected stories from completed days.</p>
    </header>
    {incidents.length > 0 && <div className="panel chronicle-filters">
      <fieldset className="plain-fieldset">
        <legend>Filter stories</legend>
        <div className="two-col">
          <label>Chronicle day<select value={day} onChange={({ target }) => setDay(target.value)}>
            <option value="">All days</option>
            {links.game.days.map(({ turn }) => <option key={turn} value={turn}>Day {turn}</option>)}
          </select></label>
          <label>Topic<select value={family} onChange={({ target }) => setFamily(target.value)}>
            <option value="">All topics</option>
            {Object.entries(families).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
          </select></label>
          <label>Adviser<select value={adviser} onChange={({ target }) => setAdviser(target.value)}>
            <option value="">All advisers</option>
            {Object.entries(advisers).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
          </select></label>
        </div>
      </fieldset>
      <p aria-live="polite">{visible.length} stories · {day ? `Day ${day}` : 'All days'} · {family ? families[family as Family] : 'All topics'} · {adviser ? advisers[adviser as Adviser] : 'All advisers'}</p>
    </div>}
    {visible.map((incident) => <StoryCard key={incident.id} incident={incident} {...links} />)}
    {visible.length === 0 && <section className="panel"><p>{incidents.length
      ? 'No selected stories match these filters.' : 'No selected stories from this village yet.'}</p></section>}
  </>;
}

export function ShareView({ game, mode, id }: { game: SocietyGame; mode: ReadingMode; id: string }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const card = useMemo(() => {
    try { return buildShareCard(game, mode, id); } catch { return null; }
  }, [game, mode, id]);

  async function download() {
    if (!card || lock.current) return;
    lock.current = true;
    setBusy(true);
    setStatus('');
    try {
      const link = document.createElement('a');
      if (!('download' in link) || typeof URL.createObjectURL !== 'function') {
        setStatus('This browser does not offer local PNG downloads. The card text is below.');
        return;
      }
      const start = performance.now();
      const blob = await renderSharePng(document.createElement('canvas'), card);
      const url = URL.createObjectURL(blob);
      try {
        link.href = url;
        link.download = `rulecraft-village-day-${card.turn}.png`;
        link.click();
        performance.measure('rulecraft.share.png', { start, detail: { bytes: blob.size } });
        setStatus('PNG download requested. The card text is available below.');
      } finally {
        // Let the browser read the blob after the download event.
        setTimeout(() => URL.revokeObjectURL(url), 15_000);
      }
    } catch {
      setStatus('The PNG could not be prepared. The card text is available below.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return <>
    <header className="page-header narrative-heading"><h1 id="page-heading" tabIndex={-1}>Share card</h1></header>
    {!card ? <section className="panel"><p>This incident has no verified card.</p></section> : <>
      <figure className="panel share-preview" aria-label="Share card text preview">
        <figcaption>{card.heading}</figcaption>
        {card.sections.map(({ label, text }) => <section key={label}><h2>{label}</h2><p>{text}</p></section>)}
        <p className="muted">{card.footer}</p>
      </figure>
      <section className="panel share-export">
        <button className="primary" disabled={busy} onClick={() => void download()}>{busy ? 'Preparing PNG…' : 'Download PNG'}</button>
        {status && <p className="notice" role="status">{status}</p>}
        <details><summary>Selectable card text</summary>
          <textarea aria-label="Card text" readOnly value={cardAsText(card)} rows={8} />
        </details>
      </section>
    </>}
  </>;
}
