import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PieceDragImage, previewSize } from "../components/PieceDragPreview";
import { PieceType } from "../../../game/piece-type";
import { SQUARE_SIZE_MD, SQUARE_SIZE_XL, SQUARE_SIZE_XS } from "../../../constants";

describe("PieceDragImage", () => {
  it("drag image draws the piece at the square size", () => {
    const html = renderToStaticMarkup(
      <PieceDragImage
        pieceType={PieceType.WhiteKnightKing}
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

describe("previewSize", () => {
  // Media query results at a given viewport width, as Board.tsx asks them.
  const at = (width: number) => previewSize(width >= 768, width >= 1200);

  it("preview size follows the board breakpoints", () => {
    expect(at(375)).toBe(SQUARE_SIZE_XS);
    expect(at(767)).toBe(SQUARE_SIZE_XS);
    expect(at(768)).toBe(SQUARE_SIZE_MD);
    expect(at(1199)).toBe(SQUARE_SIZE_MD);
    expect(at(1200)).toBe(SQUARE_SIZE_XL);
    expect(at(1920)).toBe(SQUARE_SIZE_XL);
  });

  it("the wide query wins, as in Board.tsx", () => {
    expect(previewSize(false, true)).toBe(SQUARE_SIZE_XL);
  });
});
