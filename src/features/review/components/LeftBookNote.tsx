import React from "react";

import type { ReviewModel } from "game/review/types";
import { moveNumber } from "./MoveList";

const count = new Intl.NumberFormat("en-US");

/**
 * The first line of the Moves list: where the game left his book and his
 * most-played move there, or that it never left. Without his books (`leftBook`
 * null and no book plies) it shows nothing.
 */
export const LeftBookNote = ({ model }: { model: ReviewModel }) => {
  const { leftBook, bookPlies } = model;
  if (leftBook === null && bookPlies === 0) return null;

  if (leftBook === null) {
    return (
      <p className="move-list__left-book" data-left-book="stayed">
        Stayed in his book the whole game
      </p>
    );
  }

  // His most-played move there; a move with no games counts as none.
  const top = leftBook.his.reduce<{ label: string; games: number } | null>((best, m) => {
    const games = m.games ?? 0;
    return games > 0 && (best === null || games > best.games) ? { label: m.label, games } : best;
  }, null);
  const where = `Left his book at move ${moveNumber(leftBook.ply)}`;
  return (
    <p className="move-list__left-book" data-left-book={leftBook.ply}>
      {top === null
        ? where
        : `${where} · he played ${top.label} in ${count.format(top.games)} ${top.games === 1 ? "game" : "games"}`}
    </p>
  );
};
