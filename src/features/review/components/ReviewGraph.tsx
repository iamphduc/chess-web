import React from "react";

import "./ReviewGraph.css";
import type { PieceColor } from "game/engine/game-state";
import type { ReviewModel } from "game/review/types";
import {
  graphPoints,
  lineRuns,
  moveTicks,
  nearestPosition,
  positionX,
  type GraphPoint,
} from "../graphGeometry";
import type { GraphSide } from "../reviewSlice";
import { GRADE_MARK } from "./MoveList";

/** Up to 3 decimals, so the markup stays short. */
const n3 = (v: number): number => Math.round(v * 1000) / 1000;
const pct = (v: number): string => `${n3(v)}%`;

/**
 * The tooltip at the cursor: "27.Qe2?? −44 %". His moves show only the label, a
 * book move says so, and a drop under half a point isn't shown. `null` at the start.
 */
export function cursorTip(model: ReviewModel, cursor: number): string | null {
  const move = model.moves[cursor - 1];
  if (move === undefined) return null;
  const mark = move.grade === null ? "" : GRADE_MARK[move.grade];
  if (move.bookGames !== null) return `${move.label} · book`;
  const drop = move.drop === null ? 0 : Math.round(move.drop);
  return drop > 0 ? `${move.label}${mark} −${drop} %` : `${move.label}${mark}`;
}

function linePath(run: readonly GraphPoint[]): string {
  return run.map((p, i) => `${i === 0 ? "M" : "L"}${n3(p.x)},${n3(p.y)}`).join(" ");
}

function areaPath(run: readonly GraphPoint[]): string {
  const first = run[0];
  const last = run[run.length - 1];
  return `M${n3(first.x)},100 ${linePath(run).replace(/^M/, "L")} L${n3(last.x)},100 Z`;
}

/** Keeps the tooltip inside the plot: pinned to an edge near the ends, below the point near the top. */
function tipClass(x: number, y: number): string {
  const h = x < 12 ? " review-graph__tip--start" : x > 88 ? " review-graph__tip--end" : "";
  const v = y < 35 ? " review-graph__tip--below" : "";
  return `review-graph__tip${h}${v}`;
}

interface Props {
  model: ReviewModel;
  humanColor: PieceColor;
  side: GraphSide;
  /** Position index, 0 is the start. */
  cursor: number;
  /** Gets the position nearest to the click. */
  onSelect: (cursor: number) => void;
  onSide: (side: GraphSide) => void;
}

const SIDES: { side: GraphSide; label: string }[] = [
  { side: "white", label: "White" },
  { side: "you", label: "You" },
];

/**
 * B's win % graph: the olive book band, a dashed 50 % line, the line and area
 * for the analysed positions, a point at each graded move, and the cursor with
 * its tooltip. Positions are laid out in percent, so it fills any width.
 */
export const ReviewGraph = ({ model, humanColor, side, cursor, onSelect, onSide }: Props) => {
  const last = model.whiteWin.length - 1;
  const points = graphPoints(model.whiteWin, { side, humanColor, width: 100, height: 100 });
  const runs = lineRuns(points);
  const band = model.bookPlies > 0 ? n3(positionX(model.bookPlies, last, 100)) : 0;
  const cursorX = positionX(cursor, last, 100);
  const tip = cursorTip(model, cursor);
  const tipY = points[cursor]?.y ?? 0;
  const graded = model.moves.filter((m) => m.grade !== null && points[m.ply + 1] != null);
  const sideName = side === "you" ? "your side" : "White's side";

  const select = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onSelect(nearestPosition(e.clientX - rect.left, last, rect.width));
  };

  return (
    <section
      className="review-graph"
      data-review-graph="true"
      data-side={side}
      aria-label="Win % graph"
    >
      <div className="review-graph__head">
        <span className="review-graph__label">Win %</span>
        <div className="review-graph__sides" role="radiogroup" aria-label="Graph side">
          {SIDES.map((s) => (
            <button
              key={s.side}
              type="button"
              role="radio"
              aria-checked={side === s.side}
              className="review-graph__side"
              onClick={() => onSide(s.side)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div
        className="review-graph__plot"
        role="img"
        aria-label={`Win % by move, from ${sideName}. Click to jump to a move.`}
        onClick={select}
      >
        <svg
          className="review-graph__svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line
            className="review-graph__grid"
            x1="0"
            x2="100"
            y1="25"
            y2="25"
            vectorEffect="non-scaling-stroke"
          />
          <line
            className="review-graph__grid"
            x1="0"
            x2="100"
            y1="75"
            y2="75"
            vectorEffect="non-scaling-stroke"
          />
          {runs.map((run) => (
            <path key={`a${run[0].index}`} className="review-graph__area" d={areaPath(run)} />
          ))}
          {band > 0 && (
            <rect
              className="review-graph__band"
              data-book-band="true"
              x="0"
              y="0"
              width={band}
              height="100"
            />
          )}
          {runs.map((run) => (
            <path
              key={`l${run[0].index}`}
              className="review-graph__line"
              d={linePath(run)}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <span className="review-graph__mid" aria-hidden="true" />
        <span className="review-graph__axis review-graph__axis--top" aria-hidden="true">
          100
        </span>
        <span className="review-graph__axis review-graph__axis--mid" aria-hidden="true">
          50
        </span>
        <span className="review-graph__axis review-graph__axis--bottom" aria-hidden="true">
          0
        </span>
        <span
          className="review-graph__cursor"
          data-cursor="true"
          style={{ left: pct(cursorX) }}
          aria-hidden="true"
        />
        {graded.map((m) => {
          const p = points[m.ply + 1] as GraphPoint;
          const sel = m.ply === cursor - 1;
          return (
            <span
              key={m.ply}
              className={`review-graph__dot review-graph__dot--${m.grade}${sel ? " review-graph__dot--selected" : ""}`}
              data-ply={m.ply}
              data-grade={m.grade ?? undefined}
              data-selected={sel ? "true" : undefined}
              style={{ left: pct(p.x), top: pct(p.y) }}
              aria-hidden="true"
            />
          );
        })}
        {tip !== null && (
          <span className={tipClass(cursorX, tipY)} style={{ left: pct(cursorX), top: pct(tipY) }}>
            {tip}
          </span>
        )}
      </div>
      <div className="review-graph__ticks" aria-hidden="true">
        {moveTicks(last).map((t) => {
          const x = positionX(t.index, last, 100);
          return (
            <span
              key={t.move}
              className={
                x > 95 ? "review-graph__tick review-graph__tick--end" : "review-graph__tick"
              }
              style={{ left: pct(x) }}
            >
              {t.move}
            </span>
          );
        })}
      </div>
    </section>
  );
};
