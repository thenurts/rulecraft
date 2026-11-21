import type { SocietyGame, VillageEvent } from '@rulecraft/simulation';
import { reasonLabel } from './evidence.ts';
import { checkpointDay, foodReport, lessonWitnesses, repeatedMisses } from './mission.ts';
import { modeProfiles } from './profiles.ts';
import { citizenLabel, lawRefLabel, occupations, type GameSession } from './world.ts';

export function isMission(session: GameSession): boolean {
  return session.setup?.scenario === 'hungry-village';
}

export function MissionOverview({ session, openDay, openBook }: {
  session: GameSession; openDay(day: number): void; openBook(): void;
}) {
  const { game, mode } = session;
  const day = game.state.turn;
  const report = foodReport(game, day);
  return <section className="panel mission-panel">
    <h2>The Hungry Village</h2>
    <p className="mission-score">{report.fed} of {report.total} resident-days fully fed</p>
    {day === 0 ? <>
      <p>Food can be in the field, with growers or in the market. A resident needs food at the market and enough coins to buy a meal.</p>
      <p>The market starts with {game.fixture.opening.marketFood} food units. The fields hold {game.fixture.opening.fieldFood} harvestable units. A meal costs {game.fixture.economy.residentPrice} coins.</p>
      <details open={modeProfiles[mode].guidance === 'guided' || undefined}>
        <summary>Plan a first decree</summary>
        <p>Where might food get stuck? Choose one rule to try. Residents can learn about a confirmed rule from the next day and still make their own choices.</p>
        <button onClick={openBook}>Open Decree Book</button>
      </details>
    </> : <p>{report.observed} meal opportunities recorded so far.</p>}
    <div className="actions">
      {day >= checkpointDay && <button onClick={() => openDay(checkpointDay)}>Open day-six checkpoint</button>}
      {day === game.fixture.days && <button className="primary" onClick={() => openDay(day)}>Open day-12 debrief</button>}
    </div>
  </section>;
}

function Witnesses({ game, day, inspect }: { game: SocietyGame; day: number; inspect(id: string): void }) {
  const { harvest, delivery, informed, blocked, supply, affordability } = lessonWitnesses(game, day);
  function source(event: VillageEvent | undefined, label: string, detail: string) {
    return event && <li>
      <button data-witness-id={event.id} onClick={() => inspect(event.id)}>{label} · day {event.turn}</button>
      <p>{detail}</p>
    </li>;
  }
  return <ul className="list mission-witnesses">
    {source(harvest, 'Inspect a harvest', `A grower gathered ${harvest?.quantity} food units.`)}
    {source(delivery, 'Inspect a delivery', informed
      ? `${citizenLabel(informed.event.actorId)} knew ${lawRefLabel(game, informed.law.lawId, informed.law.version)} and completed a delivery of ${informed.event.quantity} food units.`
      : `${delivery?.quantity} food units moved from growers to the market.`)}
    {informed && <li><button data-witness-id={informed.notice.eventId}
      onClick={() => inspect(informed.notice.eventId)}>Inspect the delivery notice · day {informed.notice.learnedAtTurn}</button></li>}
    {source(blocked, 'Inspect a delivery barrier', `${reasonLabel(blocked?.reason ?? null)}.`)}
    {source(supply, 'Inspect a supply shortfall', 'A resident could pay for food that the market could not supply.')}
    {source(affordability, 'Inspect an affordability shortfall', affordability?.foodAccess?.marketAvailableBefore
      ? 'The market held food, and a resident lacked enough coins for a full meal.'
      : 'A resident lacked enough coins for a full meal.')}
  </ul>;
}

export function MissionReview({ session, day, inspect, openBook, openChronicle, hasStory }: {
  session: GameSession; day: number; inspect(id: string): void; openBook(): void; openChronicle(): void; hasStory: boolean;
}) {
  const { game, mode } = session;
  const final = day === game.fixture.days;
  const report = foodReport(game, day);
  const detailed = modeProfiles[mode].guidance === 'detailed';
  return <section className="panel mission-panel">
    <h2>{final ? 'Day-12 debrief' : 'Day-six checkpoint'}</h2>
    <p className="mission-score">{report.fed} of {report.observed} resident-days fully fed through day {day}</p>
    {!final && <p>{report.total} meal opportunities over the full mission.</p>}
    <dl className="mission-counts">
      <div><dt>Market supply shortfall</dt><dd>{report.supply} units residents could pay for but the market could not supply</dd></div>
      <div><dt>Affordability shortfall</dt><dd>{report.affordability} units residents could not pay for</dd></div>
      <div><dt>Repeated missed meals</dt><dd>{report.repeated.length} residents missed at least {repeatedMisses} meals</dd></div>
    </dl>
    {detailed && <p>{report.delivered} units delivered through day {day} · {report.closingStock} units in the market at day's end.</p>}
    <details open={detailed || undefined}><summary>Meals by occupation</summary>
      <ul className="list">
        {Object.entries(occupations).map(([role, label]) => {
          const group = report.residents.filter(({ occupation }) => occupation === role);
          return <li key={role}><strong>{label}</strong> · {group.reduce((sum, person) => sum + person.missed, 0)}
            {' '}meals missed across {group.length} residents</li>;
        })}
      </ul>
    </details>
    <details><summary>Individual meal records</summary>
      <p>{report.consecutive} residents missed {repeatedMisses} or more meals in a row.</p>
      <ul className="list">{report.repeated.map(({ id, missed, longest, lastMiss }) =>
        <li key={id}><button data-witness-id={lastMiss} onClick={() => lastMiss && inspect(lastMiss)}>
          {citizenLabel(id)} · {missed} missed · longest streak {longest}
        </button></li>)}</ul>
    </details>
    <details open={detailed || undefined}>
      <summary>Follow the evidence</summary>
      <Witnesses game={game} day={day} inspect={inspect} />
    </details>
    <p>{final ? 'What would you change on another run? Try changing one rule and compare the meals and deliveries.' :
      'Was food stuck with growers, missing from the market or out of reach for some residents? Use a record before changing your rule.'}</p>
    <div className="actions">
      <button onClick={openBook}>{final ? 'Review decree history' : 'Keep or revise a decree'}</button>
      {hasStory && <button onClick={openChronicle}>Open Chronicle</button>}
    </div>
  </section>;
}
