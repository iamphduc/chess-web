// Glue only: loads Liem's books and the Stockfish worker on demand and builds
// his opponent. Nothing from Stockfish and no book JSON is in the entry bundle:
// the books are fetched by URL and the worker module is a dynamic import().
import { createOpponent, type Opponent } from "game/opponent/opponent";
import { bookUrl } from "game/opponent/players/book-urls";
import { LIEM } from "game/opponent/players/index";
import { createBookLoader } from "game/opponent/players/load-books";

const books = createBookLoader({ fetch: (url) => fetch(url), url: bookUrl });

/** A new opponent each call; the books load once and stay cached. It owns its engine. */
export async function loadLiemOpponent(): Promise<Opponent> {
  const [liemBooks, worker] = await Promise.all([
    books.load(LIEM.entry),
    import("game/opponent/engine/stockfish-worker"),
  ]);
  return createOpponent({ books: liemBooks, engine: worker.createStockfishWorkerEngine() });
}
