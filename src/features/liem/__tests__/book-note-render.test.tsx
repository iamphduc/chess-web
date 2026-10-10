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

describe("BookNote and LiemCardDetail", () => {
  it("note and badge markup", () => {
    // Waiting: no move of his yet.
    const fresh = liemGame();
    expect(note(fresh)).toMatch(/class="liem-note"[^>]*data-book-state="waiting"/);
    expect(note(fresh)).not.toContain("data-uci");
    expect(detail(fresh)).toContain("GM · playing 2100");
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
    expect(badge).toContain("★ Book · 312");
    expect(badge).toContain("GM · playing 2100");

    // Out of book: the red edge and his words.
    const out = liemGame();
    heMoved(out, "engine");
    const outHtml = note(out);
    expect(outHtml).toMatch(/class="liem-note liem-note--out"[^>]*data-book-state="out"/);
    expect(outHtml).toContain("Out of his book");
    expect(outHtml).toContain("He&#x27;s on his own from here.");
    expect(outHtml).not.toContain("data-uci");
    expect(detail(out)).not.toContain("liem-badge");

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

  it("shows the Elo of the chosen step, Full as his rating", () => {
    const store = createAppStore();
    store.dispatch(setMode("liem"));
    store.dispatch(setStrength("full"));
    expect(detail(store)).toContain("GM · playing 2732");
    store.dispatch(setStrength(1400));
    expect(detail(store)).toContain("GM · playing 1400");
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
