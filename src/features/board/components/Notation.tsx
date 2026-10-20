import React, { useEffect, useRef } from "react";

import "./Notation.css";
import { useAppSelector } from "app/hooks";
import { listScrollTop } from "../listScroll";

/** One move cell; the last move played sits in the ink chip. */
const Move = ({ text, current }: { text: string | undefined; current: boolean }) => (
  <span className="notation__move">
    {current ? <span className="scoresheet__current">{text}</span> : text}
  </span>
);

/** The game's moves as a scoresheet: one row per move number, White then Black. */
export const Notation = () => {
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const { notation } = useAppSelector((state) => state.board);
  const last = notation.length - 1;

  const rows = [];
  for (let i = 0; i < notation.length; i += 2) {
    rows.push(
      <li key={i} className="scoresheet__row">
        <span className="scoresheet__num">{i / 2 + 1}.</span>
        <Move text={notation[i]} current={i === last} />
        <Move text={notation[i + 1]} current={i + 1 === last} />
      </li>
    );
  }

  // Keep the last row in view by setting the box's own scrollTop. This used to call
  // scrollIntoView on a marker under the list (from 1200 px), which scrolls every
  // scrollable ancestor too: the page jumped back up to the Moves card on every move.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const row = listRef.current?.lastElementChild ?? null;
    const boxTop = box.getBoundingClientRect().top;
    const span = row && {
      top: row.getBoundingClientRect().top - boxTop + box.scrollTop,
      height: row.getBoundingClientRect().height,
    };
    const top = listScrollTop({ scrollTop: box.scrollTop, height: box.clientHeight }, span);
    if (top !== box.scrollTop) box.scrollTop = top;
  }, [notation]);

  return (
    <div className="notation" ref={boxRef}>
      <ol className="scoresheet" ref={listRef}>
        {rows}
      </ol>
    </div>
  );
};
