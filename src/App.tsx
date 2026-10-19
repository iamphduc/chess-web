import React from "react";

import "./App.css";
import { useHashRoute } from "./app/useHashRoute";
import { Board } from "./features/board";
import { Home } from "./features/home/Home";

// Tutorial:
// https://www.techighness.com/post/develop-two-player-chess-game-with-react-js/
// https://react-dnd.github.io/react-dnd/docs/tutorial
// https://reactjs.org/tutorial/tutorial.html

/** Glue only: the route rules (app/route.ts) pick the screen. */
export const App = () => {
  const screen = useHashRoute();
  if (screen === "home") return <Home />;
  return (
    <div className="app" data-screen={screen}>
      <Board />
    </div>
  );
};
