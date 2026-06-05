export type Position = [number, number];

export abstract class Piece {
  protected readonly isBlack: boolean;
  protected image: string;
  protected weight: number;
  protected abbreviation: string;

  constructor(isBlack: boolean) {
    this.isBlack = isBlack;
    this.image = "";
    this.weight = 0;
    this.abbreviation = "";
  }

  public isWhitePiece(): boolean {
    return !this.isBlack;
  }

  public getImage(): string {
    return this.image;
  }

  public getWeight(): number {
    return this.weight;
  }

  public getAbbreviation(): string {
    return this.abbreviation;
  }
}
