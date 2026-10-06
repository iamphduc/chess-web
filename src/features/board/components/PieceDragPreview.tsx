import React from "react";

import { PieceType } from "game/piece-type";

interface ImageProps {
  pieceType: PieceType;
  size: number;
  style: React.CSSProperties;
}

// Stub: filled in by the feat commit.
export const PieceDragImage = (_props: ImageProps) => null;

export const previewSize = (_isMd: boolean, _isXl: boolean): number => 0;
