import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { describe, expect, it, vi } from "vitest";

import { createAppStore } from "app/store";
import { LIEM } from "game/opponent/players";
import { uciToMove } from "game/opponent/position";
import type { MoveChoice } from "game/opponent/opponent";
import { newLiemGame, startLiemGame, switchMode } from "features/liem/liemActions";
import { setColorPick, setStrength } from "features/liem/matchSlice";
import { toggleFlip } from "../viewSlice";
import type { LiemOpponent } from "features/liem/opponentController";
import { createLiemController, liemGameId, syncLiemTurn } from "features/liem/useLiemOpponent";
import { backToGame, openReview } from "features/review/reviewActions";
import { clickSquare, playOpponentMove } from "../BoardSlice";
import { Board } from "../Board";
import { avatarSrc } from "../components/avatar";
import { players } from "../../../game/players";

type Store = ReturnType<typeof createAppStore>;

function render(store: Store): string {
  return renderToStaticMarkup(
    <Provider store={store}>
      <DndProvider backend={HTML5Backend}>
        <Board />
      </DndProvider>
    </Provider>
  );
}

/** The whole `<div>` whose opening tag starts at `start` (divs only are counted). */
function outerDiv(html: string, start: number): string {
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0] === "</div>" ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + m[0].length);
  }
  throw new Error("unbalanced markup");
}

/** The first `<div>` whose class list has `cls`. */
function divWithClass(html: string, cls: string): string {
  const m = new RegExp(`<div[^>]*class="(?:[^"]* )?${cls}(?: [^"]*)?"`).exec(html);
  if (!m) throw new Error(`no div.${cls}`);
  return outerDiv(html, m.index);
}

/** The text of each player card's name, in order. */
function playerNames(html: string): string[] {
  return Array.from(
    html.matchAll(
      /class="player__name">(?:<span class="player__title">[^<]*<\/span>)?(?:<span class="liem-star"[^>]*>[^<]*<\/span>)?([^<]*)/g
    ),
    (m) => m[1].trim()
  );
}

/** The label of each button in the `.buttons` row. */
function buttonLabels(html: string): string[] {
  const row = divWithClass(html, "buttons");
  return Array.from(row.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g), (m) => {
    const aria = m[1].match(/aria-label="([^"]*)"/)?.[1];
    return aria ?? m[2].replace(/<[^>]+>/g, "").trim();
  });
}

/** The `.squares` box: the board's own squares, with or without the setup card. */
const SQUARES_RE = /<div[^>]*class="squares(?: [^"]*)?"/;

/** Each player card's html, in order. */
function cards(html: string): string[] {
  return Array.from(html.matchAll(/<div class="player">/g), (m) => outerDiv(html, m.index!));
}

/** The board's player cards above and below its `.squares` box. */
function cardsAround(html: string): { above: string[]; below: string[] } {
  const board = divWithClass(html, "board");
  const m = SQUARES_RE.exec(board);
  if (!m) throw new Error("no .squares");
  const squares = outerDiv(board, m.index);
  return {
    above: cards(board.slice(0, m.index)),
    below: cards(board.slice(m.index + squares.length)),
  };
}

/** The digits on a card's clock. */
function clockText(card: string): string {
  return card.match(/class="player__timer">([^<]*)</)?.[1] ?? "";
}

/** Two players, after one click on its tab. */
function twoPlayers(): Store {
  const store = createAppStore();
  store.dispatch(switchMode("two-player"));
  return store;
}

function liemGameAs(color: "white" | "black"): Store {
  const store = createAppStore();
  store.dispatch(switchMode("liem"));
  store.dispatch(setColorPick(color));
  store.dispatch(startLiemGame());
  return store;
}

const sq = (name: string) => ({ y: 8 - Number(name[1]), x: "abcdefgh".indexOf(name[0]) });

/** You on White lose to Fool's mate: you click your moves, he plays his. */
function finishedLiemGame(): Store {
  const store = liemGameAs("white");
  for (const uci of ["f2f3", "e7e5", "g2g4", "d8h4"]) {
    const { board } = store.getState();
    const ply = board.engineHistory.length - 1;
    const state = board.engineHistory[ply];
    if (state.turn === board.humanColor) {
      store.dispatch(clickSquare(sq(uci.slice(0, 2))));
      store.dispatch(clickSquare(sq(uci.slice(2, 4))));
    } else {
      store.dispatch(playOpponentMove({ gameId: board.gameId, ply, move: uciToMove(state, uci)! }));
    }
  }
  return store;
}

/** The markup from the top of the board through the end of its `.squares` box. */
function boardTop(html: string): string {
  const board = divWithClass(html, "board");
  const m = SQUARES_RE.exec(board);
  if (!m) throw new Error("no .squares");
  return board.slice(0, m.index);
}

