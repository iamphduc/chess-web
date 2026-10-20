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
import { newLiemGame, replayLiemGame, startLiemGame, switchMode } from "features/liem/liemActions";
import { setColorPick, setStrength } from "features/liem/matchSlice";
import { toggleFlip } from "../viewSlice";
import type { LiemOpponent } from "features/liem/opponentController";
import { createLiemController, liemGameId, syncLiemTurn } from "features/liem/useLiemOpponent";
import { backToGame, openReview } from "features/review/reviewActions";
import { clickSquare, playOpponentMove, reset, resign, start } from "../BoardSlice";
import { gameEnd } from "../gameEnd";
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
      /class="player__name">(?:<span class="player__title">[^<]*<\/span>)?([^<]*)/g
    ),
    (m) => m[1].trim()
  );
}

/** The label of each button or link in `html`: its `aria-label`, else its text. */
function controlLabels(html: string): string[] {
  return Array.from(html.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g), (m) => {
    const aria = m[2].match(/aria-label="([^"]*)"/)?.[1];
    return aria ?? m[3].replace(/<[^>]+>/g, "").trim();
  });
}

/** The Moves card in the sidebar. */
const movesCard = (html: string) => divWithClass(divWithClass(html, "sidebar"), "moves-card");

/** The labels of the controls in the Moves card's foot. */
const footLabels = (html: string) => controlLabels(divWithClass(movesCard(html), "card__foot"));

/** The top bar's markup. */
function topBar(html: string): string {
  const m = /<header class="top-bar"[\s\S]*?<\/header>/.exec(html);
  if (!m) throw new Error("no header.top-bar");
  return m[0];
}

/** Each scoresheet row as [number, white, black], tags stripped. */
function scoresheetRows(html: string): string[][] {
  return Array.from(html.matchAll(/<li class="scoresheet__row">([\s\S]*?)<\/li>/g), (m) =>
    Array.from(m[1].matchAll(/<span class="(?:scoresheet__num|notation__move)">((?:<span[^>]*>[^<]*<\/span>|[^<])*)<\/span>/g), (c) =>
      c[1].replace(/<[^>]+>/g, "").trim()
    )
  );
}

/** The text of the move in the ink chip. */
const currentMove = (html: string) => html.match(/class="scoresheet__current">([^<]*)</)?.[1];

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

/** A sparring bot's card named `name`: the knight, the level's name and his openings line; no GM, star, photo or rating. */
function expectSparringCard(card: string, name: string) {
  expect(playerNames(card)).toEqual([name]);
  expect(card).not.toMatch(/\b(1400|1700|1900|2100|2300|2500)\b|about/);
  expect(card).toContain('<span class="liem-sparring-avatar" aria-hidden="true">♞</span>');
  expect(card).not.toContain("<img");
  expect(card).not.toContain('class="player__title"');
  expect(card).not.toContain("liem-star");
  expect(card).toMatch(/class="liem-detail"/);
  expect(detailText(card)).toBe("Plays Liem's openings");
}

/** His own card: his photo, the GM tag and "GM · 2732". No star before his name, so it fits on a phone. */
function expectLiemCard(card: string) {
  expect(playerNames(card)).toEqual([LIEM.entry.name]);
  expect(card).toContain(`<span class="player__title">${LIEM.entry.title}</span>`);
  expect(card).toContain(`src="${avatarSrc(LIEM.entry.avatar)}"`);
  expect(card).not.toContain("liem-star");
  expect(card).toContain(
    `<div class="player__name"><span class="player__title">${LIEM.entry.title}</span>${LIEM.entry.name}<div class="player__detail">`
  );
  expect(card).not.toContain("liem-sparring-avatar");
  expect(detailText(card)).toBe(`${LIEM.entry.title} · ${LIEM.entry.rating}`);
}

/** The opponent's card at the default level, 2100: the "Harder" sparring bot. */
const expectHisCard = (card: string) => expectSparringCard(card, "Harder");

