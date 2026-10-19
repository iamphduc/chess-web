import React from "react";

import { useAppDispatch, useAppSelector } from "app/hooks";
import { goTo, type Screen } from "app/route";
import type { AppDispatch } from "app/store";
import { LIEM } from "game/opponent/players";
import { STRENGTH_STEPS, type StrengthStep } from "game/opponent/strength";
import type { PlayerEntry } from "game/opponent/types";
import { levelView } from "features/liem/levelView";
import { startLiemGame } from "features/liem/liemActions";
import { type ColorPick, setColorPick, setStrength } from "features/liem/matchSlice";
import { RadioGroup } from "./RadioGroup";
import "./Home.css";

const TILES: readonly { pick: ColorPick; glyph: string; label: string }[] = [
  { pick: "white", glyph: "♔", label: "White" },
  { pick: "black", glyph: "♚", label: "Black" },
  { pick: "random", glyph: "?", label: "Random" },
];

const STRIP: readonly [string, string][] = [
  ["His openings", "From his real games"],
  ["Then Stockfish", "At your level"],
  ["Review", "Find your better moves"],
];

/** Home's Play: start the game with the picks, then show it (the route rules see it started). */
export function playFromHome(dispatch: AppDispatch, go: (screen: Screen) => void = goTo): void {
  dispatch(startLiemGame());
  go("play");
}

/** The ochre ★, drawn as a shape: ochre is never a text color (it fails 4.5:1 on cream). */
const Star = () => (
  <svg className="home__star" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7-6.2-3.8-6.2 3.8 1.6-7L2 9.5l7.1-.6z" />
  </svg>
);

interface HomeProps {
  /** His data; the app always passes `LIEM.entry` (the default). */
  entry?: PlayerEntry;
}

/** The first screen: pick a level and a color, then Play. */
export function Home({ entry = LIEM.entry }: HomeProps) {
  const dispatch = useAppDispatch();
  const colorPick = useAppSelector((state) => state.match.colorPick);
  const strength = useAppSelector((state) => state.match.strength);

  const stepIndex = STRENGTH_STEPS.indexOf(strength);
  const level = levelView(strength, entry);

  return (
    <main className="home">
      <div className="home__brand">
        <span className="home__mark" aria-hidden="true">
          ♞
        </span>
        <span className="home__name">Sparring</span>
      </div>

      <h1 className="home__hero">Practice a grandmaster&apos;s openings.</h1>
      <p className="home__lead">
        Bots play {entry.title} {entry.name}&apos;s opening lines from his real games, then Stockfish takes over at
        the level you pick. Every game ends with a review.
      </p>

      <div className="home__field">
        <span className="home__label">Level</span>
        <span className="home__value" data-field="level">
          {level.starred && <Star />}
          {level.stepName}
          {level.rating && <span className="home__rating">{level.rating}</span>}
        </span>
      </div>
      <RadioGroup<StrengthStep>
        label="Level"
        className="home__levels"
        options={STRENGTH_STEPS}
        checked={stepIndex}
        onPick={(step) => dispatch(setStrength(step))}
        renderOption={(step, index) => {
          const view = levelView(step, entry);
          return {
            className: index <= stepIndex ? "home__level home__level--lit" : "home__level",
            ariaLabel: view.stepLabel,
            content: (
              <>
                <span className="home__bar" aria-hidden="true" />
                <span className="home__level-name">
                  {view.starred && <Star />}
                  {view.stepName}
                </span>
              </>
            ),
          };
        }}
      />
      <p className="home__engine">{level.engineLine}</p>

      <div className="home__field">
        <span className="home__label">You play</span>
      </div>
      <RadioGroup
        label="You play"
        className="home__colors"
        options={TILES}
        checked={TILES.findIndex((tile) => tile.pick === colorPick)}
        onPick={(tile) => dispatch(setColorPick(tile.pick))}
        renderOption={(tile) => ({
          className: "home__color",
          content: (
            <>
              <span className="home__glyph" aria-hidden="true">
                {tile.glyph}
              </span>
              {tile.label}
            </>
          ),
        })}
      />

      <button type="button" className="button button--play home__play" onClick={() => playFromHome(dispatch)}>
        Play
      </button>
      <a className="home__alt" href="#/two-players">
        Two players on one board →
      </a>

      <ul className="home__strip">
        {STRIP.map(([title, line]) => (
          <li key={title} className="home__step">
            <b>{title}</b>
            {line}
          </li>
        ))}
      </ul>
    </main>
  );
}
