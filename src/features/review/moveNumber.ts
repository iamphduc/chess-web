/** The move number a ply belongs to: plies 0 and 1 are move 1. */
export const moveNumber = (ply: number): number => Math.floor(ply / 2) + 1;
