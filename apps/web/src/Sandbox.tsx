import { foodReport } from './mission.ts';
import { presets } from './profiles.ts';
import type { GameSession } from './world.ts';

export function isExperiment(session: GameSession): boolean {
  return session.setup?.scenario === 'sandbox-experiment';
}

export function ExperimentReport({ session, day, openGazette }: {
  session: GameSession; day: number; openGazette(day: number): void;
}) {
  const { game, setup } = session;
  if (!setup) return null;
  const final = day === game.fixture.days;
  const report = foodReport(game, day);
  return <section className="panel experiment-panel">
    <h2>{final ? 'Experiment complete' : 'Sandbox experiment'}</h2>
    <p>{presets[setup.preset].label} · Seed {setup.seed} · {game.fixture.days} days</p>
    <p>Choose a decree to try and compare the recorded outcomes. This experiment has no victory target.</p>
    {day > 0 && <>
      <p>{report.fed} of {report.observed} resident-days fully fed · {report.delivered} food units delivered through day {day}.</p>
      <p>{report.supply} units unavailable for funded meals · {report.affordability} units residents could not afford.</p>
      <details><summary>Compare days</summary>
        <ol className="list">
          {game.days.filter(({ turn }) => turn <= day).map(({ turn, residentsFed, residentsUnmet, foodDelivered, marketFood }) =>
            <li key={turn}>
              <p>Day {turn} · {residentsFed} of {residentsFed + residentsUnmet} fed · {foodDelivered} units delivered · {marketFood} units in the market at close.</p>
              <button onClick={() => openGazette(turn)}>Open Gazette for day {turn}</button>
            </li>)}
        </ol>
      </details>
    </>}
    {final && <p>Retry with the same seed and change one decree to compare runs, or use a different seed to explore new outcomes.</p>}
  </section>;
}
