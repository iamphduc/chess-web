import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { createAppStore, store } from "app/store";
import { switchMode } from "features/liem/liemActions";
import { clickSquare, resign, start } from "../BoardSlice";
import { clockForPhase, msUntilNextTick, Player } from "../components/Player";
import { initialClock, TOTAL_MS } from "../clock";
import { gameEnd } from "../gameEnd";

describe("Player", () => {
  it("player renders the new clock at start", () => {
    const html = renderToStaticMarkup(
      <Provider store={store}>
        <Player name="Me" title={null} avatar={null} isWhite={true} />
      </Provider>
    );
    expect(html.match(/role="timer"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Clock for Me"');
    const timer = html.match(/<span class="player__timer">((?:<span class="player__timer-(?:digit|sep)">[^<]<\/span>)*)<\/span>/);
    expect(timer?.[1].replace(/<[^>]+>/g, "")).toBe("10:00");
    // Exactly one svg in the card, and it is our clock icon; a react-icons
    // icon would be a second <svg> without that class.
    const svgs = html.match(/<svg[^>]*>/g) ?? [];
    expect(svgs).toHaveLength(1);
    expect(svgs[0]).toContain('class="clock-icon"');
  });
});

describe("Player avatar", () => {
  const renderPlayer = (node: React.ReactElement) =>
    renderToStaticMarkup(<Provider store={store}>{node}</Provider>);

  it("image avatar unchanged", () => {
    const html = renderPlayer(<Player name="Le Quang Liem" title="GM" avatar="le-quang-liem.png" isWhite={false} />);
    expect(html).toMatch(
      /^<div class="player"><div class="player__info"><img class="player__avatar" src="[^"]+" alt="Avatar" width="40" height="40"\/><div class="player__name"><span class="player__title">GM<\/span>Le Quang Liem<\/div><\/div>/
    );
    expect(html).not.toContain("player__disc");
  });

  it("a glyph avatar takes the image's place, hidden from screen readers", () => {
    const html = renderPlayer(<Player name="Medium" title={null} avatar={null} glyph="♞" isWhite={false} />);
    expect(html).toContain(
      '<div class="player__info"><span class="player__disc liem-sparring-avatar" aria-hidden="true">♞</span><div class="player__name">Medium</div></div>'
    );
    expect(html).not.toContain("<img");
    expect(html).toContain('aria-label="Clock for Medium"');
  });

  it("color disc when no avatar", () => {
    const white = renderPlayer(<Player name="You" title={null} avatar={null} isWhite={true} />);
    expect(white).toContain(
      '<div class="player__info"><span class="player__disc" aria-hidden="true">♔</span><div class="player__name">You</div></div>'
    );
    expect(white).not.toContain("<img");
    const black = renderPlayer(<Player name="You" title={null} avatar={null} isWhite={false} />);
    expect(black).toContain('<span class="player__disc" aria-hidden="true">♚</span>');
    expect(black).not.toContain("<img");
    // An avatar name with no image behind it falls back to the disc, never a broken image.
    const unknown = renderPlayer(<Player name="X" title={null} avatar="nobody.png" isWhite={false} />);
    expect(unknown).toContain('<span class="player__disc" aria-hidden="true">♚</span>');
    expect(unknown).not.toContain("<img");
  });

  it("the name line is the title then the name, with nothing between", () => {
    const props = { name: "Le Quang Liem", title: "GM", avatar: null, isWhite: false, nameMark: <b>★</b> };
    const html = renderPlayer(<Player {...props} />);
    expect(html).toContain('<div class="player__name"><span class="player__title">GM</span>Le Quang Liem</div>');
  });
});

describe("material line", () => {
  const sq = (name: string) => ({ y: 8 - Number(name[1]), x: "abcdefgh".indexOf(name[0]) });

  /** A two-player board after `moves` (UCI), each played by clicking its two squares. */
  function boardAfter(...moves: string[]) {
    const s = createAppStore();
    s.dispatch(switchMode("two-player"));
    for (const uci of moves) {
      s.dispatch(clickSquare(sq(uci.slice(0, 2))));
      s.dispatch(clickSquare(sq(uci.slice(2, 4))));
    }
    return s;
  }

  const card = (s: ReturnType<typeof createAppStore>, isWhite: boolean) =>
    renderToStaticMarkup(
      <Provider store={s}>
        <Player name={isWhite ? "White" : "Black"} title={null} avatar={null} isWhite={isWhite} />
      </Provider>
    );

  it("no material element at the start", () => {
    const s = boardAfter();
    expect(card(s, true)).not.toContain("player__material");
    expect(card(s, false)).not.toContain("player__material");
  });

  it("+3 and the knight after White takes a knight, nothing for Black", () => {
    // 1.e4 Nf6 2.Nc3 Ng4 3.Qxg4
    const s = boardAfter("e2e4", "g8f6", "b1c3", "f6g4", "d1g4");
    expect(s.getState().board.engineHistory).toHaveLength(6); // all five moves were played
    const white = card(s, true);
    expect(white).toMatch(/<span class="player__material" data-material="3">/);
    expect(white).toMatch(/<span class="player__advantage">\+3<\/span>/);
    expect(white).toMatch(/class="player__captured"[^>]*>♞<\/span>/);
    // it sits beside the name, after it
    expect(white.indexOf("player__material")).toBeGreaterThan(white.indexOf("player__name"));
    expect(card(s, false)).not.toContain("player__material");
  });

  it("an equal trade lists the captures with no +N", () => {
    // 1.e4 d5 2.exd5 Qxd5
    const s = boardAfter("e2e4", "d7d5", "e4d5", "d8d5");
    const white = card(s, true);
    const black = card(s, false);
    expect(white).toMatch(/data-material="0"/);
    expect(white).toMatch(/class="player__captured"[^>]*>♟<\/span>/);
    expect(black).toMatch(/class="player__captured"[^>]*>♙<\/span>/);
    expect(white + black).not.toContain("player__advantage");
  });

  it("the captured pieces are named for screen readers", () => {
    const s = boardAfter("e2e4", "g8f6", "b1c3", "f6g4", "d1g4");
    expect(card(s, true)).toMatch(/class="player__captured" role="img" aria-label="Captured: knight"/);
  });
});

describe("finished game clocks", () => {
  const sq = (name: string) => ({ y: 8 - Number(name[1]), x: "abcdefgh".indexOf(name[0]) });
  const clock = (s: ReturnType<typeof createAppStore>, isWhite: boolean) =>
    renderToStaticMarkup(
      <Provider store={s}>
        <Player name="P" title={null} avatar={null} isWhite={isWhite} />
      </Provider>
    ).match(/<div class="(player__time[^"]*)"/)![1];

  it("a finished game shows no clock as running", () => {
    // Two players with the clocks running: White's turn shows the running look.
    const s = createAppStore();
    s.dispatch(switchMode("two-player"));
    s.dispatch(start());
    expect(clock(s, true)).toBe("player__time player__time--running");
    expect(clock(s, false)).toBe("player__time");
    // White resigns on its own turn: both clocks stop, neither looks running.
    s.dispatch(resign());
    expect(clock(s, true)).toBe("player__time");
    expect(clock(s, false)).toBe("player__time");

    // A mate: the mated side is to move, and its clock doesn't look running either.
    const m = createAppStore();
    m.dispatch(switchMode("two-player"));
    m.dispatch(start());
    for (const [from, to] of [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]) {
      m.dispatch(clickSquare(sq(from)));
      m.dispatch(clickSquare(sq(to)));
    }
    expect(gameEnd(m.getState().board)?.reason).toBe("checkmate");
    expect(clock(m, true)).toBe("player__time");
    expect(clock(m, false)).toBe("player__time");
  });
});

