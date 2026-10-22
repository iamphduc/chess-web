# Liem Sparring

Practice chess against bots that play GM Le Quang Liem's openings, then take on Liem himself.

**Play it:** [iamphduc.github.io/liem-sparring](https://iamphduc.github.io/liem-sparring/)

## How it works

1. Pick a level and your color on the home page, then press **Play**.
2. While the game stays in Liem's opening book, the bot plays the moves he played in his real games.
3. After his book, [Stockfish](https://stockfishchess.org/) 18 plays the rest of the game at the level you picked.
4. When the game ends, press **Review game** to find your mistakes.

There are seven levels: Easy, Medium, Hard, Harder, Expert, Master, and ★ Liem. Liem is the final boss: his openings, then Stockfish at full strength.

To play a friend on the same screen, press **Two players on one board** on the home page.

## The review

Stockfish checks every position of the game. Then you get:

- **Marks on your moves:** inaccuracies (?!), mistakes (?) and blunders (??), graded by how much each move dropped your winning chances. Moves from his book are never marked.
- **Key moments:** your three worst moves. You get to try again from the position before each one, then see Stockfish's move and, when the position was in his book, what Liem played.
- **A summary:** a win % graph and your accuracy for the game, using the Lichess formulas.

Only the game that just ended can be reviewed. Reloading the page loses it.

## Run it locally

You need Node.js 22.12 or later.

```
npm install
npm run dev
```

Then open http://127.0.0.1:5173/liem-sparring/. To run the tests and build the site:

```
npm test
npm run build
```

## Licence

Liem Sparring is free software under the GNU General Public License, version 3 or (at your option) any later version. See [LICENSE](LICENSE). The app ships the Stockfish engine, which is GPL v3, so the whole app is offered under the GPL.

## Credits

- **Stockfish:** the engine is [Stockfish](https://github.com/official-stockfish/Stockfish) (GPL v3), built for the browser by Nathan Rugg in the [`stockfish` npm package](https://www.npmjs.com/package/stockfish).
- **Game data:** Liem's opening books come from games found through the [Chess.com public API](https://www.chess.com/news/view/published-data-api), [Lichess](https://lichess.org/) (the [CC0 game database](https://database.lichess.org/) and the [API](https://lichess.org/api)), and PGN files from [TWIC](https://theweekinchess.com/) and [chessgames.com](https://www.chessgames.com/). The books hold only move counts per position, with no game files, names or dates.
- **Sounds:** from Kenney's [Impact Sounds](https://kenney.nl/assets/impact-sounds) pack (CC0). See [public/sounds/CREDITS.md](public/sounds/CREDITS.md).
