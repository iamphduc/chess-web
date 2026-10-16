import React from "react";

import "./MoveList.css";
import type { Grade, ReviewModel } from "game/review/types";
import { GRADE_MARK } from "./MoveList";

const COUNTS: { grade: Grade; label: string }[] = [
  { grade: "inaccuracy", label: "Inaccuracies" },
  { grade: "mistake", label: "Mistakes" },
  { grade: "blunder", label: "Blunders" },
];

/** The game accuracy (28 px, "—" until every move of yours is graded) and the grade counts. */
export const AccuracyPanel = ({ model }: { model: ReviewModel }) => {
  const bookMoves = model.moves.filter((m) => m.byHuman && m.bookGames !== null).length;
  return (
    <section className="accuracy-panel" aria-label="Your accuracy">
      <div className="accuracy-panel__main">
        {model.accuracy === null ? (
          <>
            <span className="review-accuracy" aria-hidden="true">
              —
            </span>
            <span className="review-sr-only">Not ready yet</span>
          </>
        ) : (
          <span className="review-accuracy">{Math.round(model.accuracy)}%</span>
        )}
        <span className="accuracy-panel__label">Your accuracy</span>
      </div>
      <dl className="accuracy-panel__counts">
        {COUNTS.map(({ grade, label }) => (
          <div key={grade} className="accuracy-panel__count" data-count={grade}>
            <dt>
              <span className={`review-grade--${grade}`} aria-hidden="true">
                {GRADE_MARK[grade]}
              </span>{" "}
              {label}
            </dt>
            <dd>{model.counts[grade]}</dd>
          </div>
        ))}
        {bookMoves > 0 && (
          <div className="accuracy-panel__count" data-count="book">
            <dt>
              <span className="review-grade--book">Book moves</span>
            </dt>
            <dd>{bookMoves}</dd>
          </div>
        )}
      </dl>
    </section>
  );
};
