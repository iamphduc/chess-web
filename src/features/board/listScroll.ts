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

/** Not built yet (test first). */
export function listScrollTop(_view: ListView, _last: RowSpan | null): number {
  return 0;
}
