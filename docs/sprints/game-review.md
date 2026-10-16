# Sprint: Game review

_From plan: docs/plans/post-game-review.md · Slug: game-review · Status: active · Generated: 2026-10-16_

## Status board

| Wave | Slice | Title | Branch | PR | Status | Confidence | Depends on |
|------|-------|-------|--------|----|--------|------------|------------|
| 1 | L1 | Look: grade tokens and review base styles | game-review-L1 | — | pending | — | — |
| 1 | M1 | Review model: moves, grades, accuracy, his book, key moments, found rule | game-review-M1 | — | pending | — | — |
| 1 | A1 | Analysis runner and review searches on his engine | game-review-A1 | — | pending | — | — |
| 1 | R1 | Review state (store key `review`) | game-review-R1 | — | pending | — | — |
| 2 | U1 | Graph, move list, accuracy, book note, step buttons | game-review-U1 | — | pending | — | L1, M1, R1 |
| 2 | U2 | Review board, key-moment card, phone bottom sheet | game-review-U2 | — | pending | — | L1, M1, R1 |
| 3 | W1 | Wire the review into the board, speed check, docs | game-review-W1 | — | pending | — | A1, M1, R1, U1, U2 |

Plan branch `post-game-review`; wave heads `game-review-w1` to `game-review-w3`. The queue item "`{match && <ModeTabs />}` in Board.tsx" is already fixed (`Board.tsx:141` reads `<ModeTabs />`), so no slice carries it; the orchestrator can resolve it.

## Shared contract

### Values in use
Every plan default stands. Search limits: depth 18, MultiPV 1, `movetimeMs` 500 until W1's speed check sets it. The grade levels are named constants (`INACCURACY` 10, `MISTAKE` 20, `BLUNDER` 30, win % points), so a change is one edit.

### The game (input, from `state.board`)
- `positions = engineHistory` (index 0 is the start, `n = positions.length - 1` plies). **Ply i** is the move from `positions[i]` to `positions[i+1]`. It is the human's when `positions[i].turn === humanColor`.
- Labels: move number `floor(i/2)+1`; White's ply reads `"13.Nd5"`, Black's `"13...Nc6"`, in SAN with `+`/`#`, `O-O`, `=Q`.
- **Cursor** = a position index `0..n`. The selected move is ply `cursor - 1` (none at 0).
- The game clock for book lookups is the one `liemTurn` uses (`{ baseMs: TOTAL_MS, incrementMs: 0 }`), passed in.

### `PositionEval` (A1 produces, M1 and R1 consume)
`{ score: Score; best: string | null }`, `Score` from `engine/lines.ts`, side to move's view; `best` is UCI. A terminal position is never searched: checkmated → `{ score: { mate: 0 }, best: null }`, stalemate → `{ score: { cp: 0 }, best: null }`. Seen from the other side: cp negated, mate m → −m, and `{ mate: 0 }` is a win (100) for the viewer. Each wave-1 slice declares this shape where it needs it (TypeScript matches by shape); W1 may point them at one type.

### Grading (M1)
- `win(i)` = `winPercent` from `human-move.ts` (imported, not copied) of `evals[i]` from the human's side; the graph also uses White's side.
- For a human ply i with both evals: `drop = max(0, win(i) − win(i+1))`; `accuracy = clamp(103.1668·exp(−0.04354·(win(i) − win(i+1))) − 3.1669, 0, 100)`.
- **Grade:** book move → none. Else the mate rules (Lichess's mate judgements, scores from the human's side), then win %:
  - had a mate (mate > 0) and lost it: after is a mate against → blunder; after cp > 999 → inaccuracy, > 700 → mistake, else blunder;
  - walked into a mate against (before not a mate either way): before cp < −999 → inaccuracy, < −700 → mistake, else blunder;
  - mate for → mate for, or mate against → mate against: no grade;
  - otherwise `drop ≥ 30` blunder, `≥ 20` mistake, `≥ 10` inaccuracy.