describe("clockForPhase", () => {
  const running = { remainingMs: 500000, startedAt: 1000 };
  const paused = { remainingMs: 500000, startedAt: null };

  it("starts on running, keeping a turn already running", () => {
    expect(clockForPhase("running", paused, 5000)).toEqual({ remainingMs: 500000, startedAt: 5000 });
    expect(clockForPhase("running", running, 5000)).toBe(running);
  });

  it("pauses on paused, storing the time left (final time stays after game over)", () => {
    expect(clockForPhase("paused", running, 3500)).toEqual({ remainingMs: 497500, startedAt: null });
    expect(clockForPhase("paused", paused, 9999)).toBe(paused);
    // a flag fall: paused long after the time ran out stays at 0
    expect(clockForPhase("paused", running, 10_000_000)).toEqual({ remainingMs: 0, startedAt: null });
  });

  it("goes back to 10:00 on reset", () => {
    expect(clockForPhase("reset", running, 3500)).toEqual({ remainingMs: TOTAL_MS, startedAt: null });
    expect(clockForPhase("reset", { remainingMs: 0, startedAt: null }, 1)).toEqual(initialClock());
    const fresh = initialClock();
    expect(clockForPhase("reset", fresh, 1)).toBe(fresh);
  });
});

describe("clockForPhase on a new game", () => {
  it("a new game restarts the clock", () => {
    const low = { remainingMs: 4000, startedAt: 1000 };
    const stopped = { remainingMs: 0, startedAt: null };
    // Running: full time, started now, even if it was already running.
    expect(clockForPhase("running", low, 7000, true)).toEqual({ remainingMs: TOTAL_MS, startedAt: 7000 });
    expect(clockForPhase("running", stopped, 7000, true)).toEqual({ remainingMs: TOTAL_MS, startedAt: 7000 });
    // Paused or reset: back to the start clock.
    expect(clockForPhase("paused", low, 7000, true)).toEqual(initialClock());
    expect(clockForPhase("paused", stopped, 7000, true)).toEqual(initialClock());
    expect(clockForPhase("reset", low, 7000, true)).toEqual(initialClock());
    expect(clockForPhase("reset", initialClock(), 7000, true)).toEqual(initialClock());
    // Without a new game, a running clock keeps its time.
    expect(clockForPhase("running", low, 7000, false)).toBe(low);
  });
});

describe("msUntilNextTick", () => {
  it("waits until the shown digits change, not a fixed second from turn start", () => {
    expect(msUntilNextTick(543210, 1000)).toBe(211); // 09:03 -> 09:02 at 542999
    expect(msUntilNextTick(543000, 1000)).toBe(1);
    expect(msUntilNextTick(600000, 1000)).toBe(1); // 10:00 -> 09:59 right away
    expect(msUntilNextTick(10210, 1000)).toBe(211); // lands on 9999: tenths start on time
  });

  it("steps per tenth under 10s", () => {
    expect(msUntilNextTick(9999, 100)).toBe(100); // 9.9 -> 9.8 at 9899
    expect(msUntilNextTick(9850, 100)).toBe(51);
    expect(msUntilNextTick(50, 100)).toBe(51); // reaches 0 -> flag fall
  });
});
