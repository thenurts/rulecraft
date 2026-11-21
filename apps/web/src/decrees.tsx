import { useState } from 'react';
import {
  actionRegistry, authoritativeLaws, predicateRegistry, renderLaw, validateLaw,
  updateLawDraft, villageScope, type LawAst, type LawCommand, type LawDraft, type LawIssue, type LawVersion,
  type SocietyGame,
} from '@rulecraft/simulation';
import type { DecreeDraft } from './draft-store.ts';
import { editorTokens, type EditorProfile } from './profiles.ts';
import { browserId, lawRefLabel, occupations } from './world.ts';

const subjects = { ...occupations, 'all-citizens': 'All citizens' };
const modalities = { MUST: 'Must', MUST_NOT: 'Must not', MAY: 'May' };
const operators = { LT: 'Below', LTE: 'At most', EQ: 'Equal to', GTE: 'At least', GT: 'Above' };
const operations = { SUSPEND: 'Suspend', REINSTATE: 'Reinstate', ABOLISH: 'Abolish' };
const issueCopy: Record<string, string> = {
  POTENTIAL_CONFLICT: 'The proposed decree may conflict with another decree for the same action.',
  COMPETING_DUTIES: 'An existing duty can compete for the same time slot.',
  REDUNDANT_PERMISSION: 'This action is ordinarily allowed already.',
  BROAD_REST_DUTY: 'Requiring everyone to rest may leave some work undone.',
  SELF_CANCELLING_CLAUSES: 'The condition and exception cancel each other.',
  INVALID_SELECTOR: 'Choose who the decree applies to.',
  INVALID_MODALITY: 'Choose Must, Must not or May.',
  ACTION_UNAVAILABLE: 'Choose an available action.',
  INVALID_PREDICATE: 'Complete or remove the condition or exception.',
  CAPABILITY_MISMATCH: 'That group cannot carry out this action.',
};

export function remainingChanges(game: SocietyGame): number | null {
  if (game.policy.changesPerTurn === null) return null;
  return Math.max(0, game.policy.changesPerTurn -
    game.book.versions.filter((law) => law.confirmedAtTurn === game.state.turn).length);
}

export function decreePreview(game: SocietyGame, draft: DecreeDraft) {
  const upcoming = authoritativeLaws(game.book, game.state.turn + 1);
  const prior = upcoming.find(({ lawId }) => lawId === draft.lawId);
  return validateLaw({ ...villageScope, ...draft.wording, priority: prior?.ast.priority ?? 0 },
    upcoming.filter((law) => law.status === 'active' && law.lawId !== draft.lawId));
}

export function newDraft(commandId: string, version?: LawVersion): DecreeDraft {
  const ast = version?.ast;
  const wording = ast ? updateLawDraft({}, {
    targetSelector: ast.targetSelector, modality: ast.modality, actionId: ast.actionId,
    ...(ast.when && { when: ast.when }), ...(ast.unless && { unless: ast.unless }),
  }) : {};
  return { commandId, lawId: version?.lawId ?? null, baseVersion: version?.version ?? null, wording };
}

export function usableDraft(game: SocietyGame, draft: DecreeDraft | null): boolean {
  if (!draft || game.book.versions.some(({ commandId }) => commandId === draft.commandId)) return false;
  if (draft.lawId === null) return draft.baseVersion === null;
  const target = authoritativeLaws(game.book, game.state.turn + 1).find(({ lawId }) => lawId === draft.lawId);
  return target !== undefined && target.version === draft.baseVersion && target.status !== 'abolished';
}

export function authoredCommand(draft: DecreeDraft, ast: LawAst, game: SocietyGame): LawCommand {
  const assigned = new Set(game.book.versions.map(({ lawId }) => lawId));
  let number = 1;
  while (assigned.has(`law-${number}`)) number++;
  return {
    commandId: draft.commandId, lawId: draft.lawId ?? `law-${number}`,
    operation: draft.lawId ? 'AMEND' : 'CREATE', ast,
  };
}

