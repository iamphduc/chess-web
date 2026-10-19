import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { App } from "../../../App";
import { createAppStore } from "app/store";
import type { Screen } from "app/route";
import { LIEM } from "game/opponent/players";
import { STRENGTH_STEPS } from "game/opponent/strength";
import { LEVEL_NAMES, levelView } from "features/liem/levelView";
import { setColorPick, setStrength } from "features/liem/matchSlice";
import { Home, playFromHome } from "../Home";

type Store = ReturnType<typeof createAppStore>;

function render(store: Store = createAppStore(), node: React.ReactElement = <Home />): string {
  return renderToStaticMarkup(<Provider store={store}>{node}</Provider>);
}

/** Text with tags stripped and spaces squeezed. */
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** The inner markup of the radiogroup with this `aria-label`. */
function group(html: string, label: string): string {
  const m = html.match(new RegExp(`<div[^>]*role="radiogroup"[^>]*aria-label="${label}"[^>]*>(.*?)</div>`));
  expect(m, `radiogroup ${label}`).not.toBeNull();
  return m![1];
}

/** Each radio's opening tag in a group's markup. */
const radios = (inner: string) => inner.match(/<button[^>]*role="radio"[^>]*>/g) ?? [];

/** The value beside a field label (`data-field="…"`), as text. */
function fieldValue(html: string, field: string): string {
  const m = html.match(new RegExp(`<span class="home__value" data-field="${field}">(.*?)</span></div>`));
  expect(m, `${field} value`).not.toBeNull();
  return text(m![1]);
}

function storeAt(strength: (typeof STRENGTH_STEPS)[number], color?: "white" | "black" | "random"): Store {
  const store = createAppStore();
  store.dispatch(setStrength(strength));
  if (color) store.dispatch(setColorPick(color));
  return store;
}

