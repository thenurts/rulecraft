import { useState, type ReactNode } from 'react';
import { predicateRegistry, renderLaw, type LegalDecision, type SocietyGame, type VillageEvent } from '@rulecraft/simulation';
import { actionLabel, dayDigest, dispositionLabel, eventLabel, inquiryEvidence, outcomeLabel, reasonLabel } from './evidence.ts';
import { citizenLabel, lawRefLabel, villageReadModel, type GameSession } from './world.ts';

type OpenEvidence = (id: string) => void;
const signed = (value: number) => value > 0 ? `+${value}` : String(value);

export function AdvancePanel({ day, limit, busy, onAdvance }: {
  day: number; limit: number; busy: boolean; onAdvance: () => Promise<boolean>;
}) {
  const [review, setReview] = useState(false);
  const finished = day >= limit;
  return <section className="panel day-panel">
    <h2>{finished ? 'Trial complete' : `Ready for day ${day + 1}?`}</h2>
    {finished ? <p>The village has reached the end of this {limit}-day trial.</p> :
      review ? <div role="group" aria-label="Confirm day advancement">
        <p>The residents will act and the completed day will be saved on this device.</p>
        <div className="actions">
          <button className="primary" disabled={busy} onClick={() => void onAdvance().then((saved) => { if (saved) setReview(false); })}>Resolve day {day + 1}</button>
          <button disabled={busy} onClick={() => setReview(false)}>Cancel advance</button>
        </div>
      </div> : <button className="primary" disabled={busy} onClick={() => setReview(true)}>Advance day</button>}
  </section>;
}

function Heading({ children }: { children: ReactNode }) {
  return <h1 id="page-heading" tabIndex={-1}>{children}</h1>;
}

function ActionLink({ event, inspect }: { event: VillageEvent; inspect: OpenEvidence }) {
  return <button className="record" onClick={() => inspect(event.id)}>
    <strong>{eventLabel(event)}</strong>
    <span>{event.phase} · {outcomeLabel(event.status)}{event.reason ? ` · ${reasonLabel(event.reason)}` : ''}</span>
  </button>;
}

export function TrialSummary({ session }: { session: GameSession }) {
  const model = villageReadModel(session.game);
  if (model.remaining > 0) return null;
  return <section className="panel">
    <h2>Trial summary</h2>
    <p>{model.fed}/{model.mealOpportunities} citizen-days fully fed. {model.marketFood} units of market food remained.</p>
    {session.track === 'campaign' && <p>{model.fed * 10 >= model.mealOpportunities * 9 && model.marketFood >= 40
      ? 'This run met both provisional campaign targets.' : 'This run fell short of at least one provisional campaign target.'}</p>}
    <p>Return Home to start another trial.</p>
  </section>;
}

export function DayResults({ session, day, inspect, openGazette, story }: {
  session: GameSession; day: number; inspect: OpenEvidence; openGazette: () => void; story?: ReactNode;
}) {
  const digest = dayDigest(session.game, day);
  if (!digest) return <section className="panel"><Heading>Day results</Heading><p>No completed day to show.</p></section>;
  const { metrics, social } = digest;
  const { food, compliance } = social.metrics;
  return <>
    <header className="page-header">
      <p className="eyebrow">Completed day</p><Heading>Day {day} results</Heading>
      <p>{metrics.residentsFed}/{metrics.residentsFed + metrics.residentsUnmet} residents fully fed.</p>
    </header>
    {story}
    <section className="panel">
      <h2>Food and work</h2>
      <p>Market food {metrics.marketFood} units ({signed(digest.marketChange)} since this day opened). Delivered {metrics.foodDelivered}; consumed {metrics.foodConsumed}.</p>
      <p>{food.unableToAffordUnits} units unaffordable · {food.unavailableMarketUnits} unavailable for funded purchases.</p>
      <p>{food.undeliveredProducerUnits} food units still with growers · {food.blockedDeliveryAttempts} blocked delivery attempts.</p>
      <p>{metrics.guardsPaid} guards paid · {social.patrol.presence.length} completed patrols.</p>
    </section>
    <section className="panel">
      <h2>What residents knew and did</h2>
      <p>{digest.learnedAtDawn} decree-version notices learned at dawn · {social.experiences.filter(({ component }) => component === 'exertion').length} recorded exertion-related attitude changes.</p>
      <p>{compliance.completedDuties}/{compliance.knownFeasibleDuties} feasible perceived duties completed. {compliance.infeasibleDuties} known duties were infeasible.</p>
      <details><summary>Duty evidence</summary><p>{compliance.blockedDuties} blocked · {compliance.partialDuties} partial · {compliance.unchosenDuties} not chosen · {compliance.competingDutySlots} slots with competing duties. Perceived duties may include older rules.</p></details>
      <p>{social.patrol.prohibitedActs.length} currently prohibited acts performed · {social.patrol.investigations.length} investigations · {digest.education} education · {digest.warnings} formal warnings.</p>
    </section>
    <section className="panel records">
      <h2>Recorded events</h2>
      {digest.highlights.length ? digest.highlights.map((event) => <ActionLink key={event.id} event={event} inspect={inspect} />)
        : <p>No featured events for this day.</p>}
      <button onClick={openGazette}>Open Gazette</button>
    </section>
    <TrialSummary session={session} />
  </>;
}

