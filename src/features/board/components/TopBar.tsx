import React from "react";

import "./TopBar.css";
import { useAppSelector } from "app/hooks";
import { hashFor } from "app/route";
import { topBarInput, topBarTitle } from "../topBar";

interface Props {
  /** A button on the right, such as the review's Play again; none on the play screen. */
  action?: { label: string; onClick: () => void };
}

/** The board screen's top bar: ← Home, then where you are, then the action if there is one. */
export const TopBar = ({ action }: Props) => {
  const title = useAppSelector((state) => topBarTitle(topBarInput(state)));
  return (
    <header className="top-bar">
      <a className="button top-bar__home" href={hashFor("home")}>
        ← Home
      </a>
      <span className="top-bar__title">{title}</span>
      {action && (
        <button type="button" className="button top-bar__action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </header>
  );
};
