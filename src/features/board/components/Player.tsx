import React, { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import "./Player.css";
import { useAppDispatch, useAppSelector } from "app/hooks";
import { stop } from "../BoardSlice";
import {
  ClockPhase,
  ClockState,
  clockPhase,
  initialClock,
  isWhiteClockTurn,
  pauseClock,
  remainingMs,
  startClock,
  tickInterval,
  TOTAL_MS,
} from "../clock";
import { CapturedKind, materialLine } from "../material";
import { GameOverType } from "./GameOver";
import { PlayerClock } from "./PlayerClock";
import { avatarSrc as getAvatarSrc } from "./avatar";

interface Props {
  name: string;
  title: string | null;
  avatar: string | null;
  /** The glyph on the disc in place of a photo, such as the sparring bot's ♞. Without it (and
   * without a photo) the disc shows the side's king: ♔ for White, ♚ for Black. */
  glyph?: string;
  isWhite: boolean;
  /** A line under the name, such as his Book badge or "Thinking…". */
  detail?: ReactNode;
}

/**
 * The clock after entering `phase` at `now`. Returns `clock` itself when nothing changes.
 * On a new game the clock goes back to the full time first.
 */
export function clockForPhase(
  phase: ClockPhase,
  clock: ClockState,
  now: number,
  newGame = false
): ClockState {
  if (newGame) return phase === "running" ? { remainingMs: TOTAL_MS, startedAt: now } : initialClock();
  if (phase === "running") return startClock(clock, now);
  if (phase === "paused") return pauseClock(clock, now);
  const isFresh = clock.startedAt === null && clock.remainingMs === TOTAL_MS;
  return isFresh ? clock : initialClock();
}

const GLYPHS: Record<"white" | "black", Record<CapturedKind, string>> = {
  white: { queen: "♕", rook: "♖", bishop: "♗", knight: "♘", pawn: "♙" },
  black: { queen: "♛", rook: "♜", bishop: "♝", knight: "♞", pawn: "♟" },
};

/** "+N" and the pieces this side has taken, drawn in the other side's color. */
function Material({ isWhite }: { isWhite: boolean }) {
  const engineHistory = useAppSelector((state) => state.board.engineHistory);
  const position = engineHistory[engineHistory.length - 1];
  const { captured, advantage } = useMemo(
    () => materialLine(position, isWhite ? "white" : "black"),
    [position, isWhite]
  );
  if (captured.length === 0 && advantage === 0) return null;
  const glyphs = GLYPHS[isWhite ? "black" : "white"];
  return (
    <span className="player__material" data-material={advantage}>
      {advantage > 0 && <span className="player__advantage">{`+${advantage}`}</span>}
      {captured.length > 0 && (
        <span className="player__captured" role="img" aria-label={`Captured: ${captured.join(", ")}`}>
          {captured.map((kind) => glyphs[kind]).join("")}
        </span>
      )}
    </span>
  );
}

/** Delay until the shown value next changes: the next whole second (1000) or tenth (100). */
export function msUntilNextTick(ms: number, interval: number): number {
  return (ms % interval) + 1;
}

/** The photo when there is one, else a 40 px disc with `glyph` or the side's king. */
function Avatar({ avatar, glyph, isWhite }: { avatar: string | null; glyph?: string; isWhite: boolean }) {
  const src = glyph ? null : getAvatarSrc(avatar);
  if (src) return <img className="player__avatar" src={src} alt="Avatar" width={40} height={40} />;
  return (
    <span className={glyph ? "player__disc liem-sparring-avatar" : "player__disc"} aria-hidden="true">
      {glyph ?? (isWhite ? "♔" : "♚")}
    </span>
  );
}

export const Player = ({ name, title, avatar, glyph, isWhite, detail }: Props) => {
  const { history, pendingPromotion, isPlaying, gameOver, gameId } = useAppSelector(
    (state) => state.board
  );
  const dispatch = useAppDispatch();

  const isActive = isWhite === isWhiteClockTurn(history.length, pendingPromotion !== null);
  const gameContinues = gameOver === GameOverType.Continue;
  const phase = clockPhase(isPlaying, isActive, gameContinues);

  const [clock, setClock] = useState(initialClock);
  const [now, setNow] = useState(() => Date.now());
  const shownMs = remainingMs(clock, now);
  const interval = tickInterval(phase, shownMs);

  // The clock itself: only the effect below writes it, and the timer reads it.
  // `clock` state is a copy for rendering. Never copy the state back here: a
  // render can run before the effect's setClock lands (his move right after a
  // new game), and its old clock would undo the restart.
  const latestClock = useRef(clock);

  // The game this clock last saw: a new id means a new game, so the time restarts.
  const seenGameId = useRef(gameId);

  useEffect(() => {
    const t = Date.now();
    const isNewGame = seenGameId.current !== gameId;
    seenGameId.current = gameId;
    const next = clockForPhase(phase, latestClock.current, t, isNewGame);
    latestClock.current = next;
    setClock(next);
    setNow(t);
  }, [phase, gameId]);

  // One timer per turn, replaced once at 10s; each tick lands where the digits change.
  useEffect(() => {
    if (interval === null) return;
    let id: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const left = remainingMs(latestClock.current, Date.now());
      id = setTimeout(tick, msUntilNextTick(left, interval));
    };
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (remainingMs(latestClock.current, t) <= 0) {
        dispatch(stop()); // flag fall: once, and no more ticks
        return;
      }
      schedule();
    };
    schedule();
    return () => clearTimeout(id);
  }, [interval, gameId]); // a new game restarts the timer too, so the first tick lands on time (dispatch is stable)

  useEffect(() => {
    if (isPlaying && !gameContinues) {
      dispatch(stop());
    }
  }, [isPlaying, gameContinues, dispatch]);

  return (
    <div className="player">
      <div className="player__info">
        <Avatar avatar={avatar} glyph={glyph} isWhite={isWhite} />
        <div className="player__name">
          {title && <span className="player__title">{title}</span>}
          {name}
          {detail != null && <div className="player__detail">{detail}</div>}
        </div>
        <Material isWhite={isWhite} />
      </div>
      {/* Only a running game has a running clock: once it ends, both show their final time. */}
      <PlayerClock remainingMs={shownMs} isActive={isActive && gameContinues} playerName={name} />
    </div>
  );
};
