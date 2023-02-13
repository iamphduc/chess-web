import React, { ReactNode } from "react";

import "./BoardSidebar.css";

interface Props {
  title: string;
  children?: ReactNode;
}

export const BoardSidebar = ({ title, children }: Props) => {
  return (
    <div className="board-sidebar">
      <h3 className="board-sidebar__title">{title}</h3>
      {children}
    </div>
  );
};
