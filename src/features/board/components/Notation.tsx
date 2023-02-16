import React, { useEffect, useRef } from "react";

import "./Notation.css";
import { useAppSelector } from "app/hooks";

export const Notation = () => {
  const notationRef = useRef<null | HTMLDivElement>(null);

  const { notation } = useAppSelector((state) => state.board);
  const isWhiteLast = notation.length & 1;

  const notationRow = [];
  for (let i = 0, count = 1; i < notation.length; i += 2, count += 1) {
    const whiteMove = notation[i];
    const blackMove = notation[i + 1];
    notationRow.push(
      <tr key={i}>
        <td>{count}.</td>
        <td className={isWhiteLast && i === notation.length - 1 ? "notation__last" : ""}>
          {whiteMove}
        </td>
        <td className={!isWhiteLast && i + 1 === notation.length - 1 ? "notation__last" : ""}>
          {blackMove}
        </td>
        <td></td>
      </tr>
    );
  }

  useEffect(() => {
    if (notationRef.current) {
      notationRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
        inline: "nearest",
      });
    }
  }, [notation]);

  return (
    <div className="notation">
      <table>
        <tbody>{notationRow}</tbody>
      </table>
      <div className="notation__bottom" ref={notationRef}></div>
    </div>
  );
};
