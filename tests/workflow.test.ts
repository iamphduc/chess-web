import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const ROOT = join(__dirname, "..");
const WORKFLOWS = join(ROOT, ".github", "workflows");
const FILE = join(WORKFLOWS, "pod-ci.yml");
const PUSH_TO_MAIN = /github\.event_name\s*==\s*'push'[\s\S]*github\.ref\s*==\s*'refs\/heads\/main'|github\.ref\s*==\s*'refs\/heads\/main'[\s\S]*github\.event_name\s*==\s*'push'/;

type Step = { uses?: string; run?: string; with?: Record<string, unknown>; env?: Record<string, unknown>; if?: string; id?: string };
type Job = {
  "runs-on"?: string;
  needs?: string[];
  if?: string;
  permissions?: Record<string, string>;
  environment?: { name?: string; url?: string };
  concurrency?: { group?: string; "cancel-in-progress"?: boolean };
  steps?: Step[];
};
type Workflow = { on: Record<string, unknown>; permissions: Record<string, string>; jobs: Record<string, Job> };

// A missing file reads as empty, so every check fails on its own assertion.
const raw = () => (existsSync(FILE) ? readFileSync(FILE, "utf8") : "");
const wf = (): Workflow => parse(raw()) ?? { on: {}, permissions: {}, jobs: {} };
const job = (name: string): Job => wf().jobs[name] ?? {};
const steps = (name: string) => job(name).steps ?? [];
const usesStep = (job: string, action: string) => steps(job).find((s) => s.uses?.split("@")[0] === action);
const allSteps = () => Object.values(wf().jobs).flatMap((j) => j.steps ?? []);

// The one command the smoke recipe says proves a change: "**Verification:** `<cmd>`".
const verificationCommand = () => {
  const m = /\*\*Verification:\*\*\s*`([^`]+)`/.exec(readFileSync(join(ROOT, "docs", "codebase-structure.md"), "utf8"));
  if (!m) throw new Error("no Verification: command in docs/codebase-structure.md");
  return m[1];
};

describe("pod-ci workflow", () => {
  it("one workflow file", () => {
    expect(existsSync(WORKFLOWS)).toBe(true);
    expect(readdirSync(WORKFLOWS)).toEqual(["pod-ci.yml"]);
  });

  it("runs on every pull request and on push to main only", () => {
    const on = wf().on;
    expect(Object.keys(on).sort()).toEqual(["pull_request", "push"]);
    const pr = (on.pull_request ?? {}) as Record<string, unknown>;
    expect(pr.branches).toBeUndefined();
    expect(pr["branches-ignore"]).toBeUndefined();
    expect(pr.paths).toBeUndefined();
    expect(pr["paths-ignore"]).toBeUndefined();
    expect(on.push).toEqual({ branches: ["main"] });
  });

  it("only the deploy job can write", () => {
    const w = wf();
    expect(w.permissions).toEqual({ contents: "read" });
    expect(Object.keys(w.jobs).sort()).toEqual(["deploy", "secrets", "verify"]);
    for (const [name, jb] of Object.entries(w.jobs)) {
      if (name === "deploy") continue;
      for (const [scope, level] of Object.entries(jb.permissions ?? {})) {
        expect(level, `${name}.${scope}`).not.toBe("write");
      }
    }
  });

  it("verify runs the documented verification on node 24", () => {
    const j = job("verify");
    expect(j["runs-on"]).toBe("ubuntu-latest");
    expect(usesStep("verify", "actions/checkout")).toBeDefined();
    const node = usesStep("verify", "actions/setup-node");
    expect(node?.with).toMatchObject({ "node-version": 24, cache: "npm" });
    const runs = steps("verify").map((s) => s.run?.trim());
    const ci = runs.indexOf("npm ci");
    const verification = runs.indexOf(verificationCommand());
    expect(ci).toBeGreaterThanOrEqual(0);
    expect(verification).toBeGreaterThan(ci);
  });

  it("pages artifact is uploaded only on push to main", () => {
    const configure = usesStep("verify", "actions/configure-pages");
    const upload = usesStep("verify", "actions/upload-pages-artifact");
    expect(configure?.if ?? "").toMatch(PUSH_TO_MAIN);
    expect(upload?.if ?? "").toMatch(PUSH_TO_MAIN);
    expect(upload?.with).toEqual({ path: "dist" });
    // both come after the verification step, so a red build uploads nothing
    const s = steps("verify");
    const verification = s.findIndex((x) => x.run?.trim() === verificationCommand());
    expect(s.indexOf(configure!)).toBeGreaterThan(verification);
    expect(s.indexOf(upload!)).toBeGreaterThan(verification);
  });

  it("secrets job scans the full history with gitleaks", () => {
    const j = job("secrets");
    expect(j["runs-on"]).toBe("ubuntu-latest");
    expect(usesStep("secrets", "actions/checkout")?.with).toMatchObject({ "fetch-depth": 0 });
    const gitleaks = steps("secrets").find((s) => s.uses === "gitleaks/gitleaks-action@v2");
    expect(gitleaks).toBeDefined();
    expect(gitleaks?.env).toEqual({ GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}" });
  });

  it("deploy runs only after checks pass on push to main", () => {
    const j = job("deploy");
    expect([...(j.needs ?? [])].sort()).toEqual(["secrets", "verify"]);
    expect(j.if ?? "").toMatch(PUSH_TO_MAIN);
    expect(j.if ?? "").not.toMatch(/always\(\)|failure\(\)|cancelled\(\)|\|\|/);
    expect(j.permissions).toEqual({ pages: "write", "id-token": "write" });
    expect(j.environment).toEqual({ name: "github-pages", url: "${{ steps.deployment.outputs.page_url }}" });
    expect(j.concurrency).toEqual({ group: "pages", "cancel-in-progress": false });
    expect(j.steps).toHaveLength(1);
  });

  it("only the deploy job deploys", () => {
    for (const [name, jb] of Object.entries(wf().jobs)) {
      const deploys = (jb.steps ?? []).filter((s) => s.uses?.startsWith("actions/deploy-pages@"));
      if (name === "deploy") {
        expect(deploys).toHaveLength(1);
        expect(deploys[0].id).toBe("deployment");
      } else {
        expect(deploys, name).toHaveLength(0);
      }
    }
  });

  it("actions are pinned to major tags", () => {
    const uses = allSteps().flatMap((s) => (s.uses ? [s.uses] : []));
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).toMatch(/^[\w.-]+\/[\w.-]+@v\d+$/);
  });

  it("no old deploy path and no extra secrets", () => {
    for (const s of allSteps()) {
      const text = JSON.stringify(s);
      expect(text).not.toContain("gh-pages");
      expect(text).not.toMatch(/npm run deploy/);
    }
    const secrets = [...raw().matchAll(/secrets\.([A-Za-z_][\w]*)/g)].map((m) => m[1]);
    expect(new Set(secrets)).toEqual(new Set(["GITHUB_TOKEN"]));
  });
});
