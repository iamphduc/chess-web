# Sprint: Human moves after his book

_From plan: docs/plans/human-style-strength.md · Slug: human-moves · Status: done · Generated: 2026-10-11_
<!-- autopilot-run: started=2026-10-12T06:48:42Z sprints=0 waves=3 -->

## Status board

| Wave | Slice | Title | Branch | PR | Status | Confidence | Depends on |
|------|-------|-------|--------|----|--------|------------|------------|
| 1 | H1 | Move chooser, material check and step table | human-moves-H1 | #65 | done | medium | — |
| 1 | L1 | Look: neutral "Stockfish" pill style | human-moves-L1 | #65 | done | high | — |
| 2 | E1 | MultiPV engine output, wired into the opponent | human-moves-E1 | #66 | done | medium | H1 |
| 2 | U1 | Stockfish disclosure, "about" labels, README | human-moves-U1 | #66 | done | medium | L1 |
| 3 | K1 | Calibration script, first table values, play check | human-moves-K1 | #67 | done | medium | H1, E1 |

Plan branch `human-style-strength`; wave heads `human-moves-w1`, `human-moves-w2`, `human-moves-w3`.

## Shared contract

### Values in use
Every "(default)" in the plan's Key decisions stands (the human said "go with all your recommendations"). Steps are approximate, with no Lichess or chess.com claim. Moves after his book come from **standard Stockfish 18**, not fine-tuned or trained on his games; the UI and README say so. The "deeper check of the picked move" mitigation is not built in this sprint.

### Line types (`src/game/opponent/engine/lines.ts`, H1)
```ts
type Score = { cp: number } | { mate: number };          // side to move's view; mate N > 0 = he mates in N moves, N < 0 = he is mated
interface EngineLine { move: string; score: Score; depth: number }   // move = first PV move, UCI
interface SearchLimits { depth: number; multiPv: number; movetimeMs: number }
```
This file imports nothing, so `liemTurn` can pull the table into the entry bundle without Stockfish.

### Win % (`src/game/opponent/human-move.ts`, H1)
- `winPercent(score)`: cp → `50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)`; `mate > 0` → 100; `mate < 0` → 0.
- A line's **loss** = best win % among the lines still in play − its win %, in win % points (0 to 100).
- `AHEAD_WIN = 85`: when the best line's win % is 85 or more, he is "well ahead".

