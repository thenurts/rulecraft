# Task 04 - Touch-first playable web experience

Implement mobile portrait-priority screens: Village, Decree Composer with dynamic typed dropdowns, Decree Book, Advance Day, Gazette, Royal Inquiry, Campaign and Sandbox start, Save/Resume. Use the existing headless kernel. No keyboard/hover/drag-only interactions for core play. Build interruption-safe snapshots and separate uncommitted drafts. Test at common phone widths and on actual Android/iOS browser devices when available. Keep native adapters behind interfaces.


## Detailed Task 04 product and engineering contract

See [docs/10_Task_04_Playable_Shell.md](../docs/10_Task_04_Playable_Shell.md). Follow the existing v3 simulation as source of truth and the approved source specifications; this document narrows the deliverable to a genuine touch-first vertical slice and does not authorise gameplay shortcuts.

**Four implementation increments:**
1. Home/start/resume and data-driven Village view with preview mode/track selection.
2. Decree Book, registry-driven composer, confirm/modify lifecycle, revisioned browser committed-save adapter and separate drafts.
3. Advance Day, factual result digest, Gazette and Royal Inquiry trace with event/ledger provenance, faithful legal/awareness/compliance labels.
4. Browser integration, phone-width accessibility, interruption/replay/performance tests and documented real-device checks.

**Important dependencies:** the merged Task 03 head still contains the education-versus-warning evidence issue, now tracked as GitHub issue #10. Correct it via separate small PR before rendering warning-risk claims in the UI. Campaign/Sandbox and Junior/Full starts in this milestone are **transparent previews**; final campaign objectives, tuned modes, humour and share content remain Tasks 05/06. No fake data and no purported native-device verification without actual tests.
