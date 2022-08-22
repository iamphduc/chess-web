import React, { ReactNode } from "react";

import "./Square.css";

interface Props {
  children: ReactNode;
  isDark: boolean;
  size?: number;
}

export const Square = ({ children, isDark, size = 52 }: Props) => {
  return (
    <div
      className={`square square--${isDark ? "dark" : "light"}`}
      style={{ width: size, height: size }}
    >
      {children}
    </div>
  );
};
