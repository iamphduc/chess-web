import React from "react";

import "./Button.css";
import { useAppDispatch } from "app/hooks";
import { reset, start } from "../BoardSlice";

export enum ButtonType {
  Play = "Play",
  Reset = "Reset",
  Undo = "Undo",
}

interface Props {
  type: ButtonType;
}

export const Button = ({ type }: Props) => {
  const dispatch = useAppDispatch();

  const handleClick = () => {
    switch (type) {
      case ButtonType.Play: {
        dispatch(start());
        break;
      }
      case ButtonType.Reset: {
        dispatch(reset());
      }
    }
  };

  return (
    <button className={`button button--${type.toLowerCase()}`} onClick={handleClick}>
      {type}
    </button>
  );
};
