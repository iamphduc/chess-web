import React, { forwardRef } from "react";
import { usePreview } from "react-dnd-multi-backend";

import { PieceType } from "game/piece-type";
import { pieceFactory } from "game/piece-factory";
import { useMediaQuery } from "hooks/useMediaQuery";
import { SQUARE_SIZE_MD, SQUARE_SIZE_XL, SQUARE_SIZE_XS } from "../../../constants";

interface ImageProps {
  pieceType: PieceType;
  size: number;
  /** The preview's position, from `usePreview`. */
  style: React.CSSProperties;
}

/** The dragged piece alone: its image at the square size, with no shadow, tint or scale. */
export const PieceDragImage = forwardRef<HTMLDivElement, ImageProps>(({ pieceType, size, style }, ref) => (
  <div
    ref={ref}
    style={{
      ...style,
      width: size,
      height: size,
      backgroundImage: `url(${pieceFactory.getPiece(pieceType).getImage()})`,
      backgroundSize: "contain",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center",
      pointerEvents: "none",
    }}
  />
));
PieceDragImage.displayName = "PieceDragImage";

/** The square size for the two media queries `Board.tsx` asks (768 px and 1200 px). */
export const previewSize = (isMd: boolean, isXl: boolean): number => {
  if (isXl) return SQUARE_SIZE_XL;
  if (isMd) return SQUARE_SIZE_MD;
  return SQUARE_SIZE_XS;
};

/** Draws the dragged piece under the finger. `usePreview` only displays under the touch backend. */
export const PieceDragPreview = () => {
  const size = previewSize(
    useMediaQuery("only screen and (min-width: 768px)"),
    useMediaQuery("only screen and (min-width: 1200px)")
  );
  const preview = usePreview<{ pieceType: PieceType }, HTMLDivElement>({ placement: "center" });
  if (!preview.display) return null;
  return <PieceDragImage ref={preview.ref} pieceType={preview.item.pieceType} size={size} style={preview.style} />;
};
