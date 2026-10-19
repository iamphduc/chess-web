import React, { useState } from "react";

import "features/board/components/Button.css";
import "./KeyMomentCard.css";
import type { PieceColor } from "game/engine/game-state";
import type { ReviewModel } from "game/review/types";
import { Star } from "features/liem/components/Star";
import { isMomentDone, type ReviewState } from "../reviewSlice";
import { keyMomentView, type KeyMomentView, type MomentDetail } from "../keyMomentView";

interface Handlers {
  /** Opens the moment at `ply` (the intro's Start, or Try again after a wrong try). */
  onStart: (ply: number) => void;
  onShowAnswer: (ply: number) => void;
  onSkip: (ply: number) => void;
  /** Opens the next moment not done. */
  onNext: (ply: number) => void;
  /** Try again after a failed analysis pass. */
  onRetry: () => void;
}

/** The body's Next moment passes `null` when no moment is left (the summary). */
type BodyHandlers = Omit<Handlers, "onNext"> & { onNext: (ply: number | null) => void };

interface Props extends Handlers {
  model: ReviewModel;
  review: Pick<ReviewState, "status" | "moments" | "active">;
  humanColor: PieceColor;
}

const Stars = ({ view }: { view: KeyMomentView }) =>
  view.stars.length === 0 ? null : (
    <span className="key-moment__stars" role="img" aria-label={view.foundLabel}>
      {view.stars.map((found, i) => (
        <span key={i} className="key-moment__star" data-found={found ? "true" : "false"}>
          <Star className={`review-star${found ? " review-star--found" : ""}`} />
        </span>
      ))}
    </span>
  );

const Progress = ({ progress }: { progress: NonNullable<KeyMomentView["progress"]> }) => {
  const share = progress.total === 0 ? 0 : Math.min(100, (progress.analysed / progress.total) * 100);
  return (
    <div
      className="review-progress key-moment__progress"
      role="progressbar"
      aria-label="Analysis progress"
      aria-valuemin={0}
      aria-valuemax={progress.total}
      aria-valuenow={progress.analysed}
    >
      <div className="review-progress__bar" style={{ width: `${share}%` }} />
    </div>
  );
};

const games = (n: number) => `${n} ${n === 1 ? "game" : "games"}`;

/** "You played X · Stockfish: Y · Liem played Z in N games". */
const Reveal = ({ moment }: { moment: MomentDetail }) => (
  <p className="key-moment__reveal">
    <span>
      You played <b className={`review-grade--${moment.grade}`}>{moment.played.label}</b>
    </span>
    {moment.best && (
      <>
        {" · "}
        <span>
          Stockfish: <b className="review-grade--best">{moment.best.label}</b>
        </span>
      </>
    )}
    {moment.liem && (
      <>
        {" · "}
        <span>
          Liem played <b className="review-grade--book">{moment.liem.label}</b>
          {moment.liem.games !== undefined && ` in ${games(moment.liem.games)}`}
        </span>
      </>
    )}
  </p>
);