### Step profiles (`src/game/opponent/step-profiles.ts`, H1 sets guesses; K1 sets the calibrated values)
```ts
interface StepProfile {
  search: SearchLimits;   // depth 1–20, multiPv 1–6, movetimeMs 100–1000 (the backstop)
  maxLoss: number;        // normal loss limit, win % points, ≥ 0
  temperature: number;    // weight = exp(-loss / temperature); 0 = only loss-0 lines
  slipChance: number;     // 0–1, chance per move of a rare bigger slip
  slipMaxLoss: number;    // slip limit, ≥ maxLoss
  aheadMaxLoss: number;   // limit while well ahead, ≤ maxLoss
  forceMateIn: number;    // always plays a seen mate in ≤ this many moves; Infinity = any; 0 = never forced
}
const STEP_PROFILES: Readonly<Record<StrengthStep, StepProfile>>;
```
Table rules (checked by H1's test, which K1 must keep passing): going up the steps, `search.depth` never falls, and `maxLoss`, `slipChance`, `slipMaxLoss` and `temperature` never rise; `full` has `slipChance` 0 and `forceMateIn` Infinity; every step has `forceMateIn` ≥ 1 (no step misses a mate in 1).

### The chooser (`chooseHumanMove`, H1)
`chooseHumanMove(lines: readonly { move: string; score: Score }[], state: GameState, profile: StepProfile, random: () => number): string | null` returns a UCI move from `lines`, or `null` when no line is legal in `state` (including no lines). `EngineLine` fits the input by shape. Its rule order and edges are in H1's Scope.

### Material check (`src/game/opponent/material.ts`, H1)
`hangsMaterial(state, move): boolean`, with values P 1, N 3, B 3, R 5, Q 9 (king never captured). After `move`, take each legal reply of the other side that captures one of the mover's pieces: its gain is the captured value, less the capturer's value if the mover then has a legal capture back on that square. `move` hangs material when the biggest gain, less what `move` itself captured (a promotion adds the new piece's value − 1), is **2 or more**. So a lone pawn left hanging is allowed; a piece for nothing, or a rook for a minor, is not. One exchange deep only.

### Engine boundary (`src/game/opponent/engine/move-engine.ts`, E1)
```ts
interface Analysis { lines: EngineLine[]; bestMove: string | null }  // lines in multipv order; bestMove null = "bestmove (none)"
interface MoveEngine {
  analyse(fen: string, limits: SearchLimits, signal?: AbortSignal): Promise<Analysis>;
  newGame(): void;
  dispose(): void;
}
```
`bestMove`, `clampElo`, `ELO_MIN` and `ELO_MAX` are gone. The app never sends `UCI_LimitStrength` or `UCI_Elo`. Abort, timeout (no `bestmove` within `movetimeMs + 5000`), failure and dispose keep their codes and rules from `liem-book`.

### The opponent (`src/game/opponent/opponent.ts`, E1)
- `OpponentSettings = { profile: StepProfile; clock: GameClock | null; random?: () => number }` (`elo` is gone). `random` (default `Math.random`) feeds both the book pick and the chooser.
- `MoveChoice` gains `lines?: readonly EngineLine[]`: the analysis behind an engine move, absent for a book move.
- `liemTurn` sets `profile: STEP_PROFILES[match.strength]`.

### Disclosure text and hooks (U1)
- Setup card line, under the steps and above Start game: **"Openings from his games, then standard Stockfish 18 at this strength."**
- Out-of-book note: title "Out of his book", text **"Standard Stockfish 18 plays from here. It isn't trained on his games."**
- His card, out of book and not thinking: a pill `<span class="liem-badge liem-badge--engine" data-engine="stockfish">Stockfish</span>` where the "★ Book · N" badge sits.
- `strengthLabel(step, rating)` (`strength.ts`): `"about 1400"`; `"full"` → `"about <rating>"`. His card reads "GM · playing about 2100".

## Per-slice detail

### H1: Move chooser, material check and step table
- **Scope:** Build the contract's line types, `winPercent`, `AHEAD_WIN`, `chooseHumanMove`, `hangsMaterial`, `StepProfile` and `STEP_PROFILES` with starting guesses (research: 1400 near a 12 win % limit with a high temperature, Full near 0; depth rising with the step). Pure TypeScript, relative imports only, no React, no engine calls. Don't touch the opponent or the engine adapter. `chooseHumanMove` applies these rules in order:
  1. Drop lines whose move `uciToMove` rejects. None left → `null`.
  2. **Seen mate:** any line with `0 < mate ≤ forceMateIn` → play the smallest such mate (ties: earlier line). No `random()` draw.
  3. **Mate avoidance:** if any line isn't a negative mate, drop every negative-mate line. If all are, play the one with the largest `|mate|` (ties: earlier line).
  4. **Material:** drop each line except the best (highest win %, ties: earlier) that `hangsMaterial`. This holds on slips too.
  5. **Well ahead** (best win % ≥ `AHEAD_WIN`): the limit is `aheadMaxLoss` and there's no slip.
  6. **Slip:** if a slip is possible (not ahead, `slipChance > 0`, and at least one line has `maxLoss < loss ≤ slipMaxLoss`), the first `random()` decides it (`< slipChance` slips). On a slip the candidates are only those band lines.
  7. **Pick:** otherwise the candidates are lines with `loss ≤` the limit (the best is always one). The next `random()` picks by weight `exp(-loss / temperature)`, in line order, taking the first whose running share passes the draw (the book pick's rule). Temperature 0 → loss-0 lines only, equally weighted.
- **Files owned:** `src/game/opponent/engine/lines.ts` (new), `src/game/opponent/human-move.ts` (new), `src/game/opponent/material.ts` (new), `src/game/opponent/step-profiles.ts` (new), `src/game/opponent/__tests__/human-move.test.ts` (new), `src/game/opponent/__tests__/material.test.ts` (new), `src/game/opponent/__tests__/step-profiles.test.ts` (new)
- **Success criteria:**
  - `[test]` 0 cp is 50, 100 cp ≈ 59.1, 300 cp ≈ 75.1, −100 cp ≈ 40.9, mate > 0 is 100, mate < 0 is 0 — human-move.test.ts › win percent follows the Lichess formula
  - `[test]` with no slip drawn, no pick has a loss past `maxLoss` over 1,000 seeded calls — human-move.test.ts › never picks past the loss limit without a slip
  - `[test]` on a slip the pick's loss is above `maxLoss` and at most `slipMaxLoss` — human-move.test.ts › a slip picks only between the limit and the slip limit
  - `[test]` with no line in the slip band, no slip draw is made and the pick is normal — human-move.test.ts › a slip with no line in its band picks normally
  - `[test]` 10,000 seeded picks over lines with losses 0, 2 and 5 at temperature 2 match `exp(-loss/2)` shares within 2 points — human-move.test.ts › picks split by exp(-loss/temperature)
  - `[test]` temperature 0 plays only loss-0 lines — human-move.test.ts › temperature 0 always plays the best line
  - `[test]` a mate-in-N-against line is never picked while a line without one exists, even on a slip — human-move.test.ts › never plays into a forced mate while another move avoids it
  - `[test]` all lines mated → the longest mate — human-move.test.ts › when every line is mated, plays the longest mate
  - `[test]` mate in 1 and mate in 3 with `forceMateIn` Infinity → mate in 1, with no `random()` call — human-move.test.ts › plays the shortest mate within forceMateIn
  - `[test]` mate in 4 with `forceMateIn` 2 goes to the weighted pick — human-move.test.ts › a mate longer than forceMateIn is not forced
  - `[test]` a second-best line that hangs a knight is never picked, on a slip or not — human-move.test.ts › never hangs material for nothing, even on a slip
  - `[test]` the best line is kept even when `hangsMaterial` flags it — human-move.test.ts › the best line is never dropped for material
  - `[test]` best at 90 win %: picks stay within `aheadMaxLoss` and no slip draw is made — human-move.test.ts › when well ahead, picks within aheadMaxLoss and never slips
  - `[test]` illegal lines are dropped; no legal line or no lines → `null` — human-move.test.ts › drops illegal lines and returns null when none is legal
  - `[test]` an undefended knight left attacked hangs — material.test.ts › an undefended piece left en prise hangs
  - `[test]` a defended queen attacked by a pawn hangs — material.test.ts › a piece attacked by a cheaper piece hangs
  - `[test]` NxN with the knight recaptured doesn't hang; QxP into a defended square does — material.test.ts › what the move captured counts
  - `[test]` a lone pawn left hanging is not a hang — material.test.ts › a pawn is under the threshold
  - `[test]` a pinned piece doesn't count as the capture back — material.test.ts › only legal captures back defend
  - `[test]` every step is within the contract bounds — step-profiles.test.ts › every step has a profile within the bounds
  - `[test]` the table rules in the contract hold — step-profiles.test.ts › stronger steps never search shallower or allow bigger losses
  - `[test]` `full` never slips and always plays a seen mate; every step plays a mate in 1 — step-profiles.test.ts › mate and slip rules per step
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### L1: Look: neutral "Stockfish" pill style
- **Scope:** Add `.liem-badge--engine` to `src/styles/liem.css`: the badge's shape and size, with text `var(--liem-text-soft)` on `var(--liem-note)` and a `var(--liem-line)` border, so gold stays for his book (plan `## Look`). No new tokens or colors; the token values, self-hosted fonts and other classes stay as they are. No other slice edits `liem.css` or `index.css`.
- **Files owned:** `src/styles/liem.css`, `tests/liem-theme.test.ts`
- **Success criteria:**
  - `[test]` `.liem-badge--engine` sets color, background and border from those three tokens only — tests/liem-theme.test.ts › engine pill uses the neutral tokens
  - `[test]` soft text on `--liem-note` is 4.5:1 or more — tests/liem-theme.test.ts › engine pill text meets 4.5:1
  - `[test]` the tokens keep the Look values — tests/liem-theme.test.ts › liem tokens have the Look values
  - `[test]` `.liem-badge--engine` is in the contract classes and the file still uses only tokens — tests/liem-theme.test.ts › base control styles use only tokens
  - `[test]` Quicksand is still served from the app — tests/theme.test.ts › quicksand is served from the app
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### E1: MultiPV engine output, wired into the opponent
- **Scope:** Replace `bestMove` with `analyse` per the contract. The handshake is `uci` → `uciok` → `isready`, with no strength options. Before each search, send `setoption name MultiPV value N` when N differs from the last value sent (always on the first search), then `position fen …` and `go depth D movetime T`. From `info` lines, keep per `multipv` index (missing = 1) the latest line that has `depth`, `score cp|mate` and a `pv`; skip `lowerbound`/`upperbound` scores, `info string` and lines with no `pv`; drop indexes past N. Info lines count only for the active search, never while a stale `bestmove` is owed. A depth that's 0, not a whole number or over 30, a `multiPv` outside 1–6, or a NaN or non-positive `movetimeMs` rejects with a `RangeError` and sends nothing. In `opponent.ts`, off book: `analyse(toFen(state), profile.search)` → `chooseHumanMove(lines, state, profile, random)` → else `bestMove` → `uciToMove`; a `null` or illegal result asks once more, then rejects `illegal-engine-move`. Return `lines` on engine moves. `liemTurn` sets the profile and drops its `rating` argument (update the call site). **Queue fold-in:** map `engine-timeout` to `retry-fresh` in `opponentController.ts`, since a hung search can no longer be trusted with the new backstop (queue 2026-10-10 entry). Add a `docs/decisions.md` entry that replaces the `UCI_Elo` part of "Stockfish lite WASM, single thread, in a Web Worker, behind `MoveEngine`" (pick among Stockfish's top lines; why: the research).
- **Files owned:** `src/game/opponent/engine/move-engine.ts`, `src/game/opponent/engine/uci-engine.ts`, `src/game/opponent/engine/__tests__/uci-engine.test.ts`, `src/game/opponent/opponent.ts`, `src/game/opponent/__tests__/opponent.test.ts`, `src/features/liem/liemTurn.ts`, `src/features/liem/__tests__/liem-turn.test.ts`, `src/features/liem/opponentController.ts`, `src/features/liem/__tests__/opponent-controller.test.ts`, `src/features/liem/useLiemOpponent.ts`, `tests/stockfish-engine.test.ts`, `docs/decisions.md`
- **Success criteria:**
  - `[test]` no `UCI_LimitStrength` or `UCI_Elo` line is ever sent — uci-engine.test.ts › handshake sends uci then isready and no strength options
  - `[test]` a search sends MultiPV, `position fen` and `go depth D movetime T` — uci-engine.test.ts › analyse sends MultiPV, position and go depth with movetime
  - `[test]` MultiPV is sent again only when it changes — uci-engine.test.ts › MultiPV is sent only when it changes
  - `[test]` cp and mate lines, the latest per index, bound and string lines skipped, multipv order — uci-engine.test.ts › collects the latest scored line per multipv
  - `[test]` lines with an index past N are dropped — uci-engine.test.ts › drops lines past the requested multipv
  - `[test]` `bestmove (none)` → `{ lines: [], bestMove: null }` — uci-engine.test.ts › bestmove none resolves no lines
  - `[test]` info lines after an abort never reach the next search — uci-engine.test.ts › info lines from an aborted search are dropped
  - `[test]` bad limits reject with `RangeError` and send nothing — uci-engine.test.ts › rejects bad limits without sending anything
  - `[test]` no `bestmove` within `movetimeMs + 5000` rejects `timeout` (kept) — uci-engine.test.ts › no bestmove within movetime + 5000 ms rejects timeout
  - `[test]` the real lite WASM gives 4 scored, distinct legal lines at depth 8 — tests/stockfish-engine.test.ts › real engine returns 4 scored lines
  - `[test]` the real engine reports `mate 1` on a mate-in-1 position — tests/stockfish-engine.test.ts › real engine reports mate in 1
  - `[test]` `depth 30, movetime 300` resolves within 3 s — tests/stockfish-engine.test.ts › real engine stops at the movetime backstop
  - `[test]` off book it sends the step's limits and plays the chooser's pick, with `lines` returned — opponent.test.ts › off book, plays the chooser's pick from the step's search
  - `[test]` no chooser pick → `bestMove` is played — opponent.test.ts › falls back to bestMove when the chooser has no pick
  - `[test]` illegal twice → `illegal-engine-move`, asking only twice — opponent.test.ts › rejects illegal-engine-move after two bad answers, asking only twice
  - `[test]` book moves never call `analyse` — opponent.test.ts › returns a weighted book move with the lookup, and never calls the engine
  - `[test]` 1400 → `STEP_PROFILES[1400]`, full → `STEP_PROFILES.full` — liem-turn.test.ts › maps the strength step to its profile
  - `[test]` `engine-timeout` → failed, old opponent disposed, retry loads a fresh one — opponent-controller.test.ts › engine-timeout → failed, retry loads a fresh opponent
- **Depends on:** H1
- **One-way door:** none
- **Model:** opus

### U1: Stockfish disclosure, "about" labels, README
- **Scope:** Add the contract's setup card line (styled `liem-card__sub`, 16/500 soft), the note's out-of-book text, the "Stockfish" pill and `strengthLabel`, used on the setup card value and his card's line. `liemBadge` returns `{ kind: "book"; games } | { kind: "engine" } | null`: book in book, engine out of book, else `null`. "Thinking…" still replaces either. Use only the `--liem-*` tokens and the Look; no new colors. The line must fit inside the 312 px board up to 767 px: tighten the narrow block's spacing if needed, keeping text ≥ 14 px and taps ≥ 40 px. **Fold-in:** fix the "600 px" comment in `SetupCard.css` to name 767 px. `tests/build.test.ts`'s lazy check rejects the word "stockfish" in the entry chunk, which the new UI text breaks: check instead for engine code (`stockfish-18-lite-single` and `uciok`). README: a short "How he plays" section (his openings from his book; after that standard Stockfish 18, not trained on his games, picking among its top moves within the step's limit; steps are approximate). In `docs/codebase-structure.md`, add the pill, setup line and note text to the vs-Liem smoke recipe.
- **Files owned:** `src/game/opponent/strength.ts`, `src/game/opponent/__tests__/strength.test.ts`, `src/features/liem/components/SetupCard.tsx`, `src/features/liem/components/SetupCard.css`, `src/features/liem/components/LiemCardDetail.tsx`, `src/features/liem/components/BookNote.tsx`, `src/features/liem/bookNote.ts`, `src/features/liem/__tests__/book-note.test.ts`, `src/features/liem/__tests__/book-note-render.test.tsx`, `src/features/liem/__tests__/setup-card.test.tsx`, `tests/build.test.ts`, `tests/setup-card-css.test.ts`, `README.md`, `docs/codebase-structure.md`
- **Success criteria:**
  - `[test]` "about 1400" … "about 2500", full → "about 2732" — strength.test.ts › labels each step as about its Elo
  - `[test]` the line sits after the steps and before Start game, with the contract's words — setup-card.test.tsx › shows the Stockfish line under the steps, above Start game
  - `[test]` the value reads "about 2100", and Full shows "Full" and "about 2732" — setup-card.test.tsx › shows about before the Elo
  - `[test]` in book → book, out → engine, waiting and failed → `null` — book-note.test.ts › badge follows the note
  - `[test]` out of book: the pill with `data-engine="stockfish"` and no "★ Book"; the note has the contract text and `liem-note--out` — book-note-render.test.tsx › out of book shows the Stockfish pill and names Stockfish
  - `[test]` thinking shows "Thinking…" and no pill — book-note-render.test.tsx › thinking hides the pill
  - `[test]` his card reads "GM · playing about 2100" — book-note-render.test.tsx › his card says playing about the step
  - `[test]` the entry chunk has no engine code, and the books and WASM are separate assets — tests/build.test.ts › engine and books load lazily
  - `[test]` narrow text ≥ 14 px and taps ≥ 40 px still hold — tests/setup-card-css.test.ts › keeps narrow text at 14 px or more and the Elo at 24 px or more
  - `[manual]` in `npm run preview`, the setup card line sits under the steps in soft text and the whole card fits inside the board at 375 px; check desktop too
  - `[manual]` out of book, the pill sits where the badge was, looks like it in grey tones, and doesn't push the clock; at desktop and 375 px
- **Depends on:** L1
- **One-way door:** none
- **Model:** opus

### K1: Calibration script, first table values, play check
- **Scope:** A dev-only Node script, `npm run calibrate` (`tsx scripts/calibrate/calibrate.ts`), run by hand and never in tests or CI. Each step plays as `createOpponent` with empty books, the Node lite WASM engine, `STEP_PROFILES[step]` and a seeded random. It plays against **anchors** (Stockfish at `UCI_Elo`, set by the script's own small UCI player; default anchors step − 200, step, step + 200, clamped to 1320–3190, with Full's at his rating) and against the next step up. Games start from a fixed list of at least 6 short, balanced openings, cycled, with colors swapped each game. A game ends on checkmate or stalemate (our rules engine) or at 200 plies (draw). An error ends the game, which is reported but not scored. Flags: `--steps`, `--anchors`, `--games N` (even, default 4), `--seed`. Per pairing it prints W/D/L, score %, an Elo gap estimate `-400·log10(1/s − 1)` with `s` clamped to `[0.5/n, 1 − 0.5/n]`, average loss per move (the played line's loss against its own search's best, from `MoveChoice.lines`; moves not in `lines` are skipped), the slip rate, and average and max ms per move. If two engines can't share one Node process, run one in a worker thread. Run it from a clean checkout, set `STEP_PROFILES` from the results (keeping H1's table test green), and record the run, flags and results in `docs/decisions.md`. In `docs/codebase-structure.md`, add a "Calibrating the strength steps" section beside "Building the books" and update the opponent bullets for MultiPV and the chooser.
- **Files owned:** `scripts/calibrate/calibrate.ts` (new), `scripts/calibrate/match.ts` (new), `scripts/calibrate/anchor.ts` (new), `scripts/calibrate/__tests__/match.test.ts` (new), `scripts/calibrate/__tests__/anchor.test.ts` (new), `scripts/calibrate/__tests__/cli.test.ts` (new), `src/game/opponent/step-profiles.ts`, `package.json`, `docs/decisions.md`, `docs/codebase-structure.md`
- **Success criteria:**
  - `[test]` with fake players, a game ends on mate, stalemate or ply 200, with the right result — match.test.ts › a game ends on checkmate, stalemate or the ply cap
  - `[test]` openings cycle and colors swap each game — match.test.ts › colors swap each game and openings cycle
  - `[test]` 3/4 → about +191, 0/4 and 4/4 clamp to finite gaps — match.test.ts › score and Elo estimate, clamped at 0 and 100 percent
  - `[test]` loss per move comes from `lines`; moves not in `lines` are skipped — match.test.ts › average loss per move comes from the played line
  - `[test]` a player error ends that game, counted as an error, not scored — match.test.ts › an error ends the game and is reported, not scored
  - `[test]` the anchor sends `UCI_LimitStrength true`, `UCI_Elo` and `go movetime` — anchor.test.ts › anchor sends the strength options and go movetime
  - `[test]` flags parse; an odd `--games` or an unknown step exits with a message — cli.test.ts › parses steps, anchors, games and seed
  - `[manual]` `npm run calibrate -- --games 4` from a clean checkout prints every step's table, and higher steps score higher against the same anchor
  - `[manual]` in `npm run preview` at 1400, out of book, no move of his hangs a piece for nothing; at Full his moves match the engine's top line; each reply lands within its step's `movetimeMs` + 1 s at every step, on desktop and in `375x812x2,mobile,touch` emulation
  - `[manual]` his book moves still come from his book, and the two-player smoke recipe runs unchanged
