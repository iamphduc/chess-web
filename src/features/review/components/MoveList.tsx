import React, { useEffect, useId, useRef, useState } from "react";

import "./MoveList.css";
import type { Grade, ReviewModel, ReviewMove } from "game/review/types";

export const GRADE_MARK: Record<Grade, string> = { inaccuracy: "?!", mistake: "?", blunder: "??" };

/** `"13.Nd5"` and `"13...Nc6"` without the move number. */
export const sanOf = (label: string): string => label.replace(/^\d+\.(\.\.)?/, "");

/** The move number a ply belongs to. */
export const moveNumber = (ply: number): number => Math.floor(ply / 2) + 1;

const count = new Intl.NumberFormat("en-US");

interface Row {
  number: number;
  white: ReviewMove | null;
  black: ReviewMove | null;
}

/** Plies grouped by move number; a run that starts on Black's ply has no White move in its first row. */
export function moveRows(moves: readonly ReviewMove[]): Row[] {
  const rows: Row[] = [];
  for (const m of moves) {
    const number = moveNumber(m.ply);
    let row = rows[rows.length - 1];
    if (row === undefined || row.number !== number) {
      row = { number, white: null, black: null };
      rows.push(row);
    }
    if (m.ply % 2 === 0) row.white = m;
    else row.black = m;
  }
  return rows;
}

function BookIcon() {
  return (
    <svg className="move-list__book-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M2 3.5c2-1 4-1 6 .5 2-1.5 4-1.5 6-.5v9c-2-1-4-1-6 .5-2-1.5-4-1.5-6-.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 4v9" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

interface MoveProps {
  move: ReviewMove;
  selected: boolean;
  inBook: boolean;
  keyIndex: number | null;
  onSelect: (cursor: number) => void;
}

function MoveButton({ move, selected, inBook, keyIndex, onSelect }: MoveProps) {
  const book = inBook || move.bookGames !== null;
  const name = [
    move.label,
    move.grade,
    move.bookGames !== null ? "book" : null,
    keyIndex && `key moment ${keyIndex}`,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <button
      type="button"
      className={selected ? "review-move review-move--selected" : "review-move"}
      data-ply={move.ply}
      data-grade={move.grade ?? undefined}
      data-book={book ? "true" : undefined}
      aria-label={name}
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(move.ply + 1)}
    >
      {sanOf(move.label)}
      {move.grade !== null && (
        <span className={`review-grade--${move.grade}`} aria-hidden="true">
          {GRADE_MARK[move.grade]}
        </span>
      )}
      {move.bookGames !== null && (
        <span className="review-grade--book" aria-hidden="true">
          <BookIcon />
        </span>
      )}
      {keyIndex !== null && (
        <sup className="move-list__key" aria-hidden="true">
          {keyIndex}
        </sup>
      )}
    </button>
  );
}

interface RowsProps {
  rows: Row[];
  cursor: number;
  bookPlies: number;
  keyIndex: Map<number, number>;
  onSelect: (cursor: number) => void;
}

function Rows({ rows, cursor, bookPlies, keyIndex, onSelect }: RowsProps) {
  const cell = (m: ReviewMove | null, gap: boolean) => {
    if (m === null) {
      return gap ? (
        <span className="move-list__gap" aria-hidden="true">
          …
        </span>
      ) : (
        <span />
      );
    }
    return (
      <MoveButton
        move={m}
        selected={m.ply === cursor - 1}
        inBook={m.ply < bookPlies}
        keyIndex={keyIndex.get(m.ply) ?? null}
        onSelect={onSelect}
      />
    );
  };
  return (
    <>
      {rows.map((row) => (
        <div className="move-list__row" key={`${row.number}-${row.white?.ply ?? "b"}`}>
          <span className="move-list__num">{row.number}.</span>
          {cell(row.white, row.black !== null)}
          {cell(row.black, false)}
        </div>
      ))}
    </>
  );
}

/** "Moves 1–12", or "Move 1" for a fold inside the first move. */
function foldRange(bookPlies: number): string {
  const lastMove = moveNumber(bookPlies - 1);
  return lastMove === 1 ? "Move 1" : `Moves 1–${lastMove}`;
}

/** Games behind the deepest human book move in the fold, if there is one. */
function foldGames(moves: readonly ReviewMove[], bookPlies: number): number | null {
  for (let i = bookPlies - 1; i >= 0; i--) {
    const games = moves[i]?.bookGames ?? null;
    if (games !== null) return games;
  }
  return null;
}

interface Props {
  model: ReviewModel;
  /** Position index; the selected move is ply `cursor - 1`. */
  cursor: number;
  /** Gets the position after the clicked move. */
  onSelect: (cursor: number) => void;
}

/**
 * The game's moves by move number with their grade marks. The plies in his book
 * fold into one "In his book" row, which opens on a click or when the selected
 * move is inside it.
 */
export const MoveList = ({ model, cursor, onSelect }: Props) => {
  const { moves, bookPlies } = model;
  const selected = cursor - 1;
  const inFold = selected >= 0 && selected < bookPlies;

  // Open the fold whenever the selection moves to a move inside it; the human can close it again.
  const [open, setOpen] = useState(inFold);
  const foldCursor = inFold ? cursor : -1;
  const [seenFoldCursor, setSeenFoldCursor] = useState(foldCursor);
  if (foldCursor !== seenFoldCursor) {
    setSeenFoldCursor(foldCursor);
    if (inFold) setOpen(true);
  }

  const foldId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = listRef.current;
    const el = box?.querySelector<HTMLElement>(".review-move--selected");
    if (!box || !el) return;
    // Only the list scrolls (never the page), and only when the move is out of view; it lands in the middle.
    const hidden =
      el.offsetTop < box.scrollTop ||
      el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight;
    if (hidden) box.scrollTop = el.offsetTop - (box.clientHeight - el.offsetHeight) / 2;
  }, [cursor, open]);

  const keyIndex = new Map(model.keyMoments.map((k, i) => [k.ply, i + 1]));
  const games = bookPlies > 0 ? foldGames(moves, bookPlies) : null;
  const rowsProps = { cursor, bookPlies, keyIndex, onSelect };

  return (
    <div className="move-list" ref={listRef} aria-label="Moves">
      {bookPlies > 0 && (
        <div className="move-list__fold">
          <button
            type="button"
            className="move-list__fold-button"
            aria-expanded={open}
            aria-controls={foldId}
            onClick={() => setOpen(!open)}
          >
            <BookIcon />
            <span className="move-list__fold-text">
              <b>In his book</b> · {foldRange(bookPlies)}
              {games !== null && (
                <span className="move-list__fold-sub">
                  He faced this line in {count.format(games)} {games === 1 ? "game" : "games"}
                </span>
              )}
            </span>
            <span className="move-list__chevron" aria-hidden="true">
              {open ? "▴" : "▾"}
            </span>
          </button>
          {open && (
            <div id={foldId} className="move-list__fold-rows">
              <Rows rows={moveRows(moves.slice(0, bookPlies))} {...rowsProps} />
            </div>
          )}
        </div>
      )}
      <Rows rows={moveRows(moves.slice(bookPlies))} {...rowsProps} />
    </div>
  );
};
