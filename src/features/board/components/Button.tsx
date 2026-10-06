import React from "react";
import { useInstantLayoutTransition } from "framer-motion";

import "./Button.css";
import { useAppDispatch, useAppSelector } from "app/hooks";
import { reset, start } from "../BoardSlice";
import { toggleFlip } from "../viewSlice";

export enum ButtonType {
  Play = "Play",
  Reset = "Reset",
  Undo = "Undo",
  Flip = "Flip",
}

interface Props {
  type: ButtonType;
}

/** Two arrows, up and down: turn the board around. */
const FlipIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.25}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M7 20V4M3 8l4-4 4 4" />
    <path d="M17 4v16M13 16l4 4 4-4" />
  </svg>
);

const FlipButton = () => {
  const dispatch = useAppDispatch();
  const flipped = useAppSelector((state) => state.view.flipped);
  // Pieces keep their layoutId across the flip; skipping the layout animation for
  // this one update makes them jump to their flipped squares instead of sliding.
  const startInstantLayoutTransition = useInstantLayoutTransition();

  return (
    <button
      type="button"
      className="button button--icon"
      aria-label="Flip board"
      aria-pressed={flipped}
      title="Flip board"
      onClick={() => {
        // Not passed as the callback: framer skips the callback when no layout node exists yet.
        startInstantLayoutTransition();
        dispatch(toggleFlip());
      }}
    >
      <FlipIcon />
    </button>
  );
};

export const Button = ({ type }: Props) => {
  const dispatch = useAppDispatch();

  if (type === ButtonType.Flip) return <FlipButton />;

  const handleClick = () => {
    switch (type) {
      case ButtonType.Play: {
        dispatch(start());
        break;
      }
      case ButtonType.Reset: {
        dispatch(reset());
      }
    }
  };

  return (
    <button className={`button button--${type.toLowerCase()}`} onClick={handleClick}>
      {type}
    </button>
  );
};
