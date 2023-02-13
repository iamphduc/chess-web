import React from "react";

import "./Notation.css";
import { useAppSelector } from "app/hooks";
import { Position } from "game/pieces/piece";

export enum SpecialCase {
  None = "",
  Capture = "x",
  QueenSideCastling = "0-0-0",
  KingSideCastling = "0-0",
  Check = "+",
  Checkmate = "#",
}

const convertToAN = (abbreviation: string, [y, x]: Position, specialCase: SpecialCase) => {
  const position = String.fromCharCode(x + 97) + (8 - y);
  switch (specialCase) {
    case SpecialCase.QueenSideCastling:
    case SpecialCase.KingSideCastling:
      return specialCase;
    case SpecialCase.None:
    case SpecialCase.Check:
    case SpecialCase.Checkmate:
      return abbreviation + position + specialCase;
    default:
      return abbreviation + specialCase + position;
  }
};

export const Notation = () => {
  const { whiteNotation, blackNotation } = useAppSelector((state) => state.board);
  const isWhiteLast = whiteNotation.length > blackNotation.length;

  return (
    <div className="notation">
      <table>
        <tbody>
          {whiteNotation.map((move, i) => (
            <tr key={i}>
              <td>{i + 1}.</td>
              <td className={isWhiteLast && i === whiteNotation.length - 1 ? "notation__last" : ""}>
                {convertToAN(move.abbreviation, move.position, move.specialCase)}
              </td>
              <td
                className={!isWhiteLast && i === blackNotation.length - 1 ? "notation__last" : ""}
              >
                {blackNotation[i]
                  ? convertToAN(
                      blackNotation[i].abbreviation,
                      blackNotation[i].position,
                      blackNotation[i].specialCase
                    )
                  : ""}
              </td>
              <td></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
