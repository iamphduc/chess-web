# Idea: change the engine behind the Liem opponent

_Noted: 2026-10-09 · From: the `play-like-liem` plan interview · Research: [play-like-player](../research/play-like-player.md)_

The first build uses **Stockfish lite WASM** after the opening book, limited by `UCI_Elo`. These are the other options. Revisit them when one of the reasons below changes.

| Option | Good | Bad | Revisit when |
|--------|------|-----|--------------|
| **Stockfish lite WASM** (chosen) | Strong enough for 2700; `UCI_Elo` 1320–3190; about 1.7 MB; single thread works on GitHub Pages | GPL v3, so the repo is GPL v3; a weakened Stockfish plays strong moves with random slips, not human mistakes | — |
| **Our own TypeScript search** on `src/game/engine/` | No licence tie-in; no WASM; we control every move choice | Likely tops out around 1500–1800; real work (search, evaluation, speed) | We want to drop GPL, or want full control of how the bot errs |
| **Maia neural net** (Maia-2 MIT code, Maia-3 ONNX AGPLv3) | Plays human-like moves for a given rating | Files 6.7–156 MB; doesn't reach 2700; Maia-3 is AGPL | We care more about human-like mistakes than top strength, or a small high-Elo model appears |
| **Personalized model** trained on his games (Transfer Maia, Maia4All) | The real "plays like him" | Needed about 5,000 games; GM attempts were "less successful"; Maia4All has no code we found | Maia4All (or similar) ships code that works from a few hundred games |

## How to switch

Keep the engine behind one small interface, for example `chooseMove(position, settings) → Promise<move>`, so the book and the UI don't know which engine runs. Then a switch is a new adapter plus a licence check.
