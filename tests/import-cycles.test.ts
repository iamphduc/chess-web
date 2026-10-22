import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { buildGraph, findCycles, formatCycle, importSpecifiers, resolveSpecifier } from "./import-graph";

const ROOT = join(__dirname, "..");

/** Every `.ts` and `.tsx` file under `src/`, tests included, as `src/...` posix paths. */
function srcFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return srcFiles(full);
    return /\.tsx?$/.test(entry) && !entry.endsWith(".d.ts")
      ? [relative(ROOT, full).split("\\").join("/")]
      : [];
  });
}

const graphOf = (edges: Record<string, string[]>) => new Map(Object.entries(edges));

describe("findCycles", () => {
  it("finds two- and three-file cycles", () => {
    const two = findCycles(graphOf({ "src/a.ts": ["src/b.ts"], "src/b.ts": ["src/a.ts"] }));
    expect(two.map(formatCycle)).toEqual(["src/a.ts → src/b.ts → src/a.ts"]);

    const three = findCycles(
      graphOf({
        "src/a.ts": ["src/b.ts"],
        "src/b.ts": ["src/c.tsx"],
        "src/c.tsx": ["src/a.ts"],
        "src/d.ts": ["src/a.ts"],
      })
    );
    expect(three.map(formatCycle)).toEqual(["src/a.ts → src/b.ts → src/c.tsx → src/a.ts"]);

    const self = findCycles(graphOf({ "src/a.ts": ["src/a.ts"] }));
    expect(self.map(formatCycle)).toEqual(["src/a.ts → src/a.ts"]);

    // Two separate loops are both reported.
    const both = findCycles(
      graphOf({
        "src/a.ts": ["src/b.ts"],
        "src/b.ts": ["src/a.ts"],
        "src/x.ts": ["src/y.ts"],
        "src/y.ts": ["src/z.ts"],
        "src/z.ts": ["src/x.ts"],
      })
    );
    expect(both.map(formatCycle)).toEqual([
      "src/a.ts → src/b.ts → src/a.ts",
      "src/x.ts → src/y.ts → src/z.ts → src/x.ts",
    ]);
  });

  it("returns no cycle for an acyclic graph", () => {
    expect(findCycles(graphOf({}))).toEqual([]);
    // a imports b, b imports nothing back.
    expect(findCycles(graphOf({ "src/a.ts": ["src/b.ts"], "src/b.ts": [] }))).toEqual([]);
    // A diamond: two paths to the same file are not a loop.
    expect(
      findCycles(
        graphOf({
          "src/a.ts": ["src/b.ts", "src/c.ts"],
          "src/b.ts": ["src/d.ts"],
          "src/c.ts": ["src/d.ts"],
          "src/d.ts": [],
        })
      )
    ).toEqual([]);
    // An edge to a file the graph has no entry for.
    expect(findCycles(graphOf({ "src/a.ts": ["src/b.ts"] }))).toEqual([]);
  });
});

describe("importSpecifiers", () => {
  it("skips only type-only imports", () => {
    const source = [
      'import type { A } from "./typeOnly";',
      'import type Def from "./typeDefault";',
      'export type { B } from "./typeReexport";',
      'import { type C, type D } from "./allTypeList";',
      'export { type E } from "./allTypeExport";',
      'import { type F, g } from "./mixed";',
      'import { Move } from "./plainType";',
      'import Def2, { type H } from "./defaultAndType";',
    ].join("\n");
    expect(importSpecifiers(source)).toEqual(["./mixed", "./plainType", "./defaultAndType"]);
  });

  it("reads every static import form", () => {
    const source = [
      'import React from "react";',
      'import "./sideEffect";',
      "import './single-quoted';",
      "import {",
      "  a,",
      "  b,",
      '} from "./multiLine";',
      'import * as ns from "./namespace";',
      'export * from "./starExport";',
      'export * as named from "./starAsExport";',
      'export { c } from "./namedExport";',
      'import def, { d } from "./defaultAndNamed";',
      'import "./Board.css";',
      'import WQueen from "assets/queen-white.svg";',
      'import book from "./book.json";',
      "const lazy = () => import(\"./dynamic\");",
      'const later = await import("./dynamicAwait");',
      "export const x = 1;",
      'export function f() { return "from"; }',
      ' * import { fake } from "./inDocComment";',
      '// import { fake } from "./inLineComment";',
    ].join("\n");
    // npm packages and non-TS targets are read here and dropped at resolve time.
    expect(importSpecifiers(source)).toEqual([
      "react",
      "./sideEffect",
      "./single-quoted",
      "./multiLine",
      "./namespace",
      "./starExport",
      "./starAsExport",
      "./namedExport",
      "./defaultAndNamed",
      "./Board.css",
      "assets/queen-white.svg",
      "./book.json",
    ]);

    const files = new Set(["src/features/board/Board.tsx"]);
    for (const spec of ["react", "./Board.css", "assets/queen-white.svg", "./book.json"]) {
      expect(resolveSpecifier("src/features/board/Board.tsx", spec, files)).toBeNull();
    }
  });
});

