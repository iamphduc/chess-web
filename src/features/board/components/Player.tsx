import React from "react";
import { BsClockHistory } from "react-icons/bs";

import "./Player.css";
import AvatarDefault from "assets/chess-player.png";
import { useAppSelector } from "app/hooks";

interface Props {
  name: string;
  title: string | null;
  avatar: string | null;
  isWhite: boolean;
}

export const Player = ({ name, title, avatar, isWhite }: Props) => {
  const { isWhiteTurn } = useAppSelector((state) => state.board);

  const isActive = isWhite === isWhiteTurn;
  const avatarSrc = avatar ? require(`assets/${avatar}`) : AvatarDefault;

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
        <span className="player__timer">10:00</span>
      </div>
    </div>
  );
};
