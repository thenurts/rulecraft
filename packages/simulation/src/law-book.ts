import {
  actionRegistry, isRecord, matchesPredicate, readOperand, targetMatches, validateLaw, villageScope,
  type LawAction, type LawAst, type LawIssue, type Modality, type Predicate, type PredicateFrame,
} from './law.ts';
import { compareIds, type Occupation } from './model.ts';
import { canonicalJson } from './snapshot.ts';

export type LawOperation = 'CREATE' | 'AMEND' | 'SUSPEND' | 'REINSTATE' | 'ABOLISH';
type LawStatus = 'active' | 'suspended' | 'abolished';

export interface LawRef { readonly lawId: string; readonly version: number }

export interface LawVersion extends LawRef {
  readonly ast: LawAst;
  readonly operation: LawOperation;
  readonly status: LawStatus;
  readonly commandId: string;
  readonly eventId: string;
  readonly confirmedAtTurn: number;
  readonly effectiveFromTurn: number;
}

export interface LawNotice extends LawRef {
  readonly citizenId: string;
  readonly learnedAtTurn: number;
  readonly learnedAtPhase?: 'dawn' | 'warning';
  readonly eventId: string;
}

export interface LawBook {
  readonly versions: readonly LawVersion[];
  readonly notices: readonly LawNotice[];
}

export type LawCommand = Readonly<{ commandId: string; lawId: string }> & (
  | Readonly<{ operation: 'CREATE' | 'AMEND'; ast: LawAst }>
  | Readonly<{ operation: 'SUSPEND' | 'REINSTATE' | 'ABOLISH' }>
);

const operations: readonly LawOperation[] = ['CREATE', 'AMEND', 'SUSPEND', 'REINSTATE', 'ABOLISH'];
const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{0,79}$/.test(value);

export class LawError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = 'LawError';
  }
}

export function authoritativeLaws(book: LawBook, turn: number): readonly LawVersion[] {
  const latest = new Map<string, LawVersion>();
  for (const version of book.versions) {
    if (version.effectiveFromTurn <= turn) latest.set(version.lawId, version);
  }
  return [...latest.values()];
}

export function noticeKnownAt(notice: LawNotice, turn: number): boolean {
  return notice.learnedAtTurn < turn || (notice.learnedAtTurn === turn && notice.learnedAtPhase === 'dawn');
}

export function perceivedLaws(book: LawBook, citizenId: string, turn: number): readonly LawVersion[] {
  const learned = new Map<string, number>();
  for (const notice of book.notices) {
    if (notice.citizenId === citizenId && noticeKnownAt(notice, turn)) learned.set(notice.lawId, notice.version);
  }
  return book.versions.filter(({ lawId, version, effectiveFromTurn }) =>
    learned.get(lawId) === version && effectiveFromTurn <= turn);
}

