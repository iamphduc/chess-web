import { posix } from "node:path";

/**
 * The runtime import graph of the `src` tree: each file (a `src/...` posix path)
 * to the `src` files it loads. Pure: callers read the files.
 */
export type Graph = Map<string, string[]>;

/** The tsconfig `paths` prefixes; each maps `x/...` to `src/x/...`. */
const ALIASES = ["app/", "assets/", "features/", "game/", "hooks/"];

/**
 * `import … from "x"` and `export … from "x"`, at the start of a line (so doc
 * comments, which start with `*` or `//`, never match). The clause is a default
 * name, `{ … }` (may span lines), `* as name` or `*`, optionally after a default.
 */
const FROM_STATEMENT =
  /^[ \t]*(import|export)[ \t]+(type[ \t]+)?((?:[\w$]+[ \t]*,[ \t]*)?(?:\{[^}]*\}|\*(?:[ \t]+as[ \t]+[\w$]+)?|[\w$]+))[ \t]*from[ \t]*["']([^"']+)["']/gm;

/** `import "x"`: a side-effect import. `import("x")` has a `(` and never matches. */
const SIDE_EFFECT = /^[ \t]*import[ \t]*["']([^"']+)["']/gm;

/**
 * True when TypeScript erases the whole statement. `import type` / `export type`
 * always go. A brace list whose every specifier is marked `type` goes too:
 * `tsconfig.json` sets `isolatedModules` without `verbatimModuleSyntax`, so
 * `import { type A, type B } from "x"` leaves no `import` behind. A default
 * name, or any specifier without `type`, keeps the statement.
 */
function typeOnly(typeKeyword: string | undefined, clause: string): boolean {
  if (typeKeyword) return true;
  const braces = /^\{([^}]*)\}$/.exec(clause.trim());
  if (!braces) return false;
  const names = braces[1]
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
  return names.length > 0 && names.every((name) => /^type\s/.test(name));
}

/** The specifiers of every static import and re-export that survives compilation, in source order. */
export function importSpecifiers(source: string): string[] {
  const found: { at: number; spec: string }[] = [];
  for (const m of source.matchAll(FROM_STATEMENT)) {
    if (!typeOnly(m[2], m[3])) found.push({ at: m.index ?? 0, spec: m[4] });
  }
  for (const m of source.matchAll(SIDE_EFFECT)) {
    found.push({ at: m.index ?? 0, spec: m[1] });
  }
  return found.sort((a, b) => a.at - b.at).map(({ spec }) => spec);
}

/**
 * The `src` file `spec` loads from `from`, or `null` for an npm package, a
 * non-TS file or anything else outside `files`. Tries `x.ts`, `x.tsx`,
 * `x/index.ts` and `x/index.tsx`.
 */
export function resolveSpecifier(
  from: string,
  spec: string,
  files: ReadonlySet<string>
): string | null {
  let base: string;
  if (spec === "." || spec === ".." || spec.startsWith("./") || spec.startsWith("../")) {
    base = posix.join(posix.dirname(from), spec);
  } else if (ALIASES.some((prefix) => spec.startsWith(prefix))) {
    base = posix.join("src", spec);
  } else {
    return null;
  }
  const candidates = [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find((file) => files.has(file)) ?? null;
}

/** The graph of `sources` (path to text), keeping only edges to files in `sources`. */
export function buildGraph(sources: ReadonlyMap<string, string>): Graph {
  const files = new Set(sources.keys());
  const graph: Graph = new Map();
  for (const [file, text] of sources) {
    const targets = importSpecifiers(text)
      .map((spec) => resolveSpecifier(file, spec, files))
      .filter((target): target is string => target !== null);
    graph.set(file, [...new Set(targets)]);
  }
  return graph;
}

/**
 * Loops in `graph`, each as a path that starts and ends on the same file
 * (`[a, b, a]`). A depth-first walk in sorted order reports one loop per back
 * edge, so every strongly connected part with a loop shows up at least once.
 */
export function findCycles(graph: Graph): string[][] {
  const done = new Set<string>();
  const onPath = new Map<string, number>();
  const path: string[] = [];
  const cycles: string[][] = [];

  const visit = (file: string) => {
    onPath.set(file, path.length);
    path.push(file);
    for (const next of [...(graph.get(file) ?? [])].sort()) {
      const at = onPath.get(next);
      if (at !== undefined) cycles.push([...path.slice(at), next]);
      else if (!done.has(next)) visit(next);
    }
    path.pop();
    onPath.delete(file);
    done.add(file);
  };

  for (const file of [...graph.keys()].sort()) {
    if (!done.has(file)) visit(file);
  }
  return cycles;
}

/** `src/a.ts → src/b.ts → src/a.ts`. */
export function formatCycle(cycle: readonly string[]): string {
  return cycle.join(" → ");
}
