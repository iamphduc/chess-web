import React, { useMemo } from "react";

import "./BookNote.css";
import { useAppSelector } from "app/hooks";
import { LIEM } from "game/opponent/players";
import { strengthElo } from "game/opponent/strength";
import { bookNoteView, liemBadge, type LiemBadge } from "../bookNote";

const count = new Intl.NumberFormat("en-US");

/** The gold "★ Book · N" badge in book, or the grey "Stockfish" pill in its place out of book. */
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
      <span className="liem-badge__text">
        ★ Book<span className="liem-badge__count">{` · ${count.format(badge.games)}`}</span>
      </span>
    </span>
  );
}

/**
 * Under his name: "GM · playing about 2100", then the badge, or "Thinking…" while he loads or thinks.
 * Each part of the line has its own span, so a narrow board can show less of it (Board.css).
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
  const { title, rating } = LIEM.entry;
  const thinking = opponentStatus === "loading" || opponentStatus === "thinking";

  return (
    <div className="liem-detail">
      <span className="liem-detail__sub">
        <span className="liem-detail__lead">{`${title} · playing `}</span>
        <span className="liem-detail__about">about </span>
        <span className="liem-detail__elo">{strengthElo(strength, rating)}</span>
      </span>
      {thinking ? (
        <span className="liem-detail__thinking">Thinking…</span>
      ) : (
        badge && <Badge badge={badge} />
      )}
    </div>
  );
};
