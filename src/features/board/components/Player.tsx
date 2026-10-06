import React, { useEffect, useRef, useState } from "react";

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
}

/** The clock after entering `phase` at `now`. Returns `clock` itself when nothing changes. */
export function clockForPhase(phase: ClockPhase, clock: ClockState, now: number): ClockState {
  if (phase === "running") return startClock(clock, now);
  if (phase === "paused") return pauseClock(clock, now);
  const isFresh = clock.startedAt === null && clock.remainingMs === TOTAL_MS;
  return isFresh ? clock : initialClock();
}

/** Delay until the shown value next changes: the next whole second (1000) or tenth (100). */
export function msUntilNextTick(ms: number, interval: number): number {
  return (ms % interval) + 1;
}

export const Player = ({ name, title, avatar, isWhite }: Props) => {
  const { history, pendingPromotion, isPlaying, gameOver } = useAppSelector((state) => state.board);
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

  useEffect(() => {
    const t = Date.now();
    setClock((prev) => clockForPhase(phase, prev, t));
    setNow(t);
  }, [phase]);

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
  }, [interval]); // keyed only on the interval (dispatch is stable)

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
        </div>
      </div>
      <PlayerClock remainingMs={shownMs} isActive={isActive} playerName={name} />
    </div>
  );
};
