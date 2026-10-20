import React, { useEffect, useState } from "react";

import "./ResignButton.css";
import { useAppDispatch, useAppSelector } from "app/hooks";
import { resign } from "../BoardSlice";
import { canResign } from "../gameEnd";
import { confirmEndsIn, isConfirming, pressResign, resignIdle } from "../resignConfirm";

/**
 * Resign, then a red Confirm for 3 s (plan ui-polish ## Look). The press logic is in
 * `resignConfirm.ts`; this only reads the clock, owns the timer and dispatches.
 * Shows nothing when the game can't be resigned.
 */
export const ResignButton = () => {
  const dispatch = useAppDispatch();
  const gameId = useAppSelector((state) => state.board.gameId);
  const live = useAppSelector((state) => canResign(state.board));
  const [confirm, setConfirm] = useState(() => resignIdle(gameId));
  // Re-renders when Confirm runs out, so it turns back to Resign.
  const [, setExpired] = useState(0);

  const now = Date.now();
  const confirming = live && isConfirming(confirm, now, gameId);
  const endsIn = live ? confirmEndsIn(confirm, now, gameId) : null;

  useEffect(() => {
    if (endsIn === null) return;
    const timer = setTimeout(() => setExpired((n) => n + 1), endsIn);
    return () => clearTimeout(timer);
  }, [endsIn]);

  if (!live) return null;

  const onClick = () => {
    const { next, resign: resigns } = pressResign(confirm, Date.now(), gameId);
    setConfirm(next);
    if (resigns) dispatch(resign());
  };

  return (
    <button
      type="button"
      className="button resign-button"
      data-confirm={confirming ? "true" : undefined}
      aria-label={confirming ? "Confirm resign" : undefined}
      onClick={onClick}
    >
      {confirming ? "Confirm" : "Resign"}
    </button>
  );
};
