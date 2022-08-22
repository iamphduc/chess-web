export type Position = [number, number];

class PieceMove {
  public canKnightMove([fromX, fromY]: Position, [toX, toY]: Position) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    return (Math.abs(dx) === 2 && Math.abs(dy) === 1) || (Math.abs(dx) === 1 && Math.abs(dy) === 2);
  }

  public canRookMove([fromX, fromY]: Position, [toX, toY]: Position) {
    return (fromX === toX && fromY !== toY) || (fromX !== toX && fromY === toY);
  }

  public canBishopMove([fromX, fromY]: Position, [toX, toY]: Position) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    return fromX !== toX && fromY !== toY && Math.abs(dx) === Math.abs(dy);
  }

  public canQueenMove(from: Position, to: Position) {
    return this.canRookMove(from, to) || this.canBishopMove(from, to);
  }

  public canKingMove([fromX, fromY]: Position, [toX, toY]: Position) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    return (
      this.canQueenMove([fromX, fromY], [toX, toY]) && (Math.abs(dx) === 1 || Math.abs(dy) === 1)
    );
  }

  public canWhitePawnMove([fromX, fromY]: Position, [toX, toY]: Position) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    if (fromX === 6) {
      return (dx === -1 && dy === 0) || (dx === -2 && dy === 0);
    }
    return dx === -1 && dy === 0;
  }

  public canBlackPawnMove([fromX, fromY]: Position, [toX, toY]: Position) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    if (fromX === 1) {
      return (dx === 1 && dy === 0) || (dx === 2 && dy === 0);
    }
    return dx === 1 && dy === 0;
  }
}

export default new PieceMove();
