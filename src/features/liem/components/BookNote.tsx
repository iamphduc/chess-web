import React, { forwardRef, useEffect, useMemo, useRef } from "react";

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

/** The last note shown in a game, and its height in px, kept for the slot. */
export interface KeptNote {
  gameId: number;
  height: number;
}

/** What the note's place in the sidebar holds: the note, an empty slot as tall as it was, or nothing. */
export type BookNoteSlot =
  | { kind: "note"; view: ShownBookNote; minHeight: number }
  | { kind: "gone"; height: number }
  | null;

/**
 * The slot for `view` in game `gameId`, given the note kept from earlier renders. Out of his
 * book the note is gone, but below 992 px it sits above the Moves card, so its place stays as
 * an empty slot as tall as it was until a new game: the page never shrinks and scrolls after his
 * reply (body has `overflow-anchor: none`). For the same reason the note never gets shorter in a
 * game (fewer book rows after a later move). Nothing is kept from another game or a note never measured.
 */
export function bookNoteSlot(kept: KeptNote | null, gameId: number, view: BookNoteView): BookNoteSlot {
  const height = kept !== null && kept.gameId === gameId ? kept.height : 0;
  if (view.kind !== "out") return { kind: "note", view, minHeight: height };
  if (height <= 0) return null;
  return { kind: "gone", height };
}

/** The slot's markup: the note card, an empty slot with no note in it, or nothing. */
export const BookNoteSlotView = forwardRef<HTMLElement, { slot: BookNoteSlot; onRetry: () => void }>(
  function BookNoteSlotView({ slot, onRetry }, ref) {
    if (slot === null) return null;
    if (slot.kind === "gone") {
      return <div className="liem-note-slot" aria-hidden="true" style={{ height: `${slot.height}px` }} />;
    }
    return (
      <section
        ref={ref}
        className="liem-note"
        data-book-state={slot.view.kind}
        aria-label="His book"
        style={slot.minHeight > 0 ? { minHeight: `${slot.minHeight}px` } : undefined}
      >
        <BookNoteBody view={slot.view} onRetry={onRetry} />
      </section>
    );
  }
);

/** The margin note for his book, with an ochre edge. Out of his book only its empty slot stays. */
export const BookNote = ({ onRetry }: Props) => {
  const engineHistory = useAppSelector((s) => s.board.engineHistory);
  const gameId = useAppSelector((s) => s.board.gameId);
  const lastChoice = useAppSelector((s) => s.match.lastChoice);
  const opponentStatus = useAppSelector((s) => s.match.opponentStatus);
  const view = useMemo(
    () => bookNoteView({ engineHistory, gameId }, { lastChoice, opponentStatus }),
    [engineHistory, gameId, lastChoice, opponentStatus]
  );

  const note = useRef<HTMLElement>(null);
  const kept = useRef<KeptNote | null>(null);
  const slot = bookNoteSlot(kept.current, gameId, view);
  // After each render, keep the shown note's height (its tallest, as it has a min-height) for
  // the slot; drop it once nothing shows.
  useEffect(() => {
    if (slot?.kind === "note" && note.current) kept.current = { gameId, height: note.current.offsetHeight };
    else if (slot === null) kept.current = null;
  });
  return <BookNoteSlotView ref={note} slot={slot} onRetry={onRetry} />;
};
