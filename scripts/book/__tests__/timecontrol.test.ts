import { describe, it, expect } from "vitest";
import { clockClass, clockEstimate, SLOW_SECONDS } from "../timecontrol";

describe("clock estimate and class edges", () => {
  it("estimates base + 40 x increment in seconds", () => {
    expect(clockEstimate("900")).toBe(900);
    expect(clockEstimate("899")).toBe(899);
    expect(clockEstimate("600+8")).toBe(920);
    expect(clockEstimate("180+2")).toBe(260);
    expect(clockEstimate("0+1")).toBe(40);
    expect(clockEstimate(" 300+0 ")).toBe(300);
  });

  it("uses the first period's base for multi-period controls", () => {
    expect(clockEstimate("40/7200:3600")).toBe(7200);
    expect(clockEstimate("40/5400+30:1800+30")).toBe(5400 + 40 * 30);
  });

  it("splits slow and online at exactly 900 s", () => {
    expect(SLOW_SECONDS).toBe(900);
    expect(clockClass("900")).toBe("slow");
    expect(clockClass("899")).toBe("online");
    expect(clockClass("600+8")).toBe("slow");
    expect(clockClass("180+2")).toBe("online");
    expect(clockClass("40/7200:3600")).toBe("slow");
    expect(clockClass("0")).toBe("online");
  });

  it('"-", "?", missing, empty and garbage are unknown', () => {
    for (const tc of ["-", "?", undefined, "", "abc", "10+", "+5", "5+x", "1.5+0", "-300", "40/:3600"]) {
      expect(clockEstimate(tc), String(tc)).toBeNull();
      expect(clockClass(tc), String(tc)).toBe("unknown");
    }
  });

  it('"1/86400" and other one-move periods are daily', () => {
    expect(clockClass("1/86400")).toBe("daily");
    expect(clockClass("1/259200")).toBe("daily");
    expect(clockEstimate("1/86400")).toBeNull();
  });
});
