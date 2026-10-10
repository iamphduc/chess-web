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

## Licence

Chess Web is free software under the GNU General Public License, version 3 or (at your option) any later version. See [LICENSE](LICENSE). The app ships the Stockfish engine, which is GPL v3, so the whole app is offered under the GPL.

## Credits

- **Stockfish:** the computer opponent uses [Stockfish](https://github.com/official-stockfish/Stockfish) (GPL v3), built for the browser as WebAssembly by Nathan Rugg in the [`stockfish` npm package](https://www.npmjs.com/package/stockfish) ([source](https://github.com/nmrugg/stockfish.js)).
- **Game data:** the opening books come from games found through the [Chess.com public API](https://www.chess.com/news/view/published-data-api), [Lichess](https://lichess.org/) (the [CC0 game database](https://database.lichess.org/) and the [API](https://lichess.org/api)), and over-the-board PGN files from [TWIC](https://theweekinchess.com/) and [chessgames.com](https://www.chessgames.com/). The books hold only move counts per position. No game files, opponents' names or dates are in this repo.
- **Sounds:** the move sounds are from Kenney's [Impact Sounds](https://kenney.nl/assets/impact-sounds) pack (CC0). Details are in [public/sounds/CREDITS.md](public/sounds/CREDITS.md).