- **Book move:** a human ply whose `positions[i+1]` has `lookupBook(books, ·, clock) !== null`. Grade none, accuracy 100, shows "Still in his book: he faced this in N games" (N = that lookup's `games`). `books === null` (failed to load) → no book moves, no book note.
- **Game accuracy:** the plain average of the human plies' accuracy (book = 100); `null` while any human ply lacks it, or with no human plies.
- **Left his book:** the first human ply whose result isn't in book. "His moves there" = `lookupBook` at `positions[i]`, sorted by games (can be empty). Never left → `leftBook: null`, all plies in `bookPlies`.
- **Key moments:** human plies with a grade, ranked by drop (ties: worse grade, then earlier); top 3. Plies in `locked` (moments already opened) always stay; the free places go to the best others. Returned in game order, so the list can grow or change while analysing, but never drops an opened moment.
- **Found rule:** `isFound({ tried, best, played, before, after })`: `tried === best` → found; `tried === played` → not found; else found iff `before − after < INACCURACY` (exactly 10 is not found). `after` is the human's win % at the position after `tried` (a terminal one is scored as above, no search).

### `ReviewModel` (M1 `buildReview`, read by U1, U2, W1)
```ts
type Grade = "inaccuracy" | "mistake" | "blunder";
interface ReviewMove { ply: number; label: string; uci: string; byHuman: boolean; bookGames: number | null;
  drop: number | null; accuracy: number | null; grade: Grade | null }
interface MoveRef { uci: string; label: string; games?: number }
interface KeyMoment { ply: number; grade: Grade; drop: number; played: MoveRef; best: MoveRef | null; liem: MoveRef | null }
interface ReviewModel {
  moves: ReviewMove[];                 // one per ply
  whiteWin: (number | null)[];         // per position, null until analysed
  analysed: number; total: number;     // positions with an eval / n + 1
  accuracy: number | null; counts: Record<Grade, number>;
  keyMoments: KeyMoment[];             // game order
  bookPlies: number;                   // leading plies before he left his book (0 without books)
  leftBook: { ply: number; played: MoveRef; his: MoveRef[] } | null;
}
buildReview(input: { positions: readonly GameState[]; humanColor: PieceColor; clock: GameClock;
  evals: readonly (PositionEval | null)[]; books: Record<BookName, Book> | null; locked: readonly number[] }): ReviewModel
```
`liem` = his most-played move at `positions[ply]` when that position is in his book, else `null`.

### Analysis runner (A1, `src/game/review/analysis-runner.ts`)
```ts
interface ReviewEngine { analyse(fen: string, limits: SearchLimits, signal?: AbortSignal): Promise<Analysis> }
createAnalysisRunner(deps: { engine: ReviewEngine; limits: SearchLimits }): {
  start(positions: readonly GameState[], from: number, onEval: (index: number, e: PositionEval) => void): Promise<"done" | "stopped">;
  check(state: GameState): Promise<PositionEval>;
  stop(): void;
}
```
One search at a time, in index order from `from`. A `check` runs next, before the pass's next search. `stop()` aborts the search in flight; `start` resolves `"stopped"` and pending checks reject `EngineError("aborted")`. An engine error rejects `start` (evals already sent stay). A non-terminal analysis with no lines counts as `EngineError("failed")`.

### Review searches on his engine (A1)
- `Opponent.analyse(fen, limits, signal?)` passes through to his engine. Errors: aborted → `superseded`, timeout → `engine-timeout`, disposed → `disposed`, else `engine-failed`. His `newGame()` and `dispose()` abort review searches; `chooseMove` doesn't.
- `OpponentController.analyse(fen, limits, signal?)` loads him if needed, never calls `onStatus`, and rejects `disposed` after dispose. `request()` aborts every review search first (they reject `superseded`), so none runs into his turn. A review search failing `engine-failed`/`engine-timeout` drops the opponent (the next use loads fresh). `cancel()` and `retry()` leave review searches alone.
- `liemOpponent.ts` exports `loadLiemBooks(): Promise<Record<BookName, Book>>` (the same cached loader).

### Review state (R1, `src/features/review/reviewSlice.ts`, store key `review`)
```ts
type MomentStatus = "trying" | "checking" | "wrong" | "check-failed" | "found" | "revealed" | "skipped";
interface ReviewState { open: boolean; gameId: number | null; status: "idle" | "analysing" | "done" | "failed";
  evals: (PositionEval | null)[]; cursor: number; graphSide: "you" | "white";
  moments: Record<number, MomentStatus>; active: number | null; sheetOpen: boolean }
```
Actions: `reviewOpened({ gameId, positions })`, `reviewClosed()`, `evalReceived({ gameId, index, eval })`, `analysisFinished({ gameId })`, `analysisFailed({ gameId })`, `analysisRetried()`, `stepTo(n)`, `stepBy(d)`, `setGraphSide(s)`, `momentOpened(ply)`, `moveTried(ply)`, `tryChecked({ ply, found })`, `checkFailed(ply)`, `answerShown(ply)`, `momentSkipped(ply)`, `sheetClosed()`, `sheetOpened()`. "Done" statuses: found, revealed, skipped. `locked` for `buildReview` = `Object.keys(moments)`. Rules and edges are in R1's Scope.

### Labels and smoke hooks
- Buttons: **Review game**, **Back to game**, **New game**, **Show answer**, **Skip**, **Next moment**, **Try again**; step buttons `aria-label` "First move", "Previous move", "Next move", "Last move".
- Review root `data-review-state="analysing|done|failed"`; move rows `data-ply`, `data-grade`, `data-book`; graph `data-review-graph` with points `data-ply`, `data-grade`; card `data-moment-status` (`intro|waiting|<MomentStatus>|summary|none|failed`); stars `data-found="true|false"`; sheet `data-sheet-open`.
- Card texts: "Analysing move M of N"; "Key moment k of K"; "Find the better move"; "<White|Black> to play. Your move is hidden. Make a move on the board."; reveal "You played X · Stockfish: Y · Liem played Z in N games"; "k of K found"; "No mistakes found"; "Left his book at move N"; "Stayed in his book the whole game".

### Look classes (L1, `src/styles/review.css`)
UI slices use these, their own layout CSS and only tokens; they never edit L1's files. `.review-card` with `--red`, `--gold`, `--olive` top-edge modifiers; `.review-card__title`; `.review-grade--{inaccuracy|mistake|blunder|best|book}` (text); `.review-chip--{same}` (ink on fill); `.review-move` and `.review-move--selected`; `.review-star` and `.review-star--found`; `.review-step` (icon button); `.review-progress` and `.review-progress__bar`; `.review-accuracy`; `.review-sheet`, `.review-sheet--low`, `.review-sheet__grab`, `.review-sheet__close`, `.review-scrim`.

## Per-slice detail

### L1: Look: grade tokens and review base styles
- **Scope:** Add to `src/index.css` `:root` the grade tokens from the plan's Look (`--grade-inaccuracy`, `--grade-mistake`, `--grade-blunder`, `--grade-best`, `--grade-book` = the olive), `--grade-ink` (`#1F1F1F`), `--review-page` (`#333333`) and `--review-scrim` (`rgba(0,0,0,.35)`). Write `src/styles/review.css` with the contract's classes: colors only from tokens; flag red only for edges; the Look's type sizes; step buttons and sheet controls with no browser defaults and the 3 px `--board-focus` ring. Import it from `src/index.tsx`. No new fonts (the existing Quicksand test covers them). No other colors.
- **Files owned:** `src/index.css`, `src/styles/review.css` (new), `src/index.tsx`, `tests/review-theme.test.ts` (new)
- **Success criteria:**
  - `[test] each grade and review token has the Look value — tests/review-theme.test.ts › review tokens have the Look values`
  - `[test] each grade color is 4.5:1 or more on #1F1F1F, #262626 and #333333 — tests/review-theme.test.ts › grade text meets 4.5:1 on every surface`
  - `[test] chip ink on each grade fill and selected-move ink on white are 4.5:1 or more — tests/review-theme.test.ts › chips and the selected move meet 4.5:1`
  - `[test] review.css uses only var() colors and red is never a text color — tests/review-theme.test.ts › review styles use only tokens and red is never text`
  - `[test] card title 22/700 (20/700 in the sheet), accuracy 28/700, body 16/500, labels 14–15/700 — tests/review-theme.test.ts › type sizes follow the Look`
  - `[test] step and sheet controls drop browser defaults and get the focus ring — tests/review-theme.test.ts › controls get the focus ring and no browser defaults`
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### M1: Review model: moves, grades, accuracy, his book, key moments, found rule
- **Scope:** Pure TypeScript in `src/game/review/` (relative imports, no React): the contract's Grading, `ReviewModel`, `buildReview` and `isFound`. Also `gameMoves(positions)`: each ply's UCI move, found as the one legal move whose result has the next position's `positionKey`; a gap throws a RangeError naming the ply. And `moveLabel(state, uci, ply)` for the contract's labels (SAN, with file/rank disambiguation). Plies without both evals have `drop`/`accuracy`/`grade` `null` and are never key moments. Liem's plies are never graded. Doesn't touch `human-move.ts` beyond importing `winPercent`.
- **Files owned:** `src/game/review/types.ts` (new), `src/game/review/moves.ts` (new), `src/game/review/grade.ts` (new), `src/game/review/build-review.ts` (new), `src/game/review/__tests__/moves.test.ts` (new), `src/game/review/__tests__/grade.test.ts` (new), `src/game/review/__tests__/build-review.test.ts` (new)
- **Success criteria:**
  - `[test] gameMoves recovers every ply of a recorded game, castling, en passant and a promotion included — moves.test.ts › gameMoves replays a game`
  - `[test] a position gap throws naming the ply — moves.test.ts › gameMoves throws on a gap`
  - `[test] labels read 13.Nd5 / 13...Nc6 with disambiguation, O-O, =Q, + and # — moves.test.ts › moveLabel writes SAN`
  - `[test] win % from the human's side, mates and terminal evals included, {mate:0} flipped is 100 — grade.test.ts › win from either side`
  - `[test] drop and accuracy follow the formulas; a move that gains scores 100 and drop 0 — grade.test.ts › drop and accuracy`
  - `[test] drops 9.99/10/19.99/20/29.99/30 grade none/inaccuracy/inaccuracy/mistake/mistake/blunder — grade.test.ts › grade levels at their edges`
  - `[test] mate lost and mate walked into grade by the cp rules at 699/700/701 and 999/1000; mate to mate gives no grade — grade.test.ts › mate rules`
  - `[test] a human move into a book position is never graded, scores 100 and carries its games, even with a 50-point drop — build-review.test.ts › book moves are never flagged`
  - `[test] books null gives no book moves, bookPlies 0 and leftBook null — build-review.test.ts › no books`
  - `[test] leftBook is the first out-of-book human move, with his moves there by games (or none); a game fully in book gives null and bookPlies n — build-review.test.ts › left his book`
  - `[test] game accuracy is the plain average (book = 100), null until every human ply is graded and with no human plies — build-review.test.ts › game accuracy`
  - `[test] key moments: top 3 drops at inaccuracy or worse in game order, fewer when fewer, ties by grade then ply — build-review.test.ts › key moments pick the biggest drops`
  - `[test] a locked moment stays when a bigger drop arrives; unanalysed plies are never picked — build-review.test.ts › key moments keep opened ones`
  - `[test] best and liem MoveRefs, liem null out of book — build-review.test.ts › key moment moves`
  - `[test] isFound: best, played, before−after 9.99 and 10 — grade.test.ts › found rule`
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### A1: Analysis runner and review searches on his engine
- **Scope:** The contract's runner (with a fake `ReviewEngine` in tests, terminal positions filled without a search) and the review-search additions to `Opponent`, `OpponentController`/`LiemOpponent` and `liemOpponent.ts`. His play is unchanged: every existing opponent and controller test still passes, and `analyse` never changes `opponentStatus`.
- **Files owned:** `src/game/review/analysis-runner.ts` (new), `src/game/review/__tests__/analysis-runner.test.ts` (new), `src/game/opponent/opponent.ts`, `src/game/opponent/__tests__/opponent.test.ts`, `src/features/liem/opponentController.ts`, `src/features/liem/__tests__/opponent-controller.test.ts`, `src/features/liem/liemOpponent.ts`
- **Success criteria:**
  - `[test] searches every position from the start index in order, one at a time, with the given limits — analysis-runner.test.ts › runs positions in order`
  - `[test] checkmate and stalemate get their evals with no search — analysis-runner.test.ts › terminal positions are not searched`
  - `[test] a check runs before the pass's next search and returns its eval — analysis-runner.test.ts › a check jumps the queue`
  - `[test] stop aborts the search in flight, start resolves stopped, a pending check rejects aborted, nothing more is sent — analysis-runner.test.ts › stop`
  - `[test] an engine error rejects start, evals already sent stay; empty lines count as failed — analysis-runner.test.ts › engine failure`
  - `[test] Opponent.analyse passes through and maps errors; newGame and dispose abort it; chooseMove doesn't — opponent.test.ts › review searches`
  - `[test] controller.analyse loads him without status changes and rejects after dispose — opponent-controller.test.ts › analyse loads quietly`
  - `[test] request aborts review searches before asking him — opponent-controller.test.ts › his turn stops review searches`
  - `[test] a failed or timed-out review search drops the opponent so the next use loads fresh — opponent-controller.test.ts › a broken review search replaces the engine`
  - `[test] cancel and retry leave a review search running — opponent-controller.test.ts › cancel leaves review searches`
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### R1: Review state (store key `review`)
- **Scope:** The contract's slice, added to `createAppStore`. Rules:
  - `reviewOpened` with a new `gameId`: fresh state, `open`, `analysing`, `evals` all `null` (`positions` long), cursor at the last position. With the same `gameId`: only `open = true` (evals, moments and cursor kept); a stopped pass resumes (`analysing` if any eval is `null`).
  - `reviewClosed`: `open = false`, data kept. The board's `reset` and `newGame` clear to the initial state.
  - `evalReceived`/`analysisFinished`/`analysisFailed`: ignored for another `gameId` or an index out of range; a repeat overwrites. `analysisRetried` turns `failed` into `analysing`.
  - Cursor: `stepTo`/`stepBy` clamp to `0..n`; both are ignored while the active moment is `trying`, `checking`, `wrong` or `check-failed`.
  - `momentOpened(ply)`: `active = ply`, cursor = `ply`, `sheetOpen = true`, status `trying` unless already done (then unchanged). `moveTried` → `checking`; `tryChecked` → `found` or `wrong`; `checkFailed` → `check-failed`; `answerShown` → `revealed`; `momentSkipped` → `skipped`. Each only applies to the active ply in a matching status; a done moment never changes again.
- **Files owned:** `src/features/review/reviewSlice.ts` (new), `src/app/store.ts`, `src/features/review/__tests__/review-slice.test.ts` (new)
- **Success criteria:**
  - `[test] opening a new game's review starts fresh — review-slice.test.ts › opening a new review`
  - `[test] closing and reopening the same game keeps evals, moments and cursor, and resumes a stopped pass — review-slice.test.ts › back to game and review again`
  - `[test] reset and newGame clear the review — review-slice.test.ts › a new game clears the review`
  - `[test] stale gameId and out-of-range evals are ignored — review-slice.test.ts › stale evals are dropped`
  - `[test] stepping clamps at 0 and n and is locked while trying — review-slice.test.ts › stepping`
  - `[test] the moment status moves only along its transitions; done moments never change — review-slice.test.ts › moment transitions`
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### U1: Graph, move list, accuracy, book note, step buttons
- **Scope:** Prop-driven components (no store reads, so W1 wires them) under `src/features/review/components/`, following the plan's Look and using only tokens and L1's classes:
  - `ReviewGraph({ model, humanColor, side, cursor, onSelect, onSide })`: B's graph (olive band over `bookPlies`, dashed 50 % line, grade-colored points at graded plies' resulting positions, white line and tooltip "27.Qe2?? −44 %" at the cursor, move ticks, White / You switch). Unanalysed positions draw no line. Geometry in a pure `graphGeometry.ts`: points for a width and height, and the nearest position for an x (clamped at both ends).
  - `MoveList({ model, cursor, onSelect })`: rows by move number, grade marks `?!`/`?`/`??`, book plies folded into one "In his book" row (opens and closes; the selected move inside opens it), selected row per the Look. Clicking a move selects its resulting position.
  - `AccuracyPanel` (28 px number, "—" when `null`, the grade counts), `LeftBookNote` (the contract texts, his moves with bars, hidden without books), `StepButtons({ cursor, last, disabled, onStep })` with a pure `stepForKey(key, cursor, last)` for ArrowLeft/ArrowRight (no-op at the ends or with a modifier key).