export function prepareLawCommand(book: LawBook, turn: number, input: unknown, allowance: number | null) {
  if (!isRecord(input) || !validId(input.commandId) || !validId(input.lawId) ||
      !operations.some((operation) => operation === input.operation)) throw new LawError('INVALID_COMMAND');
  const operation = input.operation as LawOperation;
  const { commandId, lawId } = input;
  const hasWording = operation === 'CREATE' || operation === 'AMEND';
  if (Object.keys(input).length !== (hasWording ? 4 : 3) ||
      Object.keys(input).some((key) => !['commandId', 'lawId', 'operation', ...(hasWording ? ['ast'] : [])].includes(key))) {
    throw new LawError('INVALID_COMMAND');
  }

  const upcoming = authoritativeLaws(book, turn + 1);
  const previous = upcoming.find((law) => law.lawId === lawId);
  const others = upcoming.filter((law) => law.lawId !== lawId && law.status === 'active');
  let issues: readonly LawIssue[] = [];
  let command: LawCommand;
  if (hasWording) {
    const validation = validateLaw(input.ast, others);
    if (!validation.ast) throw new LawError(validation.issues[0].code);
    command = { commandId, lawId, operation, ast: validation.ast };
    issues = validation.issues;
  } else {
    command = { commandId, lawId, operation };
  }

  const existing = book.versions.find((law) => law.commandId === commandId);
  if (existing) {
    if (existing.lawId !== lawId || existing.operation !== operation ||
        ('ast' in command && canonicalJson(existing.ast) !== canonicalJson(command.ast))) {
      throw new LawError('COMMAND_ID_REUSED');
    }
    return { book, command, version: existing, issues: [] };
  }
  if (operation === 'CREATE' ? previous !== undefined : previous === undefined) {
    throw new LawError(operation === 'CREATE' ? 'LAW_ID_IN_USE' : 'UNKNOWN_LAW');
  }
  if (previous?.status === 'abolished') throw new LawError('ABOLITION_IS_TERMINAL');
  if ((operation === 'SUSPEND' && previous?.status !== 'active') ||
      (operation === 'REINSTATE' && previous?.status !== 'suspended')) throw new LawError('INVALID_LAW_TRANSITION');
  if (allowance !== null && book.versions.filter((law) => law.confirmedAtTurn === turn).length >= allowance) {
    throw new LawError('TURN_ALLOWANCE_EXCEEDED');
  }

  const ast = 'ast' in command ? command.ast : previous!.ast;
  const status = operation === 'ABOLISH' ? 'abolished' : operation === 'SUSPEND' ? 'suspended' :
    operation === 'AMEND' ? previous!.status : 'active';
  if (operation === 'REINSTATE') issues = validateLaw(ast, others).issues;
  const version: LawVersion = Object.freeze({
    lawId, version: (previous?.version ?? 0) + 1, ast, commandId, operation, status,
    eventId: `law-event.${commandId}`, confirmedAtTurn: turn, effectiveFromTurn: turn + 1,
  });
  const nextBook = Object.freeze({ ...book, versions: Object.freeze([...book.versions, version]) });
  return { book: nextBook, command, version, issues };
}

export function addLawNotice(
  book: LawBook, turn: number, citizenId: string, lawId: string, version: number,
  phase?: LawNotice['learnedAtPhase'],
): LawBook {
  if (!book.versions.some((law) => law.lawId === lawId && law.version === version && law.confirmedAtTurn <= turn)) {
    throw new LawError('UNKNOWN_LAW_VERSION');
  }
  const prior = [...book.notices].reverse().find((notice) => notice.citizenId === citizenId && notice.lawId === lawId);
  if (prior?.version === version) return book;
  if (prior && prior.version > version) throw new LawError('OBSOLETE_NOTICE');
  const notice = Object.freeze({
    citizenId, lawId, version, learnedAtTurn: turn, ...(phase && { learnedAtPhase: phase }), eventId: `notice.${citizenId}.${lawId}.${version}`,
  });
  return Object.freeze({ ...book, notices: Object.freeze([...book.notices, notice]) });
}

export interface LegalFrame extends PredicateFrame {
  readonly turn: number;
  readonly occupation: Occupation;
  readonly jurisdictionId: string;
}

export type AuthorityRank = (issuerId: string, jurisdictionId: string) => number | undefined;
const villageAuthority: AuthorityRank = (issuer, jurisdiction) =>
  issuer === villageScope.issuerId && jurisdiction === villageScope.jurisdictionId ? 1 : undefined;

interface ClauseEvidence {
  readonly predicate: Predicate;
  readonly observed: number | 'morning' | 'afternoon';
  readonly matched: boolean;
}

interface RuleEvidence {
  readonly ref: LawRef;
  readonly eventId: string;
  readonly modality: Modality;
  readonly when: ClauseEvidence | null;
  readonly unless: ClauseEvidence | null;
  readonly applicable: boolean;
}

