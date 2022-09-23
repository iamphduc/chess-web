import { King } from "./king";

export class Knight extends King {
  constructor() {
    super();
    this.directions = [
      // Top - Left
      [-2, -1],
      [-1, -2],
      // Top - Right
      [1, -2],
      [2, -1],
      // Bottom - Right
      [2, 1],
      [1, 2],
      // Bottom - Left
      [-1, 2],
      [-2, 1],
    ];
  }
}

export const knight = new Knight();