- **Files owned:** `src/features/review/components/ReviewGraph.tsx` (new), `src/features/review/components/ReviewGraph.css` (new), `src/features/review/graphGeometry.ts` (new), `src/features/review/components/MoveList.tsx` (new), `src/features/review/components/MoveList.css` (new), `src/features/review/components/AccuracyPanel.tsx` (new), `src/features/review/components/LeftBookNote.tsx` (new), `src/features/review/components/StepButtons.tsx` (new), `src/features/review/__tests__/graph-geometry.test.ts` (new), `src/features/review/__tests__/review-panels.test.tsx` (new)
- **Success criteria:**
  - `[test] points map 0–100 to the height and positions across the width, from either side — graph-geometry.test.ts › points`
  - `[test] nearest position for an x, clamped past both ends — graph-geometry.test.ts › nearest`
  - `[test] the graph renders graded points, the book band, the cursor tooltip and no line for unanalysed positions — review-panels.test.tsx › graph`
  - `[test] move list marks grades, folds book plies with their count, and marks the selected move — review-panels.test.tsx › move list`
  - `[test] accuracy shows the number or —, and the counts — review-panels.test.tsx › accuracy`
  - `[test] the book note shows left-at text with his moves, the stayed text, or nothing without books — review-panels.test.tsx › left his book note`
  - `[test] stepForKey moves by one, stops at the ends, ignores modifiers and other keys — review-panels.test.tsx › step keys`
  - `[manual] at desktop and 375 px (in W1's preview), the graph, list and panels match the Look: 150 px / 90×312 px graph, chips readable, no sideways scroll`
