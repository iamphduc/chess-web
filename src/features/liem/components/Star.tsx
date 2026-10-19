import React from "react";

/**
 * His ★, drawn as a shape so it can be ochre: ochre is never a text color (it fails 4.5:1
 * on cream). Each place styles it through `className` (size and `fill: var(--gold)`).
 */
export const Star = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7-6.2-3.8-6.2 3.8 1.6-7L2 9.5l7.1-.6z" />
  </svg>
);
