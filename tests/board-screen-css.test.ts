import { describe, expect, it } from "vitest";

import { declarations, last, lookViolations, readCss, rules } from "./look-helpers";

// The board screen's own stylesheets (plan ui-refresh, slice B1).
const FILES = [
  ["App.css"],
  ["features", "board", "components", "TopBar.css"],
  ["features", "board", "components", "Notation.css"],
  ["features", "board", "components", "BoardSidebar.css"],
] as const;

const css = (parts: readonly string[]) => readCss(...parts);

/** Each `@media` block's query and body (one level of nesting), plus the top-level text. */
function mediaBlocks(source: string): { query: string; body: string }[] {
  const out: { query: string; body: string }[] = [];
  let i = 0;
  let top = "";
  while (i < source.length) {
    const at = source.indexOf("@media", i);
    if (at === -1) {
      top += source.slice(i);
      break;
    }
    top += source.slice(i, at);
    const open = source.indexOf("{", at);
    let depth = 1;
    let j = open + 1;
    while (depth > 0 && j < source.length) {
      if (source[j] === "{") depth++;
      if (source[j] === "}") depth--;
      j++;
    }
    out.push({ query: source.slice(at, open).trim(), body: source.slice(open + 1, j - 1) });
    i = j;
  }
  return [{ query: "", body: top }, ...out];
}

/** Declarations for `selector` (alone or in a comma list) in one block of CSS. */
function declsIn(body: string, selector: string): [string, string][] {
  return declarations(
    rules(body)
      .filter((r) => r.selector.split(",").map((s) => s.trim()).includes(selector))
      .map((r) => r.body)
      .join(";")
  );
}

/** A spacing value: 0, auto, or built only from the --space-N tokens. */
const SPACING = /^(?:0|auto|var\(--space-[1-6]\)|calc\(-1 \* var\(--space-[1-6]\)\))(?:\s+(?:0|auto|var\(--space-[1-6]\)|calc\(-1 \* var\(--space-[1-6]\)\)))*$/;
const SPACING_PROPS = /^(?:margin|padding|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?$/;

const OLD_TOKENS = /var\(--(?:dark-|liem-|book-bar|review-page|board-sound-on|background\)|text\))/;

describe("board screen css", () => {
  it("board screen follows the Look", () => {
    for (const file of FILES) {
      const source = css(file);
      const name = file.join("/");
      expect({ name, violations: lookViolations(source) }).toEqual({ name, violations: [] });
      expect({ name, oldTokens: OLD_TOKENS.test(source) }).toEqual({ name, oldTokens: false });

      // One spacing scale: 4, 8, 12, 16, 24 and 32 px, through the tokens.
      // The review's own rules (room for its phone sheet) move to the Look in slice V1.
      const off = rules(source)
        .filter(({ selector }) => !selector.includes("review"))
        .flatMap(({ selector, body }) =>
        declarations(body)
          .filter(([prop, value]) => SPACING_PROPS.test(prop) && !SPACING.test(value))
          .map(([prop, value]) => `${selector} { ${prop}: ${value} }`)
      );
      expect({ name, off }).toEqual({ name, off: [] });
    }

    // The top bar is 56 px.
    const topBar = css(FILES[1]);
    expect(last(declsIn(mediaBlocks(topBar)[0].body, ".top-bar"), "height")).toBe("56px");

    // From 992 px up the sidebar is 380 px wide, beside the board with a 24 px gap.
    const app = mediaBlocks(css(FILES[0]));
    const wide = app.filter((b) => /min-width:\s*992px/.test(b.query));
    expect(wide.length).toBeGreaterThan(0);
    const sidebar = wide.flatMap((b) => declsIn(b.body, ".sidebar"));
    expect(last(sidebar, "width")).toBe("380px");
    const screen = wide.flatMap((b) => declsIn(b.body, ".board-screen"));
    expect(last(screen, "flex-direction")).toBe("row");
    expect(last(screen, "gap") ?? last(declsIn(app[0].body, ".board-screen"), "gap")).toBe("var(--space-5)");

    // Below 992 px they stack: board, then sidebar.
    expect(last(declsIn(app[0].body, ".board-screen"), "flex-direction")).toBe("column");

    // No rule for the old wrappers in these files.
    for (const file of FILES) {
      const selectors = rules(css(file)).map((r) => r.selector).join(",");
      expect(selectors).not.toMatch(/\.(buttons|liem-side|squares__overlay|board-sidebar__title)\b/);
    }
  });
});
