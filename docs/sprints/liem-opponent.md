# Sprint: Play Liem on the board

_From plan: docs/plans/play-like-liem.md · Slug: liem-opponent · Status: active · Generated: 2026-10-09_
<!-- autopilot-run: started=2026-10-09T17:30:00+07:00 sprints=1 waves=3 -->

## Status board

| Wave | Slice | Title | Branch | PR | Status | Confidence | Depends on |
|------|-------|-------|--------|----|--------|------------|------------|
| 1 | L1 | Look: Liem tokens, self-hosted Quicksand, base control styles | liem-opponent-L1 | — | pending | — | — |
| 1 | G1 | Board rules for vs-Liem: human color lock, his move, new game | liem-opponent-G1 | — | pending | — | — |
| 1 | P1 | Lazy books, `Opponent.newGame`, and the opponent loader | liem-opponent-P1 | — | pending | — | — |
| 1 | C1 | Match state, his turn, and the opponent controller | liem-opponent-C1 | — | pending | — | — |
| 1 | D1 | GPL-3.0 LICENSE and README credits | liem-opponent-D1 | — | pending | — | — |
| 2 | U1 | Mode tabs, setup card, and the start/new-game actions | liem-opponent-U1 | — | pending | — | L1, G1, C1 |
| 2 | U2 | Book note and his card's badge | liem-opponent-U2 | — | pending | — | L1, G1, C1 |
| 3 | U3 | vs-Liem board layout, opponent wiring, lazy-bundle check, preview smoke | liem-opponent-U3 | — | pending | — | G1, P1, C1, U1, U2 |

Plan branch `play-like-liem`; wave heads `liem-opponent-w1`, `liem-opponent-w2`, `liem-opponent-w3`.

## Shared contract

### Values in use (from the queue, waiting on the human)
No Lichess account (`lichessUser: null`); the slow book stays thin (fallback covers it); book floor 2 with the 3 MB cap. He moves at once, with no added pause; his clock runs as normal. The vs-Liem clock is the app's `DEFAULT_TIME` (600 s, no increment), so `bookForClock` picks `"online"`.

### Board state (`src/features/board/BoardSlice.ts`, G1)
- New fields: `gameId: number` (0 at load, +1 on every `reset` and `newGame`) and `humanColor: PieceColor | null` (`null` = two players).
- `ply` always means plies played: `engineHistory.length - 1`.
- `reset()`: as today, plus `gameId + 1` and `humanColor: null`. Two-player Reset is otherwise unchanged.
- `newGame({ humanColor: PieceColor | null })`: fresh position, `gameId + 1`, the given `humanColor`, `isPlaying: true` (clocks start at once).
- **Input lock:** while `humanColor !== null` and the side to move isn't `humanColor`, `selectPiece`, `clickSquare`, `pickUp` and `movePiece` do nothing. `promotePawn` is never locked (the human's own promotion finishes after the turn has flipped).
- `playOpponentMove({ gameId, ply, move: { from: [y, x], to: [y, x], promotion?: PromotionKind } })` applies his move as one complete ply: notation, fallen pieces, last-move highlight, check, game over and `moveSound`, the same as a human move. A promotion completes at once (`=Q` in the notation, the `promote` sound, the picker never opens). It does nothing unless **all** hold: `gameId` and `ply` match, `humanColor !== null`, the side to move isn't `humanColor`, the game continues, no promotion is pending, and the move (with its exact `promotion`) is in `legalMoves`.
- **Clocks restart per game:** when `gameId` changes, each `Player` clock goes back to the full time before the new phase applies (`clockForPhase(phase, clock, now, newGame)`).
- `view.setFlipped(flipped: boolean)` (`viewSlice.ts`, G1) sets the side; the same value changes nothing.

### Match state (`src/features/liem/matchSlice.ts`, store key `match`, C1)
```ts
type Mode = "two-player" | "liem";
type ColorPick = "white" | "black" | "random";
type OpponentStatus = "idle" | "loading" | "thinking" | "failed";
interface LastChoice { gameId: number; ply: number; uci: string; source: "book" | "engine"; lookup: BookLookup | null }
interface MatchState { mode: Mode; setupOpen: boolean; colorPick: ColorPick; strength: StrengthStep; lastChoice: LastChoice | null; opponentStatus: OpponentStatus }
```
- Defaults: `"two-player"`, `setupOpen: false`, `"white"`, `2100`, `null`, `"idle"`. The page opens in Two players, so the existing smoke recipe runs unchanged.
- Actions: `setMode(mode)`, `openSetup()`, `setColorPick(pick)`, `setStrength(step)`, `gameStarted()`, `opponentMoved(LastChoice)`, `setOpponentStatus(status)`.
- `resolveColor(pick, random = Math.random): PieceColor`: `random() < 0.5` is white, else black.
- `src/app/store.ts` exports `createAppStore()` (fresh `board`, `view` and `match` reducers) and `store = createAppStore()`. Tests use fresh stores.

