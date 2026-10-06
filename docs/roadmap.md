# Roadmap

Features approved on 2026-10-03, in build order. Each becomes its own plan under `docs/plans/` when we start it.

## Up next

1. **Online play with a friend (PartyKit)** — share a link, play live. Both sides check every move with the engine, so illegal moves are rejected.

## Approved, order not set

- **Computer opponent** — a search-based AI in a Web Worker, with easy / medium / hard levels.
  - **LLM pairing (open question):** the engine picks the move; an LLM explains it in plain words ("coach" comments). Do not let the LLM pick moves itself, because LLMs often suggest illegal or weak moves. The API key cannot live in a static site, so the LLM call needs a server; the PartyKit server from item 1 could do this.
  - **Before starting:** remove the 4-per-type promotion cap in `src/game/engine/moves/promotion.ts`, because an AI search can hit it.
- **Puzzle mode** — "mate in N" puzzles from the free Lichess puzzle database, checked by the engine.
- **Install and play offline (PWA)**.
- **"How the engine works" page** — perft results, design notes, CI badge.

## Done

- **Move to Vite** — replaced Create React App (no longer maintained) and dropped the `--legacy-peer-deps` workaround.
- **Better board feel** — legal-move dots, last-move and check highlights, move sounds, flip board, click-to-move, touch drag.

## Maybe

- **Game review** — evaluation bar plus good-move / mistake labels. Depends on reusing open-source work instead of building it from scratch: Stockfish compiled to WebAssembly for the evaluations, and an existing open-source game-review project for the labels.
