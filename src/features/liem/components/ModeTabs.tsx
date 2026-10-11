import React, { useRef } from "react";

import { useAppDispatch, useAppSelector } from "app/hooks";
import { switchMode } from "../liemActions";
import type { Mode } from "../matchSlice";
import { radioKeyIndex } from "./SetupCard";

const TABS: readonly { mode: Mode; label: string }[] = [
  { mode: "liem", label: "vs Liem" },
  { mode: "two-player", label: "Two players" },
];

/**
 * "vs Liem" / "Two players" above the board. Arrow keys only move the focus; Enter,
 * Space or a click switches, because switching ends the game in progress.
 */
export function ModeTabs() {
  const dispatch = useAppDispatch();
  const mode = useAppSelector((state) => state.match.mode);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (index: number) => (event: React.KeyboardEvent) => {
    const next = radioKeyIndex(index, event.key, TABS.length);
    if (next === null) return;
    event.preventDefault();
    refs.current[next]?.focus();
  };

  return (
    <div className="liem-tabs" role="tablist" aria-label="Game mode">
      {TABS.map((tab, index) => {
        const selected = tab.mode === mode;
        return (
          <button
            key={tab.mode}
            ref={(el) => (refs.current[index] = el)}
            type="button"
            className="liem-tab"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => dispatch(switchMode(tab.mode))}
            onKeyDown={onKeyDown(index)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
