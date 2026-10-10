# Sprint: Liem's book and move choice

_From plan: docs/plans/play-like-liem.md · Slug: liem-book · Status: active · Generated: 2026-10-09_
<!-- autopilot-run: started=2026-10-09T17:30:00+07:00 sprints=0 waves=2 -->

## Status board

| Wave | Slice | Title | Branch | PR | Status | Confidence | Depends on |
|------|-------|-------|--------|----|--------|------------|------------|
| 1 | K1 | Position codec and book format | liem-book-K1 | #59 | merged | medium | — |
| 1 | S1 | Stockfish lite UCI engine behind `MoveEngine` | liem-book-S1 | #59 | merged | medium | — |
| 2 | I1 | Import script, live run, committed books and player entry | liem-book-I1 | — | pending | — | K1 |
| 2 | M1 | His move choice: book, fallback, engine, legality check | liem-book-M1 | — | pending | — | K1, S1 |

Plan branch `play-like-liem`; wave heads `liem-book-w1`, `liem-book-w2`. No UI this sprint, so no `L1` (the look foundation is in `liem-opponent`).

## Shared contract

### Module layout
- `src/game/opponent/**` uses **relative imports only** (no `game/` aliases), so the Node import script (run with `tsx`) and its tests can import it, as the engine in `src/game/engine/` already does.
- `chess.js` (or any PGN parser) is imported only under `scripts/`. Nothing under `src/` imports it.
- Raw PGN lives only in `/games/` (git-ignored): `games/otb/` for the human's over-the-board files, `games/cache/` for downloads.