/** The visible text of a card's detail line, tags stripped. */
function detailText(card: string): string {
  const at = card.indexOf('class="liem-detail__sub"');
  if (at === -1) return "";
  const m = card.slice(at).match(/^class="liem-detail__sub">((?:<span[^>]*>[^<]*<\/span>)*)<\/span>/);
  return (m?.[1] ?? "").replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");
}

/** A sparring bot's card at `elo`: the knight, "Sparring · N" and his openings line; no GM, star or photo. */
function expectSparringCard(card: string, elo: number) {
  expect(playerNames(card)).toEqual([`Sparring · ${elo}`]);
  expect(card).toContain('<span class="liem-sparring-avatar" aria-hidden="true">♞</span>');
  expect(card).not.toContain("<img");
  expect(card).not.toContain('class="player__title"');
  expect(card).not.toContain("liem-star");
  expect(card).toMatch(/class="liem-detail"/);
  expect(detailText(card)).toBe("Plays Liem's openings");
}

/** His own card: his photo, the GM tag, the gold star and "GM · 2732". */
function expectLiemCard(card: string) {
  expect(playerNames(card)).toEqual([LIEM.entry.name]);
  expect(card).toContain(`<span class="player__title">${LIEM.entry.title}</span>`);
  expect(card).toContain(`src="${avatarSrc(LIEM.entry.avatar)}"`);
  expect(card).toMatch(/<span class="liem-star" aria-hidden="true">★<\/span>/);
  expect(card).not.toContain("liem-sparring-avatar");
  expect(detailText(card)).toBe(`${LIEM.entry.title} · ${LIEM.entry.rating}`);
}

/** The opponent's card at the default level, 2100: a sparring bot. */
const expectHisCard = (card: string) => expectSparringCard(card, 2100);

function expectYourCard(card: string) {
  expect(playerNames(card)).toEqual(["You"]);
  expect(card).toContain(`src="${avatarSrc(null)}"`);
  expect(card).not.toMatch(/class="liem-detail"/);
}

