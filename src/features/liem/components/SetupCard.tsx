import React, { useRef } from "react";

import { useAppDispatch, useAppSelector } from "app/hooks";
import { LIEM } from "game/opponent/players";
import { STRENGTH_STEPS, strengthElo, type StrengthStep } from "game/opponent/strength";
import type { PlayerEntry } from "game/opponent/types";
import { startLiemGame } from "../liemActions";
import { type ColorPick, setColorPick, setStrength } from "../matchSlice";
import "./SetupCard.css";

/** FIDE federation codes the app names; anything else shows as its code. */
const FEDERATIONS: Readonly<Record<string, string>> = {
  VIE: "Vietnam",
  USA: "United States",
  NOR: "Norway",
  IND: "India",
  CHN: "China",
  FRA: "France",
  GER: "Germany",
  NED: "Netherlands",
  ENG: "England",
  ESP: "Spain",
};

export function federationName(code: string): string {
  return Object.prototype.hasOwnProperty.call(FEDERATIONS, code) ? FEDERATIONS[code] : code;
}

/**
 * The index an arrow key (or Home/End) moves to in a group of `count`, wrapping at
 * the ends; `null` for any other key.
 */
export function radioKeyIndex(index: number, key: string, count: number): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (index + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

const TILES: readonly { pick: ColorPick; glyph: string; label: string }[] = [
  { pick: "white", glyph: "♔", label: "White" },
  { pick: "black", glyph: "♚", label: "Black" },
  { pick: "random", glyph: "?", label: "Random" },
];

interface RadioGroupProps<T> {
  label: string;
  className: string;
  options: readonly T[];
  checked: number;
  onPick: (option: T) => void;
  renderOption: (option: T, index: number) => {
    className: string;
    ariaLabel?: string;
    content?: React.ReactNode;
  };
}

/** A row of `role="radio"` buttons: one tab stop, arrow keys pick and move the focus. */
function RadioGroup<T>({ label, className, options, checked, onPick, renderOption }: RadioGroupProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (index: number) => (event: React.KeyboardEvent) => {
    const next = radioKeyIndex(index, event.key, options.length);
    if (next === null) return;
    event.preventDefault();
    onPick(options[next]);
    refs.current[next]?.focus();
  };

  return (
    <div className={className} role="radiogroup" aria-label={label}>
      {options.map((option, index) => {
        const { className: optionClass, ariaLabel, content } = renderOption(option, index);
        return (
          <button
            key={index}
            ref={(el) => (refs.current[index] = el)}
            type="button"
            className={optionClass}
            role="radio"
            aria-checked={index === checked}
            aria-label={ariaLabel}
            tabIndex={index === checked ? 0 : -1}
            onClick={() => onPick(option)}
            onKeyDown={onKeyDown(index)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

interface SetupCardProps {
  /** His data; the app always passes `LIEM.entry` (the default). */
  entry?: PlayerEntry;
}

/** The challenge card: pick a color and his strength, then start the game. */
export function SetupCard({ entry = LIEM.entry }: SetupCardProps) {
  const dispatch = useAppDispatch();
  const colorPick = useAppSelector((state) => state.match.colorPick);
  const strength = useAppSelector((state) => state.match.strength);

  const title = `Challenge ${entry.name}`;
  const stepIndex = STRENGTH_STEPS.indexOf(strength);
  const elo = strengthElo(strength, entry.rating);

  return (
    <div className="liem-card setup-card" role="dialog" aria-label={title}>
      <h2 className="liem-card__title">
        <span className="liem-star" aria-hidden="true">
          ★
        </span>
        {title}
      </h2>
      <p className="liem-card__sub">{`${entry.title} · ${federationName(entry.federation)} · ${entry.rating}`}</p>

      <RadioGroup
        label="Your color"
        className="liem-tiles"
        options={TILES}
        checked={TILES.findIndex((tile) => tile.pick === colorPick)}
        onPick={(tile) => dispatch(setColorPick(tile.pick))}
        renderOption={(tile) => ({
          className: "liem-tile",
          content: (
            <>
              <span className="liem-tile__glyph" aria-hidden="true">
                {tile.glyph}
              </span>
              {tile.label}
            </>
          ),
        })}
      />

      <div className="setup-card__strength">
        <div className="setup-card__strength-top">
          <span className="setup-card__label">
            Strength
          </span>
          <span className="setup-card__value">
            {strength === "full" && <span className="setup-card__full">Full</span>}
            <span className="liem-elo">{elo}</span>
          </span>
        </div>
        <RadioGroup<StrengthStep>
          label="Strength"
          className="liem-steps"
          options={STRENGTH_STEPS}
          checked={stepIndex}
          onPick={(step) => dispatch(setStrength(step))}
          renderOption={(step, index) => ({
            className: index <= stepIndex ? "liem-step liem-step--lit" : "liem-step",
            ariaLabel: step === "full" ? `Full (${entry.rating})` : String(step),
          })}
        />
      </div>

      <div className="setup-card__actions">
        <button type="button" className="button button--play" onClick={() => dispatch(startLiemGame())}>
          Start game
        </button>
      </div>
    </div>
  );
}