describe("home", () => {
  it("home content", () => {
    const html = render();
    expect(html).toMatch(/^<main class="home"/);
    expect(html).toMatch(/class="home__mark"[^>]*>♞</);
    expect(html).toMatch(/class="home__name"[^>]*>Sparring</);
    expect(html).toMatch(/<h1 class="home__hero">Practice a grandmaster&#x27;s openings\.<\/h1>/);
    const lead = text(html.match(/<p class="home__lead">(.*?)<\/p>/)![1]);
    expect(lead).toBe(
      "Bots play GM Le Quang Liem's opening lines from his real games, then Stockfish takes over at the level you pick. Every game ends with a review."
        .replace(/'/g, "&#x27;")
    );
    const strip = Array.from(html.matchAll(/<li class="home__step"><b>(.*?)<\/b>(.*?)<\/li>/g)).map((m) => [m[1], m[2]]);
    expect(strip).toEqual([
      ["His openings", "From his real games"],
      ["Then Stockfish", "At your level"],
      ["Review", "Find your better moves"],
    ]);
    expect(html).toMatch(/<button type="button" class="button button--play home__play">Play<\/button>/);
    expect(html).toMatch(/<a class="home__alt" href="#\/two-players">Two players on one board →<\/a>/);
  });

  it("his name and title come from the entry", () => {
    const entry = { ...LIEM.entry, name: "Test Player", title: "IM" };
    const html = render(createAppStore(), <Home entry={entry} />);
    expect(text(html)).toContain("Bots play IM Test Player&#x27;s opening lines");
    expect(html).not.toContain("Le Quang Liem");
  });

  it("no photo or beat him", () => {
    for (const step of STRENGTH_STEPS) {
      const html = render(storeAt(step));
      expect(html).not.toContain("<img");
      expect(html.toLowerCase()).not.toContain("beat");
    }
  });

  it("level picker", () => {
    const html = render(storeAt(1900));
    const steps = radios(group(html, "Level"));
    expect(steps).toHaveLength(7);
    expect(steps.map((s) => s.match(/aria-label="([^"]*)"/)![1])).toEqual(
      STRENGTH_STEPS.map((step) => levelView(step).stepLabel)
    );
    // Hard is the 3rd step: it is checked, and it and the two below it are lit.
    expect(steps.map((s) => s.includes('aria-checked="true"'))).toEqual([false, false, true, false, false, false, false]);
    expect(steps.map((s) => s.includes("home__level--lit"))).toEqual([true, true, true, false, false, false, false]);
    // One tab stop: the checked step.
    expect(steps.map((s) => s.includes('tabindex="0"'))).toEqual([false, false, true, false, false, false, false]);
    // The steps show their names.
    const names = Array.from(group(html, "Level").matchAll(/<span class="home__level-name">(.*?)<\/span><\/button>/g)).map(
      (m) => text(m[1])
    );
    expect(names).toEqual(["Easy", "Medium", "Hard", "Harder", "Expert", "Master", "Liem"]);
    // The ochre ★ is a shape before "Liem", on that step only.
    expect(group(html, "Level")).toMatch(/<span class="home__level-name"><svg class="home__star"[^>]*aria-hidden="true"[^>]*><path[^>]*><\/path><\/svg>Liem<\/span>/);
    expect(group(html, "Level").match(/home__star/g)).toHaveLength(1);

    // A sparring pick: its name beside the label, no rating, no "about", anywhere.
    for (const step of STRENGTH_STEPS.filter((s) => s !== "full")) {
      const sparring = render(storeAt(step));
      expect(fieldValue(sparring, "level")).toBe(LEVEL_NAMES[step]);
      expect(sparring).not.toMatch(/\b(1[4-9]\d\d|2[0-4]\d\d|2500)\b/);
      expect(sparring.toLowerCase()).not.toContain("about");
      expect(sparring).not.toContain("GM · 2732");
      expect(sparring).not.toMatch(/data-field="level"><svg/);
    }

    // At Liem: the star, his name and "GM · 2732".
    const liem = render(storeAt("full"));
    expect(fieldValue(liem, "level")).toBe("Liem GM · 2732");
    expect(liem).toMatch(/data-field="level"><svg class="home__star"/);
    expect(radios(group(liem, "Level")).every((s) => s.includes("home__level--lit"))).toBe(true);
  });

  it("picks are remembered", () => {
    const fresh = render();
    const freshLevels = radios(group(fresh, "Level"));
    expect(freshLevels[STRENGTH_STEPS.indexOf(2100)]).toContain('aria-checked="true"');
    expect(fieldValue(fresh, "level")).toBe("Harder");
    const freshColors = radios(group(fresh, "You play"));
    expect(freshColors.map((s) => s.includes('aria-checked="true"'))).toEqual([true, false, false]);

    const picked = render(storeAt(1900, "black"));
    expect(radios(group(picked, "Level"))[STRENGTH_STEPS.indexOf(1900)]).toContain('aria-checked="true"');
    expect(fieldValue(picked, "level")).toBe("Hard");
    expect(radios(group(picked, "You play")).map((s) => s.includes('aria-checked="true"'))).toEqual([
      false,
      true,
      false,
    ]);

    const random = render(storeAt(2100, "random"));
    expect(radios(group(random, "You play")).map((s) => s.includes('aria-checked="true"'))).toEqual([
      false,
      false,
      true,
    ]);
  });

  it("color tiles read White, Black and Random", () => {
    const tiles = Array.from(group(render(), "You play").matchAll(/<button[^>]*>(.*?)<\/button>/g)).map((m) => text(m[1]));
    expect(tiles).toEqual(["♔ White", "♚ Black", "? Random"]);
  });

  it("engine line names the level", () => {
    for (const step of STRENGTH_STEPS) {
      const html = render(storeAt(step));
      const line = html.match(/<p class="home__engine">(.*?)<\/p>/);
      expect(line, `engine line at ${step}`).not.toBeNull();
      expect(line![1].replace(/&#x27;/g, "'")).toBe(levelView(step).engineLine);
    }
    expect(render(storeAt(1700))).toContain("Stockfish at the Medium level.");
  });

  it("play starts the game, then goes to play", () => {
    const store = storeAt(1700, "black");
    const went: Screen[] = [];
    playFromHome(store.dispatch, (screen) => {
      // The game has started before the hash changes, so the route rules show play.
      expect(store.getState().match.setupOpen).toBe(false);
      went.push(screen);
    });
    expect(went).toEqual(["play"]);
    const { match, board } = store.getState();
    expect(match.strength).toBe(1700);
    expect(board.humanColor).toBe("black");
    expect(store.getState().view.flipped).toBe(true);
  });

  it("the app opens on home", () => {
    // Effects don't run on the server, so the screen is the hook's first value: home.
    const html = render(
      createAppStore(),
      <DndProvider backend={HTML5Backend}>
        <App />
      </DndProvider>
    );
    expect(html).toMatch(/^<main class="home"/);
    expect(html).not.toContain('class="app"');
  });
});
