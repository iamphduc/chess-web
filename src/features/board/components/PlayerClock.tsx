import React from "react";

import { clockStage, formatClock, handAngle, lowTimeAlert } from "../clock";

interface Props {
  remainingMs: number;
  isActive: boolean;
  playerName: string;
}

/** The clock pill: a round face whose hand steps a quarter turn per second, then the digits. */
export const PlayerClock = ({ remainingMs, isActive, playerName }: Props) => {
  const className = [
    "player__time",
    isActive && "player__time--running",
    isActive && clockStage(remainingMs) !== "normal" && "player__time--low",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className={className} role="timer" aria-label={`Clock for ${playerName}`}>
        <svg className="clock-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle className="clock-icon__face" cx="12" cy="12" r="10.5" />
          <line
            className="clock-icon__hand"
            x1="12"
            y1="13.5"
            x2="12"
            y2="5"
            style={{ transform: `rotate(${handAngle(remainingMs)}deg)` }}
          />
          <circle className="clock-icon__pin" cx="12" cy="12" r="1.6" />
        </svg>
        <span className="player__timer">{formatClock(remainingMs)}</span>
      </div>
      <span className="player__alert" role="alert">
        {lowTimeAlert(remainingMs)}
      </span>
    </>
  );
};
