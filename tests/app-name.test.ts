import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import * as constants from "../src/constants";

// The app is Liem Sparring (PR #103's rename): the tab title and the install name say so.

const ROOT = join(__dirname, "..");
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8");

describe("app name", () => {
  it("the tab title is Liem Sparring", () => {
    expect(read("index.html")).toMatch(/<title>Liem Sparring<\/title>/);
  });

  it("the web manifest names Liem Sparring", () => {
    const manifest = JSON.parse(read("public", "manifest.json"));
    expect(manifest.name).toBe("Liem Sparring");
    expect(manifest.short_name).toBe("Sparring");
  });
});

describe("constants", () => {
  it("keeps no unused start-position table", () => {
    // The board's start position comes from the engine; the old CRA table is gone.
    expect(Object.keys(constants)).not.toContain("initialSquares");
  });
});
