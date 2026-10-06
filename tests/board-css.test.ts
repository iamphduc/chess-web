import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname, "..", "src", "features", "board", "components");
const files = ["Square.css", "Overlay.css", "Piece.css"];
const read = (name: string) => readFileSync(join(dir, name), "utf8");

describe("board CSS", () => {
  it("board styles use only board tokens", () => {
    for (const name of files) {
      const source = read(name).replace(/\/\*[\s\S]*?\*\//g, "");
      expect(source, `${name} has no hex color`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source, `${name} has no rgb()/rgba()`).not.toMatch(/rgba?\(/);
      expect(source, `${name} has no drop-shadow`).not.toMatch(/drop-shadow/);
    }
    const all = files.map(read).join("\n");
    for (const token of [
      "--board-highlight",
      "--board-hint",
      "--board-check",
      "--board-drop-edge",
      "--board-light",
      "--board-dark",
    ]) {
      expect(all, `uses var(${token})`).toContain(`var(${token})`);
    }
  });
});