type LicenceEvidence =
  | Readonly<{ licence: 'not-required'; licenceRef: null; contributingLicence?: never }>
  | Readonly<{
    licence: 'granted' | 'missing';
    /** Highest-ranked applicable grant, including a grant blocked by a winning prohibition. */
    licenceRef: LawRef | null;
    /** Grant that supplies the licence for the final ruling. Null under a winning prohibition. */
    contributingLicence: LawRef | null;
  }>;

export type LegalDecision = LicenceEvidence & Readonly<{
  status: 'optional' | 'required' | 'prohibited' | 'unlicensed';
  unlicensedDuty: boolean;
  /** Winner of the same-action precedence contest. */
  winner: LawRef | null;
  /** Losing rules that do not contribute an effective licence. */
  overridden: readonly LawRef[];
  considered: readonly RuleEvidence[];
}>;

const modalityRank = { MUST_NOT: 3, MUST: 2, MAY: 1 };
const reference = ({ lawId, version }: LawVersion): LawRef => ({ lawId, version });

export function resolveLegality(
  candidates: readonly LawVersion[], frame: LegalFrame, action: LawAction,
  authority: AuthorityRank = villageAuthority,
): LegalDecision {
  const entry = actionRegistry[action];
  const considered: RuleEvidence[] = [];
  const applicable: { law: LawVersion; rank: number }[] = [];

  for (const law of [...candidates].sort((a, b) => compareIds(a.lawId, b.lawId) || b.version - a.version)) {
    const { ast } = law;
    const rank = authority(ast.issuerId, ast.jurisdictionId);
    if (rank === undefined || !Number.isSafeInteger(rank) || ast.jurisdictionId !== frame.jurisdictionId ||
        ast.actionId !== action || law.status !== 'active' || law.effectiveFromTurn > frame.turn ||
        !targetMatches(ast.targetSelector, frame.occupation) || !entry.eligible.includes(frame.occupation)) continue;
    const check = (predicate: Predicate | undefined): ClauseEvidence | null => {
      if (!predicate) return null;
      const observed = readOperand(predicate.operand, frame);
      return { predicate, observed, matched: matchesPredicate(predicate, observed) };
    };
    const when = check(ast.when);
    const unless = check(ast.unless);
    const applies = (when?.matched ?? true) && !(unless?.matched ?? false);
    considered.push({ ref: reference(law), eventId: law.eventId, modality: ast.modality, when, unless, applicable: applies });
    if (applies) applicable.push({ law, rank });
  }

  applicable.sort((a, b) => b.rank - a.rank || b.law.ast.priority - a.law.ast.priority ||
    modalityRank[b.law.ast.modality] - modalityRank[a.law.ast.modality] ||
    compareIds(a.law.lawId, b.law.lawId) || b.law.version - a.law.version);
  const winner = applicable[0]?.law;
  const grant = entry.licenceRequired ? applicable.find(({ law }) => law.ast.modality === 'MAY')?.law : undefined;
  const licence = entry.licenceRequired ? grant ? 'granted' : 'missing' : 'not-required';
  const modality = winner?.ast.modality;
  const status = modality === 'MUST_NOT' ? 'prohibited'
    : licence === 'missing' ? 'unlicensed'
    : modality === 'MUST' ? 'required' : 'optional';
  const contributingGrant = status === 'prohibited' ? undefined : grant;
  const licenceEvidence: LicenceEvidence = licence === 'not-required'
    ? { licence, licenceRef: null }
    : {
      licence,
      licenceRef: grant ? reference(grant) : null,
      contributingLicence: contributingGrant ? reference(contributingGrant) : null,
    };
  return {
    ...licenceEvidence,
    status, unlicensedDuty: licence === 'missing' && modality === 'MUST',
    winner: winner ? reference(winner) : null,
    overridden: applicable.slice(1).filter(({ law }) => law !== contributingGrant).map(({ law }) => reference(law)),
    considered,
  };
}