function expectYourCard(card: string) {
  expect(playerNames(card)).toEqual(["You"]);
  expect(card).toContain(`src="${avatarSrc(null)}"`);
  expect(card).not.toMatch(/class="liem-detail"/);
}

describe("board modes", () => {
  it("two players foot", () => {
    const store = twoPlayers();
    const html = render(store);
    const board = divWithClass(html, "board");

    // No tabs: the top bar names the mode.
    expect(html).not.toMatch(/role="tablist"|role="tab"/);
    expect(topBar(html)).toContain('<span class="top-bar__title">Two players</span>');

    // The board's own two cards: black above the squares, white below.
    const squaresAt = board.indexOf('class="squares"');
    expect(squaresAt).toBeGreaterThan(-1);
    const [white, black] = players;
    expect(playerNames(board.slice(0, squaresAt))).toEqual([black.name]);
    expect(playerNames(board.slice(squaresAt))).toEqual([white.name]);

    expect(footLabels(html)).toEqual(["Play", "New game", "Flip board", "Sound"]);
    expect(html).not.toMatch(/resign-button/);
    expect(html).not.toMatch(/data-book-state=/);
    expect(html).not.toMatch(/href="#\/review"/);

    // Play starts the clocks; New game (the old Reset) clears the moves and stops them.
    const before = store.getState().board.gameId;
    store.dispatch(start());
    expect(store.getState().board.isPlaying).toBe(true);
    store.dispatch(clickSquare(sq("e2")));
    store.dispatch(clickSquare(sq("e4")));
    expect(store.getState().board.notation).toHaveLength(1);
    store.dispatch(reset());
    const after = store.getState().board;
    expect(after.notation).toEqual([]);
    expect(after.isPlaying).toBe(false);
    expect(after.gameId).toBe(before + 1);
    expect(store.getState().match.mode).toBe("two-player");
    expect(scoresheetRows(render(store))).toEqual([]);

    // Clocks running: Play hides and Resign sits after New game.
    store.dispatch(start());
    const running = render(store);
    expect(footLabels(running)).toEqual(["New game", "Resign", "Flip board", "Sound"]);
    expect(divWithClass(movesCard(running), "card__foot")).toContain(
      '<button type="button" class="button resign-button">Resign</button>'
    );

    // Over after a resign: New game, Flip and Sound.
    store.dispatch(resign());
    expect(gameEnd(store.getState().board)?.reason).toBe("resigned");
    expect(footLabels(render(store))).toEqual(["New game", "Flip board", "Sound"]);

    // New game brings Play back.
    store.dispatch(reset());
    expect(footLabels(render(store))).toEqual(["Play", "New game", "Flip board", "Sound"]);

    // Over by a mate played without Play (clocks never ran): no Play, no Resign.
    for (const [from, to] of [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]) {
      store.dispatch(clickSquare(sq(from)));
      store.dispatch(clickSquare(sq(to)));
    }
    expect(gameEnd(store.getState().board)?.reason).toBe("checkmate");
    expect(footLabels(render(store))).toEqual(["New game", "Flip board", "Sound"]);
  });

  it("sparring and Liem cards", () => {
    // A game at the default level, 2100: the "Harder" sparring bot's card.
    const store = createAppStore();
    store.dispatch(startLiemGame());
    const sparring = cardsAround(render(store)).above[0];
    expectSparringCard(sparring, "Harder");
    expect(sparring).toContain('aria-label="Clock for Harder"');

    // Each sparring level reads its own name, with the card open too.
    const levels = [
      [1400, "Easy"],
      [1700, "Medium"],
      [1900, "Hard"],
      [2100, "Harder"],
      [2300, "Expert"],
      [2500, "Master"],
    ] as const;
    for (const [n, name] of levels) {
      const open = createAppStore();
      open.dispatch(setStrength(n));
      expectSparringCard(cardsAround(render(open)).above[0], name);
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

  it("vs Liem board screen", () => {
    const html = render(liemGameAs("white"));

    // The top bar: ← Home, then the title.
    const bar = topBar(html);
    expect(bar).toMatch(/^<header class="top-bar">/);
    expect(bar).toMatch(/<a class="button top-bar__home" href="#\/">← Home<\/a>/);
    expect(bar).toContain('<span class="top-bar__title">vs Harder · you play White</span>');
    expect(html.indexOf("<header")).toBeLessThan(html.indexOf('class="board"'));

    // No tabs, no setup dialog, no dimming, no Fallen Pieces, no old wrappers.
    expect(html).not.toMatch(/role="tablist"|role="tab"/);
    expect(html).not.toMatch(/role="dialog"/);
    expect(html).not.toMatch(/liem-dimmed|squares__overlay|liem-side|setup-card/);
    expect(html).not.toMatch(/Fallen Pieces|fallen-piece/);
    expect(html).not.toMatch(/class="buttons"/);

    // The sidebar: the book note, then the Moves card, and nothing else.
    const sidebar = divWithClass(html, "sidebar");
    expect(cards(sidebar)).toEqual([]);
    const noteAt = sidebar.indexOf("data-book-state=");
    const movesAt = sidebar.search(/class="card [^"]*moves-card/);
    expect(noteAt).toBeGreaterThan(-1);
    expect(movesAt).toBeGreaterThan(noteAt);
    expect(movesCard(html)).toMatch(/class="notation"/);
    expect(movesCard(html)).toMatch(/class="card__head">Moves</);

    // The squares are live: 64 of them, not hidden.
    const squares = divWithClass(divWithClass(html, "board"), "squares");
    expect(squares.match(/data-square="/g)).toHaveLength(64);
    expect(squares).not.toMatch(/aria-hidden/);

    // As Black at Liem: his name in the title.
    const him = createAppStore();
    him.dispatch(setStrength("full"));
    him.dispatch(setColorPick("black"));
    him.dispatch(startLiemGame());
    expect(topBar(render(him))).toContain('<span class="top-bar__title">vs Liem · you play Black</span>');
  });

  it("moves card foot", () => {
    // Mid-game, on his turn too: New game, Resign, Flip and Sound; no Review game.
    const mid = render(liemGameAs("black"));
    expect(footLabels(mid)).toEqual(["New game", "Resign", "Flip board", "Sound"]);
    expect(mid).not.toMatch(/href="#\/review"/);
    expect(divWithClass(movesCard(mid), "card__foot")).toContain(
      '<button type="button" class="button resign-button">Resign</button>'
    );

    // A resign before your first move: over, with nothing to review.
    const early = liemGameAs("white");
    early.dispatch(resign());
    expect(footLabels(render(early))).toEqual(["New game", "Flip board", "Sound"]);

    // A resign after a move of yours: Review game shows.
    const resigned = liemGameAs("white");
    resigned.dispatch(clickSquare(sq("e2")));
    resigned.dispatch(clickSquare(sq("e4")));
    resigned.dispatch(resign());
    expect(gameEnd(resigned.getState().board)).toEqual({ winner: "black", reason: "resigned" });
    expect(footLabels(render(resigned))).toEqual(["Review game", "New game", "Flip board", "Sound"]);

    // New game from there: in progress again.
    resigned.dispatch(replayLiemGame());
    expect(footLabels(render(resigned))).toEqual(["New game", "Resign", "Flip board", "Sound"]);

    // After a finished game with a move of yours: Review game first, a link to #/review.
    const done = render(finishedLiemGame());
    expect(footLabels(done)).toEqual(["Review game", "New game", "Flip board", "Sound"]);
    expect(divWithClass(movesCard(done), "card__foot")).toMatch(
      /<a class="button button--play" href="#\/review">Review game<\/a>/
    );
  });

  it("new game replays the level", async () => {
    const store = createAppStore();
    store.dispatch(setStrength(1700));
    store.dispatch(setColorPick("black"));
    store.dispatch(startLiemGame());
    const first = store.getState().board.gameId;
    expect(store.getState().view.flipped).toBe(true);

    // His turn: a fake opponent is thinking when you press New game.
    const { opponent, answer } = fakeOpponent();
    const controller = createLiemController(store.dispatch, () => Promise.resolve(opponent));
    syncLiemTurn(controller, store.getState().board, store.getState().match);
    await flush();
    const stale = e2e4(store);

    store.dispatch(replayLiemGame());
    const { board, match, view } = store.getState();
    expect(board.gameId).toBeGreaterThan(first);
    expect(board.isPlaying).toBe(true); // the clocks restart
    expect(board.humanColor).toBe("black");
    expect(match.strength).toBe(1700);
    expect(match.colorPick).toBe("black");
    expect(match.setupOpen).toBe(false);
    expect(view.flipped).toBe(true);
    expect(topBar(render(store))).toContain("vs Medium · you play Black");

    // The answer from the old game is dropped.
    syncLiemTurn(controller, store.getState().board, store.getState().match);
    answer(stale);
    await flush();
    expect(store.getState().board.engineHistory).toHaveLength(1);
    expect(store.getState().match.lastChoice).toBeNull();

    // The New game button is the one in the foot (a plain secondary button).
    expect(divWithClass(movesCard(render(store)), "card__foot")).toMatch(
      /<button type="button" class="button">New game<\/button>/
    );
  });

  it("moves card scoresheet", () => {
    const store = twoPlayers();
    expect(scoresheetRows(render(store))).toEqual([]);
    store.dispatch(clickSquare(sq("e2")));
    store.dispatch(clickSquare(sq("e4")));
    // After 1.e4 the white move is current, and the black cell is empty.
    expect(scoresheetRows(render(store))).toEqual([["1.", "e4", ""]]);
    expect(currentMove(render(store))).toBe("e4");

    store.dispatch(clickSquare(sq("e7")));
    store.dispatch(clickSquare(sq("e5")));
    const html = render(store);
    expect(scoresheetRows(html)).toEqual([["1.", "e4", "e5"]]);
    expect(currentMove(html)).toBe("e5");
    expect(html.match(/scoresheet__current/g)).toHaveLength(1);
    expect(movesCard(html)).toMatch(/<div class="notation"><ol class="scoresheet">/);

    store.dispatch(clickSquare(sq("g1")));
    store.dispatch(clickSquare(sq("f3")));
    expect(scoresheetRows(render(store))).toEqual([
      ["1.", "e4", "e5"],
      ["2.", "Nf3", ""],
    ]);
    expect(currentMove(render(store))).toBe("Nf3");
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
    expect(playerNames(html)).toEqual(["Harder", "You"]);
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

  it("the board's surroundings are the same in every mode", () => {
    const finished = finishedLiemGame();
    const reviewed = finishedLiemGame();
    reviewed.dispatch(openReview());
    reviewed.dispatch(backToGame());
    const states: [string, Store][] = [
      ["two players", twoPlayers()],
      ["vs Liem as White", liemGameAs("white")],
      ["vs Liem as Black", liemGameAs("black")],
      ["vs Liem, game over", finished],
      ["vs Liem, back from the review", reviewed],
    ];
    for (const [name, store] of states) {
      const html = render(store);
      const { above, below } = cardsAround(html);
      expect({ name, above: above.length, below: below.length }).toEqual({ name, above: 1, below: 1 });
      // Nothing above the board's top card: the top bar sits outside the board column.
      expect({ name, top: /<header|role="tablist"/.test(boardTop(html)) }).toEqual({ name, top: false });
      expect({ name, bars: html.match(/<header class="top-bar">/g)?.length }).toEqual({ name, bars: 1 });
      expect({ name, graph: /data-review-graph/.test(html) }).toEqual({ name, graph: false });
      expect({ name, review: /data-review-state=/.test(html) }).toEqual({ name, review: false });
    }

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
