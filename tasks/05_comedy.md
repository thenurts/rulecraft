# Task 05 - Four advisers and factual comedy

Implement event-derived incident families, adviser assignments, dialogue templates, repetition cooldowns, Royal Gazette, Chronicle and one exportable factual share card. All text must reference real source events/decree versions; use canonical The Nurts art only when explicitly supplied and approved. Ensure UI stays fast on mobile. Test no fabricated event claims and no personal data on cards.


## Task 05 detailed execution contract (product-owner review)

Read [docs/12_Task_05_Narrative_Advisers.md](../docs/12_Task_05_Narrative_Advisers.md). This milestone is **storytelling from the existing simulation**, never new gameplay physics or invented character speech.

**Four increments:** (1) typed incident predicates and source-provenance, (2) distinct fact-bound adviser/citizen-aside templates with deterministic selection and repetition control, (3) Gazette + Chronicle + factual locally exportable PNG card, (4) negative-truth tests, narrative coverage/repetition report, phone-browser and accessibility QA.

All four advisers must have identifiable voices: Zoey (economy), Liam (patrol/security), Mia (playful contradictions), Noah (wellbeing). No unapproved canonical The Nurts art. Unsupported exports/fines/rentals, arbitrary citizen emotions and direct citizen commands remain prohibited.

The Task 04 app is already playable. Preserve its functioning decree, day advancement, IndexedDB recovery, v3/v4 codec and factual inquiry flows; keep current golden replays intact. Complete implementation in a separate PR, with owner review before Task 06.