### Squares, UCI and FEN (`src/game/opponent/position.ts`, K1)
- Square name: file `"abcdefgh"[x]`, rank `8 - y` (`[7,4]` is `e1`). UCI move = from + to + optional `q|r|b|n`. Castling is the king's two-file move (`e1g1`, `e8c8`), the same as our `Move`.
- `moveToUci(move: Move): string`.
- `uciToMove(state: GameState, uci: string): Move | null` returns the matching move from `legalMoves(state, from)` or `null`. `null` when: the string is malformed, `from` has no piece of the side to move, the move isn't legal, a last-rank pawn move has no suffix, or a non-promotion has a suffix.
- `positionKey(state): string`: FEN fields 1 to 4 (placement, side, castling, en passant) joined by spaces. Castling comes from `state.castling` (`KQkq` order, `-` if none). **En passant edge:** the target square is written only when the side to move has a **legal** en-passant capture; otherwise `-`. So `1.d4 d5 2.c4` and `1.c4 d5 2.d4` share one key (transpositions merge, the plan's default "by position").
- `toFen(state, counters?: { halfmove: number; fullmove: number }): string`: the key plus the two counters (default `0 1`).

### Book format (`src/game/opponent/types.ts`, K1)
```ts
type GameSource = "otb" | "lichess" | "chesscom";
type BookName = "slow" | "online";
// [uci, win, draw, loss, otb, lichess, chesscom]; win/draw/loss are his results
type BookMove = readonly [string, number, number, number, number, number, number];
interface Book {
  format: 1; player: string; book: BookName; minGames: number;
  games: number;                                  // games counted into this book
  gamesBySource: Record<GameSource, number>;
  positions: Record<string, BookMove[]>;          // positionKey -> his moves
}
```
- Invariant per move: `win + draw + loss === otb + lichess + chesscom` (= that move's games). `moveGames(m)` and `positionGames(moves)` helpers live in `types.ts`.
- Only positions where **he** is to move are stored. A position is stored only when at least `minGames` of his games in that book reached it (default 2), and only moves he played there. Moves sort by games descending, then UCI ascending. Object keys sort ascending, so the same input gives byte-identical JSON.
- The JSON holds nothing else: no names, dates, events, or move lists.
- **Size budget:** each committed book is at most 3 MB. If a build goes over, the builder raises `minGames` by 1 until it fits, and records the value used in `minGames`.
- An empty book (`games: 0`, `positions: {}`) is valid.

### Player entry (`src/game/opponent/players/`, I1)
`le-quang-liem/player.json`: `{ id: "le-quang-liem", name: "Le Quang Liem", title: "GM", federation: "VIE", fideId: 12401137, rating: 2732, avatar: "le-quang-liem.png", aliases: string[], sources: { lichessFideUrl, lichessUser: string | null, chesscomUser: "liemle" }, books: { slow: "book-slow.json", online: "book-online.json" } }`. `players/index.ts` exports `PLAYERS` and `LIEM: { entry: PlayerEntry; books: Record<BookName, Book> }`. `PlayerEntry` is typed in `types.ts`. Nothing outside this folder hard-codes Liem's data.

### Which games go into which book (I1)
- **Clock estimate** = base + 40 × increment, from the PGN `TimeControl` tag. It accepts `B`, `B+I`, and multi-period `M/B:…` (the first period's base is used). It's **slow** when the estimate is 900 s or more (exactly 900 s counts as slow, 899 s as online), else **online**.
- An OTB game with no `TimeControl` tag, or with `-`, `?` or one it can't parse, counts as **slow**. An online game like that, or a daily or correspondence game (`1/86400`), is **skipped**.
- The **slow book** is the OTB games plus online games whose estimate is slow. The **online book** is the online games with a fast estimate. With no OTB files, the slow book holds only slow online games. It may be empty, and then the fallback covers it.
- **Skipped:** a `Variant` other than Standard, a `SetUp "1"` or `FEN` tag, Result `*`, games where he isn't a player, and duplicates. A duplicate has the same White, Black, Date and move list, and only its first copy counts.
- **His color:** online, the side whose name matches the source account (case-insensitive). OTB, the side whose `WhiteFideId`/`BlackFideId` is 12401137, else the side whose name matches an alias after normalizing (case, commas, extra spaces).
- **Replay:** each PGN move is turned into UCI and checked with `uciToMove` against our engine. On the first move that is `null`, the rest of that game is dropped and the drop is counted in the summary.
- **Lichess account:** use the `--lichess-user` flag, else `sources.lichessUser`, else the account linked from `lichessFideUrl`. If none resolves, the script warns and builds without Lichess (this is not a failure). Never guess an account.
- **Failures:** if a configured source fails (HTTP error, or still 429 after 3 retries), the script exits non-zero and writes no book.

### Choosing the book (`src/game/opponent/book.ts`, M1)
- `bookForClock(clock: { baseMs: number; incrementMs: number } | null): BookName` uses the same estimate as import: 900 000 ms or more is `"slow"`, else `"online"`. `null` (untimed) is `"slow"`.
- `lookupBook(books, state, clock) → { book: BookName; moves: BookMove[]; games: number } | null`. `THIN = 3`. If the clock's book has 3 or more games at `positionKey(state)`, use it. Else, if the other book has 3 or more, use that. Else use whichever has more (ties go to the clock's book) as long as it has at least 1. Else `null` (out of book). Sprint 2's panel and badge read this.

### Engine boundary (`src/game/opponent/engine/move-engine.ts`, S1)
```ts
interface MoveEngine {
  bestMove(fen: string, opts: { elo: number; movetimeMs?: number }, signal?: AbortSignal): Promise<string | null>; // UCI, null = "bestmove (none)"
  newGame(): void;
  dispose(): void;
}
class EngineError extends Error { code: "aborted" | "timeout" | "failed" | "disposed" }
```
- The Elo sent is rounded and clamped to 1320–3190. `UCI_LimitStrength true` is sent once at start. `UCI_Elo` is sent before a `go` whenever it differs from the last value sent. `movetimeMs` defaults to 1000.
- **Abort:** sends `stop`, rejects with `aborted`, and discards the resulting `bestmove`. The next search's `position` isn't sent until that stale `bestmove` arrives.
- **Timeout:** no `bestmove` within `movetimeMs + 5000` rejects with `timeout`.
- **Failure:** a worker error rejects the pending call with `failed`, and every later call rejects with `failed`.
- **Dispose:** terminates the engine. Pending and later calls reject with `disposed`.
- `createStockfishWorkerEngine(): MoveEngine` runs Stockfish lite single-thread WASM in a Web Worker. The engine files are served by the app under the base path, never from a CDN. The `stockfish` package is pinned to an exact version.

### The opponent (`src/game/opponent/opponent.ts`, M1)
```ts
interface OpponentSettings { elo: number; clock: { baseMs: number; incrementMs: number } | null; random?: () => number }
interface MoveChoice { move: Move; uci: string; source: "book" | "engine"; lookup: ReturnType<typeof lookupBook> }
interface Opponent { chooseMove(state: GameState, settings: OpponentSettings): Promise<MoveChoice>; dispose(): void }
function createOpponent(deps: { books: Record<BookName, Book>; engine: MoveEngine }): Opponent;
class OpponentError extends Error { code: "no-legal-moves" | "illegal-engine-move" | "superseded" | "engine-failed" | "engine-timeout" | "disposed" }
```
- **No legal moves:** rejects with `no-legal-moves` without calling the engine.
- **In book:** drops book moves that `uciToMove` rejects. It picks among the rest, weighted by games: with `r = random()` (default `Math.random`) in [0, 1), in the stored order, it takes the first move whose running share passes `r`. If none are legal, the engine is used.
- **Off book:** calls `engine.bestMove(toFen(state), { elo })`. If the result is `null` or rejected by `uciToMove`, it asks once more, then rejects with `illegal-engine-move`. A move not in `legalMoves` is never returned.
- **Repeats:** a new `chooseMove` while one is in flight aborts the earlier engine call, and the earlier promise rejects with `superseded`. The engine's `timeout`, `failed` and `disposed` codes map to `engine-timeout`, `engine-failed` and `disposed`.
- **Instant:** no added delay. The promise settles as soon as the book pick or the engine answer is ready.
- **Strength** (`src/game/opponent/strength.ts`, M1): `STRENGTH_STEPS = [1400, 1700, 1900, 2100, 2300, 2500, "full"]`. `strengthElo(step, rating)` returns the number, and `"full"` returns the player's `rating` (2732 for Liem).
- Sprint 2 builds the real opponent as `createOpponent({ books: LIEM.books, engine: createStockfishWorkerEngine() })`.

### Tests and network
Tests never touch the network. Importer tests use fixture PGN, fixture HTML and an injected `fetch`. Only a human or engineer running `npm run book:import` calls Lichess and Chess.com.

## Per-slice detail

### K1: Position codec and book format
- **Scope:** Build `position.ts` and `types.ts` exactly as the contract states: square names, `moveToUci`, `uciToMove`, `positionKey`, `toFen`, the book types and `moveGames`/`positionGames`, plus the `PlayerEntry` type. Pure, with no I/O. Don't touch `src/game/engine/`. In `docs/codebase-structure.md`, add a `src/game/opponent/` entry for the contract's layout: codec, types, `engine/`, `book.ts`, `opponent.ts`, `strength.ts`, `players/`, the relative-imports rule, and the parser-in-scripts-only rule.
- **Files owned:** `src/game/opponent/position.ts` (new), `src/game/opponent/types.ts` (new), `src/game/opponent/__tests__/position.test.ts` (new), `src/game/opponent/__tests__/book-format.test.ts` (new), `docs/codebase-structure.md`
- **Success criteria:**
  - `[test] square names and UCI round-trip for quiet moves, captures, both castles for both colors, en passant and all four promotions — position.test.ts › moveToUci and uciToMove round-trip special moves`
  - `[test] uciToMove returns null for malformed text, empty or enemy from-square, illegal move, last-rank pawn move without suffix, suffix on a non-promotion — position.test.ts › uciToMove rejects every non-legal input`
  - `[test] start position key is "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -" — position.test.ts › positionKey of the start position`
  - `[test] en passant is written only when a legal en-passant capture exists, and is "-" when the only adjacent pawn is pinned — position.test.ts › positionKey writes en passant only when capturable`
  - `[test] 1.d4 d5 2.c4 and 1.c4 d5 2.d4 give the same key — position.test.ts › transpositions share a key`
  - `[test] castling field follows lost rights (king moved, rook moved, rook captured) — position.test.ts › positionKey castling field`
  - `[test] toFen appends counters, default "0 1" — position.test.ts › toFen counters`
  - `[test] moveGames and positionGames sum the per-source counts — book-format.test.ts › game counts from tuples`
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### S1: Stockfish lite UCI engine behind `MoveEngine`
- **Scope:** Add the `stockfish` npm package (nmrugg, lite single-thread build), pinned to an exact version. Build `move-engine.ts` (types and `EngineError`) and `uci-engine.ts`: `createUciEngine(transport, { setTimeout?, clearTimeout? })`, where `transport` is `{ send(line), onLine(cb), onError(cb), terminate() }`. It holds every protocol and edge rule in the contract. Also build `stockfish-worker.ts`, the thin browser glue that creates the Worker and its transport. It has no logic of its own, and its real check is sprint 2's preview smoke. The engine isn't imported by the app yet, so the bundle doesn't change. Fold in the queue's **Someday** entry: add `"engines": { "node": ">=22.12" }` to `package.json`. In `docs/decisions.md`, add the entry the plan asks for: Stockfish lite WASM, single thread, in a Web Worker, behind `MoveEngine`.
- **Files owned:** `src/game/opponent/engine/move-engine.ts` (new), `src/game/opponent/engine/uci-engine.ts` (new), `src/game/opponent/engine/stockfish-worker.ts` (new), `src/game/opponent/engine/__tests__/uci-engine.test.ts` (new), `tests/stockfish-engine.test.ts` (new), `tests/toolchain.test.ts`, `package.json`, `package-lock.json`, `docs/decisions.md`
- **Success criteria:**
  - `[test] start sends uci, waits for uciok, sends UCI_LimitStrength true once, then isready/readyok before the first search — uci-engine.test.ts › handshake order`
  - `[test] bestMove sends position fen and go movetime (default 1000), resolves the bestmove's UCI; "bestmove (none)" resolves null — uci-engine.test.ts › bestMove resolves the engine answer`
  - `[test] elo 1000 → 1320, 4000 → 3190, 2100.6 → 2101; UCI_Elo re-sent only when it changes — uci-engine.test.ts › elo is clamped and sent on change`
  - `[test] abort sends stop, rejects aborted, ignores the stale bestmove, and the next position waits for it — uci-engine.test.ts › abort discards the stale answer`
  - `[test] no bestmove within movetime + 5000 ms rejects timeout (fake timers) — uci-engine.test.ts › search timeout`
  - `[test] a transport error rejects the pending call and later calls with failed; dispose terminates and rejects with disposed — uci-engine.test.ts › failure and dispose`
  - `[test] the real lite single-thread engine, run in Node through createUciEngine, answers the start position with a UCI move within 15 s — tests/stockfish-engine.test.ts › real engine answers the start position`
  - `[test] stockfish is pinned to an exact version and engines.node is ">=22.12" — tests/toolchain.test.ts › stockfish pinned and node engine declared`
- **Depends on:** —
- **One-way door:** none. A GPL v3 dependency enters the tree. The plan accepts the GPL switch, and the `LICENSE` file lands in `liem-opponent` before anything reaches `main`. To undo, remove the package.
- **Model:** opus

### I1: Import script, live run, committed books and player entry
- **Scope:** Build the importer under `scripts/book/` as small tested modules plus a thin CLI. Keep it test-first: `timecontrol.ts` (estimate and classes), `games.ts` (PGN to filtered, deduped, colored games via `chess.js`, replayed through `uciToMove`), `build-book.ts` (games to the two `Book`s, with `minGames` and the size budget), `sources.ts` (Lichess account resolve, Lichess games, Chess.com archives, and local `games/otb/*.pgn`, all through an injected `fetch` and `sleep`, with retries on 429), and `import-book.ts` (the CLI). The CLI caches downloads in `games/cache/` and prints games per source, per book, skipped and dropped counts. Add `chess.js` and `tsx` as devDependencies, the `"book:import": "tsx scripts/book/import-book.ts"` script, and `/games/` to `.gitignore`. Create the player entry and `players/index.ts`. **Then run `npm run book:import` against the live APIs and commit both book JSON files.** If no OTB files exist, the slow book holds only slow online games, or is empty. If the Lichess account doesn't resolve, set `lichessUser: null`, build without Lichess, and file a `PENDING` "Needs your decision: Lichess account" with the value in use (none). Send a `User-Agent` with a contact on every request. In `docs/codebase-structure.md`, add how to run the import (network, flags, `games/` folders, output). In `docs/decisions.md`, add entries for the book split, grouping by position, and the `minGames` storage floor. The plan says "follow his book as long as the position has games". Storing only positions reached by 2 or more games trims single-game paths, for size and so no lone game's moves ship.
- **Files owned:** `scripts/book/timecontrol.ts` (new), `scripts/book/games.ts` (new), `scripts/book/build-book.ts` (new), `scripts/book/sources.ts` (new), `scripts/book/import-book.ts` (new), `scripts/book/__tests__/timecontrol.test.ts` (new), `scripts/book/__tests__/games.test.ts` (new), `scripts/book/__tests__/build-book.test.ts` (new), `scripts/book/__tests__/sources.test.ts` (new), `scripts/book/__tests__/fixtures/` (new), `src/game/opponent/players/index.ts` (new), `src/game/opponent/players/le-quang-liem/player.json` (new), `src/game/opponent/players/le-quang-liem/book-slow.json` (new), `src/game/opponent/players/le-quang-liem/book-online.json` (new), `tests/book-data.test.ts` (new), `.gitignore`, `package.json`, `package-lock.json`, `docs/codebase-structure.md`, `docs/decisions.md`
- **Success criteria:**
  - `[test] estimates: "900" slow, "899" online, "600+8" slow (920 s), "180+2" online, "40/7200:3600" slow, "-", "?" and missing are unknown, "1/86400" is daily — timecontrol.test.ts › clock estimate and class edges`
  - `[test] unknown clock: OTB counts slow, online and daily are skipped — games.test.ts › unknown and daily clocks by source`
  - `[test] Chess960, SetUp/FEN, Result "*", games without him and the second copy of a duplicate are skipped, and each is counted — games.test.ts › skip rules`
  - `[test] his color by account (case-insensitive), by FideId, and by normalized alias ("Le, Quang Liem") — games.test.ts › finds his side`
  - `[test] a game with an illegal move keeps the moves before it and counts one drop — games.test.ts › replay stops at the first rejected move`
  - `[test] counts only positions where he is to move, his results per move, the per-source split, the minGames floor (a 1-game position is absent at 2), and sorted moves — build-book.test.ts › builds counts from fixture games`
  - `[test] same input gives byte-identical JSON with sorted keys, and the output holds no fixture names, dates or events — build-book.test.ts › deterministic and free of raw game data`
  - `[test] over the size budget, minGames rises until the book fits and is recorded — build-book.test.ts › size budget raises minGames`
  - `[test] Lichess account: flag first, then player.json, then the link in a saved FIDE page fixture; null when the page has none — sources.test.ts › resolves the Lichess account`
  - `[test] a 429 is retried after sleep and then succeeds; 4 times 429 or a 404 fails the source; Chess.com reads every monthly archive — sources.test.ts › fetch retries and failures`
  - `[test] with the global fetch replaced by a throwing stub, the whole importer suite still passes — sources.test.ts › never calls the real network`
  - `[test] committed books parse as Book format 1, keep the move invariant and sort order, are each at most 3 MB, the online book has games > 0, and at least one book has the start position (he plays White) — tests/book-data.test.ts › committed books are valid`
  - `[test] committed book JSON has only the allowed fields (no names, dates or move lists), and no file under src/ imports chess.js — tests/book-data.test.ts › no raw game data and no parser in the app`
  - `[test] git check-ignore reports games/otb/x.pgn and games/cache/x.pgn as ignored — tests/book-data.test.ts › raw PGN folder is ignored`
- **Depends on:** K1
- **One-way door:** none. The import only reads public APIs. The output is derived counts, and committing them can be undone by deleting the files.
- **Model:** opus

### M1: His move choice: book, fallback, engine, legality check
- **Scope:** Build `book.ts` (`bookForClock`, `lookupBook`, `THIN`, and the weighted `pickBookMove(moves, random)`), `strength.ts`, and `opponent.ts` (`createOpponent`, `OpponentError`), exactly as the contract states. Test with hand-made fixture books and a fake `MoveEngine`, never the real books or Stockfish. Don't import `players/`, because it lands in the same wave.
- **Files owned:** `src/game/opponent/book.ts` (new), `src/game/opponent/strength.ts` (new), `src/game/opponent/opponent.ts` (new), `src/game/opponent/__tests__/book.test.ts` (new), `src/game/opponent/__tests__/strength.test.ts` (new), `src/game/opponent/__tests__/opponent.test.ts` (new)
- **Success criteria:**
  - `[test] bookForClock: 15+0 slow, 14:59.999 online, 10+8 slow (920 s), 10+5 online (800 s), 3+2 online, null slow — book.test.ts › bookForClock edges`
  - `[test] uses the clock's book at 3 games; at 2 falls back to the other book with 3; both thin picks the larger, with ties going to the clock's book; 0 in both is null — book.test.ts › thin-line fallback`
  - `[test] weighted pick on [a:3, b:1]: r=0 and r=0.7499 pick a, r=0.75 and r=0.9999 pick b — book.test.ts › weighted pick boundaries`
  - `[test] strengthElo maps each step and "full" to the given rating (2732) — strength.test.ts › steps and full`
  - `[test] in book, returns a book move with source "book" and the lookup, and never calls the engine — opponent.test.ts › book move first`
  - `[test] an illegal book move is skipped; if all are illegal the engine is used — opponent.test.ts › illegal book moves are dropped`
  - `[test] off book, the fake engine gets toFen(state) and the elo; its UCI comes back as our Move, including castling, en passant and a promotion — opponent.test.ts › engine move through legalMoves`
  - `[test] an illegal or null engine answer is asked once more, then rejects illegal-engine-move — opponent.test.ts › rejects engine moves not in legalMoves`
  - `[test] checkmate or stalemate rejects no-legal-moves without calling the engine — opponent.test.ts › no legal moves`
  - `[test] a second chooseMove aborts the first engine call and the first rejects superseded; engine timeout/failed/disposed map to engine-timeout/engine-failed/disposed — opponent.test.ts › repeats and engine failures`
  - `[test] with an engine that answers at once, chooseMove settles in the same microtask chain with no timer (fake timers never advanced) — opponent.test.ts › no added delay`
- **Depends on:** K1, S1
- **One-way door:** none
- **Model:** opus
