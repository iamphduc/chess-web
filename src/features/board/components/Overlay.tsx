import React from "react";

import "./Overlay.css";

export enum OverlayType {
  Illegal = "ILLEGAL",
  Legal = "LEGAL",
  Possible = "POSSIBLE",
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
    />
  );
};
