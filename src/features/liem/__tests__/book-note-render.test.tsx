import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { createAppStore, type AppStore } from "app/store";
import { newGame, playOpponentMove } from "features/board/BoardSlice";
import { Player } from "features/board/components/Player";
import type { BookLookup } from "game/opponent/book";
import type { BookMove } from "game/opponent/types";
import { BookNote } from "../components/BookNote";
import { LiemCardDetail } from "../components/LiemCardDetail";
import { gameStarted, opponentMoved, setMode, setOpponentStatus, setStrength } from "../matchSlice";

const bm = (uci: string, games: number): BookMove => [uci, games, 0, 0, games, 0, 0];
const LOOKUP: BookLookup = {
  book: "online",
  moves: [bm("d2d4", 188), bm("e2e4", 87), bm("g1f3", 37)],
  games: 312,
};

/** A vs-Liem game with the human on Black: he (White) is to move at ply 0. */
function liemGame(): AppStore {
  const store = createAppStore();
  store.dispatch(setMode("liem"));
  store.dispatch(gameStarted());
  store.dispatch(newGame({ humanColor: "black" }));
  return store;
}

/** He plays `uci` (d2d4 by default) from the start, from his book or not. */
function heMoved(store: AppStore, source: "book" | "engine") {
  const { gameId } = store.getState().board;
  store.dispatch(playOpponentMove({ gameId, ply: 0, move: { from: [6, 3], to: [4, 3] } }));
  store.dispatch(
    opponentMoved({ gameId, ply: 0, uci: "d2d4", source, lookup: source === "book" ? LOOKUP : null })
  );
}

const render = (store: AppStore, node: React.ReactNode) =>
  renderToStaticMarkup(<Provider store={store}>{node}</Provider>);

const note = (store: AppStore) => render(store, <BookNote onRetry={() => {}} />);
const detail = (store: AppStore) => render(store, <LiemCardDetail />);
/** What a reader sees or hears: the markup without its tags. */
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");

