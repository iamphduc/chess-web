import React, { ReactNode } from "react";

import "./BoardSidebar.css";

interface Props {
  /** The card's title row; none when empty. */
  title: string;
  /** Extra classes, such as `moves-card`. */
  className?: string;
  /** No padding, for a list that runs edge to edge. */
  flush?: boolean;
  /** The row of controls under the content. */
  foot?: ReactNode;
  children?: ReactNode;
}

/** A card in the board screen's sidebar. */
export const BoardSidebar = ({ title, className, flush = false, foot, children }: Props) => {
  const classes = ["card", flush && "card--flush", "board-sidebar", className].filter(Boolean).join(" ");
  return (
    <div className={classes}>
      {title && <h2 className="card__head">{title}</h2>}
      {children}
      {foot && <div className="card__foot">{foot}</div>}
    </div>
  );
};
