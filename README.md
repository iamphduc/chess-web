# Chess Web

This project was inspired by [chess.com](https://www.chess.com/)

## Features Completed

- [x] Capture
- [x] Check
- [x] Checkmate
- [x] Stalemate
- [x] Castling
- [x] En Passant
- [ ] Threefold repetition
- [ ] ...

## Demo

[https://iamphduc.github.io/chess-web](https://iamphduc.github.io/chess-web/)

## The ladder

The site opens on the home page. Pick a level and your color (White, Black or Random), then press **Play**. Bots play GM Le Quang Liem's opening lines from his real games, then Stockfish takes over at the level you pick, and every game ends with a review. **Two players on one board** is the outlined button under Play.

- **Sparring levels:** Easy, Medium, Hard, Harder, Expert and Master. Each is a sparring bot (the ♞ card, "Plays Liem's openings") that plays Liem's openings, then plays at its level. The levels have names, not ratings.
- **Liem:** the last step, "★ Liem", is the final boss: his photo and "GM · 2732" on the card, his openings, then full-strength Stockfish 18.
- **His openings:** at every level, while the position is in his book, the moves come from his own games, picked by how often he played each one.
- **After his book:** standard [Stockfish](https://stockfishchess.org/) 18 plays the rest of the game. It isn't fine-tuned or trained on his games. At each move it looks at its top few moves and picks one a player of that level would play.
- **In a game:** the top bar has **← Home** and what you're playing, for example "vs Medium · you play White". Each player card shows "+N" and the pieces that side has taken. **New game** starts again at the same level and color; go home to change them.

## Links

Each screen has its own link, so the browser's Back and Forward buttons move between them:

- [`#/`](https://iamphduc.github.io/chess-web/#/): the home page
- `#/play`: the game against a bot or Liem
- [`#/two-players`](https://iamphduc.github.io/chess-web/#/two-players): two players on one board
- `#/review`: the review of the game that just ended

The page keeps no game between loads, so opening `#/play` or `#/review` with no game in progress (or any other link) shows the home page. Going home ends the game in progress.

## Game review

After a vs-Liem game ends at any level (checkmate, stalemate or time), press **Review game** under the moves.

- **Analysis:** Stockfish 18 at full strength checks every position of the game, about half a second each, on the same engine he plays with. A progress bar shows how far it has got, and you can start on the key moments before it finishes.
- **Grades:** each of your moves gets a drop in win % from your side. A drop of 10 points or more is an inaccuracy (?!), 20 a mistake (?) and 30 a blunder (??). Win % and the per-move accuracy use the public Lichess formulas, and your accuracy for the game is the average. A move that keeps the game in his book is never marked.
- **Key moments:** your three biggest drops. At each one the board shows the position before your move, and you try to find a better one. A move counts as found if it's Stockfish's move or loses less than 10 points. Then you see what you played, Stockfish's move and, when the position is in his book, what Liem played there. Each found move fills a star.
- **The rest:** the sidebar starts with a win % graph from your side (tap it to jump to a move), then the key-moment card, your accuracy, the move list with the marks, and where the game left his book. Step buttons or the arrow keys go through the game. **Back to game** returns to the finished board, and **Play again** in the top bar starts a new game at the same level and color. On a phone the graph and the key-moment card open as a sheet from the bottom.
- Only the game that just ended can be reviewed. Reloading the page loses it.

## Licence

Chess Web is free software under the GNU General Public License, version 3 or (at your option) any later version. See [LICENSE](LICENSE). The app ships the Stockfish engine, which is GPL v3, so the whole app is offered under the GPL.

## Credits

- **Stockfish:** the computer opponent uses [Stockfish](https://github.com/official-stockfish/Stockfish) (GPL v3), built for the browser as WebAssembly by Nathan Rugg in the [`stockfish` npm package](https://www.npmjs.com/package/stockfish) ([source](https://github.com/nmrugg/stockfish.js)).
- **Game data:** the opening books come from games found through the [Chess.com public API](https://www.chess.com/news/view/published-data-api), [Lichess](https://lichess.org/) (the [CC0 game database](https://database.lichess.org/) and the [API](https://lichess.org/api)), and over-the-board PGN files from [TWIC](https://theweekinchess.com/) and [chessgames.com](https://www.chessgames.com/). The books hold only move counts per position. No game files, opponents' names or dates are in this repo.
- **Sounds:** the move sounds are from Kenney's [Impact Sounds](https://kenney.nl/assets/impact-sounds) pack (CC0). Details are in [public/sounds/CREDITS.md](public/sounds/CREDITS.md).