### His turn and the controller (`src/features/liem/`, C1)
- `liemTurn(board, match, rating): TurnRequest | null`, where `TurnRequest = { gameId; ply; state: GameState; settings: OpponentSettings }`. `settings` is `{ elo: strengthElo(match.strength, rating), clock: { baseMs: TOTAL_MS, incrementMs: 0 } }`.
- `createOpponentController({ load, onMove, onStatus })` → `{ preload(), request(req), cancel(), retry(), dispose() }`. `load: () => Promise<LiemOpponent>`, where `LiemOpponent = { chooseMove; newGame(); dispose() }`. `onMove({ gameId, ply, choice: MoveChoice })`.

### Lazy loading (P1)
- Nothing from Stockfish and no book JSON is in the entry bundle. `src/features/liem/liemOpponent.ts` exports `loadLiemOpponent(): Promise<Opponent>`, which fits C1's `LiemOpponent` by shape, so P1 doesn't import C1. It loads both books (cached) and `import()`s `stockfish-worker.ts`, then returns `createOpponent(...)`.
- `players/index.ts` exports `LIEM: { entry: PlayerEntry }` and `PLAYERS`, with no book import and no `as unknown as Book` cast. The books come from `loadPlayerBooks` (fetch the `?url` asset, then `parseBook`).
- `Opponent` gains `newGame(): void`. It aborts any choice in flight (that promise rejects `superseded`) and calls `engine.newGame()`.

### Look classes (`src/styles/liem.css`, L1)
UI slices use only these classes and the `--liem-*`/`--book-bar` tokens. They never edit L1's files.
- `.liem-tabs` / `.liem-tab` (`[aria-selected="true"]` gets white text and a 3 px red underline)
- `.liem-card` and `.liem-card__title`, `.liem-star`, `.liem-card__sub`
- `.liem-tiles` / `.liem-tile` (`[aria-checked="true"]` gets a gold border and the gold-tint background) and `.liem-tile__glyph`
- `.liem-steps` / `.liem-step` and `.liem-step--lit`, `.liem-elo`
- `.liem-badge`
- `.liem-note`, `.liem-note--out`, `.liem-note__row`, `.liem-note__row--played`, `.liem-note__bar` and `.liem-note__count`
- `.liem-dimmed` (brightness 0.45)

The Start game button is the existing `.button.button--play`.

### Smoke hooks (U2, U3)
- The note has `data-book-state="waiting|in-book|out|failed"`, and each row has `data-uci` and `data-played="true|false"`.
- The badge has `data-book-games="<N>"`.
- The setup card is `role="dialog"` with `aria-label="Challenge Le Quang Liem"`.
- The tabs are `role="tab"` named "vs Liem" and "Two players".

## Per-slice detail

### L1: Look: Liem tokens, self-hosted Quicksand, base control styles
- **Scope:**
  - Add the plan's `## Look` palette to `src/index.css` `:root` as `--liem-card #1F1F1F`, `--liem-note #262626`, `--liem-text #FFFFFF`, `--liem-text-soft #B8B8B8`, `--liem-red #DA251D`, `--liem-gold #FFCD00`, `--liem-gold-tint #2F2A14`, `--liem-badge-bg #3A3214`, `--liem-line #474747`, `--liem-start #059862` and `--book-bar #BBBE64`. Leave the `--board-*` and `--clock-*` tokens as they are.
  - Self-host Quicksand 500 and 700: commit woff2 files (one variable file or one file per weight, latin) and the OFL licence under `src/assets/fonts/`. Replace the Google Fonts `@import` with `@font-face` rules (`font-display: swap`).
  - Write `src/styles/liem.css` with every class in the contract's Look classes. Set the plan's type sizes (title 22/700, Elo 28/700, labels 16/700, body 16/500, counts 15, badge 14) and the 3 px `--board-focus` ring on `:focus-visible`. Reset buttons so no browser-default control styling is left. Import the file from `src/index.tsx`.
  - Red is used only for edges and underlines, never for text.
  - Update the fonts line in `docs/codebase-structure.md`.
