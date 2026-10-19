# Stockfish is named

## What it is
The app says plainly who you're playing. It names a sparring bot or Liem himself, and it names Stockfish once his book runs out. The places that say it:
- The setup card's step value and the line under the steps.
- His card above or below the board.
- The out-of-book note.
- The grey "Stockfish" pill that replaces "★ Book · N" on his card.

## How it works
- `levelView(step)` (`src/features/liem/levelView.ts`) is a pure function that returns every text a step shows. That covers the card's name, detail and phone detail, the setup card's value and step `aria-label`, the engine line, and the out-of-book text. Components read from it and add no words of their own.
- **Sparring (1400–2500):** ♞ glyph (`.liem-sparring-avatar`) in place of a photo, "Sparring · N", "Plays Liem's openings" ("Liem's openings" below 768 px), no GM tag. The step reads "about N" (`aria-label` "N"). The engine line reads "A sparring bot plays his openings, then Stockfish at about N." Out of book: "Stockfish at about N plays from here. It isn't trained on his games."
- **Liem (`"full"`):** his photo, GM tag, "GM · 2732" ("2732" below 768 px). The step reads "★ Liem" in gold (`aria-label` "Liem (2732)"). Engine line: "Le Quang Liem: his openings, then full-strength Stockfish 18." Out of book: "Full-strength Stockfish 18 plays from here. …"
- His short name "Liem" is the last word of `name` in `player.json`.

## Why it's this way
- **Sparring bots and a final boss:** the human's call. "Liem 1400" made no sense, so the lower levels are bots that play his openings.
- **One module for every text:** one place and one test file (`level-view.test.ts`) to change a word. Turned down: words spread through `SetupCard`, `Board` and `BookNote`.
- **"2732" on phones:** the GM tag already sits by his name, and "GM · 2732" was cut to "GM · 27…". It's a default: see `pod-docs/decisions.md` → "His rating reads \"2732\" on phones".
- The full labels decision is `pod-docs/decisions.md` → "Sparring and Liem labels".

## Watch out
- There is **no star by his name on the in-game card**. The wave 2 fix removed the one U1 added, because it cut his name to "Le Quang …" at 375 px. The gold ★ is only on the setup card's "★ Liem" step. A dead `.board > .player .liem-star` rule is still in `Board.css`.
- At 375 px his name still ends "Le Quang Li…", as it did before the ladder. That's accepted for now: `pod-docs/decisions.md` → "His name may end in an ellipsis at 375 px".
- Phone texts are hidden from sight only. Screen readers still get the full line, and tests check both.
- The setup card's title stays "Challenge Le Quang Liem" at every level.

## History
- 2026-10-12 · human-style-strength · setup card, his card and the out-of-book note name Stockfish · [report](../reports/human-style-strength.html)
- 2026-10-18 · sparring-ladder · sparring and Liem labels from `levelView`, ♞ card, "★ Liem" step; in-game star removed · [report](../reports/sparring-ladder.html), [PR #79](https://github.com/iamphduc/chess-web/pull/79)
