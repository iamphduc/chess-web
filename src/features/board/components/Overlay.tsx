import React from "react";

import "./Overlay.css";

export enum OverlayType {
  Highlight = "HIGHLIGHT",
  Check = "CHECK",
  Dot = "DOT",
  Ring = "RING",
  DropEdge = "DROP_EDGE",
}

interface Props {
  type: OverlayType;
}

/** A mark drawn over a square. Marks never take clicks; the square handles them. */
export const Overlay = ({ type }: Props) => (
  <div className={`overlay overlay--${type.toLowerCase().replace("_", "-")}`} aria-hidden="true" />
);