- **Files owned:** `src/index.css`, `src/index.tsx`, `src/styles/liem.css` (new), `src/assets/fonts/` (new), `tests/theme.test.ts`, `tests/liem-theme.test.ts` (new), `docs/codebase-structure.md`
- **Success criteria:**
  - `[test] each Liem token is declared once in :root with its Look value — tests/liem-theme.test.ts › liem tokens have the Look values`
  - `[test] text and soft text on card, note and page (#333333), gold on card and on badge bg, and text on gold tint are all at least 4.5:1 — tests/liem-theme.test.ts › text pairs meet 4.5:1`
  - `[test] white on --liem-start is at least 3:1 and documented as below 4.5:1, the same as today's Play button — tests/liem-theme.test.ts › start pair matches the Play green`
  - `[test] liem.css defines every contract class and sets colors only through var(--…) — tests/liem-theme.test.ts › base control styles use only tokens`
  - `[test] Quicksand 500 and 700 come from @font-face rules whose url() files exist under src/assets/fonts/; no CSS under src/ names an http(s) URL — tests/theme.test.ts › quicksand is served from the app`
  - `[manual] in npm run preview, the Network tab shows the woff2 files loading from /chess-web/assets/ and no request to fonts.googleapis.com; the text looks as before at desktop and 375 px`
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### G1: Board rules for vs-Liem: human color lock, his move, new game
- **Scope:**
  - Build the contract's Board state items: `gameId`, `humanColor`, `newGame`, the input lock, `playOpponentMove`, the per-game clock restart (in `Player.tsx`, keyed on `gameId`) and `setFlipped`.
  - Factor `playMove` so a human move and his move share one path for notation, fallen pieces, highlight and sound.
  - Don't change two-player behavior. Every existing board test passes unchanged.
- **Files owned:** `src/features/board/BoardSlice.ts`, `src/features/board/viewSlice.ts`, `src/features/board/components/Player.tsx`, `src/features/board/__tests__/opponent-move.test.ts` (new), `src/features/board/__tests__/view-slice.test.ts`, `src/features/board/__tests__/player.test.tsx`
- **Success criteria:**
  - `[test] newGame({humanColor:"black"}) gives the start position, isPlaying true, humanColor black and gameId + 1; reset gives humanColor null, isPlaying false and gameId + 1 — opponent-move.test.ts › newGame and reset bump gameId`
  - `[test] with humanColor white, on Black's turn selectPiece, clickSquare, pickUp and movePiece leave state unchanged; on White's turn they work; with humanColor null nothing is locked — opponent-move.test.ts › human input only on the human's turn`
  - `[test] playOpponentMove plays a quiet move, a capture (fallen piece), O-O and en passant with the same notation, lastMoves and moveSound a human move gets, and a mating move sets gameOver — opponent-move.test.ts › opponent move updates the board like a human move`
  - `[test] state is unchanged for: stale gameId, stale ply, the human's turn, humanColor null, game over, a pending promotion, an illegal move, a missing or wrong promotion — opponent-move.test.ts › stale or illegal opponent moves are ignored`
  - `[test] his promotion lands the promoted piece in one ply, with notation "…=Q" plus the check suffix, pendingPromotion null and the promote sound — opponent-move.test.ts › opponent promotion completes in one ply`
  - `[test] the human's own promotion still completes with promotePawn while the side to move is his — opponent-move.test.ts › human promotion is not locked`
  - `[test] setFlipped(true) and setFlipped(false) set the side, and a repeat changes nothing — view-slice.test.ts › setFlipped sets the side`
  - `[test] clockForPhase with newGame restarts at TOTAL_MS: running becomes {TOTAL_MS, startedAt: now}, and paused or reset become initialClock — player.test.tsx › a new game restarts the clock`
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### P1: Lazy books, `Opponent.newGame`, and the opponent loader
- **Scope:**
  - `parse-book.ts`: `parseBook(json: unknown): Book` throws `BookError` on anything that breaks the sprint-1 book format.
  - `players/load-books.ts`: `createBookLoader({ fetch, url })` → `load(entry): Promise<Record<BookName, Book>>`. It fetches both books in parallel and caches a success. After a failure it fetches again. HTTP non-OK, a network error or bad JSON rejects with `BookLoadError` naming the book.
  - `players/book-urls.ts`: Vite-only, `import.meta.glob("./*/book-*.json", { query: "?url", import: "default", eager: true })`, and `bookUrl(entry, name)`. A comment says it isn't loadable by `tsx`.
  - Strip the JSON imports and the cast from `players/index.ts`.
  - Add `Opponent.newGame()`.
  - Write the glue `src/features/liem/liemOpponent.ts` (contract). The app doesn't import it yet. U3 does, and checks the bundle.
