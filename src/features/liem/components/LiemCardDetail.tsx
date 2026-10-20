import React, { useMemo } from "react";

import "./BookNote.css";
import { useAppSelector } from "app/hooks";
import { bookNoteView, liemBadge, type LiemBadge } from "../bookNote";
import { Star } from "./Star";

const count = new Intl.NumberFormat("en-US");

/** The "★ Book · N" badge (an ochre ★ shape). The count has its own span, so a phone can show just "★ Book". */
function Badge({ badge }: { badge: LiemBadge }) {
  return (
    <span className="liem-badge" data-book-games={badge.games}>
      <Star className="liem-badge__star" />
      <span className="liem-badge__text">
        Book<span className="liem-badge__count">{` · ${count.format(badge.games)}`}</span>
      </span>
    </span>
  );
}

/**
 * Under his name: "Thinking…" while he loads or thinks, else the badge while he's in his
 * book, else nothing (plan ui-polish: no level line, rating or Stockfish pill).
 */
export const LiemCardDetail = () => {
  const engineHistory = useAppSelector((s) => s.board.engineHistory);
  const gameId = useAppSelector((s) => s.board.gameId);
  const lastChoice = useAppSelector((s) => s.match.lastChoice);
  const opponentStatus = useAppSelector((s) => s.match.opponentStatus);
  const badge = useMemo(
    () => liemBadge(bookNoteView({ engineHistory, gameId }, { lastChoice, opponentStatus })),
    [engineHistory, gameId, lastChoice, opponentStatus]
  );
  const thinking = opponentStatus === "loading" || opponentStatus === "thinking";
  if (!thinking && badge === null) return null;

  return (
    <div className="liem-detail">
      {thinking ? <span className="liem-detail__thinking">Thinking…</span> : badge && <Badge badge={badge} />}
    </div>
  );
};