function Issues({ issues, game }: { issues: readonly LawIssue[]; game: SocietyGame }) {
  if (issues.length === 0) return null;
  return <ul className="issues">{issues.map((issue, index) =>
    <li key={`${issue.code}-${index}`}><strong>{issue.severity === 'WARNING' ? 'Warning' : 'Needs attention'}</strong>{' '}
      {issueCopy[issue.code] ?? issue.code}{issue.relatedLawId ? ` Related decree: ${lawRefLabel(game, issue.relatedLawId)}.` : ''}</li>)}</ul>;
}

type ClauseKey = 'when' | 'unless';

function Clause({ field, wording, options, onPatch, blocked }: {
  field: ClauseKey; wording: LawDraft; options: ReturnType<typeof editorTokens>[ClauseKey];
  onPatch(patch: LawDraft): void; blocked: boolean;
}) {
  if (options.operands.length === 0) return null;
  const value = wording[field];
  const title = field === 'when' ? 'When' : 'Unless';
  const patch = (clause: NonNullable<LawDraft[ClauseKey]> | undefined) => onPatch({ [field]: clause });
  return <fieldset disabled={blocked} className="clause">
    <legend>{title} <span className="muted">(optional)</span></legend>
    <label>{title} condition
      <select value={value?.operand ?? ''} onChange={({ target }) =>
        patch(target.value ? { operand: target.value as NonNullable<LawDraft[ClauseKey]>['operand'] } : undefined)}>
        <option value="">None</option>
        {options.operands.map((operand) => <option key={operand} value={operand}>{predicateRegistry[operand].label}</option>)}
      </select>
    </label>
    {options.operators.length > 0 && <label>{title} comparison
      <select value={value?.operator ?? ''} onChange={({ target }) =>
        patch({ operator: target.value as NonNullable<LawDraft[ClauseKey]>['operator'] })}>
        <option value="">Choose comparison</option>
        {options.operators.map((operator) => <option key={operator} value={operator}>{operators[operator]}</option>)}
      </select>
    </label>}
    {options.values?.choices && <label>{title} time
      <select value={value?.value ?? ''} onChange={({ target }) => patch({ value: target.value as 'morning' | 'afternoon' })}>
        <option value="">Choose time</option>
        {options.values.choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
      </select>
    </label>}
    {options.values?.unit && <div>
      <label>{title} threshold in {options.values.unit}
        <input type="number" inputMode="numeric" min="0" step="1" value={value?.value ?? ''}
          onChange={({ target }) => patch({ value: target.value === '' ? undefined : target.valueAsNumber })} />
      </label>
      <div className="actions">
        <button aria-label={`Decrease ${title.toLowerCase()} threshold`} onClick={() => patch({ value: Math.max(0, Number(value?.value ?? 0) - 1) })}>−1</button>
        <button aria-label={`Increase ${title.toLowerCase()} threshold`} onClick={() => patch({ value: Math.min(Number.MAX_SAFE_INTEGER, Number(value?.value ?? 0) + 1) })}>+1</button>
      </div>
    </div>}
  </fieldset>;
}

export function Composer({ draft, profile, game, busy, onChange, onCommit, onDiscard }: {
  draft: DecreeDraft; profile: EditorProfile; game: SocietyGame; busy: boolean;
  onChange(draft: DecreeDraft): void; onCommit(command: LawCommand): void; onDiscard(): void;
}) {
  const [reviewing, setReviewing] = useState(false);
  const { wording } = draft;
  const options = editorTokens(wording, profile, game.state.turn);
  const preview = decreePreview(game, draft);
  const canConfirm = preview.ast && remainingChanges(game) !== 0 && game.state.turn < game.fixture.days;
  const targetDay = game.state.turn + 1;
  function patch(next: LawDraft) {
    onChange({ ...draft, wording: updateLawDraft(wording, next) });
    setReviewing(false);
  }
  return <>
    <header className="page-header">
      <p className="eyebrow">Decree Book</p>
      <h1 id="page-heading" tabIndex={-1}>{draft.lawId ? 'Amend decree' : 'Compose decree'}</h1>
      <p>Draft · changes take effect from day {targetDay} after confirmation.</p>
    </header>
    <section className="panel">
      <fieldset disabled={busy} className="plain-fieldset">
        <legend className="sr-only">Decree wording</legend>
        <label>Who
          <select value={wording.targetSelector ?? ''} onChange={({ target }) => patch({ targetSelector: target.value as LawDraft['targetSelector'] })}>
            <option value="">Choose a group</option>
            {options.selectors.map((subject) => <option key={subject} value={subject}>{subjects[subject]}</option>)}
          </select>
        </label>
        <label>Rule
          <select disabled={!options.modalities.length} value={wording.modality ?? ''} onChange={({ target }) => patch({ modality: target.value as LawDraft['modality'] })}>
            <option value="">Choose a rule</option>
            {options.modalities.map((rule) => <option key={rule} value={rule}>{modalities[rule]}</option>)}
          </select>
        </label>
        <label>Action
          <select disabled={!options.actions.length} value={wording.actionId ?? ''} onChange={({ target }) => patch({ actionId: target.value as LawDraft['actionId'] })}>
            <option value="">Choose an action</option>
            {options.actions.map((action) => <option key={action} value={action}>{actionRegistry[action].label}</option>)}
          </select>
        </label>
      </fieldset>
      {profile.clauseDay > game.state.turn && <p className="muted">You can add a condition or exception after day {profile.clauseDay}.</p>}
      <Clause field="when" wording={wording} options={options.when} onPatch={patch} blocked={busy} />
      <Clause field="unless" wording={wording} options={options.unless} onPatch={patch} blocked={busy} />
    </section>
    <section className="panel">
      <h2>Decree preview</h2>
      <p className="decree-text" aria-live="polite">{preview.ast ? renderLaw(preview.ast) : 'Complete the wording to preview the decree.'}</p>
      <Issues issues={preview.issues} game={game} />
      {remainingChanges(game) === 0 && <p>Today’s decree allowance is used. Advance a day to make another change.</p>}
      {reviewing ? <div className="notice" role="group" aria-label="Final decree confirmation">
        <p>Confirm this wording for day {targetDay}. This uses one decree change.</p>
        <div className="actions">
          <button className="primary" disabled={busy || !canConfirm} onClick={() => preview.ast && onCommit(authoredCommand(draft, preview.ast, game))}>
            {draft.lawId ? 'Confirm amendment' : 'Confirm decree'}
          </button>
          <button disabled={busy} onClick={() => setReviewing(false)}>Keep editing</button>
        </div>
      </div> : <div className="actions">
        <button className="primary" disabled={busy || !canConfirm} onClick={() => setReviewing(true)}>Review decree</button>
        <button disabled={busy} onClick={onDiscard}>Discard draft</button>
      </div>}
    </section>
  </>;
}

type StatusOperation = keyof typeof operations;

export function Book({ game, draft, busy, onCompose, onCommit }: {
  game: SocietyGame; draft: DecreeDraft | null; busy: boolean;
  onCompose(version?: LawVersion): void; onCommit(command: LawCommand): Promise<boolean>;
}) {
  const [pending, setPending] = useState<{ command: LawCommand; operation: StatusOperation } | null>(null);
  const current = authoritativeLaws(game.book, game.state.turn);
  const next = authoritativeLaws(game.book, game.state.turn + 1);
  const hasDraft = usableDraft(game, draft);
  const canChange = !busy && remainingChanges(game) !== 0 && game.state.turn < game.fixture.days;
  return <>
    <header className="page-header">
      <PageTitle>Decree Book</PageTitle>
      <p>{remainingChanges(game) === null ? 'Decree changes are unlimited.' : `${remainingChanges(game)} decree changes left today.`}</p>
    </header>
    <div className="actions">
      <button className="primary" disabled={!canChange || hasDraft} onClick={() => onCompose()}>Compose decree</button>
      {hasDraft && <button disabled={busy} onClick={() => onCompose()}>Resume draft</button>}
    </div>
    {hasDraft && <p>Finish or discard your current draft before starting another.</p>}
    {!next.length && <section className="panel"><h2>No decrees yet</h2><p>Compose a decree to set a rule for the village.</p></section>}
    {next.map((law) => {
      const operative = current.find(({ lawId }) => lawId === law.lawId);
      const known = new Map(game.book.notices.filter(({ lawId }) => lawId === law.lawId)
        .map(({ citizenId, version }) => [citizenId, version]));
      const learned = [...known.values()].filter((version) => version === law.version).length;
      const older = [...known.values()].filter((version) => version < law.version).length;
      const attitudes = game.attitudes.filter((attitude) => attitude.lawId === law.lawId && attitude.version === law.version);
      return <article className="panel" key={law.lawId}>
        <h2>{lawRefLabel(game, law.lawId, law.version)}</h2>
        <p className="decree-text">{renderLaw(law.ast)}</p>
        <p>{law.effectiveFromTurn > game.state.turn
          ? `Confirmed for day ${law.effectiveFromTurn} · ${law.status}. ${operative ? `Version ${operative.version} is ${operative.status} through day ${game.state.turn}.` : 'No operative version yet.'}`
          : `Current status · ${law.status} from day ${law.effectiveFromTurn}.`}</p>
        <p>{learned}/{game.state.citizens.length} residents learned this version · {older} know an older version · {game.state.citizens.length - known.size} have no notice.</p>
        {attitudes.length > 0 && <details><summary>Recorded attitudes ({attitudes.length})</summary>
          <p>{attitudes.filter(({ score }) => score > 0).length} positive · {attitudes.filter(({ score }) => score === 0).length} neutral · {attitudes.filter(({ score }) => score < 0).length} negative.</p>
        </details>}
        {law.status !== 'abolished' && <div className="actions">
          <button disabled={!canChange || hasDraft} onClick={() => onCompose(law)}>Amend</button>
          {([law.status === 'suspended' ? 'REINSTATE' : 'SUSPEND', 'ABOLISH'] as const).map((operation) =>
            <button disabled={!canChange} key={operation} onClick={() => setPending({
              operation, command: { commandId: browserId(), lawId: law.lawId, operation },
            })}>{operations[operation]}</button>)}
        </div>}
        {pending?.command.lawId === law.lawId && <div className="notice" role="group" aria-label={`Confirm ${operations[pending.operation].toLowerCase()}`}>
          <p>{pending.operation === 'ABOLISH' ? 'Abolition is permanent. ' : ''}This takes effect on day {game.state.turn + 1} and uses one change.</p>
          <div className="actions">
            <button className="primary" disabled={!canChange} onClick={() => void onCommit(pending.command).then((ok) => { if (ok) setPending(null); })}>
              Confirm {pending.operation === 'ABOLISH' ? 'abolition' : pending.operation === 'SUSPEND' ? 'suspension' : 'reinstatement'}
            </button>
            <button disabled={busy} onClick={() => setPending(null)}>Cancel</button>
          </div>
        </div>}
        <details>
          <summary>Version history</summary>
          <ol className="list">{game.book.versions.filter(({ lawId }) => lawId === law.lawId).map((version) =>
            <li key={version.version}><strong>Version {version.version} · {version.status} · Day {version.effectiveFromTurn}</strong>
              <p>{renderLaw(version.ast)}</p><code>{version.eventId}</code></li>)}</ol>
        </details>
      </article>;
    })}
  </>;
}

function PageTitle({ children }: { children: string }) {
  return <h1 id="page-heading" tabIndex={-1}>{children}</h1>;
}