- **Files owned:** `src/game/opponent/opponent.ts`, `src/game/opponent/__tests__/opponent.test.ts`, `src/game/opponent/parse-book.ts` (new), `src/game/opponent/__tests__/parse-book.test.ts` (new), `src/game/opponent/players/index.ts`, `src/game/opponent/players/load-books.ts` (new), `src/game/opponent/players/book-urls.ts` (new), `src/game/opponent/__tests__/load-books.test.ts` (new), `src/features/liem/liemOpponent.ts` (new), `tests/book-data.test.ts`
- **Success criteria:**
  - `[test] newGame rejects the in-flight chooseMove with superseded and calls engine.newGame once; after dispose, newGame neither throws nor calls the engine — opponent.test.ts › newGame resets the engine`
  - `[test] parseBook returns both committed books unchanged and throws BookError for format ≠ 1, an unknown book name, a tuple not of length 7, a negative or non-integer count, and a broken win+draw+loss invariant — parse-book.test.ts › validates the book shape`
  - `[test] load fetches both URLs before either resolves, returns parsed books; a 404, a thrown fetch, or bad JSON rejects BookLoadError naming that book — load-books.test.ts › loads both books or fails`
  - `[test] a second load after success makes no fetch; after a failure it fetches again — load-books.test.ts › caches success and retries after failure`
  - `[test] bookUrl gives a URL ending in each file named in player.json — load-books.test.ts › book URLs for each book`
  - `[test] LIEM has the entry and no books field, and players/index.ts has no .json book import and no "as unknown as Book" — tests/book-data.test.ts › players/index.ts exports the entry and no eager books`
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### C1: Match state, his turn, and the opponent controller
- **Scope:**
  - Build `matchSlice.ts`, `resolveColor`, `createAppStore` and `liemTurn` as the contract states.
  - Build `opponentController.ts`, with these rules:
    - **Load once:** the first `preload` or `request` calls `load()`, and later calls share it.
    - **Repeats:** a `request` with the latest request's `(gameId, ply)` is ignored.
    - **Latest wins:** an answer reaches `onMove` only if its request is still the latest. `cancel()` clears the latest, so nothing in flight reaches `onMove`.
    - **New game:** before the first choice of a request whose `gameId` differs from the previous request's, it calls `opponent.newGame()`. It doesn't on the very first request or between plies.
    - **Status:** `loading` while the load is pending, `thinking` while choosing, then `idle`.
    - **Silent errors:** `superseded` and `disposed` are silent. `no-legal-moves` sets the status to `idle`.
    - **Retryable errors:** `illegal-engine-move` and `engine-timeout` set the status to `failed`, and `retry()` re-asks the same opponent.
    - **Fresh opponent on failure:** after a load failure or `engine-failed`, the opponent is dropped and disposed, the status is `failed`, and `retry()` loads a fresh one.
    - **Dispose:** disposes the opponent. A load that resolves later is disposed at once, and later calls do nothing.
    - **Instant:** no timers, so a book answer reaches `onMove` within the promise chain.
  - Register `match` in the store. Use only the `LiemOpponent` shape, not `opponent.ts`, so this slice builds alongside P1.
