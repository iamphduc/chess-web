/** The scrolling box: how far it has scrolled and how tall its view is. */
export interface ListView {
  scrollTop: number;
  height: number;
}

/** A row's place inside the box's content (0 is the content top, not the view top). */
export interface RowSpan {
  top: number;
  height: number;
}

/**
 * The box's new `scrollTop` so the last row shows. A row below the view (or cut off by
 * its bottom) lands at the box bottom; a row above the view lands at the box top; a row
 * in view leaves the box where it is. An empty list (`null`, a new game) goes back to 0.
 */
export function listScrollTop(view: ListView, last: RowSpan | null): number {
  if (last === null) return 0;
  const bottom = last.top + last.height;
  if (bottom > view.scrollTop + view.height) return Math.max(0, bottom - view.height);
  if (last.top < view.scrollTop) return Math.max(0, last.top);
  return view.scrollTop;
}
