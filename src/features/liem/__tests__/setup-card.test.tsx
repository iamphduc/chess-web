import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { createAppStore } from "app/store";
import { LIEM } from "game/opponent/players";
import { ModeTabs } from "../components/ModeTabs";
import { federationName, radioKeyIndex, SetupCard } from "../components/SetupCard";
import { switchMode } from "../liemActions";
import { setColorPick, setStrength } from "../matchSlice";

type Store = ReturnType<typeof createAppStore>;

function render(store: Store, node: React.ReactElement): string {
  return renderToStaticMarkup(<Provider store={store}>{node}</Provider>);
}

function liemStore(): Store {
  const store = createAppStore();
  store.dispatch(switchMode("liem"));
  return store;
}

/** Every opening tag that has `role="<role>"`. */
function tagsWithRole(html: string, role: string): string[] {
  return html.match(new RegExp(`<[a-z]+[^>]*role="${role}"[^>]*>`, "g")) ?? [];
}

/** The text inside each element with `role="<role>"` (tags stripped). */
function textsWithRole(html: string, role: string): string[] {
  const re = new RegExp(`<button[^>]*role="${role}"[^>]*>(.*?)</button>`, "g");
  return Array.from(html.matchAll(re), (m) => m[1].replace(/<[^>]+>/g, ""));
}