- **Depends on:** L1, M1, R1
- **One-way door:** none
- **Model:** opus

### U2: Review board, key-moment card, phone bottom sheet
- **Scope:** Prop-driven, Look-following, tokens only:
  - `ReviewBoard({ state, flipped, size, highlight, interactive, onMove })`: a board for one `GameState`, reusing `Square.css`, `squareLabels`, `displayOrder`, `squareMarks` and piece images, with `data-square` on each square. When `interactive`, click or tap a piece of the side to move and then a target (legal moves only); a promotion asks for the piece with four buttons. No drag. The click rules are a pure `tryBoard.ts` (select, change selection, deselect, move to UCI).
  - `KeyMomentCard({ model, review, humanColor, onStart, onShowAnswer, onSkip, onNext, onRetry })`: A's card with the stars and the contract's states and texts. The state comes from a pure `keyMomentView.ts`: `failed` / `none` (done, no moments) / `waiting` (analysing, none yet) / `intro` / the active `MomentStatus` / `summary` (all done). Its top edge: olive while waiting, red on a moment, gold when found. "Analysing move M of N" has M = `min(N, floor(analysed/2)+1)` and N = the last move number. The reveal shows the Liem part only when `liem` isn't null. "Next moment" opens the next not-done moment in game order, else the summary.
  - `BottomSheet({ open, low, onClose, children })`: C's sheet below 768 px (radius 16 px, red top edge, grab bar, ✕, scrim behind). `low` (while trying) shows only the title and buttons and drops the scrim, so the board stays usable.
