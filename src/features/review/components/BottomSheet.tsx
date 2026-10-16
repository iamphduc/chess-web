import React from "react";

import "./BottomSheet.css";

interface Props {
  open: boolean;
  /** While trying a move: only the title and buttons, no scrim, so the board stays usable. */
  low: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * C's phone bottom sheet for the key-moment card. Closed, it stays mounted but
 * hidden, so the card inside keeps its own state.
 */
export const BottomSheet = ({ open, low, onClose, children }: Props) => (
  <>
    {open && !low && <div className="review-scrim" aria-hidden="true" onClick={onClose} />}
    <section
      className={`review-sheet bottom-sheet${low ? " review-sheet--low bottom-sheet--low" : ""}`}
      data-sheet-open={open ? "true" : "false"}
      aria-label="Key moment"
      hidden={!open}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <button type="button" className="review-sheet__grab" aria-label="Hide key moment" onClick={onClose} />
      <button type="button" className="review-sheet__close" aria-label="Close" onClick={onClose}>
        ✕
      </button>
      {children}
    </section>
  </>
);
