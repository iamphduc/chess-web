import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { describe, expect, it } from "vitest";

import { toggleSound, viewSlice } from "../viewSlice";
import { Board } from "../Board";
import { createAppStore } from "../../../app/store";

const makeStore = createAppStore;

function buttonsRow(store: ReturnType<typeof makeStore>): string {
  const html = renderToStaticMarkup(
    <Provider store={store}>
      <DndProvider backend={HTML5Backend}>
        <Board />
      </DndProvider>
    </Provider>
  );
  const row = html.match(/<div class="buttons">([\s\S]*?)<\/div>/)?.[1];
  if (row === undefined) throw new Error("no .buttons row");
  return row;
}

/** The opening tags of the buttons in the row, in order. */
function buttonTags(row: string): string[] {
  return row.match(/<button[^>]*>/g) ?? [];
}

describe("sound button", () => {
  it("sound button reflects the setting", () => {
    const store = makeStore();
    expect(store.getState().view.soundOn).toBe(true);

    const on = buttonTags(buttonsRow(store));
    const flipAt = on.findIndex((t) => /aria-label="Flip board"/.test(t));
    expect(flipAt).toBeGreaterThanOrEqual(0);
    const sound = on[flipAt + 1];
    expect(sound).toBeDefined();
    expect(sound).toMatch(/aria-label="Sound"/);
    expect(sound).toMatch(/title="Sound"/);
    expect(sound).toMatch(/type="button"/);
    expect(sound).toMatch(/class="button button--icon button--sound-on"/);
    expect(sound).toMatch(/aria-pressed="true"/);

    // The icon is decorative and changes with the setting.
    const onRow = buttonsRow(store);
    const onIcon = onRow.slice(onRow.indexOf('aria-label="Sound"')).match(/<svg[\s\S]*?<\/svg>/)?.[0];
    expect(onIcon).toMatch(/aria-hidden="true"/);
    expect(onIcon).toMatch(/focusable="false"/);
    expect(onIcon).toMatch(/stroke="currentColor"/);

    store.dispatch(toggleSound());
    const offRow = buttonsRow(store);
    const off = buttonTags(offRow)[flipAt + 1];
    expect(off).toMatch(/aria-label="Sound"/);
    expect(off).toMatch(/class="button button--icon"/);
    expect(off).not.toMatch(/button--sound-on/);
    expect(off).toMatch(/aria-pressed="false"/);
    const offIcon = offRow.slice(offRow.indexOf('aria-label="Sound"')).match(/<svg[\s\S]*?<\/svg>/)?.[0];
    expect(offIcon).toMatch(/aria-hidden="true"/);
    expect(offIcon).not.toEqual(onIcon);
  });

  it("sound-on style uses the token", async () => {
    // node:fs through a plain string, since src/ tests only get the vite/client types.
    const fs = await import(/* @vite-ignore */ "node:fs" as string);
    const buttonCss: string = fs.readFileSync(
      new URL("../components/Button.css", import.meta.url),
      "utf8"
    );
    const rule = buttonCss.match(/\.button--sound-on\s*\{([^}]*)\}/)?.[1];
    expect(rule).toBeDefined();
    expect(rule).toMatch(/background(-color)?:\s*var\(--board-sound-on\)\s*;/);
  });
});
