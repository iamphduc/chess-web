export interface PlayerInfo {
  name: string;
  title: string | null;
  isWhite: boolean;
  avatar: string | null;
}

/** The two sides in Two players: named for their color, each with its color disc (no photo). */
export const players: [PlayerInfo, PlayerInfo] = [
  {
    name: "White",
    title: null,
    isWhite: true,
    avatar: null,
  },
  {
    name: "Black",
    title: null,
    isWhite: false,
    avatar: null,
  },
];