- **Files owned:** `src/features/review/components/ReviewBoard.tsx` (new), `src/features/review/components/ReviewBoard.css` (new), `src/features/review/tryBoard.ts` (new), `src/features/review/components/KeyMomentCard.tsx` (new), `src/features/review/components/KeyMomentCard.css` (new), `src/features/review/keyMomentView.ts` (new), `src/features/review/components/BottomSheet.tsx` (new), `src/features/review/components/BottomSheet.css` (new), `src/features/review/__tests__/try-board.test.ts` (new), `src/features/review/__tests__/key-moment-view.test.ts` (new), `src/features/review/__tests__/review-card.test.tsx` (new)
- **Success criteria:**
  - `[test] select, reselect, deselect, illegal target and a legal move to UCI; only the side to move — try-board.test.ts › click to move`
  - `[test] a promotion waits for the piece and gives e7e8q style UCI — try-board.test.ts › promotion`
  - `[test] the board renders the position flipped and unflipped with data-square, and no input when not interactive — review-card.test.tsx › review board`
  - `[test] each card state from its inputs, edges included (no moments, all done, failed, analysing with one moment) — key-moment-view.test.ts › card states`
  - `[test] progress label at 0, mid and last position — key-moment-view.test.ts › progress label`
  - `[test] next moment skips done ones and ends on the summary — key-moment-view.test.ts › next moment`
  - `[test] card shows stars filled per found, reveal with and without Liem, and the contract's buttons per state — review-card.test.tsx › key-moment card`
  - `[test] sheet renders open, low (no scrim) and closed — review-card.test.tsx › bottom sheet`
  - `[manual] at desktop and 375 px (in W1's preview): the card and stars match A, the sheet matches C and sits low while trying with the board still playable`