describe("BookNote and LiemCardDetail", () => {
  it("note and badge markup", () => {
    // Waiting: no move of his yet.
    const fresh = liemGame();
    expect(note(fresh)).toMatch(/class="liem-note"[^>]*data-book-state="waiting"/);
    expect(note(fresh)).not.toContain("data-uci");
    expect(text(detail(fresh))).toBe("Plays Liem's openings");
    expect(detail(fresh)).not.toContain("liem-badge");

    // In book: rows with the smoke hooks, the played row marked.
    const inBook = liemGame();
    heMoved(inBook, "book");
    const html = note(inBook);
    expect(html).toMatch(/class="liem-note"[^>]*data-book-state="in-book"/);
    const rows = Array.from(html.matchAll(/<div class="([^"]*)" data-uci="([^"]+)" data-played="(true|false)"/g));
    expect(rows.map((r) => [r[2], r[3]])).toEqual([
      ["d2d4", "true"],
      ["e2e4", "false"],
      ["g1f3", "false"],
    ]);
    expect(rows[0][1]).toBe("liem-note__row liem-note__row--played");
    expect(rows[1][1]).toBe("liem-note__row");
    expect(html).toContain("1.d4");
    expect(html).toContain('class="liem-note__bar" style="width:46%"');
    expect(html).toContain('<span class="liem-note__count">188</span>');
    expect(html).toContain("312");
    // The badge's N equals the note total.
    const badge = detail(inBook);
    expect(badge).toMatch(/class="liem-badge" data-book-games="312"/);
    expect(badge).not.toContain("data-engine");
    expect(text(badge)).toContain("★ Book · 312");
    expect(text(badge)).toContain("Plays Liem's openings");

    // Out of book: the red edge and his words.
    const out = liemGame();
    heMoved(out, "engine");
    const outHtml = note(out);
    expect(outHtml).toMatch(/class="liem-note liem-note--out"[^>]*data-book-state="out"/);
    expect(outHtml).toContain("Out of his book");
    expect(outHtml).not.toContain("data-uci");

    // Failed: Try again.
    const failed = liemGame();
    heMoved(failed, "book");
    failed.dispatch(setOpponentStatus("failed"));
    const failedHtml = note(failed);
    expect(failedHtml).toMatch(/data-book-state="failed"/);
    expect(failedHtml).toMatch(/<button[^>]*type="button"[^>]*>Try again<\/button>/);
    expect(failedHtml).not.toContain("data-uci");
    expect(detail(failed)).not.toContain("liem-badge");

    // Thinking… while loading or thinking, in place of the badge.
    const loading = liemGame();
    loading.dispatch(setOpponentStatus("loading"));
    expect(detail(loading)).toContain("Thinking…");
    const thinking = liemGame();
    heMoved(thinking, "book");
    thinking.dispatch(setOpponentStatus("thinking"));
    expect(detail(thinking)).toContain("Thinking…");
    expect(detail(thinking)).not.toContain("liem-badge");
    expect(detail(inBook)).not.toContain("Thinking…");
  });

  it("shows the picked level: a sparring bot's openings line, or his GM line", () => {
    const store = createAppStore();
    store.dispatch(setStrength("full"));
    expect(text(detail(store))).toBe("GM · 2732");
    store.dispatch(setStrength(1400));
    expect(text(detail(store))).toBe("Plays Liem's openings");
  });

  it("no card says playing about", () => {
    for (const step of [1400, 2100, 2500, "full"] as const) {
      const store = createAppStore();
      store.dispatch(setStrength(step));
      expect(text(detail(store))).not.toMatch(/playing|about/);
    }
  });

  // A phone can't fit "Plays Liem's openings" beside the badge, so the card
  // hides "Plays " there (Board.css); each part has its own span.
  it("the sparring line comes in parts a narrow card can drop", () => {
    const store = liemGame();
    expect(detail(store)).toContain(
      '<span class="liem-detail__sub"><span class="liem-detail__lead">Plays </span>' +
        '<span class="liem-detail__short">Liem&#x27;s openings</span></span>'
    );
    // His own line is short already: one part.
    const full = createAppStore();
    full.dispatch(setStrength("full"));
    expect(detail(full)).toContain('<span class="liem-detail__sub"><span class="liem-detail__short">GM · 2732</span></span>');
  });

  it("badge on a sparring card", () => {
    const sparring = () => {
      const store = createAppStore();
      store.dispatch(setStrength(1400));
      store.dispatch(gameStarted());
      store.dispatch(newGame({ humanColor: "black" }));
      return store;
    };

    const inBook = sparring();
    heMoved(inBook, "book");
    expect(detail(inBook)).toMatch(/class="liem-badge" data-book-games="312"/);
    expect(text(detail(inBook))).toBe("Plays Liem's openings★ Book · 312");

    const out = sparring();
    heMoved(out, "engine");
    expect(detail(out)).toContain('<span class="liem-badge liem-badge--engine" data-engine="stockfish">Stockfish</span>');
    expect(note(out)).toContain("Stockfish at about 1400 plays from here. It isn&#x27;t trained on his games.");

    const thinking = sparring();
    thinking.dispatch(setOpponentStatus("thinking"));
    expect(text(detail(thinking))).toBe("Plays Liem's openingsThinking…");
  });

  it("the book badge's count is its own part, so a phone can show just ★ Book", () => {
    const store = liemGame();
    heMoved(store, "book");
    expect(detail(store)).toContain(
      '<span class="liem-badge" data-book-games="312"><span class="liem-badge__text">★ Book' +
        '<span class="liem-badge__count"> · 312</span></span></span>'
    );
  });

  it("out of book shows the Stockfish pill and names Stockfish", () => {
    const out = liemGame();
    heMoved(out, "engine");
    const card = detail(out);
    expect(card).toContain(
      '<span class="liem-badge liem-badge--engine" data-engine="stockfish">Stockfish</span>'
    );
    expect(text(card)).not.toContain("★ Book");
    expect(card).not.toContain("data-book-games");

    const html = note(out);
    expect(html).toMatch(/class="liem-note liem-note--out"[^>]*data-book-state="out"/);
    expect(html).toContain('<h3 class="book-note__title">Out of his book</h3>');
    expect(html).toContain("Stockfish at about 2100 plays from here. It isn&#x27;t trained on his games.");
    expect(html).not.toContain("Standard Stockfish");

    // His own level: full-strength Stockfish.
    const him = createAppStore();
    him.dispatch(setStrength("full"));
    him.dispatch(gameStarted());
    him.dispatch(newGame({ humanColor: "black" }));
    heMoved(him, "engine");
    expect(note(him)).toContain("Full-strength Stockfish 18 plays from here. It isn&#x27;t trained on his games.");
    expect(html).not.toContain("on his own");
  });

  it("thinking hides the pill", () => {
    const store = liemGame();
    heMoved(store, "engine");
    store.dispatch(setOpponentStatus("thinking"));
    expect(detail(store)).toContain("Thinking…");
    expect(detail(store)).not.toContain("liem-badge");
    store.dispatch(setOpponentStatus("loading"));
    expect(detail(store)).toContain("Thinking…");
    expect(detail(store)).not.toContain("liem-badge");
  });

  it("no pill before his first move, after a failure or in a new game", () => {
    const failed = liemGame();
    heMoved(failed, "engine");
    failed.dispatch(setOpponentStatus("failed"));
    expect(detail(failed)).not.toContain("liem-badge");

    const next = liemGame();
    heMoved(next, "engine");
    next.dispatch(newGame({ humanColor: "black" }));
    expect(detail(next)).not.toContain("liem-badge");
  });

  it("a note from the last game reads as waiting", () => {
    const store = liemGame();
    heMoved(store, "book");
    store.dispatch(newGame({ humanColor: "black" }));
    expect(note(store)).toMatch(/data-book-state="waiting"/);
    expect(detail(store)).not.toContain("liem-badge");
  });
});

// Today's markup, before `detail` existed.
const TODAY =
  '<div class="player"><div class="player__info"><img class="player__avatar" src="/src/assets/chess-player.png" alt="Avatar" width="40" height="40"/><div class="player__name"><span class="player__title">GM</span>Le Quang Liem</div></div><div class="player__time" role="timer" aria-label="Clock for Le Quang Liem"><svg class="clock-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle class="clock-icon__face" cx="12" cy="12" r="10.5"></circle><line class="clock-icon__hand" x1="12" y1="13.5" x2="12" y2="5" style="transform:rotate(0deg)"></line><circle class="clock-icon__pin" cx="12" cy="12" r="1.6"></circle></svg><span class="player__timer">10:00</span></div><span class="player__alert" role="alert"></span></div>';

describe("Player", () => {
  it("player card detail", () => {
    const store = createAppStore();
    const plain = render(store, <Player name="Le Quang Liem" title="GM" avatar={null} isWhite={false} />);
    expect(plain).toBe(TODAY);

    const withDetail = render(
      store,
      <Player name="Le Quang Liem" title="GM" avatar={null} isWhite={false} detail={<i>extra</i>} />
    );
    // Under the name: inside the name block, after the name text.
    expect(withDetail).toContain(
      '<div class="player__name"><span class="player__title">GM</span>Le Quang Liem<div class="player__detail"><i>extra</i></div></div>'
    );
    // Everything else is the same.
    expect(withDetail.replace('<div class="player__detail"><i>extra</i></div>', "")).toBe(TODAY);
  });
});
