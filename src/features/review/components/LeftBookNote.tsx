import React from "react";

import "features/liem/components/BookNote.css";
import type { ReviewModel } from "game/review/types";
import { moveNumber } from "./MoveList";

const count = new Intl.NumberFormat("en-US");

/**
 * Where the game left his book and what he played there, or that it never left.
 * Without his books (`leftBook` null and no book plies) it shows nothing.
 */
export const LeftBookNote = ({ model }: { model: ReviewModel }) => {
  const { leftBook, bookPlies } = model;
  if (leftBook === null && bookPlies === 0) return null;

  if (leftBook === null) {
    return (
      <section className="liem-note" data-left-book="stayed" aria-label="His book">
        <h3 className="book-note__title">Stayed in his book the whole game</h3>
      </section>
    );
  }

  const total = leftBook.his.reduce((sum, m) => sum + (m.games ?? 0), 0);
  const games = `${count.format(total)} ${total === 1 ? "game" : "games"}`;
  return (
    <section
      className="liem-note liem-note--out"
      data-left-book={leftBook.ply}
      aria-label="Left his book"
    >
      <h3 className="book-note__title">Left his book at move {moveNumber(leftBook.ply)}</h3>
      <p className="book-note__text">
        {total > 0
          ? `You played ${leftBook.played.label}. In his ${games} here, he played:`
          : `You played ${leftBook.played.label}. He has no games from this position.`}
      </p>
      {total > 0 &&
        leftBook.his.map((m) => (
          <div key={m.uci} className="liem-note__row" data-uci={m.uci}>
            <span className="book-note__move">{m.label}</span>
            <div
              className="liem-note__bar"
              style={{ width: `${Math.max(2, Math.round(((m.games ?? 0) / total) * 100))}%` }}
              aria-hidden="true"
            />
            <span className="liem-note__count">{count.format(m.games ?? 0)}</span>
          </div>
        ))}
    </section>
  );
};