- **Depends on:** L1, M1, R1
- **One-way door:** none
- **Model:** opus

### W1: Wire the review into the board, speed check, docs
- **Scope:**
  - `reviewActions.ts`: `openReview()` works only in vs Liem with `humanColor` set, the game over, no pending promotion and at least one human move; `backToGame()` closes the review. `reviewLimits.ts`: `REVIEW_LIMITS`.
  - `useGameReview.ts` (glue, mounted once in `Board.tsx`): builds a runner over the controller's `analyse` (exposed from `useLiemOpponent`), starts it from the first `null` eval while the review is open and analysing, stops it on close or clear, loads books once with a dynamic `import()` of `loadLiemBooks` (failure → `null`), memoises `buildReview`, and runs a tried move: same as best → found; else `check` → `isFound`; a check error → `checkFailed`; Try again on a failed pass → `analysisRetried`.
  - `Board.tsx` / `Board.css` / `App.css`: **Review game** in the vs-Liem button row when `openReview` would work (never in Two players). In review: the graph full width above the board and sidebar; `ReviewBoard` in `.squares` (interactive only while a moment accepts a move); step buttons under it; the sidebar per the Look, then Back to game, New game, Flip and Sound. Below 768 px everything stacks as the Look says and the card is in `BottomSheet`; tapping a key point or a flagged move reopens it. Arrow keys step. The two-player and vs-Liem layouts are otherwise unchanged.
  - **Speed check:** time the pass after a real game of about 40 moves in `npm run preview`, on desktop and in phone emulation (CPU throttled if the tool allows), with `agent-browser`. Set `movetimeMs` from it.
  - Docs: `docs/decisions.md` (the speed numbers and the chosen time; analysis reuses his worker), the README (the review), `docs/codebase-structure.md` (the `src/game/review/` and `src/features/review/` entries and a review step in `## Smoke recipe`).