- **Files owned:** `src/features/liem/matchSlice.ts` (new), `src/features/liem/liemTurn.ts` (new), `src/features/liem/opponentController.ts` (new), `src/features/liem/__tests__/match-slice.test.ts` (new), `src/features/liem/__tests__/liem-turn.test.ts` (new), `src/features/liem/__tests__/opponent-controller.test.ts` (new), `src/app/store.ts`
- **Success criteria:**
  - `[test] defaults; setMode with the same mode keeps the same state object; "liem" opens the card, "two-player" closes it, and both clear lastChoice and status — match-slice.test.ts › setMode`
  - `[test] setColorPick and setStrength apply only while setupOpen, and a step not in STRENGTH_STEPS is ignored; gameStarted closes the card and clears lastChoice and status; openSetup works only in liem mode — match-slice.test.ts › setup picks and game start`
  - `[test] resolveColor: white and black as given; random 0.4999 → white, 0.5 → black — match-slice.test.ts › resolveColor edges`
  - `[test] createAppStore returns independent stores with board, view and match — match-slice.test.ts › createAppStore`
  - `[test] liemTurn returns null when any of these fails: liem mode, card closed, humanColor set, isPlaying, game continues, no pending promotion, side to move ≠ humanColor; else returns the gameId, ply, last state, elo (2100 → 2100, "full" → 2732) and clock {600000, 0} — liem-turn.test.ts › his turn only`
  - `[test] preload then two requests call load once — opponent-controller.test.ts › loads once`
  - `[test] a repeated (gameId, ply) calls chooseMove once — opponent-controller.test.ts › same request runs once`
  - `[test] an older request's answer and an answer after cancel never reach onMove — opponent-controller.test.ts › stale answers are dropped`
  - `[test] newGame is called before game 2's first choice, not on game 1 and not between plies — opponent-controller.test.ts › newGame between games`
  - `[test] load reject and engine-failed → failed, retry loads a fresh opponent (old one disposed); illegal-engine-move and engine-timeout → failed, retry re-asks the same one; superseded and no-legal-moves don't fail — opponent-controller.test.ts › failures and retry`
  - `[test] statuses go loading → thinking → idle — opponent-controller.test.ts › status order`
  - `[test] dispose disposes the opponent; a load that resolves after dispose is disposed at once — opponent-controller.test.ts › dispose`
  - `[test] with fake timers never advanced, a loaded book answer reaches onMove — opponent-controller.test.ts › no added delay`
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### D1: GPL-3.0 LICENSE and README credits
- **Scope:**
  - Add `LICENSE` with the verbatim GPL v3 text and set `"license": "GPL-3.0-or-later"` in `package.json`. Don't touch dependencies.
  - Add a README **Credits** section:
    - Stockfish (GPL v3), with links to the Stockfish source and the nmrugg `stockfish` npm package.
    - Game data sources: Chess.com public API, Lichess (CC0 database and API), TWIC/chessgames.com for over-the-board files. The books hold only move counts.
    - The sounds' existing credits.
  - Add the plan's `docs/decisions.md` entry: the repo becomes GPL-3.0 because the app ships Stockfish.
- **Files owned:** `LICENSE` (new), `README.md`, `package.json`, `tests/license.test.ts` (new), `docs/decisions.md`
- **Success criteria:**
  - `[test] LICENSE starts with "GNU GENERAL PUBLIC LICENSE" and "Version 3, 29 June 2007" and contains "END OF TERMS AND CONDITIONS"; package.json license is "GPL-3.0-or-later" — tests/license.test.ts › repo is GPL-3.0`
- **Depends on:** —
- **One-way door:** yes. Once this reaches `main`, the public repo is offered under GPL v3, and copies taken then keep that licence. To undo it for later versions, remove `LICENSE` and Stockfish, but earlier grants stand. The human approves the merge.
- **Model:** opus

### U1: Mode tabs, setup card, and the start/new-game actions
- **Scope:**
  - `liemActions.ts` thunks:
    - `switchMode(mode)`: the same mode does nothing. Otherwise it dispatches `board.reset()` and `match.setMode(mode)`, and leaves the flip as is.
    - `newLiemGame()`: `board.reset()` and `match.openSetup()`.
    - `startLiemGame(random?)`: `resolveColor`, `match.gameStarted()`, `board.newGame({ humanColor })`, and `view.setFlipped(humanColor === "black")`.
  - `ModeTabs.tsx`: a tablist above the board.
  - `SetupCard.tsx`, following the Look from B:
    - Star and "Challenge Le Quang Liem".
    - "GM · Vietnam · 2732" from `LIEM.entry`. Map federation codes to names with a fallback to the code.
    - Three radio tiles (♔ White, ♚ Black, ? Random).
    - Seven step radios, lit up to the chosen one, with the large gold Elo. Full shows 2732 with the word "Full".
    - The green **Start game** button.
  - The card fits within 312 px at 375 px. Use only the L1 tokens and classes, and follow the Look. U3 places these components; don't edit `Board.tsx`.
