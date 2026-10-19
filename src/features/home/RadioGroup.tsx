import React, { useRef } from "react";

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
export function RadioGroup<T>({ label, className, options, checked, onPick, renderOption }: RadioGroupProps<T>) {
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