- **Files owned:** `src/features/review/reviewActions.ts` (new), `src/features/review/reviewLimits.ts` (new), `src/features/review/useGameReview.ts` (new), `src/features/liem/useLiemOpponent.ts`, `src/features/board/Board.tsx`, `src/features/board/Board.css`, `src/App.css`, `src/features/review/__tests__/review-actions.test.ts` (new), `src/features/review/__tests__/board-review.test.tsx` (new), `src/features/board/__tests__/board-modes.test.tsx`, `tests/build.test.ts`, `README.md`, `docs/decisions.md`, `docs/codebase-structure.md`
- **Success criteria:**
  - `[test] openReview only after a finished vs-Liem game with a human move and no pending promotion, for mate, stalemate and flag fall — review-actions.test.ts › when the review opens`
  - `[test] REVIEW_LIMITS is depth 18, multiPv 1 and a movetime from 100 to 1000 ms — review-actions.test.ts › review limits`
  - `[test] a tried move: best is found with no search; otherwise the check result decides; a check error gives check-failed — review-actions.test.ts › trying a move`
  - `[test] Review game shows after a finished vs-Liem game and never in Two players or mid-game — board-review.test.tsx › the Review game button`
  - `[test] the review layout renders the graph, review board, card, accuracy, list and note, and Back to game restores the game layout — board-review.test.tsx › review layout`
  - `[test] New game from the review clears it and opens the setup card — board-review.test.tsx › new game from the review`
  - `[test] outside the review, both modes keep their layout and the board's surroundings don't move — board-modes.test.tsx › the board's surroundings are the same in every mode`
  - `[test] the entry chunk still has no Stockfish or book data — tests/build.test.ts › engine and books load lazily`
  - `[manual] preview after real vs-Liem games (a win, a loss and a flag fall): progress shows, the first key moment is usable while analysing, the graph, marks, accuracy and "Left his book at move N" show; all 3 moments play through (a right move fills the star, a wrong one allows Try again, Show answer and Skip); Back to game and New game work and his next game's first engine move comes normally`
  - `[manual] at desktop and 375 px the review matches the Look (B's graph, A's card and stars, C's sheet) with no sideways scroll`
- **Depends on:** A1, M1, R1, U1, U2
- **One-way door:** none
- **Model:** opus