const Action = ({
  kind,
  label,
  onClick,
  disabled,
}: {
  kind: "play" | "quiet" | "ghost";
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    className={`button ${kind === "play" ? "button--play" : `key-moment__${kind}`}`}
    onClick={onClick}
    disabled={disabled}
  >
    {label}
  </button>
);

function body(view: KeyMomentView): React.ReactNode {
  const m = view.moment;
  switch (view.state) {
    case "failed":
      return <p className="key-moment__text">Stockfish stopped before it finished your game. Try again to pick up where it left off.</p>;
    case "none":
      return <p className="key-moment__text">Stockfish found no inaccuracy or worse in your moves.</p>;
    case "waiting":
      return <p className="key-moment__text key-moment__soft">Stockfish checks each of your moves. Key moments show here as soon as they're ready.</p>;
    case "intro":
      return (
        <p className="key-moment__text key-moment__soft">
          {view.progress ? "You can start with what's ready." : "Find a better move at each one."}
        </p>
      );
    case "summary":
      return <p className="key-moment__text key-moment__soft">Step through the game to look at any move again.</p>;
    case "trying":
    case "checking":
    case "wrong":
    case "check-failed":
      return (
        <>
          <p className="key-moment__text">
            {m!.side} to play. Your move is hidden. Make a move on the board.
          </p>
          <p className="key-moment__meta">
            Move {m!.moveNumber} · your move cost <b className={`review-grade--${m!.grade}`}>{Math.round(m!.drop)}%</b>
          </p>
          {view.state === "checking" && <p className="key-moment__try" role="status">Checking your move…</p>}
          {view.state === "wrong" && (
            <p className="key-moment__try" role="status">Not that one. It still loses too much. Try again, or show the answer.</p>
          )}
          {view.state === "check-failed" && (
            <p className="key-moment__try" role="status">Stockfish couldn't check that move. Try again, or show the answer.</p>
          )}
        </>
      );
    case "found":
    case "revealed":
    case "skipped":
      return <Reveal moment={m!} />;
  }
}

function actions(view: KeyMomentView, h: BodyHandlers): React.ReactNode {
  const ply = view.moment?.ply;
  switch (view.state) {
    case "failed":
      return <Action kind="play" label="Try again" onClick={h.onRetry} />;
    case "intro":
      return <Action kind="play" label={view.startLabel!} onClick={() => h.onStart(view.startPly!)} />;
    case "trying":
    case "checking":
    case "wrong":
    case "check-failed": {
      const busy = view.state === "checking";
      const retry = view.state === "wrong" || view.state === "check-failed";
      return (
        <>
          {retry && <Action kind="play" label="Try again" onClick={() => h.onStart(ply!)} />}
          <Action kind="quiet" label="Show answer" onClick={() => h.onShowAnswer(ply!)} disabled={busy} />
          <Action kind="ghost" label="Skip" onClick={() => h.onSkip(ply!)} disabled={busy} />
        </>
      );
    }
    case "found":
    case "revealed":
    case "skipped":
      return <Action kind="play" label="Next moment" onClick={() => h.onNext(view.nextPly)} />;
    default:
      return null;
  }
}

/** The card for a ready view; `KeyMomentCard` adds the summary step. */
export const KeyMomentCardBody = ({ view, ...handlers }: BodyHandlers & { view: KeyMomentView }) => {
  const buttons = actions(view, handlers);
  return (
    <article
      className={`card review-card review-card--${view.edge} key-moment`}
      data-moment-status={view.state}
      aria-live="polite"
    >
      <div className="key-moment__top">
        <span className="key-moment__step">{view.step}</span>
        <Stars view={view} />
      </div>
      <h3 className="review-card__title">{view.title}</h3>
      {view.progress && <Progress progress={view.progress} />}
      {body(view)}
      {buttons && <div className="key-moment__actions">{buttons}</div>}
    </article>
  );
};

/** Every key moment so far is done (and there is at least one). */
const allMomentsDone = ({ keyMoments }: ReviewModel, { moments }: Props["review"]) =>
  keyMoments.length > 0 &&
  keyMoments.every((m) => moments[m.ply] !== undefined && isMomentDone(moments[m.ply]));

/**
 * A's key-moment card. Next moment opens the next moment not done; with none
 * left it shows the summary (kept here, as it's only about this card). A card
 * mounted with every moment done (the review reopened) starts on the summary.
 */
export const KeyMomentCard = ({ model, review, humanColor, ...handlers }: Props) => {
  const [summary, setSummary] = useState(() => allMomentsDone(model, review));
  const view = keyMomentView({ model, review, humanColor, summary });
  const onNext = (ply: number | null) => {
    if (ply === null) setSummary(true);
    else handlers.onNext(ply);
  };
  return <KeyMomentCardBody view={view} {...handlers} onNext={onNext} />;
};
