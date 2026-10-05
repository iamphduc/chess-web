import React from "react";

interface Props {
  remainingMs: number;
  isActive: boolean;
  playerName: string;
}

// Stub so the tests fail on assertions; the real component comes next.
export const PlayerClock = (_props: Props) => <div className="player__time" />;
