# Task 02 - Typed rule grammar and lifecycle

Read GDD, Technical Systems and acceptance IDs. Implement a typed decree AST, capability registries, valid-next-token API, validation vs non-blocking warnings, deterministic precedence/conflict resolution, versions/history, create/amend/suspend/reinstate/abolish between turns, and exactly defined law activation/knowledge timing. Add the minimal legal influence needed to change citizen action scoring without arbitrary stat buffs.

Prove: incompatible dropdown descendants clear; legal-but-bad laws remain enactable; contradictory laws warn/resolve; law amendments and repeals preserve history, and legal knowledge is not equivalent to compliance. Tests must show outcome changes from law changes over matched seeds.

## Authoritative Task 02 implementation contract

Read [`docs/06_Task_02_Law_Semantics.md`](../docs/06_Task_02_Law_Semantics.md) before coding. This is the detailed lifecycle, conflict, licence, actual/perceived law and persistence acceptance contract. Preserve all non-negotiables in `AGENTS.md`. If edge-case proposals conflict with requirements, flag them for review and do not silently invent alternative semantics.

**Work in three increments:** (1) registry/AST/validation/token availability; (2) durable lifecycle, conflict resolution, knowledge history and save/replay; (3) minimal citizen-choice integration with matched-seed tests and factual legal provenance. Stop for product-owner review after Task 02.
