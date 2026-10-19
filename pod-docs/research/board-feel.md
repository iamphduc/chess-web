# Research: Better board feel (legal-move dots, last-move/check highlights, sounds, flip, click-to-move)

_Generated: 2026-10-06 · Depth: standard · Searches: 11 · Pages read: 21 (several fetches failed or returned thin summaries)_

**Assumptions:** The board is custom (react-dnd + framer-motion) and stays on one device first; online play comes later. "Leading sites" evidence comes mostly from lichess source and chess.com help pages, not from screenshots. Page dates were not shown by the fetch tool, so sources are marked "undated" unless a date appeared.

## What exists
| Name | Link | What it does | Alive? | License | How close to the idea |
|------|------|--------------|--------|---------|-----------------------|
| chessground (lichess) | https://github.com/lichess-org/chessground | Board UI: click or drag, move dests, last move, check, premove, touch, SVG arrows. No chess logic. "10K gzipped", no dependencies. React wrapper exists | 1.4k stars; last commit not confirmed | GPL-3.0 or later | Closest for feel. Licence is the catch |
| react-chessboard | https://github.com/Clariity/react-chessboard | React component: drag, custom pieces, square styles, animation, mobile | v5.12.1, 2026-08-16; 547 stars | MIT | Good fit for React |
| chessiro-canvas | https://cdn.jsdelivr.net/npm/chessiro-canvas@0.1.42/README.md | React board with legal dots, capture rings, check overlay, click and drag. Speed claims are the vendor's own | v0.1.x, young | MIT | Matches the feature list, but immature |
| Lichess sound sets | https://github.com/lichess-org/lila/tree/master/public/sound | Sets: standard, futuristic, instrument, lisp, nes, piano, robot, sfx, woodland, plus Silence files | Active | Mixed (see Gaps) | Ready-made sounds, with licence limits |
| chess.com settings | https://support.chess.com/en/articles/8614003-how-do-i-manage-my-live-chess-settings | Reference behaviour: sound toggle and themes, legal-move dots, square highlight, animation speed, "white always on bottom" toggle | Live | Closed | Reference only |