describe("resolveSpecifier", () => {
  const files = new Set([
    "src/app/hooks.ts",
    "src/app/store.ts",
    "src/features/board/BoardSlice.ts",
    "src/features/board/index.ts",
    "src/features/board/components/Promotion.tsx",
    "src/features/review/components/index.tsx",
    "src/game/engine/engine.ts",
    "src/game/engine/move.ts",
    "src/hooks/useMediaQuery.ts",
    "src/assets/pieces.ts",
    "src/constants.ts",
  ]);

  it("resolves relative and alias paths", () => {
    const from = "src/features/board/components/Promotion.tsx";
    expect(resolveSpecifier(from, "../BoardSlice", files)).toBe("src/features/board/BoardSlice.ts");
    expect(resolveSpecifier(from, "./Promotion", files)).toBe(from);
    expect(resolveSpecifier(from, "..", files)).toBe("src/features/board/index.ts");
    expect(resolveSpecifier(from, "../../review/components", files)).toBe(
      "src/features/review/components/index.tsx"
    );
    expect(resolveSpecifier(from, "../../../constants", files)).toBe("src/constants.ts");
    expect(resolveSpecifier(from, "app/hooks", files)).toBe("src/app/hooks.ts");
    expect(resolveSpecifier(from, "features/board", files)).toBe("src/features/board/index.ts");
    expect(resolveSpecifier(from, "game/engine/move", files)).toBe("src/game/engine/move.ts");
    expect(resolveSpecifier(from, "hooks/useMediaQuery", files)).toBe("src/hooks/useMediaQuery.ts");
    expect(resolveSpecifier(from, "assets/pieces", files)).toBe("src/assets/pieces.ts");
    const engineFile = "src/game/engine/moves/pawn.ts";
    expect(resolveSpecifier(engineFile, "../move", files)).toBe("src/game/engine/move.ts");
    // Not files under src: a missing file, a non-alias bare name, a look-alike prefix.
    expect(resolveSpecifier(from, "../Missing", files)).toBeNull();
    expect(resolveSpecifier(from, "constants", files)).toBeNull();
    expect(resolveSpecifier(from, "gameplay/x", files)).toBeNull();
  });

  it("builds a graph of resolved edges only", () => {
    const graph = buildGraph(
      new Map([
        ["src/app/store.ts", 'import { b } from "features/board";\nimport x from "react";'],
        ["src/features/board/index.ts", 'export * from "./BoardSlice";\nimport "./Board.css";'],
        ["src/features/board/BoardSlice.ts", 'import type { S } from "app/store";'],
      ])
    );
    expect(graph.get("src/app/store.ts")).toEqual(["src/features/board/index.ts"]);
    expect(graph.get("src/features/board/index.ts")).toEqual(["src/features/board/BoardSlice.ts"]);
    expect(graph.get("src/features/board/BoardSlice.ts")).toEqual([]);
  });
});

describe("src import graph", () => {
  it("src has no import cycle", () => {
    const files = srcFiles(join(ROOT, "src"));
    expect(files.length).toBeGreaterThan(100);
    const graph = buildGraph(
      new Map(files.map((file) => [file, readFileSync(join(ROOT, file), "utf8")]))
    );
    expect(findCycles(graph).map(formatCycle)).toEqual([]);
  });
});
