import React, { type ReactNode, useEffect, useRef, useState } from "react";

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
import { GameOverType } from "./GameOver";
import { PlayerClock } from "./PlayerClock";
import { avatarSrc as getAvatarSrc } from "./avatar";

interface Props {
  name: string;
  title: string | null;
  avatar: string | null;
  isWhite: boolean;
  /** Extra lines under the name, such as his strength and Book badge. */
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

/** Delay until the shown value next changes: the next whole second (1000) or tenth (100). */
export function msUntilNextTick(ms: number, interval: number): number {
  return (ms % interval) + 1;
}

export const Player = ({ name, title, avatar, isWhite, detail }: Props) => {
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

  // The timer reads the latest clock without being recreated on every tick.
  const latestClock = useRef(clock);
  latestClock.current = clock;

  // The game this clock last saw: a new id means a new game, so the time restarts.
  const seenGameId = useRef(gameId);

  useEffect(() => {
    const t = Date.now();
    const isNewGame = seenGameId.current !== gameId;
    seenGameId.current = gameId;
    // Set the ref too, so the timer effect below schedules from the new clock.
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
        <img className="player__avatar" src={getAvatarSrc(avatar)} alt="Avatar" width={40} height={40} />
        <div className="player__name">
          {title && <span className="player__title">{title}</span>}
          {name}
          {detail != null && <div className="player__detail">{detail}</div>}
        </div>
      </div>
      <PlayerClock remainingMs={shownMs} isActive={isActive} playerName={name} />
    </div>
  );
};
