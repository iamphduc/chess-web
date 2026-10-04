import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfigFromFile } from "vite";

const ROOT = join(__dirname, "..");
const CONFIG = join(ROOT, "vite.config.ts");
const ORIGINAL_PORT = process.env.PORT;

async function load(port: string | undefined) {
  if (port === undefined) delete process.env.PORT;
  else process.env.PORT = port;
  expect(existsSync(CONFIG), "vite.config.ts exists").toBe(true);
  const loaded = await loadConfigFromFile({ command: "serve", mode: "development" }, CONFIG, ROOT);
  expect(loaded).not.toBeNull();
  return loaded!.config;
}

afterEach(() => {
  if (ORIGINAL_PORT === undefined) delete process.env.PORT;
  else process.env.PORT = ORIGINAL_PORT;
});

describe("vite.config.ts", () => {
  it("serves under /chess-web/ on 127.0.0.1", async () => {
    const config = await load(undefined);
    expect(config.base).toBe("/chess-web/");
    expect(config.server?.host).toBe("127.0.0.1");
    expect(config.preview?.host).toBe("127.0.0.1");
  });

  it("uses default ports when PORT is unset", async () => {
    const config = await load(undefined);
    expect(config.server?.port).toBe(5173);
    expect(config.preview?.port).toBe(4173);
  });

  it("uses PORT when it is a valid port", async () => {
    for (const [env, port] of [["6123", 6123], ["1", 1], ["65535", 65535]] as const) {
      const config = await load(env);
      expect(config.server?.port, env).toBe(port);
      expect(config.preview?.port, env).toBe(port);
    }
    // read fresh on every load, not kept from an earlier one
    const again = await load(undefined);
    expect(again.server?.port).toBe(5173);
  });

  it("ignores an invalid PORT", async () => {
    for (const env of ["", "abc", "0", "70000", "65536", "-1", "12.5", "6123abc", " "]) {
      const config = await load(env);
      expect(config.server?.port, JSON.stringify(env)).toBe(5173);
      expect(config.preview?.port, JSON.stringify(env)).toBe(4173);
    }
  });
});
