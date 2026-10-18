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

The page opens on **vs Liem**, a ladder that builds toward beating GM Le Quang Liem. Pick a level on the challenge card, then press **Start game**. **Two players** is one tab click away.

- **Sparring levels:** "about 1400" up to "about 2500". Each is a sparring bot (the ♞ card, "Sparring · 1400") that plays Liem's openings, then plays at its level.
- **Liem:** the last step, "★ Liem", is the final boss: his photo and "GM · 2732" on the card, his openings, then full-strength Stockfish 18.
- **His openings:** at every level, while the position is in his book, the moves come from his own games, picked by how often he played each one.
- **After his book:** standard [Stockfish](https://stockfishchess.org/) 18 plays the rest of the game. It isn't fine-tuned or trained on his games. At each move it looks at its top few moves and picks one a player of that level would play.
- The levels are approximate. They aren't Lichess or Chess.com ratings.

## Game review

After a vs-Liem game ends at any level (checkmate, stalemate or time), press **Review game**.

- **Analysis:** Stockfish 18 at full strength checks every position of the game, about half a second each, on the same engine he plays with. A progress bar shows how far it has got, and you can start on the key moments before it finishes.
- **Grades:** each of your moves gets a drop in win % from your side. A drop of 10 points or more is an inaccuracy (?!), 20 a mistake (?) and 30 a blunder (??). Win % and the per-move accuracy use the public Lichess formulas, and your accuracy for the game is the average. A move that keeps the game in his book is never marked.
- **Key moments:** your three biggest drops. At each one the board shows the position before your move, and you try to find a better one. A move counts as found if it's Stockfish's move or loses less than 10 points. Then you see what you played, Stockfish's move and, when the position is in his book, what Liem played there. Each found move fills a gold star.
- **The rest:** a win % graph (tap it to jump to a move), the move list with the marks, where the game left his book, and step buttons or the arrow keys to go through the game. **Back to game** returns to the finished board, and **New game** starts a new one. On a phone the key-moment card opens as a sheet from the bottom.
- Only the game that just ended can be reviewed. Reloading the page loses it.

## Licence

Chess Web is free software under the GNU General Public License, version 3 or (at your option) any later version. See [LICENSE](LICENSE). The app ships the Stockfish engine, which is GPL v3, so the whole app is offered under the GPL.

## Credits

- **Stockfish:** the computer opponent uses [Stockfish](https://github.com/official-stockfish/Stockfish) (GPL v3), built for the browser as WebAssembly by Nathan Rugg in the [`stockfish` npm package](https://www.npmjs.com/package/stockfish) ([source](https://github.com/nmrugg/stockfish.js)).
- **Game data:** the opening books come from games found through the [Chess.com public API](https://www.chess.com/news/view/published-data-api), [Lichess](https://lichess.org/) (the [CC0 game database](https://database.lichess.org/) and the [API](https://lichess.org/api)), and over-the-board PGN files from [TWIC](https://theweekinchess.com/) and [chessgames.com](https://www.chessgames.com/). The books hold only move counts per position. No game files, opponents' names or dates are in this repo.
- **Sounds:** the move sounds are from Kenney's [Impact Sounds](https://kenney.nl/assets/impact-sounds) pack (CC0). Details are in [public/sounds/CREDITS.md](public/sounds/CREDITS.md).
