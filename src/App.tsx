import React from "react";

import "./App.css";
import { Board } from "./features/board";

// Tutorial:
// https://www.techighness.com/post/develop-two-player-chess-game-with-react-js/
// https://react-dnd.github.io/react-dnd/docs/tutorial
// https://reactjs.org/tutorial/tutorial.html

export const App = () => {
  return (
    <div className="app">
      <Board />
    </div>
  );
};