export function Gazette({ game, day, onDay, inspect, stories }: {
  game: SocietyGame; day: number; onDay: (day: number) => void; inspect: OpenEvidence; stories?: ReactNode;
}) {
  const [all, setAll] = useState(false);
  const digest = dayDigest(game, day);
  return <>
    <header className="page-header"><p className="eyebrow">Village record</p><Heading>Gazette</Heading></header>
    {!digest ? <section className="panel"><h2>No completed days</h2><p>Advance a day to see recorded village events.</p></section> : <>
      <label>Report day<select value={day} onChange={({ target }) => { setAll(false); onDay(Number(target.value)); }}>
        {game.days.map(({ turn }) => <option key={turn} value={turn}>Day {turn}</option>)}
      </select></label>
      {stories}
      <section className="panel records">
        <h2>Day {day} events</h2>
        <p>{digest.events.length} recorded actions and outcomes · {digest.education} education · {digest.warnings} formal warnings.</p>
        {(all ? digest.events : digest.highlights).map((event) => <ActionLink key={event.id} event={event} inspect={inspect} />)}
        <button aria-expanded={all} onClick={() => setAll(!all)}>{all ? 'Show highlights' : 'Show all action records'}</button>
      </section>
      {!!digest.social.patrol.investigations.length && <section className="panel records">
        <h2>Patrol investigations</h2>
        {digest.social.patrol.investigations.map((entry) => <button className="record" key={entry.id} onClick={() => inspect(entry.id)}>
          <strong>{dispositionLabel(entry.disposition)} · {citizenLabel(entry.act.citizenId)}</strong>
          <span>{entry.act.slot} · {entry.act.action}</span>
        </button>)}
      </section>}
      {!!digest.social.news.length && <section className="panel">
        <h2>Decree news</h2><p>{digest.learnedAtDawn} notices learned at dawn.</p>
        <details><summary>Publication and learning records</summary><div className="records">
          {digest.social.news.filter((entry) => entry.type === 'publication' || entry.noticeId).map((entry) =>
            <button key={entry.id} className="record" onClick={() => inspect(entry.id)}>
              {entry.type === 'publication' ? 'Council publication' : citizenLabel(entry.citizenId)}
              {' · '}{lawRefLabel(game, entry.law.lawId, entry.law.version)}
            </button>)}
        </div></details>
      </section>}
    </>}
  </>;
}

function Reference({ id, label, inspect }: { id: string; label: string; inspect: OpenEvidence }) {
  return <button className="record reference" onClick={() => inspect(id)}><strong>{label}</strong><code>{id}</code></button>;
}

