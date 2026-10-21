# Stockfish is named

## What it is
The app says plainly who you're playing: a sparring level, or Liem himself, and that Stockfish plays once his book runs out. Since `ui-polish`, the home page says it and the game screen stays quiet:
- **Home:** the Level picker and the engine line under it ("A sparring bot plays his openings, then Stockfish at the Medium level."; at **★ Liem**, "Le Quang Liem: his openings, then full-strength Stockfish 18.").
- **His card in a game:** only the level name with the ♞ disc (at the Liem step: his photo, the GM tag and "Le Quang Liem"). Under the name, only "★ Book · N" while he's in his book, or "Thinking…" while he loads or thinks. Nothing out of book.
- **Book note:** shows while he's waiting, in his book, or failed (with Try again). Out of book there's no note and no "Out of his book" text.
- **Top bar:** "vs Medium · you play White".

## How it works
- `levelView(step)` (`src/features/liem/levelView.ts`) returns the texts a step shows; `LEVEL_NAMES` is the one place the names live. It no longer has `detail`, `shortDetail`, `detailLead` or `outText`. `rating` ("GM · 2732") stays, for home only.
- `bookNoteView` (`src/features/liem/bookNote.ts`) still returns `{ kind: "out" }`. `BookNote` renders no note for it, and `liemBadge` returns `null` for it.
- His card line is `LiemCardDetail.tsx`: the badge, "Thinking…", or nothing.
- Out of book, below 992 px, `bookNoteSlot` leaves an empty slot as tall as the note was, until a new game. The note also never gets shorter within a game. From 992 px the slot is hidden.

## Why it's this way
- **Names, not ratings** (the human's choice): see `pod-docs/decisions.md` → "Levels have names, not ratings".
- **A quiet card, no Stockfish pill** (a default the human accepted): "Plays Liem's openings or Stockfish … looks busy". See "His card shows only his book or Thinking…".
- **No out-of-book note** (a default the human accepted): "once we are out of the opening move we will know that the bot is playing". The trade-off: in a game nothing says Stockfish plays; the home engine line still does. See "No out-of-book note".
- **The empty slot on phones** (an agent default, open for the human): the note sits above the Moves card there, so removing it shortened the page and dropped `scrollY` (review round 1). Turned down: moving the note under the Moves card on phones, which changes the `ui-refresh` order and still shortens the page. See "The book note's space stays on phones after he leaves his book".

## Watch out
- No sparring text or `aria-label` may contain a 4-digit number or "about". `level-view.test.ts` checks every string field.
- No card may show "Plays Liem's openings", "Liem's openings", "GM · 2732" or `[data-engine]`. Every `.board > .player` stays 60 px tall.
- The empty slot (`div.liem-note-slot`) has no `[data-book-state]` and no text. A gap above the Moves card after he leaves his book on a phone is the rule, not a bug.
- On desktop the Moves card moves up by the note's height when he leaves his book, and moves down when the note grows; `scrollY` doesn't change. Both are open choices for the human (`decisions.md`, 2026-10-20 agent defaults).
- Don't bring back a scroll fix that only checks moves in book. Test with the note going away.
- The numbers stay in `STRENGTH_STEPS`, `strengthLabel` and `npm run calibrate`.

## History
- 2026-10-12 · human-style-strength · setup card, his card and the out-of-book note name Stockfish · [report](../reports/human-style-strength.html)
- 2026-10-18 · sparring-ladder · sparring and Liem labels from `levelView`, ♞ card, "★ Liem" step; in-game star removed · [report](../reports/sparring-ladder.html), [PR #79](https://github.com/iamphduc/chess-web/pull/79)
- 2026-10-19 · ui-refresh · level names replace ratings; texts move to the home page and the top bar; ochre ★ via `Star.tsx` · [report](../reports/ui-refresh.html), [PR #84](https://github.com/iamphduc/chess-web/pull/84)
- 2026-10-20 · ui-polish · his card drops "Plays Liem's openings" and the Stockfish pill; no out-of-book note; an empty slot keeps the note's height on phones · [report](../reports/ui-polish.html), [PR #91](https://github.com/iamphduc/chess-web/pull/91), [PR #92](https://github.com/iamphduc/chess-web/pull/92)