## Gaps and angles
- **Licence trap.** Chessground says combined work "may be distributed only under the GPL" and source must be given to site users. Fine for an open repo, a blocker for closed code. — [chessground README](https://github.com/lichess-org/chessground/blob/master/README.md)
- **Sound licences are mixed.** Lichess COPYING lists Futuristic, NES, Piano, SFX as AGPLv3+ (Enigmahack) and Lisp as CC BY-NC-SA 4.0. The standard set has no explicit entry, so its terms are `no evidence found`. Check before copying files. — [lila COPYING.md](https://github.com/lichess-org/lila/blob/master/COPYING.md)
- **Standard lichess sounds have no check sound.** A forum answer says so; the Robot set says "check" aloud. A user wants audio for 1-minute games. — [lichess forum](https://lichess.org/forum/lichess-feedback/sound-when-check)
- **Screen reader play on lichess is text-based.** Moves go in an edit field ("e4", "Nf3"), with commands L (last move), P (pieces), C (clock). Repeated identical output may not be announced. — [lichess blind mode guide](https://lichess.org/page/blind-mode-guide)
- **chess.com makes dots, highlights, flip and animation speed user settings**, so a single hard-coded look is the weaker approach. — [chess.com settings](https://support.chess.com/en/articles/8614003-how-do-i-manage-my-live-chess-settings)

## Best practices
- **Dot on empty target, ring on capture target.** Chessground's brown theme draws `move-dest` as a radial dot (`rgba(20,85,30,0.5)`) and `oc.move-dest` (occupied) as a ring (`transparent 80%` then `rgba(20,85,0,0.3)`). — [chessground.brown.css](https://raw.githubusercontent.com/lichess-org/chessground/master/assets/chessground.brown.css)
- **Highlight colors (chessground).** Last move `rgba(155,199,0,0.41)`, selected `rgba(20,85,30,0.5)`, check is a red radial gradient on the king square. Same source.
- **Support click and drag together.** Chessground lists "click or drag-and-drop" input. — [chessground README](https://github.com/lichess-org/chessground/blob/master/README.md)
- **Offer a sound mute toggle and resume audio on first click.** Chrome creates an `AudioContext` "suspended" before a user gesture; call `resume()` after one. chess.com has a sound on/off toggle. — [Chrome autoplay](https://developer.chrome.com/blog/autoplay)
- **Respect reduced motion.** `prefers-reduced-motion: reduce` is supported since January 2020; replace scaling/panning with opacity or color shifts. — [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)
- **Contrast 3:1 for UI graphics.** Highlights, dots and focus rings that carry meaning need 3:1 against adjacent colors. The 0.41-alpha last-move color may fail on some themes (my inference; test it). — [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- **Do not set `touch-action: none` broadly.** Apply it only where you need direct gesture handling, so the page can still scroll and zoom. — [Chrome scrolling intervention](https://developer.chrome.com/blog/scrolling-intervention?hl=en)
- **Flip.** chess.com has a toggle that keeps white on the bottom. Auto-flip for same-device play is an own decision (see questions).

## Ideas to consider
- **Minimal:** legal-move dots and capture rings plus last-move and check highlights as CSS classes on squares, starting from chessground's colors — grows from the best-practice colors above.
- **Click-to-move on the existing board:** select on click, move on second click, click same piece or a non-legal square to deselect, click another own piece to reselect — `(own idea)`.
- **Sound module:** one small `useSound` hook, preloaded files, lazy `AudioContext` resume, mute toggle saved in localStorage — grows from the Chrome autoplay rule.
- **Own sound set with a check cue**, from CC0 sources, so no GPL/AGPL entanglement — grows from the sound-licence and no-check-sound gaps.
- **Flip board:** manual button first, optional auto-flip for same-device play, coordinates that follow orientation — grows from chess.com's toggle.
- **Reduced-motion respect:** read the OS setting, shorten or skip piece animation — grows from MDN.
- **Keyboard play:** arrow-key square focus plus Enter to select and move, with an `aria-live` move announcement; optionally a lichess-style text move box — grows from the blind-mode guide.
- **Bold: swap in chessground** (only if the project can be GPL) or react-chessboard and keep only game logic and Redux — grows from the library table.

## Questions for the plan
- Keep the custom board or adopt a library? — why it matters: chessground is small and mature but forces GPL; react-chessboard is MIT with 547 stars; the custom board keeps framer-motion animation — options: keep custom / react-chessboard / chessground.
- What is the repo licence? — why it matters: it decides whether chessground and lichess AGPL sounds are usable — options: open GPL-compatible / keep MIT / closed.
- Which sound source? — why it matters: lichess licences are mixed and standard-set terms were not found — options: verify and use AGPL sets / CC0 pack / record own.
- Should check and game-end sounds exist by default? — why it matters: lichess standard has no check sound and users ask for it — options: always on / per sound set / off.
- Auto-flip on one device? — why it matters: players sharing a screen may sit on opposite sides or the same side — options: manual only / auto-flip toggle / rotate pieces only.
- Is touch a first-class target? — why it matters: chessground lists full touch support, so touch is a built-in strength of the library route; whether react-dnd handles touch was not confirmed — options: test the current board on a phone first / click-to-move only on touch / replace dnd.
- How far should accessibility go in this scope? — why it matters: lichess uses a separate text-input mode, not the board — options: contrast + reduced motion only / keyboard focus on squares / text move input.
- Will online play need premove? — why it matters: chessground supports it; adding it later touches click handling — options: design now / defer.

## Not found
- chess.com capture-ring and highlight colors; auto-flip behavior on lichess; licence of lichess standard sounds; react-chessboard v5 option names; chessground last-commit date; react-dnd HTML5 vs Touch backend behavior on touch screens (react-dnd docs pages fetched did not say): `no evidence found`.

## Sources
- chessground repo — https://github.com/lichess-org/chessground — undated
- chessground README — https://github.com/lichess-org/chessground/blob/master/README.md — undated
- chessground.brown.css — https://raw.githubusercontent.com/lichess-org/chessground/master/assets/chessground.brown.css — undated
- react-chessboard repo — https://github.com/Clariity/react-chessboard — undated
- react-chessboard releases — https://github.com/Clariity/react-chessboard/releases — v5.12.1, 2026-08-16
- chessiro-canvas README — https://cdn.jsdelivr.net/npm/chessiro-canvas@0.1.42/README.md — undated
- lila sound folder — https://github.com/lichess-org/lila/tree/master/public/sound — undated
- lila COPYING.md — https://github.com/lichess-org/lila/blob/master/COPYING.md — copyright 2012-2026
- lichess forum, sound when check — https://lichess.org/forum/lichess-feedback/sound-when-check — undated, possibly stale
- lichess blind mode guide — https://lichess.org/page/blind-mode-guide — undated
- chess.com live settings — https://support.chess.com/en/articles/8614003-how-do-i-manage-my-live-chess-settings — undated
- Chrome autoplay policy — https://developer.chrome.com/blog/autoplay — undated, possibly stale
- MDN prefers-reduced-motion — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion — undated
- WCAG 1.4.11 — https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html — WCAG 2.2
- Chrome scrolling intervention — https://developer.chrome.com/blog/scrolling-intervention?hl=en — undated, possibly stale