describe("board modes", () => {
  it("two players unchanged after the switch", () => {
    // The page opens on vs Liem: the card is up and there's no Play or Reset.
    const load = render(createAppStore());
    expect(load).toMatch(/role="dialog" aria-label="Challenge Le Quang Liem"/);
    expect(buttonLabels(load)).toEqual(["Flip board", "Sound"]);

    // One click on Two players gives the old layout.
    const html = render(twoPlayers());
    const board = divWithClass(html, "board");

    expect(board).toMatch(/role="tablist"/);
    expect(Array.from(board.matchAll(/role="tab"[^>]*>([^<]*)</g), (m) => m[1])).toEqual([
      "vs Liem",
      "Two players",
    ]);

    // The board's own two cards: black above the squares, white below.
    const squaresAt = board.indexOf('class="squares"');
    expect(squaresAt).toBeGreaterThan(-1);
    const [white, black] = players;
    expect(playerNames(board.slice(0, squaresAt))).toEqual([black.name]);
    expect(playerNames(board.slice(squaresAt))).toEqual([white.name]);

    expect(buttonLabels(html)).toEqual(["Play", "Reset", "Flip board", "Sound"]);
    expect(html).not.toMatch(/role="dialog"/);
    expect(html).not.toMatch(/data-book-state=/);
    expect(html).not.toMatch(/liem-dimmed/);
  });

  it("sparring and Liem cards", () => {
    // A 1400 game: the sparring bot's card.
    const store = createAppStore();
    store.dispatch(setStrength(1400));
    store.dispatch(startLiemGame());
    const sparring = cardsAround(render(store)).above[0];
    expectSparringCard(sparring, 1400);
    expect(sparring).toContain('aria-label="Clock for Sparring · 1400"');

    // Each sparring level reads its own number, with the card open too.
    for (const n of [1700, 1900, 2100, 2300, 2500] as const) {
      const open = createAppStore();
      open.dispatch(setStrength(n));
      expectSparringCard(cardsAround(render(open)).above[0], n);
    }

    // The Liem level: his own card, with the card open and in a game.
    const him = createAppStore();
    him.dispatch(setStrength("full"));
    expectLiemCard(cardsAround(render(him)).above[0]);
    him.dispatch(startLiemGame());
    const liem = cardsAround(render(him)).above[0];
    expectLiemCard(liem);
    expect(detailText(liem)).not.toMatch(/playing|about/);

    // Your card is the same at every level.
    expectYourCard(cardsAround(render(store)).below[0]);
    expectYourCard(cardsAround(render(him)).below[0]);
  });

  it("setup card over the dimmed board", () => {
    const store = createAppStore();
    store.dispatch(switchMode("liem"));
    const html = render(store);
    const board = divWithClass(html, "board");
    const squares = divWithClass(board, "squares");

    expect(board).toMatch(/role="tablist"/);
    expect(squares).toMatch(/role="dialog" aria-label="Challenge Le Quang Liem"/);
    // The squares are dimmed; the card on top of them is not.
    const dimmed = divWithClass(squares, "liem-dimmed");
    expect(dimmed.match(/data-square="/g)).toHaveLength(64);
    expect(dimmed).not.toMatch(/role="dialog"/);

    // His card above the board and yours below, both at full time; none in the sidebar.
    const { above, below } = cardsAround(html);
    expect(above).toHaveLength(1);
    expect(below).toHaveLength(1);
    expectHisCard(above[0]);
    expectYourCard(below[0]);
    expect(clockText(above[0])).toBe("10:00");
    expect(clockText(below[0])).toBe("10:00");
    expect(cards(divWithClass(html, "sidebar"))).toEqual([]);

    expect(buttonLabels(html)).toEqual(["Flip board", "Sound"]);
    expect(html).not.toMatch(/data-book-state=/);
  });

  it("vs-Liem cards around the board", () => {
    // As Black the board is flipped, so White (his color) is on top.
    const html = render(liemGameAs("black"));
    const { above, below } = cardsAround(html);
    expect(above).toHaveLength(1);
    expect(below).toHaveLength(1);
    const [his] = above;
    const [yours] = below;
    expectHisCard(his);
    // White moves first and the clocks run at once, so his (White) clock is the running one.
    expect(his).toMatch(/player__time--running/);
    expectYourCard(yours);
    expect(yours).not.toMatch(/player__time--running/);
    expect(playerNames(html)).toEqual(["Sparring · 2100", "You"]);
  });

  it("setup cards follow the flip", () => {
    // Flipped, White is on top: with White picked, your card is above and his below.
    const store = createAppStore();
    store.dispatch(toggleFlip());
    store.dispatch(switchMode("liem"));
    let { above, below } = cardsAround(render(store));
    expectYourCard(above[0]);
    expectHisCard(below[0]);

    // Unflipped with Black picked: Black (you) is on top, White (him) below.
    const unflipped = createAppStore();
    unflipped.dispatch(switchMode("liem"));
    unflipped.dispatch(setColorPick("black"));
    ({ above, below } = cardsAround(render(unflipped)));
    expectYourCard(above[0]);
    expectHisCard(below[0]);
  });

  it("vs-Liem as White puts him on Black, above the board", () => {
    const { above, below } = cardsAround(render(liemGameAs("white")));
    expectHisCard(above[0]);
    expectYourCard(below[0]);
    expect(below[0]).toMatch(/player__time--running/);
  });

  it("vs-Liem cards follow the flip", () => {
    const store = liemGameAs("black");
    store.dispatch(toggleFlip()); // unflipped: Black (you) on top, White (him) below
    const { above, below } = cardsAround(render(store));
    expectYourCard(above[0]);
    expectHisCard(below[0]);
    expect(below[0]).toMatch(/player__time--running/);
  });

  it("vs-Liem sidebar order", () => {
    const html = render(liemGameAs("black"));
    const sidebar = divWithClass(html, "sidebar");

    // No cards in the sidebar: the note, then the buttons, Fallen Pieces and Notation.
    expect(cards(sidebar)).toEqual([]);
    const noteAt = sidebar.indexOf("data-book-state=");
    const buttonsAt = sidebar.indexOf('class="buttons"');
    expect(noteAt).toBeGreaterThan(-1);
    expect(buttonsAt).toBeGreaterThan(noteAt);
    expect(sidebar.indexOf("Fallen Pieces")).toBeGreaterThan(buttonsAt);
    expect(sidebar.indexOf("Notation")).toBeGreaterThan(sidebar.indexOf("Fallen Pieces"));
    expect(buttonLabels(html)).toEqual(["New game", "Flip board", "Sound"]);
  });

  it("the board's surroundings are the same in every mode", () => {
    const setup = createAppStore();
    setup.dispatch(switchMode("liem"));
    const flippedSetup = createAppStore();
    flippedSetup.dispatch(toggleFlip());
    flippedSetup.dispatch(switchMode("liem"));
    const finished = finishedLiemGame();
    const reviewed = finishedLiemGame();
    reviewed.dispatch(openReview());
    reviewed.dispatch(backToGame());
    const states: [string, Store][] = [
      ["two players", twoPlayers()],
      ["vs Liem, card open", setup],
      ["vs Liem, card open, flipped", flippedSetup],
      ["vs Liem as White", liemGameAs("white")],
      ["vs Liem as Black", liemGameAs("black")],
      ["vs Liem, game over", finished],
      ["vs Liem, back from the review", reviewed],
    ];
    for (const [name, store] of states) {
      const html = render(store);
      const { above, below } = cardsAround(html);
      expect({ name, above: above.length, below: below.length }).toEqual({ name, above: 1, below: 1 });
      // Nothing extra above the board: the tabs and one card, as in every mode.
      expect({ name, top: boardTop(html).match(/role="tablist"/g)?.length }).toEqual({ name, top: 1 });
      expect({ name, graph: /data-review-graph/.test(html) }).toEqual({ name, graph: false });
      expect({ name, review: /data-review-state=/.test(html) }).toEqual({ name, review: false });
    }

    // A finished game keeps the game's layout, with Review game added to the row.
    expect(buttonLabels(render(finished))).toEqual(["Review game", "New game", "Flip board", "Sound"]);
    expect(render(reviewed)).toBe(render(finishedLiemGame()));
  });
});

/** A fake opponent whose next choice the test resolves by hand. */
function fakeOpponent() {
  const pending: ((choice: MoveChoice) => void)[] = [];
  const opponent: LiemOpponent = {
    chooseMove: vi.fn(() => new Promise<MoveChoice>((resolve) => pending.push(resolve))),
    analyse: vi.fn(() => new Promise<never>(() => {})),
    newGame: vi.fn(),
    dispose: vi.fn(),
  };
  return { opponent, answer: (choice: MoveChoice) => pending.shift()!(choice) };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function e2e4(store: Store): MoveChoice {
  const state = store.getState().board.engineHistory[0];
  return { move: uciToMove(state, "e2e4")!, uci: "e2e4", source: "engine", lookup: null };
}

describe("liem opponent wiring", () => {
  it("liemGameId is set only during a vs-Liem game", () => {
    const store = createAppStore();
    const id = () => liemGameId(store.getState().board, store.getState().match);
    expect(id()).toBeNull(); // page load: card open
    store.dispatch(switchMode("two-player"));
    expect(id()).toBeNull(); // two players
    store.dispatch(switchMode("liem"));
    expect(id()).toBeNull(); // card open again
    store.dispatch(startLiemGame());
    expect(id()).toBe(store.getState().board.gameId);
    store.dispatch(newLiemGame());
    expect(id()).toBeNull();
  });

  it("his answer is played on the board and recorded", async () => {
    const store = liemGameAs("black");
    const { opponent, answer } = fakeOpponent();
    const controller = createLiemController(store.dispatch, () => Promise.resolve(opponent));

    syncLiemTurn(controller, store.getState().board, store.getState().match);
    await flush();
    expect(store.getState().match.opponentStatus).toBe("thinking");

    const { gameId } = store.getState().board;
    answer(e2e4(store));
    await flush();

    const { board, match } = store.getState();
    expect(board.engineHistory).toHaveLength(2);
    expect(board.notation[board.notation.length - 1]).toMatch(/e4/);
    expect(match.lastChoice).toEqual({ gameId, ply: 0, uci: "e2e4", source: "engine", lookup: null });
    expect(match.opponentStatus).toBe("idle");

    // Now it's the human's turn: syncing asks for nothing more.
    syncLiemTurn(controller, board, match);
    await flush();
    expect(opponent.chooseMove).toHaveBeenCalledTimes(1);
  });

  it("a stale answer after New game is not played", async () => {
    const store = liemGameAs("black");
    const { opponent, answer } = fakeOpponent();
    const controller = createLiemController(store.dispatch, () => Promise.resolve(opponent));

    syncLiemTurn(controller, store.getState().board, store.getState().match);
    await flush();
    const choice = e2e4(store);

    store.dispatch(newLiemGame());
    syncLiemTurn(controller, store.getState().board, store.getState().match);
    answer(choice);
    await flush();

    expect(store.getState().board.engineHistory).toHaveLength(1);
    expect(store.getState().match.lastChoice).toBeNull();
    expect(store.getState().match.opponentStatus).toBe("idle");
  });

  it("he loads only once a vs-Liem game asks him", async () => {
    const store = createAppStore();
    const load = vi.fn(() => Promise.resolve(fakeOpponent().opponent));
    const controller = createLiemController(store.dispatch, load);
    const sync = () => syncLiemTurn(controller, store.getState().board, store.getState().match);

    sync(); // page load: card open
    store.dispatch(switchMode("two-player"));
    sync(); // two players
    store.dispatch(switchMode("liem"));
    sync(); // card open again
    await flush();
    expect(load).not.toHaveBeenCalled();

    store.dispatch(setColorPick("black"));
    store.dispatch(startLiemGame());
    sync();
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
