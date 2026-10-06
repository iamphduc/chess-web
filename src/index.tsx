import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { DndProvider } from "react-dnd-multi-backend";
import { HTML5toTouch } from "rdndmb-html5-to-touch";

import "./index.css";
import reportWebVitals from "./reportWebVitals";
import { App } from "./App";
import { store } from "./app/store";
import { PieceDragPreview } from "features/board/components/PieceDragPreview";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <Provider store={store}>
    <DndProvider options={HTML5toTouch}>
      <React.StrictMode>
        <App />
        <PieceDragPreview />
      </React.StrictMode>
    </DndProvider>
  </Provider>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
