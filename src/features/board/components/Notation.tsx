import React, { useEffect, useRef } from "react";

import "./Notation.css";
import { useAppSelector } from "app/hooks";
import { useMediaQuery } from "hooks/useMediaQuery";

/** One move cell; the last move played sits in the ink chip. */
const Move = ({ text, current }: { text: string | undefined; current: boolean }) => (
  <span className="notation__move">
    {current ? <span className="scoresheet__current">{text}</span> : text}
  </span>
);

/** The game's moves as a scoresheet: one row per move number, White then Black. */
export const Notation = () => {
  const bottomRef = useRef<null | HTMLDivElement>(null);

  const { notation } = useAppSelector((state) => state.board);
  const isLargeScreen = useMediaQuery("only screen and (min-width: 1200px)");
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

  useEffect(() => {
    if (bottomRef.current && isLargeScreen) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
    }
  }, [notation, isLargeScreen]);

  return (
    <div className="notation">
      <ol className="scoresheet">{rows}</ol>
      <div className="notation__bottom" ref={bottomRef}></div>
    </div>
  );
};
