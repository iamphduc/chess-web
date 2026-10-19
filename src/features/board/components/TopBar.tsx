import React from "react";

import "./TopBar.css";
import { useAppSelector } from "app/hooks";
import { hashFor } from "app/route";
import { topBarInput, topBarTitle } from "../topBar";

/** The board screen's top bar: ← Home, then where you are. */
export const TopBar = () => {
  const title = useAppSelector((state) => topBarTitle(topBarInput(state)));
  return (
    <header className="top-bar">
      <a className="button top-bar__home" href={hashFor("home")}>
        ← Home
      </a>
      <span className="top-bar__title">{title}</span>
    </header>
  );
};
