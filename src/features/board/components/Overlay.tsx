import React from "react";

import "./Overlay.css";

export enum OverlayType {
  Illegal = "ILLEGAL",
  Legal = "LEGAL",
  Possible = "POSSIBLE",
  Previous = "PREVIOUS",
  Current = "CURRENT",
  Enemy = "Enemy",
}

interface Props {
  type: OverlayType;
  handleClick?: () => void;
}

export const Overlay = ({ type, handleClick }: Props) => {
  return (
    <div
      className={`overlay overlay--${type.toLowerCase()}`}
      onClick={() => handleClick && handleClick()}
    >
      {type === OverlayType.Possible && <div className="overlay__possible" />}
      {type === OverlayType.Enemy && <div className="overlay__enemy" />}
    </div>
  );
};