/** The strength value's text, tags stripped and spaces squeezed. */
function valueText(html: string): string {
  const m = html.match(/<span class="setup-card__value">(.*?)<\/span><\/div>/);
  expect(m, "the strength value").not.toBeNull();
  return m![1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

describe("mode tabs", () => {
  it("renders a tablist with vs Liem and Two players", () => {
    const html = render(createAppStore(), <ModeTabs />);
    expect(tagsWithRole(html, "tablist")).toHaveLength(1);
    expect(textsWithRole(html, "tab")).toEqual(["vs Liem", "Two players"]);
    for (const tab of tagsWithRole(html, "tab")) expect(tab).toContain('class="liem-tab"');
  });

  it("aria-selected follows match.mode", () => {
    // The page opens on vs Liem.
    const load = tagsWithRole(render(createAppStore(), <ModeTabs />), "tab");
    expect(load[0]).toContain('aria-selected="true"');
    expect(load[1]).toContain('aria-selected="false"');

    const store = createAppStore();
    store.dispatch(switchMode("two-player"));
    const two = tagsWithRole(render(store, <ModeTabs />), "tab");
    expect(two[0]).toContain('aria-selected="false"');
    expect(two[1]).toContain('aria-selected="true"');
  });

  it("only the selected tab is in the tab order", () => {
    const tabs = tagsWithRole(render(liemStore(), <ModeTabs />), "tab");
    expect(tabs[0]).toContain('tabindex="0"');
    expect(tabs[1]).toContain('tabindex="-1"');
  });
});

describe("setup card markup", () => {
  it("renders the dialog label, star, title and his line", () => {
    const html = render(liemStore(), <SetupCard />);
    const dialog = tagsWithRole(html, "dialog");
    expect(dialog).toHaveLength(1);
    expect(dialog[0]).toContain('aria-label="Challenge Le Quang Liem"');
    expect(dialog[0]).toContain("liem-card");
    expect(html).toMatch(/class="liem-star"[^>]*>★</);
    expect(html).toContain("Challenge Le Quang Liem");
    expect(html).toMatch(/class="liem-card__sub"[^>]*>GM · Vietnam · 2732</);
  });

  it("renders three tiles with aria-checked on the pick", () => {
    const store = liemStore();
    store.dispatch(setColorPick("black"));
    const html = render(store, <SetupCard />);
    expect(textsWithRole(html, "radio").slice(0, 3)).toEqual(["♔White", "♚Black", "?Random"]);
    const tiles = tagsWithRole(html, "radio").filter((t) => t.includes("liem-tile"));
    expect(tiles).toHaveLength(3);
    expect(tiles.map((t) => t.includes('aria-checked="true"'))).toEqual([false, true, false]);
    expect(tiles.map((t) => t.includes('tabindex="0"'))).toEqual([false, true, false]);
  });

  it("renders 7 steps, the chosen checked and lit up to it, and Elo 2100", () => {
    const html = render(liemStore(), <SetupCard />);
    const steps = tagsWithRole(html, "radio").filter((t) => t.includes("liem-step"));
    expect(steps).toHaveLength(7);
    expect(steps.map((t) => t.includes('aria-checked="true"'))).toEqual([false, false, false, true, false, false, false]);
    expect(steps.map((t) => t.includes("liem-step--lit"))).toEqual([true, true, true, true, false, false, false]);
    expect(html).toMatch(/class="liem-elo"[^>]*>2100</);
    expect(html).not.toMatch(/>Full</);
  });

  it("the Liem step lights every step and shows ★ Liem in gold", () => {
    const store = liemStore();
    store.dispatch(setStrength("full"));
    const html = render(store, <SetupCard />);
    const steps = tagsWithRole(html, "radio").filter((t) => t.includes("liem-step"));
    expect(steps.every((t) => t.includes("liem-step--lit"))).toBe(true);
    expect(steps[6]).toContain('aria-checked="true"');
    expect(html).toMatch(/class="liem-elo"[^>]*>★ Liem</);
    expect(html).not.toMatch(/>Full</);
    expect(html).not.toMatch(/class="liem-elo"[^>]*>2732</);
  });

  it("each step has an accessible name", () => {
    const html = render(liemStore(), <SetupCard />);
    const steps = tagsWithRole(html, "radio").filter((t) => t.includes("liem-step"));
    expect(steps.map((t) => t.match(/aria-label="([^"]+)"/)?.[1])).toEqual([
      "1400",
      "1700",
      "1900",
      "2100",
      "2300",
      "2500",
      "Liem (2732)",
    ]);
  });

  it("shows about before the Elo", () => {
    const store = liemStore();
    expect(valueText(render(store, <SetupCard />))).toBe("about 2100");
    store.dispatch(setStrength(1400));
    expect(valueText(render(store, <SetupCard />))).toBe("about 1400");
    store.dispatch(setStrength("full"));
    expect(valueText(render(store, <SetupCard />))).toBe("★ Liem");
  });

  it("shows the engine line under the steps, above Start game", () => {
    const LINE = "A sparring bot plays his openings, then Stockfish at about 2100.";
    const html = render(liemStore(), <SetupCard />);
    const line = html.match(/<p class="([^"]*)">([^<]*)<\/p>/g)?.find((p) => p.includes("Stockfish"));
    expect(line).toBeDefined();
    expect(line).toMatch(new RegExp(`^<p class="[^"]*\\bliem-card__sub\\b[^"]*">${LINE}</p>$`));
    const steps = html.indexOf('aria-label="Liem (2732)"');
    const at = html.indexOf(LINE);
    const start = html.indexOf(">Start game</button>");
    expect(steps).toBeGreaterThan(-1);
    expect(at).toBeGreaterThan(steps);
    expect(start).toBeGreaterThan(at);
  });

  it("setup card per level", () => {
    const store = liemStore();
    const engineLine = (html: string) => html.match(/class="[^"]*setup-card__engine[^"]*">([^<]*)</)?.[1];
    const stepLabels = (html: string) =>
      tagsWithRole(html, "radio")
        .filter((t) => t.includes("liem-step"))
        .map((t) => t.match(/aria-label="([^"]+)"/)?.[1]);

    for (const n of [1400, 1700, 1900, 2100, 2300, 2500] as const) {
      store.dispatch(setStrength(n));
      const html = render(store, <SetupCard />);
      expect(valueText(html)).toBe(`about ${n}`);
      expect(engineLine(html)).toBe(`A sparring bot plays his openings, then Stockfish at about ${n}.`);
      expect(html).not.toContain("★ Liem");
      // The dialog stays his challenge at every level.
      expect(tagsWithRole(html, "dialog")[0]).toContain('aria-label="Challenge Le Quang Liem"');
    }

    store.dispatch(setStrength("full"));
    const html = render(store, <SetupCard />);
    expect(valueText(html)).toBe("★ Liem");
    expect(html).not.toMatch(/class="setup-card__about"/);
    expect(stepLabels(html)[6]).toBe("Liem (2732)");
    expect(engineLine(html)).toBe("Le Quang Liem: his openings, then full-strength Stockfish 18.");
    expect(tagsWithRole(html, "dialog")[0]).toContain('aria-label="Challenge Le Quang Liem"');
  });

  it("renders the green Start game button", () => {
    const html = render(liemStore(), <SetupCard />);
    expect(html).toMatch(/<button[^>]*class="button button--play"[^>]*>Start game<\/button>/);
  });

  it("an unknown federation shows its code", () => {
    const entry = { ...LIEM.entry, federation: "XYZ" };
    const html = render(liemStore(), <SetupCard entry={entry} />);
    expect(html).toMatch(/class="liem-card__sub"[^>]*>GM · XYZ · 2732</);
    expect(federationName("XYZ")).toBe("XYZ");
    expect(federationName("VIE")).toBe("Vietnam");
  });

  it("arrow keys move through a radio group and wrap", () => {
    expect(radioKeyIndex(0, "ArrowRight", 3)).toBe(1);
    expect(radioKeyIndex(0, "ArrowDown", 3)).toBe(1);
    expect(radioKeyIndex(2, "ArrowRight", 3)).toBe(0);
    expect(radioKeyIndex(0, "ArrowLeft", 3)).toBe(2);
    expect(radioKeyIndex(1, "ArrowUp", 3)).toBe(0);
    expect(radioKeyIndex(4, "Home", 7)).toBe(0);
    expect(radioKeyIndex(1, "End", 7)).toBe(6);
    expect(radioKeyIndex(1, "Enter", 7)).toBeNull();
  });
});
