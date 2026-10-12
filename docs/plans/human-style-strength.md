# Plan: Human-style strength for the Liem opponent

_Generated: 2026-10-11 · Status: active · Grilled-with: grilling (fast)_

## Goal
Make each strength step play like a person at that level, not like Stockfish with random noise. After his book, Stockfish at full strength lists its top moves with scores, and the opponent picks one within the step's loss limit, favouring better moves. The app says plainly that these moves come from Stockfish.

## Why
The human played the 1400 step and said it "doesn't play like 1400": strange one-move blunders no person would make, and too weak overall. The research suggests why: at `UCI_Elo` 1400, Stockfish's skill mode searches about 1 ply and adds a large random push to its pick (from reading `search.h`/`search.cpp`, not tested). Research: [human-style-strength](../research/human-style-strength.md).

The human also wants it clear that the opponent isn't Liem after the opening: his book is his, and everything after is standard Stockfish 18, which is not trained on his games.

Success:
- At 1400, he makes club-player mistakes (inaccurate moves, rare bigger slips) but never gives away a piece for nothing.
- Higher steps make fewer and smaller mistakes, and Full plays near Stockfish's best.
- He still wins won endgames, never walks into a mate he could avoid, and replies quickly on a phone.
- The setup card, his card and the book note say when Stockfish plays.

Constraints: a static GitHub Pages site with no backend; single-thread Stockfish lite WASM in a Web Worker; GPL-3.0; our own rules engine checks every move.

## Scope
**In scope:**
- **Engine output:** the engine adapter asks Stockfish for its top lines (MultiPV) at a set depth, with a time limit as a backstop, and returns each move with its score, mate scores included. `UCI_LimitStrength` and `UCI_Elo` are no longer used.
- **Move chooser:** a pure function that turns scores into win % (the Lichess formula), drops moves past the step's loss limit, and picks among the rest, favouring better moves. Per step, a table sets the search depth, the number of lines, the loss limit, how strongly better moves are favoured, and the chance and size of a rare bigger slip.
- **Safety rules on every pick:**
  - Never a move that lets the human force mate while a move that doesn't exists.
  - At high steps, always play a mate he sees.
  - Never a move that gives away material for nothing (checked with our rules engine), even on a rare slip.
  - When he's well ahead, pick closer to the best move, so won games get won.
- **Calibration script:** a dev-only Node script, run by hand and never in CI, that plays each step against Stockfish at known `UCI_Elo` levels and against neighbouring steps, then reports scores and average loss per move. Its results set the first table values.
- **Disclosure:**
  - The setup card gets a line under the strength steps saying his openings come from his games and Stockfish 18 plays after that, at the chosen strength.
  - His card shows a "Stockfish" pill in place of the "★ Book · N" badge once he's out of his book.
  - The out-of-book note says Stockfish plays from here.
  - The README and docs say the same.
- **Strength labels:** steps show as approximate ("about 1400"), with no claim to Lichess or chess.com ratings.

**Out of scope:**
- Training or fine-tuning any model on his games, or a Maia-style net. See [opponent-engine-options](../ideas/opponent-engine-options.md).
- Clock-based play (more mistakes in time trouble), and a clock choice. See [clock-choice](../ideas/clock-choice.md).
- Changes to the book, the board layout, or the number of strength steps.
- A human-like thinking pause. He still moves as soon as his move is ready.

## Sprint sequence

| Sprint | Goal | Status | Depends on |
|--------|------|--------|------------|
| human-moves | MultiPV engine output, the per-step move chooser with its safety rules, the calibration script and first table values, and the Stockfish disclosure in the UI and docs | done | — |

Status values: `planned` / `active` / `done`. The orchestrator only flips its row's Status — it does not rewrite Goal/Depends-on retroactively.

The `Depends on` column is the **only** cross-sprint dependency signal. Wave ordering and per-slice deps live inside the sprint doc and are opaque from here.