function Ruling({ title, decision, game, inspect }: {
  title: string; decision: LegalDecision; game: SocietyGame; inspect: OpenEvidence;
}) {
  return <section className="ruling">
    <h3>{title}</h3><p>{decision.status}</p>
    {!!decision.considered.length && <ul className="list">
      {decision.considered.map((entry) => <li key={entry.eventId}>
        <Reference id={entry.eventId} label={lawRefLabel(game, entry.ref.lawId, entry.ref.version)} inspect={inspect} />
        <p>{entry.applicable ? 'Applicable in this slot' : 'Inapplicable in this slot'}
          {decision.winner?.lawId === entry.ref.lawId && decision.winner.version === entry.ref.version ? ' · Precedence winner' : ''}
          {decision.overridden.some((ref) => ref.lawId === entry.ref.lawId && ref.version === entry.ref.version) ? ' · Overridden' : ''}
          {decision.contributingLicence?.lawId === entry.ref.lawId && decision.contributingLicence.version === entry.ref.version
            ? ' · Licence contribution' : ''}</p>
        {[entry.when, entry.unless].map((clause, index) => clause && <p key={index}>{index === 0 ? 'When' : 'Unless'} · {' '}
          {predicateRegistry[clause.predicate.operand].label} observed {clause.observed}. Clause {clause.matched ? 'matched' : 'did not match'}.</p>)}
      </li>)}
    </ul>}
  </section>;
}

