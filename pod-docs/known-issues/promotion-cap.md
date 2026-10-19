# Promotion is capped at 4 pieces per type

_Seen: 2026-06-04 · special-moves sprint · Noted on the 2026-10-03 roadmap_

**Symptom:** the piece ids in `src/game/engine/moves/promotion.ts` allow 4 promoted pieces of each type per side (`*Promoted1` to `*Promoted4`). A fifth promotion to the same type reuses the `*Promoted4` id, so two pieces share an id. Normal games never get there.

**When it bites:** anything that plays out many moves on our rules engine, such as a search written on `src/game/engine/`, can reach it. Stockfish runs its own search, so today's opponent doesn't.

**Fix before such work:** remove the cap in `promotion.ts`.