## Look
The existing look from [play-like-liem](play-like-liem.md) `## Look`. No new screen and no new colors. The human agreed to reuse it.
- **Setup card line:** body text 16 / 500 in soft text `--liem-text-soft` (`#B8B8B8`), under the strength steps and above Start game. It must still fit inside the 312 px board on phones (the card's narrow rules apply up to 767 px).
- **His card:** while out of book, a pill reading "Stockfish" in the place of the "★ Book · N" badge, styled like the badge but in neutral tones (text `#B8B8B8` on `--liem-note` `#262626`, with a `--liem-line` `#474747` border), so gold stays reserved for his book.
- **Out-of-book note:** keeps its red edge. The text names Stockfish, for example "Out of his book" / "Stockfish plays from here."
- **Rules out:** new colors, a new screen, and a per-move badge in the notation.

## Key decisions
- **Pick among Stockfish's top moves instead of using `UCI_Elo`.** Skill mode's random push at low levels likely causes the odd blunders. Re-ranking Stockfish's own lines lets each step make sized, human-looking mistakes. — [research](../research/human-style-strength.md). Add a `docs/decisions.md` entry that replaces the `UCI_Elo` part of "Stockfish lite WASM, single thread, in a Web Worker, behind `MoveEngine`".
- **Stockfish is not fine-tuned or trained on his games.** It stays standard Stockfish 18, and only the openings are his. The UI and README say so.
- **Compare moves in win %, not centipawns** (Lichess formula `50 + 50*(2/(1+exp(-0.00368208*cp))-1)`); 100 cp is about 59% and 300 cp about 75%. — research
- **Low steps make rare, human-sized slips, but never give material away for nothing.** Real 1400s make mistakes; the strange ones the human saw are the ones to remove. (default)
- **Steps are approximate ("about 1400"),** tuned to feel like a club player at that level, with no claim to Lichess or chess.com. Lichess runs about 300 to 400 above chess.com here. (default)
- **Tuning: the calibration script sets the first values, then the human judges by playing.** No source maps loss limits to human ratings, so the numbers are a starting point. (default)
- **Depth per step, with a time limit as a backstop.** Low steps search shallow, so he misses deep tactics like a person rather than adding noise, and the limit keeps phones responsive. (default)
- **4 lines (MultiPV 4)** to start, the minimum Stockfish's own skill mode uses. Measure the cost on this WASM build. (default)
- **Mates:** never walk into a mate he can avoid; at high steps always play a mate he sees; low steps may miss a long mate. (default)
- **Won endgames:** pick closer to the best move when well ahead. (default)
- **Disclosure:** setup card line, a "Stockfish" pill on his card out of book, the out-of-book note, README and docs. Lichess's bot guidance asks bots to state their engine (seen on a docs mirror). (default)
- **Look:** reuse the existing vs-Liem look, with no new colors. (default, agreed)

## Known risks
- **MultiPV is slow in single-thread WASM.** A forum test took 58 s for 29 lines at depth 20, but only 2 s versus 6 s at depth 12. Mitigation: 4 lines, shallow depth at low steps, a time limit, and timing on this build and on a phone.
- **No data maps loss limits to ratings.** Mitigation: the calibration script, the human's play test, and "about" labels.
- **Low-depth evals are noisy,** so a "safe" move can still lose. Mitigation: the material check with our rules engine, and a deeper check of the picked move at low steps if timing allows.
- **Win % saturates near mates and in won positions.** Mitigation: handle mate scores separately, and tighten the pick when far ahead.
- **Repeated or robotic patterns** (the same reply every time). Mitigation: random weighted picks among close moves.
- **Calibration runs take long** in Node with real Stockfish. Mitigation: run by hand with a small game count, and never in CI.

## Open questions
- Which site the human plays on, to tune "about 1400" toward Lichess or chess.com. Value in use: approximate.
- Exact table values per step: set from the calibration script, then the human's feel.

## Verification
- `npm run build && npm test` pass.
- No `UCI_LimitStrength` or `UCI_Elo` is sent. Each search asks for its step's depth and MultiPV, with a time limit.
- Unit tests on the chooser with fixed fake scores:
  - It never picks past the step's loss limit, except for a rare slip within its own limit.
  - It never picks a move that allows a forced mate while another move doesn't.
  - At high steps it plays a found mate.
  - It never gives material away for nothing.
  - It picks closer to the best move when well ahead.
  - The picks are random but weighted, and a seeded test proves the weights.
- The calibration script runs from a clean checkout. It prints each step's score against the anchors and its average loss per move, and its results are recorded in `docs/decisions.md`.
- In `npm run preview` at `/chess-web/`:
  - At 1400, a game out of book has no move that hangs a piece for nothing.
  - Full plays close to the engine's best.
  - Each reply arrives within the time limit at every step, on desktop and in phone emulation.
- The setup card line, the "Stockfish" pill, the out-of-book note text and the README credit are present and match the Look, at desktop and 375 px.
- His book moves still come from his book, and two-player mode is unchanged.