- **Files owned:** `src/features/liem/liemActions.ts` (new), `src/features/liem/components/ModeTabs.tsx` (new), `src/features/liem/components/SetupCard.tsx` (new), `src/features/liem/components/SetupCard.css` (new), `src/features/liem/__tests__/liem-actions.test.ts` (new), `src/features/liem/__tests__/setup-card.test.tsx` (new)
- **Success criteria:**
  - `[test] switchMode with the current mode keeps the board state object; to liem resets the board and opens the card; to two-player resets and closes it — liem-actions.test.ts › switchMode`
  - `[test] startLiemGame: White → humanColor white, not flipped, isPlaying, card closed, gameId + 1; Black → flipped; Random with 0.49 → white, 0.5 → black — liem-actions.test.ts › startLiemGame`
  - `[test] newLiemGame resets the board (isPlaying false, gameId + 1) and opens the card — liem-actions.test.ts › newLiemGame`
  - `[test] ModeTabs renders a tablist with "vs Liem" and "Two players", with aria-selected following match.mode — setup-card.test.tsx › mode tabs`
  - `[test] the setup card renders the dialog label, star, "GM · Vietnam · 2732", three tiles with aria-checked on the pick, 7 steps with aria-checked on the chosen and liem-step--lit up to it, Elo 2100 (full: 2732 and "Full"), and Start game; an unknown federation shows its code — setup-card.test.tsx › setup card markup`
  - `[manual] at desktop and 375 px: red top edge, gold star, steps and Elo, the gold tile border on the pick, the red tab underline, a visible focus ring on tiles and steps, and no default browser controls`
- **Depends on:** L1, G1, C1
- **One-way door:** none
- **Model:** opus

### U2: Book note and his card's badge
- **Scope:**
  - `bookNote.ts` (pure):
    - `bookMoveLabel(state, uci)`: the move number, then `.` for White or `...` for Black. Then the piece letter, the disambiguation from `pieceNotation.getSuffixAbbreviation`, and `x` on captures. Pawn captures start with the from-file. Castling is `O-O`/`O-O-O`, a promotion ends `=Q`, and there are no check marks.
    - `bookNoteView(board, match)`. Its `kind` is one of:
      - `waiting`: no `lastChoice`, or its `gameId` isn't the board's.
      - `in-book`: source `book`.
      - `out`: source `engine`.
      - `failed`: status `failed`, which wins over the other kinds.
    - In-book rows come in stored order, built from `engineHistory[lastChoice.ply]`. The bar width is games / top games × 100, rounded. The played move is marked. Show at most 5 rows. If the played move is below them, add it as a 6th. Leave out rows whose UCI isn't legal.
    - The total is `lookup.games`.
    - `liemBadge(...)`: `{ games }` in book, else `null`.
  - `BookNote.tsx`, following the Look from A:
    - The olive edge.
    - The "Out of his book" heading and "He's on his own from here." with the red edge.
    - In the failed state, a "Try again" button with an `onRetry` prop.
    - The contract's smoke hooks.
  - `LiemCardDetail.tsx`: "GM · playing <elo>", plus "★ Book · N" while in book, or "Thinking…" while loading or thinking.
  - Add an optional `detail?: ReactNode` prop to `Player`, rendered under the name. With no `detail`, the markup is unchanged.
  - Use only the L1 tokens and classes, and follow the Look. Don't edit `Board.tsx`.
