import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import * as preview from "../components/PieceDragPreview";
import { PieceDragImage } from "../components/PieceDragPreview";
import { PieceType } from "../../../game/piece-type";

describe("PieceDragImage", () => {
  it("drag image draws the piece at the square size", () => {
    const html = renderToStaticMarkup(
      <PieceDragImage
        pieceType={PieceType.WhiteKingKnight}
        size={48}
        style={{ transform: "translate(10px, 20px)", position: "fixed", top: 0, left: 0 }}
      />
    );
    expect(html).toMatch(/^<div /);
    expect(html).toContain("background-image:url(svg-mock)");
    expect(html).toContain("width:48px");
    expect(html).toContain("height:48px");
    expect(html).toContain("pointer-events:none");
    expect(html).toContain("transform:translate(10px, 20px)");
    expect(html).toContain("position:fixed");
    // The plain piece: no shadow, no tint, no scale.
    expect(html).not.toMatch(/shadow|filter|opacity|scale/);
  });

  it("drag image size changes with the size prop", () => {
    const html = renderToStaticMarkup(<PieceDragImage pieceType={PieceType.BlackQueen} size={78} style={{}} />);
    expect(html).toContain("width:78px");
    expect(html).toContain("height:78px");
  });
});

describe("PieceDragPreview module", () => {
  it("preview module has no size helper of its own", () => {
    expect(Object.keys(preview).sort()).toEqual(["PieceDragImage", "PieceDragPreview"]);
  });
});