export function Inquiry({ game, id, inspect }: { game: SocietyGame; id: string; inspect: OpenEvidence }) {
  const evidence = inquiryEvidence(game, id);
  if (!evidence) return <section className="panel"><Heading>Royal Inquiry</Heading><p>Evidence unavailable for this record.</p><code>{id}</code></section>;
  const { action, transaction, version, notice, news, inspection, allocations, encounters, occurrence, experience, noticeOrigin } = evidence;
  return <>
    <header className="page-header"><p className="eyebrow">Evidence</p><Heading>Royal Inquiry</Heading><code>{id}</code></header>
    {action && <>
      <section className="panel">
        <h2>{eventLabel(action)}</h2>
        <p>Day {action.turn} · {action.phase} · {outcomeLabel(action.status)}</p>
        {action.reason && <p>{reasonLabel(action.reason)}.</p>}
        {action.foodAccess && <p>{action.quantity} units eaten · {action.foodAccess.fundingShortfall} units unaffordable · {action.foodAccess.supplyShortfall} units unavailable.</p>}
        {action.fatigue && <p>Fatigue {action.fatigue.before} → {action.fatigue.after}.</p>}
        {action.hunger && <p>Hunger {action.hunger.before} → {action.hunger.after}.</p>}
      </section>
      <section className="panel">
        <h2>Choice and feasibility</h2>
        {action.choice ? action.choice.candidates.map(({ actionId, weight, selectionBarrier, utility }) =>
          <details key={actionId}><summary>{actionLabel(actionId)} · weight {weight}</summary>
            <p>{selectionBarrier ? reasonLabel(selectionBarrier) : 'Feasible at selection.'}</p>
            <p>Need {signed(utility.need)} · Income {signed(utility.income)} · Fatigue {signed(utility.fatigue)} · Trust {signed(utility.trust)} · Acceptance {signed(utility.acceptance)} · Risk {signed(utility.risk)}</p>
            {utility.riskEventIds.map((ref) => <Reference key={ref} id={ref} label="Recorded risk source" inspect={inspect} />)}
          </details>) : <p>Choice weights are unavailable for this record.</p>}
      </section>
      <section className="panel">
        <h2>Actual and perceived law</h2>
        {action.legalChoice?.length ? action.legalChoice.map((candidate) => <details key={candidate.actionId} open={candidate.actionId === action.action}>
          <summary>{actionLabel(candidate.actionId)}</summary>
          <Ruling title="Actual ruling" decision={candidate.actual} game={game} inspect={inspect} />
          <Ruling title="Perceived ruling" decision={candidate.perceived} game={game} inspect={inspect} />
          <p>Perceived decree pressure {signed(candidate.pressure)}{candidate.perceivedDutyOutcome ? ` · ${candidate.perceivedDutyOutcome.replaceAll('-', ' ')}` : ''}.</p>
          {candidate.noticeEventIds.map((ref) => <Reference key={ref} id={ref} label="Citizen notice" inspect={inspect} />)}
        </details>) : <p>No decree assessment was attached to this record.</p>}
      </section>
    </>}
    {version && <section className="panel">
      <h2>{lawRefLabel(game, version.lawId, version.version)}</h2><p>{renderLaw(version.ast)}</p>
      <p>{version.status} · effective from day {version.effectiveFromTurn}.</p>
    </section>}
    {notice && <section className="panel">
      <h2>Citizen notice</h2>
      <p>{citizenLabel(notice.citizenId)} learned {lawRefLabel(game, notice.lawId, notice.version)} on day {notice.learnedAtTurn}.</p>
      {noticeOrigin ? <Reference id={noticeOrigin.id} label="Notice source" inspect={inspect} /> : <p>No source record is available.</p>}
    </section>}
    {news && <section className="panel">
      <h2>{news.type === 'publication' ? 'Council publication' : 'Learning record'}</h2>
      <p>{lawRefLabel(game, news.law.lawId, news.law.version)} · {news.status} · dawn of day {news.turn}.</p>
      {news.type === 'publication' ? <Reference id={news.sourceEventId} label="Confirmed decree" inspect={inspect} />
        : news.learnedFrom
          ? <Reference id={news.learnedFrom.eventId} label={news.learnedFrom.peerId ? `Source peer · ${citizenLabel(news.learnedFrom.peerId)}` : 'Council bulletin'} inspect={inspect} />
          : <p>No notice learned in this trial.</p>}
    </section>}
    {(inspection || occurrence || encounters.length > 0) && <section className="panel records">
      <h2>Patrol evidence</h2>
      {occurrence && <p>Recorded as a performed prohibition. {occurrence.knewCurrentVersion ? 'Current version known.' : 'Current version not known.'}</p>}
      {inspection && <>
        <p>{dispositionLabel(inspection.disposition)} · {inspection.act.knewCurrentVersion ? 'Current version known at the time' : 'Current version not known at the time'}.</p>
        <Reference id={inspection.act.eventId} label="Performed action" inspect={inspect} />
        <Reference id={inspection.patrol.eventId} label="Completed patrol" inspect={inspect} />
        <Reference id={inspection.act.lawEventId} label="Current prohibition" inspect={inspect} />
        {inspection.noticeId && <Reference id={inspection.noticeId} label="Education notice" inspect={inspect} />}
      </>}
      {encounters.map((entry) => <Reference key={entry.id} id={entry.id} label={dispositionLabel(entry.disposition)} inspect={inspect} />)}
      {occurrence && encounters.length === 0 && <p>No investigation was recorded for this act.</p>}
    </section>}
    {!!allocations.length && <section className="panel">
      <h2>Shared allocation</h2>
      {allocations.map((allocation) => <details key={`${allocation.phase}-${allocation.resource}`}>
        <summary>{allocation.resource} · {allocation.reason}</summary>
        <p>{allocation.applicants.length} applicants. {allocation.winners.length} recorded awards.</p>
        <p>Applicants: {allocation.applicants.map(({ citizenId, requested }) => `${citizenLabel(citizenId)} (${requested})`).join(', ')}.</p>
        {allocation.winners.map((winner, index) => <Reference key={`${winner.eventId}-${index}`} id={winner.eventId}
          label={`${citizenLabel(winner.citizenId)} awarded ${winner.quantity}`} inspect={inspect} />)}
      </details>)}
    </section>}
    {transaction ? <section className="panel">
      <h2>Resource ledger</h2><p><code>{transaction.id}</code> · {transaction.reason}</p>
      <ul className="list">{transaction.legs.map((leg, index) => <li key={index}>
        <strong>{leg.quantity} {leg.resource}</strong>
        <span>{leg.from ? `From ${leg.from.accountId} · ${leg.from.before} → ${leg.from.after}` : 'Opening source'}</span>
        <span>{leg.to ? `To ${leg.to.accountId} · ${leg.to.before} → ${leg.to.after}` : 'Consumption sink'}</span>
      </li>)}</ul>
    </section> : action && <section className="panel"><h2>Resource ledger</h2><p>No transaction was recorded for this action.</p></section>}
    {!!experience.length && <section className="panel">
      <h2>Recorded experience</h2>
      {experience.map((entry, index) => <p key={index}>{entry.component === 'patrol-warning' && inspection?.disposition === 'education'
        ? 'Historical v3 education effect' : entry.component.replaceAll('-', ' ')} {signed(entry.change)}.</p>)}
    </section>}
  </>;
}
