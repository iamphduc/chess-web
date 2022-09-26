export interface PlayerInfo {
  name: string;
  title: string | null;
  isWhite: boolean;
  avatar: string | null;
}

export const players: [PlayerInfo, PlayerInfo] = [
  {
    name: "Me",
    title: null,
    isWhite: true,
    avatar: null,
  },
  {
    name: "Le Quang Liem",
    title: "GM",
    isWhite: false,
    avatar: "le-quang-liem.png",
  },
];