- **Depends on:** H1, E1
- **One-way door:** none
- **Model:** opus

## Sprint summary

- **Synced with merge-target:** up to date
- **Slices shipped:** H1, L1, E1, U1, K1, plus the wave 2 fix
- **Queue entries:** resolved 3, deferred 2: the phone text on his card ("~2100", "★ Book") and the 14 px setup line on phones, both "Needs your decision" in `docs/handoff-queue.md` (2026-10-12)
- **Slice log:**
  - H1: opus · medium · test-first yes · runtime unit tests on real `GameState`s (nothing called it yet) · 4 NOTEs · time lost none
  - L1: opus · high · test-first yes · runtime pill injected in the dev page, computed styles read · 2 NOTEs · time lost none
  - E1: opus · medium · test-first partly (the engine tests went red on a TypeError, not an assertion) · runtime preview at 1400 and Full, worker traffic logged · 8 NOTEs · time lost none
  - U1: opus · medium · test-first partly (one guard test was never red) · runtime preview at 1400 and 375 px, in and out of book · 4 NOTEs · time lost none
  - W2-fix: opus · medium · test-first yes · runtime preview at 375, 1000 and 1400 px in every card state · 2 NOTEs · time lost about 10 min measuring the 136 px column
  - K1: opus · medium · test-first yes · runtime four calibration runs (about 46 min) and preview at every step on desktop and 375 px · 4 NOTEs · time lost the long runs; one quiet stretch of about 10 min during a run (not a stall)
- **Agent context at hand-back:** 977,276 tokens, the sum of each agent's final context size, not tokens billed. That's the sprint-planner at 159,010, H1 111,425, L1 68,665, E1 176,039, U1 146,842, W2-fix 127,043 and K1 188,251.
