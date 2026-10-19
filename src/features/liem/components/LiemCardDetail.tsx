import React, { useMemo } from "react";

import "./BookNote.css";
import { useAppSelector } from "app/hooks";
import { bookNoteView, liemBadge, type LiemBadge } from "../bookNote";
import { levelView } from "../levelView";
import { Star } from "./Star";

const count = new Intl.NumberFormat("en-US");

/** The "★ Book · N" badge (an ochre ★ shape) in book, or the "Stockfish" pill in its place out of book. */
function Badge({ badge }: { badge: LiemBadge }) {
  if (badge.kind === "engine") {
    return (
      <span className="liem-badge liem-badge--engine" data-engine="stockfish">
        Stockfish
      </span>
    );
  }
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
 * Under the name: "Plays Liem's openings" for a sparring bot or "GM · 2732" for him, then the
 * badge, or "Thinking…" while he loads or thinks. The part a phone drops ("Plays ") has its own
 * span, so Player.css can hide it from sight and screen readers still read the whole line.
 */
export const LiemCardDetail = () => {
  const strength = useAppSelector((s) => s.match.strength);
  const engineHistory = useAppSelector((s) => s.board.engineHistory);
  const gameId = useAppSelector((s) => s.board.gameId);
  const lastChoice = useAppSelector((s) => s.match.lastChoice);
  const opponentStatus = useAppSelector((s) => s.match.opponentStatus);
  const badge = useMemo(
    () => liemBadge(bookNoteView({ engineHistory, gameId }, { lastChoice, opponentStatus })),
    [engineHistory, gameId, lastChoice, opponentStatus]
  );
  const { detailLead, shortDetail } = levelView(strength);
  const thinking = opponentStatus === "loading" || opponentStatus === "thinking";

  return (
    <div className="liem-detail">
      <span className="liem-detail__sub">
        {detailLead && <span className="liem-detail__lead">{detailLead}</span>}
        <span className="liem-detail__short">{shortDetail}</span>
      </span>
      {thinking ? (
        <span className="liem-detail__thinking">Thinking…</span>
      ) : (
        badge && <Badge badge={badge} />
      )}
    </div>
  );
};
