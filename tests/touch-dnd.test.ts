import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const pkg = () => JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const major = (range: string | undefined) => Number(/(\d+)/.exec(range ?? "")?.[1]);

// The runtime dependencies before this sprint, plus the two touch-drag packages.
const EXPECTED_DEPENDENCIES = [
  "@reduxjs/toolkit",
  "@testing-library/react",
  "@testing-library/user-event",
  "@types/node",
  "@types/react",
  "@types/react-dom",
  "framer-motion",
  "rdndmb-html5-to-touch",
  "react",
  "react-dnd",
  "react-dnd-html5-backend",
  "react-dnd-multi-backend",
  "react-dom",
  "react-redux",
  "typescript",
  "uuid",
  "web-vitals",
];
const EXPECTED_DEV_DEPENDENCIES = ["@types/uuid", "@vitejs/plugin-react", "vite", "vitest", "yaml"];

/** Resolves `request` as seen from inside the installed package `from` (or the app root), or null. */
function resolveFrom(from: string | null, request: string): string | null {
  const base = from ? join(ROOT, "node_modules", from, "package.json") : join(ROOT, "package.json");
  // A missing package would resolve from the root node_modules instead, so it counts as a miss.
  if (!existsSync(base)) return null;
  try {
    return realpathSync(createRequire(base).resolve(request));
  } catch {
    return null;
  }
}

describe("touch drag dependencies", () => {
  it("touch drag deps match the plan", () => {
    const p = pkg();
    expect(major(p.dependencies["react-dnd-multi-backend"])).toBe(9);
    expect(major(p.dependencies["rdndmb-html5-to-touch"])).toBe(9);
    expect(major(p.dependencies["react-dnd"])).toBe(16);
    expect(major(p.dependencies["react-dnd-html5-backend"])).toBe(16);
    expect(Object.keys(p.dependencies).sort()).toEqual(EXPECTED_DEPENDENCIES);
    expect(Object.keys(p.devDependencies).sort()).toEqual(EXPECTED_DEV_DEPENDENCIES);
  });

  it("one react-dnd copy", () => {
    const reactDnd = [null, "react-dnd-multi-backend", "react-dnd-preview"].map((from) =>
      resolveFrom(from, "react-dnd")
    );
    expect(reactDnd[0]).not.toBeNull();
    expect(new Set(reactDnd)).toEqual(new Set([reactDnd[0]]));

    const dndCore = [null, "react-dnd", "react-dnd-multi-backend", "dnd-multi-backend", "react-dnd-html5-backend"].map(
      (from) => resolveFrom(from, "dnd-core")
    );
    expect(dndCore[0]).not.toBeNull();
    expect(new Set(dndCore)).toEqual(new Set([dndCore[0]]));
  });
});
