import React, { useMemo } from "react";

import "features/board/components/Button.css";
import "./BookNote.css";
import { useAppSelector } from "app/hooks";
import { bookNoteView, type BookNoteView } from "../bookNote";

interface Props {
  /** Asks him again after a failure. */
  onRetry: () => void;
}

const count = new Intl.NumberFormat("en-US");

/** The shown note states: out of his book there is no note. */
export type ShownBookNote = Exclude<BookNoteView, { kind: "out" }>;

/** The book note's text for each shown state, from the plan's Look (draft A). */
export function BookNoteBody({ view, onRetry }: { view: ShownBookNote; onRetry: () => void }) {
  switch (view.kind) {
    case "waiting":
      return (
        <>
          <h3 className="book-note__title">His book</h3>
          <p className="book-note__text">The moves he played here show after his first move.</p>
        </>
      );
    case "in-book":
      return (
        <>
          <h3 className="book-note__title">In his book</h3>
          <p className="book-note__text">In {count.format(view.total)} of his games here, he played:</p>
          {view.rows.map((row) => (
            <div
              key={row.uci}
              className={row.played ? "liem-note__row liem-note__row--played" : "liem-note__row"}
              data-uci={row.uci}
              data-played={row.played ? "true" : "false"}
            >
              <span className="book-note__move">{row.label}</span>
              <div className="liem-note__bar" style={{ width: `${row.width}%` }} aria-hidden="true" />
              <span className="liem-note__count">{count.format(row.games)}</span>
            </div>
          ))}
        </>
      );
    case "failed":
      return (
        <>
          <h3 className="book-note__title">He couldn't move</h3>
          <p className="book-note__text">His engine or his book didn't load.</p>
          <button type="button" className="button book-note__retry" onClick={onRetry}>
            Try again
          </button>
        </>
      );
  }
}

/** The margin note for his book, with an ochre edge. Out of his book it isn't rendered at all. */
export const BookNote = ({ onRetry }: Props) => {
  const engineHistory = useAppSelector((s) => s.board.engineHistory);
  const gameId = useAppSelector((s) => s.board.gameId);
  const lastChoice = useAppSelector((s) => s.match.lastChoice);
  const opponentStatus = useAppSelector((s) => s.match.opponentStatus);
  const view = useMemo(
    () => bookNoteView({ engineHistory, gameId }, { lastChoice, opponentStatus }),
    [engineHistory, gameId, lastChoice, opponentStatus]
  );

  if (view.kind === "out") return null;
  return (
    <section className="liem-note" data-book-state={view.kind} aria-label="His book">
      <BookNoteBody view={view} onRetry={onRetry} />
    </section>
  );
};
