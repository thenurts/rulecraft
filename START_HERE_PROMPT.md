# First Codex prompt

You are the lead engineer for Rulecraft. Start by reading `AGENTS.md`, all three specifications in `docs/`, `docs/DECISIONS.md`, and `tasks/00_architecture_spike.md`.

Rulecraft is a standalone, mobile-first, comedically systemic governance game. The player can alter the world ONLY through typed, structured decrees. Autonomous citizens respond probabilistically but reproducibly; resources must be accounted for; every humorous narrative claim must be grounded in simulation events. The app has Junior and Full mode configurations, campaign and sandbox, and a future path to native Android/iOS.

TASK: Execute Task 00 only. First audit the specifications for blockers, contradictions and underspecified no-go decisions. Recommend an implementation stack with explicit trade-offs; I am leaning towards a standalone TypeScript simulation package, React/Vite mobile-first UI, Vitest and possibly Capacitor for native packaging, but treat this as a hypothesis to validate. Compare at least one appropriate game-engine alternative briefly.

Once you have a defensible choice, create ONLY the minimum runnable repository scaffold and mobile/web portability proof required by Task 00. Set up tests, documented run commands, architecture boundaries, and a decision log. Run actual commands and show their results. Do not build the entire game, invent feature scope or fabricate device-test results. Record open decisions and STOP for my approval before proceeding to Task 01.

When reporting back, include (1) architecture recommendation, (2) project structure, (3) commands/tests executed and pass/fail, (4) unresolved blockers requiring my decision, and (5) the proposed next implementation ticket.
