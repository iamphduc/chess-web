import React, { useEffect, useState } from "react";
import { BsClockHistory } from "react-icons/bs";

import "./Player.css";
import { TIMER } from "../../../constants";
import AvatarDefault from "assets/chess-player.png";
import { useAppDispatch, useAppSelector } from "app/hooks";
import { stop } from "../BoardSlice";
import { GameOverType } from "./GameOver";

interface Props {
  name: string;
  title: string | null;
  avatar: string | null;
  isWhite: boolean;
}

const toTime = (time: number): string => {
  if (time < 0) {
    return "00:00";
  }
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes >= 10 ? minutes : "0" + minutes}:${seconds >= 10 ? seconds : "0" + seconds}`;
};

export const Player = ({ name, title, avatar, isWhite }: Props) => {
  const { isWhiteTurn, isPlaying, gameOver } = useAppSelector((state) => state.board);
  const dispatch = useAppDispatch();

  const [remainTime, setRemainTime] = useState(TIMER);

  const isActive = isWhite === isWhiteTurn;
  const avatarSrc = avatar ? require(`assets/${avatar}`) : AvatarDefault;

  useEffect(() => {
    const interval = 1; // seconds

    const intervalIdx = setInterval(() => {
      if (isPlaying && isActive) {
        setRemainTime((prev) => prev - interval);
      }
    }, 1000 * interval);

    if (remainTime <= 0 || gameOver !== GameOverType.Continue) {
      clearInterval(intervalIdx);
      if (isPlaying) {
        dispatch(stop());
      }
    }

    return () => clearInterval(intervalIdx);
  }, [isPlaying, isActive, remainTime, gameOver, dispatch]);

  return (
    <div className="player">
      <div className="player__info">
        <img className="player__avatar" src={avatarSrc} alt="Avatar" width={40} height={40} />
        <div className="player__name">
          {title && <span className="player__title">{title}</span>}
          {name}
        </div>
      </div>
      <div className={`player__time ${isActive ? "player__time--running" : ""}`}>
        <BsClockHistory />
        <span className="player__timer">{toTime(remainTime)}</span>
      </div>
    </div>
  );
};