- **Files owned:** `src/features/liem/bookNote.ts` (new), `src/features/liem/components/BookNote.tsx` (new), `src/features/liem/components/LiemCardDetail.tsx` (new), `src/features/liem/components/BookNote.css` (new), `src/features/board/components/Player.tsx`, `src/features/board/components/Player.css`, `tests/player-css.test.ts`, `src/features/liem/__tests__/book-note.test.ts` (new), `src/features/liem/__tests__/book-note-render.test.tsx` (new)
- **Success criteria:**
  - `[test] labels: "1.e4", "1.Nf3", "1...e5", "O-O", "O-O-O", en passant "exd6", "bxa8=Q", "Nbd2", and no + or # — book-note.test.ts › move labels`
  - `[test] kinds: waiting (none, or another gameId), in-book (stored order, played marked, widths 100/46/20 from 188/87/37, total = lookup.games), out (engine), failed wins over in-book — book-note.test.ts › note states`
  - `[test] 7 moves show 5 rows; a played 7th move is added as a 6th; an illegal UCI row is left out — book-note.test.ts › row cap and played move`
  - `[test] the badge has the games in book, and is null when out or waiting — book-note.test.ts › badge follows the note`
  - `[test] the rendered note has data-book-state and rows with data-uci and data-played; the out note has liem-note--out and "He's on his own from here"; failed shows Try again; the badge's data-book-games equals the note total; "Thinking…" shows while loading — book-note-render.test.tsx › note and badge markup`
  - `[test] Player with detail renders it under the name; without it the markup equals today's — book-note-render.test.tsx › player card detail`
  - `[manual] at desktop and 375 px: the olive edge and bars, the played row bold, the edge turning red when out, the gold badge on its dark gold pill`
- **Depends on:** L1, G1, C1
- **One-way door:** none
- **Model:** opus

### U3: vs-Liem board layout, opponent wiring, lazy-bundle check, preview smoke
- **Scope:**
  - `Board.tsx`:
    - `ModeTabs` above the board in both modes.
    - **Two players:** today's layout.
    - **vs Liem with the card open:** `SetupCard` inside `.squares`, over the board with `liem-dimmed`.
    - **vs Liem in a game:** no cards around the board. The sidebar shows his `Player` (the color opposite `humanColor`, `detail={<LiemCardDetail/>}`), then `BookNote`, then the "You" card. Below them are New game, Flip and Sound, then Fallen Pieces and Notation. There's no Play or Reset.
    - At 375 px, everything stacks in that order.
    - His data comes from `LIEM.entry` only.
  - `useLiemOpponent.ts` glue:
    - One controller (`load: loadLiemOpponent`), surviving StrictMode's double mount.
    - `preload()` once the vs-Liem game has started.
    - `liemTurn` → `request`, else `cancel`.
    - `onMove` dispatches `playOpponentMove`, then `opponentMoved`. `onStatus` dispatches `setOpponentStatus`.
    - Wires `BookNote`'s `onRetry` to `retry`.
    - Disposes on unmount.
  - Use only the L1 tokens and classes, and follow the Look.
  - Add vs-Liem to `docs/codebase-structure.md`: the layout, and a smoke-recipe paragraph using the contract's smoke hooks.
  - Add `docs/decisions.md` entries: the engine and books load at game start, not on page load; the page opens in Two players.
- **Files owned:** `src/features/board/Board.tsx`, `src/features/board/Board.css`, `src/features/liem/useLiemOpponent.ts` (new), `src/features/board/__tests__/board-modes.test.tsx` (new), `tests/build.test.ts`, `docs/codebase-structure.md`, `docs/decisions.md`
- **Success criteria:**
  - `[test] two players: tabs, both players cards above and below the board, Play/Reset/Flip/Sound, and no setup card or note — board-modes.test.tsx › two-player layout unchanged`
  - `[test] vs Liem with the card open: the dialog sits inside .squares with liem-dimmed, and there's no Play button — board-modes.test.tsx › setup card over the dimmed board`
  - `[test] vs Liem as Black: the sidebar order is his card (White, "Le Quang Liem"), note, your card; New game is shown, Play and Reset aren't — board-modes.test.tsx › vs-Liem sidebar order`
  - `[test] the build's entry JS named in index.html has no "stockfish" and no book position key; the lite .wasm, its worker JS and both book JSON are emitted as separate assets — tests/build.test.ts › engine and books load lazily`
  - `[manual] npm run build && npm run preview at /chess-web/: with no tab switch, no wasm or book requests in Network; Start game loads both, and the Worker and WASM load from /chess-web/assets/ with no console errors`
  - `[manual] Start as White at each of the 7 steps and as Black (the board flips): he replies at once in book, the badge N matches the note total, and after leaving the book the note says "Out of his book" and his moves keep coming legally`
  - `[manual] against him: castling, en passant, promotion (yours with the picker, his in one ply) and a checkmate; New game mid-think doesn't play a stale move; Two players still passes the smoke recipe`
  - `[manual] the Look at desktop and 375 px: tabs, setup card on the dimmed board, sidebar order, and the badge and note`
- **Depends on:** G1, P1, C1, U1, U2
- **One-way door:** none
- **Model:** opus
