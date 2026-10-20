import { describe, expect, it } from "vitest";

import { readCss } from "./look-helpers";

// Out of his book the note leaves an empty slot (BookNote.tsx) so the stacked page never shrinks
// and scrolls. From 992 px the sidebar sits beside the board, the board column sets the page
// height, and the slot goes: the Moves card moves up as before.

const css = () => readCss("features", "liem", "components", "BookNote.css");

/** The body of the `@media` block whose query matches `when`. */
function media(source: string, when: RegExp): string {
  for (const m of source.matchAll(/@media([^{]*)\{/g)) {
    if (!when.test(m[1])) continue;
    let depth = 1;
    let i = m.index! + m[0].length;
    const start = i;
    while (depth > 0 && i < source.length) {
      if (source[i] === "{") depth++;
      if (source[i] === "}") depth--;
      i++;
    }
    return source.slice(start, i - 1);
  }
  return "";
}

describe("the book note's empty slot", () => {
  it("is empty space while the page stacks, and gone beside the board", () => {
    const top = css().replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
    // No card look on the slot: no border, background or padding.
    const slot = top.match(/\.liem-note-slot\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(slot).not.toMatch(/border|background|padding/);
    const wide = media(css(), /min-width:\s*992px/);
    expect(wide).toMatch(/\.liem-note-slot\s*\{[^}]*display:\s*none/);
  });
});
