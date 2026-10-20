import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { createAppStore, type AppStore } from "app/store";
import { newGame, playOpponentMove } from "features/board/BoardSlice";
import { Player } from "features/board/components/Player";
import type { BookLookup } from "game/opponent/book";
import type { BookMove } from "game/opponent/types";
import { BookNote, BookNoteBody } from "../components/BookNote";
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

/** Every element in a rendered tree, depth first. */
function elements(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (!React.isValidElement(node)) {
    return Array.isArray(node) ? node.flatMap(elements) : [];
  }
  const el = node as React.ReactElement<Record<string, unknown>>;
  return [el, ...elements(el.props.children as React.ReactNode)];
}

describe("BookNote and LiemCardDetail", () => {
  it("his card detail by state", () => {
    // Waiting: nothing under his name.
    const fresh = liemGame();
    expect(detail(fresh)).toBe("");

    // In book: only the badge, its N the note total.
    const inBook = liemGame();
    heMoved(inBook, "book");
    const badge = detail(inBook);
    expect(badge).toMatch(/^<div class="liem-detail"><span class="liem-badge" data-book-games="312">/);
    expect(text(badge)).toBe("Book · 312");
    // The ★ is an ochre shape, not ink text.
    expect(badge).toMatch(/<svg class="liem-badge__star"[^>]*aria-hidden="true"/);

    // Thinking… while he loads or thinks, in place of the badge.
    const loading = liemGame();
    loading.dispatch(setOpponentStatus("loading"));
    expect(text(detail(loading))).toBe("Thinking…");
    const thinking = liemGame();
    heMoved(thinking, "book");
    thinking.dispatch(setOpponentStatus("thinking"));
    expect(text(detail(thinking))).toBe("Thinking…");
    expect(detail(thinking)).not.toContain("liem-badge");

    // Out of book: nothing, and no Stockfish pill. Thinking out of book still says so.
    const out = liemGame();
    heMoved(out, "engine");
    expect(detail(out)).toBe("");
    out.dispatch(setOpponentStatus("thinking"));
    expect(text(detail(out))).toBe("Thinking…");

    // After a failure: nothing.
    const failed = liemGame();
    heMoved(failed, "book");
    failed.dispatch(setOpponentStatus("failed"));
    expect(detail(failed)).toBe("");
  });

  it("no level line on any card", () => {
    for (const step of [1400, 2100, 2500, "full"] as const) {
      const store = createAppStore();
      store.dispatch(setStrength(step));
      store.dispatch(gameStarted());
      store.dispatch(newGame({ humanColor: "black" }));
      expect(detail(store), `${step} waiting`).toBe("");
      heMoved(store, "book");
      const html = detail(store);
      expect(text(html), `${step} in book`).toBe("Book · 312");
      expect(html).not.toMatch(/openings|2732|GM|liem-detail__sub|playing|about/);
    }
  });

  it("the book badge's count is its own part, so a phone can show just ★ Book", () => {
    const store = liemGame();
    heMoved(store, "book");
    expect(detail(store)).toContain(
      '<span class="liem-badge" data-book-games="312"><svg class="liem-badge__star" viewBox="0 0 24 24" ' +
        'aria-hidden="true" focusable="false"><path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7-6.2-3.8-6.2 3.8 1.6-7L2 9.5l7.1-.6z"></path></svg>' +
        '<span class="liem-badge__text">Book' +
        '<span class="liem-badge__count"> · 312</span></span></span>'
    );
  });

  it("no note out of book", () => {
    // Waiting.
    const fresh = liemGame();
    expect(note(fresh)).toMatch(/^<section class="liem-note" data-book-state="waiting"/);
    expect(note(fresh)).not.toContain("data-uci");

    // In book: rows with the smoke hooks, the played row marked.
    const inBook = liemGame();
    heMoved(inBook, "book");
    const html = note(inBook);
    expect(html).toMatch(/^<section class="liem-note" data-book-state="in-book"/);
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

    // Out of book, at every level: no note at all.
    for (const step of [1400, 2100, "full"] as const) {
      const out = createAppStore();
      out.dispatch(setStrength(step));
      out.dispatch(gameStarted());
      out.dispatch(newGame({ humanColor: "black" }));
      heMoved(out, "engine");
      expect(note(out), `${step}`).toBe("");
      // Thinking out of book doesn't bring it back.
      out.dispatch(setOpponentStatus("thinking"));
      expect(note(out), `${step} thinking`).toBe("");
    }

    // Failed: Try again, which asks him again.
    const failed = liemGame();
    heMoved(failed, "engine");
    failed.dispatch(setOpponentStatus("failed"));
    const failedHtml = note(failed);
    expect(failedHtml).toMatch(/^<section class="liem-note" data-book-state="failed"/);
    expect(failedHtml).toMatch(/<button[^>]*type="button"[^>]*>Try again<\/button>/);
    expect(failedHtml).not.toContain("data-uci");
    const onRetry = vi.fn();
    const button = elements(BookNoteBody({ view: { kind: "failed" }, onRetry })).find((e) => e.type === "button")!;
    expect(onRetry).not.toHaveBeenCalled();
    (button.props.onClick as () => void)();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("a new game brings the note back", () => {
    const store = liemGame();
    heMoved(store, "engine");
    expect(note(store)).toBe("");
    store.dispatch(newGame({ humanColor: "black" }));
    expect(note(store)).toMatch(/^<section class="liem-note" data-book-state="waiting"/);
    expect(note(store)).toContain("His book");
    expect(detail(store)).toBe("");

    // A note from the last game in book reads as waiting too.
    const inBook = liemGame();
    heMoved(inBook, "book");
    inBook.dispatch(newGame({ humanColor: "black" }));
    expect(note(inBook)).toMatch(/data-book-state="waiting"/);
    expect(detail(inBook)).toBe("");
  });
});

// Today's markup, before `detail` existed.
const TODAY =
  '<div class="player"><div class="player__info"><span class="player__disc" aria-hidden="true">♚</span><div class="player__name"><span class="player__title">GM</span>Le Quang Liem</div></div><div class="player__time" role="timer" aria-label="Clock for Le Quang Liem"><svg class="clock-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle class="clock-icon__face" cx="12" cy="12" r="10.5"></circle><line class="clock-icon__hand" x1="12" y1="13.5" x2="12" y2="5" style="transform:rotate(0deg)"></line><circle class="clock-icon__pin" cx="12" cy="12" r="1.6"></circle></svg><span class="player__timer">10:00</span></div><span class="player__alert" role="alert"></span></div>';

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
