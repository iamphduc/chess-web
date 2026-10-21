// Piece motion wiring (plan ui-feel, sprint feel › M1). The old shared transition name
// is gone, and the paths that must not slide stay instant: the Flip and a drag drop
// skip the layout animation, and both boards honour reduced motion. No component test
// covers these, so they are pinned by reading the source.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");
const SELF = relative(ROOT, __filename).split("\\").join("/");

function filesUnder(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = `${dir}/${name}`;
    return statSync(join(ROOT, path)).isDirectory() ? filesUnder(path) : [path];
  });
}

/** The body of the first arrow-function or function block that follows `marker`. */
function blockAfter(source: string, marker: string): string {
  const at = source.indexOf(marker);
  expect(at, `found ${marker}`).toBeGreaterThanOrEqual(0);
  const open = source.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(open, i + 1);
  }
  return source.slice(open);
}

describe("motion wiring", () => {
  it("the old shared name is gone", () => {
    const offenders = [...filesUnder("src"), ...filesUnder("tests")]
      .filter((file) => file !== SELF)
      .filter((file) => read(file).includes("PIECE_MOVE_TRANSITION"));
    expect(offenders).toEqual([]);
  });

  it("flip, drop and reduced motion stay instant", () => {
    // A drag drop: the drop handler starts an instant layout transition before the move.
    const square = read("src/features/board/components/Square.tsx");
    expect(square).toMatch(/const (\w+) = useInstantLayoutTransition\(\)/);
    const dropName = square.match(/const (\w+) = useInstantLayoutTransition\(\)/)![1];
    const drop = blockAfter(square, "drop: () =>");
    expect(drop).toContain(`${dropName}();`);
    expect(drop.indexOf(`${dropName}();`)).toBeLessThan(drop.indexOf("dispatch(movePiece("));

    // The Flip: its click starts one before the flip itself.
    const button = read("src/features/board/components/Button.tsx");
    const flip = blockAfter(button, "const FlipButton = () =>");
    const flipName = flip.match(/const (\w+) = useInstantLayoutTransition\(\)/)?.[1];
    expect(flipName, "FlipButton takes useInstantLayoutTransition").toBeDefined();
    const click = blockAfter(flip, "onClick={() =>");
    expect(click).toContain(`${flipName}();`);
    expect(click.indexOf(`${flipName}();`)).toBeLessThan(click.indexOf("dispatch(toggleFlip())"));

    // Reduced motion: one MotionConfig per board (the review and the game), each closed.
    const board = read("src/features/board/Board.tsx");
    expect(board.match(/<MotionConfig reducedMotion="user">/g) ?? []).toHaveLength(2);
    expect(board.match(/<\/MotionConfig>/g) ?? []).toHaveLength(2);
    const reviewAt = board.indexOf("<ReviewBoard");
    const opens = [...board.matchAll(/<MotionConfig reducedMotion="user">/g)].map((m) => m.index!);
    const closes = [...board.matchAll(/<\/MotionConfig>/g)].map((m) => m.index!);
    const wrapped = (at: number) => opens.some((o, i) => o < at && at < closes[i]);
    expect(reviewAt, "Board.tsx renders ReviewBoard").toBeGreaterThan(0);
    expect(wrapped(reviewAt), "the review board is wrapped").toBe(true);
    // The game board's squares are drawn somewhere under the second wrapper.
    expect(opens[1] > closes[0] && closes[1] > opens[1], "the two wrappers don't nest").toBe(true);
    expect(board.slice(opens[1], closes[1])).toMatch(/className="squares"/);
  });
});
