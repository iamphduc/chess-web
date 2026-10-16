import { describe, expect, it } from "vitest";

import {
  graphPoints,
  lineRuns,
  moveTicks,
  nearestPosition,
  positionX,
  sideWin,
} from "../graphGeometry";

const WHITE_WIN = [50, 100, 0, null, 25];

describe("points", () => {
  it("spreads the positions across the width, the first at 0 and the last at the width", () => {
    expect([0, 1, 2, 3, 4].map((i) => positionX(i, 4, 400))).toEqual([0, 100, 200, 300, 400]);
  });

  it("puts a game with one position at the left edge", () => {
    expect(positionX(0, 0, 400)).toBe(0);
  });

  it("maps White's win % to the height, 100 at the top and 0 at the bottom", () => {
    const points = graphPoints(WHITE_WIN, {
      side: "white",
      humanColor: "black",
      width: 400,
      height: 100,
    });
    expect(points.map((p) => p && [p.index, p.x, p.y, p.win])).toEqual([
      [0, 0, 50, 50],
      [1, 100, 0, 100],
      [2, 200, 100, 0],
      null,
      [4, 400, 75, 25],
    ]);
  });

  it("flips to the human's side when he plays Black", () => {
    const points = graphPoints(WHITE_WIN, {
      side: "you",
      humanColor: "black",
      width: 400,
      height: 150,
    });
    expect(points.map((p) => p && [p.y, p.win])).toEqual([
      [75, 50],
      [150, 0],
      [0, 100],
      null,
      [37.5, 75],
    ]);
  });

  it("is White's view from the human's side when he plays White", () => {
    const you = graphPoints(WHITE_WIN, {
      side: "you",
      humanColor: "white",
      width: 400,
      height: 100,
    });
    const white = graphPoints(WHITE_WIN, {
      side: "white",
      humanColor: "white",
      width: 400,
      height: 100,
    });
    expect(you).toEqual(white);
  });

  it("sideWin keeps null for an unanalysed position", () => {
    expect(sideWin(null, "you", "black")).toBeNull();
    expect(sideWin(30, "you", "black")).toBe(70);
    expect(sideWin(30, "white", "black")).toBe(30);
  });

  it("lineRuns breaks the line at unanalysed positions and drops lone points", () => {
    const points = graphPoints([10, 20, null, 30, null, 40, 50, 60], {
      side: "white",
      humanColor: "white",
      width: 70,
      height: 100,
    });
    expect(lineRuns(points).map((run) => run.map((p) => p.index))).toEqual([
      [0, 1],
      [5, 6, 7],
    ]);
    expect(
      lineRuns(
        graphPoints([null, null], { side: "white", humanColor: "white", width: 1, height: 1 })
      )
    ).toEqual([]);
  });

  it("moveTicks labels move 1, every 10th move and the last move at White's move", () => {
    // 76 plies: 38 moves; move m's White ply ends at position 2m - 1.
    expect(moveTicks(76)).toEqual([
      { move: 1, index: 1 },
      { move: 10, index: 19 },
      { move: 20, index: 39 },
      { move: 30, index: 59 },
      { move: 38, index: 75 },
    ]);
  });

  it("moveTicks drops a round tick too close to the last one, and handles tiny games", () => {
    expect(moveTicks(42).map((t) => t.move)).toEqual([1, 10, 21]);
    expect(moveTicks(40).map((t) => t.move)).toEqual([1, 10, 20]);
    expect(moveTicks(1)).toEqual([{ move: 1, index: 1 }]);
    expect(moveTicks(0)).toEqual([]);
  });
});

describe("nearest", () => {
  it("picks the closest position for an x", () => {
    expect([0, 49, 50, 151, 249, 400].map((x) => nearestPosition(x, 4, 400))).toEqual([
      0, 0, 1, 2, 2, 4,
    ]);
  });

  it("clamps past both ends", () => {
    expect(nearestPosition(-30, 4, 400)).toBe(0);
    expect(nearestPosition(1000, 4, 400)).toBe(4);
  });

  it("gives 0 for a one-position game or a zero width", () => {
    expect(nearestPosition(200, 0, 400)).toBe(0);
    expect(nearestPosition(200, 4, 0)).toBe(0);
  });
});
