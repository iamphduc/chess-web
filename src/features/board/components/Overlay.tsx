import React from "react";

import "./Overlay.css";

export enum OverlayType {
  Illegal = "ILLEGAL",
  Legal = "LEGAL",
  Possible = "POSSIBLE",
}

interface Props {
  type: OverlayType;
}

const getOverlayColor = (type: OverlayType) => {
  switch (type) {
    case OverlayType.Illegal:
      return "red";
    case OverlayType.Legal:
      return "green";
    case OverlayType.Possible:
      return "yellow";
  }
};

export const Overlay = ({ type }: Props) => {
  const color = getOverlayColor(type);

  return <div className={`overlay overlay--${color}`} />;
};
