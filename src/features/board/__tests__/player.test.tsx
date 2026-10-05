import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { store } from "app/store";
import { Player } from "../components/Player";

describe("Player", () => {
  it("player renders the new clock at start", () => {
    const html = renderToStaticMarkup(
      <Provider store={store}>
        <Player name="Me" title={null} avatar={null} isWhite={true} />
      </Provider>
    );
    expect(html.match(/role="timer"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Clock for Me"');
    expect(html).toMatch(/<span class="player__timer">10:00<\/span>/);
    // Exactly one svg in the card, and it is our clock icon; a react-icons
    // icon would be a second <svg> without that class.
    const svgs = html.match(/<svg[^>]*>/g) ?? [];
    expect(svgs).toHaveLength(1);
    expect(svgs[0]).toContain('class="clock-icon"');
  });
});
