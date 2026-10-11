import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");
const pkg = () => JSON.parse(read("package.json"));
const allDeps = (): Record<string, string> => ({ ...pkg().dependencies, ...pkg().devDependencies });
const major = (range: string | undefined) => Number(/(\d+)/.exec(range ?? "")?.[1]);

describe("vite toolchain", () => {
  it("package.json matches the vite toolchain", () => {
    const p = pkg();
    const deps = allDeps();
    for (const gone of ["react-scripts", "@types/jest", "@testing-library/jest-dom"]) {
      expect(deps[gone], gone).toBeUndefined();
    }
    expect(p.eslintConfig).toBeUndefined();
    expect(p.browserslist).toBeUndefined();
    expect(p.scripts.eject).toBeUndefined();
    expect(p.scripts.start).toBeUndefined();
    expect(p.scripts).toMatchObject({
      dev: "vite",
      build: "tsc --noEmit && vite build",
      preview: "vite preview",
      test: "vitest run",
    });
    expect(p.type).toBe("module");
    expect(p.scripts.deploy).toBeUndefined();
    expect(p.scripts.predeploy).toBeUndefined();
    expect(deps["gh-pages"]).toBeUndefined();
  });

  it("dependency ranges match the plan", () => {
    const deps = allDeps();
    // major 5 only: no ">=", no "*", nothing that lets 6 in
    expect(deps.typescript).toMatch(/^[~^]?5\.\d+\.\d+$/);
    expect(deps["@types/node"]).toMatch(/^\^24(\.|$)/);
    expect(major(deps.vite)).toBe(8);
    expect(major(deps["@vitejs/plugin-react"])).toBe(6);
    expect(major(deps.vitest)).toBe(5);
    // the plan keeps these on their current majors
    expect(major(deps.react)).toBe(18);
    expect(major(deps["@reduxjs/toolkit"])).toBe(1);
    expect(major(deps["react-dnd"])).toBe(16);
    expect(major(deps["framer-motion"])).toBe(7);
  });

  it("stockfish pinned and node engine declared", () => {
    const p = pkg();
    // an exact version: no ^, ~, range or tag
    expect(p.dependencies.stockfish).toMatch(/^\d+\.\d+\.\d+$/);
    expect(p.devDependencies?.stockfish).toBeUndefined();
    expect(p.engines).toEqual({ node: ">=22.12" });
    const lock = JSON.parse(read("package-lock.json"));
    expect(lock.packages["node_modules/stockfish"].version).toBe(p.dependencies.stockfish);
  });

  it("CRA-era files are removed", () => {
    for (const file of ["vitest.config.ts", "public/index.html", "src/react-app-env.d.ts", "gh-pages.js"]) {
      expect(existsSync(join(ROOT, file)), file).toBe(false);
    }
  });

  it("tsconfig uses explicit paths", () => {
    const { compilerOptions: o } = JSON.parse(read("tsconfig.json"));
    expect(o.baseUrl).toBeUndefined();
    expect(o.moduleResolution).toBe("bundler");
    expect(o.types).toEqual(["vite/client"]);
    expect(o.paths).toEqual({
      "app/*": ["./src/app/*"],
      "assets/*": ["./src/assets/*"],
      "features/*": ["./src/features/*"],
      "game/*": ["./src/game/*"],
      "hooks/*": ["./src/hooks/*"],
    });
  });

  it("root index.html is the vite entry", () => {
    expect(existsSync(join(ROOT, "index.html"))).toBe(true);
    const html = read("index.html");
    expect(html).not.toContain("%PUBLIC_URL%");
    expect(html).toMatch(/<script\s+type="module"\s+src="\/src\/index\.tsx"\s*>\s*<\/script>/);
    expect(html).toContain('<div id="root"></div>');
  });

  it("build output is dist", () => {
    const ignored = read(".gitignore").split(/\r?\n/).map((l) => l.trim());
    expect(ignored).toContain("/dist");
  });

  it("dependency tree is clean without legacy peer deps", () => {
    const npmrc = join(ROOT, ".npmrc");
    if (existsSync(npmrc)) {
      expect(readFileSync(npmrc, "utf8")).not.toMatch(/legacy-peer-deps/);
    }
    expect(existsSync(join(ROOT, "node_modules")), "node_modules installed").toBe(true);
    const ls = spawnSync("npm ls --all", { cwd: ROOT, shell: true, encoding: "utf8" });
    expect(ls.stderr).toBe("");
    expect(ls.status).toBe(0);
  }, 60_000);
});
