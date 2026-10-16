import React from "react";

import "./MoveList.css";

export interface StepKey {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

/**
 * The position an arrow key steps to, or `null` when it does nothing: another
 * key, a modifier held, or already at that end.
 */
export function stepForKey(key: string | StepKey, cursor: number, last: number): number | null {
  const k = typeof key === "string" ? { key } : key;
  if (k.altKey || k.ctrlKey || k.metaKey || k.shiftKey) return null;
  if (k.key === "ArrowLeft") return cursor > 0 ? cursor - 1 : null;
  if (k.key === "ArrowRight") return cursor < last ? cursor + 1 : null;
  return null;
}

const ICONS = {
  first: "M6 5v14M18 5l-8 7 8 7",
  previous: "M15 5l-7 7 7 7",
  next: "M9 5l7 7-7 7",
  last: "M18 5v14M6 5l8 7-8 7",
};

interface Props {
  /** Position index, `0..last`. */
  cursor: number;
  last: number;
  /** Locks every button, for example while a key moment waits for a move. */
  disabled: boolean;
  /** Gets the position to step to. */
  onStep: (cursor: number) => void;
}

/** First, previous, next and last move, under the board. */
export const StepButtons = ({ cursor, last, disabled, onStep }: Props) => {
  const buttons = [
    { label: "First move", icon: ICONS.first, to: 0, off: cursor <= 0 },
    { label: "Previous move", icon: ICONS.previous, to: cursor - 1, off: cursor <= 0 },
    { label: "Next move", icon: ICONS.next, to: cursor + 1, off: cursor >= last },
    { label: "Last move", icon: ICONS.last, to: last, off: cursor >= last },
  ];
  return (
    <div className="review-steps" role="group" aria-label="Step through the game">
      {buttons.map((b) => (
        <button
          key={b.label}
          type="button"
          className="review-step"
          aria-label={b.label}
          disabled={disabled || b.off}
          onClick={() => onStep(b.to)}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
            <path
              d={b.icon}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ))}
    </div>
  );
};
